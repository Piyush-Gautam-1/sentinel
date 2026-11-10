// Usage: node scripts/createKey.js "my-laptop"
// Prints the raw key ONCE. Only its SHA-256 hash is stored in MongoDB.
import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ApiKey } from "../src/models/ApiKey.js";
import { hashKey } from "../src/middleware/auth.js";

import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const name = process.argv[2] || "default";

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const rawKey = `sk-sentinel-${crypto.randomBytes(32).toString("hex")}`;
  await ApiKey.create({ name, keyHash: hashKey(rawKey) });

  console.log(`\nAPI key created for "${name}":\n`);
  console.log(`  ${rawKey}\n`);
  console.log("Save it now. It cannot be shown again.\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to create key:", err.message);
  process.exit(1);
});
