import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Definimos la interfaz para el payload del token
export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

// Clave secreta para firmar el token
const JWT_SECRET = process.env.JWT_SECRET || "jwt_super_secret_key_control_x";

// Duración del token: 7 días
const TOKEN_EXPIRATION = "7d";

// Generar token JWT
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
}

// Verificar token JWT
export function verifyToken(token: string): TokenPayload | null {
  try {
    // Debug: log del token (solo en desarrollo)
    if (process.env.NODE_ENV === "development") {
      console.log("Verificando token:", token ? "Token presente" : "No token");
    }

    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;

    if (process.env.NODE_ENV === "development") {
      console.log("Token válido para usuario:", payload.email);
    }

    return payload;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "Token inválido:",
        error instanceof Error ? error.message : "Error desconocido"
      );
    }
    return null;
  }
}

// Establecer cookie con el token en server action o API route
export function setAuthCookieInResponse(
  res: NextResponse,
  token: string
): NextResponse {
  res.cookies.set({
    name: "auth_token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 días en segundos
    path: "/",
    sameSite: "lax",
  });
  return res;
}

// Eliminar cookie de autenticación en server action o API route
export function removeAuthCookieInResponse(res: NextResponse): NextResponse {
  res.cookies.delete("auth_token");
  return res;
}

// Obtener token de una solicitud
export function getTokenFromRequest(req: NextRequest): string | null {
  const token = req.cookies.get("auth_token")?.value;
  return token || null;
}

// Obtener token de la cookie (solo para componentes de servidor)
export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("auth_token")?.value;
}

// Obtener payload del token desde las cookies (solo para componentes de servidor)
export async function getTokenPayload(): Promise<TokenPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}

// Verificar si el usuario tiene el rol requerido (solo para componentes de servidor)
export async function hasRole(
  requiredRole: string | string[]
): Promise<boolean> {
  const payload = await getTokenPayload();
  if (!payload) return false;

  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(payload.role);
  }

  return payload.role === requiredRole;
}

// Verificar si el usuario es SUPERADMIN (solo para componentes de servidor)
export async function isSuperAdmin(): Promise<boolean> {
  return await hasRole("SUPERADMIN");
}

// Verificar si el usuario es ADMIN (solo para componentes de servidor)
export async function isAdmin(): Promise<boolean> {
  return await hasRole(["ADMIN", "SUPERADMIN"]);
}

// Obtener usuario autenticado desde una NextRequest (para API routes)
export function getAuthUser(req: NextRequest): TokenPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}
