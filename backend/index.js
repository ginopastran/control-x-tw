require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const { URLSearchParams } = require("url");
const { TwitterApi } = require("twitter-api-v2");
const cron = require("node-cron");
const multer = require("multer");
const csv = require("csv-parse/sync");

// Importar configuración CORS
const { corsMiddleware, logCorsConfig } = require("./src/config/cors");

// Importar modelo y utilidades (serán creados a continuación)
const XAccount = require("./models/XAccount"); // Asegúrate de crear models/XAccount.js
const Account = XAccount; // Alias para compatibilidad
const {
  generateOAuth1Signature,
  generateOAuth1Headers,
} = require("./utils/oauth1Helper"); // Asegúrate de crear utils/oauth1Helper.js

// Sistema de colas en memoria
const actionQueue = [];
const runningActions = new Set(); // Cambiar de Map a Set para almacenar solo IDs
const actionHistory = []; // Historial de las últimas 100 acciones
const scheduledActions = []; // Acciones programadas
const lastActionTimes = {}; // Para controlar rate limits por cuenta/acción
const MAX_HISTORY_SIZE = 100;

let actionIdCounter = 1;

// Función para generar ID único de acción
const generateActionId = () => `action_${actionIdCounter++}`;

// Función para agregar al historial
const addToHistory = (actionInfo) => {
  actionHistory.unshift(actionInfo);
  if (actionHistory.length > MAX_HISTORY_SIZE) {
    actionHistory.pop();
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

// Configurar multer para subida de archivos
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
      const accountData = {
        username: cleanUsername(row["Email"] || ""),
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
        throw new Error("Username/Email es requerido");
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
    accountLabels: removedAction.account?.labels || [], // Añadir labels de la cuenta
    status: "cancelled",
    completedAt: new Date().toISOString(),
    error: "Cancelado por el usuario",
  });

  res.json({ message: "Acción cancelada", action: removedAction });
});

// Verificar acciones programadas cada minuto
cron.schedule("* * * * *", () => {
  const now = new Date();
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
    username: action.accountUsername,
    accountLabels: action.account?.labels || [], // Añadir labels de la cuenta
    action: action.action,
    text: action.text || "",
    tweetId: action.tweetId || "",
    targetUserId: action.targetUserId || "",
    success: false,
    timestamp: new Date().toISOString(),
    status: "running",
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
      username: action.accountUsername,
      accountLabels: action.account?.labels || [], // Añadir labels de la cuenta
      action: action.action,
      text: action.text || "",
      tweetId: action.tweetId || "",
      targetUserId: action.targetUserId || "",
      success: true,
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString(), // Añadir fecha de completado
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
      username: action.accountUsername,
      accountLabels: action.account?.labels || [], // Añadir labels de la cuenta
      action: action.action,
      text: action.text || "",
      tweetId: action.tweetId || "",
      targetUserId: action.targetUserId || "",
      success: false,
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString(), // Añadir fecha de completado
      status: "failed",
      error: error.message,
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
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        createdAt: new Date(),
      };

      if (scheduledTime) {
        // Si es programada, añadir a la lista de acciones programadas
        scheduledActions.push(actionObj);
        console.log(
          `📅 Acción ${actionId} programada para ${scheduledTime}: ${action} para @${account.username}`
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
        accountLabels: removedAction.account?.labels || [], // Añadir labels de la cuenta
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
