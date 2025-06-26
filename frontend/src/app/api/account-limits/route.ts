import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    // Obtener límites de todas las cuentas desde Prisma
    const accounts = await prisma.xAccount.findMany({
      select: {
        id: true,
        username: true,
        labels: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transformar datos para el dashboard con límites por defecto
    const accountLimits = accounts.map((account) => {
      const defaultLimits = {
        tweets: {
          used: 0,
          limit: 300,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        follows: {
          used: 0,
          limit: 400,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        likes: {
          used: 0,
          limit: 1000,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        retweets: {
          used: 0,
          limit: 300,
          reset: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      return {
        id: account.id,
        username: account.username,
        labels: account.labels || [],
        dailyLimits: defaultLimits,
        status: "active",
        lastActivity:
          account.updatedAt?.toISOString() ||
          account.createdAt?.toISOString() ||
          new Date().toISOString(),
      };
    });

    return NextResponse.json(accountLimits);
  } catch (error: any) {
    console.error("Error al obtener límites de cuentas:", error);
    return NextResponse.json(
      { error: "Error al obtener límites de cuentas" },
      { status: 500 }
    );
  }
}
