import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST: Hacer retweet a un tweet
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, tweetId } = body;

    if (!accountId || !tweetId) {
      return NextResponse.json(
        { error: "Se requiere ID de cuenta e ID del tweet" },
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

    if (!account.userId) {
      return NextResponse.json(
        { error: "userId no configurado para esta cuenta" },
        { status: 400 }
      );
    }

    // Datos para la API de X
    const payload = {
      tweet_id: tweetId,
    };

    console.log(
      `Enviando retweet al tweet ${tweetId} con la cuenta ${account.username}`
    );

    // Enviar a la API de X
    const response = await fetch(
      `https://api.twitter.com/2/users/${account.userId}/retweets`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${account.ownBearerToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Error al hacer retweet:", data);
      return NextResponse.json(
        { error: "Error al hacer retweet", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: "Retweet realizado correctamente",
      result: data.data,
    });
  } catch (error) {
    console.error("Error al hacer retweet:", error);
    return NextResponse.json(
      { error: "Error al hacer retweet" },
      { status: 500 }
    );
  }
}
