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

    // 🔥 BUSCAR LA PRIMERA ACCIÓN LISTA PARA EJECUTAR
    const now = new Date();
    const readyActionIndex = this.actionQueue.findIndex((action) => {
      const executeTime = new Date(
        action.estimatedStartTime || action.scheduledTime
      );
      return executeTime <= now;
    });

    if (readyActionIndex === -1) {
      // No hay acciones listas para ejecutar
      return;
    }

    // Extraer la acción lista
    const action = this.actionQueue.splice(readyActionIndex, 1)[0];
    if (!action) return;

    console.log(
      `[QUEUE] Processing action ${action.id} for @${action.account.username}`
    );

    // 🔥 AHORA SÍ PASA A RUNNING (sin delay adicional)
    this.runningActions.add(action);
    action.status = "RUNNING";
    action.startedAt = new Date().toISOString();
    await this.addToHistory(action);

    try {
      console.log(`[QUEUE] Executing action ${action.id} via executeAction...`);
      const result = await this.executeAction(action);
      action.status = "COMPLETED";
      action.success = true;
      action.result = result;
      console.log(`✅ [QUEUE] Action ${action.id} successful.`);
    } catch (err) {
      const errorStr = err.message?.toLowerCase() || "";

      // 🔧 Manejo especial para follows duplicados
      if (
        action.action === "follow" &&
        (errorStr.includes("already") ||
          errorStr.includes("following") ||
          errorStr.includes("duplicate") ||
          err.code === "AlreadyFollowing" ||
          err.status === 403)
      ) {
        console.log(
          `⚠️ [QUEUE] Follow duplicado considerado como éxito para ${action.id}`
        );

        action.status = "COMPLETED";
        action.success = true;
        action.result = { note: "Ya se estaba siguiendo esta cuenta" };
      } else {
        console.error(`❌ [QUEUE] Action ${action.id} failed:`, err.message);
        action.status = "FAILED";
        action.success = false;
        action.error = err.message;
        action.errorCode = err.twitterError ? String(err.twitterError) : null;
      }
    } finally {
      console.log(
        `[QUEUE] Finalizing action ${action.id}, preparing to save final state.`
      );
      action.completedAt = new Date().toISOString();
      await this.addToHistory(action); // Guardar estado final (COMPLETED o FAILED)
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

      const client = await this.twitterService.getTwitterClient(action.account);

      // 🔥 Obtener el ID del usuario autenticado para API v2
      const { data: currentUser } = await client.v2.me();

      // 🔥 USAR API v2 para likes
      const result = await client.v2.like(currentUser.id, action.tweetId);

      console.log(
        `✅ Like ejecutado exitosamente para tweet ${action.tweetId}`
      );

      return {
        likedTweetId: action.tweetId,
        liked: result.data.liked,
        userId: currentUser.id,
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

      const client = await this.twitterService.getTwitterClient(action.account);

      // 🔥 Obtener el ID del usuario autenticado para API v2
      const { data: currentUser } = await client.v2.me();

      // 🔥 USAR API v2 para retweets
      const result = await client.v2.retweet(currentUser.id, action.tweetId);

      console.log(
        `✅ Retweet ejecutado exitosamente para tweet ${action.tweetId}`
      );

      return {
        retweetedTweetId: action.tweetId,
        retweeted: result.data.retweeted,
        userId: currentUser.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "retweet");
      throw error;
    }
  }

  async executeFollow(action) {
    try {
      const rawTarget = action.targetUsername || action.targetUserId;
      console.log(
        `👥 Ejecutando follow: @${action.account.username} → @${rawTarget}`
      );

      const client = await this.twitterService.getTwitterClient(action.account);

      const targetUsername = (rawTarget || "").replace(/^@/, "").trim();
      if (!targetUsername) {
        throw new Error("El username a seguir no es válido o está vacío.");
      }

      let targetUserId;
      try {
        const { data: targetUser } = await client.v2.userByUsername(
          targetUsername
        );
        if (!targetUser) {
          throw new Error(
            `Usuario de Twitter @${targetUsername} no encontrado.`
          );
        }
        targetUserId = targetUser.id;
      } catch (userLookupError) {
        console.error(
          `Error buscando al usuario @${targetUsername}:`,
          userLookupError
        );
        throw new Error(
          `No se pudo encontrar el usuario de Twitter @${targetUsername}. Verifica que el nombre de usuario es correcto.`
        );
      }

      const { data: currentUser } = await client.v2.me();

      const result = await client.v2.follow(currentUser.id, targetUserId);

      console.log(
        `✅ Follow ejecutado exitosamente: @${action.account.username} → ${targetUserId} (@${targetUsername})`
      );

      return {
        targetUserId: targetUserId,
        targetUsername: targetUsername,
        followerUsername: action.account.username,
        following: result.data.following,
        userId: currentUser.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // 🔧 Manejo especial para errores de follow
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
          `⚠️ Follow ya existente: @${action.account.username} → ${targetUserId} (considerado como éxito)`
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
    try {
      const rawTarget = action.targetUsername || action.targetUserId;
      console.log(
        `👥❌ Ejecutando unfollow: @${action.account.username} → @${rawTarget}`
      );

      const client = await this.twitterService.getTwitterClient(action.account);

      const targetUsername = (rawTarget || "").replace(/^@/, "").trim();
      if (!targetUsername) {
        throw new Error(
          "El username a dejar de seguir no es válido o está vacío."
        );
      }

      let targetUserId;
      try {
        const { data: targetUser } = await client.v2.userByUsername(
          targetUsername
        );
        if (!targetUser) {
          throw new Error(
            `Usuario de Twitter @${targetUsername} no encontrado.`
          );
        }
        targetUserId = targetUser.id;
      } catch (userLookupError) {
        console.error(
          `Error buscando al usuario @${targetUsername}:`,
          userLookupError
        );
        throw new Error(
          `No se pudo encontrar el usuario de Twitter @${targetUsername}. Verifica que el nombre de usuario es correcto.`
        );
      }

      const { data: currentUser } = await client.v2.me();

      const result = await client.v2.unfollow(currentUser.id, targetUserId);

      console.log(
        `✅ Unfollow ejecutado exitosamente: @${action.account.username} → ${targetUserId} (@${targetUsername})`
      );

      return {
        targetUserId: targetUserId,
        targetUsername: targetUsername,
        followerUsername: action.account.username,
        following: result.data.following, // Debería ser false
        userId: currentUser.id,
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
}

module.exports = QueueService;
