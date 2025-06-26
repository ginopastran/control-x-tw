import { NextRequest, NextResponse } from "next/server";
import { generateToken, setAuthCookieInResponse } from "@/lib/auth";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Verificar usuario
    const user = await db.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      !user.password ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Generar token
    const token = await generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // ✅ CREAR RESPUESTA Y ESTABLECER COOKIE
    const response = NextResponse.json({
      success: true,
      token, // Para debug/desarrollo
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // ✅ ESTABLECER COOKIE EN LA RESPUESTA
    return setAuthCookieInResponse(response, token);
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
