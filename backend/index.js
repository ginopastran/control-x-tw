// Archivo de producción migrado completamente a Prisma + PostgreSQL
// Reemplaza index.js una vez que se completa la migración

require("dotenv").config();
const express = require("express");
const { TwitterApi } = require("twitter-api-v2");
const cron = require("node-cron");
const multer = require("multer");
const csv = require("csv-parse/sync");
const jwt = require("jsonwebtoken");

// Importar configuración CORS
const { corsMiddleware, logCorsConfig } = require("./src/config/cors");

// Importar cliente de Prisma (configuración simplificada)
const { PrismaClient } = require("@prisma/client");

// Verificar que DATABASE_URL esté definido
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL no está definido en las variables de entorno.");
  process.exit(1);
}

// Inicializar Prisma sin adaptador personalizado (para probar la conexión básica)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

// Importar utilidades OAuth
const {
  generateOAuth1Signature,
  generateOAuth1Headers,
} = require("./utils/oauth1Helper");

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

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const userRole = req.user.role;
    const normalizedUserRole = userRole.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map((role) =>
      role.toLowerCase()
    );

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({
        error: "Acceso denegado",
        requiredRoles: allowedRoles,
        userRole: userRole,
      });
    }

    next();
  };
};

// ========== SISTEMA DE COLAS ==========

const actionQueue = [];
const runningActions = new Set();
const actionHistory = [];
const scheduledActions = [];
const lastActionTimes = {};
const MAX_HISTORY_SIZE = 100;

const generateActionId = () =>
  `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Función para agregar al historial usando Prisma
const addToHistory = async (actionInfo) => {
  // Actualizar en memoria para consultas rápidas
  const existingIndex = actionHistory.findIndex((a) => a.id === actionInfo.id);
  if (existingIndex !== -1) {
    actionHistory[existingIndex] = {
      ...actionHistory[existingIndex],
      ...actionInfo,
    };
  } else {
    actionHistory.unshift(actionInfo);
    if (actionHistory.length > MAX_HISTORY_SIZE) {
      actionHistory.pop();
    }
  }

  // Guardar en PostgreSQL usando Prisma
  try {
    if (!actionInfo.accountId) {
      console.error("❌ ERROR: accountId faltante en actionInfo:", actionInfo);
      return;
    }

    const updateData = {
      accountId: actionInfo.accountId,
      username: actionInfo.username,
      accountLabels: actionInfo.accountLabels || [],
      action: actionInfo.action,
      text: actionInfo.text,
      tweetId: actionInfo.tweetId,
      targetUserId: actionInfo.targetUserId,
      status: actionInfo.status,
      success: actionInfo.success || false,
      baseDelay: actionInfo.baseDelay,
      randomDelay: actionInfo.randomDelay,
      actualDelay: actionInfo.actualDelay,
      result: actionInfo.result,
      error: actionInfo.error,
      errorCode: actionInfo.errorCode,
      batchId: actionInfo.batchId,
    };

    // Agregar timestamps
    if (actionInfo.createdAt) {
      updateData.createdAt = new Date(actionInfo.createdAt);
    }
    if (actionInfo.startedAt) {
      updateData.startedAt = new Date(actionInfo.startedAt);
    }
    if (actionInfo.completedAt) {
      updateData.completedAt = new Date(actionInfo.completedAt);
    }

    // Usar upsert de Prisma para crear o actualizar
    await prisma.actionHistory.upsert({
      where: { actionId: actionInfo.id },
      update: updateData,
      create: {
        actionId: actionInfo.id,
        ...updateData,
        createdAt: actionInfo.createdAt
          ? new Date(actionInfo.createdAt)
          : new Date(),
      },
    });

    console.log("✅ Acción guardada en historial con Prisma:", actionInfo.id);
  } catch (error) {
    console.error("Error guardando acción en historial con Prisma:", error);
  }
};

const app = express();
app.use(express.json());
app.use(corsMiddleware);

const PORT = process.env.PORT || 3001;

// Verificar conexión a Prisma al iniciar
(async () => {
  try {
    console.log("🔄 Intentando conectar a PostgreSQL con Prisma...");
    console.log(
      "📍 URL de conexión:",
      connectionString ? "✅ Configurada" : "❌ Faltante"
    );

    // Probar la conexión
    await prisma.$connect();

    // Hacer una consulta simple para verificar que funciona
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Conexión a PostgreSQL exitosa:", result);

    console.log("✅ Prisma conectado exitosamente a Neon PostgreSQL");
    logCorsConfig();
  } catch (err) {
    console.error("❌ Error al conectar a PostgreSQL:");
    console.error("- Mensaje:", err.message);
    console.error("- Código:", err.code);
    console.error("- Stack:", err.stack);

    // No terminar el proceso, permitir que el servidor se inicie
    console.log("⚠️ Continuando sin conexión a BD...");
  }
})();

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

// ========== ENDPOINTS PRINCIPALES ==========

app.get("/", (req, res) => {
  res.send("Backend Express con Prisma + PostgreSQL funcionando!");
});

// Endpoint para verificar estado de la BD
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

// Endpoint para obtener todas las cuentas (Prisma)
app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await prisma.xAccount.findMany({
      select: {
        id: true,
        username: true,
        labels: true,
        isActive: true,
        status: true,
        lastActivity: true,
        metrics: true,
        dailyLimits: true,
      },
      orderBy: { username: "asc" },
    });

    res.json(accounts);
  } catch (error) {
    console.error("Error obteniendo cuentas con Prisma:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    });
  }
});

// Endpoint principal para acciones de Twitter (Prisma)
app.post("/api/tweets", async (req, res) => {
  try {
    const { accountId, action, text, tweetId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: "accountId es requerido" });
    }

    if (!action) {
      return res.status(400).json({ error: "action es requerido" });
    }

    // Validar cuenta usando Prisma
    const account = await prisma.xAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    // Crear objeto de acción para la cola
    const actionObj = {
      id: generateActionId(),
      accountId,
      action,
      text,
      tweetId,
      account: account,
      accountUsername: account.username,
      createdAt: new Date().toISOString(),
      estimatedStartTime: new Date(
        Date.now() + actionQueue.length * 60000
      ).toISOString(),
      status: "queued",
      baseDelay: 30000,
      randomDelay: 0,
    };

    actionQueue.push(actionObj);
    console.log(
      `📝 Acción ${actionObj.id} añadida a la cola: ${action} para @${account.username}`
    );

    res.json({
      success: true,
      message: "Acción añadida a la cola exitosamente",
      actionId: actionObj.id,
      queuePosition: actionQueue.length,
      estimatedStartTime: actionObj.estimatedStartTime,
    });
  } catch (error) {
    console.error("Error en /api/tweets con Prisma:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// ========== KEEP-ALIVE ==========

app.get("/api/keepalive", (req, res) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  console.log("🔄 Keep-Alive endpoint llamado");
  res.status(200).json({
    status: "alive",
    timestamp,
    uptime,
    message: "Backend activo con Prisma + PostgreSQL + Neon",
  });
});

// ========== INICIAR SERVIDOR ==========

app.listen(PORT, () => {
  console.log(
    `🚀 Servidor funcionando en puerto ${PORT} con Prisma + PostgreSQL + Neon`
  );
});

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
