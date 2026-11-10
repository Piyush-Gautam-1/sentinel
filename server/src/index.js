import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import healthRoutes from "./routes/health.js";
import chatRoutes from "./routes/chat.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();

// Render/Vercel sit behind a proxy. Needed for correct client IPs (rate limiting on Day 6).
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
  })
);
app.use(express.json({ limit: "100kb" }));

app.use(healthRoutes);
app.use(chatRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDb();
    app.listen(env.PORT, () => {
      console.log(`Sentinel gateway listening on port ${env.PORT}`);
    });
  } catch (err) {
    console.error("Failed to start:", err.message);
    process.exit(1);
  }
}

start();
