// Price table: USD per 1 MILLION tokens.
// Source: Groq pricing page. Verify at https://groq.com/pricing before relying on it.
//
// Keys must match the exact model id you send in requests.
export const PRICING = {
  "openai/gpt-oss-20b":  { input: 0.075, output: 0.30 }, // cheap model
  "openai/gpt-oss-120b": { input: 0.15,  output: 0.60 }, // strong model
};