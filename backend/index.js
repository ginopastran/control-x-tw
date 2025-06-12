require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const { URLSearchParams } = require("url");
const cors = require("cors");
const { TwitterApi } = require("twitter-api-v2");
const cron = require("node-cron");

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
app.use(cors());

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI no está definido en las variables de entorno.");
  process.exit(1);
}

// Conexión a MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB conectado exitosamente"))
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

// Endpoint de ejemplo
app.get("/", (req, res) => {
  res.send("Backend Express funcionando!");
});

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

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
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
