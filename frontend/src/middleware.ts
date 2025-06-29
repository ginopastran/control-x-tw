import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas que requieren autenticación de superadmin
const SUPERADMIN_ROUTES = ["/admin/users", "/admin/emails"];

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
];

// Rutas que requieren autenticación
const PROTECTED_ROUTES = [
  "/admin",
  "/accounts",
  "/tweets",
  "/dashboard",
  "/schedule",
  "/scheduler",
  "/api/accounts",
  "/api/tweets",
  "/api/authorized-emails",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug logging
  console.log("🔍 Middleware ejecutándose para:", pathname);

  // Manejar la página raíz "/"
  if (pathname === "/") {
    const token = request.cookies.get("auth_token")?.value;
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Verificar si la ruta es pública
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublicRoute) {
    console.log("✅ Ruta pública permitida:", pathname);
    return NextResponse.next();
  }

  // Verificar si es una ruta protegida
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (!isProtectedRoute) {
    console.log("⚪ Ruta no clasificada, permitiendo:", pathname);
    return NextResponse.next();
  }

  console.log("🔒 Verificando autenticación para ruta protegida:", pathname);

  // Obtener token de la cookie
  const token = request.cookies.get("auth_token")?.value;

  // Si no hay token en ruta protegida, redirigir al login
  if (!token) {
    console.log("❌ No hay token, redirigiendo a login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  console.log("✅ Token presente, permitiendo acceso a:", pathname);
  return NextResponse.next();
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
