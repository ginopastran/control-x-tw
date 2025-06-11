// app/api/actions/post/route.ts
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import Message from "@/models/Message";
import { NextResponse } from "next/server";

// Función para postear con la API de X
async function postToX(accessToken: string, message: string) {
  // Esta función simula el POST — en producción usarías fetch con la API de X
  console.log(`[SIMULADO] Posteando: "${message}" con token: ${accessToken.slice(0, 6)}...`);
  return true;
}

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json();
  const { messageId } = body;

  const message = await Message.findById(messageId);
  if (!message) return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });

  const accounts = await XAccount.find({
    labels: { $in: message.labels }
  });

  const resultados = [];

  for (const account of accounts) {
    try {
      const resultado = await postToX(account.accessToken, message.text);
      resultados.push({ username: account.username, status: "ok" });
    } catch (err) {
      resultados.push({ username: account.username, status: "error", error: err });
    }
  }

  return NextResponse.json({ enviados: resultados.length, resultados });
}
