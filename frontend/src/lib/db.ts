import { PrismaClient } from "@prisma/client";

// Simple approach without adapter for now
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

// Funciones de utilidad para compatibilidad
export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL conectado exitosamente con Neon");
    return true;
  } catch (error) {
    console.error("❌ Error al conectar a PostgreSQL:", error);
    throw error;
  }
};

export const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log("✅ Desconectado de PostgreSQL");
  } catch (error) {
    console.error("❌ Error al desconectar de PostgreSQL:", error);
  }
};
