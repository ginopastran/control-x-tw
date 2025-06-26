import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, setAuthCookieInResponse } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
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
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Verificar si el usuario existe y tiene contraseña
    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Generar token (AGREGAR AWAIT)
    const token = await generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    console.log("🔐 Token generado:", token);
    console.log("🍪 Estableciendo cookie...");

    // Crear respuesta
    const response = NextResponse.json({
      success: true,
      token: token, // Agregar token para localStorage
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // Establecer cookie
    const result = setAuthCookieInResponse(response, token);

    console.log("✅ Cookie establecida en respuesta");
    return result;
  } catch (error: any) {
    console.error("Error al iniciar sesión:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
