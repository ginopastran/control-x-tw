import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AuthorizedEmail from "@/models/AuthorizedEmail";
import { getAuthUser } from "@/lib/auth";

// GET: Listar correos autorizados (solo SUPERADMIN)
export async function GET(req: NextRequest) {
  try {
    await connectDB();

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
    const authorizedEmails = await AuthorizedEmail.find({})
      .populate("authorizedBy", "name email")
      .populate("usedBy", "name email")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      authorizedEmails: authorizedEmails.map((email) => ({
        id: email._id,
        email: email.email,
        authorizedBy: email.authorizedBy,
        authorizedAt: email.authorizedAt,
        used: email.used,
        usedBy: email.usedBy,
        usedAt: email.usedAt,
        createdAt: email.createdAt,
      })),
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
    await connectDB();

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
    const existingAuthorized = await AuthorizedEmail.findOne({
      email: email.toLowerCase(),
    });

    if (existingAuthorized) {
      return NextResponse.json(
        { error: "Este email ya está autorizado" },
        { status: 400 }
      );
    }

    // Verificar que no sea un email ya registrado
    const User = (await import("@/models/User")).default;
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya tiene una cuenta registrada" },
        { status: 400 }
      );
    }

    // Crear email autorizado
    const authorizedEmail = await AuthorizedEmail.create({
      email: email.toLowerCase(),
      authorizedBy: user.id,
    });

    // Poblar los datos del usuario que autorizó
    await authorizedEmail.populate("authorizedBy", "name email");

    return NextResponse.json(
      {
        success: true,
        message: "Email autorizado exitosamente",
        authorizedEmail: {
          id: authorizedEmail._id,
          email: authorizedEmail.email,
          authorizedBy: authorizedEmail.authorizedBy,
          authorizedAt: authorizedEmail.authorizedAt,
          used: authorizedEmail.used,
          createdAt: authorizedEmail.createdAt,
        },
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
