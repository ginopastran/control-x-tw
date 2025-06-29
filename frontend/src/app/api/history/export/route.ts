import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, buildApiUrl } from "@/config/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Construir la URL del backend con todos los parámetros
    const backendUrl = buildApiUrl("/api/history/export", {
      action: searchParams.get("action") || "all",
      status: searchParams.get("status") || "all",
      account: searchParams.get("account") || "all",
      days: searchParams.get("days") || "7",
      format: searchParams.get("format") || "csv",
    });

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    // Si es CSV, devolver como stream
    if (searchParams.get("format") === "csv") {
      const csvData = await response.text();

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="historial-acciones-${
            new Date().toISOString().split("T")[0]
          }.csv"`,
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error en proxy de exportación de historial:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
