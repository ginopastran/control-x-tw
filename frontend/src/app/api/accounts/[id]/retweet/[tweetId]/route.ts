import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { TwitterApi } from "twitter-api-v2";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tweetId: string }> }
) {
  try {
    const { id: accountId, tweetId } = await params;

    console.log("🔄 Eliminando retweet:", { accountId, tweetId });

    // Obtener cuenta
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
        { error: "Esta cuenta no tiene credenciales propias configuradas" },
        { status: 400 }
      );
    }

    // Inicializar cliente Twitter
    let twitterClient: TwitterApi;

    try {
      if (account.preferOAuth2 && account.ownOAuth2AccessToken) {
        // OAuth 2.0
        console.log("🔧 Usando OAuth 2.0...");
        twitterClient = new TwitterApi(account.ownOAuth2AccessToken);
      } else if (
        account.ownAccessToken &&
        account.ownAccessTokenSecret &&
        account.ownApiKey &&
        account.ownApiSecret
      ) {
        // OAuth 1.0a
        console.log("🔧 Usando OAuth 1.0a...");
        twitterClient = new TwitterApi({
          appKey: account.ownApiKey,
          appSecret: account.ownApiSecret,
          accessToken: account.ownAccessToken,
          accessSecret: account.ownAccessTokenSecret,
        });
      } else {
        throw new Error("No hay credenciales válidas configuradas");
      }
    } catch (error: any) {
      console.error("❌ Error inicializando cliente Twitter:", error);
      return NextResponse.json(
        { error: "Error de configuración de credenciales" },
        { status: 400 }
      );
    }

    // ✅ Usar la API v2 correcta para eliminar retweet
    try {
      // Primero necesitamos obtener el ID del usuario
      const userInfo = await twitterClient.v2.me();
      const userId = userInfo.data.id;

      console.log("👤 Usuario ID:", userId);
      console.log("🔄 Eliminando retweet del tweet:", tweetId);

      // Usar el endpoint correcto según la documentación de X
      // DELETE /2/users/{id}/retweets/{source_tweet_id}
      const result = await twitterClient.v2.unretweet(userId, tweetId);

      console.log("✅ Retweet eliminado exitosamente:", result);

      // Actualizar métricas de la cuenta
      const currentMetrics = (account.metrics as any) || {};
      const updatedMetrics = {
        ...currentMetrics,
        retweets: Math.max(0, (currentMetrics.retweets || 0) - 1),
        lastRetweetAt: new Date().toISOString(),
      };

      await prisma.xAccount.update({
        where: { id: accountId },
        data: {
          metrics: updatedMetrics,
          lastActivity: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Retweet eliminado exitosamente",
        data: result.data || result,
      });
    } catch (twitterError: any) {
      console.error("❌ Error de la API de Twitter:", twitterError);

      // Manejar errores específicos de Twitter
      let errorMessage = "Error eliminando retweet";

      if (twitterError.code === 144) {
        errorMessage = "El tweet no existe o no es accesible";
      } else if (twitterError.code === 327) {
        errorMessage = "Ya has eliminado este retweet";
      } else if (twitterError.errors && twitterError.errors[0]) {
        errorMessage =
          twitterError.errors[0].message || twitterError.errors[0].detail;
      } else if (twitterError.message) {
        errorMessage = twitterError.message;
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details:
            twitterError.errors || twitterError.data || twitterError.message,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("❌ Error general eliminando retweet:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    );
  }
}
