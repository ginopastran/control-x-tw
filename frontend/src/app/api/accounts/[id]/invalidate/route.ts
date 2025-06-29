import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;

    if (!accountId) {
      return NextResponse.json(
        { error: "ID de cuenta requerido" },
        { status: 400 }
      );
    }

    // Verificar que la cuenta existe
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Invalidar el token en la tabla TokenInfo
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

    return NextResponse.json({
      success: true,
      message: "Token invalidado. La cuenta necesitará re-autenticación.",
      accountId,
    });
  } catch (error: any) {
    console.error("Error al invalidar token:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
