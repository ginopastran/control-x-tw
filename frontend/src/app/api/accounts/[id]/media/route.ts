import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const formData = await req.formData();
    const media = formData.get("media") as File;
    const type = formData.get("type") as string;
    const { id } = await params;

    if (!media || !type) {
      return NextResponse.json(
        { error: "Archivo y tipo son requeridos" },
        { status: 400 }
      );
    }

    if (!["profile", "banner"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo debe ser 'profile' o 'banner'" },
        { status: 400 }
      );
    }

    const account = await prisma.xAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Verificar credenciales propias
    if (!account.useOwnCredentials || !account.credentialsVerified) {
      return NextResponse.json(
        { error: "Esta cuenta no tiene credenciales propias configuradas" },
        { status: 400 }
      );
    }

    if (!account.ownBearerToken) {
      return NextResponse.json(
        { error: "No se encontró Bearer Token para esta cuenta" },
        { status: 400 }
      );
    }

    // Convertir archivo a base64
    const bytes = await media.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Subir a Twitter
    const endpoint =
      type === "profile"
        ? "https://api.twitter.com/1.1/account/update_profile_image.json"
        : "https://api.twitter.com/1.1/account/update_profile_banner.json";

    const body = new URLSearchParams();
    if (type === "profile") {
      body.append("image", base64);
    } else {
      body.append("banner", base64);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.ownBearerToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Error subiendo imagen:", error);
      return NextResponse.json(
        {
          error: error.errors?.[0]?.message || "Error al subir imagen",
          code: response.status,
          details: error,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Actualizar en base de datos usando Prisma
    const updateField =
      type === "profile"
        ? { profileImageUrl: result.profile_image_url_https }
        : { profileBannerUrl: result.profile_banner_url };

    await prisma.xAccount.update({
      where: { id },
      data: updateField,
    });

    return NextResponse.json({
      success: true,
      message: `${
        type === "profile" ? "Foto de perfil" : "Portada"
      } actualizada exitosamente`,
      imageUrl:
        type === "profile"
          ? result.profile_image_url_https
          : result.profile_banner_url,
    });
  } catch (error) {
    console.error("Error subiendo imagen:", error);
    return NextResponse.json(
      {
        error:
          "Error interno del servidor: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
