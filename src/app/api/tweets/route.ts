import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { getValidToken } from "@/services/tokenService";
import { withRateLimitRetry } from "@/lib/rate-limit";
import { logError, logAction } from "@/lib/log-action";

// Función auxiliar para validar cuenta
async function validateAccount(accountId: string) {
  if (!accountId) {
    throw new Error("Se requiere ID de cuenta");
  }

  await connectDB();
  const account = await XAccount.findById(accountId);

  if (!account) {
    throw new Error("Cuenta no encontrada");
  }

  return account;
}

// Función auxiliar para manejar errores
function handleError(error: any, defaultMessage: string) {
  console.error(defaultMessage, error);
  const message = error.message || defaultMessage;
  return NextResponse.json({ error: message }, { status: error.status || 500 });
}

export async function POST(req: NextRequest) {
  try {
    const { accountId, action, text, tweetId } = await req.json();

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

    // Función para realizar la acción en Twitter
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
            reply: { in_reply_to_tweet_id: tweetId }
          };
          break;
        default:
          throw new Error("Acción no válida");
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.message || "Error en la API de Twitter");
      }

      return response.json();
    };

    // Ejecutar la acción con manejo de rate limits
    const result = await withRateLimitRetry(
      performTwitterAction,
      action,
      accountId
    );

    logAction('twitter_action_success', {
      action,
      accountId: account._id,
      username: account.username
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logError('twitter_action_failed', error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la acción" },
      { status: error.status || 500 }
    );
  }
} 