import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

export function verifySignedTransaction(hex: unknown, row: { wallet: string; transaction_message: string }) {
  if (typeof hex !== 'string' || !/^[a-f0-9]{2,8192}$/i.test(hex) || hex.length % 2) throw new Error('Wallet returned an invalid transaction.');
  const tx = VersionedTransaction.deserialize(Buffer.from(hex, 'hex'));
  const message = Buffer.from(tx.message.serialize());
  if (message.toString('base64') !== row.transaction_message || tx.message.header.numRequiredSignatures !== 1 || tx.message.staticAccountKeys[0].toBase58() !== row.wallet || !nacl.sign.detached.verify(message, tx.signatures[0], new PublicKey(row.wallet).toBytes())) throw new Error('Transaction or wallet signature did not match the reviewed order.');
  return { signedTransaction: Buffer.from(tx.serialize()).toString('base64'), signature: bs58.encode(tx.signatures[0]) };
}
