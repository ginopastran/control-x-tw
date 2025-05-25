import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

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

    await connectDB();
    
    // Obtener la cuenta
    const account = await XAccount.findById(accountId);
    
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Datos para la API de X
    const payload = {
      tweet_id: tweetId,
      user_id: account.userId
    };

    console.log(`Enviando retweet al tweet ${tweetId} con la cuenta ${account.username}`);

    // Enviar a la API de X
    const response = await fetch("https://api.twitter.com/2/retweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${account.accessToken}`
      },
      body: JSON.stringify(payload)
    });

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
      result: data.data
    });
  } catch (error) {
    console.error("Error al hacer retweet:", error);
    return NextResponse.json(
      { error: "Error al hacer retweet" },
      { status: 500 }
    );
  }
} 