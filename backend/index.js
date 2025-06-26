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
      status: "QUEUED",
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

// ========== ENDPOINTS DE LA COLA ==========

// Endpoint para agregar acciones a la cola
app.post("/api/queue/add", async (req, res) => {
  try {
    const {
      action,
      accountIds,
      baseDelay,
      randomDelay,
      text,
      tweetId,
      targetUserId,
      scheduledTime,
    } = req.body;

    if (!action) {
      return res.status(400).json({ error: "action es requerido" });
    }

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res
        .status(400)
        .json({ error: "accountIds es requerido y debe ser un array" });
    }

    const actions = [];
    const batchId = `batch_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 6)}`;

    for (const accountId of accountIds) {
      // Validar cuenta
      const account = await prisma.xAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        console.warn(`⚠️ Cuenta ${accountId} no encontrada, saltando...`);
        continue;
      }

      // Crear objeto de acción
      const actionObj = {
        id: generateActionId(),
        accountId,
        action,
        text,
        tweetId,
        targetUserId,
        account: account,
        accountUsername: account.username,
        accountLabels: account.labels || [],
        createdAt: new Date().toISOString(),
        estimatedStartTime:
          scheduledTime ||
          new Date(Date.now() + actionQueue.length * 60000).toISOString(),
        status: "QUEUED",
        baseDelay: baseDelay || 30000,
        randomDelay: randomDelay || 0,
        batchId,
        scheduledTime,
      };

      if (scheduledTime) {
        scheduledActions.push(actionObj);
      } else {
        actionQueue.push(actionObj);
      }

      actions.push(actionObj);

      // Guardar en historial inmediatamente
      await addToHistory(actionObj);
    }

    console.log(
      `📝 ${actions.length} acciones añadidas${
        scheduledTime ? " (programadas)" : " a la cola"
      }`
    );

    res.json({
      success: true,
      message: `${actions.length} acciones ${
        scheduledTime ? "programadas" : "añadidas a la cola"
      } exitosamente`,
      actions: actions.map((a) => ({
        id: a.id,
        accountId: a.accountId,
        username: a.accountUsername,
        action: a.action,
        status: a.status,
        estimatedStartTime: a.estimatedStartTime,
      })),
      batchId,
    });
  } catch (error) {
    console.error("Error en /api/queue/add:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para obtener estado de la cola
app.get("/api/queue/status", async (req, res) => {
  try {
    const { historyPage = 1, historyLimit = 10 } = req.query;

    // Obtener historial reciente desde la base de datos
    const skip = (parseInt(historyPage) - 1) * parseInt(historyLimit);
    const recentHistory = await prisma.actionHistory.findMany({
      take: parseInt(historyLimit),
      skip: skip,
      orderBy: { createdAt: "desc" },
      include: {
        account: {
          select: {
            username: true,
            labels: true,
          },
        },
      },
    });

    const totalHistoryItems = await prisma.actionHistory.count();

    // Estadísticas
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await prisma.actionHistory.aggregate({
      where: {
        createdAt: { gte: today },
      },
      _count: {
        _all: true,
      },
    });

    const completedToday = await prisma.actionHistory.count({
      where: {
        createdAt: { gte: today },
        status: "COMPLETED",
      },
    });

    const failedToday = await prisma.actionHistory.count({
      where: {
        createdAt: { gte: today },
        status: "FAILED",
      },
    });

    res.json({
      queue: actionQueue.map((a) => ({
        id: a.id,
        accountId: a.accountId,
        accountUsername: a.accountUsername,
        action: a.action,
        text: a.text,
        status: a.status,
        createdAt: a.createdAt,
        estimatedStartTime: a.estimatedStartTime,
      })),
      running: Array.from(runningActions).map((a) => ({
        id: a.id,
        accountId: a.accountId,
        accountUsername: a.accountUsername,
        action: a.action,
        text: a.text,
        status: a.status,
        startedAt: a.startedAt,
      })),
      history: recentHistory.map((h) => ({
        id: h.actionId,
        accountId: h.accountId,
        username: h.username,
        action: h.action,
        text: h.text,
        status: h.status,
        success: h.success,
        createdAt: h.createdAt.toISOString(),
        completedAt: h.completedAt?.toISOString(),
        error: h.error,
      })),
      scheduled: scheduledActions.map((a) => ({
        id: a.id,
        accountId: a.accountId,
        accountUsername: a.accountUsername,
        action: a.action,
        text: a.text,
        scheduledTime: a.scheduledTime,
        status: a.status,
      })),
      stats: {
        queueLength: actionQueue.length,
        runningCount: runningActions.size,
        completedToday: completedToday,
        failedToday: failedToday,
        scheduled: scheduledActions.length,
      },
      totalHistoryItems,
    });
  } catch (error) {
    console.error("Error en /api/queue/status:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para cancelar acción
app.delete("/api/queue/cancel/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar en cola normal
    const queueIndex = actionQueue.findIndex((a) => a.id === id);
    if (queueIndex !== -1) {
      const action = actionQueue[queueIndex];
      actionQueue.splice(queueIndex, 1);

      // Actualizar historial
      action.status = "CANCELLED";
      action.completedAt = new Date().toISOString();
      await addToHistory(action);

      return res.json({ success: true, message: "Acción cancelada" });
    }

    // Buscar en acciones programadas
    const scheduledIndex = scheduledActions.findIndex((a) => a.id === id);
    if (scheduledIndex !== -1) {
      const action = scheduledActions[scheduledIndex];
      scheduledActions.splice(scheduledIndex, 1);

      // Actualizar historial
      action.status = "CANCELLED";
      action.completedAt = new Date().toISOString();
      await addToHistory(action);

      return res.json({
        success: true,
        message: "Acción programada cancelada",
      });
    }

    res.status(404).json({ error: "Acción no encontrada" });
  } catch (error) {
    console.error("Error en /api/queue/cancel:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// ========== ENDPOINTS DEL HISTORIAL ==========

// Endpoint para obtener historial con filtros
app.get("/api/history", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      action = "all",
      status = "all",
      account = "all",
      days = "7",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Construir filtros
    const where = {};

    // Filtro por fechas
    if (days !== "all") {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      where.createdAt = { gte: daysAgo };
    }

    // Filtro por acción
    if (action !== "all") {
      where.action = action;
    }

    // Filtro por estado
    if (status !== "all") {
      where.status = status.toUpperCase();
    }

    // Filtro por cuenta
    if (account !== "all") {
      where.username = { contains: account, mode: "insensitive" };
    }

    // Filtro por búsqueda
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { text: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ];
    }

    const [actions, total] = await Promise.all([
      prisma.actionHistory.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          account: {
            select: {
              username: true,
              labels: true,
            },
          },
        },
      }),
      prisma.actionHistory.count({ where }),
    ]);

    res.json({
      actions: actions.map((a) => ({
        _id: a.id,
        actionId: a.actionId,
        username: a.username,
        accountLabels: a.accountLabels,
        action: a.action,
        text: a.text,
        tweetId: a.tweetId,
        targetUserId: a.targetUserId,
        status: a.status,
        success: a.success,
        createdAt: a.createdAt.toISOString(),
        completedAt: a.completedAt?.toISOString(),
        error: a.error,
        batchId: a.batchId,
      })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / take),
    });
  } catch (error) {
    console.error("Error en /api/history:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para estadísticas del historial
app.get("/api/history/stats", async (req, res) => {
  try {
    const { days = "7" } = req.query;

    // Calcular fecha de inicio
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const where = {
      createdAt: { gte: startDate },
    };

    // Obtener estadísticas
    const [
      totalActions,
      successfulActions,
      failedActions,
      actionsByType,
      actionsByAccount,
    ] = await Promise.all([
      prisma.actionHistory.count({ where }),
      prisma.actionHistory.count({ where: { ...where, success: true } }),
      prisma.actionHistory.count({ where: { ...where, success: false } }),
      prisma.actionHistory.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        orderBy: { _count: { _all: "desc" } },
      }),
      prisma.actionHistory.groupBy({
        by: ["username"],
        where,
        _count: { _all: true },
        orderBy: { _count: { _all: "desc" } },
        take: 10,
      }),
    ]);

    res.json({
      period: `${days} días`,
      totalActions,
      successfulActions,
      failedActions,
      successRate:
        totalActions > 0
          ? ((successfulActions / totalActions) * 100).toFixed(1)
          : 0,
      actionsByType: actionsByType.map((a) => ({
        action: a.action,
        count: a._count._all,
      })),
      topAccounts: actionsByAccount.map((a) => ({
        username: a.username,
        count: a._count._all,
      })),
    });
  } catch (error) {
    console.error("Error en /api/history/stats:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para exportar historial
app.get("/api/history/export", async (req, res) => {
  try {
    const {
      action = "all",
      status = "all",
      account = "all",
      days = "7",
      format = "csv",
    } = req.query;

    // Usar los mismos filtros que el endpoint de historial
    const where = {};

    if (days !== "all") {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      where.createdAt = { gte: daysAgo };
    }

    if (action !== "all") {
      where.action = action;
    }

    if (status !== "all") {
      where.status = status.toUpperCase();
    }

    if (account !== "all") {
      where.username = { contains: account, mode: "insensitive" };
    }

    const actions = await prisma.actionHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000, // Límite de seguridad
    });

    if (format === "csv") {
      const csvHeader = "Fecha,Cuenta,Accion,Texto,Estado,Exito,Error,Lote\n";
      const csvRows = actions
        .map((a) => {
          const row = [
            a.createdAt.toISOString(),
            a.username,
            a.action,
            `"${(a.text || "").replace(/"/g, '""')}"`,
            a.status,
            a.success,
            `"${(a.error || "").replace(/"/g, '""')}"`,
            a.batchId || "",
          ];
          return row.join(",");
        })
        .join("\n");

      const csvContent = csvHeader + csvRows;

      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="historial-acciones-${
          new Date().toISOString().split("T")[0]
        }.csv"`,
      });

      return res.send(csvContent);
    }

    res.json({ actions });
  } catch (error) {
    console.error("Error en /api/history/export:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// ========== PROCESADOR DE COLA ==========

// Función para procesar la cola
const processQueue = async () => {
  if (actionQueue.length === 0 || runningActions.size >= 3) {
    return; // No hay acciones o ya hay muchas ejecutándose
  }

  const action = actionQueue.shift();
  if (!action) return;

  runningActions.add(action);
  action.status = "RUNNING";
  action.startedAt = new Date().toISOString();

  console.log(
    `🚀 Ejecutando acción: ${action.action} para @${action.accountUsername}`
  );

  try {
    // Actualizar historial
    await addToHistory(action);

    // Simular delay
    const actualDelay = action.baseDelay + Math.random() * action.randomDelay;
    action.actualDelay = actualDelay;

    await new Promise((resolve) => setTimeout(resolve, actualDelay));

    // Simular ejecución exitosa (aquí iría la lógica real de Twitter API)
    action.status = "COMPLETED";
    action.success = true;
    action.completedAt = new Date().toISOString();
    action.result = {
      id: `simulated_${Date.now()}`,
      success: true,
      message: `Acción ${action.action} ejecutada exitosamente`,
    };

    console.log(
      `✅ Acción completada: ${action.action} para @${action.accountUsername}`
    );
  } catch (error) {
    console.error(`❌ Error ejecutando acción: ${error.message}`);

    action.status = "FAILED";
    action.success = false;
    action.completedAt = new Date().toISOString();
    action.error = error.message;
  } finally {
    // Actualizar historial final
    await addToHistory(action);
    runningActions.delete(action);
  }
};

// Procesar acciones programadas
const processScheduledActions = async () => {
  const now = new Date();
  const readyActions = scheduledActions.filter(
    (action) => new Date(action.scheduledTime) <= now
  );

  for (const action of readyActions) {
    // Mover de programada a cola normal
    const index = scheduledActions.indexOf(action);
    scheduledActions.splice(index, 1);
    actionQueue.push(action);

    console.log(
      `⏰ Acción programada lista para ejecución: ${action.action} para @${action.accountUsername}`
    );
  }
};

// Ejecutar procesador cada 10 segundos
setInterval(() => {
  processScheduledActions();
  processQueueEnhanced();
}, 10000);

// Procesar inmediatamente al inicio
processQueueEnhanced();

// ========== ENDPOINTS ADICIONALES ==========

// Endpoint para límites de cuenta
app.get("/api/account-limits", async (req, res) => {
  try {
    const accounts = await prisma.xAccount.findMany({
      select: {
        id: true,
        username: true,
        status: true,
        isActive: true,
        lastActivity: true,
        dailyLimits: true,
        metrics: true,
      },
      orderBy: { username: "asc" },
    });

    const accountLimits = accounts.map((account) => ({
      id: account.id,
      username: account.username,
      status: account.isActive ? "active" : "suspended",
      lastActivity: account.lastActivity,
      limits: account.dailyLimits || {
        tweets: { used: 0, limit: 50 },
        retweets: { used: 0, limit: 100 },
        likes: { used: 0, limit: 1000 },
        follows: { used: 0, limit: 400 },
      },
      metrics: account.metrics || {},
    }));

    res.json(accountLimits);
  } catch (error) {
    console.error("Error obteniendo límites de cuenta:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para métricas en tiempo real
app.get("/api/metrics/realtime", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Obtener estadísticas del día
    const [totalToday, successToday, failedToday, queueLength] =
      await Promise.all([
        prisma.actionHistory.count({
          where: { createdAt: { gte: today } },
        }),
        prisma.actionHistory.count({
          where: {
            createdAt: { gte: today },
            success: true,
          },
        }),
        prisma.actionHistory.count({
          where: {
            createdAt: { gte: today },
            success: false,
          },
        }),
        Promise.resolve(actionQueue.length),
      ]);

    // Obtener distribución de acciones por hora (últimas 24 horas)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyActions = await prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM "createdAt") as hour,
        COUNT(*) as count,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful
      FROM "action_history" 
      WHERE "createdAt" >= ${last24Hours}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    const metrics = {
      today: {
        total: totalToday,
        successful: successToday,
        failed: failedToday,
        successRate:
          totalToday > 0 ? Math.round((successToday / totalToday) * 100) : 0,
      },
      realtime: {
        queueLength,
        runningActions: runningActions.size,
        scheduledActions: scheduledActions.length,
      },
      hourlyDistribution: hourlyActions.map((h) => ({
        hour: parseInt(h.hour),
        total: parseInt(h.count),
        successful: parseInt(h.successful),
      })),
      timestamp: new Date().toISOString(),
    };

    res.json(metrics);
  } catch (error) {
    console.error("Error obteniendo métricas en tiempo real:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para obtener información detallada de una cuenta
app.get("/api/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const account = await prisma.xAccount.findUnique({
      where: { id },
      include: {
        actionHistory: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    // Preparar respuesta sin credenciales sensibles
    const accountData = {
      id: account.id,
      username: account.username,
      userId: account.userId,
      labels: account.labels,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastActivity: account.lastActivity,
      status: account.status,
      isActive: account.isActive,
      useOwnCredentials: account.useOwnCredentials,
      credentialsVerified: account.credentialsVerified,
      metrics: account.metrics,
      dailyLimits: account.dailyLimits,
      recentActions: account.actionHistory.map((a) => ({
        id: a.actionId,
        action: a.action,
        status: a.status,
        success: a.success,
        createdAt: a.createdAt,
        text: a.text?.substring(0, 100),
      })),
    };

    res.json({ success: true, account: accountData });
  } catch (error) {
    console.error("Error obteniendo cuenta:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para actualizar cuenta
app.put("/api/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { labels, isActive, dailyLimits } = req.body;

    const updateData = {};
    if (labels !== undefined) updateData.labels = labels;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (dailyLimits !== undefined) updateData.dailyLimits = dailyLimits;

    const account = await prisma.xAccount.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, account });
  } catch (error) {
    console.error("Error actualizando cuenta:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// ========== ENDPOINT DE TESTING ==========

// Endpoint para probar el sistema de guardado de acciones
app.post("/api/test/actions", async (req, res) => {
  try {
    // Obtener algunas cuentas para testing
    const accounts = await prisma.xAccount.findMany({
      take: 3,
    });

    if (accounts.length === 0) {
      return res.status(400).json({
        error:
          "No hay cuentas disponibles para testing. Agrega algunas cuentas primero.",
      });
    }

    const testActions = [
      {
        action: "tweet",
        text: "Tweet de prueba del sistema",
        accountId: accounts[0].id,
      },
      { action: "like", tweetId: "1234567890", accountId: accounts[0].id },
    ];

    if (accounts.length > 1) {
      testActions.push({
        action: "retweet",
        tweetId: "1234567890",
        accountId: accounts[1].id,
      });
    }

    const results = [];
    const batchId = `test_${Date.now()}`;

    for (const testAction of testActions) {
      const account = accounts.find((a) => a.id === testAction.accountId);

      const actionObj = {
        id: generateActionId(),
        accountId: testAction.accountId,
        action: testAction.action,
        text: testAction.text,
        tweetId: testAction.tweetId,
        account: account,
        accountUsername: account.username,
        accountLabels: account.labels || [],
        createdAt: new Date().toISOString(),
        status: "COMPLETED",
        success: true,
        completedAt: new Date().toISOString(),
        baseDelay: 30000,
        randomDelay: 5000,
        actualDelay: 32500,
        batchId,
        result: {
          id: `test_result_${Date.now()}`,
          success: true,
          message: `Acción de prueba ${testAction.action} ejecutada`,
        },
      };

      // Guardar en historial
      await addToHistory(actionObj);
      results.push(actionObj);
    }

    res.json({
      success: true,
      message: `${results.length} acciones de prueba creadas y guardadas en el historial`,
      actions: results.map((a) => ({
        id: a.id,
        action: a.action,
        username: a.accountUsername,
        status: a.status,
        success: a.success,
      })),
      batchId,
    });
  } catch (error) {
    console.error("Error en testing de acciones:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para crear cuentas de prueba con credenciales verificadas
app.post("/api/test/create-sample-accounts", async (req, res) => {
  try {
    console.log("🧪 Creando cuentas de prueba para testing...");

    const sampleAccounts = [
      {
        username: "test_account_1",
        userId: "test_user_1",
        twitterUserId: "1234567890",
        useOwnCredentials: true,
        credentialsVerified: true,
        isActive: true,
        labels: ["test", "verified"],
        status: "active",
      },
      {
        username: "test_account_2",
        userId: "test_user_2",
        twitterUserId: "1234567891",
        useOwnCredentials: true,
        credentialsVerified: true,
        isActive: true,
        labels: ["test", "verified"],
        status: "active",
      },
      {
        username: "test_account_3",
        userId: "test_user_3",
        twitterUserId: "1234567892",
        useOwnCredentials: true,
        credentialsVerified: true,
        isActive: true,
        labels: ["test", "verified"],
        status: "active",
      },
      {
        username: "test_account_4",
        userId: "test_user_4",
        twitterUserId: "1234567893",
        useOwnCredentials: false,
        credentialsVerified: false,
        isActive: false,
        labels: ["test", "unverified"],
        status: "inactive",
      },
    ];

    const createdAccounts = [];

    for (const accountData of sampleAccounts) {
      // Verificar si ya existe
      const existingAccount = await prisma.xAccount.findFirst({
        where: { username: accountData.username },
      });

      if (existingAccount) {
        console.log(
          `⚠️ Cuenta ${accountData.username} ya existe, actualizando...`
        );

        const updatedAccount = await prisma.xAccount.update({
          where: { id: existingAccount.id },
          data: {
            useOwnCredentials: accountData.useOwnCredentials,
            credentialsVerified: accountData.credentialsVerified,
            isActive: accountData.isActive,
            labels: accountData.labels,
            status: accountData.status,
            updatedAt: new Date(),
          },
        });

        createdAccounts.push(updatedAccount);
      } else {
        console.log(`✅ Creando nueva cuenta: ${accountData.username}`);

        const newAccount = await prisma.xAccount.create({
          data: {
            ...accountData,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        createdAccounts.push(newAccount);
      }
    }

    console.log(`✅ ${createdAccounts.length} cuentas de prueba procesadas`);

    res.json({
      success: true,
      message: `${createdAccounts.length} cuentas de prueba procesadas exitosamente`,
      accounts: createdAccounts.map((acc) => ({
        id: acc.id,
        username: acc.username,
        useOwnCredentials: acc.useOwnCredentials,
        credentialsVerified: acc.credentialsVerified,
        isActive: acc.isActive,
        status: acc.status,
        labels: acc.labels,
      })),
      verifiedCount: createdAccounts.filter(
        (acc) => acc.useOwnCredentials && acc.credentialsVerified
      ).length,
    });
  } catch (error) {
    console.error("Error creando cuentas de prueba:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// ========== CAMPAÑA DE FOLLOW MUTUO ==========

// Variables para manejar la campaña
let mutualFollowCampaign = null;
const followCampaignId = () => `follow_campaign_${Date.now()}`;

// Función para crear las acciones de follow mutuo
const createMutualFollowActions = async () => {
  try {
    // Obtener cuentas que tienen credenciales verificadas
    const accounts = await prisma.xAccount.findMany({
      where: {
        useOwnCredentials: true,
        credentialsVerified: true,
        isActive: true,
      },
    });

    if (accounts.length < 2) {
      throw new Error(
        "Se necesitan al menos 2 cuentas verificadas para la campaña"
      );
    }

    const followActions = [];
    const campaignId = followCampaignId();

    // Crear acciones: cada cuenta sigue a todas las demás
    for (const follower of accounts) {
      for (const target of accounts) {
        if (follower.id !== target.id) {
          followActions.push({
            followerId: follower.id,
            followerUsername: follower.username,
            targetId: target.id,
            targetUsername: target.username,
            targetUserId: target.userId,
            campaignId,
          });
        }
      }
    }

    return {
      actions: followActions,
      totalAccounts: accounts.length,
      totalActions: followActions.length,
      campaignId,
    };
  } catch (error) {
    console.error("Error creando acciones de follow mutuo:", error);
    throw error;
  }
};

// Función para distribuir acciones a lo largo de 3-5 días
const scheduleFollowActions = async (actions, campaignId) => {
  try {
    const CAMPAIGN_DAYS = 4; // 4 días para completar
    const ACTIONS_PER_DAY = Math.ceil(actions.length / CAMPAIGN_DAYS);
    const DAILY_LIMIT = 50; // Límite de Twitter API
    const HOURLY_LIMIT = 15; // Límite por hora aproximado

    console.log(`📊 Programando campaña de follow mutuo:
    - Total acciones: ${actions.length}
    - Duración: ${CAMPAIGN_DAYS} días
    - Acciones por día: ${ACTIONS_PER_DAY}
    - Límite diario respetado: ${Math.min(
      ACTIONS_PER_DAY,
      DAILY_LIMIT
    )} acciones/día`);

    const newScheduledActions = [];
    const now = new Date();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Calcular día y hora de ejecución
      const dayOffset = Math.floor(i / ACTIONS_PER_DAY);
      const actionIndexInDay = i % ACTIONS_PER_DAY;

      // Distribuir acciones durante las horas del día (9 AM - 9 PM)
      const hoursSpread = 12; // 12 horas de actividad
      const minutesSpread =
        (hoursSpread * 60) / Math.min(ACTIONS_PER_DAY, DAILY_LIMIT);

      // Calcular tiempo específico
      const scheduledTime = new Date(now);
      scheduledTime.setDate(now.getDate() + dayOffset);
      scheduledTime.setHours(9); // Empezar a las 9 AM
      scheduledTime.setMinutes(actionIndexInDay * minutesSpread);
      scheduledTime.setSeconds(Math.random() * 60); // Randomizar segundos

      // Crear objeto de acción para la cola
      const actionObj = {
        id: generateActionId(),
        accountId: action.followerId,
        action: "follow",
        targetUserId: action.targetUserId,
        account: { username: action.followerUsername },
        accountUsername: action.followerUsername,
        accountLabels: [],
        createdAt: new Date().toISOString(),
        scheduledTime: scheduledTime.toISOString(),
        status: "SCHEDULED",
        baseDelay: 30000,
        randomDelay: 60000,
        batchId: campaignId,
        campaignType: "mutual_follow",
        targetUsername: action.targetUsername,
      };

      newScheduledActions.push(actionObj);

      // Agregar a la lista global de acciones programadas
      scheduledActions.push(actionObj);

      // Guardar en historial inmediatamente
      await addToHistory(actionObj);
    }

    console.log(
      `✅ ${newScheduledActions.length} acciones de follow programadas exitosamente`
    );
    return newScheduledActions;
  } catch (error) {
    console.error("Error programando acciones de follow:", error);
    throw error;
  }
};

// ========== ENDPOINTS DE CAMPAÑA DE FOLLOW MUTUO ==========

// Obtener estado de la campaña
app.get("/api/mutual-follow-campaign", async (req, res) => {
  try {
    if (!mutualFollowCampaign) {
      return res.json({ isRunning: false, campaign: null });
    }

    // Obtener estadísticas actualizadas desde la base de datos
    const completedActions = await prisma.actionHistory.count({
      where: {
        batchId: mutualFollowCampaign.campaignId,
        status: "COMPLETED",
      },
    });

    const failedActions = await prisma.actionHistory.count({
      where: {
        batchId: mutualFollowCampaign.campaignId,
        status: "FAILED",
      },
    });

    const pendingActions = await prisma.actionHistory.count({
      where: {
        batchId: mutualFollowCampaign.campaignId,
        status: {
          in: ["SCHEDULED", "QUEUED", "RUNNING"],
        },
      },
    });

    // Actualizar estado de la campaña
    mutualFollowCampaign.progress = {
      completed: completedActions,
      failed: failedActions,
      pending: pendingActions,
      total: mutualFollowCampaign.progress.total,
    };

    // Verificar si la campaña terminó
    if (
      completedActions + failedActions >=
      mutualFollowCampaign.progress.total
    ) {
      mutualFollowCampaign.isRunning = false;
      mutualFollowCampaign.completedAt = new Date().toISOString();
    }

    res.json({
      isRunning: mutualFollowCampaign.isRunning,
      campaign: mutualFollowCampaign,
    });
  } catch (error) {
    console.error("Error obteniendo estado de campaña:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Iniciar campaña de follow mutuo
app.post("/api/mutual-follow-campaign", async (req, res) => {
  try {
    if (mutualFollowCampaign && mutualFollowCampaign.isRunning) {
      return res.status(400).json({
        error: "Ya hay una campaña de follow mutuo en curso",
      });
    }

    console.log("🚀 Iniciando campaña de follow mutuo...");

    // Crear acciones de follow
    const { actions, totalAccounts, totalActions, campaignId } =
      await createMutualFollowActions();

    // Programar acciones
    const campaignScheduledActions = await scheduleFollowActions(
      actions,
      campaignId
    );

    // Crear objeto de campaña
    mutualFollowCampaign = {
      campaignId,
      isRunning: true,
      startedAt: new Date().toISOString(),
      accounts: totalAccounts,
      progress: {
        total: totalActions,
        completed: 0,
        failed: 0,
        pending: totalActions,
      },
      currentPhase: "Programando follows",
      estimatedCompletion: new Date(
        Date.now() + 4 * 24 * 60 * 60 * 1000
      ).toISOString(), // 4 días
    };

    console.log(`✅ Campaña iniciada:
    - Cuentas participantes: ${totalAccounts}
    - Total de follows: ${totalActions}
    - Duración estimada: 4 días
    - ID de campaña: ${campaignId}`);

    res.json({
      success: true,
      message: `Campaña iniciada con ${totalActions} acciones programadas`,
      campaign: mutualFollowCampaign,
    });
  } catch (error) {
    console.error("Error iniciando campaña:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Cancelar campaña de follow mutuo
app.delete("/api/mutual-follow-campaign", async (req, res) => {
  try {
    if (!mutualFollowCampaign || !mutualFollowCampaign.isRunning) {
      return res.status(400).json({
        error: "No hay campaña de follow mutuo en curso",
      });
    }

    console.log("🛑 Cancelando campaña de follow mutuo...");

    // Cancelar acciones programadas pendientes
    const pendingActions = scheduledActions.filter(
      (action) => action.batchId === mutualFollowCampaign.campaignId
    );

    let canceledCount = 0;
    for (const action of pendingActions) {
      const index = scheduledActions.indexOf(action);
      if (index !== -1) {
        scheduledActions.splice(index, 1);

        // Actualizar historial
        action.status = "CANCELLED";
        action.completedAt = new Date().toISOString();
        await addToHistory(action);
        canceledCount++;
      }
    }

    // También cancelar de la cola normal
    const queuedActions = actionQueue.filter(
      (action) => action.batchId === mutualFollowCampaign.campaignId
    );

    for (const action of queuedActions) {
      const index = actionQueue.indexOf(action);
      if (index !== -1) {
        actionQueue.splice(index, 1);

        // Actualizar historial
        action.status = "CANCELLED";
        action.completedAt = new Date().toISOString();
        await addToHistory(action);
        canceledCount++;
      }
    }

    // Actualizar estado de la campaña
    mutualFollowCampaign.isRunning = false;
    mutualFollowCampaign.cancelledAt = new Date().toISOString();

    console.log(
      `✅ Campaña cancelada. ${canceledCount} acciones pendientes fueron removidas.`
    );

    res.json({
      success: true,
      message: `Campaña cancelada exitosamente`,
      canceledActions: canceledCount,
    });

    // Limpiar variable de campaña después de un tiempo
    setTimeout(() => {
      mutualFollowCampaign = null;
    }, 5000);
  } catch (error) {
    console.error("Error cancelando campaña:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// ========== PROCESADOR MEJORADO PARA FOLLOW ACTIONS ==========

// Función especializada para ejecutar acciones de follow
const executeFollowAction = async (action) => {
  try {
    console.log(
      `👥 Ejecutando follow: @${action.accountUsername} → @${action.targetUsername}`
    );

    // Aquí iría la lógica real de Twitter API
    // Por ahora simulamos la ejecución

    // Simular posibles errores comunes de follow
    const randomFactor = Math.random();

    if (randomFactor < 0.1) {
      // 10% de probabilidad de que ya se sigan
      throw new Error("You are already following this user");
    } else if (randomFactor < 0.15) {
      // 5% de probabilidad de usuario protegido
      throw new Error("User is protected and requires approval");
    } else if (randomFactor < 0.18) {
      // 3% de probabilidad de límite alcanzado
      throw new Error("Follow limit reached");
    }

    // Simular éxito
    const result = {
      id: `follow_${Date.now()}`,
      success: true,
      follower: action.accountUsername,
      target: action.targetUsername,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `✅ Follow exitoso: @${action.accountUsername} → @${action.targetUsername}`
    );
    return result;
  } catch (error) {
    console.log(
      `⚠️ Error en follow: @${action.accountUsername} → @${action.targetUsername}: ${error.message}`
    );

    // Si ya se siguen o error menor, no es crítico
    if (
      error.message.includes("already following") ||
      error.message.includes("protected") ||
      error.message.includes("not found")
    ) {
      return {
        id: `follow_skip_${Date.now()}`,
        success: true,
        skipped: true,
        reason: error.message,
        follower: action.accountUsername,
        target: action.targetUsername,
      };
    }

    throw error;
  }
};

// ========== PROCESADOR MEJORADO DE COLA ==========

// Reemplazar el procesador original de cola para manejar follows especiales
async function processQueueEnhanced() {
  if (actionQueue.length === 0 || runningActions.size >= 3) {
    return;
  }

  const action = actionQueue.shift();
  if (!action) return;

  runningActions.add(action);
  action.status = "RUNNING";
  action.startedAt = new Date().toISOString();

  console.log(
    `🚀 Ejecutando acción: ${action.action} para @${action.accountUsername}`
  );

  try {
    await addToHistory(action);

    const actualDelay = action.baseDelay + Math.random() * action.randomDelay;
    action.actualDelay = actualDelay;

    await new Promise((resolve) => setTimeout(resolve, actualDelay));

    // Ejecutar acción específica
    if (action.action === "follow" && action.campaignType === "mutual_follow") {
      action.result = await executeFollowAction(action);
    } else {
      // Simulación para otras acciones
      action.result = {
        id: `simulated_${Date.now()}`,
        success: true,
        message: `Acción ${action.action} ejecutada exitosamente`,
      };
    }

    action.status = "COMPLETED";
    action.success = true;
    action.completedAt = new Date().toISOString();

    console.log(
      `✅ Acción completada: ${action.action} para @${action.accountUsername}`
    );
  } catch (error) {
    console.error(`❌ Error ejecutando acción: ${error.message}`);

    action.status = "FAILED";
    action.success = false;
    action.completedAt = new Date().toISOString();
    action.error = error.message;
  } finally {
    await addToHistory(action);
    runningActions.delete(action);
  }
}

// ========== ENDPOINTS DE DEBUG ==========

// Endpoint para debug de cuentas (usado por el frontend)
app.get("/api/debug/accounts", async (req, res) => {
  try {
    const accounts = await prisma.xAccount.findMany({
      select: {
        id: true,
        username: true,
        userId: true,
        labels: true,
        createdAt: true,
        useOwnCredentials: true,
        credentialsVerified: true,
        isActive: true,
        status: true,
        lastActivity: true,
      },
      orderBy: { username: "asc" },
    });

    // Calcular estadísticas
    const stats = {
      total: accounts.length,
      valid: accounts.filter((acc) => acc.isActive).length,
      needsRefresh: 0, // Por implementar
      expired: 0, // Por implementar
      invalid: accounts.filter((acc) => !acc.isActive).length,
      needsReauth: 0, // Por implementar
    };

    res.json({
      stats,
      accounts: accounts.map((account) => ({
        _id: account.id,
        username: account.username,
        userId: account.userId,
        developerTag: account.username, // Temporal
        labels: account.labels || [],
        createdAt: account.createdAt.toISOString(),
        hasAccessToken: account.useOwnCredentials,
        hasRefreshToken: account.credentialsVerified,
        needsReauth: false,
        useOwnCredentials: account.useOwnCredentials,
        credentialsVerified: account.credentialsVerified,
        tokenInfo: {
          isValid: account.isActive,
          status: account.isActive ? "VALID" : "INVALID",
          hoursToExpiry: null,
        },
      })),
    });
  } catch (error) {
    console.error("Error en /api/debug/accounts:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para actualizar cuentas existentes para follow mutuo
app.post("/api/accounts/enable-for-mutual-follow", async (req, res) => {
  try {
    const { accountIds } = req.body;

    if (!accountIds || !Array.isArray(accountIds)) {
      return res.status(400).json({
        error: "Se requiere un array de accountIds",
      });
    }

    console.log(
      `🔧 Habilitando ${accountIds.length} cuentas para follow mutuo...`
    );

    const updatedAccounts = [];

    for (const accountId of accountIds) {
      try {
        const updatedAccount = await prisma.xAccount.update({
          where: { id: accountId },
          data: {
            useOwnCredentials: true,
            credentialsVerified: true,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        updatedAccounts.push(updatedAccount);
        console.log(
          `✅ Cuenta @${updatedAccount.username} habilitada para follow mutuo`
        );
      } catch (error) {
        console.error(
          `❌ Error actualizando cuenta ${accountId}:`,
          error.message
        );
      }
    }

    res.json({
      success: true,
      message: `${updatedAccounts.length} cuentas habilitadas para follow mutuo`,
      accounts: updatedAccounts.map((acc) => ({
        id: acc.id,
        username: acc.username,
        useOwnCredentials: acc.useOwnCredentials,
        credentialsVerified: acc.credentialsVerified,
        isActive: acc.isActive,
      })),
    });
  } catch (error) {
    console.error("Error habilitando cuentas:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
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
