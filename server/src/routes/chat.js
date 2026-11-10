import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { callProvider } from "../services/provider.js";
import { calcCost } from "../services/cost.js";
import { RequestLog } from "../models/RequestLog.js";

const router = Router();

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().min(1, "content cannot be empty"),
});

const bodySchema = z
  .object({
    model: z.string().min(1, "model is required"),
    messages: z.array(messageSchema).min(1, "messages cannot be empty").max(100),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().max(8192).optional(),
    stream: z.boolean().optional(),
  })
  .passthrough();

// Write the log AFTER responding, and never let a logging failure affect the user.
function saveLog(doc) {
  RequestLog.create(doc).catch((err) =>
    console.error("Failed to write request log:", err.message)
  );
}

router.post("/v1/chat/completions", auth, async (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);

    if (body.stream) {
      throw new HttpError(
        400,
        "Streaming is not supported yet. Set stream to false.",
        "streaming_not_supported"
      );
    }

    const { status, data, latencyMs } = await callProvider(body);

    // Provider returned an error (bad model name, rate limit, etc.): pass it through.
    if (status < 200 || status >= 300) {
      saveLog({
        apiKeyId: req.apiKeyId,
        requestedModel: body.model,
        modelUsed: body.model,
        latencyMs,
        status: "error",
        httpStatus: status,
        errorMessage: data?.error?.message?.slice(0, 500),
      });
      return res.status(status).json(data);
    }

    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const modelUsed = data.model || body.model;

    res.json(data);

    saveLog({
      apiKeyId: req.apiKeyId,
      requestedModel: body.model,
      modelUsed,
      promptTokens,
      completionTokens,
      costUsd: calcCost(body.model, promptTokens, completionTokens),
      latencyMs,
      status: "success",
      httpStatus: status,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
