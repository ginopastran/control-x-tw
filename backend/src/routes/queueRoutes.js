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

      const queueStatus = queueService.getQueueStatus();

      res.json({
        ...queueStatus,
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
        stats: {
          ...queueStatus.stats,
          completedToday,
          failedToday,
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

  // Cancelar acción
  router.delete("/cancel/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const cancelled = await queueService.cancelAction(id);

      if (cancelled) {
        res.json({ success: true, message: "Acción cancelada" });
      } else {
        res.status(404).json({ error: "Acción no encontrada" });
      }
    } catch (error) {
      console.error("Error en /api/queue/cancel:", error);
      res.status(500).json({
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
