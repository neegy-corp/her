export const ACP_QUOTE_MINT = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh";
export const ACP_FEE_WALLET = "6n3erAFxnvfjsAfbPdabwnpvfGpi2RW5Z8Yk1AYspzXs";
export const ACP_CREATOR_FEE_BPS = 100;
// Kling v3: one frontal photo plus 1–3 additional reference views per element.
export const REFERENCE_LIMIT = 4;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export type AssetPurpose = "reference" | "pfp" | "banner";
export function assetPurpose(value: unknown): AssetPurpose {
  if (value == null || value === "reference") return "reference";
  if (value === "pfp" || value === "banner") return value;
  throw new Error("Unknown image purpose.");
}
