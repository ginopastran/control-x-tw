import mongoose from "mongoose";

const tokenInfoSchema = new mongoose.Schema({
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'XAccount', 
    required: true 
  },
  accessToken: { 
    type: String, 
    required: true 
  },
  refreshToken: { 
    type: String, 
    required: true 
  },
  expiresAt: { 
    type: Date, 
    required: true 
  },
  lastRefresh: { 
    type: Date, 
    default: Date.now 
  },
  isValid: { 
    type: Boolean, 
    default: true 
  }
});

// Índices para búsquedas eficientes
tokenInfoSchema.index({ accountId: 1 });
tokenInfoSchema.index({ expiresAt: 1 });

const TokenInfo = mongoose.models.TokenInfo || mongoose.model("TokenInfo", tokenInfoSchema);

export default TokenInfo; 