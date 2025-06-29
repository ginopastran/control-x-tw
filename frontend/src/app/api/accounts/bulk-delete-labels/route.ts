import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST: Eliminar etiquetas específicas de todas las cuentas
export async function POST(req: NextRequest) {
  try {
    const { labels } = await req.json();

    if (!labels || !Array.isArray(labels) || labels.length === 0) {
      return NextResponse.json(
        { error: "Debe proporcionar un array de etiquetas a eliminar" },
        { status: 400 }
      );
    }

    // Buscar todas las cuentas que tengan al menos una de las etiquetas a eliminar
    const accountsWithLabels = await prisma.xAccount.findMany({
      where: {
        labels: {
          hasSome: labels,
        },
      },
      select: {
        id: true,
        username: true,
        labels: true,
      },
    });

    if (accountsWithLabels.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No se encontraron cuentas con las etiquetas especificadas",
        modifiedCount: 0,
        affectedAccounts: [],
      });
    }

    // Eliminar las etiquetas especificadas de todas las cuentas
    const updatePromises = accountsWithLabels.map((account) => {
      const newLabels = account.labels.filter(
        (label) => !labels.includes(label)
      );
      return prisma.xAccount.update({
        where: { id: account.id },
        data: { labels: newLabels },
        select: { id: true, username: true, labels: true },
      });
    });

    const modifiedAccounts = await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `Se eliminaron ${labels.length} etiqueta(s) de ${modifiedAccounts.length} cuenta(s)`,
      deletedLabels: labels,
      modifiedCount: modifiedAccounts.length,
      affectedAccounts: modifiedAccounts.map((acc) => ({
        id: acc.id,
        username: acc.username,
        remainingLabels: acc.labels,
      })),
    });
  } catch (error: any) {
    console.error("Error al eliminar etiquetas en lote:", error);
    return NextResponse.json(
      { error: "Error al eliminar las etiquetas: " + error.message },
      { status: 500 }
    );
  }
}
