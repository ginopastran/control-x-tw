import prisma from "@/lib/db";

export interface RefreshResult {
  success: boolean;
  error?: string;
  needsReauth?: boolean;
}

/**
 * Refresca el token de autenticación de una cuenta
 */
export async function refreshAccountAuth(
  accountId: string
): Promise<RefreshResult> {
  try {
    // Buscar la cuenta usando Prisma
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
      include: { tokenInfo: true },
    });

    if (!account) {
      return {
        success: false,
        error: "Cuenta no encontrada",
      };
    }

    // Verificar si tiene refresh token
    if (!account.ownOAuth2RefreshToken) {
      return {
        success: false,
        error: "No hay refresh token disponible",
        needsReauth: true,
      };
    }

    // Verificar credenciales OAuth 2.0
    if (!account.ownClientId || !account.ownClientSecret) {
      return {
        success: false,
        error: "Credenciales OAuth 2.0 no configuradas",
        needsReauth: true,
      };
    }

    // Intentar refrescar el token
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${account.ownClientId}:${account.ownClientSecret}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.ownOAuth2RefreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();

      // Marcar token como inválido
      await prisma.tokenInfo.upsert({
        where: { accountId },
        update: { isValid: false },
        create: {
          accountId,
          isValid: false,
          expiresAt: new Date(),
        },
      });

      return {
        success: false,
        error: error.error_description || "Error al refrescar token",
        needsReauth: true,
      };
    }

    const tokenData = await response.json();

    // Actualizar tokens en la cuenta
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await prisma.xAccount.update({
      where: { id: accountId },
      data: {
        ownOAuth2AccessToken: tokenData.access_token,
        ownOAuth2RefreshToken:
          tokenData.refresh_token || account.ownOAuth2RefreshToken,
        oauth2TokenExpiresAt: expiresAt,
      },
    });

    // Actualizar información del token
    await prisma.tokenInfo.upsert({
      where: { accountId },
      update: {
        isValid: true,
        expiresAt: expiresAt,
        lastRefresh: new Date(),
      },
      create: {
        accountId,
        isValid: true,
        expiresAt: expiresAt,
        lastRefresh: new Date(),
      },
    });

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error refrescando auth:", error);
    return {
      success: false,
      error: error.message || "Error interno",
    };
  }
}

/**
 * Verifica si una cuenta necesita refresh de token
 */
export async function needsTokenRefresh(accountId: string): Promise<boolean> {
  try {
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
      include: { tokenInfo: true },
    });

    if (!account || !account.tokenInfo) {
      return true;
    }

    // Si el token no es válido
    if (!account.tokenInfo.isValid) {
      return true;
    }

    // Si expira en menos de 15 minutos
    const now = new Date();
    const expiresAt = account.tokenInfo.expiresAt;

    if (expiresAt) {
      const timeToExpiry = expiresAt.getTime() - now.getTime();
      return timeToExpiry < 15 * 60 * 1000; // 15 minutos
    }

    return false;
  } catch (error) {
    console.error("Error verificando necesidad de refresh:", error);
    return true;
  }
}

/**
 * Programa un refresh automático para todas las cuentas que lo necesiten
 */
export async function scheduleTokenRefresh(): Promise<void> {
  try {
    const accounts = await prisma.xAccount.findMany({
      where: {
        useOwnCredentials: true,
        credentialsVerified: true,
        ownOAuth2RefreshToken: { not: null },
      },
      include: { tokenInfo: true },
    });

    for (const account of accounts) {
      const needsRefresh = await needsTokenRefresh(account.id);

      if (needsRefresh) {
        console.log(`🔄 Refrescando token para cuenta: ${account.username}`);
        const result = await refreshAccountAuth(account.id);

        if (result.success) {
          console.log(`✅ Token refrescado para: ${account.username}`);
        } else {
          console.log(
            `❌ Error refrescando token para ${account.username}: ${result.error}`
          );
        }
      }
    }
  } catch (error) {
    console.error("Error en refresh programado:", error);
  }
}
