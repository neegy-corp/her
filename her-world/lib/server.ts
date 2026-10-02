import { env } from './runtime-env';
import { PublicKey, Connection } from '@solana/web3.js';
import type { PublicConfig } from './catalog';
export const setting=(key:string)=>String((env as unknown as Record<string,unknown>)[key]||process.env[key]||'');
export { db } from './database';
import { db } from './database';
export const json=(data:unknown,status=200,headers:HeadersInit={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export function publicConfig():PublicConfig {const mint=setting('HER_TOKEN_MINT');const proAmount='10000';const stageAmount=setting('HER_STAGE_BURN');const host=setting('HER_HOST_WALLET'); const configured=!!(mint&&setting('SOLANA_RPC_URL'));return {enabled:configured&&setting('HER_BURNS_ENABLED')==='true',stageEnabled:configured&&!!stageAmount&&!!host&&setting('HER_BURNS_ENABLED')==='true'&&setting('HER_STAGE_ENABLED')==='true',mint,symbol:setting('HER_TOKEN_SYMBOL')||'HER',proAmount,stageAmount,hostConfigured:!!host,turnkeyOrganizationId:setting('TURNKEY_ORGANIZATION_ID'),turnkeyAuthProxyConfigId:setting('TURNKEY_AUTH_PROXY_CONFIG_ID')};}
export function requestOrigin(req:Request){
  const url=new URL(req.url);
  // Next may use its internal listener hostname in req.url. Host is the actual
  // browser destination; never use the caller's Origin as the trusted value.
  const host=req.headers.get('host')||url.host;
  const protocol=process.env.VERCEL==='1'?'https:':url.protocol;
  return new URL(`${protocol}//${host}`).origin;
}
export function mutationGuard(req:Request){if(req.headers.get('origin')!==requestOrigin(req))throw new Error('Request origin not allowed.');}
export function address(value:unknown){if(typeof value!=='string')throw new Error('Connect a Solana wallet.');try{if(new PublicKey(value).toBase58()!==value)throw 0;return value;}catch{throw new Error('Invalid Solana wallet address.');}}
export const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function wallet(req:Request){const raw=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('her-wallet='))?.slice(11);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const row=await db().prepare('SELECT wallet FROM her_private.wallet_sessions WHERE id = ? AND expires > ?').bind(await digest(raw),Date.now()).first<{wallet:string}>();return row?.wallet||null;}
export const hostWallet=()=>setting('HER_HOST_WALLET');
export function connection(){const rpc=setting('SOLANA_RPC_URL');if(!rpc.startsWith('https://'))throw new Error('Token burns are not configured yet.');return new Connection(rpc,'finalized');}
export function rawAmount(value:string,decimals:number){if(!/^\d+(\.\d+)?$/.test(value))throw new Error('Burn amount is not configured.');const [whole,fraction='']=value.split('.');if(fraction.length>decimals)throw new Error('Invalid token precision.');const n=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');if(n<=0n||n>18446744073709551615n)throw new Error('Invalid burn amount.');return n;}
