import { createRequire } from "node:module";
import { PublicKey, type Connection } from "@solana/web3.js";
import {
  ACP_QUOTE_MINT,
  ACP_FEE_WALLET,
  ACP_CREATOR_FEE_BPS,
} from "./acp-config";
const { PumpSdk, OnlinePumpSdk } = createRequire(import.meta.url)(
  "@pump-fun/pump-sdk",
) as typeof import("@pump-fun/pump-sdk");
type FeeBN = NonNullable<
  Parameters<
    InstanceType<typeof PumpSdk>["createV2Instruction"]
  >[0]["creatorFeeBps"]
>;
const BN = createRequire(import.meta.url)("bn.js") as new (
  value: number,
) => FeeBN;
export const acpCoinTerms = {
  quoteSymbol: "NVDAX",
  quoteMint: ACP_QUOTE_MINT,
  creatorFeeBps: ACP_CREATOR_FEE_BPS,
  feeRecipient: ACP_FEE_WALLET,
  initialBuy: 0,
  feeCurrency: "NVDAX",
  protocolFeesAdditional: true,
};
export function assertPairSupport(
  global: {
    creatorFeeConfigurable: boolean;
    maxConfigurableCreatorFeeBps: { toString(): string };
  },
  quote: { source: string; mint: PublicKey },
) {
  if (
    !quote.mint.equals(new PublicKey(ACP_QUOTE_MINT)) ||
    quote.source !== "quoteControl"
  )
    throw new Error(
      "Pump does not currently support the required NVDAX custom pair.",
    );
  if (
    !global.creatorFeeConfigurable ||
    BigInt(global.maxConfigurableCreatorFeeBps.toString()) <
      BigInt(ACP_CREATOR_FEE_BPS)
  )
    throw new Error(
      "Pump does not currently allow the configured 1% ACP creator fee.",
    );
}
export async function checkAcpPair(rpc: Connection) {
  const sdk = new OnlinePumpSdk(rpc);
  const [global, quote] = await Promise.all([
    sdk.fetchGlobal(),
    sdk.resolveQuoteMint(new PublicKey(ACP_QUOTE_MINT)),
  ]);
  assertPairSupport(global, quote);
  return quote;
}
export async function buildAcpCreate(args: {
  mint: PublicKey;
  user: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  quoteTokenProgram: PublicKey;
}) {
  if (Buffer.byteLength(args.name, "utf8") > 32 || args.uri.length > 200)
    throw new Error("Coin name or metadata URL exceeds Pump's limit.");
  return new PumpSdk().createV2Instruction({
    ...args,
    creator: new PublicKey(ACP_FEE_WALLET),
    quoteMint: new PublicKey(ACP_QUOTE_MINT),
    creatorFeeBps: new BN(ACP_CREATOR_FEE_BPS),
    mayhemMode: false,
    cashback: false,
    holderReward: false,
  });
}
export async function verifyAcpCoin(rpc: Connection, mint: string) {
  const curve = await new OnlinePumpSdk(rpc).fetchBondingCurve(
    new PublicKey(mint),
  );
  if (
    !curve.quoteMint.equals(new PublicKey(ACP_QUOTE_MINT)) ||
    !curve.creator.equals(new PublicKey(ACP_FEE_WALLET)) ||
    Number(curve.creatorFeeBps.toString()) !== ACP_CREATOR_FEE_BPS ||
    curve.isHolderReward
  )
    throw new Error(
      "The confirmed coin does not match the reviewed ACP pair and fee settings.",
    );
  return true;
}
