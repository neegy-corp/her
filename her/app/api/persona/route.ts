import { authorize, json, setting, tavusRead } from "@/lib/server-config";
import { characterContext,liveCharacters } from "@/lib/characters";
let cached: { until: number; prompt: string; version: string } | undefined;
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  const character = new URL(request.url).searchParams.get('character') || 'olivia';
  if (!liveCharacters.some(c=>c.id===character)) return json({error:'Invalid character.'},400);
  try {
    if (!cached || Date.now() >= cached.until) {
      const pal = await tavusRead(`pals/${setting("TAVUS_PAL_ID")}`);
      if (typeof pal.system_prompt !== "string" || !pal.system_prompt.includes("HER persona v2")) throw new Error("Unexpected persona configuration.");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pal.system_prompt));
      cached = { until: Date.now() + 15000, prompt: pal.system_prompt, version: Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("") };
    }
    const profile = characterContext(character);
    return json({ prompt: `${cached.prompt}\n\n${profile}`, version: `${cached.version}:${profile}` });
  } catch { return json({ error: "Persona settings temporarily unavailable." }, 503); }
}
