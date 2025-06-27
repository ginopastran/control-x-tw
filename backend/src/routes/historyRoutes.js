const express = require("express");

function createHistoryRoutes(historyService, prisma) {
  const router = express.Router();

  // Obtener historial con filtros
  router.get("/", async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        search = "",
        action = "all",
        status = "executed", // Por defecto solo ejecutadas
        account = "all",
        days = "7",
      } = req.query;

      // Construir filtros
      const where = {};

      // Filtro por estado
      if (status === "executed") {
        where.status = { in: ["COMPLETED", "FAILED"] };
      } else if (status === "scheduled") {
        where.status = "QUEUED";
      } else if (status !== "all") {
        where.status = status.toUpperCase();
      }

      // Filtro por acción
      if (action !== "all") {
        where.action = action;
      }

      // Filtro por cuenta
      if (account !== "all") {
        where.username = {
          contains: account.replace("@", ""),
          mode: "insensitive",
        };
      }

      // Filtro por fecha
      if (days !== "all") {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        where.createdAt = { gte: daysAgo };
      }

      // Filtro por búsqueda
      if (search) {
        where.OR = [
          { username: { contains: search, mode: "insensitive" } },
          { text: { contains: search, mode: "insensitive" } },
          { targetUserId: { contains: search, mode: "insensitive" } },
        ];
      }

      // Ejecutar consulta
      const [actions, total] = await Promise.all([
        prisma.actionHistory.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          include: {
            account: {
              select: {
                username: true,
                labels: true,
              },
            },
          },
        }),
        prisma.actionHistory.count({ where }),
      ]);

      // Formatear respuesta
      const formattedActions = actions.map((action) => ({
        _id: action.id,
        actionId: action.actionId,
        username: action.username,
        accountLabels: action.accountLabels || action.account?.labels || [],
        action: action.action,
        text: action.text,
        tweetId: action.tweetId,
        targetUserId: action.targetUserId,
        status: action.status,
        success: action.success,
        createdAt: action.createdAt.toISOString(),
        completedAt: action.completedAt?.toISOString(),
        error: action.error,
        batchId: action.batchId,
      }));

      res.json({
        actions: formattedActions,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (error) {
      console.error("Error obteniendo historial:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Estadísticas del historial
  router.get("/stats", async (req, res) => {
    try {
      const { days = "7" } = req.query;
      const stats = await historyService.getStats(days);
      res.json(stats);
    } catch (error) {
      console.error("Error en /api/history/stats:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  // Exportar historial
  router.get("/export", async (req, res) => {
    try {
      const filters = req.query;
      const result = await historyService.exportHistory(filters);

      if (filters.format === "csv") {
        res.set({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="historial-acciones-${
            new Date().toISOString().split("T")[0]
          }.csv"`,
        });
        return res.send(result);
      }

      res.json(result);
    } catch (error) {
      console.error("Error en /api/history/export:", error);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
      });
    }
  });

  return router;
}

module.exports = createHistoryRoutes;
