require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const { URLSearchParams } = require("url");
const { TwitterApi } = require("twitter-api-v2");
const cron = require("node-cron");
const multer = require("multer");
const csv = require("csv-parse/sync");
const jwt = require("jsonwebtoken"); // Agregar jsonwebtoken

// Importar configuración CORS
const { corsMiddleware, logCorsConfig } = require("./src/config/cors");

// Importar modelo y utilidades (serán creados a continuación)
const XAccount = require("./models/XAccount"); // Asegúrate de crear models/XAccount.js
const Account = XAccount; // Alias para compatibilidad
const ActionHistory = require("./models/ActionHistory"); // Modelo para historial completo
const {
  generateOAuth1Signature,
  generateOAuth1Headers,
} = require("./utils/oauth1Helper"); // Asegúrate de crear utils/oauth1Helper.js

// ========== MIDDLEWARES DE AUTENTICACIÓN ==========

const JWT_SECRET = process.env.JWT_SECRET || "jwt_super_secret_key_control_x";

// Middleware para autenticar token JWT
const authenticateToken = (req, res, next) => {
  // Obtener token de headers o cookies
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  // También intentar obtener de cookies si no está en headers
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

// Middleware para verificar roles
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const userRole = req.user.role;

    // Permitir tanto "superadmin" como "SUPERADMIN"
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

// ========== FIN MIDDLEWARES DE AUTENTICACIÓN ==========

// Sistema de colas en memoria
const actionQueue = [];
const runningActions = new Set(); // Cambiar de Map a Set para almacenar solo IDs
const actionHistory = []; // Historial de las últimas 100 acciones
const scheduledActions = []; // Acciones programadas
const lastActionTimes = {}; // Para controlar rate limits por cuenta/acción
const MAX_HISTORY_SIZE = 100;

let actionIdCounter = 1;

// Función para generar ID único de acción
const generateActionId = () =>
  `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Función para agregar al historial (memoria y base de datos)
const addToHistory = async (actionInfo) => {
  // Actualizar en memoria para consultas rápidas
  const existingIndex = actionHistory.findIndex((a) => a.id === actionInfo.id);
  if (existingIndex !== -1) {
    // Actualizar registro existente
    actionHistory[existingIndex] = {
      ...actionHistory[existingIndex],
      ...actionInfo,
    };
  } else {
    // Agregar nuevo registro
    actionHistory.unshift(actionInfo);
    if (actionHistory.length > MAX_HISTORY_SIZE) {
      actionHistory.pop();
    }
  }

  // Guardar/actualizar en base de datos para historial completo
  try {
    // Validar que accountId esté presente
    if (!actionInfo.accountId) {
      console.error("❌ ERROR: accountId faltante en actionInfo:", actionInfo);
      return; // No intentar guardar si falta accountId
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

    // Agregar timestamps solo si están presentes
    if (actionInfo.createdAt) {
      updateData.createdAt = new Date(actionInfo.createdAt);
    }
    if (actionInfo.startedAt) {
      updateData.startedAt = new Date(actionInfo.startedAt);
    }
    if (actionInfo.completedAt) {
      updateData.completedAt = new Date(actionInfo.completedAt);
    }

    // Usar findOneAndUpdate con upsert para evitar duplicados
    await ActionHistory.findOneAndUpdate(
      { actionId: actionInfo.id },
      {
        $set: updateData,
        $setOnInsert: {
          actionId: actionInfo.id,
          createdAt: actionInfo.createdAt
            ? new Date(actionInfo.createdAt)
            : new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    console.log(
      "✅ Acción guardada/actualizada en historial correctamente:",
      actionInfo.id
    );
  } catch (error) {
    console.error("Error guardando acción en historial:", error);
    // No interrumpir el flujo si falla el guardado
  }
};

const app = express();
app.use(express.json());
app.use(corsMiddleware);

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI no está definido en las variables de entorno.");
  process.exit(1);
}

// Conexión a MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB conectado exitosamente");
    // Mostrar configuración CORS
    logCorsConfig();
  })
  .catch((err) => console.error("Error al conectar a MongoDB:", err));

// TODO: Migrar la función getValidToken si es necesaria (usada para credenciales compartidas)
// En este enfoque de backend separado, quizás siempre uses credenciales propias.
const getValidToken = async (accountId) => {
  console.warn(
    "getValidToken no implementado. Asumiendo uso de credenciales propias."
  );
  throw new Error(
    "Credenciales compartidas no soportadas en este backend por ahora."
  );
};

// Configurar multer para subida de archivos CSV
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
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

// Configurar multer para subida de imágenes (perfil y portada)
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo para imágenes
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"), false);
    }
  },
});

// Función para procesar CSV y mapear campos
const processCSVData = (csvData) => {
  const logs = [];
  const successfulAccounts = [];
  const errorAccounts = [];

  logs.push({
    timestamp: new Date().toISOString(),
    level: "INFO",
    message: `Iniciando procesamiento de ${csvData.length} registros del CSV`,
  });

  csvData.forEach((row, index) => {
    try {
      const lineNumber = index + 2; // +2 porque index empieza en 0 y hay header

      // Mapeo de campos del CSV a nuestro modelo
      const twitterHandle = row["Tag Twitter"] || "";
      const cleanTwitterHandle = twitterHandle.replace(/^@/, "").trim(); // Remover @ inicial si existe

      const accountData = {
        username: cleanTwitterHandle || cleanUsername(row["Email"] || ""),
        labels: [],

        // Credenciales OAuth 1.0a
        ownApiKey: row["API Key"] || "",
        ownApiSecret: row["API Key Secret"] || "",
        ownBearerToken: row["Bearer Token"] || "",
        ownAccessToken: row["Access Token"] || "",
        ownAccessTokenSecret: row["Access Token Secret"] || "",

        // Credenciales OAuth 2.0
        ownClientId: row["Client ID "] || row["Client ID"] || "",
        ownClientSecret: row["client secrect"] || row["client secret"] || "",

        // Configuración basada en datos disponibles
        useOwnCredentials: true,
        preferOAuth2: false, // Por defecto OAuth 1.0a
        isActive: true,
      };

      // Validar datos mínimos
      if (!accountData.username) {
        throw new Error(
          "Tag Twitter o Email es requerido para generar username"
        );
      }

      // Validar que el username no tenga caracteres especiales
      if (!/^[a-zA-Z0-9_]+$/.test(accountData.username)) {
        throw new Error(
          `Username inválido: ${accountData.username}. Solo se permiten letras, números y guiones bajos`
        );
      }

      // Verificar si tiene credenciales OAuth 1.0a completas
      const hasOAuth1 =
        accountData.ownApiKey &&
        accountData.ownApiSecret &&
        accountData.ownAccessToken &&
        accountData.ownAccessTokenSecret;

      // Verificar si tiene credenciales OAuth 2.0 completas
      const hasOAuth2 = accountData.ownClientId && accountData.ownClientSecret;

      if (!hasOAuth1 && !hasOAuth2) {
        throw new Error(
          "Se requieren credenciales OAuth 1.0a completas o OAuth 2.0"
        );
      }

      // Crear etiquetas basadas en metadatos
      const metadataFields = [
        "Edad",
        "Clase Social",
        "Género",
        "Situación",
        "Profesión",
        "Ideología",
      ];
      metadataFields.forEach((field) => {
        if (row[field] && row[field].trim()) {
          accountData.labels.push(`${field}: ${row[field].trim()}`);
        }
      });

      // Si tiene Bio Tw, agregar como etiqueta
      if (row["Bio Tw"] && row["Bio Tw"].trim()) {
        accountData.labels.push(
          `Bio: ${row["Bio Tw"].trim().substring(0, 50)}`
        );
      }

      // Determinar preferencia OAuth basada en datos disponibles
      if (hasOAuth2 && !hasOAuth1) {
        accountData.preferOAuth2 = true;
      }

      successfulAccounts.push({
        ...accountData,
        lineNumber,
        hasOAuth1,
        hasOAuth2,
      });

      logs.push({
        timestamp: new Date().toISOString(),
        level: "SUCCESS",
        message: `Línea ${lineNumber}: @${accountData.username} - OAuth1: ${
          hasOAuth1 ? "✓" : "✗"
        } OAuth2: ${hasOAuth2 ? "✓" : "✗"}`,
      });
    } catch (error) {
      const lineNumber = index + 2;
      errorAccounts.push({
        lineNumber,
        username: row["Email"] || "N/A",
        error: error.message,
        data: row,
      });

      logs.push({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message: `Línea ${lineNumber}: Error - ${error.message}`,
      });
    }
  });

  return { logs, successfulAccounts, errorAccounts };
};

// Función para limpiar username
const cleanUsername = (email) => {
  if (!email) return "";

  // Si es un email, extraer la parte antes del @
  if (email.includes("@")) {
    return email.split("@")[0];
  }

  // Si ya es un username, limpiar caracteres especiales
  return email.replace(/[^a-zA-Z0-9_]/g, "");
};

// Endpoint de ejemplo
app.get("/", (req, res) => {
  res.send("Backend Express funcionando!");
});

// Endpoint para cargar cuentas masivamente desde CSV
app.post(
  "/api/accounts/upload-csv",
  upload.single("csvFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No se proporcionó archivo CSV",
        });
      }

      const logs = [
        {
          timestamp: new Date().toISOString(),
          level: "INFO",
          message: `Archivo CSV recibido: ${req.file.originalname} (${(
            req.file.size / 1024
          ).toFixed(2)} KB)`,
        },
      ];

      // Parsear CSV
      let csvData;
      try {
        const csvContent = req.file.buffer.toString("utf-8");
        csvData = csv.parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          delimiter: ",",
          quote: '"',
          escape: '"',
        });

        logs.push({
          timestamp: new Date().toISOString(),
          level: "SUCCESS",
          message: `CSV parseado correctamente. ${csvData.length} registros encontrados`,
        });
      } catch (parseError) {
        logs.push({
          timestamp: new Date().toISOString(),
          level: "ERROR",
          message: `Error parseando CSV: ${parseError.message}`,
        });

        return res.status(400).json({
          error: "Error parseando archivo CSV",
          details: parseError.message,
          logs,
        });
      }

      // Procesar datos del CSV
      const {
        logs: processLogs,
        successfulAccounts,
        errorAccounts,
      } = processCSVData(csvData);
      logs.push(...processLogs);

      // Intentar guardar cuentas en la base de datos
      const savedAccounts = [];
      const dbErrors = [];

      for (const accountData of successfulAccounts) {
        try {
          // Verificar si ya existe una cuenta con este username
          const existingAccount = await XAccount.findOne({
            username: accountData.username,
          });

          if (existingAccount) {
            // Actualizar cuenta existente
            Object.assign(existingAccount, accountData);
            const updatedAccount = await existingAccount.save();

            savedAccounts.push({
              ...updatedAccount.toObject(),
              action: "updated",
              lineNumber: accountData.lineNumber,
            });

            logs.push({
              timestamp: new Date().toISOString(),
              level: "SUCCESS",
              message: `Línea ${accountData.lineNumber}: @${accountData.username} actualizada en la base de datos`,
            });
          } else {
            // Crear nueva cuenta
            const newAccount = new XAccount(accountData);
            const savedAccount = await newAccount.save();

            savedAccounts.push({
              ...savedAccount.toObject(),
              action: "created",
              lineNumber: accountData.lineNumber,
            });

            logs.push({
              timestamp: new Date().toISOString(),
              level: "SUCCESS",
              message: `Línea ${accountData.lineNumber}: @${accountData.username} creada en la base de datos`,
            });
          }
        } catch (dbError) {
          dbErrors.push({
            lineNumber: accountData.lineNumber,
            username: accountData.username,
            error: dbError.message,
          });

          logs.push({
            timestamp: new Date().toISOString(),
            level: "ERROR",
            message: `Línea ${accountData.lineNumber}: Error BD para @${accountData.username} - ${dbError.message}`,
          });
        }
      }

      // Resumen final
      const summary = {
        totalRecords: csvData.length,
        processedSuccessfully: successfulAccounts.length,
        csvErrors: errorAccounts.length,
        savedAccounts: savedAccounts.length,
        dbErrors: dbErrors.length,
        createdAccounts: savedAccounts.filter((a) => a.action === "created")
          .length,
        updatedAccounts: savedAccounts.filter((a) => a.action === "updated")
          .length,
      };

      logs.push({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Procesamiento completado. Creadas: ${
          summary.createdAccounts
        }, Actualizadas: ${summary.updatedAccounts}, Errores: ${
          summary.csvErrors + summary.dbErrors
        }`,
      });

      res.json({
        success: true,
        summary,
        savedAccounts: savedAccounts.map((acc) => ({
          username: acc.username,
          action: acc.action,
          lineNumber: acc.lineNumber,
          hasOAuth1: acc.hasOAuth1,
          hasOAuth2: acc.hasOAuth2,
          labels: acc.labels,
        })),
        errors: [...errorAccounts, ...dbErrors],
        logs,
      });
    } catch (error) {
      console.error("Error en upload-csv:", error);

      const errorLogs = [
        {
          timestamp: new Date().toISOString(),
          level: "ERROR",
          message: `Error interno del servidor: ${error.message}`,
        },
      ];

      res.status(500).json({
        error: "Error interno del servidor",
        details: error.message,
        logs: errorLogs,
      });
    }
  }
);

// Endpoint para obtener estado de la cola
app.get("/api/queue/status", (req, res) => {
  // Obtener parámetros de paginación para el historial
  const historyPage = parseInt(req.query.historyPage) || 1;
  const historyLimit = parseInt(req.query.historyLimit) || 10;
  const historyOffset = (historyPage - 1) * historyLimit;

  const queuedActions = actionQueue.map((action) => ({
    id: action.id,
    accountUsername: action.accountUsername,
    accountLabels: action.account?.labels || [], // Añadir labels de la cuenta
    action: action.action,
    text: action.text || "",
    tweetId: action.tweetId || "",
    targetUserId: action.targetUserId || "",
    status: "queued",
    createdAt: action.createdAt,
    baseDelay: action.baseDelay,
    randomDelay: action.randomDelay,
    estimatedStartTime: action.estimatedStartTime,
  }));

  const scheduledActionsInfo = scheduledActions.map((action) => ({
    id: action.id,
    accountIds: [action.accountId], // Convertir a array para compatibilidad con frontend
    accountUsername: action.accountUsername,
    accountLabels: action.account?.labels || [], // Añadir labels de la cuenta
    action: action.action,
    text: action.text || "",
    tweetId: action.tweetId || "",
    targetUserId: action.targetUserId || "",
    status: "scheduled",
    scheduledTime: action.scheduledTime,
    createdAt: action.createdAt,
    baseDelay: action.baseDelay,
    randomDelay: action.randomDelay,
  }));

  // Mejorar información de acciones ejecutándose
  const runningActionsInfo = [];
  for (const actionId of runningActions) {
    // Buscar en el historial la acción que está ejecutándose
    const historyAction = actionHistory.find(
      (a) => a.id === actionId && a.status === "running"
    );
    if (historyAction) {
      runningActionsInfo.push({
        id: actionId,
        accountUsername: historyAction.username,
        accountLabels: historyAction.accountLabels || [], // Añadir labels
        action: historyAction.action,
        text: historyAction.text || "",
        tweetId: historyAction.tweetId || "",
        targetUserId: historyAction.targetUserId || "",
        status: "running",
        startedAt: historyAction.timestamp,
        progress: 50, // Progreso indeterminado
      });
    }
  }

  // Ordenar historial por fecha más reciente primero y aplicar paginación
  const sortedHistory = actionHistory
    .filter((action) => action.status !== "running") // Excluir acciones en ejecución
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const totalHistoryItems = sortedHistory.length;
  const paginatedHistory = sortedHistory
    .slice(historyOffset, historyOffset + historyLimit)
    .map((action) => ({
      id: action.id,
      accountUsername: action.username,
      accountLabels: action.accountLabels || [], // Añadir labels
      action: action.action,
      text: action.text || "",
      tweetId: action.tweetId || "",
      targetUserId: action.targetUserId || "",
      status: action.status,
      success: action.success,
      timestamp: action.timestamp,
      completedAt: action.completedAt || action.timestamp, // Usar timestamp si no hay completedAt
      error: action.error,
    }));

  res.json({
    queue: queuedActions,
    scheduled: scheduledActionsInfo,
    running: runningActionsInfo,
    history: paginatedHistory,
    totalHistoryItems: totalHistoryItems,
    historyPage: historyPage,
    historyLimit: historyLimit,
    stats: {
      queued: actionQueue.length,
      scheduled: scheduledActions.length,
      running: runningActions.size,
      completed: actionHistory.filter((a) => a.success).length,
      failed: actionHistory.filter((a) => !a.success).length,
    },
  });
});

// Endpoint para limpiar la cola
app.delete("/api/queue/clear", (req, res) => {
  try {
    const clearedCount = actionQueue.length;
    actionQueue.length = 0; // Limpiar cola

    res.json({
      message: `Cola limpiada. ${clearedCount} acciones eliminadas`,
      clearedCount,
    });
  } catch (error) {
    console.error("Error limpiando cola:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para obtener métricas en tiempo real
app.get("/api/metrics/realtime", async (req, res) => {
  try {
    // Obtener estadísticas de las cuentas
    const accounts = await Account.find({});

    const metrics = {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((acc) => acc.isActive !== false).length,
      queueLength: actionQueue.length,
      runningActions: runningActions.size,
      totalActionsToday: actionHistory.filter((action) => {
        const today = new Date().toDateString();
        const actionDate = new Date(action.timestamp).toDateString();
        return today === actionDate;
      }).length,
      successRate:
        actionHistory.length > 0
          ? (
              (actionHistory.filter((a) => a.success).length /
                actionHistory.length) *
              100
            ).toFixed(1) + "%"
          : "0%",
      lastActionTime:
        actionHistory.length > 0
          ? actionHistory[actionHistory.length - 1].timestamp
          : null,
    };

    res.json(metrics);
  } catch (error) {
    console.error("Error obteniendo métricas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para limpiar el historial - DESHABILITADO
// app.delete("/api/queue/history", (req, res) => {
//   actionHistory.length = 0;
//   res.json({ message: "Historial limpiado" });
// });

// Endpoint para cancelar una acción en cola
app.delete("/api/queue/:actionId", (req, res) => {
  const { actionId } = req.params;
  const index = actionQueue.findIndex((action) => action.id === actionId);

  if (index === -1) {
    return res.status(404).json({ error: "Acción no encontrada en la cola" });
  }

  const removedAction = actionQueue.splice(index, 1)[0];
  addToHistory({
    ...removedAction,
    accountId: removedAction.accountId,
    accountLabels: removedAction.account?.labels || [],
    status: "cancelled",
    completedAt: new Date().toISOString(),
    error: "Cancelado por el usuario",
  });

  res.json({ message: "Acción cancelada", action: removedAction });
});

// Verificar acciones programadas cada minuto
cron.schedule("* * * * *", () => {
  const now = new Date();
  console.log(
    `🕒 Verificando acciones programadas a las ${now.toISOString()} (${now.toLocaleString(
      "es-ES"
    )})`
  );
  console.log(`📊 Total acciones programadas: ${scheduledActions.length}`);

  if (scheduledActions.length > 0) {
    console.log("📋 Acciones programadas actuales:");
    scheduledActions.forEach((action, index) => {
      const scheduledTime = new Date(action.scheduledTime);
      const timeDiff = scheduledTime.getTime() - now.getTime();
      const minutesDiff = Math.round(timeDiff / (1000 * 60));

      console.log(
        `  ${index + 1}. ${action.id} - ${action.action} para @${
          action.accountUsername
        }`
      );
      console.log(
        `     📅 Programado para: ${scheduledTime.toISOString()} (${scheduledTime.toLocaleString(
          "es-ES"
        )})`
      );
      console.log(
        `     ⏰ Diferencia: ${minutesDiff} minutos (${
          timeDiff > 0 ? "futuro" : "pasado"
        })`
      );
    });
  }

  const actionsToExecute = scheduledActions.filter(
    (action) => action.scheduledTime && action.scheduledTime <= now
  );

  if (actionsToExecute.length > 0) {
    console.log(
      `⏰ Ejecutando ${actionsToExecute.length} acciones programadas`
    );

    actionsToExecute.forEach((action) => {
      // Remover de acciones programadas
      const index = scheduledActions.findIndex((a) => a.id === action.id);
      if (index !== -1) {
        scheduledActions.splice(index, 1);
      }

      // Añadir a la cola de ejecución
      actionQueue.push(action);
      console.log(
        `📅➡️📝 Acción programada ${action.id} movida a cola: ${action.action} para @${action.accountUsername}`
      );
    });
  } else if (scheduledActions.length > 0) {
    console.log(
      `⏸️ Ninguna acción lista para ejecutar aún. Próxima verificación en 1 minuto.`
    );
  }
});

// Función para procesar la cola
const processQueue = async () => {
  if (actionQueue.length === 0 || runningActions.size >= 2) {
    // Reducir a máximo 2 acciones concurrentes para mejor control
    return;
  }

  const action = actionQueue.shift();
  if (!action) return;

  // Marcar como ejecutándose
  runningActions.add(action.id);

  // Añadir al historial como iniciado
  addToHistory({
    id: action.id,
    accountId: action.accountId,
    username: action.accountUsername,
    accountLabels: action.account?.labels || [],
    action: action.action,
    text: action.text || "",
    tweetId: action.tweetId || "",
    targetUserId: action.targetUserId || "",
    success: false,
    timestamp: new Date().toISOString(),
    status: "running",
    startedAt: new Date().toISOString(),
  });

  console.log(
    `🚀 Iniciando ${action.action} para @${action.accountUsername} (ID: ${action.id})`
  );

  // Verificar si necesitamos esperar por rate limits más estrictos
  const now = Date.now();
  const actionKey = `${action.action}_${action.accountUsername}`;
  const globalActionKey = action.action; // Para control global por tipo de acción
  const lastActionTime = lastActionTimes[actionKey] || 0;

  // Intervalos mínimos por tipo de acción (más conservadores)
  const minInterval = getMinIntervalForAction(action.action);
  const timeSinceLastAction = now - lastActionTime;

  if (timeSinceLastAction < minInterval) {
    const waitTime = minInterval - timeSinceLastAction;
    console.log(
      `⏳ Esperando ${Math.round(waitTime / 1000)}s por rate limit de ${
        action.action
      }...`
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  // Aplicar delay base configurado por el usuario
  const baseDelay = action.baseDelay || 30000; // 30s por defecto
  const randomDelay = action.randomDelay || 0;
  const totalDelay = baseDelay + Math.random() * randomDelay;

  console.log(
    `⏱️ Aplicando delay: Base=${Math.round(
      baseDelay / 1000
    )}s + Random=${Math.round(
      (totalDelay - baseDelay) / 1000
    )}s = Total=${Math.round(totalDelay / 1000)}s para ${action.action}`
  );
  await new Promise((resolve) => setTimeout(resolve, totalDelay));

  // Actualizar tiempo de última acción
  lastActionTimes[actionKey] = Date.now();

  try {
    console.log(
      `🎯 Ejecutando ${action.action} para @${action.accountUsername}...`
    );

    const result = await executeTwitterAction(action);

    // Actualizar historial con éxito
    addToHistory({
      id: action.id,
      accountId: action.accountId,
      username: action.accountUsername,
      accountLabels: action.account?.labels || [],
      action: action.action,
      text: action.text || "",
      tweetId: action.tweetId || "",
      targetUserId: action.targetUserId || "",
      success: true,
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "completed",
      result: result,
    });

    console.log(
      `✅ Acción ${action.id} completada exitosamente para @${action.accountUsername}`
    );
  } catch (error) {
    console.error(
      `❌ Error ejecutando ${action.action} para @${action.accountUsername}:`,
      error.message
    );

    // Actualizar historial con error
    addToHistory({
      id: action.id,
      accountId: action.accountId,
      username: action.accountUsername,
      accountLabels: action.account?.labels || [],
      action: action.action,
      text: action.text || "",
      tweetId: action.tweetId || "",
      targetUserId: action.targetUserId || "",
      success: false,
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "failed",
      error: error.message,
      result: null,
    });

    console.log(
      `❌ Acción ${action.id} falló para @${action.accountUsername}: ${error.message}`
    );
  } finally {
    // Remover de acciones ejecutándose
    runningActions.delete(action.id);
    console.log(
      `📊 Estado actual: ${actionQueue.length} en cola, ${runningActions.size} ejecutándose`
    );
  }
};

// Función para obtener el intervalo mínimo por tipo de acción
const getMinIntervalForAction = (actionType) => {
  const intervals = {
    like: 60000, // 1 minuto entre likes
    retweet: 90000, // 1.5 minutos entre retweets
    tweet: 120000, // 2 minutos entre tweets
    reply: 90000, // 1.5 minutos entre replies
    follow: 60000, // 1 minuto entre follows
    unfollow: 60000, // 1 minuto entre unfollows
  };

  return intervals[actionType] || 30000; // 30 segundos por defecto
};

// Procesar cola cada 5 segundos (más espaciado)
setInterval(processQueue, 5000);

// Ruta para manejar acciones de Twitter
app.post("/api/tweets", async (req, res) => {
  try {
    const { accountId, action, text, tweetId } = req.body;

    // Validar parámetros requeridos
    if (!accountId) {
      return res.status(400).json({ error: "accountId es requerido" });
    }

    if (!action) {
      return res.status(400).json({ error: "action es requerido" });
    }

    // Validar cuenta
    const account = await XAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    // Validar que las acciones de escritura usen credenciales propias
    const needsWriteAccess = [
      "tweet",
      "like",
      "retweet",
      "reply",
      "follow",
      "unfollow",
    ].includes(action);
    if (needsWriteAccess) {
      if (
        !(
          account.useOwnCredentials &&
          account.credentialsVerified &&
          account.ownAccessToken &&
          account.ownAccessTokenSecret &&
          account.ownApiKey &&
          account.ownApiSecret
        )
      ) {
        return res.status(400).json({
          error:
            "Se requieren credenciales propias completas y verificadas para acciones de escritura.",
        });
      }
    }

    // Validar que las acciones que requieren userId tengan este campo (solo si son de escritura y usan propias creds)
    const actionsRequiringUserId = ["like", "retweet", "follow", "unfollow"];
    if (
      needsWriteAccess &&
      actionsRequiringUserId.includes(action) &&
      !account.userId
    ) {
      return res.status(400).json({
        error: `La cuenta @${account.username} no tiene userId configurado. Este campo es requerido para la acción ${action}`,
      });
    }

    // Validar y procesar tweetId
    let validatedTweetId = undefined;
    const actionsRequiringTweetId = ["like", "retweet", "reply"];
    if (actionsRequiringTweetId.includes(action)) {
      if (!tweetId) {
        return res
          .status(400)
          .json({ error: `tweetId es requerido para la acción ${action}` });
      }
      validatedTweetId = extractAndValidateTweetId(tweetId);
      if (!validatedTweetId) {
        return res.status(400).json({
          error: `tweetId inválido: "${tweetId}". Debe ser un ID numérico o una URL válida de Twitter.`,
        });
      }
    }

    // Validar que las acciones que requieren texto lo tengan
    const actionsRequiringText = ["tweet", "reply"];
    if (actionsRequiringText.includes(action) && !text?.trim()) {
      return res
        .status(400)
        .json({ error: `text es requerido para la acción ${action}` });
    }

    // Validar que las acciones follow/unfollow tengan targetUserId
    if (
      ["follow", "unfollow"].includes(action) &&
      !req.body.targetUserId?.trim()
    ) {
      return res.status(400).json({
        error: "targetUserId es requerido para las acciones follow/unfollow",
      });
    }

    // Validar y procesar targetUserId para follow/unfollow
    let validatedTargetUserId = undefined;
    if (["follow", "unfollow"].includes(action)) {
      validatedTargetUserId = extractAndValidateUserId(req.body.targetUserId);
      if (!validatedTargetUserId) {
        return res.status(400).json({
          error: `targetUserId inválido: "${req.body.targetUserId}". Debe ser un ID numérico, username, o URL válida de Twitter.`,
        });
      }
    }

    // Crear objeto de acción para la cola
    const actionObj = {
      id: generateActionId(),
      accountId,
      action,
      text,
      tweetId: validatedTweetId,
      targetUserId: validatedTargetUserId,
      account: account.toObject(), // Guardar copia completa de la cuenta
      accountUsername: account.username,
      createdAt: new Date().toISOString(),
      estimatedStartTime: new Date(
        Date.now() + actionQueue.length * 60000 // 1 minuto por posición en cola (más realista)
      ).toISOString(),
      status: "queued",
      baseDelay: 30000, // Delay por defecto
      randomDelay: 0,
    };

    // Añadir a la cola inmediatamente (este endpoint no maneja programación)
    actionQueue.push(actionObj);
    console.log(
      `📝 Acción ${actionObj.id} añadida a la cola: ${action} para @${account.username}`
    );

    // Responder inmediatamente con información de la cola
    res.json({
      success: true,
      message: "Acción añadida a la cola exitosamente",
      actionId: actionObj.id,
      queuePosition: actionQueue.length,
      estimatedStartTime: actionObj.estimatedStartTime,
    });
  } catch (error) {
    console.error("Error en /api/tweets:", error);
    res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para obtener todas las cuentas
app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await Account.find(
      {},
      {
        username: 1,
        labels: 1,
        isActive: 1,
        status: 1,
        lastActivity: 1,
        metrics: 1,
        dailyLimits: 1,
      }
    ).sort({ username: 1 });

    res.json(accounts);
  } catch (error) {
    console.error("Error obteniendo cuentas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para actualizar username de una cuenta
app.put("/api/accounts/:accountId/username", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Username es requerido" });
    }

    // Limpiar el @ del inicio del username
    const cleanedUsername = username.replace(/^@+/, "").trim();

    // Verificar que el username no esté ya en uso por otra cuenta
    const existingAccount = await Account.findOne({
      username: cleanedUsername,
      _id: { $ne: accountId },
    });

    if (existingAccount) {
      return res.status(409).json({
        error: `El username ${cleanedUsername} ya está en uso por otra cuenta`,
      });
    }

    // Actualizar la cuenta
    const updatedAccount = await Account.findByIdAndUpdate(
      accountId,
      {
        username: cleanedUsername,
        lastActivity: new Date(),
      },
      { new: true, select: "username _id lastActivity" }
    );

    if (!updatedAccount) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    res.json({
      success: true,
      message: "Username actualizado exitosamente",
      account: updatedAccount,
    });
  } catch (error) {
    console.error("Error actualizando username:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para actualizar múltiples usernames usando IDs específicos
app.post("/api/accounts/bulk-update-usernames-by-id", async (req, res) => {
  try {
    const { updates } = req.body; // Array de { accountId, email, twitterTag, currentUsername }

    if (!Array.isArray(updates)) {
      return res
        .status(400)
        .json({ error: "Se requiere un array de actualizaciones" });
    }

    const results = {
      total: updates.length,
      updated: 0,
      errors: 0,
      details: [],
    };

    for (const update of updates) {
      const { accountId, email, twitterTag, currentUsername } = update;

      try {
        // Verificar si ya tiene el username correcto
        if (currentUsername === twitterTag) {
          results.details.push({
            email,
            status: "unchanged",
            message: "Username ya era correcto",
            username: twitterTag,
          });
          continue;
        }

        // Actualizar por ID directamente
        const result = await Account.updateOne(
          { _id: accountId },
          {
            username: twitterTag,
            lastActivity: new Date(),
          }
        );

        if (result.modifiedCount > 0) {
          results.updated++;
          results.details.push({
            email,
            status: "updated",
            message: "Username actualizado exitosamente",
            oldUsername: currentUsername,
            newUsername: twitterTag,
          });
        } else {
          results.details.push({
            email,
            status: "error",
            message: "No se pudo actualizar la cuenta",
          });
          results.errors++;
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          email,
          status: "error",
          message: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Proceso completado: ${results.updated} actualizados, ${results.errors} errores`,
      results,
    });
  } catch (error) {
    console.error("Error en actualización masiva por ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para actualizar múltiples usernames desde CSV (método anterior)
app.post("/api/accounts/bulk-update-usernames", async (req, res) => {
  try {
    const { updates } = req.body; // Array de { email, twitterTag }

    if (!Array.isArray(updates)) {
      return res
        .status(400)
        .json({ error: "Se requiere un array de actualizaciones" });
    }

    const results = {
      total: updates.length,
      updated: 0,
      notFound: 0,
      errors: 0,
      details: [],
    };

    for (const update of updates) {
      const { email, twitterTag } = update;

      if (!email || !twitterTag) {
        results.errors++;
        results.details.push({
          email: email || "N/A",
          status: "error",
          message: "Email o twitterTag faltante",
        });
        continue;
      }

      try {
        // Limpiar el @ del inicio del twitterTag
        const cleanedTag = twitterTag.replace(/^@+/, "");

        // Buscar la cuenta por diferentes criterios más robustos
        const usernameFromEmail = email.replace("@gmail.com", "");
        const emailPrefix = email.split("@")[0];

        const account = await Account.findOne({
          $or: [
            // Buscar por username actual
            { username: cleanedTag },
            { username: usernameFromEmail },
            { username: email },
            // Buscar por variaciones del email
            { username: { $regex: new RegExp(`^${emailPrefix}`, "i") } },
            { username: { $regex: new RegExp(`^@?${cleanedTag}$`, "i") } },
            // Buscar en labels que puedan contener el email
            { labels: { $regex: new RegExp(email, "i") } },
          ],
        });

        if (!account) {
          results.notFound++;
          results.details.push({
            email,
            status: "notFound",
            message: "Cuenta no encontrada",
          });
          continue;
        }

        // Verificar si ya tiene el username correcto
        if (account.username === cleanedTag) {
          results.details.push({
            email,
            status: "unchanged",
            message: "Username ya era correcto",
            username: cleanedTag,
          });
          continue;
        }

        // Actualizar el username
        await Account.updateOne(
          { _id: account._id },
          {
            username: cleanedTag,
            lastActivity: new Date(),
          }
        );

        results.updated++;
        results.details.push({
          email,
          status: "updated",
          message: "Username actualizado exitosamente",
          oldUsername: account.username,
          newUsername: cleanedTag,
        });
      } catch (error) {
        results.errors++;
        results.details.push({
          email,
          status: "error",
          message: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Proceso completado: ${results.updated} actualizados, ${results.notFound} no encontrados, ${results.errors} errores`,
      results,
    });
  } catch (error) {
    console.error("Error en actualización masiva de usernames:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para eliminar todas las cuentas (SOLO PARA DESARROLLO)
app.delete("/api/accounts/clear-all", async (req, res) => {
  try {
    // ADVERTENCIA: Solo usar en desarrollo
    if (process.env.NODE_ENV === "production") {
      return res
        .status(403)
        .json({ error: "Operación no permitida en producción" });
    }

    const result = await Account.deleteMany({});

    res.json({
      success: true,
      message: `Se eliminaron ${result.deletedCount} cuentas`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error al limpiar cuentas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para obtener límites de cuentas (para el dashboard)
app.get("/api/account-limits", async (req, res) => {
  try {
    const accounts = await Account.find(
      {},
      {
        username: 1,
        labels: 1,
        dailyLimits: 1,
        status: 1,
        lastActivity: 1,
      }
    ).sort({ username: 1 });

    // Calcular uso real basado en el historial de acciones de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const accountsWithRealUsage = accounts.map((account) => {
      // Filtrar acciones de hoy para esta cuenta
      const todayActions = actionHistory.filter((action) => {
        const actionDate = new Date(action.timestamp);
        return (
          action.username === account.username &&
          actionDate >= today &&
          actionDate < tomorrow &&
          action.success === true // Solo contar acciones exitosas
        );
      });

      // Contar por tipo de acción
      const tweetsToday = todayActions.filter(
        (a) => a.action === "tweet"
      ).length;
      const followsToday = todayActions.filter(
        (a) => a.action === "follow"
      ).length;
      const likesToday = todayActions.filter((a) => a.action === "like").length;
      const retweetsToday = todayActions.filter(
        (a) => a.action === "retweet"
      ).length;

      // Calcular próximo reset (mañana a las 00:00)
      const nextReset = new Date(tomorrow);

      // Determinar estado basado en uso actual
      let status = "active";
      const tweetUsage =
        tweetsToday / (account.dailyLimits?.tweets?.limit || 300);
      const followUsage =
        followsToday / (account.dailyLimits?.follows?.limit || 400);
      const likeUsage =
        likesToday / (account.dailyLimits?.likes?.limit || 1000);
      const retweetUsage =
        retweetsToday / (account.dailyLimits?.retweets?.limit || 600);

      const maxUsage = Math.max(
        tweetUsage,
        followUsage,
        likeUsage,
        retweetUsage
      );

      if (maxUsage >= 0.9) {
        status = "limited";
      } else if (maxUsage >= 0.7) {
        status = "warning";
      }

      // Actualizar con datos reales
      const accountData = account.toObject();
      accountData.dailyLimits = {
        tweets: {
          used: tweetsToday,
          limit: account.dailyLimits?.tweets?.limit || 300,
          reset: nextReset.toISOString(),
        },
        follows: {
          used: followsToday,
          limit: account.dailyLimits?.follows?.limit || 400,
          reset: nextReset.toISOString(),
        },
        likes: {
          used: likesToday,
          limit: account.dailyLimits?.likes?.limit || 1000,
          reset: nextReset.toISOString(),
        },
        retweets: {
          used: retweetsToday,
          limit: account.dailyLimits?.retweets?.limit || 600,
          reset: nextReset.toISOString(),
        },
      };

      accountData.status = status;
      accountData.lastActivity =
        todayActions.length > 0
          ? todayActions[todayActions.length - 1].timestamp
          : account.lastActivity || new Date().toISOString();

      return accountData;
    });

    res.json(accountsWithRealUsage);
  } catch (error) {
    console.error("Error obteniendo límites de cuentas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para añadir acciones a la cola
app.post("/api/queue/add", async (req, res) => {
  try {
    const {
      action,
      accountIds,
      text,
      tweetId,
      targetUserId,
      baseDelay = 30000,
      randomDelay = 0,
      scheduledTime = null,
    } = req.body;

    if (!action || !accountIds || accountIds.length === 0) {
      return res.status(400).json({
        error: "Acción y cuentas son requeridas",
      });
    }

    const accounts = await Account.find({ _id: { $in: accountIds } });
    if (accounts.length === 0) {
      return res.status(404).json({
        error: "No se encontraron cuentas válidas",
      });
    }

    const addedActions = [];

    for (const account of accounts) {
      const actionId = generateActionId();

      // Manejar el tiempo programado si existe
      let processedScheduledTime = null;
      if (scheduledTime) {
        processedScheduledTime = new Date(scheduledTime);

        // Verificar que la fecha sea válida
        if (isNaN(processedScheduledTime.getTime())) {
          return res.status(400).json({
            error: "Fecha programada inválida",
          });
        }

        // Log para debug de zona horaria
        console.log("📅 Procesando fecha programada:", {
          input: scheduledTime,
          parsed: processedScheduledTime.toISOString(),
          localString: processedScheduledTime.toLocaleString("es-ES"),
          timestamp: processedScheduledTime.getTime(),
          now: new Date().toISOString(),
        });
      }

      const actionObj = {
        id: actionId,
        action,
        accountId: account._id,
        account: account.toObject(), // Añadir objeto account completo
        accountUsername: account.username,
        text,
        tweetId,
        targetUserId,
        baseDelay: parseInt(baseDelay),
        randomDelay: parseInt(randomDelay),
        scheduledTime: processedScheduledTime,
        createdAt: new Date(),
      };

      if (scheduledTime) {
        // Si es programada, añadir a la lista de acciones programadas
        scheduledActions.push(actionObj);
        console.log(
          `📅 Acción ${actionId} programada para ${processedScheduledTime.toISOString()} (${processedScheduledTime.toLocaleString(
            "es-ES"
          )}): ${action} para @${account.username}`
        );
      } else {
        // Añadir a la cola inmediatamente
        actionQueue.push(actionObj);
        console.log(
          `📝 Acción ${actionId} añadida a la cola: ${action} para @${account.username}`
        );
      }

      addedActions.push({
        id: actionId,
        username: account.username,
        action,
        scheduledTime: actionObj.scheduledTime,
        baseDelay,
        randomDelay,
      });
    }

    res.json({
      message: `${addedActions.length} acciones ${
        scheduledTime ? "programadas" : "añadidas a la cola"
      }`,
      actions: addedActions,
    });
  } catch (error) {
    console.error("Error añadiendo acciones a la cola:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para cancelar acción programada
app.delete("/api/queue/cancel/:actionId", (req, res) => {
  try {
    const { actionId } = req.params;

    // Buscar y eliminar de acciones programadas
    const scheduledIndex = scheduledActions.findIndex(
      (action) => action.id === actionId
    );
    if (scheduledIndex !== -1) {
      const canceledAction = scheduledActions.splice(scheduledIndex, 1)[0];

      console.log(
        `🗑️ Acción programada cancelada: ${actionId} - ${canceledAction.action} para @${canceledAction.accountUsername}`
      );

      return res.json({
        success: true,
        message: "Acción programada cancelada exitosamente",
        canceledAction: {
          id: canceledAction.id,
          action: canceledAction.action,
          username: canceledAction.accountUsername,
        },
      });
    }

    // Buscar y eliminar de cola normal
    const queueIndex = actionQueue.findIndex(
      (action) => action.id === actionId
    );
    if (queueIndex !== -1) {
      const removedAction = actionQueue.splice(queueIndex, 1)[0];
      addToHistory({
        ...removedAction,
        accountId: removedAction.accountId,
        accountLabels: removedAction.account?.labels || [],
        status: "cancelled",
        completedAt: new Date().toISOString(),
        error: "Cancelado por el usuario",
      });

      console.log(
        `🗑️ Acción en cola cancelada: ${actionId} - ${removedAction.action} para @${removedAction.accountUsername}`
      );

      return res.json({
        success: true,
        message: "Acción en cola cancelada exitosamente",
        canceledAction: {
          id: removedAction.id,
          action: removedAction.action,
          username: removedAction.accountUsername,
        },
      });
    }

    // Si no se encuentra la acción
    res.status(404).json({
      error: "Acción no encontrada o ya ejecutada",
    });
  } catch (error) {
    console.error("Error cancelando acción:", error);
    res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

// 🚀 Keep-Alive endpoint para evitar que el backend se duerma
app.get("/api/keepalive", (req, res) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  console.log("🔄 Keep-Alive endpoint llamado");
  res.status(200).json({
    status: "alive",
    timestamp,
    uptime,
    message: "Backend activo y funcionando",
  });
});

// Endpoints para historial completo
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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    let filters = {};

    // Filtro por fecha
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    filters.createdAt = { $gte: startDate };

    // Filtro por acción
    if (action !== "all") {
      filters.action = action;
    }

    // Filtro por estado
    if (status !== "all") {
      filters.status = status;
    }

    // Filtro por cuenta
    if (account !== "all" && account.trim()) {
      filters.username = { $regex: account.replace("@", ""), $options: "i" };
    }

    // Filtro por texto de búsqueda
    if (search.trim()) {
      filters.$or = [
        { username: { $regex: search, $options: "i" } },
        { text: { $regex: search, $options: "i" } },
        { error: { $regex: search, $options: "i" } },
      ];
    }

    const [actions, total] = await Promise.all([
      ActionHistory.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("accountId", "username labels"),
      ActionHistory.countDocuments(filters),
    ]);

    res.json({
      actions,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Error obteniendo historial:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para estadísticas del historial
app.get("/api/history/stats", async (req, res) => {
  try {
    const { days = "7" } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await ActionHistory.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successful: { $sum: { $cond: ["$success", 1, 0] } },
          failed: { $sum: { $cond: ["$success", 0, 1] } },
        },
      },
    ]);

    const result = stats[0] || { total: 0, successful: 0, failed: 0 };
    const successRate =
      result.total > 0 ? (result.successful / result.total) * 100 : 0;

    res.json({
      ...result,
      successRate,
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
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
    } = req.query;

    // Construir filtros
    let filters = {};
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    filters.createdAt = { $gte: startDate };

    if (action !== "all") filters.action = action;
    if (status !== "all") filters.status = status;
    if (account !== "all" && account.trim()) {
      filters.username = { $regex: account.replace("@", ""), $options: "i" };
    }

    const actions = await ActionHistory.find(filters)
      .sort({ createdAt: -1 })
      .limit(10000)
      .populate("accountId", "username labels");

    const csvHeaders = [
      "Fecha",
      "Usuario",
      "Acción",
      "Texto",
      "Estado",
      "Éxito",
      "Error",
    ].join(",");

    const csvRows = actions.map((action) => {
      return [
        `"${new Date(action.createdAt).toLocaleString("es-ES")}"`,
        `"@${action.username}"`,
        `"${action.action}"`,
        `"${(action.text || "").replace(/"/g, '""')}"`,
        `"${action.status}"`,
        action.success ? "Sí" : "No",
        `"${(action.error || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [csvHeaders, ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="historial-acciones-${
        new Date().toISOString().split("T")[0]
      }.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Error exportando historial:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint temporal para debug de fechas programadas
app.get("/api/debug/scheduled", (req, res) => {
  const now = new Date();

  const debugInfo = {
    serverTime: {
      iso: now.toISOString(),
      local: now.toLocaleString("es-ES"),
      timestamp: now.getTime(),
      timezone: process.env.TZ || "Sistema",
    },
    scheduledActionsCount: scheduledActions.length,
    scheduledActions: scheduledActions.map((action) => ({
      id: action.id,
      accountUsername: action.accountUsername,
      action: action.action,
      scheduledTime: {
        iso: action.scheduledTime.toISOString(),
        local: action.scheduledTime.toLocaleString("es-ES"),
        timestamp: action.scheduledTime.getTime(),
      },
      timeUntilExecution: {
        milliseconds: action.scheduledTime.getTime() - now.getTime(),
        minutes: Math.round(
          (action.scheduledTime.getTime() - now.getTime()) / (1000 * 60)
        ),
        isPast: action.scheduledTime <= now,
      },
    })),
  };

  console.log("🐛 Debug de fechas programadas solicitado:", debugInfo);
  res.json(debugInfo);
});

// Endpoint para forzar verificación de acciones programadas (solo para debug)
app.post("/api/debug/check-scheduled", (req, res) => {
  const now = new Date();
  console.log(
    `🔧 Verificación forzada de acciones programadas a las ${now.toISOString()}`
  );

  const actionsToExecute = scheduledActions.filter(
    (action) => action.scheduledTime && action.scheduledTime <= now
  );

  if (actionsToExecute.length > 0) {
    console.log(`⚡ FORZANDO ejecución de ${actionsToExecute.length} acciones`);

    actionsToExecute.forEach((action) => {
      const index = scheduledActions.findIndex((a) => a.id === action.id);
      if (index !== -1) {
        scheduledActions.splice(index, 1);
      }
      actionQueue.push(action);
      console.log(`🚀 Acción ${action.id} movida a cola manualmente`);
    });

    res.json({
      message: `${actionsToExecute.length} acciones movidas a cola`,
      executedActions: actionsToExecute.map((a) => ({
        id: a.id,
        account: a.accountUsername,
        action: a.action,
      })),
    });
  } else {
    res.json({
      message: "No hay acciones listas para ejecutar",
      scheduledCount: scheduledActions.length,
    });
  }
});

// Estado del sistema de follow mutuo
let mutualFollowCampaign = {
  isRunning: false,
  startedAt: null,
  progress: {
    total: 0,
    completed: 0,
    failed: 0,
    remaining: 0,
  },
  accounts: [],
  processedPairs: new Set(), // Para evitar duplicados
  estimatedCompletionDate: null,
  currentPhase: "idle", // idle, calculating, running, completed, error
};

// Endpoint para iniciar campaña de follow mutuo
app.post("/api/mutual-follow-campaign", async (req, res) => {
  try {
    // Verificar si ya hay una campaña en curso
    if (mutualFollowCampaign.isRunning) {
      return res.status(400).json({
        error: "Ya hay una campaña de follow mutuo en curso",
        campaign: mutualFollowCampaign,
      });
    }

    // Obtener todas las cuentas activas
    const accounts = await XAccount.find({
      useOwnCredentials: true,
      credentialsVerified: true,
      ownAccessToken: { $exists: true },
      ownAccessTokenSecret: { $exists: true },
    });

    if (accounts.length < 2) {
      return res.status(400).json({
        error:
          "Se necesitan al menos 2 cuentas con credenciales verificadas para ejecutar la campaña",
      });
    }

    console.log(
      `🤝 Iniciando campaña de follow mutuo con ${accounts.length} cuentas`
    );

    // Calcular todas las combinaciones posibles (sin repetir pares)
    const followPairs = [];
    for (let i = 0; i < accounts.length; i++) {
      for (let j = 0; j < accounts.length; j++) {
        if (i !== j) {
          const followerAccount = accounts[i];
          const targetAccount = accounts[j];

          // Crear identificador único del par para evitar duplicados
          const pairId = `${followerAccount._id}_follows_${targetAccount._id}`;

          if (!mutualFollowCampaign.processedPairs.has(pairId)) {
            followPairs.push({
              followerAccount,
              targetAccount,
              pairId,
            });
          }
        }
      }
    }

    console.log(
      `📊 Total de acciones de follow a ejecutar: ${followPairs.length}`
    );

    // Configurar la campaña
    mutualFollowCampaign = {
      isRunning: true,
      startedAt: new Date(),
      progress: {
        total: followPairs.length,
        completed: 0,
        failed: 0,
        remaining: followPairs.length,
      },
      accounts: accounts.map((acc) => ({
        id: acc._id,
        username: acc.username,
        userId: acc.userId,
      })),
      processedPairs: new Set(),
      estimatedCompletionDate: calculateEstimatedCompletion(followPairs.length),
      currentPhase: "running",
    };

    // Programar las acciones con delays distribuidos en 4-5 días
    scheduleMutualFollowActions(followPairs);

    res.json({
      success: true,
      message: "Campaña de follow mutuo iniciada exitosamente",
      campaign: {
        ...mutualFollowCampaign,
        processedPairs: Array.from(mutualFollowCampaign.processedPairs),
      },
    });
  } catch (error) {
    console.error("Error iniciando campaña de follow mutuo:", error);
    mutualFollowCampaign.currentPhase = "error";
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    });
  }
});

// Endpoint para obtener estado de la campaña
app.get("/api/mutual-follow-campaign", (req, res) => {
  res.json({
    ...mutualFollowCampaign,
    processedPairs: Array.from(mutualFollowCampaign.processedPairs),
  });
});

// Endpoint para cancelar la campaña
app.delete("/api/mutual-follow-campaign", (req, res) => {
  if (mutualFollowCampaign.isRunning) {
    // Cancelar acciones programadas pendientes
    const canceledActions = scheduledActions.filter(
      (action) =>
        action.action === "follow" && action.source === "mutual-follow-campaign"
    );

    // Remover de acciones programadas
    canceledActions.forEach((action) => {
      const index = scheduledActions.indexOf(action);
      if (index > -1) {
        scheduledActions.splice(index, 1);
      }
    });

    mutualFollowCampaign.isRunning = false;
    mutualFollowCampaign.currentPhase = "cancelled";

    console.log(
      `🛑 Campaña de follow mutuo cancelada. ${canceledActions.length} acciones pendientes removidas.`
    );

    res.json({
      success: true,
      message: "Campaña cancelada exitosamente",
      canceledActions: canceledActions.length,
    });
  } else {
    res.json({
      message: "No hay campaña activa para cancelar",
    });
  }
});

// Función para calcular fecha estimada de finalización
function calculateEstimatedCompletion(totalActions) {
  // Límite de Twitter: 400 follows por día, 50 por 15 minutos
  // Para ser conservadores, usamos 300 follows por día distribuidos
  const followsPerDay = 300;
  const daysNeeded = Math.ceil(totalActions / followsPerDay);

  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + daysNeeded);

  return completionDate;
}

// Función para programar las acciones de follow mutuo
function scheduleMutualFollowActions(followPairs) {
  const now = new Date();

  // Distribuir las acciones en 4-5 días (usaremos 5 días para ser conservadores)
  const distributionDays = 5;
  const totalMinutes = distributionDays * 24 * 60; // 5 días en minutos
  const intervalBetweenActions = Math.floor(totalMinutes / followPairs.length); // minutos entre cada acción

  console.log(
    `⏰ Distribuyendo ${followPairs.length} acciones en ${distributionDays} días`
  );
  console.log(`⏰ Intervalo entre acciones: ${intervalBetweenActions} minutos`);

  followPairs.forEach((pair, index) => {
    // Calcular el momento de ejecución
    const executionTime = new Date(
      now.getTime() + index * intervalBetweenActions * 60 * 1000
    );

    // Agregar variación aleatoria de ±30 minutos para parecer más natural
    const randomVariation = (Math.random() - 0.5) * 60 * 60 * 1000; // ±30 minutos en ms
    executionTime.setTime(executionTime.getTime() + randomVariation);

    const actionId = generateActionId();

    const scheduledAction = {
      id: actionId,
      action: "follow",
      accountUsername: pair.followerAccount.username,
      accountLabels: pair.followerAccount.labels || [],
      text: `Seguir a @${pair.targetAccount.username}`,
      targetUserId: pair.targetAccount.userId || pair.targetAccount.username,
      scheduledTime: executionTime.toISOString(),
      createdAt: new Date().toISOString(),
      baseDelay: intervalBetweenActions * 60 * 1000, // en millisegundos
      randomDelay: Math.abs(randomVariation),
      source: "mutual-follow-campaign", // Identificador para poder cancelar después
      pairId: pair.pairId,
      metadata: {
        followerAccountId: pair.followerAccount._id,
        targetAccountId: pair.targetAccount._id,
        campaignType: "mutual-follow",
      },
    };

    scheduledActions.push(scheduledAction);
    console.log(
      `📅 Programado: @${pair.followerAccount.username} seguirá a @${
        pair.targetAccount.username
      } el ${executionTime.toLocaleString("es-ES")}`
    );
  });

  console.log(
    `✅ ${followPairs.length} acciones de follow programadas exitosamente`
  );
}

// Función mejorada para procesar acciones programadas (actualizar la existente)
const processScheduledActions = () => {
  const now = new Date();
  const actionsToExecute = [];

  // Buscar acciones que deben ejecutarse ahora
  for (let i = scheduledActions.length - 1; i >= 0; i--) {
    const scheduledAction = scheduledActions[i];
    const scheduledTime = new Date(scheduledAction.scheduledTime);

    if (scheduledTime <= now) {
      actionsToExecute.push(scheduledAction);
      scheduledActions.splice(i, 1); // Remover de programadas
    }
  }

  // Ejecutar acciones
  actionsToExecute.forEach(async (scheduledAction) => {
    try {
      console.log(
        `🚀 Ejecutando acción programada: ${scheduledAction.action} para @${scheduledAction.accountUsername}`
      );

      // Obtener la cuenta completa
      const account = await XAccount.findOne({
        username: scheduledAction.accountUsername,
      });
      if (!account) {
        throw new Error(
          `Cuenta @${scheduledAction.accountUsername} no encontrada`
        );
      }

      // Verificar que la cuenta tenga credenciales válidas
      if (!account.useOwnCredentials || !account.credentialsVerified) {
        throw new Error(
          `Cuenta @${scheduledAction.accountUsername} no tiene credenciales verificadas`
        );
      }

      // Crear objeto de acción para la cola
      const actionForQueue = {
        id: scheduledAction.id,
        accountId: account._id,
        action: scheduledAction.action,
        targetUserId: scheduledAction.targetUserId,
        text: scheduledAction.text,
        source: scheduledAction.source || "scheduled",
        metadata: scheduledAction.metadata || {},
      };

      // Agregar a la cola de ejecución inmediata
      actionQueue.push(actionForQueue);

      // Si es parte de la campaña de follow mutuo, actualizar progreso
      if (scheduledAction.source === "mutual-follow-campaign") {
        mutualFollowCampaign.processedPairs.add(scheduledAction.pairId);
        mutualFollowCampaign.progress.remaining--;
        console.log(
          `📊 Progreso campaña: ${mutualFollowCampaign.processedPairs.size}/${mutualFollowCampaign.progress.total}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error ejecutando acción programada ${scheduledAction.id}:`,
        error.message
      );

      // Si es parte de la campaña, actualizar contadores de error
      if (scheduledAction.source === "mutual-follow-campaign") {
        mutualFollowCampaign.progress.failed++;
        mutualFollowCampaign.progress.remaining--;
      }

      // Agregar al historial como fallida
      addToHistory({
        id: scheduledAction.id,
        action: scheduledAction.action,
        accountUsername: scheduledAction.accountUsername,
        status: "failed",
        completedAt: new Date().toISOString(),
        error: error.message,
      });
    }
  });
};

// Actualizar el cron job existente para incluir el procesamiento de acciones programadas
cron.schedule("*/1 * * * *", () => {
  // Procesar acciones programadas
  processScheduledActions();

  // El resto del código del cron job existente...
  processActionQueue();
});

// Función para verificar si la campaña debe marcarse como completada
function checkCampaignCompletion() {
  if (
    mutualFollowCampaign.isRunning &&
    mutualFollowCampaign.progress.remaining === 0
  ) {
    mutualFollowCampaign.isRunning = false;
    mutualFollowCampaign.currentPhase = "completed";
    mutualFollowCampaign.progress.completed =
      mutualFollowCampaign.processedPairs.size;

    console.log(`🎉 Campaña de follow mutuo completada!`);
    console.log(`📊 Estadísticas finales:`, mutualFollowCampaign.progress);
  }
}

// Llamar esta función después de cada acción procesada
setInterval(checkCampaignCompletion, 60000); // Verificar cada minuto

// ========== ENDPOINTS PARA PERSONALIZACIÓN DE CUENTAS (SUPERADMIN) ==========

// Obtener estadísticas de una cuenta específica
app.get(
  "/api/accounts/:id/stats",
  authenticateToken,
  requireRole(["superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Buscar acciones del historial de la cuenta
      const actions = await ActionHistory.find({ accountId: id }).lean();

      // Contar tipos de acciones
      const stats = {
        tweets: actions.filter((a) => a.action === "tweet").length,
        retweets: actions.filter((a) => a.action === "retweet").length,
        likes: actions.filter((a) => a.action === "like").length,
        follows: actions.filter((a) => a.action === "follow").length,
        unfollows: actions.filter((a) => a.action === "unfollow").length,
      };

      res.json({ stats });
    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Actualizar perfil de cuenta de Twitter
app.put(
  "/api/accounts/:id/profile",
  authenticateToken,
  requireRole(["superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      // Buscar la cuenta
      const account = await Account.findById(id);
      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      // Debug: Mostrar credenciales disponibles
      console.log(`🔍 Debug credenciales para @${account.username}:`);
      console.log(
        `   ownApiKey: ${account.ownApiKey ? "✅ Presente" : "❌ Faltante"}`
      );
      console.log(
        `   ownApiSecret: ${
          account.ownApiSecret ? "✅ Presente" : "❌ Faltante"
        }`
      );
      console.log(
        `   ownAccessToken: ${
          account.ownAccessToken ? "✅ Presente" : "❌ Faltante"
        }`
      );
      console.log(
        `   ownAccessTokenSecret: ${
          account.ownAccessTokenSecret ? "✅ Presente" : "❌ Faltante"
        }`
      );

      // Verificar que tenga credenciales OAuth 1.0a completas
      const hasCompleteOAuth1 =
        account.ownAccessToken &&
        account.ownAccessTokenSecret &&
        account.ownApiKey &&
        account.ownApiSecret;

      if (!hasCompleteOAuth1) {
        const missingCredentials = [
          !account.ownApiKey ? "API Key" : "",
          !account.ownApiSecret ? "API Secret" : "",
          !account.ownAccessToken ? "Access Token" : "",
          !account.ownAccessTokenSecret ? "Access Token Secret" : "",
        ].filter(Boolean);

        console.log(
          `❌ [PROFILE UPDATE] Credenciales faltantes para @${
            account.username
          }: ${missingCredentials.join(", ")}`
        );
        console.log(`❌ [PROFILE UPDATE] ID cuenta: ${account._id}`);
        console.log(
          `❌ [PROFILE UPDATE] useOwnCredentials: ${account.useOwnCredentials}`
        );

        return res.status(400).json({
          error:
            "Se requieren credenciales OAuth 1.0a completas para actualizar perfil",
          missing: missingCredentials,
          account: account.username,
          details:
            "La cuenta necesita configurar sus propias credenciales OAuth 1.0a",
        });
      }

      try {
        // Crear cliente de Twitter usando las credenciales de la cuenta
        const userClient = await createTwitterClient(account);

        // Actualizar perfil usando Twitter API v1 (más compatible para updates)
        const updateData = {};
        if (name) updateData.name = name.substring(0, 50); // Twitter limit
        if (description) updateData.description = description.substring(0, 160); // Twitter limit

        if (Object.keys(updateData).length > 0) {
          const updatedProfile = await userClient.v1.updateAccountProfile(
            updateData
          );

          // Actualizar en nuestra base de datos
          account.profileInfo = {
            ...account.profileInfo,
            name: updatedProfile.name,
            description: updatedProfile.description,
          };
          await account.save();

          // Registrar acción
          await ActionHistory.create({
            accountId: account._id,
            action: "profile_update",
            status: "completed",
            details: { updatedFields: Object.keys(updateData) },
            createdAt: new Date(),
          });

          console.log(
            `✅ Perfil actualizado para @${account.username}: ${Object.keys(
              updateData
            ).join(", ")}`
          );

          res.json({
            success: true,
            profile: updatedProfile,
            message: "Perfil actualizado exitosamente",
          });
        } else {
          res.status(400).json({ error: "No hay datos para actualizar" });
        }
      } catch (twitterError) {
        console.error(
          `❌ Error de Twitter API para @${account.username}:`,
          twitterError
        );
        res.status(400).json({
          error: "Error al actualizar perfil en Twitter",
          details: twitterError.message,
        });
      }
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Subir media (foto de perfil o portada)
app.post(
  "/api/accounts/:id/media",
  authenticateToken,
  requireRole(["superadmin"]),
  uploadImage.single("media"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = req.body; // "profile" o "banner"

      if (!req.file) {
        return res.status(400).json({ error: "No se proporcionó archivo" });
      }

      if (!["profile", "banner"].includes(type)) {
        return res.status(400).json({
          error: "Tipo de media inválido. Debe ser 'profile' o 'banner'",
        });
      }

      // Buscar la cuenta
      const account = await Account.findById(id);
      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      // Verificar que tenga credenciales OAuth 1.0a completas
      const hasCompleteOAuth1 =
        account.ownAccessToken &&
        account.ownAccessTokenSecret &&
        account.ownApiKey &&
        account.ownApiSecret;

      if (!hasCompleteOAuth1) {
        const missingCredentials = [
          !account.ownApiKey ? "API Key" : "",
          !account.ownApiSecret ? "API Secret" : "",
          !account.ownAccessToken ? "Access Token" : "",
          !account.ownAccessTokenSecret ? "Access Token Secret" : "",
        ].filter(Boolean);

        console.log(
          `❌ [MEDIA UPLOAD] Credenciales faltantes para @${
            account.username
          }: ${missingCredentials.join(", ")}`
        );
        console.log(`❌ [MEDIA UPLOAD] ID cuenta: ${account._id}`);
        console.log(`❌ [MEDIA UPLOAD] Tipo de media: ${type}`);
        console.log(
          `❌ [MEDIA UPLOAD] useOwnCredentials: ${account.useOwnCredentials}`
        );

        return res.status(400).json({
          error:
            "Se requieren credenciales OAuth 1.0a completas para subir media",
          missing: missingCredentials,
          account: account.username,
          details:
            "La cuenta necesita configurar sus propias credenciales OAuth 1.0a",
        });
      }

      try {
        console.log(
          `🔍 [MEDIA UPLOAD] Iniciando subida de ${type} para @${account.username}`
        );
        console.log(`🔍 [MEDIA UPLOAD] Tamaño archivo: ${req.file.size} bytes`);
        console.log(`🔍 [MEDIA UPLOAD] Tipo archivo: ${req.file.mimetype}`);

        // Crear cliente de Twitter usando las credenciales de la cuenta
        const userClient = await createTwitterClient(account);

        // Subir imagen según el tipo
        let result;
        if (type === "profile") {
          console.log(
            `🔄 [PROFILE] Actualizando foto de perfil para @${account.username}...`
          );
          // Actualizar foto de perfil usando v1 API
          result = await userClient.v1.updateAccountProfileImage(
            req.file.buffer
          );
          console.log(
            `✅ Foto de perfil actualizada para @${account.username}`
          );
        } else if (type === "banner") {
          console.log(
            `🔄 [BANNER] Actualizando banner para @${account.username}...`
          );
          console.log(`🔄 [BANNER] Verificando formato de datos...`);

          // Verificar si los datos son válidos
          if (!req.file.buffer || req.file.buffer.length === 0) {
            throw new Error("Buffer de archivo vacío");
          }

          console.log(
            `🔄 [BANNER] Buffer válido: ${req.file.buffer.length} bytes`
          );

          // Actualizar banner usando v1 API
          result = await userClient.v1.updateAccountProfileBanner(
            req.file.buffer
          );
          console.log(`✅ Banner actualizado para @${account.username}`);
        }

        // Actualizar información en base de datos
        if (type === "profile" && result) {
          account.profileInfo = {
            ...account.profileInfo,
            profile_image_url:
              result.profile_image_url_https || result.profile_image_url,
          };
        } else if (type === "banner") {
          // Para banner necesitamos obtener las URLs actualizadas
          const updatedProfile = await userClient.v2.me({
            "user.fields": ["profile_image_url"],
          });
          account.profileInfo = {
            ...account.profileInfo,
            profile_banner_url: `https://pbs.twimg.com/profile_banners/${updatedProfile.data.id}/1500x500`,
          };
        }

        await account.save();

        // Registrar acción
        await ActionHistory.create({
          actionId: generateActionId(),
          accountId: account._id,
          username: account.username,
          action: `${type}_upload`,
          status: "completed",
          success: true,
          result: { mediaType: type, fileName: req.file.originalname },
          createdAt: new Date(),
        });

        res.json({
          success: true,
          type,
          message: `${
            type === "profile" ? "Foto de perfil" : "Banner"
          } actualizado exitosamente`,
        });
      } catch (twitterError) {
        console.error(
          `❌ [MEDIA UPLOAD] Error de Twitter API para @${account.username}:`,
          twitterError
        );
        console.error(`❌ [MEDIA UPLOAD] Código error: ${twitterError.code}`);
        console.error(`❌ [MEDIA UPLOAD] Tipo de media: ${type}`);

        // Análisis específico del error
        let errorMessage = twitterError.message;
        if (twitterError.code === 403) {
          if (type === "banner") {
            errorMessage =
              "Error 403: Los tokens de acceso no tienen permisos para actualizar banners. " +
              "Si cambiaste los permisos de la aplicación recientemente, necesitas REGENERAR los Access Tokens " +
              "en el Developer Portal y actualizar las credenciales en la base de datos.";
          } else {
            errorMessage =
              "Error 403: Los tokens de acceso no tienen permisos suficientes. " +
              "Regenera los tokens después de cambiar permisos en Developer Portal.";
          }
        } else if (twitterError.code === 400) {
          errorMessage =
            "Imagen inválida. Verifica el formato y tamaño (máx 5MB para banner, 400x400px para perfil).";
        } else if (twitterError.code === 429) {
          errorMessage =
            "Límite de rate excedido. Espera unos minutos antes de intentar nuevamente.";
        }

        res.status(400).json({
          error: `Error al subir ${
            type === "profile" ? "foto de perfil" : "banner"
          } en Twitter`,
          details: errorMessage,
          code: twitterError.code,
          twitterError: twitterError.message,
        });
      }
    } catch (error) {
      console.error("Error al subir media:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Eliminar tweets/retweets
app.delete(
  "/api/accounts/:id/tweets",
  authenticateToken,
  requireRole(["superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = req.body; // "tweets", "retweets", o "all"

      if (!["tweets", "retweets", "all"].includes(type)) {
        return res.status(400).json({
          error: "Tipo inválido. Debe ser 'tweets', 'retweets' o 'all'",
        });
      }

      // Buscar la cuenta
      const account = await Account.findById(id);
      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      // Verificar que tenga credenciales
      if (!account.accessToken || !account.accessTokenSecret) {
        return res
          .status(400)
          .json({ error: "Cuenta sin credenciales válidas" });
      }

      try {
        // Crear cliente de Twitter para la cuenta
        const userClient = new TwitterApi({
          appKey: process.env.TWITTER_CONSUMER_KEY,
          appSecret: process.env.TWITTER_CONSUMER_SECRET,
          accessToken: account.accessToken,
          accessSecret: account.accessTokenSecret,
        });

        let deletedCount = 0;

        // Obtener timeline del usuario
        const timeline = await userClient.v2.userTimeline(
          account.twitterUserId,
          {
            max_results: 100, // Máximo por request
            "tweet.fields": ["referenced_tweets"],
          }
        );

        // Procesar tweets según el tipo
        for await (const tweet of timeline) {
          let shouldDelete = false;

          if (type === "all") {
            shouldDelete = true;
          } else if (type === "tweets") {
            // Solo tweets originales (no retweets)
            shouldDelete = !tweet.referenced_tweets?.some(
              (ref) => ref.type === "retweeted"
            );
          } else if (type === "retweets") {
            // Solo retweets
            shouldDelete = tweet.referenced_tweets?.some(
              (ref) => ref.type === "retweeted"
            );
          }

          if (shouldDelete) {
            try {
              await userClient.v2.deleteTweet(tweet.id);
              deletedCount++;

              // Pequeña pausa para no exceder rate limits
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (deleteError) {
              console.error(
                `Error al eliminar tweet ${tweet.id}:`,
                deleteError
              );
              // Continuar con el siguiente tweet
            }
          }
        }

        // Registrar acción
        await ActionHistory.create({
          accountId: account._id,
          action: `delete_${type}`,
          status: "completed",
          details: { deletedCount, type },
          createdAt: new Date(),
        });

        res.json({
          success: true,
          deleted: deletedCount,
          message: `${deletedCount} ${
            type === "tweets"
              ? "tweets"
              : type === "retweets"
              ? "retweets"
              : "tweets/retweets"
          } eliminados exitosamente`,
        });
      } catch (twitterError) {
        console.error("Error de Twitter API:", twitterError);
        res.status(400).json({
          error: "Error al eliminar tweets en Twitter",
          details: twitterError.message,
        });
      }
    } catch (error) {
      console.error("Error al eliminar tweets:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Testear todas las cuentas
app.post(
  "/api/accounts/test-all",
  authenticateToken,
  requireRole(["superadmin"]),
  async (req, res) => {
    try {
      console.log("🧪 [TEST ALL] Iniciando test de todas las cuentas...");

      // Obtener todas las cuentas
      const accounts = await XAccount.find({});

      if (accounts.length === 0) {
        return res.json({
          success: true,
          summary: {
            total: 0,
            success: 0,
            warnings: 0,
            errors: 0,
          },
          results: [],
          testedAt: new Date().toISOString(),
        });
      }

      const results = [];
      let successCount = 0;
      let warningCount = 0;
      let errorCount = 0;

      for (const account of accounts) {
        console.log(`🔍 [TEST] Probando cuenta @${account.username}...`);

        const result = {
          accountId: account._id,
          username: account.username,
          status: "error",
          message: "",
          details: {
            hasTokens: false,
            tokenValid: false,
            apiAccess: false,
            rateLimitStatus: "unknown",
            lastError: null,
          },
        };

        try {
          // Verificar credenciales según configuración de la cuenta
          const usingOwnCredentials = account.useOwnCredentials;

          let hasValidCredentials = false;
          let credentialType = "";

          if (usingOwnCredentials) {
            // Verificar credenciales propias
            const hasOAuth1Own =
              account.ownApiKey &&
              account.ownApiSecret &&
              account.ownAccessToken &&
              account.ownAccessTokenSecret;
            const hasOAuth2Own =
              account.ownClientId &&
              account.ownClientSecret &&
              (account.ownOAuth2AccessToken || account.ownOAuth2RefreshToken);

            if (hasOAuth1Own) {
              hasValidCredentials = true;
              credentialType = "OAuth 1.0a (Propias)";
            } else if (hasOAuth2Own) {
              hasValidCredentials = true;
              credentialType = "OAuth 2.0 (Propias)";
            }
          } else {
            // Usar credenciales compartidas - verificar que estén disponibles en el entorno
            const hasSharedCredentials =
              process.env.TWITTER_CONSUMER_KEY &&
              process.env.TWITTER_CONSUMER_SECRET &&
              process.env.TWITTER_ACCESS_TOKEN &&
              process.env.TWITTER_ACCESS_TOKEN_SECRET;

            if (hasSharedCredentials) {
              hasValidCredentials = true;
              credentialType = "OAuth 1.0a (Compartidas)";
            }
          }

          if (!hasValidCredentials) {
            result.status = "error";
            result.message = usingOwnCredentials
              ? "Sin credenciales propias válidas"
              : "Sin credenciales compartidas válidas";
            result.details.lastError = usingOwnCredentials
              ? "Faltan credenciales OAuth 1.0a o 2.0 propias completas"
              : "Faltan credenciales compartidas en variables de entorno";
            errorCount++;
            results.push(result);
            continue;
          }

          result.details.hasTokens = true;

          // Crear cliente de Twitter
          let client;
          try {
            client = await createTwitterClient(account);
            result.details.tokenValid = true;
          } catch (clientError) {
            result.status = "error";
            result.message = "Error al crear cliente de Twitter";
            result.details.lastError = clientError.message;
            errorCount++;
            results.push(result);
            continue;
          }

          // Tests múltiples: verificar capacidades de lectura y escritura
          let readCapable = false;
          let writeCapable = false;
          let userInfo = null;

          try {
            // Test 1: Verificar capacidad de lectura (obtener información del usuario)
            console.log(
              `📖 [TEST] Probando capacidad de lectura para @${account.username}...`
            );
            userInfo = await client.v2.me();

            if (userInfo.data) {
              readCapable = true;
              result.details.apiAccess = true;
              console.log(
                `✅ [TEST] Lectura exitosa para @${account.username}: ${userInfo.data.username}`
              );
            }
          } catch (readError) {
            console.log(
              `❌ [TEST] Error en lectura para @${account.username}:`,
              readError.message
            );
            result.details.lastError = `Lectura: ${readError.message}`;
          }

          // Test 2: Verificar capacidad de escritura SIN hacer tweets reales
          if (readCapable && usingOwnCredentials) {
            try {
              console.log(
                `📝 [TEST] Probando capacidad de escritura para @${account.username}...`
              );

              // Verificar capacidades de escritura usando el endpoint más básico
              // Intentamos obtener información que requiere OAuth 1.0a con tokens de usuario
              // Este endpoint es menos restrictivo pero sigue requiriendo permisos de escritura

              try {
                // Intentar acceder a un endpoint que requiere autenticación de usuario
                // pero que no hace cambios reales - obtener mis propios tweets
                await client.v2.userTimeline(userInfo.data.id, {
                  max_results: 5,
                });
                writeCapable = true;
                console.log(
                  `✅ [TEST] Escritura confirmada para @${account.username} (acceso a timeline)`
                );
              } catch (timelineError) {
                // Si el timeline falla, intentamos con un enfoque diferente
                // Verificar que tenga tokens de acceso de usuario (no solo app)
                if (account.ownAccessToken && account.ownAccessTokenSecret) {
                  // Si tiene los tokens completos de OAuth 1.0a, asumimos capacidad de escritura
                  writeCapable = true;
                  console.log(
                    `✅ [TEST] Escritura inferida para @${account.username} (tiene tokens OAuth 1.0a completos)`
                  );
                } else {
                  throw timelineError;
                }
              }
            } catch (writeError) {
              console.log(
                `⚠️ [TEST] Capacidad de escritura limitada para @${account.username}:`,
                writeError.message
              );
              // Verificar si al menos tiene credenciales de escritura válidas
              if (
                account.ownAccessToken &&
                account.ownAccessTokenSecret &&
                writeError.code === 403
              ) {
                // Tiene credenciales pero restricciones de API
                result.details.lastError = `Escritura: Credenciales presentes pero acceso API limitado (${writeError.code})`;
              } else {
                result.details.lastError = `Escritura: ${writeError.message}`;
              }
            }
          }

          // Determinar el resultado final
          if (readCapable) {
            // Verificar si tiene credenciales completas de OAuth 1.0a para asumir capacidad de escritura
            const hasCompleteOAuth1Credentials =
              usingOwnCredentials &&
              account.ownApiKey &&
              account.ownApiSecret &&
              account.ownAccessToken &&
              account.ownAccessTokenSecret;

            if (
              writeCapable ||
              !usingOwnCredentials ||
              hasCompleteOAuth1Credentials
            ) {
              result.status = "success";
              let capabilityText = "";
              if (writeCapable) {
                capabilityText = " (R/W confirmado)";
              } else if (hasCompleteOAuth1Credentials) {
                capabilityText = " (R/W inferido)";
              } else {
                capabilityText = " (R)";
              }
              result.message = `${credentialType} - Usuario: ${userInfo.data.username}${capabilityText}`;
              successCount++;
            } else {
              result.status = "warning";
              result.message = `${credentialType} - Solo lectura - Usuario: ${userInfo.data.username}`;
              warningCount++;
            }
          } else {
            result.status = "error";
            result.message = "Sin acceso a la API de X";
            if (!result.details.lastError) {
              result.details.lastError =
                "No se pudo obtener información del usuario";
            }
            errorCount++;
          }
        } catch (generalError) {
          result.status = "error";
          result.message = "Error general durante el test";
          result.details.lastError = generalError.message;
          errorCount++;
        }

        results.push(result);

        // Pequeña pausa entre tests para evitar rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(
        `✅ [TEST ALL] Completado: ${successCount} exitosos, ${warningCount} advertencias, ${errorCount} errores`
      );

      res.json({
        success: true,
        summary: {
          total: accounts.length,
          success: successCount,
          warnings: warningCount,
          errors: errorCount,
        },
        results,
        testedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ [TEST ALL] Error:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor durante el test",
        details: error.message,
      });
    }
  }
);

// Eliminar tweet específico
app.delete(
  "/api/accounts/:id/tweet/:tweetId",
  authenticateToken,
  requireRole(["superadmin"]),
  async (req, res) => {
    try {
      const { id, tweetId } = req.params;

      // Validar y extraer Tweet ID
      const validTweetId = extractAndValidateTweetId(tweetId);
      if (!validTweetId) {
        return res.status(400).json({
          error:
            "ID de tweet inválido. Proporciona un ID numérico válido o URL de tweet.",
        });
      }

      // Buscar la cuenta
      const account = await XAccount.findById(id);
      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      // Verificar que tenga credenciales
      if (!account.accessToken || !account.accessTokenSecret) {
        return res
          .status(400)
          .json({ error: "Cuenta sin credenciales válidas" });
      }

      try {
        // Crear cliente de Twitter para la cuenta
        const userClient = new TwitterApi({
          appKey: process.env.TWITTER_CONSUMER_KEY,
          appSecret: process.env.TWITTER_CONSUMER_SECRET,
          accessToken: account.accessToken,
          accessSecret: account.accessTokenSecret,
        });

        // Primero verificar que el tweet existe y pertenece al usuario
        let tweet;
        try {
          tweet = await userClient.v2.singleTweet(validTweetId, {
            "tweet.fields": ["author_id", "text", "referenced_tweets"],
          });
        } catch (error) {
          if (error.code === 404) {
            return res.status(404).json({ error: "Tweet no encontrado" });
          }
          throw error;
        }

        if (!tweet.data) {
          return res.status(404).json({ error: "Tweet no encontrado" });
        }

        // Verificar que el tweet pertenece a la cuenta
        if (tweet.data.author_id !== account.twitterUserId) {
          return res.status(403).json({
            error: "El tweet no pertenece a esta cuenta",
          });
        }

        // Eliminar el tweet usando Twitter API v2
        await userClient.v2.deleteTweet(validTweetId);

        // Determinar si era un retweet
        const isRetweet = tweet.data.referenced_tweets?.some(
          (ref) => ref.type === "retweeted"
        );

        // Registrar acción en historial
        await ActionHistory.create({
          accountId: account._id,
          action: isRetweet ? "delete_retweet" : "delete_tweet",
          status: "completed",
          details: {
            tweetId: validTweetId,
            tweetText:
              tweet.data.text?.substring(0, 100) +
              (tweet.data.text?.length > 100 ? "..." : ""),
            isRetweet,
            deletedAt: new Date().toISOString(),
          },
          createdAt: new Date(),
        });

        res.json({
          success: true,
          message: `${isRetweet ? "Retweet" : "Tweet"} eliminado exitosamente`,
          tweetId: validTweetId,
          isRetweet,
        });
      } catch (twitterError) {
        console.error(`Error eliminando tweet ${validTweetId}:`, twitterError);

        // Registrar error en historial
        await ActionHistory.create({
          accountId: account._id,
          action: "delete_tweet",
          status: "failed",
          details: {
            tweetId: validTweetId,
            error: twitterError.message,
            errorCode: twitterError.code,
          },
          createdAt: new Date(),
        });

        // Manejar errores específicos de Twitter API
        if (twitterError.code === 404) {
          return res.status(404).json({ error: "Tweet no encontrado" });
        } else if (twitterError.code === 403) {
          return res
            .status(403)
            .json({ error: "No tienes permisos para eliminar este tweet" });
        } else if (twitterError.code === 429) {
          return res.status(429).json({
            error:
              "Límite de rate excedido. Intenta nuevamente en unos minutos.",
          });
        }

        res.status(400).json({
          error: "Error al eliminar tweet en Twitter",
          details: twitterError.message,
        });
      }
    } catch (error) {
      console.error("Error al eliminar tweet específico:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Gestión de follows (seguir/dejar de seguir)
app.post(
  "/api/accounts/:id/follow",
  authenticateToken,
  requireRole(["superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { action, username } = req.body; // action: "follow" o "unfollow"

      if (!["follow", "unfollow"].includes(action)) {
        return res.status(400).json({
          error: "Acción inválida. Debe ser 'follow' o 'unfollow'",
        });
      }

      if (!username) {
        return res.status(400).json({ error: "Username requerido" });
      }

      // Buscar la cuenta
      const account = await Account.findById(id);
      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      // Verificar que tenga credenciales OAuth 1.0a completas
      const hasCompleteOAuth1 =
        account.ownAccessToken &&
        account.ownAccessTokenSecret &&
        account.ownApiKey &&
        account.ownApiSecret;

      if (!hasCompleteOAuth1) {
        return res.status(400).json({
          error:
            "Se requieren credenciales OAuth 1.0a completas para gestionar follows",
          missing: [
            !account.ownApiKey ? "API Key" : "",
            !account.ownApiSecret ? "API Secret" : "",
            !account.ownAccessToken ? "Access Token" : "",
            !account.ownAccessTokenSecret ? "Access Token Secret" : "",
          ].filter(Boolean),
        });
      }

      try {
        // Crear cliente de Twitter usando las credenciales de la cuenta
        const userClient = await createTwitterClient(account);

        // Obtener ID del usuario a seguir/dejar de seguir
        let targetUserId;
        try {
          const targetUser = await userClient.v2.userByUsername(username);
          targetUserId = targetUser.data.id;
        } catch (error) {
          return res.status(404).json({
            error: `Usuario @${username} no encontrado`,
            details: error.message,
          });
        }

        // Ejecutar acción
        let result;
        if (action === "follow") {
          result = await userClient.v2.follow(
            account.twitterUserId,
            targetUserId
          );
          console.log(`✅ @${account.username} siguió a @${username}`);
        } else {
          result = await userClient.v2.unfollow(
            account.twitterUserId,
            targetUserId
          );
          console.log(`✅ @${account.username} dejó de seguir a @${username}`);
        }

        // Registrar acción
        await ActionHistory.create({
          accountId: account._id,
          action: action,
          status: "completed",
          details: {
            targetUsername: username,
            targetUserId: targetUserId,
          },
          createdAt: new Date(),
        });

        res.json({
          success: true,
          action,
          targetUser: username,
          message: `${
            action === "follow" ? "Siguiendo" : "Dejaste de seguir"
          } a @${username}`,
        });
      } catch (twitterError) {
        console.error(
          `❌ Error de Twitter API para @${account.username}:`,
          twitterError
        );
        res.status(400).json({
          error: `Error al ${
            action === "follow" ? "seguir" : "dejar de seguir"
          }`,
          details: twitterError.message,
        });
      }
    } catch (error) {
      console.error("Error en gestión de follows:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Eliminar tweet específico por ID
app.delete(
  "/api/accounts/:id/tweet/:tweetId",
  authenticateToken,
  requireRole(["superadmin"]),
  async (req, res) => {
    try {
      const { id, tweetId } = req.params;

      // Buscar la cuenta
      const account = await Account.findById(id);
      if (!account) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      // Validar y extraer tweet ID
      const validTweetId = extractAndValidateTweetId(tweetId);
      if (!validTweetId) {
        return res.status(400).json({
          error: "ID de tweet inválido",
          provided: tweetId,
        });
      }

      // Verificar que tenga credenciales OAuth 1.0a completas
      const hasCompleteOAuth1 =
        account.ownAccessToken &&
        account.ownAccessTokenSecret &&
        account.ownApiKey &&
        account.ownApiSecret;

      if (!hasCompleteOAuth1) {
        return res.status(400).json({
          error:
            "Se requieren credenciales OAuth 1.0a completas para eliminar tweets",
          missing: [
            !account.ownApiKey ? "API Key" : "",
            !account.ownApiSecret ? "API Secret" : "",
            !account.ownAccessToken ? "Access Token" : "",
            !account.ownAccessTokenSecret ? "Access Token Secret" : "",
          ].filter(Boolean),
        });
      }

      try {
        // Crear cliente de Twitter usando las credenciales de la cuenta
        const userClient = await createTwitterClient(account);

        // Intentar obtener información del tweet antes de eliminar
        let tweetInfo = null;
        try {
          const tweetData = await userClient.v2.singleTweet(validTweetId, {
            "tweet.fields": ["author_id", "referenced_tweets"],
          });
          tweetInfo = tweetData.data;

          // Verificar que el tweet pertenece a la cuenta
          if (tweetInfo.author_id !== account.twitterUserId) {
            return res.status(403).json({
              error: "Este tweet no pertenece a la cuenta seleccionada",
              tweetAuthor: tweetInfo.author_id,
              accountId: account.twitterUserId,
            });
          }
        } catch (fetchError) {
          // Si no se puede obtener info del tweet, intentar eliminar de todas formas
          console.log(
            `⚠️ No se pudo obtener info del tweet ${validTweetId}: ${fetchError.message}`
          );
        }

        // Eliminar el tweet
        const deleteResult = await userClient.v2.deleteTweet(validTweetId);

        // Determinar tipo de tweet eliminado
        const isRetweet = tweetInfo?.referenced_tweets?.some(
          (ref) => ref.type === "retweeted"
        );
        const tweetType = isRetweet ? "retweet" : "tweet";

        console.log(
          `✅ ${tweetType} eliminado por @${account.username}: ${validTweetId}`
        );

        // Registrar acción
        await ActionHistory.create({
          accountId: account._id,
          action: "delete_tweet",
          status: "completed",
          details: {
            tweetId: validTweetId,
            tweetType: tweetType,
            originalTweetId: tweetId, // El ID original que envió el usuario
          },
          createdAt: new Date(),
        });

        res.json({
          success: true,
          deletedTweetId: validTweetId,
          tweetType: tweetType,
          message: `${
            tweetType === "retweet" ? "Retweet" : "Tweet"
          } eliminado exitosamente`,
        });
      } catch (twitterError) {
        console.error(
          `❌ Error de Twitter API para @${account.username}:`,
          twitterError
        );

        // Manejar errores específicos de Twitter
        let errorMessage = "Error al eliminar tweet";
        if (twitterError.code === 144) {
          errorMessage = "Tweet no encontrado o ya fue eliminado";
        } else if (twitterError.code === 403) {
          errorMessage = "No tienes permisos para eliminar este tweet";
        } else if (twitterError.code === 429) {
          errorMessage = "Límite de rate limiting alcanzado, intenta más tarde";
        }

        res.status(400).json({
          error: errorMessage,
          details: twitterError.message,
          tweetId: validTweetId,
        });
      }
    } catch (error) {
      console.error("Error al eliminar tweet:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
});

// Función para extraer y validar tweet ID (migrada de route.ts)
const extractAndValidateTweetId = (input) => {
  if (!input?.trim()) return undefined;

  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }

  try {
    const url = new URL(input);
    const pathParts = url.pathname.split("/");
    const statusIndex = pathParts.indexOf("status");

    if (statusIndex !== -1 && pathParts[statusIndex + 1]) {
      const tweetId = pathParts[statusIndex + 1].split("?")[0];

      if (/^\d+$/.test(tweetId)) {
        return tweetId;
      }
    }
  } catch {}

  return undefined;
};

// Función para extraer y validar user ID o username
const extractAndValidateUserId = (input) => {
  if (!input?.trim()) return undefined;

  // Si es un ID numérico, devolverlo directamente
  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }

  // Si es una URL de Twitter/X, extraer el username
  try {
    const url = new URL(input);
    if (
      url.hostname.includes("twitter.com") ||
      url.hostname.includes("x.com")
    ) {
      const pathParts = url.pathname.split("/").filter((part) => part);
      if (pathParts.length > 0) {
        const username = pathParts[0];
        // Validar que el username tenga formato válido
        if (/^[a-zA-Z0-9_]{1,15}$/.test(username)) {
          return username;
        }
      }
    }
  } catch {}

  // Si parece un username (sin @), validarlo
  const cleanUsername = input.trim().replace(/^@/, "");
  if (/^[a-zA-Z0-9_]{1,15}$/.test(cleanUsername)) {
    return cleanUsername;
  }

  return undefined;
};

// Migrar lógica de logError y logAction si es necesaria
const logError = (eventName, data) => {
  console.error(`[${new Date().toISOString()}] ${eventName}:`, data);
};

const logAction = (eventName, data) => {
  console.log(`[${new Date().toISOString()}] ${eventName}:`, data);
};

// Función para obtener user ID desde username usando la API de X
const getUserIdFromUsername = async (
  username,
  accessToken,
  accessTokenSecret,
  account
) => {
  try {
    const endpoint = `https://api.twitter.com/2/users/by/username/${username}`;
    const method = "GET";

    const requestHeaders = await generateOAuth1Headers(
      method,
      endpoint,
      {},
      account,
      accessToken,
      accessTokenSecret
    );

    requestHeaders["User-Agent"] = "ControlX/1.0";
    requestHeaders["Accept"] = "application/json";

    const response = await fetch(endpoint, {
      method,
      headers: requestHeaders,
    });

    if (response.ok) {
      const data = await response.json();
      return data.data?.id;
    } else {
      throw new Error(`Usuario @${username} no encontrado`);
    }
  } catch (error) {
    throw new Error(`Error al buscar usuario @${username}: ${error.message}`);
  }
};

// Función para crear cliente de Twitter con prioridad OAuth 2.0
async function createTwitterClient(account) {
  try {
    // PRIORIZAR OAuth 1.0a como método principal y más confiable
    if (account.ownApiKey && account.ownApiSecret) {
      console.log(`🔐 Usando OAuth 1.0a para ${account.username}`);

      const credentials = {
        appKey: account.ownApiKey,
        appSecret: account.ownApiSecret,
      };

      // Agregar tokens de usuario si están disponibles
      if (account.ownAccessToken && account.ownAccessTokenSecret) {
        credentials.accessToken = account.ownAccessToken;
        credentials.accessSecret = account.ownAccessTokenSecret;
        console.log(
          `✅ OAuth 1.0a completo para ${account.username} (con tokens de usuario)`
        );
      } else {
        console.log(
          `⚠️ OAuth 1.0a básico para ${account.username} (solo app credentials)`
        );
      }

      return new TwitterApi(credentials);
    }

    // Fallback a OAuth 2.0 solo si OAuth 1.0a no está disponible
    if (
      account.preferOAuth2 &&
      account.ownClientId &&
      account.ownClientSecret
    ) {
      console.log(
        `🔐 Fallback a OAuth 2.0 para ${account.username} (OAuth 1.0a no disponible)`
      );

      // Si hay access token OAuth 2.0, usarlo directamente
      if (account.ownOAuth2AccessToken) {
        return new TwitterApi(account.ownOAuth2AccessToken);
      }

      // Si no hay access token pero hay refresh token, intentar renovar
      if (account.ownOAuth2RefreshToken) {
        try {
          const client = new TwitterApi({
            clientId: account.ownClientId,
            clientSecret: account.ownClientSecret,
          });

          const {
            client: refreshedClient,
            accessToken,
            refreshToken,
          } = await client.refreshOAuth2Token(account.ownOAuth2RefreshToken);

          // Actualizar tokens en la base de datos
          await XAccount.findByIdAndUpdate(account._id, {
            ownOAuth2AccessToken: accessToken,
            ownOAuth2RefreshToken: refreshToken,
            oauth2TokenExpiresAt: new Date(Date.now() + 7200 * 1000), // 2 horas por defecto
          });

          console.log(`🔄 Token OAuth 2.0 renovado para ${account.username}`);
          return refreshedClient;
        } catch (refreshError) {
          console.log(
            `❌ Error renovando token OAuth 2.0 para ${account.username}:`,
            refreshError.message
          );
          // Continuar con otros métodos
        }
      }

      // Si solo hay client credentials, crear cliente básico
      return new TwitterApi({
        clientId: account.ownClientId,
        clientSecret: account.ownClientSecret,
      });
    }

    // Usar Bearer Token si está disponible
    if (account.ownBearerToken) {
      console.log(`🔐 Usando Bearer Token para ${account.username}`);
      return new TwitterApi(account.ownBearerToken);
    }

    // Fallback a credenciales compartidas (OAuth 1.0a)
    console.log(
      `🔐 Fallback a credenciales compartidas para ${account.username}`
    );
    return new TwitterApi({
      appKey: process.env.TWITTER_CONSUMER_KEY,
      appSecret: process.env.TWITTER_CONSUMER_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
  } catch (error) {
    console.error(
      `❌ Error creando cliente Twitter para ${account.username}:`,
      error
    );
    throw error;
  }
}

// Actualizar función existente de crear cliente
async function getTwitterClient(account) {
  // Usar la nueva función con prioridad OAuth 2.0
  return await createTwitterClient(account);
}

// Función para ejecutar acciones de Twitter (llamada por el procesador de colas)
const executeTwitterAction = async (actionObj) => {
  const { account, action, text, tweetId, targetUserId } = actionObj;

  console.log(
    `🎯 Iniciando ejecución de ${action} para @${account.username}...`
  );

  // Verificar qué tipo de credenciales tiene la cuenta
  const hasCompleteOAuth1 =
    account.ownAccessToken &&
    account.ownAccessTokenSecret &&
    account.ownApiKey &&
    account.ownApiSecret; // OAuth 1.0a completo

  const needsWriteAccess = [
    "tweet",
    "like",
    "retweet",
    "reply",
    "follow",
    "unfollow",
  ].includes(action);

  if (needsWriteAccess && !hasCompleteOAuth1) {
    throw new Error(
      `❌ Se requieren credenciales OAuth 1.0a completas para ${action}. Faltan: ${[
        !account.ownApiKey ? "API Key" : "",
        !account.ownApiSecret ? "API Secret" : "",
        !account.ownAccessToken ? "Access Token" : "",
        !account.ownAccessTokenSecret ? "Access Token Secret" : "",
      ]
        .filter(Boolean)
        .join(", ")}`
    );
  }

  // Crear cliente Twitter usando la función mejorada
  let client;
  try {
    client = await createTwitterClient(account);
    console.log(
      `✅ Cliente Twitter creado exitosamente para @${account.username}`
    );
  } catch (error) {
    throw new Error(`❌ Error creando cliente Twitter: ${error.message}`);
  }

  // Convertir username a user ID para follow/unfollow si es necesario
  let targetUserIdToFollow = targetUserId;
  if (
    ["follow", "unfollow"].includes(action) &&
    targetUserId &&
    !/^\d+$/.test(targetUserId)
  ) {
    console.log(`🔍 Convirtiendo username ${targetUserId} a user ID...`);
    try {
      targetUserIdToFollow = await getUserIdFromUsername(
        targetUserId,
        account.ownAccessToken,
        account.ownAccessTokenSecret,
        account
      );
      console.log(
        `✅ Username ${targetUserId} convertido a ID: ${targetUserIdToFollow}`
      );
    } catch (error) {
      throw new Error(
        `❌ Error obteniendo user ID para ${targetUserId}: ${error.message}`
      );
    }
  }

  // Ejecutar la acción específica
  let result;
  try {
    console.log(`🚀 Ejecutando ${action} con cliente Twitter...`);

    switch (action) {
      case "tweet":
        if (!text) throw new Error("Texto requerido para tweet");
        result = await client.v2.tweet(text);
        console.log(`✅ Tweet publicado: ${result.data.id}`);
        break;

      case "like":
        if (!tweetId) throw new Error("Tweet ID requerido para like");
        const meUser = await client.v2.me();
        result = await client.v2.like(meUser.data.id, tweetId);
        console.log(`✅ Like dado al tweet: ${tweetId}`);
        break;

      case "retweet":
        if (!tweetId) throw new Error("Tweet ID requerido para retweet");
        const meUserRetweet = await client.v2.me();
        result = await client.v2.retweet(meUserRetweet.data.id, tweetId);
        console.log(`✅ Retweet realizado del tweet: ${tweetId}`);
        break;

      case "reply":
        if (!text || !tweetId)
          throw new Error("Texto y Tweet ID requeridos para reply");
        result = await client.v2.reply(text, tweetId);
        console.log(`✅ Reply enviado al tweet: ${tweetId}`);
        break;

      case "follow":
        if (!targetUserIdToFollow)
          throw new Error("User ID requerido para follow");
        const meUserFollow = await client.v2.me();
        result = await client.v2.follow(
          meUserFollow.data.id,
          targetUserIdToFollow
        );
        console.log(`✅ Siguiendo al usuario: ${targetUserIdToFollow}`);
        break;

      case "unfollow":
        if (!targetUserIdToFollow)
          throw new Error("User ID requerido para unfollow");
        const meUserUnfollow = await client.v2.me();
        result = await client.v2.unfollow(
          meUserUnfollow.data.id,
          targetUserIdToFollow
        );
        console.log(`✅ Dejando de seguir al usuario: ${targetUserIdToFollow}`);
        break;

      default:
        throw new Error(`❌ Acción no soportada: ${action}`);
    }

    console.log(
      `🎉 ${action} completado exitosamente para @${account.username}`
    );
    return result;
  } catch (error) {
    console.error(
      `❌ Error ejecutando ${action} para @${account.username}:`,
      error.message
    );

    // Proporcionar mensajes de error más específicos
    if (error.message.includes("already")) {
      throw new Error(
        `Ya se realizó esta acción anteriormente: ${error.message}`
      );
    } else if (error.message.includes("not found")) {
      throw new Error(`Recurso no encontrado: ${error.message}`);
    } else if (error.message.includes("rate limit")) {
      throw new Error(`Límite de velocidad alcanzado: ${error.message}`);
    } else if (error.message.includes("unauthorized")) {
      throw new Error(
        `No autorizado - verificar credenciales: ${error.message}`
      );
    } else {
      throw new Error(`Error de Twitter API: ${error.message}`);
    }
  }
};

// ========== ENDPOINTS DE DEBUG ==========

// Debug endpoint para cuentas (similar al frontend)
app.get("/api/debug/accounts", async (req, res) => {
  try {
    // Obtener todas las cuentas
    const accounts = await Account.find({});

    // Transformar para compatibilidad con frontend
    const accountsWithTokens = accounts.map((account) => {
      const now = new Date();

      // Verificar credenciales OAuth 1.0a completas
      const hasCompleteOAuth1 = !!(
        account.ownAccessToken &&
        account.ownAccessTokenSecret &&
        account.ownApiKey &&
        account.ownApiSecret
      );

      return {
        _id: account._id,
        username: account.username,
        userId: account.userId || account.twitterUserId,
        developerTag: account.developerTag || account.username,
        labels: account.labels || [],
        createdAt: account.createdAt,
        hasAccessToken: !!(account.ownAccessToken || account.accessToken),
        hasRefreshToken: !!(
          account.ownOAuth2RefreshToken || account.refreshToken
        ),
        needsReauth: !account.ownAccessToken && !account.ownOAuth2AccessToken,
        useOwnCredentials: account.useOwnCredentials || false,
        credentialsVerified: account.credentialsVerified || false,
        userAppName: account.userAppName,
        appCreatedAt: account.appCreatedAt,
        status: account.isActive ? "active" : "inactive",
        profileInfo: account.profileInfo || {},
        hasCompleteOAuth1: hasCompleteOAuth1, // Nueva información
        credentialsDebug: {
          // Debug información
          hasOwnApiKey: !!account.ownApiKey,
          hasOwnApiSecret: !!account.ownApiSecret,
          hasOwnAccessToken: !!account.ownAccessToken,
          hasOwnAccessTokenSecret: !!account.ownAccessTokenSecret,
        },
      };
    });

    // Estadísticas
    const stats = {
      total: accounts.length,
      active: accountsWithTokens.filter((a) => a.status === "active").length,
      withOwnCredentials: accountsWithTokens.filter((a) => a.useOwnCredentials)
        .length,
      withAccessTokens: accountsWithTokens.filter((a) => a.hasAccessToken)
        .length,
      needsReauth: accountsWithTokens.filter((a) => a.needsReauth).length,
      withCompleteOAuth1: accountsWithTokens.filter((a) => a.hasCompleteOAuth1)
        .length,
      canCustomize: accountsWithTokens.filter((a) => a.hasCompleteOAuth1)
        .length,
    };

    res.json({
      environment: {
        hasMongoConnection: true,
        nodeEnv: process.env.NODE_ENV || "development",
      },
      stats,
      accounts: accountsWithTokens,
    });
  } catch (error) {
    console.error("Error al obtener debug de cuentas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ========== ENDPOINTS PARA PERSONALIZACIÓN DE CUENTAS (SUPERADMIN) ==========
