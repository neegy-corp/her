// Standard SOL-quoted Pump coins. Creator fees are paid in SOL.
// ACP's fee wallet receives the platform half of every coin's creator fees and the payment for video time.
export const ACP_FEE_WALLET = "5psWWm8BAjWBGt54jSn8DgCrQEDnq8FurqbaTAuaCqyi";
// Pump locks the split permanently after the first update: 50% ACP fee wallet, 50% to the
// character's own launch wallet (the developer's share, held there until they spend or export it).
export const ACP_PLATFORM_FEE_BPS = 5000;
export const ACP_DEVELOPER_FEE_BPS = 10000 - ACP_PLATFORM_FEE_BPS;
// ACP pays for this much generated video and stream time on every character, once.
export const ACP_FREE_VIDEO_SECONDS = 0;
// SOL the launch wallet must hold before launching: rent, Pump create fee and network fees.
export const ACP_LAUNCH_MIN_LAMPORTS = 50_000_000;
// What video time costs the developer. Linear in length: price = seconds x rate, paid in SOL.
// Estimated provider cost is roughly $0.08 to $0.17 per generated second; this adds margin to the high end.
// Override with ACP_VIDEO_USD_PER_SECOND once the real Higgsfield rate is confirmed.
export const ACP_VIDEO_USD_PER_SECOND = 0.2;
// Keep a little SOL in the launch wallet for network fees after a purchase.
export const ACP_PURCHASE_RESERVE_LAMPORTS = 10_000;
// Kling v3: one frontal photo plus 1–3 additional reference views per element.
export const REFERENCE_LIMIT = 4;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export type AssetPurpose = "reference" | "pfp" | "banner";
export function assetPurpose(value: unknown): AssetPurpose {
  if (value == null || value === "reference") return "reference";
  if (value === "pfp" || value === "banner") return value;
  throw new Error("Unknown image purpose.");
}
