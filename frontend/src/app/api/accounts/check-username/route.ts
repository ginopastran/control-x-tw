import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const excludeId = searchParams.get("excludeId");

    if (!username) {
      return NextResponse.json(
        { error: "Username es requerido" },
        { status: 400 }
      );
    }

    // Validaciones básicas del username
    if (username.length > 15) {
      return NextResponse.json({
        available: false,
        reason: "El nombre de usuario no puede tener más de 15 caracteres",
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({
        available: false,
        reason: "Solo se permiten letras, números y guiones bajos",
      });
    }

    if (username.startsWith("_") || username.endsWith("_")) {
      return NextResponse.json({
        available: false,
        reason: "No puede empezar o terminar con guión bajo",
      });
    }

    // Construir query para verificar disponibilidad
    const whereClause: any = { username };
    if (excludeId) {
      whereClause.id = { not: excludeId };
    }

    const existingAccount = await prisma.xAccount.findFirst({
      where: whereClause,
    });

    return NextResponse.json({
      available: !existingAccount,
      reason: existingAccount ? "Este nombre de usuario ya está en uso" : null,
    });
  } catch (error: any) {
    console.error("Error checking username availability:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
