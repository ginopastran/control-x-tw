import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, buildApiUrl } from "@/config/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Construir la URL del backend con todos los parámetros
    const backendUrl = buildApiUrl("/api/history", {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
      search: searchParams.get("search") || "",
      action: searchParams.get("action") || "all",
      status: searchParams.get("status") || "all",
      account: searchParams.get("account") || "all",
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
    console.error("Error en proxy de historial:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
