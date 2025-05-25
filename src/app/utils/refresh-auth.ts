import { logAction, logError } from "@/lib/log-action";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;

/**
 * Refresca el token de acceso usando el refresh token
 * @param accountId ID de la cuenta en la base de datos
 * @returns Objeto con éxito y mensaje o error
 */
export async function refreshXToken(accountId: string) {
  try {
    logAction('refresh_token_start', { accountId });
    
    // Conectar a la base de datos
    await connectDB();
    
    // Buscar la cuenta
    const account = await XAccount.findById(accountId);
    
    if (!account) {
      throw new Error("Cuenta no encontrada");
    }
    
    // Verificar si tiene refresh token
    if (!account.refreshToken) {
      throw new Error("Esta cuenta no tiene refresh token disponible");
    }
    
    // Preparar solicitud para refrescar el token
    const tokenRequest = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
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
      logError('refresh_token_error', data, { statusCode: response.status });
      throw new Error(`Error al refrescar token: ${data.error_description || data.error}`);
    }
    
    // Actualizar la cuenta con el nuevo token
    account.accessToken = data.access_token;
    
    // Si se recibió un nuevo refresh token, actualizarlo también
    if (data.refresh_token) {
      account.refreshToken = data.refresh_token;
    }
    
    await account.save();
    
    logAction('refresh_token_success', { accountId });
    
    return {
      success: true,
      message: "Token actualizado correctamente",
    };
  } catch (error: any) {
    logError('refresh_token_error', error);
    
    return {
      success: false,
      error: error.message || "Error al refrescar token",
    };
  }
} 