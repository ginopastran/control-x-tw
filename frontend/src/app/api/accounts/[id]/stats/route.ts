import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();
    const account = await XAccount.findById(id);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Devolver estadísticas basadas en las métricas de la cuenta
    const stats = {
      tweets: account.metrics?.tweets || 0,
      retweets: account.metrics?.retweets || 0,
      likes: account.metrics?.likes || 0,
      follows: account.metrics?.follows || 0,
      unfollows: account.metrics?.unfollows || 0,
      replies: account.metrics?.replies || 0,
      totalActions: account.metrics?.totalActions || 0,
    };

    return NextResponse.json({
      success: true,
      stats,
      account: {
        username: account.username,
        userId: account.userId,
        status: account.status,
        useOwnCredentials: account.useOwnCredentials,
        credentialsVerified: account.credentialsVerified,
      },
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    return NextResponse.json(
      {
        error:
          "Error interno del servidor: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
