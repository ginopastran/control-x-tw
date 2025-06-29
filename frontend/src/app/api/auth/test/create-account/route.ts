import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Endpoint para crear una cuenta de prueba (solo para desarrollo)
export async function POST(req: NextRequest) {
  // Este endpoint solo debería estar disponible en entorno de desarrollo
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint no disponible en producción" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { username = "usuario_prueba", userId = "123456789" } = body;

    // Crear cuenta de prueba con datos ficticios usando Prisma
    const newAccount = await prisma.xAccount.create({
      data: {
        username: username,
        userId: userId,
        accessToken: "token_prueba_" + Date.now(),
        refreshToken: "refresh_token_prueba",
        developerTag: "desarrollo",
        labels: ["prueba", "desarrollo"],
        useOwnCredentials: false,
        credentialsVerified: false,
        preferOAuth2: false,
      },
    });

    console.log("Cuenta de prueba creada:", newAccount);

    return NextResponse.json({
      message: "Cuenta de prueba creada con éxito",
      account: newAccount,
    });
  } catch (error: any) {
    console.error("Error al crear cuenta de prueba:", error);
    return NextResponse.json(
      { error: "Error al crear cuenta de prueba: " + error.message },
      { status: 500 }
    );
  }
}

// También permitir solicitudes GET para facilitar la creación desde el navegador
export async function GET() {
  // Este endpoint solo debería estar disponible en entorno de desarrollo
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint no disponible en producción" },
      { status: 403 }
    );
  }

  try {
    // Generar un nombre de usuario único basado en timestamp
    const username = "cuenta_" + Date.now().toString().slice(-6);
    const userId = Date.now().toString();

    // Crear cuenta de prueba con datos ficticios usando Prisma
    const newAccount = await prisma.xAccount.create({
      data: {
        username: username,
        userId: userId,
        accessToken: "token_prueba_" + Date.now(),
        refreshToken: "refresh_token_prueba",
        developerTag: "desarrollo",
        labels: ["prueba", "desarrollo"],
        useOwnCredentials: false,
        credentialsVerified: false,
        preferOAuth2: false,
      },
    });

    console.log("Cuenta de prueba creada por GET:", newAccount);

    return NextResponse.json({
      message: "Cuenta de prueba creada con éxito",
      account: newAccount,
    });
  } catch (error: any) {
    console.error("Error al crear cuenta de prueba:", error);
    return NextResponse.json(
      { error: "Error al crear cuenta de prueba: " + error.message },
      { status: 500 }
    );
  }
}
