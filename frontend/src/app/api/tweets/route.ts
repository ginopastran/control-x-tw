import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logError, logAction } from "@/lib/log-action";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body || body.trim() === "") {
      return NextResponse.json(
        { error: "Request body vacío" },
        { status: 400 }
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      return NextResponse.json(
        { error: "JSON inválido en request body" },
        { status: 400 }
      );
    }

    const { accountId, action, text, tweetId } = parsedBody;

    if (!accountId || !action) {
      return NextResponse.json(
        { error: "accountId y action son requeridos" },
        { status: 400 }
      );
    }

    // Validar cuenta usando Prisma
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Validaciones básicas
    const actionsRequiringUserId = ["like", "retweet"];
    if (actionsRequiringUserId.includes(action) && !account.userId) {
      return NextResponse.json(
        {
          error: `La cuenta @${account.username} no tiene userId configurado`,
        },
        { status: 400 }
      );
    }

    const actionsRequiringText = ["tweet", "reply"];
    if (actionsRequiringText.includes(action) && !text?.trim()) {
      return NextResponse.json(
        { error: `text es requerido para la acción ${action}` },
        { status: 400 }
      );
    }

    // Simular respuesta exitosa (implementar lógica real según necesidades)
    const mockResponse = {
      data: {
        id: Math.random().toString(36).substring(7),
        text: text || `Acción ${action} simulada`,
        created_at: new Date().toISOString(),
      },
      account: account.username,
      action,
      timestamp: new Date().toISOString(),
    };

    logAction("twitter_action_success", {
      action,
      accountId: account.id,
      username: account.username,
    });

    return NextResponse.json(mockResponse);
  } catch (error: any) {
    logError("twitter_action_failed", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la acción" },
      { status: 500 }
    );
  }
}
