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
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Obtener estado, verificador y accountId guardados en cookies
    const savedState = req.cookies.get("oauth_state")?.value;
    const codeVerifier = req.cookies.get("code_verifier")?.value;
    const accountId = req.cookies.get("oauth_account_id")?.value;

    console.log("🍪 Cookies recibidas:", {
      hasSavedState: !!savedState,
      hasCodeVerifier: !!codeVerifier,
      hasAccountId: !!accountId,
    });

    // Configuración de cookies para eliminarlas
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      domain: process.env.COOKIE_DOMAIN || undefined,
    };

    // Función para crear respuesta con cookies limpias
    const createResponse = (url: string) => {
      const response = NextResponse.redirect(url);
      response.cookies.delete("oauth_state");
      response.cookies.delete("code_verifier");
      response.cookies.delete("oauth_account_id");
      return response;
    };

    // Verificar si hay error en la respuesta de X
    if (error) {
      console.error(
        `Error de autenticación de X: ${error} - ${errorDescription}`
      );
      return createResponse(
        new URL(
          `/error?message=${encodeURIComponent(
            `Error de X: ${errorDescription || error}`
          )}`,
          req.url
        ).toString()
      );
    }

    // Verificar parámetros obligatorios
    if (!code) {
      return createResponse(
        new URL(
          "/error?message=No+se+recibió+el+código+de+autorización",
          req.url
        ).toString()
      );
    }

    if (!accountId) {
      return createResponse(
        new URL(
          "/error?message=AccountId+no+encontrado+en+cookies",
          req.url
        ).toString()
      );
    }

    // Verificar el estado CSRF
    if (!state || !savedState) {
      console.error("Error de estado CSRF:", {
        receivedState: state,
        hasSavedState: !!savedState,
      });
      return createResponse(
        new URL(
          "/error?message=Error+de+autenticación:+Estado+no+encontrado",
          req.url
        ).toString()
      );
    }

    if (state !== savedState) {
      console.error("Error de coincidencia de estado CSRF:", {
        receivedState: state,
        savedState: savedState,
      });
      return createResponse(
        new URL(
          "/error?message=Error+de+autenticación:+Estado+inválido",
          req.url
        ).toString()
      );
    }

    if (!codeVerifier) {
      return createResponse(
        new URL(
          "/error?message=Error+de+autenticación:+Verificador+no+encontrado",
          req.url
        ).toString()
      );
    }

    // Conectar a la base de datos y obtener credenciales del usuario
    await connectDB();
    const account = await XAccount.findById(accountId);

    if (!account) {
      return createResponse(
        new URL("/error?message=Cuenta+no+encontrada", req.url).toString()
      );
    }

    if (!account.useOwnCredentials) {
      return createResponse(
        new URL(
          "/error?message=Cuenta+no+configurada+para+usar+credenciales+propias",
          req.url
        ).toString()
      );
    }

    // Desencriptar credenciales específicas del usuario
    let credentials;
    try {
      credentials = decryptCredentials({
        ownClientId: account.ownClientId,
        ownClientSecret: account.ownClientSecret,
      });
    } catch (error) {
      console.error("Error desencriptando credenciales:", error);
      return createResponse(
        new URL(
          "/error?message=Error+desencriptando+credenciales",
          req.url
        ).toString()
      );
    }

    if (!credentials.clientId || !credentials.clientSecret) {
      return createResponse(
        new URL(
          "/error?message=Credenciales+OAuth+2.0+no+encontradas",
          req.url
        ).toString()
      );
    }

    const CLIENT_ID = credentials.clientId;
    const CLIENT_SECRET = credentials.clientSecret;
    const REDIRECT_URI = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/auth/x/callback`
      : "http://localhost:3000/api/auth/x/callback";

    console.log("🔑 Usando credenciales del usuario:", {
      accountId,
      hasClientId: !!CLIENT_ID,
      hasClientSecret: !!CLIENT_SECRET,
      clientIdStart: CLIENT_ID ? CLIENT_ID.substring(0, 10) + "..." : null,
    });

    console.log(
      "Código de autorización recibido, intercambiando por tokens..."
    );

    // Preparar la solicitud para intercambiar el código por tokens
    const tokenRequest = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    });

    // Usar Authorization Basic para mayor seguridad
    const authHeader = `Basic ${Buffer.from(
      `${CLIENT_ID}:${CLIENT_SECRET}`
    ).toString("base64")}`;

    // Intercambiar el code por tokens
    const tokenResponse = await fetch(
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: tokenRequest,
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Error al obtener token:", tokenData);
      return createResponse(
        new URL(
          `/error?message=${encodeURIComponent(
            `Error al obtener token: ${
              tokenData.error_description || tokenData.error
            }`
          )}`,
          req.url
        ).toString()
      );
    }

    // Verificar que recibimos los tokens necesarios
    if (!tokenData.access_token) {
      console.error("Access token no recibido:", tokenData);
      return createResponse(
        new URL(
          "/error?message=No+se+recibió+el+token+de+acceso",
          req.url
        ).toString()
      );
    }

    console.log("✅ Tokens obtenidos exitosamente para la cuenta:", {
      accountId,
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
    });

    // Obtener información del usuario de X
    const userResponse = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Error al obtener información del usuario:", userData);
      return createResponse(
        new URL(
          "/error?message=Error+al+obtener+información+del+usuario",
          req.url
        ).toString()
      );
    }

    console.log("👤 Información del usuario obtenida:", {
      username: userData.data?.username,
      id: userData.data?.id,
      name: userData.data?.name,
    });

    // Ya tenemos la cuenta de la base de datos, solo necesitamos actualizarla
    // con los nuevos tokens y información de usuario
    account.username = userData.data.username;
    account.userId = userData.data.id;
    account.accessToken = tokenData.access_token;

    if (tokenData.refresh_token) {
      account.refreshToken = tokenData.refresh_token;
    }

    // Guardar el OAuth 2.0 access token en el campo específico también
    account.ownOAuth2AccessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      account.ownOAuth2RefreshToken = tokenData.refresh_token;
    }

    // Configurar expiración del token (2 horas por defecto para OAuth 2.0 de X)
    account.oauth2TokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    if (!account.labels || account.labels.length === 0) {
      account.labels = ["default"];
    }

    account.developerTag = account.developerTag || "api_v2";
    account.preferOAuth2 = true; // Marcar que prefiere OAuth 2.0 ya que lo acaba de usar

    await account.save();

    console.log("💾 Cuenta actualizada exitosamente:", {
      accountId: account._id,
      username: account.username,
      userId: account.userId,
      preferOAuth2: account.preferOAuth2,
    });

    // Crear o actualizar información del token
    await TokenInfo.findOneAndUpdate(
      { accountId: account._id },
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || account.refreshToken,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas
        lastRefresh: new Date(),
        isValid: true,
      },
      { upsert: true }
    );

    console.log("🎉 Proceso de reconexión OAuth 2.0 completado exitosamente");

    return createResponse(
      new URL(
        `/accounts/${account._id}?success=Cuenta+reconectada+con+OAuth+2.0`,
        req.url
      ).toString()
    );
  } catch (error: any) {
    console.error("💥 Error en el proceso de autenticación:", error);

    const response = NextResponse.redirect(
      new URL(
        `/error?message=${encodeURIComponent(
          `Error: ${error.message || "Error desconocido"}`
        )}`,
        req.url
      )
    );

    // Limpiar cookies en caso de error también
    response.cookies.delete("oauth_state");
    response.cookies.delete("code_verifier");
    response.cookies.delete("oauth_account_id");

    return response;
  }
}
