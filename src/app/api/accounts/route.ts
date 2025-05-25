// app/api/accounts/route.ts
import { connectDB } from "@/lib/mongodb";
import XAccount from "@/models/XAccount";
import { NextResponse, NextRequest } from "next/server";

// GET: listar todas las cuentas
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    // Obtener todas las cuentas de X ordenadas por fecha de creación (más recientes primero)
    const accounts = await XAccount.find({})
      .sort({ createdAt: -1 })
      .lean();
    
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error al obtener cuentas:", error);
    return NextResponse.json(
      { error: "Error al obtener las cuentas" },
      { status: 500 }
    );
  }
}

// POST: agregar una nueva cuenta
export async function POST(request: Request) {
  await connectDB();
  const body = await request.json();

  const newAccount = await XAccount.create({
    username: body.username,
    userId: body.userId,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken || "",
    developerTag: body.developerTag,
    labels: body.labels || [],
  });

  return NextResponse.json(newAccount);
}
