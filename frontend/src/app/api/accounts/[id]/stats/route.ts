import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const account = await prisma.xAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Devolver estadísticas basadas en las métricas de la cuenta
    // Como no tenemos un campo metrics en Prisma, usamos valores por defecto
    const stats = {
      tweets: 0,
      retweets: 0,
      likes: 0,
      follows: 0,
      unfollows: 0,
      replies: 0,
      totalActions: 0,
    };

    // Si tenemos datos reales de métricas, los usaríamos aquí
    // Por ahora, simulamos con datos básicos

    return NextResponse.json({
      success: true,
      stats,
      account: {
        username: account.username,
        userId: account.userId,
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
