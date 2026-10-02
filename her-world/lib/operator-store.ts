import { db } from './database';

export type OperatorOrder = { id: string; wallet: string; mint: string; side: 'buy' | 'sell'; amount: string; thesis: string; token_name: string; symbol: string; decimals: number; request_id: string; transaction_message: string; unsigned_transaction: string; out_amount: string; expires: number; created_at: number; status: string; signature: string | null };
export type OperatorNote = { mint: string; thesis: string; updated_at: number };
export async function loginAllowed(key: string, now = Date.now()) {
  const bucket = Math.floor(now / 900000);
  const statement = 'INSERT INTO her_private.operator_limits (id,bucket,attempts,expires) VALUES (?,?,1,?) ON CONFLICT (id) DO UPDATE SET bucket = EXCLUDED.bucket, attempts = CASE WHEN operator_limits.bucket = EXCLUDED.bucket THEN operator_limits.attempts + 1 ELSE 1 END, expires = EXCLUDED.expires RETURNING attempts';
  const results = await db().batch([
    db().prepare('DELETE FROM her_private.operator_limits WHERE expires < ?').bind(now),
    db().prepare(statement).bind('global', bucket, now + 900000),
    db().prepare(statement).bind(key, bucket, now + 900000),
  ]);
  return Number(results[1].results[0]?.attempts) <= 100 && Number(results[2].results[0]?.attempts) <= 10;
}
export async function notes(wallet: string) {
  return (await db().prepare('SELECT mint,thesis,updated_at FROM her_private.operator_notes WHERE wallet = ? ORDER BY updated_at DESC LIMIT 100').bind(wallet).all<OperatorNote>()).results;
}
export async function saveNote(wallet: string, mint: string, thesis: string) {
  await db().prepare('INSERT INTO her_private.operator_notes (wallet,mint,thesis,updated_at) VALUES (?,?,?,?) ON CONFLICT (wallet,mint) DO UPDATE SET thesis = EXCLUDED.thesis, updated_at = EXCLUDED.updated_at').bind(wallet, mint, thesis, Date.now()).run();
}
export async function orders(wallet: string) {
  return (await db().prepare('SELECT id,mint,side,amount,thesis,token_name,symbol,status,signature,created_at,expires FROM her_private.operator_orders WHERE wallet = ? ORDER BY created_at DESC LIMIT 30').bind(wallet).all<OperatorOrder>()).results;
}
export async function order(id: string, wallet: string) {
  return db().prepare('SELECT * FROM her_private.operator_orders WHERE id = ? AND wallet = ?').bind(id, wallet).first<OperatorOrder>();
}
export async function insertOrder(row: OperatorOrder) {
  await db().prepare('INSERT INTO her_private.operator_orders (id,wallet,mint,side,amount,thesis,token_name,symbol,decimals,request_id,transaction_message,unsigned_transaction,out_amount,expires,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(row.id,row.wallet,row.mint,row.side,row.amount,row.thesis,row.token_name,row.symbol,row.decimals,row.request_id,row.transaction_message,row.unsigned_transaction,row.out_amount,row.expires,row.created_at,row.status).run();
}
export async function claimOrder(id: string, wallet: string, signature: string) {
  return db().prepare("UPDATE her_private.operator_orders SET status = 'submitting', signature = ? WHERE id = ? AND wallet = ? AND status = 'prepared' AND expires > ? RETURNING id").bind(signature,id,wallet,Date.now()).first();
}
export async function submitted(id: string, wallet: string, status: 'submitted' | 'failed' | 'unknown') {
  await db().prepare("UPDATE her_private.operator_orders SET status = ? WHERE id = ? AND wallet = ? AND status = 'submitting'").bind(status,id,wallet).run();
}
export async function reconcile(wallet: string, trades: { signature: string; side: string; changes: { mint: string; amount: number }[] }[]) {
  const pending = (await db().prepare("SELECT id,mint,side,signature,thesis,created_at FROM her_private.operator_orders WHERE wallet = ? AND status IN ('submitting','submitted','unknown') ORDER BY created_at DESC LIMIT 30").bind(wallet).all<OperatorOrder>()).results;
  for (const row of pending) {
    const trade = trades.find(trade => trade.signature === row.signature && trade.side === row.side && trade.changes.some(change => change.mint === row.mint && (row.side === 'buy' ? change.amount > 0 : change.amount < 0)));
    if (!trade) continue;
    await db().batch([
      db().prepare("UPDATE her_private.operator_orders SET status = 'confirmed' WHERE id = ? AND wallet = ? AND status IN ('submitting','submitted','unknown')").bind(row.id,wallet),
      db().prepare('INSERT INTO her_private.operator_notes (wallet,mint,thesis,updated_at) VALUES (?,?,?,?) ON CONFLICT (wallet,mint) DO UPDATE SET thesis = EXCLUDED.thesis, updated_at = EXCLUDED.updated_at WHERE operator_notes.updated_at < EXCLUDED.updated_at').bind(wallet,row.mint,row.thesis,row.created_at),
    ]);
  }
}
