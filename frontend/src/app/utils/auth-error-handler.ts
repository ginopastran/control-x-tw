import { refreshXToken } from "./refresh-auth";
import { logAction, logError } from "@/lib/log-action";

// Tipos de errores de autorización de la API de X
const X_AUTH_ERRORS = [
  "invalid_token",
  "expired_token",
  "revoked_token",
  "insufficient_scope",
  "token_not_found"
];

// Interfaz para los errores específicos de la API de X
interface XApiError {
  code: number;
  message: string;
}

/**
 * Verifica si un error de la API de X es un problema de autenticación
 */
export function isXAuthError(error: any): boolean {
  if (!error) return false;
  
  // Comprobar si el error tiene formato de error de la API OAuth 2.0 de X
  if (error.error && typeof error.error === 'string') {
    return X_AUTH_ERRORS.includes(error.error);
  }
  
  // Comprobar si es un error específico de la API de X
  if (error.errors && Array.isArray(error.errors)) {
    return error.errors.some((err: XApiError) => 
      err.code === 32 || // Could not authenticate you
      err.code === 89 || // Invalid or expired token
      err.code === 99    // Unable to verify your credentials
    );
  }
  
  // Comprobar por mensaje de error
  if (error.message && typeof error.message === 'string') {
    const errorMsg = error.message.toLowerCase();
    return errorMsg.includes('token') && 
      (errorMsg.includes('invalid') || 
       errorMsg.includes('expired') || 
       errorMsg.includes('revoked') || 
       errorMsg.includes('auth'));
  }
  
  return false;
}

/**
 * Maneja errores de autenticación y refresca el token si es necesario
 * @param accountId ID de la cuenta
 * @param error Error devuelto por la API
 * @param operation Función que devuelve una promesa con la operación a reintentar
 */
export async function handleXAuthError<T>(
  accountId: string,
  error: any,
  operation: () => Promise<T>
): Promise<T> {
  try {
    // Si no hay error inicial, intentar la operación directamente
    if (!error) {
      try {
        return await operation();
      } catch (opError) {
        // Si es un error de autenticación, proceder con el refresco
        if (isXAuthError(opError)) {
          error = opError;
        } else {
          // Si no es un error de autenticación, simplemente relanzar
          throw opError;
        }
      }
    }

    // Verificar si es un error de autenticación
    if (error && !isXAuthError(error)) {
      throw error; // Si no es un error de autenticación, reenviar
    }
    
    // Log de intento de refresco
    logAction('auth_refresh_attempt', { accountId });
  
    try {
      // Intentar refrescar el token
      const refreshResult = await refreshXToken(accountId);
      
      if (!refreshResult.success) {
        throw new Error(`No se pudo refrescar el token: ${refreshResult.error}`);
      }
      
      logAction('auth_refresh_success', { accountId });
      
      // Si se refrescó el token, reintentar la operación original
      return await operation();
    } catch (refreshError) {
      // Si falla el refresh, registramos ambos errores
      const errorInfo = {
        originalError: error ? JSON.stringify(error) : 'No error original',
        accountId
      };
      
      logError('auth_refresh_failed', refreshError || new Error('Error desconocido al refrescar token'), errorInfo);
      
      throw new Error(
        `Error de autenticación. No se pudo refrescar el token de acceso. Por favor, reconecte su cuenta de X.`
      );
    }
  } catch (finalError) {
    // Asegurarnos de que siempre devolvemos un error con mensaje
    if (!finalError) {
      throw new Error('Error desconocido durante la autenticación');
    } 
    throw finalError;
  }
} 