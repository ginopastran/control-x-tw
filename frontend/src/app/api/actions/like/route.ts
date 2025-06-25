import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

// POST: Dar like a un tweet
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

    // Enviar a la API de X
    const endpoint = `https://api.twitter.com/2/users/${account.userId}/likes`;
    const payload = {
      tweet_id: tweetId,
    };

    console.log(
      `Enviando like al tweet ${tweetId} con la cuenta ${account.username}`
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${account.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error al dar like:", data);
      return NextResponse.json(
        { error: "Error al dar like", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: "Like dado correctamente",
      result: data.data,
    });
  } catch (error) {
    console.error("Error al dar like:", error);
    return NextResponse.json({ error: "Error al dar like" }, { status: 500 });
  }
}
