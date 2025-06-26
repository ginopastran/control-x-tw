import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { TwitterApi } from "twitter-api-v2";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, description } = await req.json();

    console.log("🔍 Actualizando perfil para cuenta:", id);
    console.log("🔍 Datos recibidos:", { name, description });

    // Buscar la cuenta en la base de datos
    const account = await prisma.xAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    console.log("🔍 Cuenta encontrada:", {
      username: account.username,
      useOwnCredentials: account.useOwnCredentials,
      hasOAuth2AccessToken: !!account.ownOAuth2AccessToken,
      hasOAuth1Tokens: !!(
        account.ownAccessToken && account.ownAccessTokenSecret
      ),
      hasApiKeys: !!(account.ownApiKey && account.ownApiSecret),
    });

    // Verificar credenciales
    if (!account.useOwnCredentials) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta no está configurada para usar credenciales propias",
        },
        { status: 400 }
      );
    }

    let twitterClient;

    // Configurar cliente de Twitter según el tipo de credenciales disponibles
    if (account.ownOAuth2AccessToken && account.ownOAuth2RefreshToken) {
      // ✅ OAuth 2.0 (Recomendado)
      console.log("🔧 Usando OAuth 2.0...");
      twitterClient = new TwitterApi(account.ownOAuth2AccessToken);
    } else if (
      account.ownApiKey &&
      account.ownApiSecret &&
      account.ownAccessToken &&
      account.ownAccessTokenSecret
    ) {
      // ✅ OAuth 1.0a (Legacy)
      console.log("🔧 Usando OAuth 1.0a...");
      twitterClient = new TwitterApi({
        appKey: account.ownApiKey,
        appSecret: account.ownApiSecret,
        accessToken: account.ownAccessToken,
        accessSecret: account.ownAccessTokenSecret,
      });
    } else {
      return NextResponse.json(
        {
          error: "Esta cuenta no tiene credenciales válidas configuradas",
          debug: {
            hasOAuth2: !!(
              account.ownOAuth2AccessToken && account.ownOAuth2RefreshToken
            ),
            hasOAuth1: !!(
              account.ownAccessToken && account.ownAccessTokenSecret
            ),
            hasApiKeys: !!(account.ownApiKey && account.ownApiSecret),
          },
        },
        { status: 400 }
      );
    }

    // ✅ Actualizar perfil en Twitter
    console.log("🚀 Enviando actualización a Twitter API...");

    const updateData: any = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();

    // Llamada a la API de Twitter para actualizar perfil
    const result = await twitterClient.v1.updateAccountProfile(updateData);

    console.log("✅ Perfil actualizado en Twitter:", result);

    // ✅ Actualizar también en nuestra base de datos
    await prisma.xAccount.update({
      where: { id },
      data: {
        profileInfo: {
          ...account.profileInfo,
          name: result.name,
          description: result.description,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Perfil actualizado correctamente en Twitter",
      data: {
        name: result.name,
        description: result.description,
        screen_name: result.screen_name,
      },
    });
  } catch (error: any) {
    console.error("❌ Error actualizando perfil:", error);

    // Manejo específico de errores de Twitter
    if (error.code) {
      const errorMessages: { [key: number]: string } = {
        32: "No autenticado - Token inválido",
        63: "Usuario suspendido",
        64: "Tu cuenta está suspendida",
        89: "Token inválido o expirado",
        99: "No puedes ver estos datos",
        135: "No se pudo autenticar",
        215: "Credenciales incorrectas",
        326: "Cuenta bloqueada temporalmente",
      };

      const message =
        errorMessages[error.code] || `Error de Twitter: ${error.message}`;

      return NextResponse.json(
        {
          error: message,
          twitterError: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
