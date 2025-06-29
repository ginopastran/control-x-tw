import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

interface TestResult {
  accountId: string;
  username: string;
  status: "success" | "error" | "warning";
  message: string;
  details: {
    hasTokens: boolean;
    tokenValid: boolean;
    apiAccess: boolean;
    rateLimitStatus?: string;
    lastError?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación y permisos - solo SUPERADMIN
    const user = await getAuthUser(req);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo SUPERADMIN puede testear cuentas." },
        { status: 403 }
      );
    }

    const { accountIds } = await req.json();

    // Si no se especifican IDs, testear todas las cuentas
    let accountsToTest;
    if (accountIds && accountIds.length > 0) {
      accountsToTest = await prisma.xAccount.findMany({
        where: { id: { in: accountIds } },
        include: { tokenInfo: true },
      });
    } else {
      accountsToTest = await prisma.xAccount.findMany({
        include: { tokenInfo: true },
      });
    }

    const testResults: TestResult[] = [];

    for (const account of accountsToTest) {
      const result: TestResult = {
        accountId: account.id,
        username: account.username,
        status: "success",
        message: "Cuenta funcionando correctamente",
        details: {
          hasTokens: false,
          tokenValid: false,
          apiAccess: false,
        },
      };

      try {
        // Verificar si tiene tokens
        result.details.hasTokens = !!(
          account.accessToken && account.refreshToken
        );

        if (!result.details.hasTokens) {
          result.status = "error";
          result.message = "Cuenta sin tokens de acceso";
          testResults.push(result);
          continue;
        }

        // Verificar estado del token
        if (account.tokenInfo) {
          result.details.tokenValid = account.tokenInfo.isValid;

          if (!account.tokenInfo.isValid) {
            result.status = "warning";
            result.message = "Token inválido";
          }
        }

        // Test básico de API - verificar perfil del usuario
        try {
          const testApiCall = await fetch(
            `https://api.twitter.com/2/users/me`,
            {
              headers: {
                Authorization: `Bearer ${account.accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (testApiCall.ok) {
            result.details.apiAccess = true;
            const userData = await testApiCall.json();

            if (userData.data?.username !== account.username) {
              result.status = "warning";
              result.message = "Username no coincide con el token";
            }
          } else {
            result.details.apiAccess = false;
            result.status = "error";

            if (testApiCall.status === 401) {
              result.message = "Token no autorizado - necesita reautenticación";
            } else if (testApiCall.status === 429) {
              result.message = "Rate limit excedido";
              result.details.rateLimitStatus = "exceeded";
            } else {
              result.message = `Error de API: ${testApiCall.status}`;
            }
          }
        } catch (apiError: any) {
          result.details.apiAccess = false;
          result.status = "error";
          result.message = "Error al conectar con la API de X";
          result.details.lastError = apiError.message;
        }
      } catch (error: any) {
        result.status = "error";
        result.message = "Error al testear la cuenta";
        result.details.lastError = error.message;
      }

      testResults.push(result);
    }

    // Generar resumen
    const summary = {
      total: testResults.length,
      success: testResults.filter((r) => r.status === "success").length,
      warnings: testResults.filter((r) => r.status === "warning").length,
      errors: testResults.filter((r) => r.status === "error").length,
    };

    return NextResponse.json({
      success: true,
      summary,
      results: testResults,
      testedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error al testear cuentas:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
