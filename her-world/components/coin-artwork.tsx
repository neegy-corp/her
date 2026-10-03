"use client";
import { useEffect, useState } from "react";
import type { CharacterDraft } from "@/lib/launchpad";
import { IMAGE_MAX_BYTES } from "@/lib/acp-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus } from "lucide-react";
export default function CoinArtwork({draft, onChange, servicesAvailable = false}: {draft: CharacterDraft; onChange: (patch: Partial<CharacterDraft>) => void; servicesAvailable?: boolean}) {
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return ()=>URL.revokeObjectURL(url);},[file]);
 async function upload(){
  if(!file || !servicesAvailable)return;setBusy(true);setMessage("");
  try{
   const save=await fetch("/api/launchpad?action=save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draft})});
   if(!save.ok)throw Error(((await save.json()) as {error?:string}).error || "Connect and verify your wallet first.");
   const form=new FormData();form.set("id",draft.id);form.set("purpose","pfp");form.set("image",file);
   const response=await fetch("/api/launchpad/assets",{method:"POST",body:form});const result=await response.json() as {error?:string;url:string};
   if(!response.ok)throw Error(result.error || "Upload unavailable.");
   const patch={coinPfp:result.url};onChange(patch);
   const persisted=await fetch("/api/launchpad?action=save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draft:{...draft,...patch}})});
   if(!persisted.ok)throw Error("Image uploaded. Use Sync to finish saving it.");setMessage("Image uploaded and saved.");
  }catch(error){setMessage(error instanceof Error?error.message:"Upload failed.");}finally{setBusy(false);}
 }
 return <section className="lp-coin-art" aria-label="Coin profile picture"><div className="lp-pfp-upload"><div className="lp-pfp-preview">{preview || draft.coinPfp ? <img src={preview || draft.coinPfp} alt="Coin profile picture" /> : <ImagePlus size={25} />}</div><div className="lp-pfp-controls"><Label htmlFor="coin-pfp-file">Profile picture</Label><Input id="coin-pfp-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event=>{const next=event.target.files?.[0];if(!next)return;if(next.size>IMAGE_MAX_BYTES || !["image/png","image/jpeg","image/webp"].includes(next.type)){setMessage("Choose a PNG, JPEG or WebP under 4 MB.");return;}setFile(next);setMessage("Preview only. Upload to save this image.");}} /><div className="lp-pfp-actions"><Button variant="outline" size="sm" disabled={!file || busy || !servicesAvailable} onClick={()=>void upload()}>{busy?"Uploading…":"Upload image"}</Button>{draft.image && <Button variant="ghost" size="sm" disabled={busy} onClick={()=>{onChange({coinPfp:draft.image});setFile(null);setPreview("");setMessage("Character image selected.");}}>Use character image</Button>}</div><p>Square image · PNG, JPG or WebP · up to 4 MB</p>{message && <p role="status">{message}</p>}{!servicesAvailable && <p>Connect your wallet to upload.</p>}</div></div></section>;
}
