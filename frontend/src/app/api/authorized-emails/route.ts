import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// GET: Listar correos autorizados (solo SUPERADMIN)
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación y permisos
    const user = await getAuthUser(req);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Solo SUPERADMIN puede gestionar correos autorizados.",
        },
        { status: 403 }
      );
    }

    // Obtener todos los correos autorizados
    const authorizedEmails = await prisma.authorizedEmail.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        account: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      authorizedEmails: authorizedEmails,
    });
  } catch (error: any) {
    console.error("Error al obtener correos autorizados:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST: Agregar nuevo correo autorizado (solo SUPERADMIN)
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación y permisos
    const user = await getAuthUser(req);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo SUPERADMIN puede autorizar correos." },
        { status: 403 }
      );
    }

    const { email } = await req.json();

    // Validar email
    if (!email) {
      return NextResponse.json(
        { error: "El email es obligatorio" },
        { status: 400 }
      );
    }

    // Verificar que el email no esté ya autorizado
    const existingAuthorized = await prisma.authorizedEmail.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingAuthorized) {
      return NextResponse.json(
        { error: "Este email ya está en la lista de autorizados" },
        { status: 400 }
      );
    }

    // Verificar que no sea un email ya registrado por un usuario
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya tiene una cuenta de usuario registrada" },
        { status: 400 }
      );
    }

    // Crear email autorizado
    const authorizedEmail = await prisma.authorizedEmail.create({
      data: {
        email: email.toLowerCase(),
        // Nota: En el nuevo schema, no se vincula al SUPERADMIN que autoriza,
        // ya que se asume que solo ellos pueden hacerlo.
        // Si se necesita, se debería añadir un campo 'authorizedById' al schema.
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Email autorizado exitosamente",
        authorizedEmail: authorizedEmail,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error al autorizar email:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
