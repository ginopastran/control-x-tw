import { connectDB } from "@/lib/mongodb";
import TokenInfo from "@/models/TokenInfo";
import XAccount from "@/models/XAccount";
import { logAction, logError } from "@/lib/log-action";

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;

// Validar variables de entorno al cargar el módulo
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Variables de entorno de Twitter no configuradas:");
  console.error("X_CLIENT_ID:", CLIENT_ID ? "✅ Configurado" : "❌ Falta");
  console.error(
    "X_CLIENT_SECRET:",
    CLIENT_SECRET ? "✅ Configurado" : "❌ Falta"
  );
}

// Tiempo antes de la expiración para refrescar el token (15 minutos)
const REFRESH_THRESHOLD = 15 * 60 * 1000;

/**
 * Obtiene un token válido para una cuenta
 * Si el token está por expirar, lo refresca automáticamente
 */
export async function getValidToken(accountId: string): Promise<string> {
  await connectDB();

  // Buscar información del token
  let tokenInfo = await TokenInfo.findOne({ accountId });

  // Si no existe información del token, obtenerla de la cuenta
  if (!tokenInfo) {
    const account = await XAccount.findById(accountId);
    if (!account || !account.accessToken || !account.refreshToken) {
      throw new Error("Cuenta no encontrada o sin tokens válidos");
    }

    // Crear nueva información de token (asumimos 2 horas de validez)
    tokenInfo = await TokenInfo.create({
      accountId,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas
      lastRefresh: new Date(),
      isValid: true,
    });
  }

  // Si el token está marcado como inválido, verificar si necesita re-autenticación
  if (!tokenInfo.isValid) {
    throw new Error("La cuenta necesita re-autenticación. Token inválido.");
  }

  // Verificar si el token necesita ser refrescado
  if (needsRefresh(tokenInfo)) {
    try {
      tokenInfo = await refreshToken(tokenInfo);
    } catch (error: any) {
      logError("token_refresh_error", error);

      // Si es un error de autorización, marcar la cuenta como que necesita re-autenticación
      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("authorization") ||
        error.message.includes("Invalid refresh token")
      ) {
        await invalidateToken(accountId);
        throw new Error(
          "La cuenta necesita re-autenticación. Refresh token inválido."
        );
      }

      throw new Error("Error al refrescar el token");
    }
  }

  return tokenInfo.accessToken;
}

/**
 * Verifica si un token necesita ser refrescado
 */
function needsRefresh(tokenInfo: any): boolean {
  if (!tokenInfo.isValid) return true;

  const now = new Date();
  const expiresAt = new Date(tokenInfo.expiresAt);

  // Refrescar si está a 15 minutos de expirar
  return expiresAt.getTime() - now.getTime() < REFRESH_THRESHOLD;
}

/**
 * Refresca un token usando el refresh token
 */
async function refreshToken(tokenInfo: any) {
  try {
    logAction("token_refresh_start", { accountId: tokenInfo.accountId });

    // Validar variables de entorno antes de proceder
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error(
        "Variables de entorno X_CLIENT_ID o X_CLIENT_SECRET no configuradas"
      );
    }

    // Validar que tenemos refresh token
    if (!tokenInfo.refreshToken) {
      throw new Error("No hay refresh token disponible para esta cuenta");
    }

    // Preparar solicitud para refrescar el token
    const tokenRequest = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenInfo.refreshToken,
      client_id: CLIENT_ID,
    });

    // Credenciales en encabezado de autorización
    const authHeader = `Basic ${Buffer.from(
      `${CLIENT_ID}:${CLIENT_SECRET}`
    ).toString("base64")}`;

    logAction("token_refresh_request", {
      accountId: tokenInfo.accountId,
      clientId: CLIENT_ID,
      hasRefreshToken: !!tokenInfo.refreshToken,
    });

    // Realizar solicitud a la API de X
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: tokenRequest,
    });

    const data = await response.json();

    if (!response.ok) {
      logError("token_refresh_api_error", {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        errorDescription: data.error_description,
        accountId: tokenInfo.accountId,
      });

      tokenInfo.isValid = false;
      await tokenInfo.save();

      // Mejorar el mensaje de error según el código de respuesta
      if (response.status === 401) {
        throw new Error(
          "Unauthorized - El refresh token ha expirado o es inválido"
        );
      } else if (response.status === 403) {
        throw new Error("Forbidden - No tienes permisos para esta operación");
      } else {
        throw new Error(
          `Error al refrescar token: ${data.error_description || data.error}`
        );
      }
    }

    // Actualizar información del token
    tokenInfo.accessToken = data.access_token;
    if (data.refresh_token) {
      tokenInfo.refreshToken = data.refresh_token;
    }
    tokenInfo.expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas
    tokenInfo.lastRefresh = new Date();
    tokenInfo.isValid = true;

    await tokenInfo.save();

    // Actualizar también la cuenta
    await XAccount.findByIdAndUpdate(tokenInfo.accountId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokenInfo.refreshToken,
    });

    logAction("token_refresh_success", { accountId: tokenInfo.accountId });

    return tokenInfo;
  } catch (error) {
    logError("token_refresh_error", error);
    throw error;
  }
}

/**
 * Invalida un token
 */
export async function invalidateToken(accountId: string) {
  await TokenInfo.findOneAndUpdate(
    { accountId },
    { isValid: false },
    { new: true }
  );
}

/**
 * Verifica si una cuenta necesita re-autenticación
 */
export async function needsReauth(accountId: string): Promise<boolean> {
  await connectDB();

  const tokenInfo = await TokenInfo.findOne({ accountId });

  if (!tokenInfo) return true;
  if (!tokenInfo.isValid) return true;

  // Si el token ha expirado hace más de 1 día, probablemente necesita re-auth
  const now = new Date();
  const expiresAt = new Date(tokenInfo.expiresAt);
  const dayInMs = 24 * 60 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < -dayInMs) {
    return true;
  }

  return false;
}
