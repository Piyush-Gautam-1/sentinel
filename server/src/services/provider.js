import { env } from "../config/env.js";
import { HttpError } from "../middleware/errorHandler.js";

/**
 * Forward a chat completion request to the upstream provider.
 * Returns { status, data, latencyMs }. Throws HttpError on timeout/network failure.
 * A non-2xx reply from the provider is returned (not thrown) so the caller can
 * pass the provider's error message through and still log it.
 */
export async function callProvider(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
  const started = performance.now();

  try {
    const res = await fetch(`${env.PROVIDER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.PROVIDER_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - started);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: text.slice(0, 500) || "Empty provider response" } };
    }

    return { status: res.status, data, latencyMs };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new HttpError(504, "Provider timed out", "provider_timeout");
    }
    throw new HttpError(502, "Could not reach provider", "provider_unreachable");
  } finally {
    clearTimeout(timer);
  }
}
