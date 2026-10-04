"use client";
import {useEffect,useRef,useState} from "react";
import type {CharacterDraft} from "@/lib/launchpad";
import {useWallet} from "./wallet";
import {Button} from "./ui/button";
import {Input} from "./ui/input";

export default function CharacterReferences({draft,onChange}:{draft:CharacterDraft;onChange:(patch:Partial<CharacterDraft>)=>void}) {
  const {viewer,connect}=useWallet();
  const [photos,setPhotos]=useState<{id:string;url:string}[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const change=useRef(onChange);change.current=onChange;
  async function load(signal?:AbortSignal){
    const r=await fetch(`/api/launchpad/assets?id=${encodeURIComponent(draft.id)}`,{signal});
    if(r.status===404)return;
    const data=await r.json() as {references:{id:string;url:string}[];referenceFingerprint:string;error?:string};
    if(!r.ok)throw new Error(data.error||"Could not load references.");
    if(signal?.aborted)return;
    setPhotos(data.references);change.current({referenceFingerprint:data.referenceFingerprint});
  }
  useEffect(()=>{
    setPhotos([]);setMessage("");if(!viewer.wallet)return;
    const controller=new AbortController();void load(controller.signal).catch(e=>{if(!controller.signal.aborted)setMessage(e.message);});
    return()=>controller.abort();
  },[draft.id,viewer.wallet]);
  async function upload(files:File[]){
    if(!files.length)return;
    if(files.length+photos.length>4){setMessage("Use up to four photos of the same character.");return;}
    if(files.some(f=>!["image/png","image/jpeg","image/webp"].includes(f.type)||f.size>4*1024*1024)){setMessage("Each photo must be PNG, JPEG or WebP, under 4 MB.");return;}
    setBusy(true);setMessage("");
    try {
      const saved=await fetch('/api/launchpad?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft})});
      if(!saved.ok){const data=await saved.json() as {error?:string};throw new Error(data.error||"Save the character first.");}
      for(const file of files){
        const form=new FormData();form.set('id',draft.id);form.set('purpose','reference');form.set('image',file);
        const r=await fetch('/api/launchpad/assets',{method:'POST',body:form});
        if(!r.ok){const data=await r.json() as {error?:string};throw new Error(data.error||"Upload failed.");}
      }
      await load();setMessage("References uploaded. Generate your character to apply the prompt and setting.");
    }catch(e){setMessage(e instanceof Error?e.message:"Reference upload unavailable.");await load().catch(()=>{});}
    finally{setBusy(false);}
  }
  return <section className="lp-reference-builder" aria-label="Character reference images">
    <h3>Reference images <span>{photos.length}/4</span></h3>
    <p className="lp-field-note">Optional: upload the face and look you want. Higgsfield uses these photos with your prompt to generate the character and setting. Coin artwork stays separate.</p>
    {!!photos.length && <div className="lp-reference-strip">{photos.map((p,i)=><img key={p.id} src={p.url} alt={`Character reference ${i+1}`}/>)}</div>}
    {!viewer.wallet?<Button variant="outline" onClick={connect}>Connect wallet to upload</Button>:<label className="lp-field">Upload reference images<Input aria-label="Upload character reference images" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy||!draft.rightsConfirmed||photos.length>=4} onChange={e=>{void upload(Array.from(e.target.files||[]));e.target.value="";}}/></label>}
    <p className="lp-field-note">PNG, JPEG or WebP · up to 4 MB each. Confirm likeness permission before uploading.</p>
    {message&&<p role="status">{message}</p>}{busy&&<p role="status">Uploading references…</p>}
  </section>;
}
