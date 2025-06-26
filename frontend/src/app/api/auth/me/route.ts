import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Debug: log todas las cookies
    const allCookies = req.cookies.getAll();
    console.log("🍪 Todas las cookies:", allCookies);

    // Intentar obtener token de múltiples fuentes
    let token = req.cookies.get("auth_token")?.value;

    // Debug: log del token
    console.log("🔑 Cookie de auth:", token ? "Token presente" : "undefined");

    // Si no hay token en cookies, intentar desde Authorization header
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
        console.log("🔑 Token desde header Authorization");
      }
    }

    if (!token) {
      console.log("❌ No se encontró token en cookies ni headers");
      return NextResponse.json({ user: null });
    }

    // ✅ VERIFICAR EL TOKEN DIRECTAMENTE (no usar getTokenPayload sin parámetros)
    const payload = await verifyToken(token);

    if (!payload) {
      console.log("❌ Token inválido");
      return NextResponse.json({ user: null });
    }

    console.log("✅ Usuario autenticado:", payload.email);

    return NextResponse.json({
      user: {
        id: payload.id,
        name: payload.name || payload.email, // Fallback al email si no hay name
        email: payload.email,
        role: payload.role,
      },
    });
  } catch (error) {
    console.error("❌ Error en /api/auth/me:", error);
    return NextResponse.json({ user: null });
  }
}
