import { authorize, json } from "@/lib/server-config";
type Health = { at: number; state: string; phase: string; queued: number; frames: number; memoryTurns: number; lastEvent: string; character:string; switching:boolean };
const holder = globalThis as typeof globalThis & { herHealth?: Health };
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  return json(holder.herHealth || { state: "unknown" });
}
export async function POST(request: Request) {
  const denied = await authorize(request, true); if (denied) return denied;
  const body = await request.json() as Partial<Health>;
  holder.herHealth = { at: Date.now(), state: String(body.state || "").slice(0, 20), phase: String(body.phase || "").slice(0, 20), queued: Number(body.queued) || 0, frames: Number(body.frames) || 0, memoryTurns: Number(body.memoryTurns) || 0, lastEvent: String(body.lastEvent || "").slice(0, 100),character:String(body.character||'olivia'),switching:body.switching===true };
  return json({ ok: true });
}
