import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

// Rutas que requieren autenticación de superadmin
const SUPERADMIN_ROUTES = ["/admin/users"];

// Rutas públicas (no requieren autenticación)
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/logout",
  "/debug-auth",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/",
];

// Rutas que requieren autenticación
const PROTECTED_ROUTES = [
  "/admin",
  "/accounts",
  "/tweets",
  "/dashboard",
  "/scheduler",
  "/api/accounts",
  "/api/tweets",
  "/api/authorized-emails",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug logging (solo en desarrollo)
  if (process.env.NODE_ENV === "development") {
    console.log("🔍 Middleware ejecutándose para:", pathname);
  }

  // Verificar si la ruta es pública
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Ruta pública permitida:", pathname);
    }
    return NextResponse.next();
  }

  // Verificar si es una ruta protegida
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    if (process.env.NODE_ENV === "development") {
      console.log("⚪ Ruta no protegida:", pathname);
    }
    return NextResponse.next();
  }

  if (process.env.NODE_ENV === "development") {
    console.log("🔒 Verificando autenticación para ruta protegida:", pathname);
  }

  // Obtener token de la cookie
  const token = request.cookies.get("auth_token")?.value;

  // Si no hay token en ruta protegida, redirigir al login y limpiar cookies completamente
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      console.log("❌ No hay token, redirigiendo a login");
    }

    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);

    // Eliminar cualquier cookie de autenticación
    response.cookies.delete("auth_token");

    // Headers para prevenir caché
    response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  }

  // Verificar el token
  const payload = verifyToken(token);

  // Si el token no es válido, redirigir al login y limpiar cookies
  if (!payload) {
    if (process.env.NODE_ENV === "development") {
      console.log("❌ Token inválido, redirigiendo a login");
    }

    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);

    // Eliminar cualquier cookie de autenticación
    response.cookies.delete("auth_token");

    // Headers para prevenir caché y limpiar datos
    response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "✅ Usuario autenticado:",
      payload.email,
      "Role:",
      payload.role
    );
  }

  // Verificar permisos para rutas de superadmin
  if (
    SUPERADMIN_ROUTES.some((route) => pathname.startsWith(route)) &&
    payload.role !== "SUPERADMIN"
  ) {
    if (process.env.NODE_ENV === "development") {
      console.log("⚠️ Acceso denegado a ruta SUPERADMIN");
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Verificar que solo ADMIN y SUPERADMIN puedan acceder a rutas protegidas
  if (!["ADMIN", "SUPERADMIN"].includes(payload.role)) {
    if (process.env.NODE_ENV === "development") {
      console.log("❌ Rol insuficiente, redirigiendo a login");
    }

    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);

    // Eliminar cookie de autenticación
    response.cookies.delete("auth_token");

    // Headers para prevenir caché
    response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  }

  // Agregar headers de seguridad para páginas autenticadas
  const response = NextResponse.next();

  // Prevenir caching de páginas protegidas
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export const config = {
  matcher: [
    /*
     * Excluir rutas específicas:
     * - archivos estáticos (_next)
     * - archivos de recursos (imágenes, etc.)
     * - favicon
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)",
  ],
};
