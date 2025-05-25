import { NextRequest, NextResponse } from "next/server";
import { refreshXToken } from "@/app/utils/refresh-auth";
import { logError } from "@/lib/log-action";

/**
 * Endpoint para refrescar tokens de autenticación
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar si la solicitud tiene el formato correcto
    const body = await req.json();
    const { accountId } = body;
    
    if (!accountId) {
      return NextResponse.json(
        { error: "Se requiere ID de cuenta" },
        { status: 400 }
      );
    }
    
    // Refrescar el token
    const result = await refreshXToken(accountId);
    
    if (result.success) {
      return NextResponse.json({ 
        message: result.message 
      });
    } else {
      return NextResponse.json(
        { error: result.error || "Error al refrescar token" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error al procesar solicitud de refresh:", error);
    logError('api_refresh_token', error);
    
    return NextResponse.json(
      { error: "Error al refrescar token: " + (error.message || "Error desconocido") },
      { status: 500 }
    );
  }
} 