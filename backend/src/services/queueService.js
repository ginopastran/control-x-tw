const { TwitterApi } = require("twitter-api-v2");
const TwitterService = require("./twitterService");

class QueueService {
  constructor(prisma) {
    this.prisma = prisma;
    this.twitterService = new TwitterService(prisma);

    // Mantener caches en memoria para performance
    this.actionQueue = [];
    this.runningActions = new Set();
    this.scheduledActions = [];
    this.rateLimitTracker = new Map();
    this.userIdCache = new Map();

    this.MAX_HISTORY_SIZE = 100;
    this.RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutos en ms

    // Inicializar desde la base de datos
    this.initializeFromDatabase();
  }

  // Nuevo: Inicializar estado desde la base de datos
  async initializeFromDatabase() {
    try {
      console.log("[QUEUE] Inicializando estado desde la base de datos...");

      // 1. Cargar acciones pendientes
      const queuedActions = await this.prisma.queuedAction.findMany({
        where: {
          status: {
            in: ["QUEUED", "SCHEDULED", "RUNNING"],
          },
        },
        include: {
          account: true,
        },
        orderBy: [
          { priority: "desc" },
          { estimatedStartTime: "asc" },
          { createdAt: "asc" },
        ],
      });

      // 2. Restaurar acciones en memoria
      for (const dbAction of queuedActions) {
        const memoryAction = this.convertDbActionToMemoryAction(dbAction);

        if (dbAction.status === "SCHEDULED") {
          this.scheduledActions.push(memoryAction);
        } else if (dbAction.status === "RUNNING") {
          // Las acciones que estaban corriendo se marcan como fallidas
          // porque el proceso se reinició
          await this.markActionAsFailed(
            dbAction.actionId,
            "Process restarted during execution"
          );
        } else {
          this.actionQueue.push(memoryAction);
        }
      }

      // 3. Cargar rate limit tracker
      const rateLimits = await this.prisma.rateLimitTracker.findMany();
      for (const limit of rateLimits) {
        if (!this.rateLimitTracker.has(limit.accountId)) {
          this.rateLimitTracker.set(limit.accountId, new Map());
        }
        this.rateLimitTracker
          .get(limit.accountId)
          .set(limit.actionType, limit.lastUsed.getTime());
      }

      console.log(
        `[QUEUE] Estado restaurado: ${this.actionQueue.length} en cola, ${this.scheduledActions.length} programadas, ${rateLimits.length} rate limits`
      );
    } catch (error) {
      console.error("[QUEUE] Error inicializando desde BD:", error);
    }
  }

  // Nuevo: Convertir acción de BD a formato de memoria
  convertDbActionToMemoryAction(dbAction) {
    return {
      id: dbAction.actionId,
      accountId: dbAction.accountId,
      account: dbAction.account,
      action: dbAction.action,
      text: dbAction.text,
      tweetId: dbAction.tweetId,
      targetUserId: dbAction.targetUserId,
      targetUsername: dbAction.targetUsername,
      status: dbAction.status,
      createdAt: dbAction.createdAt.toISOString(),
      scheduledTime: dbAction.scheduledTime?.toISOString(),
      estimatedStartTime: dbAction.estimatedStartTime?.toISOString(),
      startedAt: dbAction.startedAt?.toISOString(),
      baseDelay: dbAction.baseDelay,
      randomDelay: dbAction.randomDelay,
      actualDelay: dbAction.actualDelay,
      batchId: dbAction.batchId,
      accountLabels: dbAction.accountLabels || [],
      username: dbAction.account.username,
      accountUsername: dbAction.account.username,
    };
  }

  // Nuevo: Persistir acción en BD
  async persistActionToDb(action) {
    try {
      await this.prisma.queuedAction.upsert({
        where: { actionId: action.id },
        update: {
          status: action.status,
          estimatedStartTime: action.estimatedStartTime
            ? new Date(action.estimatedStartTime)
            : null,
          startedAt: action.startedAt ? new Date(action.startedAt) : null,
          actualDelay: action.actualDelay,
        },
        create: {
          actionId: action.id,
          accountId: action.accountId,
          action: action.action,
          text: action.text,
          tweetId: action.tweetId,
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
          status: action.status,
          scheduledTime: action.scheduledTime
            ? new Date(action.scheduledTime)
            : null,
          estimatedStartTime: action.estimatedStartTime
            ? new Date(action.estimatedStartTime)
            : null,
          startedAt: action.startedAt ? new Date(action.startedAt) : null,
          baseDelay: action.baseDelay,
          randomDelay: action.randomDelay,
          actualDelay: action.actualDelay,
          batchId: action.batchId,
          accountLabels: action.accountLabels || [],
        },
      });
    } catch (error) {
      console.error(`[QUEUE] Error persistiendo acción ${action.id}:`, error);
    }
  }

  // Nuevo: Remover acción de BD
  async removeActionFromDb(actionId) {
    try {
      await this.prisma.queuedAction.delete({
        where: { actionId: actionId },
      });
    } catch (error) {
      // Ignorar errores si ya no existe
      console.log(`[QUEUE] Acción ${actionId} ya no existe en BD`);
    }
  }

  // Nuevo: Marcar acción como fallida
  async markActionAsFailed(actionId, errorMessage) {
    await this.prisma.queuedAction.update({
      where: { actionId: actionId },
      data: {
        status: "FAILED",
      },
    });

    // También actualizar el historial
    await this.prisma.actionHistory.upsert({
      where: { actionId: actionId },
      update: {
        status: "FAILED",
        success: false,
        error: errorMessage,
        completedAt: new Date(),
      },
      create: {
        actionId: actionId,
        accountId: "unknown",
        username: "unknown",
        action: "unknown",
        status: "FAILED",
        success: false,
        error: errorMessage,
        completedAt: new Date(),
      },
    });
  }

  // Modificar: addActionsToQueue para incluir accountLabels
  async addActionsToQueue(actions) {
    for (const actionObj of actions) {
      // Asegurar que tenemos accountLabels
      if (!actionObj.accountLabels && actionObj.account) {
        actionObj.accountLabels = actionObj.account.labels || [];
      }

      // Asegurar que tenemos accountUsername
      if (!actionObj.accountUsername && actionObj.account) {
        actionObj.accountUsername = actionObj.account.username;
      }

      // Persistir en BD
      await this.persistActionToDb(actionObj);

      // Agregar a memoria
      if (actionObj.scheduledTime) {
        this.scheduledActions.push(actionObj);
      } else {
        this.actionQueue.push(actionObj);
      }

      // Guardar en historial
      await this.addToHistory(actionObj);
    }
  }

  // Modificar: processQueue para actualizar BD
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

    this.runningActions.add(action);
    action.status = "RUNNING";
    action.startedAt = new Date().toISOString();

    // Persistir cambio de estado en BD
    await this.persistActionToDb(action);
    await this.addToHistory(action);

    // Actualizar el tracker ANTES de ejecutar la acción
    await this.updateRateLimitTracker(action.accountId, action.action);

    try {
      console.log(`[QUEUE] Executing action ${action.id} via executeAction...`);
      const result = await this.executeAction(action);
      action.status = "COMPLETED";
      action.success = true;
      action.result = result;

      // Remover de BD ya que se completó
      await this.removeActionFromDb(action.id);
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
        await this.updateRateLimitTracker(action.accountId, action.action);

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

      // Si la acción se re-encola, persistir el cambio
      if (action.status === "QUEUED") {
        await this.persistActionToDb(action);
      } else {
        // Si falló definitivamente, remover de BD
        await this.removeActionFromDb(action.id);
      }
    } finally {
      console.log(
        `[QUEUE] Finalizing action ${action.id}, preparing to save final state.`
      );
      action.completedAt = new Date().toISOString();
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
          await this.updateRateLimitTracker(action.accountId, "get_user_id");
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

  async getQueueStatus() {
    try {
      // Obtener acciones programadas desde BD para datos más precisos
      const [scheduledFromDb, queuedFromDb, runningFromDb] = await Promise.all([
        this.prisma.queuedAction.findMany({
          where: { status: "SCHEDULED" },
          include: { account: true },
          orderBy: { scheduledTime: "asc" },
        }),
        this.prisma.queuedAction.findMany({
          where: { status: "QUEUED" },
          include: { account: true },
          orderBy: { estimatedStartTime: "asc" },
        }),
        this.prisma.queuedAction.findMany({
          where: { status: "RUNNING" },
          include: { account: true },
          orderBy: { startedAt: "asc" },
        }),
      ]);

      return {
        queue: queuedFromDb.map((action) => ({
          id: action.actionId,
          accountId: action.accountId,
          accountUsername: action.account.username,
          accountLabels: action.accountLabels || action.account.labels || [],
          action: action.action,
          text: action.text,
          tweetId: action.tweetId,
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
          status: action.status,
          createdAt: action.createdAt.toISOString(),
          estimatedStartTime: action.estimatedStartTime?.toISOString(),
        })),

        running: runningFromDb.map((action) => ({
          id: action.actionId,
          accountId: action.accountId,
          accountUsername: action.account.username,
          accountLabels: action.accountLabels || action.account.labels || [],
          action: action.action,
          text: action.text,
          tweetId: action.tweetId,
          targetUserId: action.targetUserId,
          status: action.status,
          startedAt: action.startedAt?.toISOString(),
        })),

        scheduled: scheduledFromDb.map((action) => ({
          id: action.actionId,
          accountId: action.accountId,
          accountUsername: action.account.username,
          accountLabels: action.accountLabels || action.account.labels || [],
          action: action.action,
          text: action.text,
          tweetId: action.tweetId,
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
          scheduledTime: action.scheduledTime?.toISOString(),
          status: action.status,
          createdAt: action.createdAt.toISOString(),
          baseDelay: action.baseDelay,
          randomDelay: action.randomDelay,
        })),

        stats: {
          queueLength: queuedFromDb.length,
          runningCount: runningFromDb.length,
          scheduled: scheduledFromDb.length,
        },
      };
    } catch (error) {
      console.error("[QUEUE] Error obteniendo estado desde BD:", error);
      // Fallback a datos en memoria si hay error de BD
      return {
        queue: this.actionQueue.map((a) => ({
          id: a.id,
          accountUsername: a.accountUsername || a.account?.username,
          accountLabels: a.accountLabels || [],
          action: a.action,
          text: a.text,
          createdAt: a.createdAt,
          estimatedStartTime: a.estimatedStartTime,
        })),
        running: Array.from(this.runningActions).map((a) => ({
          id: a.id,
          accountUsername: a.accountUsername || a.account?.username,
          accountLabels: a.accountLabels || [],
          action: a.action,
          text: a.text,
          startedAt: a.startedAt,
        })),
        scheduled: this.scheduledActions.map((a) => ({
          id: a.id,
          accountUsername: a.accountUsername || a.account?.username,
          accountLabels: a.accountLabels || [],
          action: a.action,
          text: a.text,
          scheduledTime: a.scheduledTime,
          createdAt: a.createdAt,
          baseDelay: a.baseDelay,
          randomDelay: a.randomDelay,
        })),
        stats: {
          queueLength: this.actionQueue.length,
          runningCount: this.runningActions.size,
          scheduled: this.scheduledActions.length,
        },
      };
    }
  }

  // Mejorar addToHistory para asegurar consistencia
  async addToHistory(actionInfo) {
    const resolvedUsername =
      actionInfo.username ||
      actionInfo.accountUsername ||
      (actionInfo.account && actionInfo.account.username);

    if (!resolvedUsername) {
      console.error("❌ ERROR: username faltante en actionInfo:", actionInfo);
      return;
    }

    // Asegurar que tenemos accountLabels
    const accountLabels =
      actionInfo.accountLabels ||
      (actionInfo.account && actionInfo.account.labels) ||
      [];

    const updateData = {
      accountId: actionInfo.accountId,
      username: resolvedUsername,
      accountLabels: accountLabels,
      action: actionInfo.action,
      text: actionInfo.text,
      tweetId: actionInfo.tweetId,
      targetUserId: actionInfo.targetUserId,
      status: this.mapQueueStatusToActionStatus(actionInfo.status),
      success: actionInfo.success ?? false,
      baseDelay: actionInfo.baseDelay,
      randomDelay: actionInfo.randomDelay,
      actualDelay: actionInfo.actualDelay,
      result: actionInfo.result,
      error: actionInfo.error,
      errorCode: actionInfo.errorCode,
      batchId: actionInfo.batchId,
    };

    // Timestamps
    if (actionInfo.createdAt)
      updateData.createdAt = new Date(actionInfo.createdAt);
    if (actionInfo.startedAt)
      updateData.startedAt = new Date(actionInfo.startedAt);
    if (actionInfo.completedAt)
      updateData.completedAt = new Date(actionInfo.completedAt);

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
  }

  // Nuevo: Mapear estados de QueueStatus a ActionStatus
  mapQueueStatusToActionStatus(queueStatus) {
    const mapping = {
      QUEUED: "QUEUED",
      SCHEDULED: "QUEUED",
      RUNNING: "RUNNING",
      COMPLETED: "COMPLETED",
      FAILED: "FAILED",
      CANCELLED: "CANCELLED",
    };
    return mapping[queueStatus] || queueStatus;
  }

  // Nuevo: Helper para actualizar el tracker de rate limits
  async updateRateLimitTracker(accountId, actionType) {
    const now = Date.now();

    // Actualizar en memoria
    if (!this.rateLimitTracker.has(accountId)) {
      this.rateLimitTracker.set(accountId, new Map());
    }
    this.rateLimitTracker.get(accountId).set(actionType, now);

    // Persistir en BD
    try {
      await this.prisma.rateLimitTracker.upsert({
        where: {
          accountId_actionType: {
            accountId: accountId,
            actionType: actionType,
          },
        },
        update: {
          lastUsed: new Date(now),
        },
        create: {
          accountId: accountId,
          actionType: actionType,
          lastUsed: new Date(now),
        },
      });
    } catch (error) {
      console.error(`[RATE_LIMIT] Error persistiendo tracker:`, error);
    }

    console.log(
      `[RATE_LIMIT] Tracker actualizado para ${accountId}, acción ${actionType}`
    );
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

  generateActionId() {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addScheduledAction(actionObj) {
    this.scheduledActions.push(actionObj);
  }

  async cancelAction(id) {
    let actionCancelled = false;

    try {
      // 1. Buscar y cancelar en BD primero
      const dbAction = await this.prisma.queuedAction.findUnique({
        where: { actionId: id },
        include: { account: true },
      });

      if (dbAction) {
        // Actualizar estado en BD
        await this.prisma.queuedAction.update({
          where: { actionId: id },
          data: { status: "CANCELLED" },
        });

        // Crear entrada en historial
        await this.prisma.actionHistory.upsert({
          where: { actionId: id },
          update: {
            status: "CANCELLED",
            success: false,
            completedAt: new Date(),
            error: "Acción cancelada por el usuario",
          },
          create: {
            actionId: id,
            accountId: dbAction.accountId,
            username: dbAction.account.username,
            accountLabels:
              dbAction.accountLabels || dbAction.account.labels || [],
            action: dbAction.action,
            text: dbAction.text,
            tweetId: dbAction.tweetId,
            targetUserId: dbAction.targetUserId,
            status: "CANCELLED",
            success: false,
            createdAt: dbAction.createdAt,
            completedAt: new Date(),
            error: "Acción cancelada por el usuario",
          },
        });

        // Remover de BD
        await this.removeActionFromDb(id);
        actionCancelled = true;
        console.log(`[QUEUE] Acción ${id} cancelada desde BD`);
      }

      // 2. Buscar y remover de memoria también
      const queueIndex = this.actionQueue.findIndex((a) => a.id === id);
      if (queueIndex !== -1) {
        this.actionQueue.splice(queueIndex, 1);
        actionCancelled = true;
        console.log(`[QUEUE] Acción ${id} removida de cola en memoria`);
      }

      const scheduledIndex = this.scheduledActions.findIndex(
        (a) => a.id === id
      );
      if (scheduledIndex !== -1) {
        this.scheduledActions.splice(scheduledIndex, 1);
        actionCancelled = true;
        console.log(`[QUEUE] Acción ${id} removida de programadas en memoria`);
      }

      // 3. Remover de acciones en ejecución si está ahí
      for (const runningAction of this.runningActions) {
        if (runningAction.id === id) {
          this.runningActions.delete(runningAction);
          actionCancelled = true;
          console.log(`[QUEUE] Acción ${id} removida de ejecución`);
          break;
        }
      }

      return actionCancelled;
    } catch (error) {
      console.error(`[QUEUE] Error cancelando acción ${id}:`, error);
      return false;
    }
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

    try {
      // 1. Obtener todas las acciones pendientes desde BD
      const allPendingActions = await this.prisma.queuedAction.findMany({
        where: {
          status: {
            in: ["QUEUED", "SCHEDULED", "RUNNING"],
          },
        },
        include: { account: true },
      });

      // 2. Actualizar todas a CANCELLED en BD
      if (allPendingActions.length > 0) {
        await this.prisma.queuedAction.updateMany({
          where: {
            status: {
              in: ["QUEUED", "SCHEDULED", "RUNNING"],
            },
          },
          data: {
            status: "CANCELLED",
          },
        });

        // 3. Crear entradas en historial para cada una
        for (const action of allPendingActions) {
          try {
            await this.prisma.actionHistory.upsert({
              where: { actionId: action.actionId },
              update: {
                status: "CANCELLED",
                success: false,
                completedAt: new Date(),
                error: "Cancelada masivamente por el administrador",
              },
              create: {
                actionId: action.actionId,
                accountId: action.accountId,
                username: action.account.username,
                accountLabels:
                  action.accountLabels || action.account.labels || [],
                action: action.action,
                text: action.text,
                tweetId: action.tweetId,
                targetUserId: action.targetUserId,
                status: "CANCELLED",
                success: false,
                createdAt: action.createdAt,
                completedAt: new Date(),
                error: "Cancelada masivamente por el administrador",
              },
            });
            canceledCount++;
          } catch (historyError) {
            console.error(
              `Error actualizando historial para ${action.actionId}:`,
              historyError
            );
          }
        }

        // 4. Limpiar todas las acciones de BD
        await this.prisma.queuedAction.deleteMany({
          where: {
            status: "CANCELLED",
          },
        });
      }

      // 5. Limpiar colas en memoria
      this.scheduledActions = [];
      this.actionQueue = [];
      this.runningActions.clear();

      console.log(
        `🧹 Se cancelaron y limpiaron ${canceledCount} acciones de las colas.`
      );
      return canceledCount;
    } catch (error) {
      console.error(
        "[QUEUE] Error en clearAllQueuedAndScheduledActions:",
        error
      );
      throw error;
    }
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
}

module.exports = QueueService;
