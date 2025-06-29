import prisma from "@/lib/db";

export interface TokenValidation {
  isValid: boolean;
  needsRefresh: boolean;
  expiresAt?: Date;
  error?: string;
}

/**
 * Verifica si una cuenta necesita reautenticación
 */
export async function needsReauth(accountId: string): Promise<boolean> {
  try {
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
      include: { tokenInfo: true },
    });

    if (!account) {
      return true; // Si no existe la cuenta, necesita reauth
    }

    // Si no tiene credenciales verificadas
    if (!account.credentialsVerified) {
      return true;
    }

    // Si no tiene tokens
    if (!account.ownOAuth2AccessToken && !account.ownBearerToken) {
      return true;
    }

    // Verificar información del token
    if (account.tokenInfo) {
      if (!account.tokenInfo.isValid) {
        return true;
      }

      // Si el token ha expirado
      if (
        account.tokenInfo.expiresAt &&
        account.tokenInfo.expiresAt < new Date()
      ) {
        return true;
      }
    }

    // Si tiene OAuth 2.0 y ha expirado
    if (
      account.oauth2TokenExpiresAt &&
      account.oauth2TokenExpiresAt < new Date()
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error verificando reauth:", error);
    return true; // En caso de error, asumir que necesita reauth
  }
}

/**
 * Valida un token de acceso
 */
export async function validateToken(
  accountId: string
): Promise<TokenValidation> {
  try {
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
      include: { tokenInfo: true },
    });

    if (!account) {
      return {
        isValid: false,
        needsRefresh: false,
        error: "Cuenta no encontrada",
      };
    }

    // Verificar si tiene tokens
    const hasOAuth2Token = !!account.ownOAuth2AccessToken;
    const hasBearerToken = !!account.ownBearerToken;

    if (!hasOAuth2Token && !hasBearerToken) {
      return {
        isValid: false,
        needsRefresh: false,
        error: "No hay tokens disponibles",
      };
    }

    // Si tiene Bearer Token, es válido (no expira)
    if (hasBearerToken) {
      return {
        isValid: true,
        needsRefresh: false,
      };
    }

    // Verificar OAuth 2.0 token
    if (hasOAuth2Token) {
      const now = new Date();
      const expiresAt = account.oauth2TokenExpiresAt;

      if (!expiresAt) {
        return {
          isValid: true,
          needsRefresh: false,
        };
      }

      const timeToExpiry = expiresAt.getTime() - now.getTime();
      const needsRefresh = timeToExpiry < 15 * 60 * 1000; // Refrescar si expira en menos de 15 minutos

      if (timeToExpiry <= 0) {
        return {
          isValid: false,
          needsRefresh: true,
          expiresAt,
          error: "Token expirado",
        };
      }

      return {
        isValid: true,
        needsRefresh,
        expiresAt,
      };
    }

    return {
      isValid: false,
      needsRefresh: false,
      error: "Configuración de tokens inválida",
    };
  } catch (error: any) {
    console.error("Error validando token:", error);
    return {
      isValid: false,
      needsRefresh: false,
      error: error.message || "Error desconocido",
    };
  }
}

/**
 * Marca un token como inválido
 */
export async function invalidateToken(accountId: string): Promise<void> {
  try {
    await prisma.tokenInfo.upsert({
      where: { accountId },
      update: {
        isValid: false,
        lastRefresh: new Date(),
      },
      create: {
        accountId,
        isValid: false,
        expiresAt: new Date(), // Ya expirado
        lastRefresh: new Date(),
      },
    });

    // También marcar en la cuenta que necesita reautenticación
    await prisma.xAccount.update({
      where: { id: accountId },
      data: {
        credentialsVerified: false,
      },
    });
  } catch (error) {
    console.error("Error invalidando token:", error);
    throw error;
  }
}

/**
 * Actualiza la información de un token después de un refresh exitoso
 */
export async function updateTokenInfo(
  accountId: string,
  expiresIn: number
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.tokenInfo.upsert({
      where: { accountId },
      update: {
        isValid: true,
        expiresAt,
        lastRefresh: new Date(),
      },
      create: {
        accountId,
        isValid: true,
        expiresAt,
        lastRefresh: new Date(),
      },
    });
  } catch (error) {
    console.error("Error actualizando info de token:", error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de tokens
 */
export async function getTokenStats(): Promise<{
  total: number;
  valid: number;
  expired: number;
  needRefresh: number;
}> {
  try {
    const accounts = await prisma.xAccount.findMany({
      include: { tokenInfo: true },
    });

    const now = new Date();
    let valid = 0;
    let expired = 0;
    let needRefresh = 0;

    for (const account of accounts) {
      if (!account.tokenInfo) {
        continue;
      }

      if (!account.tokenInfo.isValid) {
        expired++;
        continue;
      }

      if (account.tokenInfo.expiresAt && account.tokenInfo.expiresAt < now) {
        expired++;
        continue;
      }

      const timeToExpiry = account.tokenInfo.expiresAt
        ? account.tokenInfo.expiresAt.getTime() - now.getTime()
        : null;

      if (timeToExpiry && timeToExpiry < 15 * 60 * 1000) {
        needRefresh++;
      } else {
        valid++;
      }
    }

    return {
      total: accounts.length,
      valid,
      expired,
      needRefresh,
    };
  } catch (error) {
    console.error("Error obteniendo estadísticas de tokens:", error);
    return { total: 0, valid: 0, expired: 0, needRefresh: 0 };
  }
}
