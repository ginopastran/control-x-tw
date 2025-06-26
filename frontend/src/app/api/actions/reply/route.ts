import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST: Responder a un tweet
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, tweetId, text } = body;

    if (!accountId || !tweetId || !text) {
      return NextResponse.json(
        {
          error: "Se requiere ID de cuenta, ID del tweet y texto de respuesta",
        },
        { status: 400 }
      );
    }

    // Obtener la cuenta usando Prisma
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

    // Datos para la API de X
    const replyData = {
      text: text,
      reply: {
        in_reply_to_tweet_id: tweetId,
      },
    };

    console.log(
      `Enviando respuesta al tweet ${tweetId} con la cuenta ${account.username}`
    );

    // Enviar a la API de X
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${account.ownBearerToken}`,
      },
      body: JSON.stringify(replyData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error al enviar respuesta:", data);
      return NextResponse.json(
        { error: "Error al enviar respuesta", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: "Respuesta enviada correctamente",
      tweet: data.data,
    });
  } catch (error) {
    console.error("Error al enviar respuesta:", error);
    return NextResponse.json(
      { error: "Error al enviar respuesta" },
      { status: 500 }
    );
  }
}
