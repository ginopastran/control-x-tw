import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

interface AccountLimits {
  _id: string;
  username: string;
  labels: string[];
  dailyLimits: {
    tweets: { used: number; limit: number; reset: string };
    follows: { used: number; limit: number; reset: string };
    likes: { used: number; limit: number; reset: string };
    retweets: { used: number; limit: number; reset: string };
  };
  status: "active" | "suspended" | "limited" | "error";
  lastActivity: string;
}

// GET: Obtener límites de todas las cuentas
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const accounts = await XAccount.find(
      {},
      {
        username: 1,
        labels: 1,
        dailyLimits: 1,
        status: 1,
        lastActivity: 1,
        createdAt: 1,
      }
    );

    // Transformar datos para el dashboard
    const accountLimits: AccountLimits[] = accounts.map((account) => {
      // Valores por defecto si no existen límites
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
        _id: account._id.toString(),
        username: account.username,
        labels: account.labels || [],
        dailyLimits: account.dailyLimits || defaultLimits,
        status: account.status || "active",
        lastActivity:
          account.lastActivity ||
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
