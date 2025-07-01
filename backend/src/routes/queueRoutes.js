const express = require("express");

function createQueueRoutes(queueService, prisma) {
  const router = express.Router();

  // Agregar acciones a la cola
  router.post("/add", async (req, res) => {
    try {
      const {
        action,
        accountIds,
        baseDelay,
        randomDelay,
        text,
        tweetId,
        targetUserId: bodyTargetUserId,
        targetUsername: bodyTargetUsername,
        scheduledTime: incomingScheduledTime,
        useRandomDistribution,
        distributionTimes,
        distributionConfig,
        customMinDelayMs,
      } = req.body;

      // Variable mutable para la hora final programada. Inicialmente la que llega en body.
      let localScheduledTime = incomingScheduledTime;

      // 🔥 LOGGING DETALLADO PARA DEBUGGEAR
      console.log(`[QUEUE_DEBUG] Datos recibidos en /add:`, {
        action,
        accountIds: accountIds?.length
          ? `[${accountIds.length} cuentas]`
          : accountIds,
        targetUserId: bodyTargetUserId,
        targetUsername: bodyTargetUsername,
        text: text ? `"${text.substring(0, 50)}..."` : text,
        tweetId,
        scheduledTime: localScheduledTime,
        useRandomDistribution,
      });

      // 🔥 VALIDACIONES TEMPRANAS
      if (!action) {
        return res.status(400).json({ error: "action es requerido" });
      }

      if (
        !accountIds ||
        !Array.isArray(accountIds) ||
        accountIds.length === 0
      ) {
        return res
          .status(400)
          .json({ error: "accountIds es requerido y debe ser un array" });
      }

      // 🔥 VALIDACIÓN ESPECÍFICA PARA FOLLOWS
      if (action === "follow") {
        if (!bodyTargetUserId && !bodyTargetUsername) {
          console.error(
            `❌ [QUEUE_VALIDATION] Acción follow sin target válido:`,
            {
              action,
              targetUserId: bodyTargetUserId,
              targetUsername: bodyTargetUsername,
              bodyCompleto: req.body,
            }
          );
          return res.status(400).json({
            error:
              "Para acciones de follow se requiere targetUserId o targetUsername",
            details: {
              received: {
                targetUserId: bodyTargetUserId,
                targetUsername: bodyTargetUsername,
              },
              requirement:
                "Debe especificar al menos uno: targetUserId (ID numérico) o targetUsername (sin @)",
            },
          });
        }

        // Validar formato de targetUsername si está presente
        if (bodyTargetUsername) {
          const cleanedUsername = (bodyTargetUsername || "")
            .replace(/^@+/, "")
            .trim();
          if (cleanedUsername.length === 0) {
            console.error(`❌ [QUEUE_VALIDATION] targetUsername inválido:`, {
              original: bodyTargetUsername,
              cleaned: cleanedUsername,
            });
            return res.status(400).json({
              error: "targetUsername no puede estar vacío",
              details: {
                received: bodyTargetUsername,
                requirement: "Debe ser un username válido sin @ al inicio",
              },
            });
          }
          console.log(
            `✅ [QUEUE_VALIDATION] targetUsername válido: "${bodyTargetUsername}" → "${cleanedUsername}"`
          );
        }

        // Validar formato de targetUserId si está presente
        if (bodyTargetUserId) {
          if (
            typeof bodyTargetUserId === "string" &&
            !/^\d+$/.test(bodyTargetUserId)
          ) {
            // Es un string pero no numérico - probablemente es un username
            console.log(
              `⚠️ [QUEUE_VALIDATION] targetUserId parece ser username: "${bodyTargetUserId}"`
            );
            if (!bodyTargetUsername) {
              console.log(
                `🔄 [QUEUE_VALIDATION] Moviendo targetUserId a targetUsername`
              );
              // Mover a targetUsername y limpiar targetUserId
              req.body.targetUsername = bodyTargetUserId;
              req.body.targetUserId = null;
            }
          }
        }

        /*
         * 🔕 EARLY LOOKUP DESHABILITADO
         * -------------------------------------------------------------
         * Para evitar ráfagas de consultas que provoquen errores 429 en
         * la API de Twitter, se elimina la búsqueda temprana del
         * targetUserId.  Ahora la resolución del ID se realizará en el
         * momento de la ejecución de la acción dentro del QueueService.
         * -------------------------------------------------------------
         */
        console.log(
          `🔕 [FOLLOW_EARLY_LOOKUP] Deshabilitado. El targetUserId se resolverá al ejecutar la acción.`
        );
      }

      const accounts = await prisma.xAccount.findMany({
        where: {
          id: {
            in: accountIds,
          },
        },
      });

      if (accounts.length !== accountIds.length) {
        return res.status(404).json({ error: "Algunas cuentas no existen" });
      }

      console.log(
        `[QUEUE] Recibida petición para añadir acciones. ${
          useRandomDistribution
            ? `Distribución aleatoria: ${distributionConfig?.value} ${distributionConfig?.unit}`
            : `BaseDelay: ${baseDelay}ms, RandomDelay: ${randomDelay}ms`
        }`
      );

      const actions = accounts.map((account, index) => {
        try {
          let estimatedStartTime;
          let actualBaseDelay = baseDelay || 30000;
          let actualRandomDelay = randomDelay || 0;

          if (
            useRandomDistribution &&
            distributionTimes &&
            distributionTimes[index]
          ) {
            // Usar tiempo de distribución aleatoria
            estimatedStartTime = distributionTimes[index];
            actualBaseDelay = 0; // No usar delays normales
            actualRandomDelay = 0;

            console.log(
              `[QUEUE] Acción para @${account.username} programada ALEATORIAMENTE para: ${estimatedStartTime}`
            );
          } else {
            // Usar sistema de delays normal
            const totalDelay =
              actualBaseDelay + Math.random() * actualRandomDelay;
            estimatedStartTime =
              localScheduledTime ||
              new Date(Date.now() + totalDelay).toISOString();

            console.log(
              `[QUEUE] Acción para @${account.username} programada SECUENCIALMENTE para: ${estimatedStartTime} (Delay total: ${totalDelay}ms)`
            );
          }

          // Crear objeto de acción
          const actionObj = {
            id: queueService.generateActionId(),
            accountId: account.id,
            username: account.username,
            action,
            text,
            tweetId,
            targetUserId: bodyTargetUserId,
            targetUsername: bodyTargetUsername,
            account: account,
            accountUsername: account.username,
            accountLabels: account.labels || [],
            createdAt: new Date().toISOString(),
            estimatedStartTime,
            status: "QUEUED",
            baseDelay: actualBaseDelay,
            randomDelay: actualRandomDelay,
            batchId: `batch_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 6)}`,
            scheduledTime: useRandomDistribution
              ? null
              : localScheduledTime || estimatedStartTime,
            customMinDelayMs: customMinDelayMs || null,
            useRandomDistribution: useRandomDistribution || false,
            distributionConfig: distributionConfig || null,
            distributionTimes: distributionTimes || [],
          };

          // 🔍 LOGGING ESPECÍFICO PARA FOLLOWS
          if (action === "follow") {
            console.log(
              `[QUEUE_DEBUG] Acción follow creada para @${account.username}:`,
              {
                actionId: actionObj.id,
                targetUserId: actionObj.targetUserId,
                targetUsername: actionObj.targetUsername,
                estimatedStartTime: actionObj.estimatedStartTime,
              }
            );
          }

          return actionObj;
        } catch (error) {
          console.error(`Error al procesar la cuenta ${account.id}:`, error);
          return null;
        }
      });

      await queueService.addActionsToQueue(actions.filter((a) => a !== null));

      const message = useRandomDistribution
        ? `${actions.length} acciones distribuidas aleatoriamente en ${distributionConfig?.value} ${distributionConfig?.unit}`
        : `${actions.length} acciones ${
            localScheduledTime ? "programadas" : "añadidas a la cola"
          } exitosamente`;

      res.json({
        success: true,
        message,
        actions: actions.map((a) => ({
          id: a.id,
          accountId: a.accountId,
          username: a.accountUsername,
          action: a.action,
          status: a.status,
          estimatedStartTime: a.estimatedStartTime,
          useRandomDistribution: a.useRandomDistribution,
        })),
        batchId: actions[0].batchId,
        distributionInfo: useRandomDistribution
          ? {
              config: distributionConfig,
              totalActions: actions.length,
              timeRange: {
                start: new Date().toISOString(),
                end: new Date(
                  Date.now() + (distributionConfig?.maxTimeMs || 0)
                ).toISOString(),
              },
            }
          : null,
      });
    } catch (error) {
      console.error("Error en /api/queue/add:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // Obtener estado de la cola
  router.get("/status", async (req, res) => {
    try {
      const {
        historyPage = 1,
        historyLimit = 10,
        queuePage = 1,
        queueLimit = 100,
        actionTypes,
        search,
      } = req.query;

      // Permitir filtrado opcional por tipo de acción (por ejemplo: "tweet,retweet")
      const actionTypesFilter = (actionTypes || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      // Obtener estado de la cola desde BD (método actualizado)
      const queueStatus = await queueService.getQueueStatus();

      // Si el usuario proporcionó actionTypes, filtrar los resultados
      if (actionTypesFilter.length > 0) {
        const matchesFilter = (actionObj) =>
          actionTypesFilter.includes((actionObj.action || "").toLowerCase());

        queueStatus.queue = queueStatus.queue.filter(matchesFilter);
        queueStatus.running = queueStatus.running.filter(matchesFilter);
        queueStatus.scheduled = queueStatus.scheduled.filter(matchesFilter);
      }

      // Filtro por búsqueda de username/targetUsername
      const normalizedSearch = (search || "").toString().trim().toLowerCase();
      if (normalizedSearch.length > 0) {
        const matchesSearch = (a) => {
          return (
            (a.accountUsername || "").toLowerCase().includes(normalizedSearch) ||
            (a.targetUsername || "").toLowerCase().includes(normalizedSearch)
          );
        };

        queueStatus.queue = queueStatus.queue.filter(matchesSearch);
        queueStatus.running = queueStatus.running.filter(matchesSearch);
        queueStatus.scheduled = queueStatus.scheduled.filter(matchesSearch);
      }

      // Recalcular stats tras filtros
      queueStatus.stats.queueLength = queueStatus.queue.length;
      queueStatus.stats.runningCount = queueStatus.running.length;
      queueStatus.stats.scheduled = queueStatus.scheduled.length;

      // Obtener historial desde la base de datos (solo acciones ejecutadas)
      const historyActions = await prisma.actionHistory.findMany({
        where: {
          status: {
            in: ["COMPLETED", "FAILED"],
          },
        },
        orderBy: [
          { completedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: parseInt(historyLimit),
        skip: (parseInt(historyPage) - 1) * parseInt(historyLimit),
        include: {
          account: {
            select: {
              username: true,
              labels: true,
            },
          },
        },
      });

      // Obtener estadísticas
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [completedToday, failedToday] = await Promise.all([
        prisma.actionHistory.count({
          where: {
            status: "COMPLETED",
            completedAt: { gte: today },
          },
        }),
        prisma.actionHistory.count({
          where: {
            status: "FAILED",
            completedAt: { gte: today },
          },
        }),
      ]);

      const totalQueueItems = queueStatus.queue.length;

      const paginatedQueue = queueStatus.queue.slice(
        (parseInt(queuePage) - 1) * parseInt(queueLimit),
        parseInt(queuePage) * parseInt(queueLimit)
      );

      // Formatear respuesta completa
      const response = {
        queue: paginatedQueue,
        running: queueStatus.running,
        scheduled: queueStatus.scheduled,

        history: historyActions.map((action) => ({
          id: action.actionId,
          action: action.action,
          username: action.username,
          accountLabels: action.accountLabels || action.account?.labels || [],
          text: action.text || getActionDescription(action),
          targetUsername:
            action.targetUsername ||
            (action.result ? action.result.targetUsername : undefined),
          targetUserId:
            action.targetUserId ||
            (action.result ? action.result.targetUserId : undefined),
          status: action.status,
          completedAt: action.completedAt?.toISOString(),
          error: action.error,
        })),

        stats: {
          queueLength: queueStatus.stats.queueLength,
          runningCount: queueStatus.stats.runningCount,
          completedToday,
          failedToday,
          scheduled: queueStatus.stats.scheduled,
        },

        totalHistoryItems: await prisma.actionHistory.count({
          where: {
            status: { in: ["COMPLETED", "FAILED"] },
          },
        }),
        totalQueueItems,
      };

      res.json(response);
    } catch (error) {
      console.error("Error obteniendo estado de cola:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function para generar descripciones
  function getActionDescription(action) {
    // Extraer datos potencialmente útiles desde action.result (si existe)
    const resultData = action.result || {};
    switch (action.action) {
      case "tweet": {
        // Mostrar texto del tweet si está disponible
        if (action.text)
          return action.text.length > 120
            ? `${action.text.substring(0, 117)}...`
            : action.text;
        // Fallback a id del tweet creado si viene en el result
        if (resultData.tweetId || resultData.postedTweetId) {
          const id = resultData.tweetId || resultData.postedTweetId;
          return `Tweet publicado (ID: ${id})`;
        }
        return "Publicar nuevo tweet";
      }
      case "retweet": {
        const rtId = action.tweetId || resultData.retweetedTweetId;
        if (rtId) {
          return `Retweet del tweet ID: ${rtId}`;
        }
        return "Hacer retweet";
      }
      case "like": {
        const likeId = action.tweetId || resultData.likedTweetId;
        if (likeId) {
          return `Like al tweet ID: ${likeId}`;
        }
        return "Dar like a tweet";
      }
      case "reply": {
        if (action.text) {
          return `Responder: \"${
            action.text.length > 80
              ? action.text.substring(0, 77) + "..."
              : action.text
          }\"`;
        }
        return "Responder a tweet";
      }
      case "follow": {
        // Priorizar targetUsername sobre targetUserId, buscando en action y luego en result
        const username = action.targetUsername || resultData.targetUsername;
        const userId = action.targetUserId || resultData.targetUserId;
        if (username) return `Seguir a @${username}`;
        if (userId) return `Seguir a ID: ${userId}`;
        return "Seguir usuario";
      }
      case "unfollow": {
        const username = action.targetUsername || resultData.targetUsername;
        const userId = action.targetUserId || resultData.targetUserId;
        if (username) return `Dejar de seguir a @${username}`;
        if (userId) return `Dejar de seguir ID: ${userId}`;
        return "Dejar de seguir";
      }
      case "dm": {
        if (action.text) {
          return `Mensaje directo: \"${
            action.text.length > 80
              ? action.text.substring(0, 77) + "..."
              : action.text
          }\"`;
        }
        return "Enviar mensaje directo";
      }
      default:
        return action.text || "Acción personalizada";
    }
  }

  // Mejorar cancelación de acciones individuales
  router.delete("/cancel/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[API] Cancelando acción: ${id}`);

      const cancelled = await queueService.cancelAction(id);

      if (cancelled) {
        res.json({
          success: true,
          message: "Acción cancelada exitosamente",
          actionId: id,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Acción no encontrada en cola, programadas o ejecución",
        });
      }
    } catch (error) {
      console.error("Error en /api/queue/cancel:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // Agregar endpoint para cancelar por actionId (alternativo)
  router.delete("/action/:actionId", async (req, res) => {
    try {
      const { actionId } = req.params;
      console.log(`[API] Cancelando acción por actionId: ${actionId}`);

      const cancelled = await queueService.cancelAction(actionId);

      if (cancelled) {
        res.json({
          success: true,
          message: "Acción cancelada exitosamente",
          actionId: actionId,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Acción no encontrada",
        });
      }
    } catch (error) {
      console.error("Error en /api/queue/action:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // CANCELAR TODAS LAS ACCIONES
  router.delete("/all", async (req, res) => {
    try {
      const result = await queueService.clearAllQueuedAndScheduledActions();
      res.json({
        success: true,
        message: `Se eliminaron ${result.count} acciones.`,
        ...result,
      });
    } catch (error) {
      console.error("Error en DELETE /queue/all:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // Agregar endpoint DELETE /filtered para remover acciones según parámetro actionTypes (ej. tweet,retweet)
  router.delete("/filtered", async (req, res) => {
    try {
      const { actionTypes = "" } = req.query;
      const types = actionTypes
        .toString()
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (types.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Se requiere query param actionTypes (ej. tweet,retweet)",
        });
      }

      const result = await queueService.clearQueuedActionsByType(types);
      res.json({
        success: true,
        message: `Se eliminaron ${result.count} acciones (${types.join(
          ", "
        )}).`,
        ...result,
      });
    } catch (error) {
      console.error("Error en DELETE /queue/filtered:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  return router;
}

// 🔥 NUEVA FUNCIÓN: Resolver targetUserId con búsqueda optimizada
async function resolveTargetUserId(
  targetUsername,
  targetUserId,
  prisma,
  fallbackAccountId
) {
  let resolvedTargetUserId = targetUserId;
  let resolvedTargetUsername = targetUsername;
  let source = "parameter";
  let usedApi = false;

  console.log(`🔍 [RESOLVE_TARGET] Iniciando resolución:`, {
    targetUsername,
    targetUserId,
    fallbackAccountId,
  });

  // Limpiar targetUsername si existe
  if (targetUsername) {
    resolvedTargetUsername = (targetUsername || "").replace(/^@+/, "").trim();
  }

  // Si ya tenemos targetUserId numérico válido, usar eso
  if (
    resolvedTargetUserId &&
    typeof resolvedTargetUserId === "string" &&
    /^\d+$/.test(resolvedTargetUserId)
  ) {
    console.log(
      `✅ [RESOLVE_TARGET] targetUserId ya es válido: ${resolvedTargetUserId}`
    );
    return {
      targetUserId: resolvedTargetUserId,
      targetUsername: resolvedTargetUsername,
      source: "parameter",
      usedApi: false,
    };
  }

  // Si tenemos targetUsername, buscar en BD local primero
  if (resolvedTargetUsername) {
    console.log(
      `🔍 [RESOLVE_TARGET] Buscando @${resolvedTargetUsername} en BD local...`
    );

    try {
      const localAccount = await prisma.xAccount.findUnique({
        where: { username: resolvedTargetUsername },
        select: {
          id: true,
          username: true,
          userId: true,
          twitterId: true,
        },
      });

      if (localAccount && (localAccount.userId || localAccount.twitterId)) {
        resolvedTargetUserId = localAccount.userId || localAccount.twitterId;
        console.log(`✅ [RESOLVE_TARGET] Usuario encontrado en BD local:`, {
          username: localAccount.username,
          userId: resolvedTargetUserId,
          source: "local_database",
        });

        return {
          targetUserId: resolvedTargetUserId,
          targetUsername: resolvedTargetUsername,
          source: "local_database",
          usedApi: false,
        };
      } else {
        console.log(
          `⚠️ [RESOLVE_TARGET] @${resolvedTargetUsername} NO encontrado en BD local. Buscando en API...`
        );
      }
    } catch (dbError) {
      console.error(
        `❌ [RESOLVE_TARGET] Error en búsqueda de BD:`,
        dbError.message
      );
      // Continuar con API lookup
    }
  }

  // Si no encontramos en BD local, usar API de Twitter
  if (resolvedTargetUsername && fallbackAccountId) {
    console.log(
      `🌐 [RESOLVE_TARGET] Buscando @${resolvedTargetUsername} en API de Twitter...`
    );

    try {
      // Obtener cuenta para acceso a API
      const fallbackAccount = await prisma.xAccount.findUnique({
        where: { id: fallbackAccountId },
        select: {
          id: true,
          username: true,
          ownApiKey: true,
          ownApiSecret: true,
          ownAccessToken: true,
          ownAccessTokenSecret: true,
          ownOAuth2AccessToken: true,
        },
      });

      if (!fallbackAccount) {
        throw new Error(
          `Cuenta ${fallbackAccountId} no encontrada para acceso a API`
        );
      }

      // Crear cliente de Twitter
      const TwitterService = require("../services/twitterService");
      const twitterService = new TwitterService(prisma);
      const client = await twitterService.getTwitterClient(fallbackAccount);

      // Buscar usuario en API
      console.log(
        `🔍 [RESOLVE_TARGET] Consultando API de Twitter para @${resolvedTargetUsername}...`
      );
      const { data: targetUser } = await client.v2.userByUsername(
        resolvedTargetUsername
      );

      if (!targetUser) {
        throw new Error(
          `Usuario @${resolvedTargetUsername} no encontrado en Twitter`
        );
      }

      resolvedTargetUserId = targetUser.id;
      usedApi = true;
      source = "twitter_api";

      console.log(`✅ [RESOLVE_TARGET] Usuario encontrado en API de Twitter:`, {
        username: targetUser.username,
        userId: resolvedTargetUserId,
        name: targetUser.name,
        source: "twitter_api",
      });

      return {
        targetUserId: resolvedTargetUserId,
        targetUsername: resolvedTargetUsername,
        source: "twitter_api",
        usedApi: true,
      };
    } catch (apiError) {
      console.error(
        `❌ [RESOLVE_TARGET] Error en API de Twitter:`,
        apiError.message
      );

      // Manejo específico de errores
      if (apiError.code === 429) {
        throw new Error(`Límite de API excedido. Intenta más tarde.`);
      }
      if (apiError.status === 404 || apiError.message.includes("not found")) {
        throw new Error(
          `Usuario @${resolvedTargetUsername} no existe en Twitter`
        );
      }

      throw new Error(`Error consultando API de Twitter: ${apiError.message}`);
    }
  }

  // Si llegamos aquí, no se pudo resolver
  throw new Error(
    `No se pudo resolver el usuario objetivo. Proporciona un targetUsername válido o targetUserId numérico.`
  );
}

module.exports = createQueueRoutes;
