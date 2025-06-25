import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tweetId: string }> }
) {
  try {
    const { id, tweetId } = await params;

    if (!tweetId) {
      return NextResponse.json(
        { error: "ID del tweet es requerido" },
        { status: 400 }
      );
    }

    await connectDB();
    const account = await XAccount.findById(id);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
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

    // Eliminar tweet en Twitter
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${account.ownBearerToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Error eliminando tweet:", error);
      return NextResponse.json(
        {
          error: error.detail || error.title || "Error al eliminar tweet",
          message: `No se pudo eliminar el tweet ${tweetId}`,
          details: error,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: "Tweet eliminado exitosamente",
      data: result,
    });
  } catch (error) {
    console.error("Error eliminando tweet:", error);
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
