import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";

// POST: Eliminar etiquetas específicas de todas las cuentas
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { labels } = await req.json();

    if (!labels || !Array.isArray(labels) || labels.length === 0) {
      return NextResponse.json(
        { error: "Debe proporcionar un array de etiquetas a eliminar" },
        { status: 400 }
      );
    }

    // Buscar todas las cuentas que tengan al menos una de las etiquetas a eliminar
    const accountsWithLabels = await XAccount.find({
      labels: { $in: labels },
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
    const updateResult = await XAccount.updateMany(
      { labels: { $in: labels } },
      { $pullAll: { labels: labels } }
    );

    // Obtener las cuentas modificadas para el reporte
    const modifiedAccounts = await XAccount.find(
      {
        _id: { $in: accountsWithLabels.map((acc) => acc._id) },
      },
      { username: 1, labels: 1 }
    );

    return NextResponse.json({
      success: true,
      message: `Se eliminaron ${labels.length} etiqueta(s) de ${updateResult.modifiedCount} cuenta(s)`,
      deletedLabels: labels,
      modifiedCount: updateResult.modifiedCount,
      affectedAccounts: modifiedAccounts.map((acc) => ({
        id: acc._id,
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
