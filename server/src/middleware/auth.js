import crypto from "node:crypto";
import { ApiKey } from "../models/ApiKey.js";
import { HttpError } from "./errorHandler.js";

export function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, rawKey] = header.split(" ");

    if (scheme !== "Bearer" || !rawKey) {
      throw new HttpError(
        401,
        "Missing API key. Send 'Authorization: Bearer <key>'.",
        "missing_api_key"
      );
    }

    const key = await ApiKey.findOne({ keyHash: hashKey(rawKey), active: true })
      .select("_id name")
      .lean();

    if (!key) {
      throw new HttpError(401, "Invalid or inactive API key.", "invalid_api_key");
    }

    req.apiKeyId = key._id;
    req.apiKeyName = key.name;
    next();
  } catch (err) {
    next(err);
  }
}
