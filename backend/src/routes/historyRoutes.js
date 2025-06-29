const express = require("express");

function createHistoryRoutes(historyService, prisma) {
  const router = express.Router();

  // Obtener historial con filtros
  router.get("/", async (req, res) => {
    try {
      console.log("📋 Request to /api/history with filters:", req.query);
      const filters = req.query;
      const result = await historyService.getHistory(filters);
      console.log(
        `✅ History response: ${result.actions.length} actions found`
      );
      res.json(result);
    } catch (error) {
      console.error("❌ Error en /api/history:", error);
      console.error("🔍 Error details:", error.stack);
      res.status(500).json({
        error: error.message || "Error interno del servidor",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
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
