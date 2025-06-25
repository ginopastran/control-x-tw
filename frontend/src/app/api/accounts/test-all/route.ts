import { NextRequest, NextResponse } from "next/server";
import { buildApiUrl } from "@/config/api";

export async function POST(req: NextRequest) {
  try {
    console.log(
      "🔄 [FRONTEND] Proxy: Enviando request al backend para test-all"
    );

    // Obtener las cookies de autenticación de la request original
    const authCookie = req.headers.get("cookie");

    // Enviar request al backend
    const backendUrl = buildApiUrl("/api/accounts/test-all");
    console.log("🎯 [FRONTEND] Llamando al backend:", backendUrl);

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authCookie && { Cookie: authCookie }),
      },
    });

    if (!response.ok) {
      console.error(
        "❌ [FRONTEND] Error del backend:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: `Error del backend: ${response.status} ${response.statusText}`,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("✅ [FRONTEND] Respuesta exitosa del backend");

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("❌ [FRONTEND] Error en proxy test-all:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del proxy",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
