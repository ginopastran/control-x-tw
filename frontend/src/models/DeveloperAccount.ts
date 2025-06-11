// models/DeveloperAccount.ts
import mongoose from "mongoose";

const DeveloperAccountSchema = new mongoose.Schema({
  name: { type: String, required: true }, // nombre o etiqueta identificadora
  apiKey: { type: String, required: true },
  apiSecret: { type: String, required: true },
  bearerToken: { type: String, required: true },
  clientId: { type: String }, // opcional, si usás OAuth 2
  clientSecret: { type: String },
  labels: [String], // etiquetas para identificar o clasificar esta cuenta
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.DeveloperAccount || mongoose.model("DeveloperAccount", DeveloperAccountSchema);
