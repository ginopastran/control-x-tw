// app/api/messages/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET: listar todos los mensajes
export async function GET() {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST: crear mensaje nuevo
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newMessage = await prisma.message.create({
      data: {
        text: body.text,
        type: body.type || "tweet",
        labels: body.labels || [],
      },
    });

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error("Error al crear mensaje:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
