import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Crear URL de redirección al login
    const loginUrl = new URL("/login", req.url);

    // Crear respuesta de redirección (303 es mejor para redirects después de POST)
    const response = NextResponse.redirect(loginUrl, { status: 303 });

    // Eliminar múltiples variaciones de cookies de autenticación
    const cookieNames = ["auth_token", "authToken", "token", "session"];

    for (const cookieName of cookieNames) {
      response.cookies.delete(cookieName);
      response.cookies.set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
        path: "/",
        sameSite: "lax",
      });

      // También eliminar para otros paths
      response.cookies.set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
        path: "/admin",
        sameSite: "lax",
      });

      response.cookies.set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
        path: "/accounts",
        sameSite: "lax",
      });
    }

    // Headers para limpiar completamente el caché y datos
    response.headers.set(
      "Clear-Site-Data",
      '"cache", "cookies", "storage", "executionContexts"'
    );
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private, max-age=0, s-maxage=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "Thu, 01 Jan 1970 00:00:00 GMT");
    response.headers.set("Vary", "Cookie, Authorization");
    response.headers.set("X-Accel-Expires", "0");

    return response;
  } catch (error: any) {
    console.error("Error al procesar logout:", error);

    // En caso de error, aún así redirigir y limpiar
    const loginUrl = new URL("/login", req.url);
    const response = NextResponse.redirect(loginUrl, { status: 303 });

    response.cookies.delete("auth_token");
    response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');

    return response;
  }
}
