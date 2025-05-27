import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { getValidToken } from "@/services/tokenService";
import { logError, logAction } from "@/lib/log-action";

export async function POST(req: NextRequest) {
  try {
    // Validar que el request tenga body
    const body = await req.text();
    if (!body || body.trim() === "") {
      return NextResponse.json(
        { error: "Request body vacío" },
        { status: 400 }
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      return NextResponse.json(
        { error: "JSON inválido en request body" },
        { status: 400 }
      );
    }

    const { accountId, action, text, tweetId } = parsedBody;

    // Validar parámetros requeridos
    if (!accountId) {
      return NextResponse.json(
        { error: "accountId es requerido" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "action es requerido" },
        { status: 400 }
      );
    }

    // Validar cuenta
    await connectDB();
    const account = await XAccount.findById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Obtener token válido
    const accessToken = await getValidToken(accountId);

    // Función para realizar la acción en Twitter con timeout
    const performTwitterAction = async () => {
      let endpoint = "";
      let method = "POST";
      let body: any = {};

      switch (action) {
        case "tweet":
          endpoint = "https://api.twitter.com/2/tweets";
          body = { text };
          break;
        case "like":
          endpoint = `https://api.twitter.com/2/users/${account.userId}/likes`;
          body = { tweet_id: tweetId };
          break;
        case "retweet":
          endpoint = `https://api.twitter.com/2/users/${account.userId}/retweets`;
          body = { tweet_id: tweetId };
          break;
        case "reply":
          endpoint = "https://api.twitter.com/2/tweets";
          body = {
            text,
            reply: { in_reply_to_tweet_id: tweetId },
          };
          break;
        default:
          throw new Error("Acción no válida");
      }

      // Crear AbortController para timeout de 30 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();

          // Preservar el status code y crear mensaje específico
          if (response.status === 429) {
            const errorObj = new Error(
              "🕐 Rate limit de Twitter excedido. Espera unos minutos antes de intentar de nuevo."
            );
            (errorObj as any).status = 429;
            throw errorObj;
          }

          const errorObj = new Error(
            error.detail ||
              error.message ||
              `Error ${response.status} de Twitter API`
          );
          (errorObj as any).status = response.status;
          throw errorObj;
        }

        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === "AbortError") {
          throw new Error(`Timeout: ${action} tardó más de 30 segundos`);
        }

        throw error;
      }
    };

    // Ejecutar la acción sin rate limits
    const result = await performTwitterAction();

    logAction("twitter_action_success", {
      action,
      accountId: account._id,
      username: account.username,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logError("twitter_action_failed", error);

    // Preservar el status code de Twitter API si está disponible
    const statusCode = error.status || 500;

    return NextResponse.json(
      { error: error.message || "Error al procesar la acción" },
      { status: statusCode }
    );
  }
}
