import { withDatabase } from '@/lib/database';
import { setting } from '@/lib/server';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { db,json,publicConfig,mutationGuard,requestOrigin,address,digest,wallet,hostWallet,connection,rawAmount } from '@/lib/server';
import { roundState, reconcileBurns, verifyIntent, type BurnIntent } from '@/lib/rounds';
import { characters, emptyViewer } from '@/lib/catalog';
import { voteAmount } from '@/lib/burn-amount';

const action=(r:Request)=>new URL(r.url).searchParams.get('action')||'config';
const fail=(e:unknown,status=400)=>json({error:e instanceof Error?e.message:'Unable to complete this request. Please try again.'},status);
async function identity(req:Request){const who=await wallet(req);if(!who)throw new Error('Connect and verify your wallet first.');return who;}
async function host(req:Request){const who=await identity(req);if(!hostWallet()||who!==hostWallet())throw new Error('Only the host wallet can open these controls.');return who;}
const stageRows=`SELECT s.*, b.signature,b.amount FROM her_private.stage_requests s JOIN her_private.burn_receipts b ON s.id = b.id`;
async function handleGet(req:Request){try{
 if(action(req)==='rounds')return json(await roundState());
 if(action(req)==='config')return json(publicConfig());
 if(action(req)==='me'){
  const who=await wallet(req);if(!who)return json(emptyViewer);
  const receipts=(await db().prepare('SELECT * FROM her_private.burn_receipts WHERE wallet = ? ORDER BY created_at DESC LIMIT 100').bind(who).all()).results;
  const requests=(await db().prepare(stageRows+' WHERE s.wallet = ? ORDER BY s.created_at DESC LIMIT 30').bind(who).all()).results;
  const unlocked=(await db().prepare("SELECT DISTINCT character FROM her_private.burn_receipts WHERE wallet = ? AND kind = 'character'").bind(who).all<{character:string}>()).results.map(x=>x.character);
  return json({wallet:who,isHost:who===hostWallet(),receipts,requests,unlocks:unlocked});
 }
 if(action(req)==='admin'){await host(req);return json({requests:(await db().prepare(stageRows+' ORDER BY s.created_at DESC LIMIT 200').all()).results,receipts:(await db().prepare('SELECT * FROM her_private.burn_receipts ORDER BY created_at DESC LIMIT 200').all()).results});}
 return json({error:'Not found.'},404);
}catch(e){return fail(e,action(req)==='admin'?403:503);}}

async function handlePost(req:Request){try{
 if(action(req)==='control'){
  const token=setting('HER_CONTROL_TOKEN');
  if(!token||req.headers.get('authorization')!==`Bearer ${token}`)return json({error:'Unauthorized.'},401);
  const status=await req.json() as {character?:string;healthy?:boolean};
  if(!characters.some(c=>c.id===status.character))throw new Error('Unknown active character.');
  await db().prepare('UPDATE her_private.character_control SET actual=?,heartbeat=?,healthy=? WHERE id=1').bind(status.character!,Date.now(),status.healthy===true).run();
  await reconcileBurns();
  return json(await roundState());
 }
 if(Number(req.headers.get('content-length')||0)>20000)return json({error:'Request too large.'},413);
 const rawBody=await req.text();mutationGuard(req);if(rawBody.length>20000)return json({error:'Request too large.'},413);const parsed=JSON.parse(rawBody);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return json({error:'Invalid request.'},400);const body=parsed as Record<string,string>;
 const act=action(req);
 if(act==='challenge'){
  const who=address(body.wallet),now=Date.now();
  await db().batch([db().prepare('DELETE FROM her_private.challenges WHERE expires < ?').bind(now),db().prepare('DELETE FROM her_private.wallet_sessions WHERE expires < ?').bind(now)]);
  const id=crypto.randomUUID(); const message=`${new URL(requestOrigin(req)).host} wants you to sign in to ACP with your Solana wallet:\n${who}\n\nVerify ownership. This does not burn tokens or authorize a transaction.\n\nURI: ${requestOrigin(req)}\nNonce: ${id}\nIssued At: ${new Date(now).toISOString()}\nExpiration Time: ${new Date(now+300000).toISOString()}`;
  await db().prepare('INSERT INTO her_private.challenges (id,wallet,message,expires) VALUES (?,?,?,?)').bind(id,who,message,now+300000).run();return json({id,message});
 }
 if(act==='signin'){
  const who=address(body.wallet);const challenge=await db().prepare('SELECT * FROM her_private.challenges WHERE id = ? AND wallet = ? AND expires > ?').bind(String(body.id),who,Date.now()).first<{message:string}>();
  if(!challenge)throw new Error('Wallet challenge expired. Connect again.');
  const sig=bs58.decode(String(body.signature));if(!nacl.sign.detached.verify(new TextEncoder().encode(challenge.message),sig,new PublicKey(who).toBytes()))throw new Error('Wallet signature did not match.');
  const consumed=await db().prepare('DELETE FROM her_private.challenges WHERE id = ?').bind(String(body.id)).run();if(consumed.meta.changes!==1)throw new Error('This wallet challenge was already used.');
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');await db().prepare('INSERT INTO her_private.wallet_sessions (id,wallet,expires) VALUES (?,?,?)').bind(await digest(token),who,Date.now()+86400000).run();
  return json({wallet:who},200,{'Set-Cookie':`her-wallet=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(requestOrigin(req)).protocol==='https:'?'; Secure':''}`});
 }
 if(act==='logout'){const raw=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('her-wallet='))?.slice(11);if(raw&&/^[a-f0-9]{64}$/.test(raw))await db().prepare('DELETE FROM her_private.wallet_sessions WHERE id = ?').bind(await digest(raw)).run();return json({ok:true},200,{'Set-Cookie':'her-wallet=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
 if(act==='prepare'){
  const cfg=publicConfig();if(!cfg.enabled)return json({error:'Token burns open after launch. No tokens have been spent.'},403);
  const who=await identity(req); const kind=body.kind;
  if(kind!=='stage'&&kind!=='character')throw new Error('Choose a character or a stage request.');
  const requestedAmount=kind==='character'?voteAmount(body.amount):cfg.stageAmount;
  if(kind==='stage'&&!cfg.stageEnabled)throw new Error('Stage requests are closed.');
  if(kind==='character'&&!characters.some(c=>c.id===body.character))throw new Error('Choose a character.');
  const voting=kind==='character'?await roundState():null;
  if(voting&&!voting.accepting)throw new Error('Voting is paused or this round is finalizing. Please wait for the next open round.');
  if(kind==='stage'&&await db().prepare("SELECT id FROM her_private.stage_requests WHERE wallet = ? AND status IN ('pending','accepted','on_stage')").bind(who).first())throw new Error('You already have an active stage request.');
  const name=(body.name||'').trim().slice(0,40),topic=(body.topic||'').trim().slice(0,280);if(kind==='stage'&&(!name||!topic))throw new Error('Add your name and what you want to talk about.');
  const rpc=connection(),mint=new PublicKey(cfg.mint),owner=new PublicKey(who);const mintInfo=await rpc.getParsedAccountInfo(mint);
  const data=mintInfo.value?.data;if(!mintInfo.value||!data||!('parsed' in data))throw new Error('Token mint unavailable.');
  const program=mintInfo.value.owner;if(![TOKEN_PROGRAM_ID.toBase58(),TOKEN_2022_PROGRAM_ID.toBase58()].includes(program.toBase58()))throw new Error('Unsupported token program.');
  const decimals=Number(data.parsed.info.decimals),amount=requestedAmount,raw=rawAmount(amount,decimals);
  // Wallets normally hold tokens in their ATA. Read it directly: public RPCs
  // may disable indexed owner searches even when ordinary account reads work.
  const associated=getAssociatedTokenAddressSync(mint,owner,false,program);
  const associatedInfo=await rpc.getParsedAccountInfo(associated);
  const accountData=associatedInfo.value?.data;
  const info=accountData&&'parsed' in accountData?accountData.parsed.info:null;
  let source=info?.owner===who&&info?.mint===cfg.mint&&info?.state==='initialized'&&BigInt(info.tokenAmount.amount)>=raw?{pubkey:associated}:undefined;
  if(!source){try{const accounts=await rpc.getParsedTokenAccountsByOwner(owner,{mint});source=accounts.value.find(a=>a.account.data.parsed.info.owner===who&&a.account.data.parsed.info.state==='initialized'&&BigInt(a.account.data.parsed.info.tokenAmount.amount)>=raw);}catch{/* Indexed lookups can require a paid RPC; the normal ATA was checked above. */}}
  if(!source)throw new Error('Not enough HER in an available token account. Keep the amount you want to burn in your wallet’s standard HER token account.');
  const id=crypto.randomUUID(),now=Date.now(),latest=await rpc.getLatestBlockhash();
  const tx=new Transaction({feePayer:owner,recentBlockhash:latest.blockhash}).add(createBurnCheckedInstruction(source.pubkey,mint,owner,raw,decimals,[],program),new TransactionInstruction({keys:[],programId:new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),data:Buffer.from(`HER:${id}`)}));
  const expires=Math.min(now+90000,voting?voting.round!.ends_at-60000:now+90000);
  await db().prepare('INSERT INTO her_private.burn_intents (id,wallet,kind,character,amount,raw_amount,mint,decimals,program,name,topic,created_at,expires,round_id,transaction_message) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,who,kind,kind==='character'?body.character:null,amount,raw.toString(),cfg.mint,decimals,program.toBase58(),name,topic,now,expires,voting?.round?.id||null,tx.serializeMessage().toString('hex')).run();
  return json({id,amount,symbol:cfg.symbol,roundId:voting?.round?.id,unsignedTransaction:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('hex')});
 }
 if(act==='broadcast'){
  if(!publicConfig().enabled)throw new Error('Burns are currently closed.');const who=await identity(req);
  const intent=await db().prepare('SELECT * FROM her_private.burn_intents WHERE id = ? AND wallet = ? AND expires > ?').bind(body.id,who,Date.now()).first<BurnIntent>();if(!intent)throw new Error('Burn request expired.');
  if(!/^[a-f0-9]+$/i.test(body.signedTransaction||'')||body.signedTransaction.length>6000)throw new Error('Invalid signed transaction.');
  const tx=Transaction.from(Buffer.from(body.signedTransaction,'hex'));if(tx.feePayer?.toBase58()!==who||!tx.verifySignatures())throw new Error('Transaction signature does not match your wallet.');
  if(tx.serializeMessage().toString('hex')!==intent.transaction_message)throw new Error('Signed transaction differs from the reviewed burn.');
  if(intent.kind==='character'){const voting=await roundState();if(!voting.online||!voting.control?.enabled||voting.round?.id!==intent.round_id)throw new Error('Voting paused before submission. No burn was sent.');}
  const memo=tx.instructions.find(i=>i.programId.toBase58()==='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');if(memo?.data.toString()!==`HER:${body.id}`)throw new Error('Transaction is for a different request.');
  const signature=bs58.encode(tx.signature!);
  await db().prepare('UPDATE her_private.burn_intents SET submitted_signature = ? WHERE id = ? AND wallet = ?').bind(signature,intent.id,who).run();
  try{await connection().sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:3});}catch{return json({signature,pending:true});}
  return json({signature});
 }
 if(act==='verify'){
  const who=await identity(req);if(!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(body.signature||''))throw new Error('Invalid transaction signature.');
  const existing=await db().prepare('SELECT * FROM her_private.burn_receipts WHERE signature = ?').bind(body.signature).first<{wallet:string;id:string;counted:boolean}>();if(existing){if(existing.wallet!==who||existing.id!==body.id)throw new Error('This burn has already been claimed.');return json({verified:true,id:existing.id,counted:existing.counted});}
  const intent=await db().prepare('SELECT * FROM her_private.burn_intents WHERE id = ? AND wallet = ?').bind(body.id,who).first<BurnIntent>();if(!intent)throw new Error('Burn request not found.');
  return json(await verifyIntent(intent,body.signature));
 }
 if(act==='moderate'){
  const who=await host(req);const target=body.status;const transitions:Record<string,string[]>= {accepted:['pending'],rejected:['pending','accepted'],on_stage:['accepted'],ended:['on_stage']};if(!transitions[target])throw new Error('Invalid stage action.');
  const row=await db().prepare('SELECT status FROM her_private.stage_requests WHERE id = ?').bind(body.id).first<{status:string}>();if(!row||!transitions[target].includes(row.status))throw new Error('This request changed. Refresh the queue.');
  let invite:string|null=null;if(target==='accepted'){try{const u=new URL(body.inviteUrl);if(u.protocol!=='https:'||u.username||u.password)throw 0;invite=u.href;}catch{throw new Error('Add a secure guest room invite URL before accepting.');}}
  try {await db().batch([db().prepare('UPDATE her_private.stage_requests SET status = ?, invite_url = COALESCE(?,invite_url) WHERE id = ? AND status = ?').bind(target,invite,body.id,row.status),db().prepare('INSERT INTO her_private.moderation_log (id,request_id,host,action,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),body.id,who,target,Date.now())]);}catch{throw new Error('Only one guest can be on stage. End the current guest first.');}
  return json({ok:true});
 }
 return json({error:'Not found.'},404);
}catch(e){console.warn('HER request:',e instanceof Error?e.message:'Request failed');return fail(e);}}

export const GET = (req:Request) => withDatabase(setting('DATABASE_URL'),()=>handleGet(req));
export const POST = (req:Request) => withDatabase(setting('DATABASE_URL'),()=>handlePost(req));
