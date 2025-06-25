import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { generateToken, setAuthCookieInResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Conectar a la base de datos
    await connectDB();

    // Obtener datos del cuerpo de la solicitud
    const { email, password } = await req.json();

    // Validar datos
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // Buscar usuario por email
    const user = await User.findOne({ email });

    // Verificar si el usuario existe
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Generar token
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Crear respuesta
    const response = NextResponse.json({
      success: true,
      token: token, // Agregar token para localStorage
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // Establecer cookie
    return setAuthCookieInResponse(response, token);
  } catch (error: any) {
    console.error("Error al iniciar sesión:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
