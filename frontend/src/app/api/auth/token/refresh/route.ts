import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logError } from "@/lib/log-action";

/**
 * Endpoint para refrescar tokens de autenticación
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar si la solicitud tiene el formato correcto
    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Se requiere ID de cuenta" },
        { status: 400 }
      );
    }

    // Buscar la cuenta usando Prisma
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
      include: { tokenInfo: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Verificar si la cuenta tiene refresh token
    if (!account.ownOAuth2RefreshToken) {
      return NextResponse.json(
        { error: "No hay refresh token disponible para esta cuenta" },
        { status: 400 }
      );
    }

    // Intentar refrescar el token usando OAuth 2.0
    const refreshResponse = await fetch(
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${account.ownClientId}:${account.ownClientSecret}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: account.ownOAuth2RefreshToken,
        }),
      }
    );

    if (!refreshResponse.ok) {
      const error = await refreshResponse.json();
      logError("token_refresh_failed", error);
      return NextResponse.json(
        { error: "Error al refrescar token: " + error.error_description },
        { status: 400 }
      );
    }

    const tokenData = await refreshResponse.json();

    // Actualizar tokens en la cuenta
    await prisma.xAccount.update({
      where: { id: accountId },
      data: {
        ownOAuth2AccessToken: tokenData.access_token,
        ownOAuth2RefreshToken:
          tokenData.refresh_token || account.ownOAuth2RefreshToken,
        oauth2TokenExpiresAt: new Date(
          Date.now() + tokenData.expires_in * 1000
        ),
      },
    });

    // Actualizar información del token
    await prisma.tokenInfo.upsert({
      where: { accountId },
      update: {
        isValid: true,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        lastRefresh: new Date(),
      },
      create: {
        accountId,
        isValid: true,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        lastRefresh: new Date(),
      },
    });

    return NextResponse.json({
      message: "Token refrescado exitosamente",
      expiresIn: tokenData.expires_in,
    });
  } catch (error: any) {
    console.error("Error al procesar solicitud de refresh:", error);
    logError("api_refresh_token", error);

    return NextResponse.json(
      {
        error:
          "Error al refrescar token: " + (error.message || "Error desconocido"),
      },
      { status: 500 }
    );
  }
}
