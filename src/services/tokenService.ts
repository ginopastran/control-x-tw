import { connectDB } from "@/lib/mongodb";
import TokenInfo from "@/models/TokenInfo";
import XAccount from "@/models/XAccount";
import { logAction, logError } from "@/lib/log-action";

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;

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
      isValid: true
    });
  }
  
  // Verificar si el token necesita ser refrescado
  if (needsRefresh(tokenInfo)) {
    try {
      tokenInfo = await refreshToken(tokenInfo);
    } catch (error) {
      logError('token_refresh_error', error);
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
    logAction('token_refresh_start', { accountId: tokenInfo.accountId });
    
    // Preparar solicitud para refrescar el token
    const tokenRequest = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenInfo.refreshToken,
      client_id: CLIENT_ID,
    });
    
    // Credenciales en encabezado de autorización
    const authHeader = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
    
    // Realizar solicitud a la API de X
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": authHeader,
      },
      body: tokenRequest,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      tokenInfo.isValid = false;
      await tokenInfo.save();
      throw new Error(`Error al refrescar token: ${data.error_description || data.error}`);
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
      refreshToken: data.refresh_token || tokenInfo.refreshToken
    });
    
    logAction('token_refresh_success', { accountId: tokenInfo.accountId });
    
    return tokenInfo;
  } catch (error) {
    logError('token_refresh_error', error);
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