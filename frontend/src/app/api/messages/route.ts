// app/api/messages/route.ts
import { connectDB } from "../lib/mongodb";
import Message from "../../../models/Message";
import { NextResponse } from "next/server";

// GET: listar todos los mensajes
export async function GET() {
  await connectDB();
  const messages = await Message.find();
  return NextResponse.json(messages);
}

// POST: crear mensaje nuevo
export async function POST(request: Request) {
  await connectDB();
  const body = await request.json();

  const newMessage = await Message.create({
    text: body.text,
    type: body.type,
    labels: body.labels || []
  });

  return NextResponse.json(newMessage);
}
