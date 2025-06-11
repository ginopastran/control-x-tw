import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { getValidToken } from "@/services/tokenService";
import { logError, logAction } from "@/lib/log-action";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "Se requiere accountId como parámetro" },
        { status: 400 }
      );
    }

    await connectDB();
    const account = await XAccount.findById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Obtener token válido
    const accessToken = await getValidToken(accountId);

    // Endpoints para verificar límites
    const endpoints = [
      {
        name: "tweets_create",
        url: "https://api.twitter.com/2/tweets",
        description: "Crear tweets",
      },
      {
        name: "users_me",
        url: "https://api.twitter.com/2/users/me",
        description: "Información del usuario",
      },
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        // Hacer una solicitud HEAD o GET para obtener headers sin usar la cuota
        const response = await fetch(endpoint.url, {
          method: endpoint.name === "users_me" ? "GET" : "HEAD",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        const rateLimitHeaders = {
          limit: response.headers.get("x-rate-limit-limit"),
          remaining: response.headers.get("x-rate-limit-remaining"),
          reset: response.headers.get("x-rate-limit-reset"),
        };

        // Calcular tiempo hasta reset
        let resetInfo = null;
        if (rateLimitHeaders.reset) {
          const resetTimestamp = parseInt(rateLimitHeaders.reset) * 1000;
          const now = Date.now();
          const waitTime = Math.max(0, resetTimestamp - now);
          const waitMinutes = Math.ceil(waitTime / (1000 * 60));
          resetInfo = {
            timestamp: resetTimestamp,
            waitTime: waitTime,
            waitMinutes: waitMinutes,
            resetAt: new Date(resetTimestamp).toISOString(),
          };
        }

        // Obtener data de respuesta si es GET
        let responseData = null;
        if (response.ok && endpoint.name === "users_me") {
          responseData = await response.json();
        }

        results.push({
          endpoint: endpoint.name,
          description: endpoint.description,
          status: response.status,
          statusText: response.statusText,
          rateLimits: rateLimitHeaders,
          resetInfo,
          responseData: endpoint.name === "users_me" ? responseData : null,
        });
      } catch (error: any) {
        results.push({
          endpoint: endpoint.name,
          description: endpoint.description,
          error: error.message,
          status: "error",
        });
      }
    }

    // Información adicional de la cuenta
    const accountInfo = {
      id: account._id,
      username: account.username,
      userId: account.userId,
      hasAccessToken: !!account.accessToken,
      hasRefreshToken: !!account.refreshToken,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    logAction("rate_limits_check", {
      accountId: account._id,
      username: account.username,
      results: results.map((r) => ({
        endpoint: r.endpoint,
        status: r.status,
        remaining: r.rateLimits?.remaining,
      })),
    });

    return NextResponse.json({
      account: accountInfo,
      rateLimits: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logError("rate_limits_check_failed", error);
    return NextResponse.json(
      { error: error.message || "Error al verificar límites" },
      { status: 500 }
    );
  }
}
