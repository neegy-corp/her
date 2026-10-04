import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { setting } from "./server";
// Each character gets its own custodial launch wallet. The platform holds the key so it can
// launch the coin and set up fee sharing, and the owner can export the key at any time.
// The secret is encrypted at rest with AES-256-GCM, bound to the character and owner.
function masterKey() {
  const key = Buffer.from(setting("ACP_LAUNCH_WALLET_KEY"), "base64");
  if (key.length !== 32)
    throw new Error("Launch wallets are not configured. ACP_LAUNCH_WALLET_KEY must be 32 bytes, base64.");
  return key;
}
export const launchWalletsConfigured = () => {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
};
const context = (id: string, owner: string) => Buffer.from(`acp-launch-wallet:${id}:${owner}`);
export function newLaunchWallet(id: string, owner: string) {
  const keypair = Keypair.generate();
  return { publicKey: keypair.publicKey.toBase58(), sealed: seal(keypair.secretKey, id, owner) };
}
export function seal(secret: Uint8Array, id: string, owner: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(context(id, owner));
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, body, cipher.getAuthTag()].map((b) => b.toString("base64")).join(".");
}
export function open(sealed: string, id: string, owner: string) {
  const [iv, body, tag] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !body || !tag) throw new Error("Launch wallet record is damaged.");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAAD(context(id, owner));
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]));
}
export function launchKeypair(sealed: string, id: string, owner: string) {
  return Keypair.fromSecretKey(open(sealed, id, owner));
}
/** Base58 secret key, importable into Phantom, Solflare or the Solana CLI. */
export function exportSecret(sealed: string, id: string, owner: string) {
  return bs58.encode(open(sealed, id, owner));
}
