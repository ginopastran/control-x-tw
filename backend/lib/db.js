const { PrismaClient } = require("@prisma/client");

// Configuración de Prisma para PostgreSQL/Neon
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Función para conectar a la base de datos
async function connectDB() {
  try {
    await prisma.$connect();
    console.log("✅ Conectado a PostgreSQL con Prisma");
    return prisma;
  } catch (error) {
    console.error("❌ Error conectando a PostgreSQL:", error);
    throw error;
  }
}

// Función para desconectar
async function disconnectDB() {
  try {
    await prisma.$disconnect();
    console.log("🔌 Desconectado de PostgreSQL");
  } catch (error) {
    console.error("❌ Error desconectando de PostgreSQL:", error);
  }
}

// Función para verificar la conexión
async function checkConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("❌ Error verificando conexión:", error);
    return false;
  }
}

// Manejo de cierre graceful
process.on("beforeExit", async () => {
  await disconnectDB();
});

process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  checkConnection,
};
