import { NextResponse } from "next/server";
import { removeAuthCookieInResponse } from "@/lib/auth";

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });

    // Eliminar cookie de autenticación
    return removeAuthCookieInResponse(response);
  } catch (error: any) {
    console.error("Error al cerrar sesión:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
