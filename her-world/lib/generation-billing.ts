import { setting } from "./server";
// Conservative fulfillment reserves include video, one portrait/minute and 20 scripts/minute.
// This ceiling counts all sold obligations, including consumed credits. Raise only after topping up.
export const fulfillmentMicroUsd = (minutes: number) => minutes * (60 * 170000 + 100000 + 20 * 20000);
export function providerBudgetMicroUsd() {
  const value = Number(setting("ACP_PROVIDER_BUDGET_USD"));
  return Number.isFinite(value) && value > 0 && value <= 100000 ? Math.floor(value * 1e6) : 0;
}
export const publicGenerationEnabled = () => setting("ACP_PUBLIC_GENERATION_ENABLED") === "true" && setting("ACP_STREAM_CREDITS_ENABLED") === "true" && providerBudgetMicroUsd() > 0;
