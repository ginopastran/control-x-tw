import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import AuthorizedEmail from "@/models/AuthorizedEmail";
import { generateToken, setAuthCookieInResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Conectar a la base de datos
    await connectDB();

    // Obtener datos del cuerpo de la solicitud
    const { name, email, password } = await req.json();

    // Validar datos
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    // Verificar si el email ya está registrado
    const userExists = await User.findOne({ email });
    if (userExists) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    // Verificar si es el primer usuario (será SUPERADMIN)
    const usersCount = await User.countDocuments();
    let userRole = "ADMIN";
    let authorizedEmail = null;

    if (usersCount === 0) {
      // Primera cuenta = SUPERADMIN (sin restricciones)
      userRole = "SUPERADMIN";
      console.log("🔐 Creando primera cuenta como SUPERADMIN:", email);
    } else {
      // A partir de la segunda cuenta, verificar que el email esté autorizado
      authorizedEmail = await AuthorizedEmail.findOne({
        email: email.toLowerCase(),
        used: false,
      });

      if (!authorizedEmail) {
        return NextResponse.json(
          {
            error:
              "Este correo electrónico no está autorizado para registrarse. Contacta al administrador para obtener autorización.",
          },
          { status: 403 }
        );
      }

      // El rol siempre será ADMIN para cuentas autorizadas
      userRole = "ADMIN";
    }

    // Crear el usuario
    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
    });

    // Si se usó un email autorizado, marcarlo como usado
    if (authorizedEmail) {
      await AuthorizedEmail.findByIdAndUpdate(authorizedEmail._id, {
        used: true,
        usedBy: user._id,
        usedAt: new Date(),
      });
    }

    // Generar token
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Crear respuesta
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        message:
          usersCount === 0
            ? "Cuenta de SUPERADMIN creada exitosamente"
            : "Cuenta de ADMIN creada exitosamente",
      },
      { status: 201 }
    );

    // Establecer cookie
    return setAuthCookieInResponse(response, token);
  } catch (error: any) {
    console.error("Error al registrar usuario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
