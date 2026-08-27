import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectToDatabase from "@/lib/mongodb";
import Circuit from "@/models/Circuit";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;

    await connectToDatabase();
    
    // @ts-ignore
    const circuit = await Circuit.findOne({ _id: resolvedParams.id, userId: session.user.id });
    
    if (!circuit) {
      return NextResponse.json({ message: "Circuit not found" }, { status: 404 });
    }

    return NextResponse.json(circuit, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error fetching circuit" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;

    await connectToDatabase();
    
    // @ts-ignore
    const deletedCircuit = await Circuit.findOneAndDelete({ _id: resolvedParams.id, userId: session.user.id });
    
    if (!deletedCircuit) {
      return NextResponse.json({ message: "Circuit not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ message: "Circuit deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error deleting circuit" }, { status: 500 });
  }
}

import { CircuitSaveSchema } from "../route";

export async function PUT(req: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await req.json();

    const validationResult = CircuitSaveSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        message: "Invalid circuit payload", 
        errors: validationResult.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { name, schematicComponents, pcbComponents, connections } = validationResult.data;

    await connectToDatabase();
    
    // @ts-ignore
    const updatedCircuit = await Circuit.findOneAndUpdate(
      // @ts-ignore
      { _id: resolvedParams.id, userId: session.user.id },
      {
        $set: {
          ...(name && { name }),
          ...(schematicComponents && { schematicComponents }),
          ...(pcbComponents && { pcbComponents }),
          ...(connections && { connections }),
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedCircuit) {
      return NextResponse.json({ message: "Circuit not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json(updatedCircuit, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error updating circuit" }, { status: 500 });
  }
}
