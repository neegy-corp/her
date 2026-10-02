import { authorize, json, setting } from "@/lib/server-config";
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  return json({ video: Boolean(setting("TAVUS_API_KEY") && setting("TAVUS_FACE_ID") && setting("TAVUS_PAL_ID")), chat: Boolean(setting("PUMP_CHAT_FEED_URL")), maxSessionSeconds: 600 });
}
