// app/api/auth/x/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { logError } from "@/lib/log-action";
import TokenInfo from "@/models/TokenInfo";

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/auth/x/callback` 
  : "http://localhost:3000/api/auth/x/callback";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Obtener estado y verificador guardados en cookies
    const savedState = req.cookies.get("oauth_state")?.value;
    const codeVerifier = req.cookies.get("code_verifier")?.value;

    // Configuración de cookies para eliminarlas
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      domain: process.env.COOKIE_DOMAIN || undefined
    };

    // Función para crear respuesta con cookies limpias
    const createResponse = (url: string) => {
      const response = NextResponse.redirect(url);
      response.cookies.delete("oauth_state", cookieOptions);
      response.cookies.delete("code_verifier", cookieOptions);
      return response;
    };

    // Verificar si hay error en la respuesta de X
    if (error) {
      console.error(`Error de autenticación de X: ${error} - ${errorDescription}`);
      return createResponse(
        new URL(`/error?message=${encodeURIComponent(`Error de X: ${errorDescription || error}`)}`, req.url).toString()
      );
    }

    // Verificar parámetros obligatorios
    if (!code) {
      return createResponse(
        new URL("/error?message=No+se+recibió+el+código+de+autorización", req.url).toString()
      );
    }

    // Verificar el estado CSRF
    if (!state || !savedState) {
      console.error("Error de estado CSRF:", { 
        receivedState: state, 
        hasSavedState: !!savedState 
      });
      return createResponse(
        new URL("/error?message=Error+de+autenticación:+Estado+no+encontrado", req.url).toString()
      );
    }

    if (state !== savedState) {
      console.error("Error de coincidencia de estado CSRF:", {
        receivedState: state,
        savedState: savedState
      });
      return createResponse(
        new URL("/error?message=Error+de+autenticación:+Estado+inválido", req.url).toString()
      );
    }

    if (!codeVerifier) {
      return createResponse(
        new URL("/error?message=Error+de+autenticación:+Verificador+no+encontrado", req.url).toString()
      );
    }

    console.log("Código de autorización recibido, intercambiando por tokens...");

    // Preparar la solicitud para intercambiar el código por tokens
    const tokenRequest = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    });

    // Usar Authorization Basic para mayor seguridad
    const authHeader = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;

    // Intercambiar el code por tokens
    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": authHeader,
      },
      body: tokenRequest,
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Error al obtener token:", tokenData);
      return createResponse(
        new URL(`/error?message=${encodeURIComponent(`Error al obtener token: ${tokenData.error_description || tokenData.error}`)}`, req.url).toString()
      );
    }

    // Verificar que recibimos los tokens necesarios
    if (!tokenData.access_token) {
      console.error("Access token no recibido:", tokenData);
      return createResponse(
        new URL("/error?message=No+se+recibió+el+token+de+acceso", req.url).toString()
      );
    }

    console.log("Tokens obtenidos, recuperando información del usuario...");

    // Obtener información del usuario
    const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Error al obtener información del usuario:", userData);
      return createResponse(
        new URL("/error?message=Error+al+obtener+información+del+usuario", req.url).toString()
      );
    }

    // Conectar a la base de datos y guardar/actualizar la cuenta
    await connectDB();
    
    const existingAccount = await XAccount.findOne({ userId: userData.data.id });
    
    if (existingAccount) {
      // Actualizar tokens de la cuenta existente
      existingAccount.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        existingAccount.refreshToken = tokenData.refresh_token;
      }
      await existingAccount.save();

      // Crear o actualizar información del token
      await TokenInfo.findOneAndUpdate(
        { accountId: existingAccount._id },
        {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || existingAccount.refreshToken,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas
          lastRefresh: new Date(),
          isValid: true
        },
        { upsert: true }
      );
      
      return createResponse(new URL("/accounts?success=Cuenta+actualizada", req.url).toString());
    } else {
      // Crear nueva cuenta
      const newAccount = await XAccount.create({
        username: userData.data.username,
        userId: userData.data.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || "",
        developerTag: "api_v2",
        labels: ["default"],
      });

      // Crear información del token
      await TokenInfo.create({
        accountId: newAccount._id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || "",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas
        lastRefresh: new Date(),
        isValid: true
      });
      
      return createResponse(new URL("/accounts?success=Cuenta+conectada", req.url).toString());
    }
  } catch (error: any) {
    console.error("Error en el proceso de autenticación:", error);
    return NextResponse.redirect(
      new URL(`/error?message=${encodeURIComponent(`Error: ${error.message || 'Error desconocido'}`)}`, req.url)
    );
  }
}
