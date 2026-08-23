import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectToDatabase from "@/lib/mongodb";
import Circuit from "@/models/Circuit";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

const PinSchema = z.object({
  x: z.number(),
  y: z.number(),
  type: z.string().optional()
}).passthrough();

const FootprintSchema = z.object({
  width: z.number(),
  height: z.number(),
  pins: z.array(PinSchema).optional().default([])
}).passthrough();

const ComponentSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  x: z.number(),
  y: z.number(),
  footprint: FootprintSchema.optional().default({ width: 2, height: 2, pins: [] })
}).passthrough();

const ConnectionSchema = z.object({
  id: z.string(),
  start: z.string(),
  end: z.string()
}).passthrough();

const CircuitSaveSchema = z.object({
  name: z.string().optional(),
  schematicComponents: z.array(ComponentSchema).max(500, "Too many schematic components (max 500)").optional(),
  pcbComponents: z.array(ComponentSchema).max(500, "Too many PCB components (max 500)").optional(),
  connections: z.array(ConnectionSchema).max(500, "Too many connections (max 500)").optional()
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    
    // @ts-ignore
    const circuits = await Circuit.find({ userId: session.user.id }).select('_id name updatedAt').sort({ updatedAt: -1 });

    return NextResponse.json(circuits, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error fetching circuits" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    // Validate payload against Zod schema
    const validationResult = CircuitSaveSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        message: "Invalid circuit payload", 
        errors: validationResult.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { name, schematicComponents, pcbComponents, connections } = validationResult.data;

    await connectToDatabase();

    const newCircuit = new Circuit({
      name: name || "Untitled Circuit",
      // @ts-ignore
      userId: session.user.id,
      schematicComponents: schematicComponents || [],
      pcbComponents: pcbComponents || [],
      connections: connections || [],
    });

    await newCircuit.save();

    return NextResponse.json(newCircuit, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error saving circuit" }, { status: 500 });
  }
}
