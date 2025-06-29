import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/debug/accounts`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Pasar cookies de autenticación
        Cookie: request.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching debug accounts:", error);
    return NextResponse.json(
      { error: "Error connecting to backend" },
      { status: 500 }
    );
  }
}
