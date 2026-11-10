import { PRICING } from "../config/pricing.js";

const warned = new Set();

/**
 * Cost in USD for one request, from the token counts the provider reported.
 * Returns 0 (and warns once) if the model is missing from the price table,
 * so a missing price never breaks a request.
 */
export function calcCost(model, promptTokens = 0, completionTokens = 0) {
  const price = PRICING[model];
  if (!price) {
    if (!warned.has(model)) {
      warned.add(model);
      console.warn(
        `[cost] No price for model "${model}". Add it to src/config/pricing.js`
      );
    }
    return 0;
  }
  const cost =
    (promptTokens / 1_000_000) * price.input +
    (completionTokens / 1_000_000) * price.output;
  // Keep 8 decimals: single requests cost fractions of a cent.
  return Number(cost.toFixed(8));
}
