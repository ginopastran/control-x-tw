import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { TwitterApi } from "twitter-api-v2";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tweetId: string }> }
) {
  try {
    const { id: accountId, tweetId } = await params;

    console.log("🗑️ Eliminando tweet:", { accountId, tweetId });

    // Buscar la cuenta
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Verificar credenciales
    if (!account.useOwnCredentials) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta no está configurada para usar credenciales propias",
        },
        { status: 400 }
      );
    }

    let twitterClient;

    // Configurar cliente según credenciales disponibles
    if (account.ownOAuth2AccessToken) {
      // OAuth 2.0 - Usar API v2
      console.log("🔧 Usando API v2 con OAuth 2.0...");
      twitterClient = new TwitterApi(account.ownOAuth2AccessToken);

      // ✅ API v2: DELETE /2/tweets/{id}
      const result = await twitterClient.v2.deleteTweet(tweetId);
      console.log("✅ Tweet eliminado (v2):", result);

      if (result.data?.deleted) {
        return NextResponse.json({
          success: true,
          message: "Tweet eliminado correctamente",
          data: result.data,
        });
      } else {
        throw new Error("No se pudo eliminar el tweet");
      }
    } else if (
      account.ownApiKey &&
      account.ownApiSecret &&
      account.ownAccessToken &&
      account.ownAccessTokenSecret
    ) {
      // OAuth 1.0a - Usar API v1.1
      console.log("🔧 Usando API v1.1 con OAuth 1.0a...");
      twitterClient = new TwitterApi({
        appKey: account.ownApiKey,
        appSecret: account.ownApiSecret,
        accessToken: account.ownAccessToken,
        accessSecret: account.ownAccessTokenSecret,
      });

      // ✅ API v1.1: POST statuses/destroy/:id
      const result = await twitterClient.v1.deleteTweet(tweetId);
      console.log("✅ Tweet eliminado (v1.1):", result);

      return NextResponse.json({
        success: true,
        message: "Tweet eliminado correctamente",
        data: {
          id: result.id_str,
          deleted: true,
        },
      });
    } else {
      return NextResponse.json(
        { error: "No hay credenciales válidas configuradas" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("❌ Error eliminando tweet:", error);

    // Manejo de errores específicos de Twitter
    if (error.code) {
      const errorMessages: { [key: number]: string } = {
        34: "Tweet no encontrado - Puede que ya esté eliminado",
        63: "Usuario suspendido",
        144: "Tweet no encontrado o no tienes permisos para eliminarlo",
        179: "No estás autorizado para ver este tweet",
        183: "No puedes eliminar un tweet que no es tuyo",
      };

      const message =
        errorMessages[error.code] || `Error de Twitter: ${error.message}`;

      return NextResponse.json(
        {
          error: message,
          twitterError: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
