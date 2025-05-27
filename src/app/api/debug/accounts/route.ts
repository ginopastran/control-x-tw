import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import TokenInfo from "@/models/TokenInfo";
import { needsReauth } from "@/services/tokenService";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    // Verificar variables de entorno
    const CLIENT_ID = process.env.X_CLIENT_ID;
    const CLIENT_SECRET = process.env.X_CLIENT_SECRET;

    // Obtener todas las cuentas
    const accounts = await XAccount.find({});

    // Obtener información de tokens
    const accountsWithTokens = await Promise.all(
      accounts.map(async (account) => {
        const tokenInfo = await TokenInfo.findOne({ accountId: account._id });
        const needsReauthentication = await needsReauth(account._id.toString());

        const now = new Date();
        const expiresAt = tokenInfo ? new Date(tokenInfo.expiresAt) : null;
        const timeToExpiry = expiresAt
          ? expiresAt.getTime() - now.getTime()
          : null;
        const hoursToExpiry = timeToExpiry
          ? Math.round(timeToExpiry / (1000 * 60 * 60))
          : null;

        return {
          _id: account._id,
          username: account.username,
          userId: account.userId,
          developerTag: account.developerTag,
          labels: account.labels || [],
          createdAt: account.createdAt,
          hasAccessToken: !!account.accessToken,
          hasRefreshToken: !!account.refreshToken,
          accessTokenLength: account.accessToken?.length || 0,
          refreshTokenLength: account.refreshToken?.length || 0,
          needsReauth: needsReauthentication,
          tokenInfo: tokenInfo
            ? {
                isValid: tokenInfo.isValid,
                expiresAt: tokenInfo.expiresAt,
                lastRefresh: tokenInfo.lastRefresh,
                needsRefresh: timeToExpiry
                  ? timeToExpiry < 15 * 60 * 1000
                  : true,
                hoursToExpiry: hoursToExpiry,
                status: !tokenInfo.isValid
                  ? "INVALID"
                  : timeToExpiry && timeToExpiry < 0
                  ? "EXPIRED"
                  : timeToExpiry && timeToExpiry < 15 * 60 * 1000
                  ? "NEEDS_REFRESH"
                  : "VALID",
              }
            : null,
        };
      })
    );

    // Estadísticas
    const stats = {
      total: accounts.length,
      valid: accountsWithTokens.filter((a) => a.tokenInfo?.status === "VALID")
        .length,
      needsRefresh: accountsWithTokens.filter(
        (a) => a.tokenInfo?.status === "NEEDS_REFRESH"
      ).length,
      expired: accountsWithTokens.filter(
        (a) => a.tokenInfo?.status === "EXPIRED"
      ).length,
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
