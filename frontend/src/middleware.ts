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

  // Debug logging (solo en desarrollo)
  if (process.env.NODE_ENV === "development") {
    console.log("🔍 Middleware ejecutándose para:", pathname);
  }

  // Manejar la página raíz "/"
  if (pathname === "/") {
    const token = request.cookies.get("auth_token")?.value;

    if (token) {
      // Si hay token, redirigir a dashboard
      if (process.env.NODE_ENV === "development") {
        console.log("🏠 Redirigiendo desde / a /dashboard (usuario logueado)");
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      // Si no hay token, redirigir a login
      if (process.env.NODE_ENV === "development") {
        console.log("🏠 Redirigiendo desde / a /login (usuario no logueado)");
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Verificar si la ruta es pública PRIMERO
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublicRoute) {
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Ruta pública permitida:", pathname);
    }
    return NextResponse.next();
  }

  // Verificar si es una ruta protegida
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (!isProtectedRoute) {
    if (process.env.NODE_ENV === "development") {
      console.log("⚪ Ruta no clasificada, permitiendo:", pathname);
    }
    return NextResponse.next();
  }

  if (process.env.NODE_ENV === "development") {
    console.log("🔒 Verificando autenticación para ruta protegida:", pathname);
  }

  // Obtener token de la cookie
  const token = request.cookies.get("auth_token")?.value;

  // Si no hay token en ruta protegida, redirigir al login
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      console.log("❌ No hay token, redirigiendo a login");
    }

    const loginUrl = new URL("/login", request.url);
    // Agregar parámetro de redirección
    loginUrl.searchParams.set("from", pathname);

    const response = NextResponse.redirect(loginUrl, { status: 303 });

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

  // Para rutas protegidas, simplemente verificamos que el token existe
  // La verificación completa se hará en las páginas/APIs individuales
  if (process.env.NODE_ENV === "development") {
    console.log("✅ Token presente, permitiendo acceso a:", pathname);
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
