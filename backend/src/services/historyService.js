class HistoryService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async getHistory(filters = {}) {
    const {
      page = 1,
      limit = 50,
      search = "",
      action = "all",
      status = "all",
      account = "all",
      days = "7",
    } = filters;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Construir filtros
    const where = {};

    // Filtro por fechas
    if (days !== "all") {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      where.createdAt = { gte: daysAgo };
    }

    // Filtro por acción
    if (action !== "all") {
      where.action = action;
    }

    // Filtro por estado
    if (status !== "all") {
      // Mapear estados del frontend a estados válidos
      const statusMap = {
        completed: "COMPLETED",
        failed: "FAILED",
        running: "RUNNING",
        cancelled: "CANCELLED",
        scheduled: "QUEUED",
        queued: "QUEUED",
        executed: undefined, // Manejado por filtro especial
      };

      if (status === "executed") {
        // Para "executed", buscar solo COMPLETED y FAILED
        where.status = { in: ["COMPLETED", "FAILED"] };
      } else {
        const mappedStatus =
          statusMap[status.toLowerCase()] || status.toUpperCase();
        if (mappedStatus) {
          where.status = mappedStatus;
        }
      }
    }

    // Filtro por cuenta
    if (account !== "all") {
      where.username = { contains: account, mode: "insensitive" };
    }

    // Filtro por búsqueda
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { text: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ];
    }

    const [actions, total] = await Promise.all([
      this.prisma.actionHistory.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          account: {
            select: {
              username: true,
              labels: true,
            },
          },
        },
      }),
      this.prisma.actionHistory.count({ where }),
    ]);

    return {
      actions: actions.map((a) => ({
        _id: a.id,
        actionId: a.actionId,
        username: a.username,
        accountLabels: a.accountLabels,
        action: a.action,
        text: a.text,
        tweetId: a.tweetId,
        targetUserId: a.targetUserId,
        status: a.status,
        success: a.success,
        createdAt: a.createdAt.toISOString(),
        completedAt: a.completedAt?.toISOString(),
        error: a.error,
        batchId: a.batchId,
      })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / take),
    };
  }

  async getStats(days = "7") {
    // Calcular fecha de inicio
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const where = {
      createdAt: { gte: startDate },
    };

    // Obtener estadísticas
    const [
      totalActions,
      successfulActions,
      failedActions,
      rawActionsByType,
      rawActionsByAccount,
    ] = await Promise.all([
      this.prisma.actionHistory.count({ where }),
      this.prisma.actionHistory.count({ where: { ...where, success: true } }),
      this.prisma.actionHistory.count({ where: { ...where, success: false } }),
      this.prisma.actionHistory.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
      }),
      this.prisma.actionHistory.groupBy({
        by: ["username"],
        where,
        _count: { _all: true },
      }),
    ]);

    // Ordenar manualmente por count desc
    const actionsByType = rawActionsByType
      .map((a) => ({ action: a.action, count: a._count._all }))
      .sort((a, b) => b.count - a.count);

    const actionsByAccount = rawActionsByAccount
      .map((a) => ({ username: a.username, count: a._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      period: `${days} días`,
      totalActions,
      successfulActions,
      failedActions,
      successRate:
        totalActions > 0
          ? ((successfulActions / totalActions) * 100).toFixed(1)
          : 0,
      actionsByType,
      topAccounts: actionsByAccount,
    };
  }

  async exportHistory(filters = {}) {
    const {
      action = "all",
      status = "all",
      account = "all",
      days = "7",
      format = "csv",
    } = filters;

    // Usar los mismos filtros que el endpoint de historial
    const where = {};

    if (days !== "all") {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      where.createdAt = { gte: daysAgo };
    }

    if (action !== "all") {
      where.action = action;
    }

    if (status !== "all") {
      where.status = status.toUpperCase();
    }

    if (account !== "all") {
      where.username = { contains: account, mode: "insensitive" };
    }

    const actions = await this.prisma.actionHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000, // Límite de seguridad
    });

    if (format === "csv") {
      const csvHeader = "Fecha,Cuenta,Accion,Texto,Estado,Exito,Error,Lote\n";
      const csvRows = actions
        .map((a) => {
          const row = [
            a.createdAt.toISOString(),
            a.username,
            a.action,
            `"${(a.text || "").replace(/"/g, '""')}"`,
            a.status,
            a.success,
            `"${(a.error || "").replace(/"/g, '""')}"`,
            a.batchId || "",
          ];
          return row.join(",");
        })
        .join("\n");

      return csvHeader + csvRows;
    }

    return { actions };
  }

  async getRealTimeMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Obtener estadísticas del día
    const [totalToday, successToday, failedToday] = await Promise.all([
      this.prisma.actionHistory.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.actionHistory.count({
        where: {
          createdAt: { gte: today },
          success: true,
        },
      }),
      this.prisma.actionHistory.count({
        where: {
          createdAt: { gte: today },
          success: false,
        },
      }),
    ]);

    // Obtener distribución de acciones por hora (últimas 24 horas)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyActions = await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM "createdAt") as hour,
        COUNT(*) as count,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful
      FROM "action_history" 
      WHERE "createdAt" >= ${last24Hours}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    return {
      today: {
        total: totalToday,
        successful: successToday,
        failed: failedToday,
        successRate:
          totalToday > 0 ? Math.round((successToday / totalToday) * 100) : 0,
      },
      hourlyDistribution: hourlyActions.map((h) => ({
        hour: parseInt(h.hour),
        total: parseInt(h.count),
        successful: parseInt(h.successful),
      })),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = HistoryService;
