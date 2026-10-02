"use client";
import { useEffect, useState } from 'react';
import { api } from './wallet';
import { characters } from '@/lib/catalog';
export type Voting = {now:number;online:boolean;accepting:boolean;voteClosesAt:number;control:{enabled:boolean;desired:string;actual:string};round:{id:number;ends_at:number};totals:{character:string;amount:string;votes:number}[];recent:{id:number;winner:string;reason:string}[]};
export function useVoting(){
 const [voting,setVoting]=useState<Voting|null>(null);
 useEffect(()=>{let disposed=false,busy=false;const update=async()=>{if(busy)return;busy=true;try{const v=await api<Voting>('rounds');if(!disposed)setVoting(v);}catch{if(!disposed)setVoting(null);}finally{busy=false;}};void update();const t=setInterval(()=>void update(),10000);return()=>{disposed=true;clearInterval(t);};},[]);
 return voting;
}
export function VotingPanel({voting}:{voting:Voting|null}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{setNow(voting?.now||Date.now());const t=setInterval(()=>setNow(n=>n+1000),1000);return()=>clearInterval(t);},[voting?.now]);
 const seconds=Math.max(0,Math.ceil(((voting?.round?.ends_at||now)-now)/1000));
 const name=(id?:string)=>characters.find(c=>c.id===id)?.name||'Olivia';
 return <section className="section vote-panel" aria-label="Live character voting"><div className="section-title"><div><span className="eyebrow">THE COMMUNITY PICKS THE NEXT FACE</span><h2>Your burn.<br/><em>Your choice.</em></h2></div><div><p>Burn 10,000 HER or more for Olivia, Maya, or Ivy. Enter any amount; the full burn counts. The character with the most verified burns takes over the stream every 30 minutes.</p><strong className="vote-clock">{voting?`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`:'—:—'}</strong><p>{!voting?'Loading round…':!voting.control.enabled?'Voting opens soon':!voting.online?'Voting paused · camera controller offline':voting.accepting?'Voting is open':'Finalizing burns · next round opens shortly'}</p></div></div><div className="vote-totals">{characters.map(c=><div key={c.id}><span>{c.name}{voting?.control.actual===c.id?' · On camera':''}</span><strong>{Number(voting?.totals.find(t=>t.character===c.id)?.amount||0).toLocaleString()} HER</strong></div>)}</div><p className="vote-rules">New votes close two minutes before the round ends so transactions can finalize. Highest total wins; ties and empty rounds keep the current character. Votes reset each round. Burns are permanent and do not guarantee your choice wins.</p>{voting?.control.desired!==voting?.control.actual&&<p>Preparing {name(voting?.control.desired)}. The current character stays on camera until the next face is ready.</p>}<a className="select-button" href="#characters">Choose a character ↗</a></section>;
}
