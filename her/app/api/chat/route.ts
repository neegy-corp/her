import { authorize, json, setting } from "@/lib/server-config";
import { normalizeFeed, parsePumpUrl } from "@/lib/her";
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  const input = new URL(request.url); const mint = parsePumpUrl(input.searchParams.get("stream") || "");
  if (!mint) return json({ error: "Save a valid pump.fun token URL first." }, 400);
  const configured = setting("PUMP_CHAT_FEED_URL");
  if (!configured) return json({ error: "No pump.fun chat adapter is configured. The demo feed is separate from real chat." }, 503);
  try {
    const url = new URL(configured);
    const localRelay = import.meta.env.DEV && url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "4501" && !url.username && !url.password;
    if (url.protocol !== "https:" && !localRelay) return json({ error: "The chat adapter must use HTTPS." }, 503);
    url.searchParams.set("mint", mint);
    const after = Number(input.searchParams.get("after")); if (Number.isFinite(after) && after > 0) url.searchParams.set("after", String(after));
    const token = setting("PUMP_CHAT_FEED_TOKEN");
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Chat relay HTTP ${response.status}`);
    const text = await response.text(); if (text.length > 150000) throw new Error();
    const body = JSON.parse(text); return json({ messages: normalizeFeed(body.messages), receivedAt: Date.now() });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("HER chat adapter:", error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "[relay]") : "Unknown failure");
    return json({ error: "The chat source is unavailable. HER will wait rather than replay old messages." }, 502);
  }
}
