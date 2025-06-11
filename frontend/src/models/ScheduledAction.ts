import mongoose from "mongoose";

const scheduledActionSchema = new mongoose.Schema({
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'XAccount', 
    required: true 
  },
  tweetId: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['tweet', 'reply', 'like', 'retweet'], 
    required: true 
  },
  text: { 
    type: String,
    required: function(this: any) { return this.type === 'reply' || this.type === 'tweet'; }
  },
  scheduledFor: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    type: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  executedAt: {
    type: Date
  }
});

// Crear índices para consultas eficientes
scheduledActionSchema.index({ status: 1, scheduledFor: 1 });
scheduledActionSchema.index({ accountId: 1 });
scheduledActionSchema.index({ tweetId: 1 });

const ScheduledAction = mongoose.models.ScheduledAction || 
  mongoose.model("ScheduledAction", scheduledActionSchema);

export default ScheduledAction; 