import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { name, description } = await req.json();
    const { id } = await params;

    if (!name && !description) {
      return NextResponse.json(
        { error: "Al menos un campo es requerido" },
        { status: 400 }
      );
    }

    await connectDB();
    const account = await XAccount.findById(id);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Verificar si la cuenta tiene credenciales propias
    if (!account.useOwnCredentials || !account.credentialsVerified) {
      return NextResponse.json(
        { error: "Esta cuenta no tiene credenciales propias configuradas" },
        { status: 400 }
      );
    }

    // Usar Bearer Token directamente
    let accessToken = account.ownBearerToken;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No se encontró Bearer Token para esta cuenta" },
        { status: 400 }
      );
    }

    // Actualizar perfil en Twitter usando v1.1 API
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    const response = await fetch(
      "https://api.twitter.com/1.1/account/update_profile.json",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(updateData).toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Error de Twitter API:", error);
      return NextResponse.json(
        {
          error:
            error.errors?.[0]?.message ||
            "Error al actualizar perfil en Twitter",
          details: error,
        },
        { status: response.status }
      );
    }

    const updatedProfile = await response.json();

    // Actualizar en base de datos
    await XAccount.findByIdAndUpdate(id, {
      $set: {
        "profileInfo.name": updatedProfile.name,
        "profileInfo.description": updatedProfile.description,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Perfil actualizado exitosamente",
      profile: {
        name: updatedProfile.name,
        description: updatedProfile.description,
      },
    });
  } catch (error) {
    console.error("Error actualizando perfil:", error);
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
