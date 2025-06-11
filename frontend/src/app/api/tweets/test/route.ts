import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

export async function POST(req: NextRequest) {
  try {
    const { accountId, action, text, tweetId } = await req.json();

    // Validar que existe la cuenta
    await connectDB();
    const account = await XAccount.findById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Simular una pequeña delay (como si fuera a Twitter)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simular respuesta exitosa
    const mockResponse = {
      data: {
        id: Math.random().toString(36).substring(7),
        text: text || `Acción ${action} simulada`,
        created_at: new Date().toISOString(),
      },
      account: account.username,
      action,
      simulated: true,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(mockResponse);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error en endpoint de prueba" },
      { status: 500 }
    );
  }
}
