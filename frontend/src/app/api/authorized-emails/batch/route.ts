import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AuthorizedEmail from "@/models/AuthorizedEmail";
import { getAuthUser } from "@/lib/auth";

// DELETE: Eliminar todos los correos autorizados no usados
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();

    // Verificar autenticación y permisos
    const user = await getAuthUser(req);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Solo SUPERADMIN puede realizar operaciones por lotes.",
        },
        { status: 403 }
      );
    }

    // Eliminar solo los correos autorizados no usados
    const result = await AuthorizedEmail.deleteMany({ used: false });

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount} correos autorizados no usados eliminados exitosamente`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error("Error al eliminar correos autorizados por lotes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
