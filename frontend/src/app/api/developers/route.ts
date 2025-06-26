// app/api/developers/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET: listar cuentas desarrollador
export async function GET() {
  try {
    const devAccounts = await prisma.developerAccount.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(devAccounts);
  } catch (error) {
    console.error("Error al obtener cuentas de desarrollador:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST: agregar cuenta desarrollador
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newDev = await prisma.developerAccount.create({
      data: {
        name: body.name,
        apiKey: body.apiKey || "",
        apiSecret: body.apiSecret || "",
        bearerToken: body.bearerToken || "",
        clientId: body.clientId || "",
        clientSecret: body.clientSecret || "",
        labels: body.labels || [],
      },
    });

    return NextResponse.json(newDev);
  } catch (error) {
    console.error("Error al crear cuenta de desarrollador:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
