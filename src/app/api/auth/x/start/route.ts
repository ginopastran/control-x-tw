import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: "http://localhost:3000/api/auth/x/callback",
    scope: "tweet.read tweet.write users.read offline.access",
    state: "xyz123"
    // SACAMOS code_challenge
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  console.log("🔗 Redirigiendo a:", authUrl);
  return NextResponse.redirect(authUrl, { status: 302 });
}
