// app/api/auth/x/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { logError } from "@/lib/log-action";
import TokenInfo from "@/models/TokenInfo";
import { decryptCredentials } from "@/lib/crypto-nextjs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const oauth_token = searchParams.get("oauth_token");
    const oauth_verifier = searchParams.get("oauth_verifier");
    const denied = searchParams.get("denied");

    if (denied) {
      return NextResponse.redirect(
        new URL("/accounts?error=oauth_denied", req.url)
      );
    }

    if (!oauth_token || !oauth_verifier) {
      return NextResponse.redirect(
        new URL("/accounts?error=oauth_invalid", req.url)
      );
    }

    await connectDB();

    // Buscar la cuenta que inició el proceso OAuth
    const account = await XAccount.findOne({
      tempOAuthTokenSecret: { $exists: true },
    });

    if (!account || !account.tempOAuthTokenSecret) {
      return NextResponse.redirect(
        new URL("/accounts?error=oauth_session_lost", req.url)
      );
    }

    // Usar credenciales directamente
    const credentials = {
      apiKey: account.ownApiKey,
      apiSecret: account.ownApiSecret,
    };

    if (!credentials.apiKey || !credentials.apiSecret) {
      return NextResponse.redirect(
        new URL("/accounts?error=oauth_credentials_missing", req.url)
      );
    }

    // Generar parámetros OAuth para access token
    const oauth_nonce = require("crypto").randomBytes(16).toString("hex");
    const oauth_timestamp = Math.floor(Date.now() / 1000).toString();

    const baseParams = {
      oauth_consumer_key: credentials.apiKey,
      oauth_nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp,
      oauth_token,
      oauth_verifier,
      oauth_version: "1.0",
    };

    // Crear signature
    const paramString = Object.keys(baseParams)
      .sort()
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(baseParams[key])}`
      )
      .join("&");

    const signatureBaseString = [
      "POST",
      encodeURIComponent("https://api.twitter.com/oauth/access_token"),
      encodeURIComponent(paramString),
    ].join("&");

    const signingKey = `${encodeURIComponent(
      credentials.apiSecret
    )}&${encodeURIComponent(account.tempOAuthTokenSecret)}`;

    const oauth_signature = require("crypto")
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

    // Solicitar access token
    const response = await fetch("https://api.twitter.com/oauth/access_token", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error obteniendo access token:", errorText);
      return NextResponse.redirect(
        new URL("/accounts?error=oauth_access_token_failed", req.url)
      );
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const access_token = params.get("oauth_token");
    const access_token_secret = params.get("oauth_token_secret");
    const user_id = params.get("user_id");
    const screen_name = params.get("screen_name");

    if (!access_token || !access_token_secret) {
      return NextResponse.redirect(
        new URL("/accounts?error=oauth_invalid_response", req.url)
      );
    }

    // Actualizar la cuenta con los tokens obtenidos
    await XAccount.findByIdAndUpdate(account._id, {
      $set: {
        ownAccessToken: access_token,
        ownAccessTokenSecret: access_token_secret,
        userId: user_id,
        username: screen_name,
        credentialsVerified: true,
      },
      $unset: {
        tempOAuthTokenSecret: 1,
      },
    });

    return NextResponse.redirect(
      new URL("/accounts?success=oauth_completed", req.url)
    );
  } catch (error) {
    console.error("Error en OAuth callback:", error);
    return NextResponse.redirect(
      new URL("/accounts?error=oauth_server_error", req.url)
    );
  }
}
