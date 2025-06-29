import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId es requerido" },
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

    // Verificar si la cuenta tiene credenciales propias
    if (
      !account.useOwnCredentials ||
      !account.ownApiKey ||
      !account.ownApiSecret
    ) {
      return NextResponse.json(
        { error: "Esta cuenta no tiene credenciales OAuth configuradas" },
        { status: 400 }
      );
    }

    // Usar credenciales directamente
    const credentials = {
      apiKey: account.ownApiKey,
      apiSecret: account.ownApiSecret,
    };

    // Generar parámetros OAuth
    const oauth_nonce = randomBytes(16).toString("hex");
    const oauth_timestamp = Math.floor(Date.now() / 1000).toString();
    const oauth_callback = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`;

    // Crear parámetros base para la signature
    const baseParams = {
      oauth_callback,
      oauth_consumer_key: credentials.apiKey,
      oauth_nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp,
      oauth_version: "1.0",
    };

    // Crear signature base string
    const paramString = Object.keys(baseParams)
      .sort()
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(baseParams[key])}`
      )
      .join("&");

    const signatureBaseString = [
      "POST",
      encodeURIComponent("https://api.twitter.com/oauth/request_token"),
      encodeURIComponent(paramString),
    ].join("&");

    // Crear signing key
    const signingKey = `${encodeURIComponent(credentials.apiSecret)}&`;

    // Generar signature
    const crypto = require("crypto");
    const oauth_signature = crypto
      .createHmac("sha1", signingKey)
      .update(signatureBaseString)
      .digest("base64");

    // Crear Authorization header
    const authParams = {
      ...baseParams,
      oauth_signature,
    };

    const authHeader =
      "OAuth " +
      Object.keys(authParams)
        .map(
          (key) =>
            `${encodeURIComponent(key)}="${encodeURIComponent(
              authParams[key]
            )}"`
        )
        .join(", ");

    // Solicitar request token
    const response = await fetch(
      "https://api.twitter.com/oauth/request_token",
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Error obteniendo request token", details: errorText },
        { status: response.status }
      );
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const oauth_token = params.get("oauth_token");
    const oauth_token_secret = params.get("oauth_token_secret");

    if (!oauth_token || !oauth_token_secret) {
      return NextResponse.json(
        { error: "Request token inválido" },
        { status: 400 }
      );
    }

    // Guardar el token secret temporalmente usando Prisma
    await prisma.xAccount.update({
      where: { id: accountId },
      data: {
        tempOAuthTokenSecret: oauth_token_secret,
      },
    });

    // Crear URL de autorización
    const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauth_token}&oauth_callback=${encodeURIComponent(
      oauth_callback
    )}`;

    return NextResponse.json({
      authUrl,
      oauth_token,
    });
  } catch (error) {
    console.error("Error en OAuth login:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
