import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, buildApiUrl } from "@/config/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Construir la URL del backend con los parámetros
    const backendUrl = buildApiUrl("/api/history/stats", {
      days: searchParams.get("days") || "7",
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error en proxy de estadísticas de historial:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
