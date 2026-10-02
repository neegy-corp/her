import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { verifySignedTransaction } from './operator-transaction';

export function backendSigner(secret: string, wallet: string) {
  try {
    let bytes: Uint8Array;
    if (secret.trim().startsWith('[')) {
      const parsed: unknown = JSON.parse(secret);
      if (!Array.isArray(parsed) || parsed.length !== 64 || !parsed.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error();
      bytes = Uint8Array.from(parsed);
    } else bytes = bs58.decode(secret.trim());
    if (bytes.length !== 64) throw new Error();
    const signer = Keypair.fromSecretKey(bytes);
    if (signer.publicKey.toBase58() !== wallet) throw new Error();
    return signer;
  } catch { throw new Error('Backend signer is missing or does not match the project wallet.'); }
}
export function signerConfigured(secret: string, wallet: string) {
  if (!secret || !wallet) return false;
  try { backendSigner(secret, wallet); return true; } catch { return false; }
}
export function signReviewedOrder(secret: string, row: { wallet: string; transaction_message: string; unsigned_transaction: string }) {
  const signer = backendSigner(secret, row.wallet);
  if (!/^[a-f0-9]{2,8192}$/i.test(row.unsigned_transaction) || row.unsigned_transaction.length % 2) throw new Error('Stored transaction is invalid.');
  const tx = VersionedTransaction.deserialize(Buffer.from(row.unsigned_transaction, 'hex'));
  if (Buffer.from(tx.message.serialize()).toString('base64') !== row.transaction_message || tx.message.header.numRequiredSignatures !== 1 || tx.message.staticAccountKeys[0].toBase58() !== row.wallet) throw new Error('Stored transaction does not match the reviewed order.');
  tx.sign([signer]);
  return verifySignedTransaction(Buffer.from(tx.serialize()).toString('hex'), row);
}
