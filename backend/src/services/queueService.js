const { TwitterApi } = require("twitter-api-v2");
const TwitterService = require("./twitterService");

const VERBOSE_QUEUE_LOGS = process.env.VERBOSE_QUEUE_LOGS === "true";
const VERBOSE_HISTORY_LOGS = process.env.VERBOSE_HISTORY_LOGS === "true";

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
      console.log("🔄 Inicializando cola desde la base de datos...");

      const selectFields = {
        actionId: true,
        accountId: true,
        action: true,
        text: true,
        tweetId: true,
        targetUserId: true,
        targetUsername: true,
        status: true,
        priority: true,
        scheduledTime: true,
        estimatedStartTime: true,
        startedAt: true,
        baseDelay: true,
        randomDelay: true,
        actualDelay: true,
        batchId: true,
        accountLabels: true,
        useRandomDistribution: true,
        distributionConfig: true,
        createdAt: true,
        account: {
          select: { id: true, username: true },
        },
      };

      const queuedFromDb = await this.prisma.queuedAction.findMany({
        where: {
          status: "QUEUED",
        },
        select: selectFields,
        orderBy: {
          estimatedStartTime: "asc",
        },
      });

      const scheduledFromDb = await this.prisma.queuedAction.findMany({
        where: {
          status: "SCHEDULED",
        },
        select: selectFields,
        orderBy: {
          scheduledTime: "asc",
        },
      });

      const runningFromDb = await this.prisma.queuedAction.findMany({
        where: {
          status: "RUNNING",
        },
        select: selectFields,
      });

      // Convertir y cargar en memoria
      this.actionQueue = queuedFromDb.map((dbAction) =>
        this.convertDbActionToMemoryAction(dbAction)
      );
      this.scheduledActions = scheduledFromDb.map((dbAction) =>
        this.convertDbActionToMemoryAction(dbAction)
      );

      // Para acciones en ejecución, usar Set
      this.runningActions = new Set(
        runningFromDb.map((dbAction) =>
          this.convertDbActionToMemoryAction(dbAction)
        )
      );

      // 🔍 LOGGING ESPECÍFICO PARA FOLLOWS AL INICIALIZAR
      const followActions = [
        ...queuedFromDb,
        ...scheduledFromDb,
        ...runningFromDb,
      ].filter((action) => action.action === "follow");

      if (followActions.length > 0) {
        console.log(
          `[QUEUE_DEBUG] ${followActions.length} acciones follow cargadas desde BD:`
        );
        followActions.forEach((action, index) => {
          console.log(
            `  ${index + 1}. ID: ${action.actionId}, Target: @${
              action.targetUsername
            } (ID: ${action.targetUserId}), Status: ${action.status}`
          );
        });
      }

      console.log(
        `✅ Cola inicializada: ${this.actionQueue.length} en cola, ${this.scheduledActions.length} programadas, ${this.runningActions.size} ejecutándose`
      );

      return {
        queue: this.actionQueue.length,
        scheduled: this.scheduledActions.length,
        running: this.runningActions.size,
      };
    } catch (error) {
      console.error("❌ Error inicializando cola desde BD:", error);
      throw error;
    }
  }

  // Nuevo: Convertir acción de BD a formato de memoria
  convertDbActionToMemoryAction(dbAction) {
    // 🔥 ARREGLAR: Mapear status de BD (enum) a memoria (lowercase)
    const statusMapping = {
      QUEUED: "queued",
      SCHEDULED: "scheduled",
      RUNNING: "running",
      COMPLETED: "completed",
      FAILED: "failed",
      CANCELLED: "cancelled",
    };

    const memoryAction = {
      id: dbAction.actionId,
      accountId: dbAction.accountId,
      action: dbAction.action,
      text: dbAction.text,
      tweetId: dbAction.tweetId,
      targetUserId: dbAction.targetUserId,
      targetUsername: dbAction.targetUsername,
      status: statusMapping[dbAction.status] || dbAction.status.toLowerCase(),
      priority: dbAction.priority || 0,
      scheduledTime: dbAction.scheduledTime?.toISOString(),
      estimatedStartTime: dbAction.estimatedStartTime?.toISOString(),
      startedAt: dbAction.startedAt?.toISOString(),
      baseDelay: dbAction.baseDelay,
      randomDelay: dbAction.randomDelay,
      actualDelay: dbAction.actualDelay,
      batchId: dbAction.batchId,
      accountLabels: dbAction.accountLabels || [],
      useRandomDistribution: dbAction.useRandomDistribution || false,
      distributionConfig: dbAction.distributionConfig,
      createdAt: dbAction.createdAt?.toISOString(),
      account: dbAction.account, // Incluir datos de la cuenta si están disponibles
    };

    // 🔍 LOGGING ESPECÍFICO PARA FOLLOWS AL CONVERTIR DE BD
    if (dbAction.action === "follow") {
      console.log(`[QUEUE_DEBUG] Convirtiendo acción follow de BD a memoria:`, {
        actionId: memoryAction.id,
        accountId: memoryAction.accountId,
        targetUserId: memoryAction.targetUserId,
        targetUsername: memoryAction.targetUsername,
        status: `${dbAction.status} → ${memoryAction.status}`,
        scheduledTime: memoryAction.scheduledTime,
      });
    }

    return memoryAction;
  }

  // Nuevo: Persistir acción en BD
  async persistActionToDb(action) {
    try {
      // 🔍 LOGGING ESPECÍFICO PARA FOLLOWS AL PERSISTIR
      if (action.action === "follow") {
        console.log(`[QUEUE_DEBUG] Persistiendo acción follow en BD:`, {
          actionId: action.id,
          accountId: action.accountId,
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
          status: action.status,
        });
      }

      // 🔥 ARREGLAR: Mapear status a valores válidos del enum
      const statusMapping = {
        queued: "QUEUED",
        scheduled: "SCHEDULED",
        running: "RUNNING",
        completed: "COMPLETED",
        failed: "FAILED",
        cancelled: "CANCELLED",
      };

      const dbStatus = statusMapping[action.status.toLowerCase()] || "QUEUED";

      await this.prisma.queuedAction.upsert({
        where: { actionId: action.id },
        update: {
          status: dbStatus,
          estimatedStartTime: action.estimatedStartTime
            ? new Date(action.estimatedStartTime)
            : null,
          startedAt: action.startedAt ? new Date(action.startedAt) : null,
          actualDelay: action.actualDelay,
          useRandomDistribution: action.useRandomDistribution || false,
          distributionConfig: action.distributionConfig || null,
          // Asegurar que se actualicen también estos campos
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
        },
        create: {
          actionId: action.id,
          accountId: action.accountId,
          action: action.action,
          text: action.text,
          tweetId: action.tweetId,
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
          status: dbStatus,
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
          useRandomDistribution: action.useRandomDistribution || false,
          distributionConfig: action.distributionConfig || null,
        },
      });

      // 🔍 VERIFICAR QUE SE GUARDÓ CORRECTAMENTE
      if (action.action === "follow") {
        const savedAction = await this.prisma.queuedAction.findUnique({
          where: { actionId: action.id },
          select: {
            actionId: true,
            targetUserId: true,
            targetUsername: true,
            status: true,
          },
        });
        console.log(`[QUEUE_DEBUG] Acción follow guardada en BD:`, savedAction);
      }
    } catch (error) {
      console.error(`[QUEUE] Error persistiendo acción ${action.id}:`, error);
      throw error; // Re-lanzar el error para que no continúe el proceso si falla
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

  // Nuevo: Actualizar acción en BD
  async updateActionInDb(actionId, updateData) {
    try {
      // 🔥 ARREGLAR: Mapear status a valores válidos del enum
      const statusMapping = {
        queued: "QUEUED",
        scheduled: "SCHEDULED",
        running: "RUNNING",
        completed: "COMPLETED",
        failed: "FAILED",
        cancelled: "CANCELLED",
      };

      // 🔥 ARREGLAR: Remover campos que no existen en el schema QueuedAction
      const allowedFields = {
        status: updateData.status
          ? statusMapping[updateData.status.toLowerCase()] || updateData.status
          : undefined,
        estimatedStartTime: updateData.estimatedStartTime,
        startedAt: updateData.startedAt,
        actualDelay: updateData.actualDelay,
        useRandomDistribution: updateData.useRandomDistribution,
        distributionConfig: updateData.distributionConfig,
        targetUserId: updateData.targetUserId,
        targetUsername: updateData.targetUsername,
        scheduledTime: updateData.scheduledTime,
        baseDelay: updateData.baseDelay,
        randomDelay: updateData.randomDelay,
        batchId: updateData.batchId,
        accountLabels: updateData.accountLabels,
        priority: updateData.priority,
      };

      // Filtrar solo campos definidos y válidos
      const filteredData = {};
      Object.keys(allowedFields).forEach((key) => {
        if (allowedFields[key] !== undefined) {
          filteredData[key] = allowedFields[key];
        }
      });

      // Solo actualizar si hay campos válidos
      if (Object.keys(filteredData).length === 0) {
        console.log(
          `[QUEUE] No hay campos válidos para actualizar en acción ${actionId}`
        );
        return;
      }

      // 🔥 VERIFICAR SI LA ACCIÓN EXISTE ANTES DE ACTUALIZAR (incluyendo datos de la cuenta)
      const existingAction = await this.prisma.queuedAction.findUnique({
        where: { actionId: actionId },
        include: {
          account: {
            select: {
              username: true,
              labels: true,
            },
          },
        },
      });

      if (!existingAction) {
        console.log(
          `[QUEUE] Acción ${actionId} no existe en BD, saltando actualización`
        );
        return;
      }

      await this.prisma.queuedAction.update({
        where: { actionId: actionId },
        data: filteredData,
      });

      if (updateData.error) {
        // Obtener datos de la acción para referencias correctas
        const actionForHistory = existingAction;

        await this.prisma.actionHistory.upsert({
          where: { actionId: actionId },
          update: {
            error: updateData.error,
            status: filteredData.status || "FAILED",
            success: false,
            completedAt: new Date(),
          },
          create: {
            actionId: actionId,
            accountId: actionForHistory.accountId,
            username:
              actionForHistory.accountUsername ||
              (actionForHistory.account && actionForHistory.account.username) ||
              "unknown",
            accountLabels:
              actionForHistory.accountLabels ||
              actionForHistory.account?.labels ||
              [],
            action: actionForHistory.action || "unknown",
            status: filteredData.status || "FAILED",
            success: false,
            error: updateData.error,
            createdAt: actionForHistory.createdAt || new Date(),
            completedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`[QUEUE] Error actualizando acción ${actionId}:`, error);
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
    console.log(`📥 Agregando ${actions.length} acciones a la cola`);

    // 🔍 LOGGING DETALLADO PARA DEBUGGEAR
    actions.forEach((action, index) => {
      if (action.action === "follow") {
        console.log(
          `[QUEUE_DEBUG] Acción follow #${index + 1} antes de procesar:`,
          {
            actionId: action.id,
            accountId: action.accountId,
            targetUserId: action.targetUserId,
            targetUsername: action.targetUsername,
            accountUsername: action.accountUsername,
          }
        );
      }
    });

    const processedActions = [];
    const now = new Date();
    const minDelayDefaultMs = 16 * 60 * 1000; // 16 minutes
    const minDelayFollowMs = 30 * 60 * 1000; // 30 minutes

    // Agrupar acciones por cuenta
    const actionsByAccount = {};
    for (const action of actions) {
      if (!actionsByAccount[action.accountId])
        actionsByAccount[action.accountId] = [];
      actionsByAccount[action.accountId].push(action);
    }

    // Para cada cuenta, distribuir los tiempos de ejecución
    const bulkToPersist = [];
    for (const [accountId, accountActions] of Object.entries(
      actionsByAccount
    )) {
      // Ordenar por algún criterio si es necesario (por ejemplo, por targetUsername)
      // accountActions.sort((a, b) => ...);
      let lastScheduled = now;
      for (let i = 0; i < accountActions.length; i++) {
        let action = accountActions[i];
        let scheduledTime;

        // Determinar delay mínimo según tipo de acción (se usará a lo largo del loop)
        const minDelayMs =
          action.action === "follow" ? minDelayFollowMs : minDelayDefaultMs;

        if (action.scheduledTime) {
          scheduledTime = new Date(action.scheduledTime);
        } else {
          if (
            action.useRandomDistribution &&
            action.distributionTimes &&
            action.distributionTimes[i]
          ) {
            const candidateTime = new Date(action.distributionTimes[i]);
            if (i === 0 || candidateTime - lastScheduled >= minDelayMs) {
              scheduledTime = candidateTime;
            } else {
              scheduledTime = new Date(lastScheduled.getTime() + minDelayMs);
            }
          } else {
            scheduledTime =
              i === 0 ? now : new Date(lastScheduled.getTime() + minDelayMs);
          }
        }
        lastScheduled = scheduledTime;

        // 🛡️  Ajustar para respetar delay mínimo con acciones previas de LA MISMA CUENTA (incluso de lotes anteriores)
        // (Mantener compatibilidad con el tracker de rate limit)
        const trackerKey = `${accountId}_${action.action}`;
        let latest = this.rateLimitTracker.get(trackerKey) || new Date(0);
        if (scheduledTime < new Date(latest.getTime() + minDelayMs)) {
          scheduledTime = new Date(latest.getTime() + minDelayMs);
          lastScheduled = scheduledTime;
        }
        this.rateLimitTracker.set(trackerKey, scheduledTime);

        const actionObj = {
          id: this.generateActionId(),
          accountId: action.accountId,
          action: action.action,
          text: action.text,
          tweetId: action.tweetId,
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
          status: "queued",
          priority: action.priority || 0,
          scheduledTime: scheduledTime,
          estimatedStartTime: scheduledTime,
          baseDelay: action.baseDelay,
          randomDelay: action.randomDelay,
          actualDelay: scheduledTime.getTime() - now.getTime(),
          batchId: action.batchId,
          accountLabels: action.accountLabels || [],
          useRandomDistribution: action.useRandomDistribution || false,
          distributionConfig: action.distributionConfig || null,
          createdAt: now,
        };

        // 🔍 LOGGING ESPECÍFICO PARA FOLLOWS DESPUÉS DE PROCESAR
        if (action.action === "follow") {
          console.log(`[QUEUE_DEBUG] Acción follow después de procesar:`, {
            actionId: actionObj.id,
            accountId: actionObj.accountId,
            targetUserId: actionObj.targetUserId,
            targetUsername: actionObj.targetUsername,
            scheduledTime: actionObj.scheduledTime.toISOString(),
          });
        }

        // Persistir más tarde (bulk)
        bulkToPersist.push(actionObj);

        // Agregar a memoria
        this.actionQueue.push(actionObj);
        processedActions.push(actionObj);

        console.log(
          `✅ Acción ${
            actionObj.id
          } programada para: ${scheduledTime.toLocaleString("es-ES")}`
        );
      }
    }

    // Persistencia BULK
    await this.persistActionToDbBulk(bulkToPersist);

    // Ordenar cola por tiempo programado
    this.actionQueue.sort(
      (a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)
    );

    console.log(
      `🎯 ${processedActions.length} acciones agregadas exitosamente`
    );
    console.log(
      `📊 Cola actual: ${this.actionQueue.length} acciones pendientes`
    );

    if (processedActions.length > 0) {
      const firstAction = processedActions[0];
      const lastAction = processedActions[processedActions.length - 1];
      console.log(
        `⏰ Rango de ejecución: ${firstAction.scheduledTime.toLocaleString(
          "es-ES"
        )} - ${lastAction.scheduledTime.toLocaleString("es-ES")}`
      );
    }

    return {
      success: true,
      message: `${processedActions.length} acciones agregadas a la cola`,
      actions: processedActions.map((action) => ({
        id: action.id,
        accountId: action.accountId,
        action: action.action,
        scheduledTime: action.scheduledTime,
        estimatedStartTime: action.estimatedStartTime,
        actualDelay: action.actualDelay,
        useRandomDistribution: action.useRandomDistribution,
      })),
    };
  }

  async persistActionToDbBulk(actions) {
    try {
      if (!actions || actions.length === 0) return;

      const statusMapping = {
        queued: "QUEUED",
        scheduled: "SCHEDULED",
        running: "RUNNING",
        completed: "COMPLETED",
        failed: "FAILED",
        cancelled: "CANCELLED",
      };

      const data = actions.map((action) => ({
        actionId: action.id,
        accountId: action.accountId,
        action: action.action,
        text: action.text,
        tweetId: action.tweetId,
        targetUserId: action.targetUserId,
        targetUsername: action.targetUsername,
        status: statusMapping[action.status.toLowerCase()] || "QUEUED",
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
        useRandomDistribution: action.useRandomDistribution || false,
        distributionConfig: action.distributionConfig || null,
      }));

      await this.prisma.queuedAction.createMany({
        data,
        skipDuplicates: true,
      });
    } catch (error) {
      console.error("[QUEUE] Error en persistActionToDbBulk:", error);
      throw error;
    }
  }

  // Modificar: processQueue para actualizar BD
  async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const now = new Date();
    const minDelayDefaultMs = 16 * 60 * 1000;
    const minDelayFollowMs = 30 * 60 * 1000;

    try {
      // Obtener acciones listas para ejecutar
      const readyActions = this.actionQueue.filter((action) => {
        const minDelayMsLoop = action.action === "follow" ? minDelayFollowMs : minDelayDefaultMs;
        const isReady =
          action.status === "queued" && new Date(action.scheduledTime) <= now;

        // VERIFICAR DELAY MÍNIMO DESDE LA ÚLTIMA ACCIÓN DE LA MISMA CUENTA
        if (isReady) {
          const lastActionTime = this.rateLimitTracker.get(action.accountId);
          if (lastActionTime) {
            const timeSinceLastAction =
              now.getTime() - lastActionTime.getTime();
            if (timeSinceLastAction < minDelayMsLoop) {
              if (VERBOSE_QUEUE_LOGS) {
                console.log(
                  `⏰ Cuenta ${action.accountId} debe esperar ${Math.ceil(
                    (minDelayMsLoop - timeSinceLastAction) / 60000
                  )} minutos más`
                );
              }
              return false;
            }
          }
        }

        return isReady;
      });

      if (readyActions.length === 0) {
        return;
      }

      console.log(`🚀 Procesando ${readyActions.length} acciones listas`);

      // Procesar acciones una por una con delay mínimo
      for (const action of readyActions) {
        try {
          // Verificar nuevamente el delay mínimo antes de ejecutar
          const minDelayMsLoop = action.action === "follow" ? minDelayFollowMs : minDelayDefaultMs;
          const lastActionTime = this.rateLimitTracker.get(action.accountId);
          if (lastActionTime) {
            const timeSinceLastAction =
              now.getTime() - lastActionTime.getTime();
            if (timeSinceLastAction < minDelayMsLoop) {
              console.log(
                `⏰ Saltando acción ${action.id} - delay mínimo no cumplido`
              );
              continue;
            }
          }

          // Marcar como ejecutándose
          action.status = "running";
          action.startedAt = new Date();
          await this.updateActionInDb(action.id, {
            status: "RUNNING",
            startedAt: action.startedAt,
          });

          // Actualizar rate limit tracker ANTES de ejecutar
          this.rateLimitTracker.set(action.accountId, new Date());
          await this.updateRateLimitTracker(action.accountId, action.action);

          console.log(
            `🔄 Ejecutando acción ${action.id} (${action.action}) para cuenta ${action.accountId}`
          );

          // Ejecutar la acción
          const result = await this.executeAction(action);

          // Manejar diferentes formatos de respuesta
          if (result && typeof result === "object") {
            if (result.success === true) {
              // Marcar como completada
              action.status = "completed";
              action.completedAt = new Date();
              await this.updateActionInDb(action.id, {
                status: "COMPLETED",
                completedAt: action.completedAt,
                result: result.data,
              });

              console.log(`✅ Acción ${action.id} completada exitosamente`);
            } else if (result.success === false) {
              // Acción reprogramada o falló
              if (result.data && result.data.stage === "ID_LOOKUP_COMPLETED") {
                console.log(
                  `🔄 Acción ${action.id} reprogramada para lookup de ID`
                );
                // No remover de la cola, ya se reprogramó
                continue;
              } else {
                // Marcar como fallida
                action.status = "failed";
                action.error =
                  result.error || result.data?.note || "Error desconocido";
                await this.updateActionInDb(action.id, {
                  status: "FAILED",
                  error: action.error,
                });

                console.log(`❌ Acción ${action.id} falló: ${action.error}`);
              }
            } else {
              // Formato legacy - asumir éxito si no hay campo success
              action.status = "completed";
              action.completedAt = new Date();
              await this.updateActionInDb(action.id, {
                status: "COMPLETED",
                completedAt: action.completedAt,
                result: result,
              });

              console.log(
                `✅ Acción ${action.id} completada exitosamente (formato legacy)`
              );
            }
          } else {
            // Resultado inesperado
            action.status = "failed";
            action.error = "Resultado inesperado de la acción";
            await this.updateActionInDb(action.id, {
              status: "FAILED",
              error: action.error,
            });

            console.log(`❌ Acción ${action.id} falló: resultado inesperado`);
          }

          // Remover de la cola en memoria
          const index = this.actionQueue.findIndex((a) => a.id === action.id);
          if (index !== -1) {
            this.actionQueue.splice(index, 1);
          }

          // Agregar al historial
          await this.addToHistory({
            actionId: action.id,
            accountId: action.accountId,
            username:
              action.accountUsername ||
              (action.account && action.account.username) ||
              "unknown",
            accountLabels: action.accountLabels,
            action: action.action,
            text: action.text,
            tweetId: action.tweetId,
            targetUserId: action.targetUserId,
            status: this.mapQueueStatusToActionStatus(action.status),
            success: action.status === "completed",
            createdAt: action.createdAt,
            startedAt: action.startedAt,
            completedAt: action.completedAt,
            baseDelay: action.baseDelay,
            randomDelay: action.randomDelay,
            actualDelay: action.actualDelay,
            result: result.data || null,
            error: action.error,
            batchId: action.batchId,
          });

          // DELAY MÍNIMO ENTRE ACCIONES DE LA MISMA CUENTA Y MISMO TIPO
          const idx = readyActions.indexOf(action);
          if (idx < readyActions.length - 1) {
            const nextAction = readyActions[idx + 1];
            if (
              nextAction &&
              nextAction.accountId === action.accountId &&
              nextAction.action === action.action
            ) {
              if (VERBOSE_QUEUE_LOGS) {
                console.log(
                  `⏰ Misma cuenta + tipo; esperando ${minDelayMsLoop / 60000} minutos antes de la siguiente acción...`
                );
              }
              await new Promise((resolve) => setTimeout(resolve, minDelayMsLoop));
            }
          }
        } catch (error) {
          console.error(
            `❌ Error ejecutando acción ${action.id}:`,
            error.message
          );

          // Marcar como fallida
          action.status = "failed";
          action.error = error.message;
          await this.updateActionInDb(action.id, {
            status: "FAILED",
            error: error.message,
          });

          // Remover de la cola
          const index = this.actionQueue.findIndex((a) => a.id === action.id);
          if (index !== -1) {
            this.actionQueue.splice(index, 1);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error en processQueue:", error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  async executeAction(action) {
    // 🔥 ARREGLAR: Asegurar que la acción tenga los datos de la cuenta
    if (!action.account && action.accountId) {
      console.log(
        `[QUEUE] Cargando datos de cuenta para ${action.accountId}...`
      );
      try {
        const account = await this.prisma.xAccount.findUnique({
          where: { id: action.accountId },
        });

        if (!account) {
          throw new Error(
            `Cuenta ${action.accountId} no encontrada en la base de datos`
          );
        }

        action.account = account;
        console.log(
          `✅ [QUEUE] Cuenta cargada: @${account.username} (ID: ${account.id})`
        );
      } catch (error) {
        console.error(
          `❌ [QUEUE] Error cargando cuenta ${action.accountId}:`,
          error
        );
        throw new Error(
          `No se pudo cargar la cuenta ${action.accountId}: ${error.message}`
        );
      }
    }

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
        success: true,
        data: {
          tweetId: result.id,
          text: result.text,
          url: `https://twitter.com/i/web/status/${result.id}`,
          timestamp: new Date().toISOString(),
        },
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
        success: true,
        data: {
          tweetId: result.id,
          text: result.text,
          replyToTweetId: action.tweetId,
          url: `https://twitter.com/i/web/status/${result.id}`,
          timestamp: new Date().toISOString(),
        },
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

      const actingUserId =
        action.account.twitterId ||
        action.account.twitterUserId ||
        action.account.userId;
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
        success: true,
        data: {
          likedTweetId: action.tweetId,
          liked: result.data.liked,
          userId: actingUserId,
          timestamp: new Date().toISOString(),
        },
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

      const actingUserId =
        action.account.twitterId ||
        action.account.twitterUserId ||
        action.account.userId;
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
        success: true,
        data: {
          retweetedTweetId: action.tweetId,
          retweeted: result.data.retweeted,
          userId: actingUserId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "retweet");
      throw error;
    }
  }

  async executeFollow(action) {
    // 🔥 VALIDACIONES TEMPRANAS - MÁS SIMPLES PORQUE targetUserId YA ESTÁ RESUELTO

    // 1. Validar que existe la cuenta
    if (!action.account || !action.account.username) {
      const errorMsg = `❌ [FOLLOW_VALIDATION] account no está definido o no tiene username`;
      console.error(errorMsg);
      throw new Error("La cuenta de origen no está correctamente configurada");
    }

    // 2. Validar ID de la cuenta que ejecuta la acción
    const actingUserId =
      action.account.twitterId ||
      action.account.twitterUserId ||
      action.account.userId;
    if (!actingUserId) {
      const errorMsg = `❌ [FOLLOW_VALIDATION] La cuenta @${action.account.username} no tiene su Twitter ID configurado`;
      console.error(errorMsg);
      throw new Error(
        `La cuenta @${action.account.username} no tiene su Twitter ID configurado en la base de datos.`
      );
    }

    // 🆕 (3.a) Intentar resolver targetUserId desde historial/BD antes de usar la API
    if (!action.targetUserId && action.targetUsername) {
      try {
        const prev = await this.prisma.actionHistory.findFirst({
          where: {
            targetUsername: action.targetUsername,
            targetUserId: { not: null },
          },
          orderBy: { completedAt: "desc" },
          select: { targetUserId: true },
        });
        if (prev?.targetUserId) {
          console.log(
            `[FOLLOW_ID_LOOKUP] ID recuperado desde historial: @${action.targetUsername} → ${prev.targetUserId}`
          );
          action.targetUserId = prev.targetUserId;
        }
      } catch (histErr) {
        console.warn(
          `[FOLLOW_ID_LOOKUP] No se pudo consultar historial para @${action.targetUsername}:`,
          histErr.message
        );
      }
    }

    // 3.b  Si todavía no hay ID → lookup API
    if (!action.targetUserId) {
      if (!action.targetUsername) {
        const errorMsg = `❌ [FOLLOW_VALIDATION] No se proporcionó targetUsername ni targetUserId`;
        console.error(errorMsg);
        throw new Error(
          "Debe proporcionar targetUsername o targetUserId para realizar el follow"
        );
      }

      const cleanUsername = action.targetUsername.replace(/^@+/, "").trim();

      try {
        console.log(
          `🔍 [FOLLOW_ID_LOOKUP] Resolviendo ID para @${cleanUsername} en tiempo de ejecución...`
        );

        const client = await this.twitterService.getTwitterClient(
          action.account
        );
        const resolvedId = await this.getUserIdFromUsername(
          client,
          cleanUsername
        );

        action.targetUserId = resolvedId;

        // Reprogramar acción 16 minutos después de la resolución para respetar delay
        const minDelayMs = 16 * 60 * 1000;
        const newSchedule = new Date(Date.now() + minDelayMs);

        action.status = "queued";
        action.scheduledTime = newSchedule;
        action.estimatedStartTime = newSchedule;

        // Persistir cambios en BD
        try {
          await this.updateActionInDb(action.id, {
            status: "QUEUED",
            targetUserId: resolvedId,
            scheduledTime: newSchedule,
            estimatedStartTime: newSchedule,
          });
        } catch (persistErr) {
          console.warn(
            `⚠️  [FOLLOW_ID_LOOKUP] No se pudo persistir targetUserId/scheduledTime en BD:`,
            persistErr.message
          );
        }

        console.log(
          `✅ [FOLLOW_ID_LOOKUP] Resuelto @${cleanUsername} → ${resolvedId}. Acción reprogramada para ${newSchedule.toLocaleString(
            "es-ES"
          )}`
        );

        // Indicar al processQueue que la acción fue reprogramada
        return {
          success: false,
          data: {
            stage: "ID_LOOKUP_COMPLETED",
          },
        };
      } catch (lookupErr) {
        console.error(
          `❌ [FOLLOW_ID_LOOKUP] Error obteniendo ID de @${cleanUsername}:`,
          lookupErr.message
        );
        throw new Error(
          `Error resolviendo usuario objetivo (@${cleanUsername}): ${lookupErr.message}`
        );
      }
    }

    // 4. Validar que no intente seguirse a sí mismo
    if (
      action.targetUsername &&
      action.targetUsername.toLowerCase() ===
        action.account.username.toLowerCase()
    ) {
      const errorMsg = `❌ [FOLLOW_VALIDATION] Intento de auto-follow detectado: @${action.account.username} → @${action.targetUsername}`;
      console.error(errorMsg);
      throw new Error(
        "❌ VALIDACIÓN FALLIDA: Una cuenta no puede seguirse a sí misma"
      );
    }

    console.log(`✅ [FOLLOW_VALIDATION] Validaciones pasadas - targetUserId ya resuelto:
      - Cuenta origen: @${action.account.username} (ID: ${actingUserId})
      - Target: @${action.targetUsername} (ID: ${action.targetUserId})
      - Fuente: Resuelto en endpoint /add
    `);

    try {
      console.log(
        `👥 Ejecutando follow: @${action.account.username} → @${action.targetUsername} (ID: ${action.targetUserId})`
      );

      const client = await this.twitterService.getTwitterClient(action.account);

      // --- EJECUTAR EL FOLLOW DIRECTAMENTE (SIN BÚSQUEDAS) ---
      console.log(
        `🚀 [FOLLOW_EXECUTE] Ejecutando follow directo: ${actingUserId} → ${action.targetUserId} (@${action.targetUsername})`
      );

      const result = await client.v2.follow(actingUserId, action.targetUserId);

      console.log(
        `✅ Follow ejecutado exitosamente: @${action.account.username} → ${action.targetUserId} (@${action.targetUsername})`
      );

      return {
        success: true,
        data: {
          targetUserId: action.targetUserId,
          targetUsername: action.targetUsername,
          followerUsername: action.account.username,
          following: result.data.following,
          userId: actingUserId,
          timestamp: new Date().toISOString(),
          note: "Follow ejecutado con targetUserId pre-resuelto",
        },
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
          `⚠️ Follow ya existente: @${action.account.username} → ${action.targetUsername} (considerado como éxito)`
        );

        return {
          success: true,
          data: {
            targetUserId: action.targetUserId,
            targetUsername: action.targetUsername,
            followerUsername: action.account.username,
            following: true, // Ya se está siguiendo
            userId: actingUserId,
            timestamp: new Date().toISOString(),
            note: "Ya se estaba siguiendo esta cuenta",
          },
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

      const actingUserId =
        action.account.twitterId ||
        action.account.twitterUserId ||
        action.account.userId;
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
        success: true,
        data: {
          targetUserId: targetUserId,
          targetUsername: targetUsername,
          followerUsername: action.account.username,
          following: result.data.following, // Debería ser false
          userId: actingUserId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.twitterService.handleTwitterError(error, "unfollow");
      throw error;
    }
  }

  async getQueueStatus() {
    try {
      // ⚠️ Evitar 3 conexiones simultáneas → ejecutar en serie (misma conexión reutilizada)
      const scheduledFromDb = await this.prisma.queuedAction.findMany({
        where: { status: "SCHEDULED" },
        include: { account: true },
        orderBy: { scheduledTime: "asc" },
      });

      const queuedFromDb = await this.prisma.queuedAction.findMany({
        where: { status: "QUEUED" },
        include: { account: true },
        orderBy: { estimatedStartTime: "asc" },
      });

      const runningFromDb = await this.prisma.queuedAction.findMany({
        where: { status: "RUNNING" },
        include: { account: true },
        orderBy: { startedAt: "asc" },
      });

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

  // =====================
  // HISTORIAL / LOGGING
  // =====================

  async addToHistory(actionInfo) {
    if (VERBOSE_HISTORY_LOGS) {
      console.log(
        `📜 [HISTORY] Intentando registrar acción en historial → ${
          actionInfo.actionId || actionInfo.id
        } | estado: ${actionInfo.status}`
      );
    }

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

    const historyActionId = actionInfo.actionId || actionInfo.id;
    if (!historyActionId) {
      console.error(
        "❌ addToHistory: actionId/id faltante en actionInfo",
        actionInfo
      );
      return;
    }

    try {
      await this.prisma.actionHistory.upsert({
        where: { actionId: historyActionId },
        update: updateData,
        create: {
          actionId: historyActionId,
          ...updateData,
          createdAt: actionInfo.createdAt
            ? new Date(actionInfo.createdAt)
            : new Date(),
        },
      });

      if (VERBOSE_HISTORY_LOGS) {
        console.log(
          `✅ [HISTORY] Acción ${historyActionId} registrada/actualizada correctamente`
        );
      }
    } catch (historyErr) {
      console.error(
        `❌ [HISTORY] Error guardando acción ${historyActionId}:`,
        historyErr
      );
    }
  }

  // Nuevo: Mapear estados de QueueStatus a ActionStatus
  mapQueueStatusToActionStatus(queueStatus) {
    if (!queueStatus) return "FAILED"; // fallback seguro

    // Aceptar valores en minúsculas o mixtos
    const normalized = queueStatus.toString().toUpperCase();

    const mapping = {
      QUEUED: "QUEUED",
      SCHEDULED: "QUEUED", // Programada se considera aún en cola
      RUNNING: "RUNNING",
      COMPLETED: "COMPLETED",
      FAILED: "FAILED",
      CANCELLED: "CANCELLED",
    };

    return mapping[normalized] || "FAILED";
  }

  // Nuevo: Helper para actualizar el tracker de rate limits
  async updateRateLimitTracker(accountId, actionType) {
    const now = new Date();

    // ARREGLAR: Mantener consistencia en rateLimitTracker
    // Usar Date directamente en lugar de Map anidado para simplificar
    this.rateLimitTracker.set(accountId, now);

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
          lastUsed: now,
        },
        create: {
          accountId: accountId,
          actionType: actionType,
          lastUsed: now,
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
            username:
              dbAction.accountUsername ||
              (dbAction.account && dbAction.account.username) ||
              "unknown",
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
    try {
      const { count } = await this.prisma.queuedAction.deleteMany({
        where: {
          status: {
            in: ["QUEUED", "SCHEDULED"],
          },
        },
      });

      this.actionQueue = [];
      this.scheduledActions = [];

      console.log(
        `✅ [QUEUE] Limpiadas ${count} acciones en cola y programadas.`
      );
      return { count };
    } catch (error) {
      console.error("❌ Error limpiando la cola de acciones:", error);
      throw new Error("No se pudo limpiar la cola de acciones");
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
