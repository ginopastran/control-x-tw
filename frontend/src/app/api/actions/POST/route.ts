// app/api/actions/post/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// Función para postear con la API de X
async function postToX(account: any, messageText: string) {
  if (!account.ownBearerToken) {
    throw new Error("No hay Bearer Token configurado");
  }

  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.ownBearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: messageText,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(JSON.stringify(error));
  }

  return await response.json();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId } = body;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Mensaje no encontrado" },
        { status: 404 }
      );
    }

    // Buscar cuentas que tengan alguna de las etiquetas del mensaje
    const accounts = await prisma.xAccount.findMany({
      where: {
        labels: {
          hasSome: message.labels,
        },
        useOwnCredentials: true,
        credentialsVerified: true,
      },
    });

    const resultados = [];

    for (const account of accounts) {
      try {
        const resultado = await postToX(account, message.text);
        resultados.push({
          username: account.username,
          status: "ok",
          tweetId: resultado.data?.id,
        });
      } catch (err: any) {
        resultados.push({
          username: account.username,
          status: "error",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      enviados: resultados.filter((r) => r.status === "ok").length,
      errores: resultados.filter((r) => r.status === "error").length,
      resultados,
    });
  } catch (error: any) {
    console.error("Error en POST action:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
