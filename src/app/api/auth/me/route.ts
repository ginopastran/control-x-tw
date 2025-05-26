import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getTokenFromRequest } from "@/lib/auth";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Obtener token de la solicitud
    const token = getTokenFromRequest(req);

    // Si no hay token, el usuario no está autenticado
    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Verificar token
    const payload = verifyToken(token);

    // Si el token no es válido, el usuario no está autenticado
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Conectar a la base de datos
    await connectDB();

    // Buscar usuario por ID
    const user = await User.findById(payload.id).select("-password");

    // Si no se encuentra el usuario, el token no es válido
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Devolver información del usuario
    return NextResponse.json(
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al obtener usuario actual:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
