import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

// Rutas que requieren autenticación de superadmin
const SUPERADMIN_ROUTES = ["/admin/users"];

// Rutas públicas (no requieren autenticación)
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verificar si la ruta es pública
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Obtener token de la cookie
  const token = request.cookies.get("auth_token")?.value;

  // Si no hay token, redirigir al login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verificar el token
  const payload = verifyToken(token);

  // Si el token no es válido, redirigir al login
  if (!payload) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth_token");
    return response;
  }

  // Verificar permisos para rutas de superadmin
  if (
    SUPERADMIN_ROUTES.some((route) => pathname.startsWith(route)) &&
    payload.role !== "SUPERADMIN"
  ) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Verificar que solo ADMIN y SUPERADMIN puedan acceder a rutas protegidas
  if (!["ADMIN", "SUPERADMIN"].includes(payload.role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Excluir rutas específicas:
     * - archivos estáticos (_next)
     * - archivos de recursos (imágenes, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)",
  ],
};
