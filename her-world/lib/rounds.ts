import { db, connection } from './server';
import { validateBurn } from './burn-validation';

export type BurnIntent = {id:string;wallet:string;mint:string;program:string;raw_amount:string;created_at:number;expires:number;kind:string;character:string|null;amount:string;name:string;topic:string;round_id:number|null;submitted_signature:string|null;transaction_message:string|null};
export async function roundState(){
 await db().prepare('SELECT her_private.advance_character_rounds()').all();
 const control=await db().prepare('SELECT enabled,desired,actual,revision,heartbeat,healthy FROM her_private.character_control WHERE id=1').first<{enabled:boolean;desired:string;actual:string;revision:number;heartbeat:number;healthy:boolean}>();
 const round=await db().prepare('SELECT * FROM her_private.character_rounds WHERE settled_at IS NULL ORDER BY id DESC LIMIT 1').first<{id:number;ends_at:number}>();
 const totals=(await db().prepare('SELECT i.character, SUM(b.amount::numeric)::text AS amount, COUNT(*)::integer AS votes FROM her_private.burn_receipts b JOIN her_private.burn_intents i ON i.id=b.id WHERE i.round_id = ? AND b.counted GROUP BY i.character').bind(round?.id||0).all()).results;
 const recent=(await db().prepare('SELECT id,ends_at,winner,reason FROM her_private.character_rounds WHERE settled_at IS NOT NULL ORDER BY id DESC LIMIT 5').all()).results;
 const now=Date.now(),online=!!control?.healthy&&now-control.heartbeat<45000;
 return {control,round,totals,recent,now,online,accepting:!!control?.enabled&&online&&!!round&&now<round.ends_at-120000,voteClosesAt:round?round.ends_at-120000:0};
}
export async function verifyIntent(intent:BurnIntent,signature:string){
 const tx=await connection().getParsedTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
 validateBurn(tx?{...tx,transaction:{message:{accountKeys:tx.transaction.message.accountKeys.map(a=>({pubkey:a.pubkey.toBase58(),signer:a.signer})),instructions:tx.transaction.message.instructions.map(i=>({...i,programId:i.programId.toBase58()}))}}}:null,intent);
 if(intent.kind==='character'&&intent.round_id){
  const result=await db().prepare('SELECT her_private.accept_character_burn(?,?) AS counted').bind(intent.id,signature).first<{counted:boolean}>();
  return {verified:true,id:intent.id,counted:result?.counted===true};
 }
 const statements=[db().prepare('INSERT INTO her_private.burn_receipts (id,wallet,kind,character,amount,signature,created_at) VALUES (?,?,?,?,?,?,?)').bind(intent.id,intent.wallet,intent.kind,intent.character,intent.amount,signature,Date.now())];
 if(intent.kind==='stage')statements.push(db().prepare("INSERT INTO her_private.stage_requests (id,wallet,name,topic,status,created_at) VALUES (?,?,?,?,'pending',?)").bind(intent.id,intent.wallet,intent.name,intent.topic,Date.now()));
 await db().batch(statements);return {verified:true,id:intent.id,counted:false};
}
export async function reconcileBurns(){
 const intents=(await db().prepare('SELECT i.* FROM her_private.burn_intents i LEFT JOIN her_private.burn_receipts b ON b.id=i.id WHERE i.submitted_signature IS NOT NULL AND b.id IS NULL AND i.created_at > ? ORDER BY i.created_at LIMIT 20').bind(Date.now()-3600000).all<BurnIntent>()).results;
 await Promise.allSettled(intents.map(i=>verifyIntent(i,i.submitted_signature!)));
}
