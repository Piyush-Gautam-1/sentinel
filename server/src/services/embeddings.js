import { pipeline } from "@huggingface/transformers";
import { ATTACK_CORPUS } from "../data/attackCorpus.js";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

// Experimental starting value, not a validated security threshold.
const BLOCK_THRESHOLD = 0.85;

// Keep chunks short and overlap them so boundaries aren't simply skipped.
const CHUNK_CHARS = 400;
const CHUNK_OVERLAP = 100;
const MAX_CHUNKS = 64;

let initialization;

async function buildResources() {
  console.log("[embedding] Loading model...");

  const extractor = await pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
  });

  const output = await extractor(
    ATTACK_CORPUS.map((attack) => attack.text),
    { pooling: "mean", normalize: true }
  );

  console.log(
    `[embedding] Ready: ${ATTACK_CORPUS.length} attack references`
  );

  return {
    extractor,
    referenceVectors: output.tolist(),
  };
}

export function initEmbeddings() {
  if (!initialization) {
    initialization = buildResources().catch((err) => {
      initialization = undefined;
      throw err;
    });
  }

  return initialization;
}

// Both vectors are normalized, so their dot product is cosine similarity.
function similarity(a, b) {
  let value = 0;

  for (let i = 0; i < a.length; i++) {
    value += a[i] * b[i];
  }

  return Math.max(-1, Math.min(1, value));
}

function makeChunks(messages) {
  const chunks = [];

  for (const message of messages) {
    if (!["user", "tool"].includes(message.role)) continue;
    if (typeof message.content !== "string") continue;

    const text = message.content.normalize("NFKC").trim();
    if (!text) continue;

    for (
      let start = 0;
      start < text.length;
      start += CHUNK_CHARS - CHUNK_OVERLAP
    ) {
      chunks.push(text.slice(start, start + CHUNK_CHARS));

      if (chunks.length > MAX_CHUNKS) {
        const err = new Error("Request exceeds embedding scan capacity.");
        err.code = "firewall_input_too_large";
        throw err;
      }

      if (start + CHUNK_CHARS >= text.length) break;
    }
  }

  return chunks;
}

export async function runEmbeddingCheck(messages) {
  const chunks = makeChunks(messages);

  if (!chunks.length) {
    return {
      verdict: "allow",
      score: 0,
      reason: "no_scannable_messages",
    };
  }

  const { extractor, referenceVectors } = await initEmbeddings();

  let bestScore = -1;
  let bestMatch = null;

  // Process sequentially to avoid a large per-request embedding batch.
  for (const chunk of chunks) {
    const output = await extractor(chunk, {
      pooling: "mean",
      normalize: true,
    });

    const vector = output.tolist()[0];

    for (let i = 0; i < referenceVectors.length; i++) {
      const score = similarity(vector, referenceVectors[i]);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = ATTACK_CORPUS[i].id;
      }
    }
  }

  return {
    verdict: bestScore >= BLOCK_THRESHOLD ? "block" : "allow",
    score: Number(bestScore.toFixed(4)),
    reason: `nearest_reference:${bestMatch}`,
  };
}