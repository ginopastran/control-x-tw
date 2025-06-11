const mongoose = require("mongoose");

const XAccountSchema = new mongoose.Schema(
  {
    username: {
      // @nombredeusuario
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      // ID numérico del usuario de Twitter/X
      type: String,
      required: false, // Puede que no todas las cuentas lo tengan inicialmente
      unique: true, // El user ID de Twitter debe ser único
      sparse: true, // Permite múltiples documentos con valor nulo en userId
    },
    twitterUserId: {
      type: String,
    },
    labels: [String],

    // Credenciales OAuth 1.0a propias
    ownApiKey: String,
    ownApiSecret: String,
    ownBearerToken: String,
    ownAccessToken: String,
    ownAccessTokenSecret: String,

    // Credenciales OAuth 2.0 propias
    ownClientId: String,
    ownClientSecret: String,
    ownOAuth2AccessToken: String,
    ownOAuth2RefreshToken: String,
    oauth2TokenExpiresAt: Date,

    // Configuración
    useOwnCredentials: {
      // Indica si se deben usar las credenciales propias o las compartidas
      type: Boolean,
      default: false,
    },
    preferOAuth2: {
      // Preferir OAuth 2.0 sobre OAuth 1.0a cuando ambos estén disponibles
      type: Boolean,
      default: false,
    },
    credentialsVerified: {
      // Indica si las credenciales propias han sido verificadas por Twitter
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Métricas
    metrics: {
      tweets: {
        type: Number,
        default: 0,
      },
      likes: {
        type: Number,
        default: 0,
      },
      retweets: {
        type: Number,
        default: 0,
      },
      replies: {
        type: Number,
        default: 0,
      },
      follows: {
        type: Number,
        default: 0,
      },
      unfollows: {
        type: Number,
        default: 0,
      },
      totalActions: {
        type: Number,
        default: 0,
      },
    },

    // Límites diarios (para seguimiento)
    dailyLimits: {
      tweets: {
        used: {
          type: Number,
          default: 0,
        },
        limit: {
          type: Number,
          default: 300,
        },
        reset: {
          type: Date,
          default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
      follows: {
        used: {
          type: Number,
          default: 0,
        },
        limit: {
          type: Number,
          default: 400,
        },
        reset: {
          type: Date,
          default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
      likes: {
        used: {
          type: Number,
          default: 0,
        },
        limit: {
          type: Number,
          default: 1000,
        },
        reset: {
          type: Date,
          default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
      retweets: {
        used: {
          type: Number,
          default: 0,
        },
        limit: {
          type: Number,
          default: 300,
        },
        reset: {
          type: Date,
          default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    },

    lastActivity: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "limited", "error"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Middleware para actualizar updatedAt antes de guardar
XAccountSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Exportar el modelo
const XAccount = mongoose.model("XAccount", XAccountSchema);

module.exports = XAccount;
