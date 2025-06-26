import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Obtener token de la solicitud
    const token = getTokenFromRequest(req);

    // Si no hay token, el usuario no está autenticado
    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Verificar token
    const payload = await verifyToken(token);

    // Si el token no es válido, el usuario no está autenticado
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Buscar usuario por ID
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    // Si no se encuentra el usuario, el token no es válido
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Devolver información del usuario
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Error al obtener usuario actual:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
