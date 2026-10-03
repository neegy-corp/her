export type PublicToken = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  mint: string;
  pfp: string | null;
  banner: string | null;
  pumpUrl: string;
};
export type PublicTokenRow = {
  id: string;
  name: string | null;
  symbol: string | null;
  description: string | null;
  mint: string;
  pfp: string | null;
  banner: string | null;
};
const art = (value: string | null) => {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
};
// Explicit projection keeps private prompts, wallets and provider IDs out of public responses.
export function publicToken(row: PublicTokenRow): PublicToken | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.mint)) return null;
  return {
    id: row.id,
    name: row.name?.slice(0, 32) || "Unnamed character",
    symbol: row.symbol?.slice(0, 10) || "",
    description: row.description?.slice(0, 500) || "",
    mint: row.mint,
    pfp: art(row.pfp),
    banner: art(row.banner),
    pumpUrl: `https://pump.fun/coin/${row.mint}`,
  };
}
