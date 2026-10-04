"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./wallet";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { streamPlans, type StreamCreditState } from "@/lib/stream-plans";
type Quote = { intentId: string; minutes: number; tokens: number; mint: string; unsignedTransaction: string; expires: number };
export default function StreamCredits({id,onState}: {id:string;onState?:(state:StreamCreditState)=>void}) {
  const {viewer,connect,signTransaction}=useWallet();
  const [state,setState]=useState<StreamCreditState|null>(null),[minutes,setMinutes]=useState(15),[quote,setQuote]=useState<Quote|null>(null),[approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const call=useCallback(async(action?:string,body?:unknown)=>{
    const r=await fetch(`/api/launchpad/credits?id=${encodeURIComponent(id)}${action ? `&action=${action}` : ""}`,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{});
    const data=await r.json() as {error?:string};if(!r.ok)throw new Error(data.error || "Stream credits unavailable.");return data;
  },[id]);
  const refresh=useCallback(async()=>{const value=await call() as StreamCreditState;setState(value);onState?.(value);},[call,onState]);
  useEffect(()=>{
    setState(null);setQuote(null);setMessage("");
    if(!viewer.wallet)return;
    let active=true;
    const load=()=>{void call().then(data=>{const value=data as StreamCreditState;if(active){setState(value);onState?.(value);}}).catch(e=>{if(active)setMessage(e.message);});};
    load();const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer);};
  },[viewer.wallet,call,onState]);
  async function run(work:()=>Promise<void>){setBusy(true);setMessage("");try{await work();}catch(e){setMessage(e instanceof Error?e.message:"Request unavailable.");}finally{setBusy(false);}}
  async function purchase(){
    if(!quote || !approved)return;
    await run(async()=>{
      const signedTransaction=await signTransaction(quote.unsignedTransaction);
      await call("submit",{intentId:quote.intentId,signedTransaction});
      setQuote(null);await refresh();
      try{await call("verify",{intentId:quote.intentId});setMessage("Burn finalized. Your time and video credits are saved.");await refresh();}
      catch{setMessage("Burn submitted. Use Verify burn after finalization. Do not burn again.");}
    });
  }
  return <section className="lp-stream-setup" aria-label="ACP stream time">
    <h3>Fuel your character with ACP</h3>
    <p>Burn the main ACP token from this character’s developer wallet. Each 15 minutes costs 50,000 ACP.</p>
    <div className="lp-clip-options" role="group" aria-label="Stream duration">
      {streamPlans.map(plan=><Button key={plan.minutes} variant={minutes===plan.minutes?"default":"outline"} aria-pressed={minutes===plan.minutes} disabled={busy || !!quote} onClick={()=>setMinutes(plan.minutes)}>{plan.minutes===60?"1 hour":`${plan.minutes} min`} · {plan.tokens.toLocaleString()} ACP</Button>)}
    </div>
    <p>Time starts when publishing connects. Stopping preserves unused time; additional burns extend it. Each plan also allows up to that many requested video seconds. Existing scenes can replay while new ones render.</p>
    {state && <p>Unstarted time: {Math.floor(state.streamSeconds/60)} min · Video allowance: {state.videoSeconds}s{state.endsAt>state.serverNow?` · Active until ${new Date(state.endsAt).toLocaleTimeString()}`:""}</p>}
    {state?.sessionId && state.endsAt>state.serverNow && <Button variant="outline" disabled={busy} onClick={()=>void run(async()=>{await call("stop",{sessionId:state.sessionId});await refresh();setMessage("Paid session ended. Remaining time is saved; connected studios stop at their next credit check.");})}>End paid session and save remaining time</Button>}
    {!state?.enabled && <p>ACP burns open after the main token launches and streaming activation is verified. No tokens are being charged.</p>}
    {!viewer.wallet ? <Button onClick={connect}>Connect developer wallet</Button> : <Button disabled={!state?.enabled || busy || !!quote || !!state.pending.length} onClick={()=>void run(async()=>{setApproved(false);setQuote(await call("prepare",{minutes}) as Quote);})}>Review {minutes/15*50000} ACP burn</Button>}
    {quote && <div className="lp-inline" role="region" aria-label="Review ACP burn"><strong>Burn {quote.tokens.toLocaleString()} ACP for {quote.minutes} minutes</strong><p>Main ACP mint: <code>{quote.mint}</code></p><p>The burn is permanent. A small SOL network fee is additional. Provider availability and funding are still required.</p><label className="lp-check"><Checkbox checked={approved} onCheckedChange={v=>setApproved(v===true)} aria-label="Approve permanent ACP burn"/>I approve this exact burn.</label><Button disabled={!approved || busy} onClick={()=>void purchase()}>Confirm in wallet</Button><Button variant="ghost" disabled={busy} onClick={()=>setQuote(null)}>Cancel</Button></div>}
    {state?.pending.map(burn=><div key={burn.id}><p>{burn.minutes}-minute burn awaiting verification</p><Button disabled={busy} onClick={()=>void run(async()=>{await call("verify",{intentId:burn.id});setMessage("Burn verified. Credits saved.");await refresh();})}>Verify burn</Button></div>)}
    {message && <p role="status">{message}</p>}
  </section>;
}
