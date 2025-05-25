import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

const CLIENT_ID = process.env.X_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/auth/x/callback` 
  : "http://localhost:3000/api/auth/x/callback";

// Alcances/permisos necesarios para la API de X
const SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
  "like.write",
  "follows.write",
];

// Función para generar un desafío PKCE
function generatePKCE() {
  // Generar un verifier aleatorio
  const verifier = randomBytes(32).toString('base64url');
  
  // Generar el challenge con SHA-256
  const challenge = createHash('sha256')
    .update(verifier)
    .digest('base64url');
    
  return { verifier, challenge };
}

export async function GET() {
  try {
    // Generar un estado aleatorio más largo para mayor seguridad
    const state = randomBytes(32).toString("hex");
    
    // Generar PKCE para mayor seguridad
    const { verifier, challenge } = generatePKCE();

    // Crear la URL de autorización con todos los parámetros necesarios
    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("scope", SCOPES.join(" "));
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("code_challenge_method", "S256");
    authUrl.searchParams.append("code_challenge", challenge);

    console.log(`Iniciando autenticación con X: Redirección a ${authUrl.hostname}`);

    // Crear la respuesta con la redirección
    const response = NextResponse.redirect(authUrl.toString());
    
    // Configurar las cookies con opciones más seguras
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 15, // 15 minutos
      domain: process.env.COOKIE_DOMAIN || undefined
    };

    // Limpiar cookies existentes primero
    response.cookies.delete("oauth_state");
    response.cookies.delete("code_verifier");

    // Establecer las nuevas cookies
    response.cookies.set({
      name: "oauth_state",
      value: state,
      ...cookieOptions
    });

    response.cookies.set({
      name: "code_verifier",
      value: verifier,
      ...cookieOptions
    });

    return response;
  } catch (error) {
    console.error("Error al iniciar autenticación con X:", error);
    return NextResponse.redirect(new URL("/error?message=Error+al+iniciar+autenticacion", REDIRECT_URI));
  }
} 