import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logError, logAction } from "@/lib/log-action";

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await req.json();

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

    // Verificar que tenga credenciales OAuth 2.0
    if (!account.ownClientId || !account.ownClientSecret) {
      return NextResponse.json(
        { error: "Credenciales OAuth 2.0 no configuradas" },
        { status: 400 }
      );
    }

    // Intentar refrescar el token
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
      logError("refresh_token_failed", error, { accountId });

      // Marcar token como inválido
      await prisma.tokenInfo.upsert({
        where: { accountId },
        update: { isValid: false },
        create: {
          accountId,
          isValid: false,
          expiresAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          error:
            "Error al refrescar token: " +
            (error.error_description || error.error),
          needsReauth: true,
        },
        { status: 400 }
      );
    }

    const tokenData = await refreshResponse.json();

    // Actualizar tokens en la cuenta
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await prisma.xAccount.update({
      where: { id: accountId },
      data: {
        ownOAuth2AccessToken: tokenData.access_token,
        ownOAuth2RefreshToken:
          tokenData.refresh_token || account.ownOAuth2RefreshToken,
        oauth2TokenExpiresAt: expiresAt,
      },
    });

    // Actualizar información del token
    await prisma.tokenInfo.upsert({
      where: { accountId },
      update: {
        isValid: true,
        expiresAt: expiresAt,
        lastRefresh: new Date(),
      },
      create: {
        accountId,
        isValid: true,
        expiresAt: expiresAt,
        lastRefresh: new Date(),
      },
    });

    logAction("refresh_token_success", {
      accountId,
      username: account.username,
      expiresIn: tokenData.expires_in,
    });

    return NextResponse.json({
      success: true,
      message: "Token refrescado exitosamente",
      expiresIn: tokenData.expires_in,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Error al refrescar token:", error);
    logError("refresh_auth_error", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor: " + error.message,
      },
      { status: 500 }
    );
  }
}
