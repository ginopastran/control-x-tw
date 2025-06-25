import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

// POST: Publicar un nuevo tweet
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, text, media } = body;

    if (!accountId || !text) {
      return NextResponse.json(
        { error: "Se requiere ID de cuenta y texto" },
        { status: 400 }
      );
    }

    await connectDB();

    // Obtener la cuenta
    const account = await XAccount.findById(accountId);

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    console.log(
      `Enviando tweet desde la cuenta ${account.username}: "${text.substring(
        0,
        30
      )}..."`
    );

    // Datos para la API de X
    const tweetData: any = {
      text: text,
    };

    // Si hay media, agregarla
    if (media && media.length > 0) {
      // Esta es una versión simplificada, la API de X requiere
      // primero subir el media y obtener un ID
      tweetData.media = { media_ids: media };
    }

    // Enviar a la API de X
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${account.accessToken}`,
      },
      body: JSON.stringify(tweetData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error al publicar tweet:", data);
      return NextResponse.json(
        { error: "Error al publicar tweet", details: data },
        { status: response.status }
      );
    }

    console.log("Tweet publicado exitosamente:", data);

    return NextResponse.json({
      message: "Tweet publicado correctamente",
      tweet: data.data,
    });
  } catch (error: any) {
    console.error("Error al publicar tweet:", error);
    return NextResponse.json(
      {
        error:
          "Error al publicar tweet: " + (error.message || "Error desconocido"),
      },
      { status: 500 }
    );
  }
}
