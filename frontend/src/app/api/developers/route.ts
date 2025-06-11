// app/api/developers/route.ts
import { connectDB } from "../lib/mongodb";
import DeveloperAccount from "../../../models/DeveloperAccount";
import { NextResponse } from "next/server";

// GET: listar cuentas desarrollador
export async function GET() {
  await connectDB();
  const devAccounts = await DeveloperAccount.find();
  return NextResponse.json(devAccounts);
}

// POST: agregar cuenta desarrollador
export async function POST(request: Request) {
  await connectDB();
  const body = await request.json();

  const newDev = await DeveloperAccount.create({
    name: body.name,
    apiKey: body.apiKey,
    apiSecret: body.apiSecret,
    bearerToken: body.bearerToken,
    clientId: body.clientId || "",
    clientSecret: body.clientSecret || "",
    labels: body.labels || []
  });

  return NextResponse.json(newDev);
}
