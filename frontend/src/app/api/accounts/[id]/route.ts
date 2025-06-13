import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { logError } from "@/lib/log-action";

// DELETE: Eliminar una cuenta de X por su ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID de cuenta no proporcionado" },
        { status: 400 }
      );
    }

    await connectDB();

    const deletedAccount = await XAccount.findByIdAndDelete(id);

    if (!deletedAccount) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Cuenta eliminada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al eliminar cuenta:", error);
    return NextResponse.json(
      { error: "Error al eliminar la cuenta" },
      { status: 500 }
    );
  }
}

// GET - Obtener información de una cuenta específica
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;

    await connectDB();

    const account = await XAccount.findById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Preparar respuesta sin exponer credenciales sensibles
    const accountData = {
      _id: account._id,
      username: account.username,
      userId: account.userId,
      developerTag: account.developerTag,
      labels: account.labels,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      useOwnCredentials: account.useOwnCredentials || false,
      credentialsVerified: account.credentialsVerified || false,
      preferOAuth2: account.preferOAuth2 || false,
      userAppName: account.userAppName,
      userDeveloperEmail: account.userDeveloperEmail,
      appCreatedAt: account.appCreatedAt,
      hasAccessToken: !!account.accessToken,
      hasRefreshToken: !!account.refreshToken,

      // Indicadores de credenciales propias OAuth 1.0a (sin exponer los valores)
      hasOwnApiKey: !!account.ownApiKey,
      hasOwnApiSecret: !!account.ownApiSecret,
      hasOwnBearerToken: !!account.ownBearerToken,
      hasOwnAccessToken: !!account.ownAccessToken,
      hasOwnAccessTokenSecret: !!account.ownAccessTokenSecret,

      // Indicadores de credenciales propias OAuth 2.0 (sin exponer los valores)
      hasOwnClientId: !!account.ownClientId,
      hasOwnClientSecret: !!account.ownClientSecret,
      hasOwnOAuth2AccessToken: !!account.ownOAuth2AccessToken,
      hasOwnOAuth2RefreshToken: !!account.ownOAuth2RefreshToken,
      oauth2TokenExpiresAt: account.oauth2TokenExpiresAt,
      oauth2Scopes: account.oauth2Scopes || [],
    };

    return NextResponse.json({
      success: true,
      account: accountData,
    });
  } catch (error: any) {
    logError("get_account_failed", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener la cuenta" },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar propiedades de una cuenta
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();

    // Solo permitir actualizar ciertos campos
    const allowedFields = ["labels", "developerTag", "username"];
    const updateData: Record<string, any> = {};

    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key)) {
        // Validación especial para username
        if (key === "username") {
          const username = data[key];
          if (!username || typeof username !== "string") {
            throw new Error("El nombre de usuario es obligatorio");
          }
          if (username.length > 15) {
            throw new Error(
              "El nombre de usuario no puede tener más de 15 caracteres"
            );
          }
          if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            throw new Error(
              "El nombre de usuario solo puede contener letras, números y guiones bajos"
            );
          }
          if (username.startsWith("_") || username.endsWith("_")) {
            throw new Error(
              "El nombre de usuario no puede empezar o terminar con guión bajo"
            );
          }
        }
        updateData[key] = data[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos válidos para actualizar" },
        { status: 400 }
      );
    }

    await connectDB();

    // Si se está actualizando el username, verificar que no esté en uso
    if (updateData.username) {
      const existingAccount = await XAccount.findOne({
        username: updateData.username,
        _id: { $ne: id }, // Excluir la cuenta actual
      });

      if (existingAccount) {
        return NextResponse.json(
          {
            error: `El nombre de usuario @${updateData.username} ya está en uso por otra cuenta`,
          },
          { status: 400 }
        );
      }
    }

    const updatedAccount = await XAccount.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true } // Devuelve el documento actualizado
    );

    if (!updatedAccount) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("Error al actualizar cuenta:", error);
    return NextResponse.json(
      { error: "Error al actualizar la cuenta" },
      { status: 500 }
    );
  }
}
