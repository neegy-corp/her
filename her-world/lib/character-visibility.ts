import { setting } from "./server";

// Presentation only: retain launch receipts, encrypted wallets and payment journals.
export function archivedCharacterIds() {
  return new Set(setting("ACP_ARCHIVED_CHARACTER_IDS").split(",").map(id => id.trim()).filter(Boolean));
}
