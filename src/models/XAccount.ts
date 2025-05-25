// models/XAccount.ts
import mongoose from "mongoose";

const xAccountSchema = new mongoose.Schema({
  username: { type: String, required: true }, // @usuario
  userId: { type: String, required: true }, // ID real de X
  accessToken: { type: String, required: true }, // Token de autenticación
  refreshToken: { type: String }, // (opcional, si usás OAuth 2)
  developerTag: { type: String, required: true }, // etiqueta para saber qué cuenta dev la maneja
  labels: [{ type: String }], // etiquetas para sectorizar esta cuenta
  createdAt: { type: Date, default: Date.now },
});

const XAccount = mongoose.models.XAccount || mongoose.model("XAccount", xAccountSchema);

export default XAccount;
