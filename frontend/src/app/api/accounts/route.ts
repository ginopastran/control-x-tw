// app/api/accounts/route.ts
import { connectDB } from "@/lib/db";
import prisma from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export const runtime = 'nodejs';

// GET: listar todas las cuentas
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    // Obtener todas las cuentas de X ordenadas por fecha de creación (más recientes primero)
    const accounts = await prisma.xAccount.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error al obtener cuentas:", error);
    return NextResponse.json(
      { error: "Error al obtener las cuentas" },
      { status: 500 }
    );
  }
}

// POST: agregar una nueva cuenta
export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();

    // Verificar que no exista una cuenta con el mismo username
    const existingAccount = await prisma.xAccount.findFirst({
      where: { username: body.username },
    });
    if (existingAccount) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este username" },
        { status: 400 }
      );
    }

    // Crear nueva cuenta
    const accountData = {
      username: body.username,
      userId: body.userId || `manual_${body.username}_${Date.now()}`, // Generar ID si no se proporciona
      accessToken: body.accessToken || "",
      refreshToken: body.refreshToken || "",
      developerTag: body.developerTag || "manual",
      labels: body.labels || [],
      useOwnCredentials: body.useOwnCredentials || false,
      preferOAuth2: body.preferOAuth2 || false,
      credentialsVerified: false,
      hasAccessToken: !!body.accessToken,
      hasRefreshToken: !!body.refreshToken,
      needsReauth: false,
    };

    const newAccount = await prisma.xAccount.create({
      data: accountData,
    });

    return NextResponse.json({
      success: true,
      account: newAccount,
      message: "Cuenta creada exitosamente",
    });
  } catch (error) {
    console.error("Error al crear cuenta:", error);
    return NextResponse.json(
      { error: "Error al crear la cuenta" },
      { status: 500 }
    );
  }
}
