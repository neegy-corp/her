import { authorize, getSession, json, sessionCookie, setting, studioUser, tavus, tavusRead } from "@/lib/server-config";
import { HER_PERSONA, HER_GREETING } from "@/lib/her";
import { faceReadiness } from "@/lib/her-production";
export async function POST(request: Request) {
  const denied = await authorize(request, true); if (denied) return denied;
  if (!setting("TAVUS_API_KEY") || !setting("TAVUS_FACE_ID") || !setting("TAVUS_PAL_ID")) return json({ error: "Live video isn't connected yet. Configure your Tavus key, female face, and HER persona in the server environment." }, 503);
  if (await getSession(request)) return json({ error: "An active session already exists. End it before starting another." }, 409);
  try {
    const faceId = setting("TAVUS_FACE_ID"), palId = setting("TAVUS_PAL_ID");
    if (!/^r[a-zA-Z0-9_-]+$/.test(faceId) || !/^p[a-zA-Z0-9_-]+$/.test(palId)) return json({ error: "Invalid Tavus face or PAL ID in server configuration." }, 503);
    const [face, pal] = await Promise.all([tavusRead(`faces/${faceId}`), tavusRead(`pals/${palId}`)]);
    const quality = faceReadiness(face);
    if (!quality.ready) return json({ error: quality.reason }, 409);
    if (typeof pal.system_prompt !== "string" || !pal.system_prompt.includes("HER persona v2")) return json({ error: "Install HER's natural-speech persona with scripts/setup-her.mjs update-pal before starting. The live PAL needs the same profanity and delivery settings as the studio." }, 409);
    const response = await tavus("conversations", { face_id: setting("TAVUS_FACE_ID"), pal_id: setting("TAVUS_PAL_ID"), conversation_name: "HER studio", conversational_context: HER_PERSONA, custom_greeting: HER_GREETING, require_auth: true, max_participants: 2, properties: { max_call_duration: 600, participant_left_timeout: 15, enable_closed_captions: true } });
    const result = await response.json() as Record<string, string>;
    if (!result.conversation_id || !result.conversation_url || !result.meeting_token) throw new Error("Tavus returned an incomplete session.");
    const user = await studioUser();
    return json(result, 200, { "Set-Cookie": await sessionCookie(result.conversation_id, user!.userId, new URL(request.url).protocol === "https:") });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Could not connect to Tavus." }, 502); }
}
export async function DELETE(request: Request) {
  const denied = await authorize(request, true); if (denied) return denied;
  const id = await getSession(request);
  try { if (id) await tavus(`conversations/${id}/end`); return json({ ended: true }, 200, { "Set-Cookie": "her-session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" }); }
  catch { return json({ error: "Could not confirm the remote session ended. Retry ending it; the 10-minute limit remains active." }, 502); }
}
