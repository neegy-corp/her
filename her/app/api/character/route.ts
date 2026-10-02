import { authorize,json,setting } from '@/lib/server-config';
import { liveCharacters } from '@/lib/characters';
export async function POST(request:Request){
 const denied=await authorize(request,true);if(denied)return denied;
 try{
  const body=await request.json() as {character?:string;healthy?:boolean};
  if(!liveCharacters.some(c=>c.id===body.character))return json({error:'Unknown character.'},400);
  const token=setting('HER_CONTROL_TOKEN');if(!token)return json({error:'Character controller is not configured.'},503);
  const response=await fetch('https://heronsol.live/api/her?action=control',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({character:body.character,healthy:body.healthy===true}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Character controller temporarily unavailable.');
  return json(await response.json());
 }catch(e){return json({error:e instanceof Error?e.message:'Character controller unavailable.'},503);}
}
