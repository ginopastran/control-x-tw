import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// DELETE: Eliminar correo autorizado (solo SUPERADMIN y solo si no ha sido usado)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación y permisos
    const user = await getAuthUser(req);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Solo SUPERADMIN puede eliminar correos autorizados.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verificar que el ID sea válido
    if (!id) {
      return NextResponse.json(
        { error: "ID de correo autorizado requerido" },
        { status: 400 }
      );
    }

    // Buscar el correo autorizado usando Prisma
    const authorizedEmail = await prisma.authorizedEmail.findUnique({
      where: { id },
    });

    if (!authorizedEmail) {
      return NextResponse.json(
        { error: "Correo autorizado no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que no haya sido usado (no tiene accountId)
    if (authorizedEmail.accountId) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar un correo autorizado que ya ha sido utilizado para crear una cuenta",
        },
        { status: 400 }
      );
    }

    // Eliminar el correo autorizado
    await prisma.authorizedEmail.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Correo autorizado eliminado exitosamente",
    });
  } catch (error: any) {
    console.error("Error al eliminar correo autorizado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
