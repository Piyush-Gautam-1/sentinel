import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(status, message, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// OpenAI-style error envelope so existing OpenAI SDKs can parse our errors.
function send(res, status, message, code, details) {
  const error = { message, type: code, code };
  if (details) error.details = details;
  return res.status(status).json({ error });
}

export function notFound(req, res) {
  return send(res, 404, `Route not found: ${req.method} ${req.path}`, "not_found");
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return send(res, 400, "Invalid request body", "invalid_request", details);
  }

  if (err instanceof HttpError) {
    return send(res, err.status, err.message, err.code);
  }

  // Malformed JSON from express.json()
  if (err.type === "entity.parse.failed") {
    return send(res, 400, "Request body is not valid JSON", "invalid_json");
  }
  if (err.type === "entity.too.large") {
    return send(res, 413, "Request body too large", "payload_too_large");
  }

  console.error("Unhandled error:", err);
  return send(res, 500, "Internal server error", "internal_error");
}
