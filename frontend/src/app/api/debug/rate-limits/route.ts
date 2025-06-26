import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logError, logAction } from "@/lib/log-action";

export const dynamic = "force-dynamic";

async function getValidToken(accountId: string): Promise<string | null> {
  const account = await prisma.xAccount.findUnique({
    where: { id: accountId },
    include: { tokenInfo: true },
  });

  if (!account) return null;

  // Usar Bearer Token si está disponible
  if (account.ownBearerToken) {
    return account.ownBearerToken;
  }

  // Usar OAuth 2.0 access token
  if (account.ownOAuth2AccessToken) {
    // Verificar si no ha expirado
    if (
      account.oauth2TokenExpiresAt &&
      account.oauth2TokenExpiresAt > new Date()
    ) {
      return account.ownOAuth2AccessToken;
    }
  }

  return null;
}

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

    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Obtener token válido
    const accessToken = await getValidToken(accountId);

    if (!accessToken) {
      return NextResponse.json(
        { error: "No hay token válido disponible para esta cuenta" },
        { status: 400 }
      );
    }

    // Endpoints para verificar límites
    const endpoints = [
      {
        name: "tweets_create",
        url: "https://api.twitter.com/2/tweets",
        description: "Crear tweets",
        method: "HEAD",
      },
      {
        name: "users_me",
        url: "https://api.twitter.com/2/users/me",
        description: "Información del usuario",
        method: "GET",
      },
      {
        name: "users_likes",
        url: `https://api.twitter.com/2/users/${account.userId}/likes`,
        description: "Dar likes",
        method: "HEAD",
      },
      {
        name: "users_retweets",
        url: `https://api.twitter.com/2/users/${account.userId}/retweets`,
        description: "Hacer retweets",
        method: "HEAD",
      },
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        // Hacer una solicitud HEAD o GET para obtener headers sin usar la cuota
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
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
        if (response.ok && endpoint.method === "GET") {
          responseData = await response.json();
        }

        results.push({
          endpoint: endpoint.name,
          description: endpoint.description,
          status: response.status,
          statusText: response.statusText,
          rateLimits: rateLimitHeaders,
          resetInfo,
          responseData: endpoint.method === "GET" ? responseData : null,
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
      id: account.id,
      username: account.username,
      userId: account.userId,
      hasAccessToken: !!accessToken,
      useOwnCredentials: account.useOwnCredentials,
      credentialsVerified: account.credentialsVerified,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    logAction("rate_limits_check", {
      accountId: account.id,
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
