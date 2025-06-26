import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Verificar variables de entorno
    const CLIENT_ID = process.env.X_CLIENT_ID;
    const CLIENT_SECRET = process.env.X_CLIENT_SECRET;

    // Obtener todas las cuentas
    const accounts = await prisma.xAccount.findMany();

    // Procesar información de cada cuenta
    const accountsWithTokens = accounts.map((account) => {
      const now = new Date();

      // Simular información de token basada en campos existentes
      const hasValidTokens = account.useOwnCredentials
        ? !!(account.ownAccessToken && account.ownAccessTokenSecret)
        : !!process.env.TWITTER_ACCESS_TOKEN;

      return {
        _id: account.id,
        username: account.username,
        userId: account.userId || account.twitterUserId,
        developerTag:
          account.userAppName ||
          (account.useOwnCredentials ? "Usuario propio" : "Compartida"),
        labels: account.labels || [],
        createdAt: account.createdAt,
        useOwnCredentials: account.useOwnCredentials,
        credentialsVerified: account.credentialsVerified,
        userAppName: account.userAppName,
        appCreatedAt: account.appCreatedAt,

        // Credenciales OAuth
        hasAccessToken: hasValidTokens,
        hasRefreshToken: !!account.ownOAuth2RefreshToken,
        needsReauth: !hasValidTokens,

        // Información simulada del token
        tokenInfo: {
          isValid: hasValidTokens,
          expiresAt: new Date(Date.now() + 7200000), // 2 horas por defecto
          lastRefresh: account.updatedAt,
          hoursToExpiry: hasValidTokens ? 2 : null,
          status: hasValidTokens ? "VALID" : "INVALID",
        },
      };
    });

    // Estadísticas
    const stats = {
      total: accounts.length,
      valid: accountsWithTokens.filter((a) => a.tokenInfo?.status === "VALID")
        .length,
      needsRefresh: 0,
      expired: 0,
      invalid: accountsWithTokens.filter(
        (a) => a.tokenInfo?.status === "INVALID"
      ).length,
      needsReauth: accountsWithTokens.filter((a) => a.needsReauth).length,
    };

    return NextResponse.json({
      environment: {
        hasClientId: !!CLIENT_ID,
        hasClientSecret: !!CLIENT_SECRET,
        clientIdLength: CLIENT_ID?.length || 0,
        clientSecretLength: CLIENT_SECRET?.length || 0,
      },
      stats,
      accounts: accountsWithTokens,
    });
  } catch (error: any) {
    console.error("Error al obtener debug de cuentas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
