"use client";
import { createContext,useContext,useEffect,useState,useCallback,useRef,lazy,Suspense,type ReactNode } from 'react';
import { emptyConfig,emptyViewer,type PublicConfig,type Viewer } from '@/lib/catalog';
export async function api<T=Record<string,unknown>>(action:string,body?:unknown):Promise<T>{const r=await fetch(`/api/her?action=${action}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error||'Please try again.');return d as T;}
export type WalletBridge={connect:()=>void;disconnect:()=>Promise<void>;signTransaction:(hex:string)=>Promise<string>};
const Context=createContext<{config:PublicConfig;viewer:Viewer;refresh:()=>Promise<void>;connect:()=>void;signTransaction:(hex:string)=>Promise<string>;disconnect:()=>Promise<void>;notice:string;setNotice:(s:string)=>void}>({config:emptyConfig,viewer:emptyViewer,refresh:async()=>{},connect:()=>{},signTransaction:async()=>{throw new Error('Connect your wallet first.');},disconnect:async()=>{},notice:'',setNotice:()=>{}});
const TurnkeyBridge=lazy(()=>import('./turnkey-bridge'));
export function WalletRoot({children}:{children:ReactNode}){
 const [config,setConfig]=useState(emptyConfig),[viewer,setViewer]=useState(emptyViewer),[notice,setNotice]=useState(''),[bridge,setBridge]=useState<WalletBridge|null>(null);
 const [requested,setRequested]=useState(false);const pendingConnect=useRef(false);
 const onReady=useCallback((value:WalletBridge)=>{setBridge(value);if(pendingConnect.current){pendingConnect.current=false;value.connect();setNotice('');}},[]);
 async function refresh(){setViewer(await api<Viewer>('me'));}
 useEffect(()=>{api<PublicConfig>('config').then(setConfig).catch(()=>setNotice('Connection settings are unavailable. You can still browse.'));void refresh().catch(()=>{});},[]);
 function connect(){if(!bridge){pendingConnect.current=true;setRequested(true);setNotice('Loading wallet connections…');return;}bridge.connect();}
 const signTransaction=async(hex:string)=>{if(!bridge){connect();throw new Error('Reconnect your wallet, then review and confirm the transaction again.');}return bridge.signTransaction(hex);};
 async function disconnect(){await api('logout',{});setViewer(emptyViewer);await bridge?.disconnect().catch(()=>{});setNotice('Wallet disconnected from ACP.');}
 return <Context.Provider value={{config,viewer,refresh,connect,signTransaction,disconnect,notice,setNotice}}>{requested&&<Suspense fallback={null}><TurnkeyBridge config={config} onReady={onReady} onConnected={refresh} onError={setNotice}/></Suspense>}{children}{notice&&<div className="notice" role="status"><p>{notice}</p><button onClick={()=>setNotice('')} aria-label="Dismiss notice">×</button></div>}</Context.Provider>;
}
export const useWallet=()=>useContext(Context);
