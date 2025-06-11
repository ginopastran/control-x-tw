import mongoose, { Schema, Document } from "mongoose";

export interface IAuthorizedEmail extends Document {
  email: string;
  authorizedBy: mongoose.Types.ObjectId; // ID del superadmin que autorizó el email
  authorizedAt: Date;
  used: boolean; // Si ya se registró alguien con este email
  usedBy?: mongoose.Types.ObjectId; // ID del usuario que usó este email autorizado
  usedAt?: Date;
}

const AuthorizedEmailSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "El email es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    authorizedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorizedAt: {
      type: Date,
      default: Date.now,
    },
    used: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.AuthorizedEmail ||
  mongoose.model<IAuthorizedEmail>("AuthorizedEmail", AuthorizedEmailSchema);
