import { NextResponse } from "next/server";

// Endpoint de prueba para verificar la API
export async function GET() {
  console.log("Endpoint de prueba accedido correctamente");
  
  return NextResponse.json({
    success: true,
    message: "API funcionando correctamente",
    timestamp: new Date().toISOString()
  });
} 