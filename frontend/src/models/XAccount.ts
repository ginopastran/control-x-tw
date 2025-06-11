// models/XAccount.ts
import mongoose from "mongoose";

const xAccountSchema = new mongoose.Schema({
  username: { type: String, required: true }, // @usuario
  userId: { type: String, required: true }, // ID real de X

  // Credenciales de la app compartida (legacy - opcional)
  accessToken: { type: String }, // Token de autenticación
  refreshToken: { type: String }, // (opcional, si usás OAuth 2)

  // Credenciales propias del usuario - OAuth 1.0a (existing)
  ownApiKey: { type: String }, // API Key propia del usuario (encriptada)
  ownApiSecret: { type: String }, // API Secret propia del usuario (encriptada)
  ownBearerToken: { type: String }, // Bearer Token propio del usuario (encriptada)
  ownAccessToken: { type: String }, // Access Token propio (encriptada)
  ownAccessTokenSecret: { type: String }, // Access Token Secret propio (encriptada)

  // Credenciales propias del usuario - OAuth 2.0 (new)
  ownClientId: { type: String }, // OAuth 2.0 Client ID (encriptado)
  ownClientSecret: { type: String }, // OAuth 2.0 Client Secret (encriptado)
  ownOAuth2AccessToken: { type: String }, // OAuth 2.0 Access Token (encriptado)
  ownOAuth2RefreshToken: { type: String }, // OAuth 2.0 Refresh Token (encriptado)
  oauth2TokenExpiresAt: { type: Date }, // Fecha de expiración del Access Token
  oauth2Scopes: { type: [String], default: [] }, // Scopes otorgados

  // Información de la app del usuario
  userAppName: { type: String }, // Nombre de la app del usuario en Twitter
  userDeveloperEmail: { type: String }, // Email de la cuenta de desarrollador
  appCreatedAt: { type: Date }, // Fecha de creación de la app

  // Configuración
  useOwnCredentials: { type: Boolean, default: false }, // Si usar credenciales propias o compartidas
  credentialsVerified: { type: Boolean, default: false }, // Si las credenciales fueron verificadas
  preferOAuth2: { type: Boolean, default: true }, // Preferir OAuth 2.0 sobre OAuth 1.0a

  developerTag: { type: String, required: true }, // etiqueta para saber qué cuenta dev la maneja
  labels: [{ type: String }], // etiquetas para sectorizar esta cuenta

  // Límites diarios y estado para el dashboard
  dailyLimits: {
    tweets: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 300 },
      reset: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    follows: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 400 },
      reset: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    likes: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 1000 },
      reset: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    retweets: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 300 },
      reset: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
  },
  status: {
    type: String,
    enum: ["active", "suspended", "limited", "error"],
    default: "active",
  },
  lastActivity: { type: Date, default: Date.now },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Middleware para actualizar updatedAt
xAccountSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const XAccount =
  mongoose.models.XAccount || mongoose.model("XAccount", xAccountSchema);

export default XAccount;
