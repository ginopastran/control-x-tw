import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

// DELETE: Eliminar una cuenta de X por su ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: "ID de cuenta no proporcionado" },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    const deletedAccount = await XAccount.findByIdAndDelete(id);
    
    if (!deletedAccount) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { message: "Cuenta eliminada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al eliminar cuenta:", error);
    return NextResponse.json(
      { error: "Error al eliminar la cuenta" },
      { status: 500 }
    );
  }
}

// GET: Obtener una cuenta específica por ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    await connectDB();
    
    const account = await XAccount.findById(id);
    
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(account);
  } catch (error) {
    console.error("Error al obtener cuenta:", error);
    return NextResponse.json(
      { error: "Error al obtener la cuenta" },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar propiedades de una cuenta
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const data = await req.json();
    
    // Solo permitir actualizar ciertos campos
    const allowedFields = ['labels', 'developerTag'];
    const updateData: Record<string, any> = {};
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos válidos para actualizar" },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    const updatedAccount = await XAccount.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true } // Devuelve el documento actualizado
    );
    
    if (!updatedAccount) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("Error al actualizar cuenta:", error);
    return NextResponse.json(
      { error: "Error al actualizar la cuenta" },
      { status: 500 }
    );
  }
} 