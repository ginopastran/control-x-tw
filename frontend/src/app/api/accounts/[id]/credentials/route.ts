import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logError, logAction } from "@/lib/log-action";

// GET - Obtener credenciales existentes (para mostrar en formulario)
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

    // Verificar si la cuenta usa credenciales propias
    if (!account.useOwnCredentials) {
      return NextResponse.json({
        useOwnCredentials: false,
        hasCredentials: false,
        credentialsVerified: false,
        fields: {
          apiKey: false,
          apiSecret: false,
          bearerToken: false,
          accessToken: false,
          accessTokenSecret: false,
        },
      });
    }

    // Verificar qué credenciales están disponibles
    const fields = {
      apiKey: !!account.ownApiKey,
      apiSecret: !!account.ownApiSecret,
      bearerToken: !!account.ownBearerToken,
      accessToken: !!account.ownAccessToken,
      accessTokenSecret: !!account.ownAccessTokenSecret,
    };

    const hasCredentials = Object.values(fields).some(Boolean);

    return NextResponse.json({
      useOwnCredentials: account.useOwnCredentials,
      hasCredentials,
      credentialsVerified: account.credentialsVerified || false,
      userAppName: account.userAppName || "",
      fields,
    });
  } catch (error) {
    console.error("Error obteniendo credenciales:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar credenciales propias
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;
    const body = await req.json();

    const {
      apiKey,
      apiSecret,
      bearerToken,
      accessToken,
      accessTokenSecret,
      clientId,
      clientSecret,
      oauth2AccessToken,
      oauth2RefreshToken,
      scopes,
      appName,
      developerEmail,
      preferOAuth2,
    } = body;

    // Validaciones mínimas
    const hasOAuth1Credentials =
      apiKey || apiSecret || bearerToken || accessToken || accessTokenSecret;
    const hasOAuth2Credentials =
      clientId || clientSecret || oauth2AccessToken || oauth2RefreshToken;

    if (!hasOAuth1Credentials && !hasOAuth2Credentials) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos algunas credenciales" },
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

    // Verificación opcional de credenciales
    let verificationResult = { success: true };
    let warningMessage = "";

    const canVerifyOAuth2 = (clientId && clientSecret) || oauth2AccessToken;
    const canVerifyOAuth1 =
      bearerToken ||
      (apiKey && apiSecret) ||
      (accessToken && accessTokenSecret);

    if (canVerifyOAuth2 || canVerifyOAuth1) {
      try {
        verificationResult = await verifyTwitterCredentials({
          apiKey,
          apiSecret,
          bearerToken,
          accessToken,
          accessTokenSecret,
          clientId,
          clientSecret,
          oauth2AccessToken,
          preferOAuth2: preferOAuth2 || false,
        });

        if (!verificationResult.success) {
          warningMessage = `⚠️ Credenciales guardadas pero no pudieron ser verificadas. Las credenciales se guardaron de todos modos.`;
        }
      } catch (error: any) {
        warningMessage = `⚠️ Error en verificación: ${error.message}. Las credenciales se guardaron de todos modos.`;
      }
    } else {
      warningMessage =
        "⚠️ Credenciales guardadas. Se recomienda completar todas las credenciales necesarias para verificación.";
    }

    // Actualizar cuenta
    const updateData: any = {
      useOwnCredentials: true,
      credentialsVerified: true,
      appCreatedAt: new Date(),
    };

    if (apiKey) updateData.ownApiKey = apiKey;
    if (apiSecret) updateData.ownApiSecret = apiSecret;
    if (bearerToken) updateData.ownBearerToken = bearerToken;
    if (accessToken) updateData.ownAccessToken = accessToken;
    if (accessTokenSecret) updateData.ownAccessTokenSecret = accessTokenSecret;
    if (clientId) updateData.ownClientId = clientId;
    if (clientSecret) updateData.ownClientSecret = clientSecret;
    if (oauth2AccessToken) updateData.ownOAuth2AccessToken = oauth2AccessToken;
    if (oauth2RefreshToken)
      updateData.ownOAuth2RefreshToken = oauth2RefreshToken;
    if (appName) updateData.userAppName = appName;
    if (developerEmail) updateData.userDeveloperEmail = developerEmail;
    if (typeof preferOAuth2 === "boolean")
      updateData.preferOAuth2 = preferOAuth2;

    // Si es OAuth 2.0 y tenemos access token, calcular expiración
    if (preferOAuth2 && oauth2AccessToken) {
      updateData.oauth2TokenExpiresAt = new Date(Date.now() + 7200 * 1000);
    }

    await prisma.xAccount.update({
      where: { id: accountId },
      data: updateData,
    });

    const authType = preferOAuth2 ? "OAuth 2.0" : "OAuth 1.0a";
    logAction("update_credentials_success", {
      accountId: account.id,
      username: account.username,
      authType,
      appName,
      developerEmail,
      scopes: scopes || [],
    });

    return NextResponse.json({
      success: true,
      message: warningMessage || "Credenciales actualizadas exitosamente",
      warning: warningMessage ? true : false,
      credentials: {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        hasBearerToken: !!bearerToken,
        hasAccessToken: !!accessToken,
        hasAccessTokenSecret: !!accessTokenSecret,
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasOAuth2AccessToken: !!oauth2AccessToken,
        hasAppName: !!appName,
        hasDeveloperEmail: !!developerEmail,
      },
    });
  } catch (error: any) {
    logError("register_own_credentials_failed", error);
    return NextResponse.json(
      { error: error.message || "Error al registrar credenciales" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar credenciales propias
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;

    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Limpiar credenciales propias
    await prisma.xAccount.update({
      where: { id: accountId },
      data: {
        ownApiKey: null,
        ownApiSecret: null,
        ownBearerToken: null,
        ownAccessToken: null,
        ownAccessTokenSecret: null,
        ownClientId: null,
        ownClientSecret: null,
        ownOAuth2AccessToken: null,
        ownOAuth2RefreshToken: null,
        oauth2TokenExpiresAt: null,
        userAppName: null,
        userDeveloperEmail: null,
        appCreatedAt: null,
        useOwnCredentials: false,
        credentialsVerified: false,
        preferOAuth2: false,
      },
    });

    logAction("own_credentials_removed", {
      accountId: account.id,
      username: account.username,
    });

    return NextResponse.json({
      message:
        "Credenciales propias eliminadas. Usando credenciales compartidas.",
    });
  } catch (error: any) {
    logError("remove_own_credentials_failed", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar credenciales" },
      { status: 500 }
    );
  }
}

// Función para verificar credenciales con Twitter API
async function verifyTwitterCredentials(
  credentials: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (credentials.preferOAuth2 && credentials.oauth2AccessToken) {
      const response = await fetch("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${credentials.oauth2AccessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorText = await response.text();
        return { success: false, error: errorText };
      }
    }

    if (credentials.bearerToken) {
      const response = await fetch("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${credentials.bearerToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorText = await response.text();
        return { success: false, error: errorText };
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
