import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { TwitterApi } from "twitter-api-v2";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    const media = formData.get("media") as File;
    const type = formData.get("type") as string;

    console.log("🔍 Subiendo media para cuenta:", id);
    console.log("🔍 Tipo de media:", type);

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

    // Verificar que el archivo sea válido
    if (!media) {
      return NextResponse.json(
        { error: "No se ha proporcionado ningún archivo" },
        { status: 400 }
      );
    }

    if (!type || !["profile", "banner"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo de media inválido. Debe ser 'profile' o 'banner'" },
        { status: 400 }
      );
    }

    // Verificar tamaño del archivo (5MB max para imágenes)
    if (media.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 5MB" },
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    if (!media.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos de imagen" },
        { status: 400 }
      );
    }

    console.log("✅ Validaciones básicas pasadas");

    console.log("🔍 Credenciales de cuenta:", {
      username: account.username,
      useOwnCredentials: account.useOwnCredentials,
      hasOAuth2AccessToken: !!account.ownOAuth2AccessToken,
      hasOAuth1Tokens: !!(
        account.ownAccessToken && account.ownAccessTokenSecret
      ),
      hasApiKeys: !!(account.ownApiKey && account.ownApiSecret),
    });

    // Verificar credenciales (igual que en profile)
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

    // Configurar cliente de Twitter según el tipo de credenciales disponibles (igual que en profile)
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

    try {
      // Convertir el archivo a Buffer
      const arrayBuffer = await media.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(
        `📤 Actualizando ${type} de ${buffer.length} bytes para @${account.username}`
      );

      let result;

      if (type === "profile") {
        // ✅ Para foto de perfil: usar uploadMedia y luego updateAccountProfileImage
        const mediaUpload = await twitterClient.v1.uploadMedia(buffer, {
          mimeType: media.type,
          target: "tweet",
        });
        console.log("✅ Media subida exitosamente, ID:", mediaUpload);

        // Actualizar foto de perfil usando el media ID
        result = await twitterClient.v1.updateAccountProfileImage(mediaUpload);
        console.log("✅ Foto de perfil actualizada en Twitter");
      } else if (type === "banner") {
        // ✅ Para banner: usar updateAccountProfileBanner directamente con los datos de la imagen
        console.log("🖼️ Actualizando banner directamente...");

        result = await twitterClient.v1.updateAccountProfileBanner(buffer);
        console.log("✅ Banner actualizado en Twitter");
      }

      // Actualizar la última actividad de la cuenta
      await prisma.xAccount.update({
        where: { id },
        data: {
          lastActivity: new Date(),
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${
          type === "profile" ? "Foto de perfil" : "Portada"
        } actualizada exitosamente en Twitter`,
        result: result,
        account: {
          id: account.id,
          username: account.username,
        },
      });
    } catch (uploadError: any) {
      console.error(`❌ Error subiendo ${type}:`, uploadError);

      // Manejo específico de errores de Twitter API (igual que en profile)
      if (uploadError.code) {
        const errorMessages: { [key: number]: string } = {
          32: "No autenticado - Token inválido",
          63: "Usuario suspendido",
          64: "Tu cuenta está suspendida",
          89: "Token inválido o expirado",
          99: "No puedes ver estos datos",
          135: "No se pudo autenticar",
          215: "Credenciales incorrectas",
          326: "Cuenta bloqueada temporalmente",
          324: "La imagen debe ser menor a 5MB",
          422: "El archivo de imagen está corrupto",
        };

        const message =
          errorMessages[uploadError.code] ||
          `Error de Twitter: ${uploadError.message}`;

        return NextResponse.json(
          {
            error: message,
            twitterError: uploadError.code,
            details: uploadError.message,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: `Error subiendo ${type}`,
          details:
            uploadError.message || "Error desconocido al subir la imagen",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("❌ Error general en endpoint de media:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
