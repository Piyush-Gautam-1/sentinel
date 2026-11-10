import mongoose from "mongoose";

// Fields for later days (firewall, router) are defined now so no migration is needed.
const requestLogSchema = new mongoose.Schema(
  {
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "ApiKey", index: true },

    requestedModel: String,
    modelUsed: String,

    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["success", "error", "blocked"],
      required: true,
      index: true,
    },
    httpStatus: Number,
    errorMessage: String,

    // Day 2-3: firewall
    firewall: {
      decision: { type: String, enum: ["allow", "block", null], default: null },
      layer: { type: String, default: null }, // "heuristic" | "embedding" | "judge"
      score: { type: Number, default: null },
      reason: { type: String, default: null },
    },

    // Day 4: router
    router: {
      difficulty: { type: Number, default: null },
      chosenModel: { type: String, default: null },
      escalated: { type: Boolean, default: false },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

requestLogSchema.index({ createdAt: -1 });

export const RequestLog = mongoose.model("RequestLog", requestLogSchema);
