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
        targetUserId,
        scheduledTime,
      } = req.body;

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
        `[QUEUE] Recibida petición para añadir acciones. BaseDelay: ${baseDelay}ms, RandomDelay: ${randomDelay}ms`
      );

      const actions = accounts.map((account) => {
        try {
          // 🔥 CALCULAR TIEMPO DE EJECUCIÓN BASADO EN DELAYS REALES
          const actualBaseDelay = baseDelay || 30000; // milisegundos
          const actualRandomDelay = randomDelay || 0; // milisegundos

          const totalDelay =
            actualBaseDelay + Math.random() * actualRandomDelay;

          const estimatedStartTime =
            scheduledTime || new Date(Date.now() + totalDelay).toISOString();

          console.log(
            `[QUEUE] Acción para @${account.username} programada para: ${estimatedStartTime} (Delay total: ${totalDelay}ms)`
          );

          // Crear objeto de acción
          const actionObj = {
            id: queueService.generateActionId(),
            accountId: account.id,
            username: account.username,
            action,
            text,
            tweetId,
            targetUserId,
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
            scheduledTime,
          };

          return actionObj;
        } catch (error) {
          console.error(`Error al procesar la cuenta ${account.id}:`, error);
          return null;
        }
      });

      await queueService.addActionsToQueue(actions.filter((a) => a !== null));

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
        batchId: actions[0].batchId,
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
      const { historyPage = 1, historyLimit = 10 } = req.query;

      // Obtener estado de la cola desde BD (método actualizado)
      const queueStatus = await queueService.getQueueStatus();

      // Obtener historial desde la base de datos (solo acciones ejecutadas)
      const historyActions = await prisma.actionHistory.findMany({
        where: {
          status: {
            in: ["COMPLETED", "FAILED"],
          },
        },
        orderBy: { completedAt: "desc" },
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

      // Formatear respuesta completa
      const response = {
        queue: queueStatus.queue,
        running: queueStatus.running,
        scheduled: queueStatus.scheduled,

        history: historyActions.map((action) => ({
          id: action.actionId,
          action: action.action,
          username: action.username,
          accountLabels: action.accountLabels || action.account?.labels || [],
          text: action.text || getActionDescription(action),
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
      };

      res.json(response);
    } catch (error) {
      console.error("Error obteniendo estado de cola:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function para generar descripciones
  function getActionDescription(action) {
    switch (action.action) {
      case "tweet":
        return action.text || "Publicar nuevo tweet";
      case "retweet":
        return action.tweetId
          ? `Retweet del tweet ID: ${action.tweetId}`
          : "Hacer retweet";
      case "like":
        return action.tweetId
          ? `Like al tweet ID: ${action.tweetId}`
          : "Dar like a tweet";
      case "reply":
        return action.text
          ? `Responder: "${action.text}"`
          : "Responder a tweet";
      case "follow":
        return action.targetUserId
          ? `Seguir a @${action.targetUserId}`
          : "Seguir usuario";
      case "unfollow":
        return action.targetUserId
          ? `Dejar de seguir a @${action.targetUserId}`
          : "Dejar de seguir";
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
      console.log("🔥 Recibida solicitud para cancelar TODAS las acciones...");
      const canceledCount =
        await queueService.clearAllQueuedAndScheduledActions();
      res.json({
        success: true,
        message: `Se cancelaron ${canceledCount} acciones de las colas.`,
        canceledCount,
      });
    } catch (error) {
      console.error("Error cancelando todas las acciones:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor al cancelar acciones.",
      });
    }
  });

  return router;
}

module.exports = createQueueRoutes;
