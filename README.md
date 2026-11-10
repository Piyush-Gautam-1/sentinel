# Sentinel

An OpenAI-compatible LLM gateway with a prompt-injection firewall and a cost-aware model router.

> Status: work in progress (Day 1 of 7). Gateway, auth, and cost logging are live.

## Architecture (planned)

```
Client app -> POST /v1/chat/completions
                 |
           [ Firewall ]  heuristics -> embeddings -> LLM judge
                 |
           [ Router ]    difficulty score -> cheap or strong model
                 |
           Provider call -> log tokens, cost, latency, decisions to MongoDB
                 |
           React dashboard (live feed + charts)
```

## Roadmap

- [x] Day 1: OpenAI-compatible proxy, API-key auth, token/cost/latency logging
- [ ] Day 2: Firewall layers 1-2 (heuristics, embedding similarity)
- [ ] Day 3: Firewall layer 3 (LLM judge), indirect injection scanning
- [ ] Day 4: Cost-aware router
- [ ] Day 5: Dashboard + "try to hack it" page
- [ ] Day 6: Benchmarks, rate limiting, hardening
- [ ] Day 7: Docker, CI, demo video, results table

## Run locally

```bash
cd server
cp .env.example .env        # fill in MONGODB_URI and PROVIDER_API_KEY
npm install
npm run create-key -- "my-laptop"   # prints your gateway API key once
npm run dev
```

## Try it

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-sentinel-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"YOUR-MODEL-ID","messages":[{"role":"user","content":"Say hi"}]}'
```

Because the API shape matches OpenAI's, any OpenAI SDK works by changing only the base URL.

## Results

_Filled in on Day 6._
