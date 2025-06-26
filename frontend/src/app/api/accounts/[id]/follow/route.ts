import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action, username } = await req.json();
    const { id } = await params;

    if (!action || !username) {
      return NextResponse.json(
        { error: "Acción y username son requeridos" },
        { status: 400 }
      );
    }

    if (!["follow", "unfollow"].includes(action)) {
      return NextResponse.json(
        { error: "Acción debe ser 'follow' o 'unfollow'" },
        { status: 400 }
      );
    }

    const account = await prisma.xAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    if (!account.userId) {
      return NextResponse.json(
        { error: "userId no configurado para esta cuenta" },
        { status: 400 }
      );
    }

    // Verificar credenciales propias
    if (!account.useOwnCredentials || !account.credentialsVerified) {
      return NextResponse.json(
        { error: "Esta cuenta no tiene credenciales propias configuradas" },
        { status: 400 }
      );
    }

    if (!account.ownBearerToken) {
      return NextResponse.json(
        { error: "No se encontró Bearer Token para esta cuenta" },
        { status: 400 }
      );
    }

    // Obtener el ID del usuario a seguir/dejar de seguir
    const userResponse = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}`,
      {
        headers: {
          Authorization: `Bearer ${account.ownBearerToken}`,
        },
      }
    );

    if (!userResponse.ok) {
      const error = await userResponse.json();
      console.error("❌ Error buscando usuario:", error);
      return NextResponse.json(
        { error: `Usuario @${username} no encontrado` },
        { status: 404 }
      );
    }

    const userData = await userResponse.json();
    const targetUserId = userData.data.id;

    // Ejecutar la acción de follow/unfollow
    const endpoint = `https://api.twitter.com/2/users/${account.userId}/following`;
    const method = action === "follow" ? "POST" : "DELETE";

    const followResponse = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${account.ownBearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: targetUserId,
      }),
    });

    if (!followResponse.ok) {
      const error = await followResponse.json();
      console.error(`❌ Error en ${action}:`, error);
      return NextResponse.json(
        {
          error: error.detail || error.title || `Error al ${action}`,
          message: `No se pudo ${action} a @${username}`,
          details: error,
        },
        { status: followResponse.status }
      );
    }

    const result = await followResponse.json();

    return NextResponse.json({
      success: true,
      message: `${
        action === "follow" ? "Siguiendo" : "Dejaste de seguir"
      } a @${username}`,
      data: result,
    });
  } catch (error) {
    console.error(`Error en follow/unfollow:`, error);
    return NextResponse.json(
      {
        error:
          "Error interno del servidor: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
