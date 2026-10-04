import { createRequire } from "node:module";
import { PublicKey, type Connection, type TransactionInstruction } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  ACP_FEE_WALLET,
  ACP_PLATFORM_FEE_BPS,
  ACP_DEVELOPER_FEE_BPS,
} from "./acp-config";
// Keep optional coin-provider loading out of draft/status requests.
const pumpSdk = () =>
  createRequire(import.meta.url)(
    "@pump-fun/pump-sdk",
  ) as typeof import("@pump-fun/pump-sdk");
export const acpCoinTerms = {
  quoteSymbol: "SOL",
  feeCurrency: "SOL",
  platformBps: ACP_PLATFORM_FEE_BPS,
  developerBps: ACP_DEVELOPER_FEE_BPS,
  platformWallet: ACP_FEE_WALLET,
  initialBuy: 0,
  protocolFeesAdditional: true,
};
/** Standard SOL-quoted coin whose creator is the character's launch wallet. */
export async function buildAcpCreate(args: {
  mint: PublicKey;
  creator: PublicKey;
  name: string;
  symbol: string;
  uri: string;
}) {
  if (Buffer.byteLength(args.name, "utf8") > 32 || args.uri.length > 200)
    throw new Error("Coin name or metadata URL exceeds Pump's limit.");
  const { PumpSdk } = pumpSdk();
  return new PumpSdk().createV2Instruction({
    mint: args.mint,
    name: args.name,
    symbol: args.symbol,
    uri: args.uri,
    creator: args.creator,
    user: args.creator,
    mayhemMode: false,
    cashback: false,
    holderReward: false,
  });
}
/** The launch wallet must still be the creator and the coin must be SOL-quoted. */
export async function verifyAcpCoin(rpc: Connection, mint: string, launchWallet: string) {
  const { OnlinePumpSdk, feeSharingConfigPda, normalizeQuoteMint } = pumpSdk();
  const mintKey = new PublicKey(mint);
  const curve = await new OnlinePumpSdk(rpc).fetchBondingCurve(mintKey);
  const creators = [new PublicKey(launchWallet), feeSharingConfigPda(mintKey)];
  if (
    !normalizeQuoteMint(curve.quoteMint).equals(NATIVE_MINT) ||
    !creators.some((c) => curve.creator.equals(c)) ||
    curve.isHolderReward ||
    curve.isCashbackCoin
  )
    throw new Error(
      "The confirmed coin does not match the reviewed SOL launch settings.",
    );
  return true;
}
/** 50% to ACP's fee wallet, 50% to the launch wallet that holds the developer's share. */
export function feeShareholders(launchWallet: string) {
  const platform = new PublicKey(ACP_FEE_WALLET),
    launch = new PublicKey(launchWallet);
  if (platform.equals(launch))
    throw new Error("The launch wallet must differ from the ACP fee wallet.");
  return [
    { address: platform, shareBps: ACP_PLATFORM_FEE_BPS },
    { address: launch, shareBps: ACP_DEVELOPER_FEE_BPS },
  ];
}
/**
 * One-time, permanent split. Signed by the launch wallet (the coin's creator).
 * `update_fee_shares_v2` revokes the admin, so the split can never be edited again.
 */
export async function buildFeeSharingSetup(args: {
  mint: PublicKey;
  launchWallet: PublicKey;
}): Promise<TransactionInstruction[]> {
  const { PUMP_SDK } = pumpSdk();
  const shares = feeShareholders(args.launchWallet.toBase58());
  return [
    await PUMP_SDK.createFeeSharingConfig({
      creator: args.launchWallet,
      mint: args.mint,
      pool: null,
    }),
    await PUMP_SDK.updateFeeSharesV2({
      authority: args.launchWallet,
      mint: args.mint,
      currentShareholders: [args.launchWallet],
      newShareholders: shares,
      quoteMint: NATIVE_MINT,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
    }),
  ];
}
/** Reads the sharing config on chain and confirms the locked 50/50 split. */
export async function verifyFeeSharing(rpc: Connection, mint: string, launchWallet: string) {
  const { PUMP_SDK, feeSharingConfigPda } = pumpSdk();
  const info = await rpc.getAccountInfo(feeSharingConfigPda(new PublicKey(mint)));
  if (!info) return false;
  const config = PUMP_SDK.decodeSharingConfig(info);
  const expected = new Map(
    feeShareholders(launchWallet).map((s) => [s.address.toBase58(), s.shareBps]),
  );
  return (
    config.adminRevoked &&
    config.shareholders.length === expected.size &&
    config.shareholders.every((s) => expected.get(s.address.toBase58()) === s.shareBps)
  );
}
/** Permissionless crank: pays the coin's accrued SOL creator fees to both shareholders. */
export async function buildFeeDistribution(rpc: Connection, mint: string, payer: PublicKey) {
  const { OnlinePumpSdk } = pumpSdk();
  const { instructions } = await new OnlinePumpSdk(rpc).buildDistributeCreatorFeesInstructions(
    new PublicKey(mint),
    { quoteMint: NATIVE_MINT, payer },
  );
  return instructions;
}
