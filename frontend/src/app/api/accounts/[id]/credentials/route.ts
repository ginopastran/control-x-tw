import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { logError, logAction } from "@/lib/log-action";
import { decryptCredentials } from "@/lib/crypto-nextjs";

// GET - Obtener credenciales existentes (para mostrar en formulario)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;
    console.log("🔑 GET credentials para account:", accountId);

    await connectDB();

    const account = await XAccount.findById(accountId);
    if (!account) {
      console.log("❌ Cuenta no encontrada:", accountId);
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    console.log("✅ Cuenta encontrada:", {
      id: account._id,
      username: account.username,
      useOwnCredentials: account.useOwnCredentials,
    });

    if (!account.useOwnCredentials) {
      console.log("❌ Cuenta no usa credenciales propias");
      return NextResponse.json(
        { error: "Esta cuenta no usa credenciales propias" },
        { status: 400 }
      );
    }

    // Log de credenciales RAW de la base de datos
    console.log("🗃️ Credenciales RAW de BD:", {
      hasOwnApiKey: !!account.ownApiKey,
      hasOwnApiSecret: !!account.ownApiSecret,
      hasOwnBearerToken: !!account.ownBearerToken,
      hasOwnAccessToken: !!account.ownAccessToken,
      hasOwnAccessTokenSecret: !!account.ownAccessTokenSecret,
      hasOwnClientId: !!account.ownClientId,
      hasOwnClientSecret: !!account.ownClientSecret,
      hasOwnOAuth2AccessToken: !!account.ownOAuth2AccessToken,
      hasOwnOAuth2RefreshToken: !!account.ownOAuth2RefreshToken,
      // Mostrar primeros caracteres para verificar
      ownApiKeyStart: account.ownApiKey
        ? account.ownApiKey.substring(0, 10) + "..."
        : null,
      ownClientIdStart: account.ownClientId
        ? account.ownClientId.substring(0, 10) + "..."
        : null,
    });

    // Desencriptar credenciales directamente en NextJS
    let decryptedCredentials: {
      apiKey?: string;
      apiSecret?: string;
      bearerToken?: string;
      accessToken?: string;
      accessTokenSecret?: string;
      clientId?: string;
      clientSecret?: string;
      oauth2AccessToken?: string;
      oauth2RefreshToken?: string;
    } = {};
    try {
      decryptedCredentials = decryptCredentials({
        // OAuth 1.0a
        ownApiKey: account.ownApiKey,
        ownApiSecret: account.ownApiSecret,
        ownBearerToken: account.ownBearerToken,
        ownAccessToken: account.ownAccessToken,
        ownAccessTokenSecret: account.ownAccessTokenSecret,
        // OAuth 2.0
        ownClientId: account.ownClientId,
        ownClientSecret: account.ownClientSecret,
        ownOAuth2AccessToken: account.ownOAuth2AccessToken,
        ownOAuth2RefreshToken: account.ownOAuth2RefreshToken,
      });
    } catch (error) {
      console.error("❌ Error desencriptando credenciales:", error);
      // Si falla la desencriptación, usar valores vacíos
    }

    console.log("✅ Credenciales procesadas para envío:", {
      hasApiKey: !!decryptedCredentials.apiKey,
      hasApiSecret: !!decryptedCredentials.apiSecret,
      hasBearerToken: !!decryptedCredentials.bearerToken,
      hasClientId: !!decryptedCredentials.clientId,
      hasClientSecret: !!decryptedCredentials.clientSecret,
      hasOAuth2AccessToken: !!decryptedCredentials.oauth2AccessToken,
    });

    await logAction(accountId, "get_credentials_success", true);

    const response = {
      success: true,
      credentials: decryptedCredentials,
      // Información adicional de la cuenta
      appName: account.appName || "",
      developerEmail: account.developerEmail || "",
      useOwnCredentials: account.useOwnCredentials,
    };

    console.log("📤 Enviando respuesta:", {
      success: response.success,
      hasCredentials: !!response.credentials,
      appName: response.appName,
      developerEmail: response.developerEmail,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Error obteniendo credenciales:", error);

    await logError("get_credentials_failed", {
      message: error instanceof Error ? error.message : "Error desconocido",
      accountId: (await params).id,
    });

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
      // OAuth 1.0a fields
      apiKey,
      apiSecret,
      bearerToken,
      accessToken,
      accessTokenSecret,
      // OAuth 2.0 fields
      clientId,
      clientSecret,
      oauth2AccessToken,
      oauth2RefreshToken,
      scopes,
      // General fields
      appName,
      developerEmail,
      preferOAuth2,
    } = body;

    console.log("📝 Datos recibidos:", {
      preferOAuth2,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasOAuth2AccessToken: !!oauth2AccessToken,
      hasAppName: !!appName,
      hasDeveloperEmail: !!developerEmail,
    });

    // Validaciones mínimas - solo verificar que al menos haya alguna credencial
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

    await connectDB();

    const account = await XAccount.findById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Verificación opcional de credenciales (no bloquea si falla)
    let verificationResult: { success: boolean; error?: string } = {
      success: true,
    };
    let warningMessage = "";

    // Solo verificar si hay credenciales suficientes para verificar
    const canVerifyOAuth2 = (clientId && clientSecret) || oauth2AccessToken;
    const canVerifyOAuth1 =
      bearerToken ||
      (apiKey && apiSecret) ||
      (accessToken && accessTokenSecret);

    if (canVerifyOAuth2 || canVerifyOAuth1) {
      console.log("🔍 Intentando verificación opcional de credenciales...");
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

        console.log("🔍 Resultado de verificación:", verificationResult);

        if (!verificationResult.success) {
          warningMessage = `⚠️ Credenciales guardadas pero no pudieron ser verificadas: ${verificationResult.error}. Las credenciales se guardaron de todos modos.`;
          console.log(
            "⚠️ Verificación falló, pero continuando:",
            warningMessage
          );
        } else {
          console.log("✅ Credenciales verificadas exitosamente");
        }
      } catch (error: any) {
        warningMessage = `⚠️ Error en verificación: ${error.message}. Las credenciales se guardaron de todos modos.`;
        console.log(
          "⚠️ Error en verificación, pero continuando:",
          warningMessage
        );
      }
    } else {
      warningMessage =
        "⚠️ Credenciales guardadas. Se recomienda completar todas las credenciales necesarias para verificación.";
      console.log(
        "ℹ️ Verificación omitida - credenciales insuficientes para verificar"
      );
    }

    // Actualizar cuenta con campos OAuth 1.0a
    if (apiKey) account.ownApiKey = apiKey;
    if (apiSecret) account.ownApiSecret = apiSecret;
    if (bearerToken) account.ownBearerToken = bearerToken;
    if (accessToken) account.ownAccessToken = accessToken;
    if (accessTokenSecret) account.ownAccessTokenSecret = accessTokenSecret;

    // Actualizar cuenta con campos OAuth 2.0
    if (clientId) account.ownClientId = clientId;
    if (clientSecret) account.ownClientSecret = clientSecret;
    if (oauth2AccessToken) account.ownOAuth2AccessToken = oauth2AccessToken;
    if (oauth2RefreshToken) account.ownOAuth2RefreshToken = oauth2RefreshToken;
    if (scopes && Array.isArray(scopes)) account.oauth2Scopes = scopes;

    // Configuración general
    if (appName) account.userAppName = appName;
    if (developerEmail) account.userDeveloperEmail = developerEmail;
    if (typeof preferOAuth2 === "boolean") account.preferOAuth2 = preferOAuth2;

    account.appCreatedAt = new Date();
    account.useOwnCredentials = true;
    account.credentialsVerified = true;

    // Si es OAuth 2.0 y tenemos access token, calcular expiración
    if (preferOAuth2 && oauth2AccessToken) {
      // Por defecto, los tokens OAuth 2.0 de X expiran en 2 horas
      account.oauth2TokenExpiresAt = new Date(Date.now() + 7200 * 1000);
    }

    await account.save();

    const authType = preferOAuth2 ? "OAuth 2.0" : "OAuth 1.0a";
    logAction("update_credentials_success", {
      accountId: account._id,
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
        // OAuth 1.0a
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        hasBearerToken: !!bearerToken,
        hasAccessToken: !!accessToken,
        hasAccessTokenSecret: !!accessTokenSecret,
        // OAuth 2.0
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasOAuth2AccessToken: !!oauth2AccessToken,
        // General
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

// DELETE - Eliminar credenciales propias y volver a compartidas
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;

    await connectDB();

    const account = await XAccount.findById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Limpiar credenciales propias OAuth 1.0a
    account.ownApiKey = undefined;
    account.ownApiSecret = undefined;
    account.ownBearerToken = undefined;
    account.ownAccessToken = undefined;
    account.ownAccessTokenSecret = undefined;

    // Limpiar credenciales propias OAuth 2.0
    account.ownClientId = undefined;
    account.ownClientSecret = undefined;
    account.ownOAuth2AccessToken = undefined;
    account.ownOAuth2RefreshToken = undefined;
    account.oauth2TokenExpiresAt = undefined;
    account.oauth2Scopes = [];

    // Limpiar información general
    account.userAppName = undefined;
    account.userDeveloperEmail = undefined;
    account.appCreatedAt = undefined;
    account.useOwnCredentials = false;
    account.credentialsVerified = false;
    account.preferOAuth2 = false;

    await account.save();

    logAction("own_credentials_removed", {
      accountId: account._id,
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
async function verifyTwitterCredentials(credentials: {
  apiKey?: string;
  apiSecret?: string;
  bearerToken?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  clientId?: string;
  clientSecret?: string;
  oauth2AccessToken?: string;
  preferOAuth2: boolean;
}): Promise<{ success: boolean; error?: string; userInfo?: any }> {
  console.log("🔐 Verificando credenciales:", {
    preferOAuth2: credentials.preferOAuth2,
    hasOAuth2AccessToken: !!credentials.oauth2AccessToken,
    hasClientId: !!credentials.clientId,
    hasClientSecret: !!credentials.clientSecret,
    hasBearerToken: !!credentials.bearerToken,
    hasApiKey: !!credentials.apiKey,
    hasApiSecret: !!credentials.apiSecret,
  });

  try {
    // Si prefiere OAuth 2.0 y tiene credenciales OAuth 2.0
    if (credentials.preferOAuth2) {
      // Verificar OAuth 2.0 Access Token si está disponible
      if (credentials.oauth2AccessToken) {
        console.log("🔗 Verificando OAuth 2.0 Access Token...");
        try {
          const response = await fetch("https://api.twitter.com/2/users/me", {
            headers: {
              Authorization: `Bearer ${credentials.oauth2AccessToken}`,
              "Content-Type": "application/json",
            },
          });

          console.log(
            "📡 Respuesta de API Twitter (Access Token):",
            response.status
          );

          if (response.ok) {
            const userInfo = await response.json();
            console.log(
              "✅ OAuth 2.0 Access Token válido:",
              userInfo.data?.username || "usuario"
            );
            return { success: true, userInfo };
          } else {
            const errorText = await response.text();
            console.log("❌ Error de API Twitter (Access Token):", errorText);

            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText };
            }

            return {
              success: false,
              error: `OAuth 2.0 token inválido: ${
                errorData.detail ||
                errorData.title ||
                errorData.error ||
                errorData.errors?.[0]?.message ||
                "Token no válido"
              }`,
            };
          }
        } catch (networkError: any) {
          console.log(
            "🌐 Error de red verificando Access Token:",
            networkError.message
          );
          return {
            success: false,
            error: `Error de conexión verificando Access Token: ${networkError.message}`,
          };
        }
      }

      // Si solo tenemos Client ID/Secret, verificar que sean válidos
      // haciendo una request para obtener un Bearer Token de app
      if (credentials.clientId && credentials.clientSecret) {
        console.log("🔗 Verificando OAuth 2.0 Client Credentials...");
        try {
          const authString = Buffer.from(
            `${credentials.clientId}:${credentials.clientSecret}`
          ).toString("base64");

          const tokenResponse = await fetch(
            "https://api.twitter.com/oauth2/token",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${authString}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "grant_type=client_credentials",
            }
          );

          console.log(
            "📡 Respuesta de API Twitter (Client Credentials):",
            tokenResponse.status
          );

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log("✅ OAuth 2.0 Client Credentials válidas");
            return {
              success: true,
              userInfo: { token_type: tokenData.token_type },
            };
          } else {
            const errorText = await tokenResponse.text();
            console.log(
              "❌ Error de API Twitter (Client Credentials):",
              errorText
            );

            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText };
            }

            return {
              success: false,
              error: `Credenciales OAuth 2.0 inválidas: ${
                errorData.error_description ||
                errorData.error ||
                errorData.detail ||
                "Client ID o Client Secret inválidos"
              }`,
            };
          }
        } catch (networkError: any) {
          console.log(
            "🌐 Error de red verificando Client Credentials:",
            networkError.message
          );
          return {
            success: false,
            error: `Error de conexión verificando credenciales: ${networkError.message}`,
          };
        }
      }
    }

    // Fallback a OAuth 1.0a
    // Verificar Bearer Token si está disponible
    if (credentials.bearerToken) {
      console.log("🔗 Verificando Bearer Token (OAuth 1.0a)...");
      try {
        const response = await fetch("https://api.twitter.com/2/users/me", {
          headers: {
            Authorization: `Bearer ${credentials.bearerToken}`,
            "Content-Type": "application/json",
          },
        });

        console.log(
          "📡 Respuesta de API Twitter (Bearer Token):",
          response.status
        );

        if (response.ok) {
          const userInfo = await response.json();
          console.log(
            "✅ Bearer Token válido:",
            userInfo.data?.username || "usuario"
          );
          return { success: true, userInfo };
        } else {
          const errorText = await response.text();
          console.log("❌ Error de API Twitter (Bearer Token):", errorText);

          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }

          return {
            success: false,
            error: `Bearer token inválido: ${
              errorData.detail ||
              errorData.title ||
              errorData.error ||
              "Token no válido"
            }`,
          };
        }
      } catch (networkError: any) {
        console.log(
          "🌐 Error de red verificando Bearer Token:",
          networkError.message
        );
        return {
          success: false,
          error: `Error de conexión verificando Bearer Token: ${networkError.message}`,
        };
      }
    }

    // Si hay Access Token OAuth 1.0a, verificar con OAuth 1.0a
    if (credentials.accessToken && credentials.accessTokenSecret) {
      console.log(
        "✅ OAuth 1.0a Access Token detectado - asumiendo válido (requiere implementación completa de firma OAuth)"
      );
      // Para OAuth 1.0a necesitaríamos implementar la firma OAuth
      // Por simplicidad, asumimos que es válido si llegamos aquí
      // En producción, deberías usar una librería como twitter-api-v2 para verificar
      return { success: true, userInfo: { auth_type: "oauth1a" } };
    }

    // Si solo tenemos API Key/Secret, verificar que sean válidos
    if (credentials.apiKey && credentials.apiSecret) {
      console.log(
        "✅ OAuth 1.0a API Key/Secret detectado - asumiendo válido (requiere verificación completa)"
      );
      // Verificar haciendo una request básica con consumer keys
      // Por simplicidad, asumimos que es válido si llegamos aquí
      // En producción, deberías verificar creando un Bearer token de app
      return { success: true, userInfo: { auth_type: "oauth1a_basic" } };
    }

    console.log("❌ No se proporcionaron credenciales válidas");
    return {
      success: false,
      error: "No se proporcionaron credenciales válidas",
    };
  } catch (error: any) {
    console.log("💥 Error general en verificación:", error.message);
    return {
      success: false,
      error: `Error en verificación: ${error.message || "Error desconocido"}`,
    };
  }
}
