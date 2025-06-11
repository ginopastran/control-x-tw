import { NextRequest, NextResponse } from "next/server";
import { removeAuthCookieInResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Crear respuesta de éxito
    const response = NextResponse.json(
      {
        success: true,
        message: "Sesión cerrada exitosamente",
      },
      { status: 200 }
    );

    // Eliminar cookie de autenticación de forma más agresiva
    response.cookies.delete("auth_token");
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });

    // Agregar headers adicionales para asegurar que el logout sea completo
    response.headers.set(
      "Clear-Site-Data",
      '"cache", "cookies", "storage", "executionContexts"'
    );
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "Thu, 01 Jan 1970 00:00:00 GMT");

    // Headers adicionales para forzar refresh completo
    response.headers.set("Vary", "Cookie");
    response.headers.set("X-Frame-Options", "DENY");

    return response;
  } catch (error: any) {
    console.error("Error al cerrar sesión:", error);

    // Incluso si hay error, eliminar la cookie
    const response = NextResponse.json(
      { error: "Error al cerrar sesión" },
      { status: 500 }
    );

    // Eliminar cookie incluso en caso de error
    response.cookies.delete("auth_token");
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });

    // Headers de limpieza incluso en error
    response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    return response;
  }
}
