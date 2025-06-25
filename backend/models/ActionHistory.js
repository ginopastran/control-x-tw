const mongoose = require("mongoose");

const ActionHistorySchema = new mongoose.Schema(
  {
    // ID único de la acción
    actionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Información de la cuenta
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "XAccount",
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    accountLabels: [
      {
        type: String,
      },
    ],

    // Información de la acción
    action: {
      type: String,
      required: true,
      enum: [
        "tweet",
        "reply",
        "like",
        "retweet",
        "follow",
        "unfollow",
        "profile_update",
        "banner_upload",
      ],
      index: true,
    },

    // Contenido de la acción
    text: String,
    tweetId: String,
    targetUserId: String,

    // Estados y tiempos
    status: {
      type: String,
      required: true,
      enum: ["queued", "running", "completed", "failed", "cancelled"],
      index: true,
    },
    success: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startedAt: Date,
    completedAt: Date,

    // Configuración de delays
    baseDelay: Number,
    randomDelay: Number,
    actualDelay: Number,

    // Resultados
    result: mongoose.Schema.Types.Mixed,
    error: String,
    errorCode: String,

    // Metadatos adicionales
    ipAddress: String,
    userAgent: String,
    batchId: String, // Para agrupar acciones de lotes

    // Para facilitar consultas por fecha
    dateOnly: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true, // Esto agrega createdAt y updatedAt automáticamente
  }
);

// Middleware para establecer dateOnly antes de guardar
ActionHistorySchema.pre("save", function (next) {
  if (this.createdAt) {
    this.dateOnly = this.createdAt.toISOString().split("T")[0];
  }
  next();
});

// Índices compuestos para consultas eficientes
ActionHistorySchema.index({ createdAt: -1, status: 1 });
ActionHistorySchema.index({ accountId: 1, createdAt: -1 });
ActionHistorySchema.index({ action: 1, createdAt: -1 });
ActionHistorySchema.index({ dateOnly: 1, success: 1 });
ActionHistorySchema.index({ batchId: 1 }, { sparse: true });

// Métodos estáticos para consultas comunes
ActionHistorySchema.statics.getRecentActions = function (limit = 50) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("accountId", "username labels");
};

ActionHistorySchema.statics.getActionsByAccount = function (
  accountId,
  limit = 100
) {
  return this.find({ accountId }).sort({ createdAt: -1 }).limit(limit);
};

ActionHistorySchema.statics.getActionsByDateRange = function (
  startDate,
  endDate
) {
  return this.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  }).sort({ createdAt: -1 });
};

ActionHistorySchema.statics.getSuccessRate = function (dateRange = null) {
  const query = dateRange
    ? {
        createdAt: {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end),
        },
      }
    : {};

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: ["$success", 1, 0] } },
      },
    },
    {
      $project: {
        total: 1,
        successful: 1,
        successRate: {
          $cond: [
            { $eq: ["$total", 0] },
            0,
            { $multiply: [{ $divide: ["$successful", "$total"] }, 100] },
          ],
        },
      },
    },
  ]);
};

ActionHistorySchema.statics.getDailyStats = function (days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: "$dateOnly",
        total: { $sum: 1 },
        successful: { $sum: { $cond: ["$success", 1, 0] } },
        failed: { $sum: { $cond: ["$success", 0, 1] } },
        actions: { $push: "$action" },
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);
};

const ActionHistory = mongoose.model("ActionHistory", ActionHistorySchema);

module.exports = ActionHistory;
