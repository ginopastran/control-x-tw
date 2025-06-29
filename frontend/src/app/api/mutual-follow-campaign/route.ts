import { NextRequest, NextResponse } from "next/server";

// Configuración del backend con múltiples opciones
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:3001";

console.log(
  "🔗 BACKEND_URL configurado para mutual-follow-campaign:",
  BACKEND_URL
);

export async function GET(request: NextRequest) {
  try {
    console.log(
      "📡 Frontend GET /api/mutual-follow-campaign - Consultando estado..."
    );

    const response = await fetch(`${BACKEND_URL}/api/mutual-follow-campaign`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Pasar cookies de autenticación
        Cookie: request.headers.get("cookie") || "",
      },
      // Agregar timeout para evitar cuelgues
      signal: AbortSignal.timeout(10000), // 10 segundos
    });

    console.log(`📊 Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Backend error: ${response.status} - ${errorText}`);
      throw new Error(
        `Backend responded with ${response.status}: ${errorText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("❌ Backend no devolvió JSON válido:", text);
      throw new Error("Backend response is not valid JSON");
    }

    const data = await response.json();
    console.log("✅ Estado de campaña obtenido:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Error fetching mutual follow campaign status:", error);
    return NextResponse.json(
      {
        error: "Error connecting to backend",
        details: error.message,
        isRunning: false,
        campaign: null,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log(
      "🚀 Frontend POST /api/mutual-follow-campaign - Iniciando campaña..."
    );

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Si no hay body, usar objeto vacío
      body = {};
    }

    console.log("📋 Datos enviados al backend:", body);

    const response = await fetch(`${BACKEND_URL}/api/mutual-follow-campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify(body),
      // Agregar timeout
      signal: AbortSignal.timeout(30000), // 30 segundos para iniciar campaña
    });

    console.log(`📊 Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Backend error: ${response.status} - ${errorText}`);

      // Intentar parsear error como JSON
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      return NextResponse.json(errorData, { status: response.status });
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("❌ Backend no devolvió JSON válido:", text);
      throw new Error("Backend response is not valid JSON");
    }

    const data = await response.json();
    console.log("✅ Campaña iniciada exitosamente:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Error starting mutual follow campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error connecting to backend",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log(
      "🛑 Frontend DELETE /api/mutual-follow-campaign - Cancelando campaña..."
    );

    const response = await fetch(`${BACKEND_URL}/api/mutual-follow-campaign`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      // Agregar timeout
      signal: AbortSignal.timeout(15000), // 15 segundos
    });

    console.log(`📊 Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Backend error: ${response.status} - ${errorText}`);

      // Intentar parsear error como JSON
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      return NextResponse.json(errorData, { status: response.status });
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("❌ Backend no devolvió JSON válido:", text);
      throw new Error("Backend response is not valid JSON");
    }

    const data = await response.json();
    console.log("✅ Campaña cancelada exitosamente:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Error canceling mutual follow campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error connecting to backend",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
