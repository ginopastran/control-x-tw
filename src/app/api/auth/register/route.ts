import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { generateToken, setAuthCookieInResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Conectar a la base de datos
    await connectDB();

    // Obtener datos del cuerpo de la solicitud
    const { name, email, password, role = "ADMIN" } = await req.json();

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

    // Validar el rol (solo se permite crear ADMIN por defecto)
    let userRole = role;

    // Verificar si es el primer usuario (será SUPERADMIN)
    const usersCount = await User.countDocuments();
    if (usersCount === 0) {
      userRole = "SUPERADMIN";
    } else if (role === "SUPERADMIN") {
      // Solo SUPERADMIN puede crear otro SUPERADMIN
      // Esta validación se hace en el middleware, pero es una capa adicional de seguridad
      userRole = "ADMIN";
    }

    // Crear el usuario
    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
    });

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
