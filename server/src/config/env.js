import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  PROVIDER_BASE_URL: z.string().url("PROVIDER_BASE_URL must be a valid URL"),
  PROVIDER_API_KEY: z.string().min(1, "PROVIDER_API_KEY is required"),
  CORS_ORIGIN: z.string().default("*"),
  PROVIDER_TIMEOUT_MS: z.coerce.number().default(30000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
