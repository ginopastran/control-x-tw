import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { invalidateToken } from "@/services/tokenService";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const accountId = params.id;

    if (!accountId) {
      return NextResponse.json(
        { error: "ID de cuenta requerido" },
        { status: 400 }
      );
    }

    // Invalidar el token
    await invalidateToken(accountId);

    return NextResponse.json({
      success: true,
      message: "Token invalidado. La cuenta necesitará re-autenticación.",
      accountId,
    });
  } catch (error: any) {
    console.error("Error al invalidar token:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
