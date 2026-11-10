import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { callProvider } from "../services/provider.js";
import { calcCost } from "../services/cost.js";
import { RequestLog } from "../models/RequestLog.js";
import { runHeuristics } from "../services/firewall.js";
import { runEmbeddingCheck } from "../services/embeddings.js";

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

// Logging is best-effort and must not interrupt the response.
function saveLog(doc) {
  RequestLog.create(doc).catch((err) => {
    console.error("Failed to write request log:", err.message);
  });
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

    const firewallStarted = performance.now();

    // Scan user/tool content, not trusted system instructions.
    const scanMessages = body.messages.filter((message) =>
      ["user", "tool"].includes(message.role)
    );

    // Layer 1: rule-based checks.
    const heuristic = runHeuristics(scanMessages);

    let firewall = {
      decision: heuristic.verdict,
      layer: "heuristic",
      score: heuristic.score,
      reason: heuristic.matched.join(",") || "no_rule_match",
    };

    // Layer 2 runs only when Layer 1 allows the request.
    if (heuristic.verdict !== "block") {
      let embedding;

      try {
        embedding = await runEmbeddingCheck(scanMessages);
      } catch (err) {
        const tooLarge = err.code === "firewall_input_too_large";
        const httpStatus = tooLarge ? 413 : 503;

        console.error("[firewall] Embedding scan failed:", err.message);

        saveLog({
          apiKeyId: req.apiKeyId,
          requestedModel: body.model,
          latencyMs: Math.round(performance.now() - firewallStarted),
          status: "error",
          httpStatus,
          errorMessage: tooLarge
            ? "Request exceeds firewall scan capacity."
            : "Embedding scanner unavailable.",
        });

        throw new HttpError(
          httpStatus,
          tooLarge
            ? "Request is too large for the firewall to scan."
            : "Firewall temporarily unavailable. Please try again.",
          tooLarge ? "firewall_input_too_large" : "firewall_unavailable"
        );
      }

      firewall = {
        decision: embedding.verdict,
        layer: "embedding",
        score: embedding.score,
        reason: embedding.reason,
      };
    }

    // A block from either layer stops the request before the provider call.
    if (firewall.decision === "block") {
      saveLog({
        apiKeyId: req.apiKeyId,
        requestedModel: body.model,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs: Math.round(performance.now() - firewallStarted),
        status: "blocked",
        httpStatus: 400,
        firewall,
      });

      throw new HttpError(
        400,
        "Request blocked by prompt-injection firewall.",
        "prompt_injection_detected"
      );
    }

    // Both firewall layers allowed the request.
    let providerResponse;

    try {
      providerResponse = await callProvider(body);
    } catch (err) {
      // Log provider timeouts and network failures too.
      saveLog({
        apiKeyId: req.apiKeyId,
        requestedModel: body.model,
        modelUsed: body.model,
        status: "error",
        httpStatus: err.status || 502,
        errorMessage: String(err.message || "Provider request failed").slice(
          0,
          500
        ),
        firewall,
      });

      throw err;
    }

    const { status, data, latencyMs } = providerResponse;

    // Pass upstream HTTP errors through to the client.
    if (status < 200 || status >= 300) {
      res.status(status).json(data);

      saveLog({
        apiKeyId: req.apiKeyId,
        requestedModel: body.model,
        modelUsed: body.model,
        latencyMs,
        status: "error",
        httpStatus: status,
        errorMessage: String(
          data?.error?.message || "Provider returned an error"
        ).slice(0, 500),
        firewall,
      });

      return;
    }

    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const modelUsed = data.model || body.model;

    res.status(status).json(data);

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
      firewall,
    });
  } catch (err) {
    next(err);
  }
});

export default router;