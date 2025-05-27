// models/XAccount.ts
import mongoose from "mongoose";

const xAccountSchema = new mongoose.Schema({
  username: { type: String, required: true }, // @usuario
  userId: { type: String, required: true }, // ID real de X

  // Credenciales de la app compartida (legacy - opcional)
  accessToken: { type: String }, // Token de autenticación
  refreshToken: { type: String }, // (opcional, si usás OAuth 2)

  // Credenciales propias del usuario (nuevas)
  ownApiKey: { type: String }, // API Key propia del usuario (encriptada)
  ownApiSecret: { type: String }, // API Secret propia del usuario (encriptada)
  ownBearerToken: { type: String }, // Bearer Token propio del usuario (encriptada)
  ownAccessToken: { type: String }, // Access Token propio (encriptada)
  ownAccessTokenSecret: { type: String }, // Access Token Secret propio (encriptada)

  // Información de la app del usuario
  userAppName: { type: String }, // Nombre de la app del usuario en Twitter
  userDeveloperEmail: { type: String }, // Email de la cuenta de desarrollador
  appCreatedAt: { type: Date }, // Fecha de creación de la app

  // Configuración
  useOwnCredentials: { type: Boolean, default: false }, // Si usar credenciales propias o compartidas
  credentialsVerified: { type: Boolean, default: false }, // Si las credenciales fueron verificadas

  developerTag: { type: String, required: true }, // etiqueta para saber qué cuenta dev la maneja
  labels: [{ type: String }], // etiquetas para sectorizar esta cuenta
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
