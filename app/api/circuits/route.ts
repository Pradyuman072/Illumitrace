import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectToDatabase from "@/lib/mongodb";
import Circuit from "@/models/Circuit";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    
    // @ts-ignore
    const circuits = await Circuit.find({ userId: session.user.id }).sort({ updatedAt: -1 });

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

    const { name, schematicComponents, pcbComponents, connections } = await req.json();

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
