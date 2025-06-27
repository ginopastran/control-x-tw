require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const multer = require("multer");
const jwt = require("jsonwebtoken");

// Importar configuración CORS
const { corsMiddleware, logCorsConfig } = require("./src/config/cors");

// Importar cliente de Prisma
const { PrismaClient } = require("@prisma/client");

// Importar servicios
const QueueService = require("./src/services/queueService");
const HistoryService = require("./src/services/historyService");
const AccountService = require("./src/services/accountService");
const CampaignService = require("./src/services/campaignService");

// Importar controladores
const AccountController = require("./src/controllers/accountController");

// Importar rutas
const createQueueRoutes = require("./src/routes/queueRoutes");
const createHistoryRoutes = require("./src/routes/historyRoutes");

// Importar rutas adicionales
const createAdditionalRoutes = require("./src/routes/additionalRoutes");

// Verificar que DATABASE_URL esté definido
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL no está definido en las variables de entorno.");
  process.exit(1);
}

// Inicializar Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
  // 🔥 CONFIGURACIÓN DE LOGGING SIMPLIFICADA - Solo errores críticos
  log:
    process.env.NODE_ENV === "development"
      ? ["error"] // Solo errores en desarrollo
      : [], // Sin logs en producción
});

// Inicializar servicios
const queueService = new QueueService(prisma);
const historyService = new HistoryService(prisma);
const accountService = new AccountService(prisma);
const campaignService = new CampaignService(prisma, queueService);

// Inicializar controladores
const accountController = new AccountController(accountService);

const app = express();
app.use(express.json());
app.use(corsMiddleware);

const PORT = process.env.PORT || 3001;

// ========== MIDDLEWARES DE AUTENTICACIÓN ==========
const JWT_SECRET = process.env.JWT_SECRET || "jwt_super_secret_key_control_x";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  const cookieToken = req.headers.cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("auth_token="))
    ?.split("=")[1];

  const finalToken = token || cookieToken;

  if (!finalToken) {
    return res.status(401).json({ error: "Token de acceso requerido" });
  }

  jwt.verify(finalToken, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" });
    }
    req.user = user;
    next();
  });
};

// ========== CONFIGURACIÓN MULTER ==========
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.originalname.toLowerCase().endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos CSV"), false);
    }
  },
});

// ========== VERIFICAR CONEXIÓN A BD ==========
(async () => {
  try {
    console.log("🔄 Intentando conectar a PostgreSQL con Prisma...");
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Conexión a PostgreSQL exitosa:", result);
    logCorsConfig();
  } catch (err) {
    console.error("❌ Error al conectar a PostgreSQL:", err.message);
    console.log("⚠️ Continuando sin conexión a BD...");
  }
})();

// ========== RUTAS PRINCIPALES ==========
app.get("/", (req, res) => {
  res.send("Backend Express con Prisma + PostgreSQL funcionando!");
});

app.get("/api/keepalive", (req, res) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  res.status(200).json({
    status: "alive",
    timestamp,
    uptime,
    message: "Backend activo con Prisma + PostgreSQL + Neon",
  });
});

app.get("/api/db-status", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
    res.json({
      status: "connected",
      database: "PostgreSQL",
      timestamp: result[0].current_time,
      message: "Conexión a base de datos exitosa",
    });
  } catch (error) {
    console.error("Error verificando estado de BD:", error);
    res.status(500).json({
      status: "error",
      database: "PostgreSQL",
      error: error.message,
      message: "Error de conexión a base de datos",
    });
  }
});

// ========== RUTAS DE CUENTAS ==========
app.get(
  "/api/accounts",
  accountController.getAllAccounts.bind(accountController)
);
app.get(
  "/api/accounts/:id",
  accountController.getAccountById.bind(accountController)
);
app.put(
  "/api/accounts/:id",
  accountController.updateAccount.bind(accountController)
);
app.post(
  "/api/accounts/enable-for-mutual-follow",
  accountController.enableForMutualFollow.bind(accountController)
);
app.post(
  "/api/test/create-sample-accounts",
  accountController.createSampleAccounts.bind(accountController)
);

// ========== USAR RUTAS MODULARES ==========
app.use("/api/queue", createQueueRoutes(queueService, prisma));
app.use("/api/history", createHistoryRoutes(historyService, prisma));
app.use(
  "/api",
  createAdditionalRoutes(queueService, historyService, accountService, prisma)
);

// ========== RUTAS DE CAMPAÑA ==========
app.get("/api/mutual-follow-campaign", async (req, res) => {
  try {
    console.log(
      "📡 GET /api/mutual-follow-campaign - Obteniendo estado de campaña"
    );
    const status = await campaignService.getCampaignStatus();
    console.log("✅ Estado de campaña obtenido:", status);

    // Asegurar que siempre devolvemos un JSON válido
    res.setHeader("Content-Type", "application/json");
    res.json(status);
  } catch (error) {
    console.error("❌ Error obteniendo estado de campaña:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({
      error: error.message || "Error interno del servidor",
      isRunning: false,
      campaign: null,
    });
  }
});

app.post("/api/mutual-follow-campaign", async (req, res) => {
  try {
    console.log("🚀 POST /api/mutual-follow-campaign - Iniciando campaña");
    console.log("📋 Body recibido:", req.body);

    const campaign = await campaignService.startMutualFollowCampaign();

    const response = {
      success: true,
      message: `Campaña de follow mutuo iniciada con ${campaign.progress.total} acciones programadas durante 5 días`,
      campaign,
      stats: {
        totalAccounts: campaign.accounts,
        totalActions: campaign.progress.total,
        durationDays: campaign.durationDays || 5,
        dailyLimit: campaign.dailyLimit || 40,
      },
    };

    console.log("✅ Campaña iniciada exitosamente:", response);

    res.setHeader("Content-Type", "application/json");
    res.json(response);
  } catch (error) {
    console.error("❌ Error iniciando campaña:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
      details:
        "Verifique que haya al menos 2 cuentas con credenciales verificadas",
    });
  }
});

app.delete("/api/mutual-follow-campaign", async (req, res) => {
  try {
    console.log("🛑 DELETE /api/mutual-follow-campaign - Cancelando campaña");

    const result = await campaignService.cancelCampaign();

    const response = {
      success: true,
      message: "Campaña de follow mutuo cancelada exitosamente",
      canceledActions: result.canceledActions,
      timestamp: new Date().toISOString(),
    };

    console.log("✅ Campaña cancelada exitosamente:", response);

    res.setHeader("Content-Type", "application/json");
    res.json(response);
  } catch (error) {
    console.error("❌ Error cancelando campaña:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
    });
  }
});

// Esperar a que se inicialice desde la BD antes de empezar el procesamiento
async function startServer() {
  try {
    // Inicializar el queue service desde la base de datos
    await queueService.initializeFromDatabase();

    // Iniciar el procesamiento de la cola
    setInterval(() => {
      queueService.processScheduledActions();
      queueService.processQueue();
    }, 5000);

    // Iniciar el servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
      console.log(`📊 Estado inicial de la cola restaurado desde BD`);
    });
  } catch (error) {
    console.error("Error iniciando el servidor:", error);
    process.exit(1);
  }
}

startServer();

// Cerrar conexión de Prisma al terminar
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit();
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit();
});
