import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Only the SHA-256 hash is stored. The raw key is shown once at creation.
    keyHash: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ApiKey = mongoose.model("ApiKey", apiKeySchema);
