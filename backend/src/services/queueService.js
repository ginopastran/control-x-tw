const { TwitterApi } = require("twitter-api-v2");
const TwitterService = require("./twitterService");

class QueueService {
  constructor(prisma) {
    this.prisma = prisma;
    this.twitterService = new TwitterService(prisma);
    this.actionQueue = [];
    this.runningActions = new Set();
    this.scheduledActions = [];
    this.lastActionTimes = {};
    this.MAX_HISTORY_SIZE = 100;
    this.userIdCache = new Map(); // Cache para IDs de usuario

    // Nuevo: Tracker para rate limits
    this.rateLimitTracker = new Map(); // accountId -> { actionType: timestamp }
    this.RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutos en ms
  }

  generateActionId() {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async addToHistory(actionInfo) {
    const resolvedUsername =
      actionInfo.username ||
      actionInfo.accountUsername ||
      (actionInfo.account && actionInfo.account.username);

    if (!resolvedUsername) {
      console.error(
        "❌ ERROR: username faltante en actionInfo, se omite guardar en historial:",
        actionInfo
      );
      return;
    }

    const updateData = {
      accountId: actionInfo.accountId,
      username: resolvedUsername,
      accountLabels: actionInfo.accountLabels || [],
      action: actionInfo.action,
      text: actionInfo.text,
      tweetId: actionInfo.tweetId,
      targetUserId: actionInfo.targetUserId,
      status: actionInfo.status,
      success: actionInfo.success ?? false,
      baseDelay: actionInfo.baseDelay,
      randomDelay: actionInfo.randomDelay,
      actualDelay: actionInfo.actualDelay,
      result: actionInfo.result,
      error: actionInfo.error,
      errorCode: actionInfo.errorCode,
      batchId: actionInfo.batchId,
    };

    if (actionInfo.createdAt)
      updateData.createdAt = new Date(actionInfo.createdAt);
    if (actionInfo.startedAt)
      updateData.startedAt = new Date(actionInfo.startedAt);
    if (actionInfo.completedAt)
      updateData.completedAt = new Date(actionInfo.completedAt);

    console.log(
      `[HISTORY] Upserting action: ${actionInfo.id}, Status: ${actionInfo.status}, Success: ${actionInfo.success}`
    );
    await this.prisma.actionHistory.upsert({
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

    console.log(`[HISTORY] Successfully upserted action: ${actionInfo.id}`);
  }

  async getUserIdFromUsername(client, username) {
    const cleanedUsername = (username || "").replace(/^@+/, "").trim();
    if (!cleanedUsername) {
      throw new Error("El username no es válido o está vacío.");
    }

    if (this.userIdCache.has(cleanedUsername)) {
      console.log(
        `[CACHE] HIT: User ID para @${cleanedUsername} encontrado en cache.`
      );
      return this.userIdCache.get(cleanedUsername);
    }

    console.log(
      `[CACHE] MISS: Buscando User ID para @${cleanedUsername} via API.`
    );
    try {
      const { data: targetUser } = await client.v2.userByUsername(
        cleanedUsername
      );
      if (!targetUser) {
        throw new Error(
          `Usuario de Twitter @${cleanedUsername} no encontrado.`
        );
      }
      this.userIdCache.set(cleanedUsername, targetUser.id);
      return targetUser.id;
    } catch (userLookupError) {
      console.error(
        `Error buscando al usuario @${cleanedUsername}:`,
        userLookupError.message
      );
      if (userLookupError.code === 429) {
        throw new Error(
          `Límite de tasa de API excedido al buscar @${cleanedUsername}. Intenta de nuevo más tarde.`
        );
      }
      throw new Error(
        `No se pudo encontrar el usuario de Twitter @${cleanedUsername}. Verifica que el nombre de usuario es correcto.`
      );
    }
  }

  addScheduledAction(actionObj) {
    this.scheduledActions.push(actionObj);
  }

  async addActionsToQueue(actions) {
    for (const actionObj of actions) {
      if (actionObj.scheduledTime) {
        this.scheduledActions.push(actionObj);
      } else {
        this.actionQueue.push(actionObj);
      }
      await this.addToHistory(actionObj);
    }
  }

  async cancelAction(id) {
    // Buscar en cola normal
    const queueIndex = this.actionQueue.findIndex((a) => a.id === id);
    if (queueIndex !== -1) {
      const action = this.actionQueue[queueIndex];
      this.actionQueue.splice(queueIndex, 1);
      action.status = "CANCELLED";
      action.completedAt = new Date().toISOString();
      await this.addToHistory(action);
      return true;
    }

    // Buscar en acciones programadas
    const scheduledIndex = this.scheduledActions.findIndex((a) => a.id === id);
    if (scheduledIndex !== -1) {
      const action = this.scheduledActions[scheduledIndex];
      this.scheduledActions.splice(scheduledIndex, 1);
      action.status = "CANCELLED";
      action.completedAt = new Date().toISOString();
      await this.addToHistory(action);
      return true;
    }

    return false;
  }

  async cancelCampaignActions(campaignId) {
    let canceledCount = 0;

    // Cancelar acciones programadas
    const pendingActions = this.scheduledActions.filter(
      (action) => action.batchId === campaignId
    );

    for (const action of pendingActions) {
      const index = this.scheduledActions.indexOf(action);
      if (index !== -1) {
        this.scheduledActions.splice(index, 1);
        action.status = "CANCELLED";
        action.completedAt = new Date().toISOString();
        await this.addToHistory(action);
        canceledCount++;
      }
    }

    // Cancelar de la cola normal
    const queuedActions = this.actionQueue.filter(
      (action) => action.batchId === campaignId
    );

    for (const action of queuedActions) {
      const index = this.actionQueue.indexOf(action);
      if (index !== -1) {
        this.actionQueue.splice(index, 1);
        action.status = "CANCELLED";
        action.completedAt = new Date().toISOString();
        await this.addToHistory(action);
        canceledCount++;
      }
    }

    return canceledCount;
  }

  async clearAllQueuedAndScheduledActions() {
    let canceledCount = 0;

    // 1. Copiar y vaciar las colas para evitar problemas de concurrencia
    const scheduledToCancel = [...this.scheduledActions];
    const queuedToCancel = [...this.actionQueue];
    this.scheduledActions = [];
    this.actionQueue = [];

    // 2. Marcar todas como canceladas en el historial
    const allToCancel = [...scheduledToCancel, ...queuedToCancel];

    for (const action of allToCancel) {
      try {
        action.status = "CANCELLED";
        action.completedAt = new Date().toISOString();
        action.error = "Cancelada masivamente por el administrador.";
        await this.addToHistory(action);
        canceledCount++;
      } catch (historyError) {
        console.error(
          `Error al actualizar el historial para la acción cancelada ${action.id}:`,
          historyError
        );
      }
    }

    console.log(
      `🧹 Se cancelaron y limpiaron ${canceledCount} acciones de las colas.`
    );
    return canceledCount;
  }

  processScheduledActions() {
    const now = new Date();
    const readyActions = this.scheduledActions.filter(
      (action) => new Date(action.scheduledTime) <= now
    );

    for (const action of readyActions) {
      const index = this.scheduledActions.indexOf(action);
      this.scheduledActions.splice(index, 1);
      this.actionQueue.push(action);
    }
  }

  async processQueue() {
    console.log(
      `[QUEUE] Tick - Queue: ${this.actionQueue.length}, Scheduled: ${this.scheduledActions.length}, Running: ${this.runningActions.size}`
    );
    if (this.actionQueue.length === 0 || this.runningActions.size >= 3) {
      return;
    }

    const now = Date.now();
    let readyAction = null;
    let readyActionIndex = -1;

    // Buscar una acción que esté lista y no viole el rate limit
    for (let i = 0; i < this.actionQueue.length; i++) {
      const action = this.actionQueue[i];
      const executeTime = new Date(
        action.estimatedStartTime || action.scheduledTime
      ).getTime();

      if (executeTime > now) {
        continue; // Aún no es su turno
      }

      // Chequeo de Rate Limit
      const accountLimits = this.rateLimitTracker.get(action.accountId);
      const lastActionTime = accountLimits
        ? accountLimits.get(action.action)
        : 0;

      if (lastActionTime && now - lastActionTime < this.RATE_LIMIT_WINDOW) {
        // Violación de rate limit, posponer
        const newStartTime = new Date(lastActionTime + this.RATE_LIMIT_WINDOW);
        console.log(
          `[RATE_LIMIT] Posponiendo acción ${action.id} para ${
            action.account.username
          }. Nueva hora: ${newStartTime.toISOString()}`
        );
        action.estimatedStartTime = newStartTime.toISOString();
        action.status = "QUEUED"; // Asegurar que sigue en cola
        await this.addToHistory(action);
        continue; // Pasar a la siguiente acción en la cola
      }

      // Encontramos una acción lista
      readyAction = action;
      readyActionIndex = i;
      break;
    }

    if (!readyAction) {
      // No hay acciones listas para ejecutar
      return;
    }

    // Extraer la acción lista de la cola
    const action = this.actionQueue.splice(readyActionIndex, 1)[0];
    console.log(
      `[QUEUE] Processing action ${action.id} for @${action.account.username}`
    );

    this.runningActions.add(action);
    action.status = "RUNNING";
    action.startedAt = new Date().toISOString();
    await this.addToHistory(action);

    // Actualizar el tracker ANTES de ejecutar la acción
    this.updateRateLimitTracker(action.accountId, action.action);

    try {
      console.log(`[QUEUE] Executing action ${action.id} via executeAction...`);
      const result = await this.executeAction(action);
      action.status = "COMPLETED";
      action.success = true;
      action.result = result;
      console.log(`✅ [QUEUE] Action ${action.id} successful.`);
    } catch (err) {
      // Manejo de error mejorado
      const twitterError = err.twitterError || err;
      const errorCode = twitterError.code || twitterError.status;
      const errorStr = (twitterError.message || "").toLowerCase();

      // Caso 1: Error de "Too Many Requests" (429)
      if (errorCode === 429) {
        const retryTime = new Date(Date.now() + this.RATE_LIMIT_WINDOW);
        console.log(
          `[RATE_LIMIT] Error 429 detectado para acción ${
            action.id
          }. Reintentando a las ${retryTime.toISOString()}`
        );

        // Actualizar el tracker con la hora actual para forzar la espera
        this.updateRateLimitTracker(action.accountId, action.action);

        // Devolver la acción a la cola con nueva hora de inicio
        action.status = "QUEUED";
        action.estimatedStartTime = retryTime.toISOString();
        action.error = `Rate limit hit. Retrying after 15 min. Original error: ${err.message}`;
        this.actionQueue.unshift(action); // Ponerla al principio para que sea re-evaluada pronto
      }
      // Caso 2: Follow duplicado (considerado éxito)
      else if (
        action.action === "follow" &&
        (errorStr.includes("already following") ||
          errorStr.includes("you are already following this user") ||
          err.code === "AlreadyFollowing" ||
          errorCode === 403) // 403 a veces significa "ya sigues a este usuario"
      ) {
        console.log(
          `⚠️ [QUEUE] Follow duplicado considerado como éxito para ${action.id}`
        );
        action.status = "COMPLETED";
        action.success = true;
        action.result = { note: "Ya se estaba siguiendo esta cuenta" };
      }
      // Caso 3: Otros errores
      else {
        console.error(`❌ [QUEUE] Action ${action.id} failed:`, err.message);
        action.status = "FAILED";
        action.success = false;
        action.error = err.message;
        action.errorCode = String(errorCode || "UNKNOWN");
      }
    } finally {
      console.log(
        `[QUEUE] Finalizing action ${action.id}, preparing to save final state.`
      );
      action.completedAt = new Date().toISOString();
      // Solo guardar en historial si no fue re-encolada
      if (action.status !== "QUEUED") {
        await this.addToHistory(action);
      }
      this.runningActions.delete(action);
      console.log(
        `[QUEUE] Finalized and removed action ${action.id} from running set.`
      );
    }
  }

  async executeAction(action) {
    switch (action.action) {
      case "tweet":
        return this.executeTweet(action);
      case "reply":
        return this.executeReply(action);
      case "like":
        return this.executeLike(action);
      case "retweet":
        return this.executeRetweet(action);
      case "follow":
        return this.executeFollow(action);
      case "unfollow":
        return this.executeUnfollow(action);
      default:
        console.warn(`Acción desconocida: ${action.action}`);
        throw new Error(`Acción desconocida: ${action.action}`);
    }
  }

  // 🔥 FUNCIONES DE EJECUCIÓN USANDO TwitterService

  async executeTweet(action) {
    try {
      console.log(
        `📝 Ejecutando tweet para @${action.account.username}: "${action.text}"`
      );

      const client = await this.twitterService.getTwitterClient(action.account);

      // 🔥 USAR API v2 para tweets (acceso completo)
      const { data: result } = await client.v2.tweet(action.text);

      console.log(`✅ Tweet publicado exitosamente: ${result.id}`);

      return {
        tweetId: result.id,
        text: result.text,
        url: `https://twitter.com/i/web/status/${result.id}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "tweet");
      throw error;
    }
  }

  async executeReply(action) {
    try {
      console.log(
        `💬 Ejecutando reply para @${action.account.username} → ${action.tweetId}`
      );

      const client = await this.twitterService.getTwitterClient(action.account);

      // 🔥 USAR API v2 para replies
      const { data: result } = await client.v2.reply(
        action.text,
        action.tweetId
      );

      console.log(`✅ Reply publicado exitosamente: ${result.id}`);

      return {
        tweetId: result.id,
        text: result.text,
        replyToTweetId: action.tweetId,
        url: `https://twitter.com/i/web/status/${result.id}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "reply");
      throw error;
    }
  }

  async executeLike(action) {
    try {
      console.log(
        `❤️ Ejecutando like para @${action.account.username} → ${action.tweetId}`
      );

      const actingUserId = action.account.twitterId || action.account.userId;
      if (!actingUserId) {
        throw new Error(
          `La cuenta @${action.account.username} no tiene su Twitter ID configurado en la base de datos.`
        );
      }

      const client = await this.twitterService.getTwitterClient(action.account);

      // 🔥 USAR API v2 para likes
      const result = await client.v2.like(actingUserId, action.tweetId);

      console.log(
        `✅ Like ejecutado exitosamente para tweet ${action.tweetId}`
      );

      return {
        likedTweetId: action.tweetId,
        liked: result.data.liked,
        userId: actingUserId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "like");
      throw error;
    }
  }

  async executeRetweet(action) {
    try {
      console.log(
        `🔄 Ejecutando retweet para @${action.account.username} → ${action.tweetId}`
      );

      const actingUserId = action.account.twitterId || action.account.userId;
      if (!actingUserId) {
        throw new Error(
          `La cuenta @${action.account.username} no tiene su Twitter ID configurado en la base de datos.`
        );
      }

      const client = await this.twitterService.getTwitterClient(action.account);

      // 🔥 USAR API v2 para retweets
      const result = await client.v2.retweet(actingUserId, action.tweetId);

      console.log(
        `✅ Retweet ejecutado exitosamente para tweet ${action.tweetId}`
      );

      return {
        retweetedTweetId: action.tweetId,
        retweeted: result.data.retweeted,
        userId: actingUserId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "retweet");
      throw error;
    }
  }

  async executeFollow(action) {
    const rawTarget = action.targetUsername || action.targetUserId;
    const targetUsername = (rawTarget || "").replace(/^@+/, "").trim();
    let targetUserId = action.targetUserId; // Usar si ya existe en la acción

    try {
      console.log(
        `👥 Ejecutando follow: @${action.account.username} → @${targetUsername}`
      );

      const actingUserId = action.account.twitterId || action.account.userId;
      if (!actingUserId) {
        throw new Error(
          `La cuenta @${action.account.username} no tiene su Twitter ID configurado en la base de datos.`
        );
      }

      const client = await this.twitterService.getTwitterClient(action.account);

      // --- LÓGICA DE DOS PASOS ---
      if (!targetUserId) {
        console.log(
          `[FOLLOW_STEP_1] No hay targetUserId para @${targetUsername}. Buscando...`
        );
        // Optimización: Buscar primero en nuestra BD
        const localAccount = await this.prisma.xAccount.findUnique({
          where: { username: targetUsername },
        });

        if (localAccount && (localAccount.userId || localAccount.twitterId)) {
          targetUserId = localAccount.userId || localAccount.twitterId;
          console.log(
            `[FOLLOW_STEP_1] ID encontrado en BD local: ${targetUserId}`
          );
        } else {
          // Si no está en BD, buscar en la API y reprogramar
          console.log(
            `[FOLLOW_STEP_1] No encontrado en BD. Buscando en API de Twitter...`
          );
          // Actualizamos el tracker aquí porque esta llamada consume un request
          this.updateRateLimitTracker(action.accountId, "get_user_id");
          targetUserId = await this.getUserIdFromUsername(
            client,
            targetUsername
          );

          // REPROGRAMAR LA ACCIÓN PARA DENTRO DE 15 MINUTOS
          const retryTime = new Date(Date.now() + this.RATE_LIMIT_WINDOW);
          action.targetUserId = targetUserId; // Guardar el ID encontrado
          action.estimatedStartTime = retryTime.toISOString();
          action.status = "QUEUED";
          action.error = null; // Limpiar cualquier error previo
          action.result = {
            note: `User ID for @${targetUsername} found (${targetUserId}). Rescheduling follow action.`,
          };

          this.actionQueue.unshift(action); // Devolver a la cola
          console.log(
            `[FOLLOW_STEP_1] Acción ${
              action.id
            } reprogramada para seguir a ${targetUserId} a las ${retryTime.toISOString()}`
          );
          await this.addToHistory(action);
          // Devolvemos un resultado intermedio, la acción no ha terminado
          return action.result;
        }
      }

      // --- PASO 2: EJECUTAR EL FOLLOW ---
      console.log(
        `[FOLLOW_STEP_2] Ejecutando follow para ${targetUserId} (@${targetUsername})`
      );
      const result = await client.v2.follow(actingUserId, targetUserId);

      console.log(
        `✅ Follow ejecutado exitosamente: @${action.account.username} → ${targetUserId} (@${targetUsername})`
      );

      return {
        targetUserId: targetUserId,
        targetUsername: targetUsername,
        followerUsername: action.account.username,
        following: result.data.following,
        userId: actingUserId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Manejo especial para errores de follow
      const errorStr = error.message?.toLowerCase() || "";

      // Si ya se está siguiendo a esa cuenta, considerarlo como éxito
      if (
        errorStr.includes("already") ||
        errorStr.includes("following") ||
        errorStr.includes("duplicate") ||
        error.code === "AlreadyFollowing" ||
        error.status === 403
      ) {
        console.log(
          `⚠️ Follow ya existente: @${action.account.username} → ${targetUsername} (considerado como éxito)`
        );

        return {
          targetUserId: targetUserId,
          targetUsername: targetUsername,
          followerUsername: action.account.username,
          following: true, // Ya se está siguiendo
          userId: action.account.userId,
          timestamp: new Date().toISOString(),
          note: "Ya se estaba siguiendo esta cuenta",
        };
      }

      // Para otros errores, usar el manejo normal
      this.twitterService.handleTwitterError(error, "follow");
      throw error;
    }
  }

  async executeUnfollow(action) {
    const rawTarget = action.targetUsername || action.targetUserId;
    const targetUsername = (rawTarget || "").replace(/^@+/, "").trim();
    let targetUserId;

    try {
      console.log(
        `👥❌ Ejecutando unfollow: @${action.account.username} → @${targetUsername}`
      );

      const actingUserId = action.account.twitterId || action.account.userId;
      if (!actingUserId) {
        throw new Error(
          `La cuenta @${action.account.username} no tiene su Twitter ID configurado en la base de datos.`
        );
      }

      const client = await this.twitterService.getTwitterClient(action.account);

      // 🔥 OBTENER ID DEL USUARIO A DEJAR DE SEGUIR (con cache)
      targetUserId = await this.getUserIdFromUsername(client, targetUsername);

      // 🔥 USAR API v2 para unfollows
      const result = await client.v2.unfollow(actingUserId, targetUserId);

      console.log(
        `✅ Unfollow ejecutado exitosamente: @${action.account.username} → ${targetUserId} (@${targetUsername})`
      );

      return {
        targetUserId: targetUserId,
        targetUsername: targetUsername,
        followerUsername: action.account.username,
        following: result.data.following, // Debería ser false
        userId: actingUserId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "unfollow");
      throw error;
    }
  }

  getQueueStatus() {
    return {
      queue: this.actionQueue.map((a) => ({
        id: a.id,
        accountId: a.accountId,
        accountUsername: a.accountUsername,
        action: a.action,
        text: a.text,
        status: a.status,
        createdAt: a.createdAt,
        estimatedStartTime: a.estimatedStartTime || a.scheduledTime,
      })),
      running: Array.from(this.runningActions).map((a) => ({
        id: a.id,
        accountId: a.accountId,
        accountUsername: a.accountUsername,
        action: a.action,
        text: a.text,
        status: a.status,
        startedAt: a.startedAt,
      })),
      scheduled: this.scheduledActions.map((a) => ({
        id: a.id,
        accountId: a.accountId,
        accountUsername: a.accountUsername,
        action: a.action,
        text: a.text,
        scheduledTime: a.scheduledTime,
        status: a.status,
      })),
      stats: {
        queueLength: this.actionQueue.length,
        runningCount: this.runningActions.size,
        scheduled: this.scheduledActions.length,
      },
    };
  }

  // Nuevo: Helper para actualizar el tracker de rate limits
  updateRateLimitTracker(accountId, actionType) {
    if (!this.rateLimitTracker.has(accountId)) {
      this.rateLimitTracker.set(accountId, new Map());
    }
    this.rateLimitTracker.get(accountId).set(actionType, Date.now());
    console.log(
      `[RATE_LIMIT] Tracker actualizado para ${accountId}, acción ${actionType}`
    );
  }
}

module.exports = QueueService;
