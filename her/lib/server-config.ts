import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export function setting(key: string): string { return String((env as unknown as Record<string, unknown>)[key] || process.env[key] || ""); }
export async function studioUser() {
  const authenticated = await getChatGPTUser();
  if (authenticated) return authenticated;
  // Compiled away for the production Worker; the bundled preview is loopback-only.
  if (import.meta.env.DEV) return { userId: "local-director", email: "local@localhost", displayName: "Director", fullName: null };
  return null;
}
export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
export async function authorize(request: Request, mutation = false) {
  if (mutation && request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Request origin not allowed." }, 403);
  if (!(await studioUser())) return json({ error: "Sign in to your private HER studio." }, 401);
  return null;
}
export async function tavus(path: string, body?: unknown) {
  const response = await fetch(`https://tavusapi.com/v2/${path}`, { method: "POST", headers: { "x-api-key": setting("TAVUS_API_KEY"), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Tavus returned ${response.status}. Check your account configuration and available minutes.`);
  return response;
}
export async function tavusRead(path: string) {
  const response = await fetch(`https://tavusapi.com/v2/${path}`, { headers: { "x-api-key": setting("TAVUS_API_KEY") }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Tavus configuration check returned ${response.status}. Check your face, persona, and API key.`);
  return response.json() as Promise<Record<string, unknown>>;
}
async function signature(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(setting("TAVUS_API_KEY")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");
}
export async function sessionCookie(id: string, userId: string, secure: boolean) {
  const value = `${id}.${Date.now() + 660000}.${userId}`;
  return `her-session=${encodeURIComponent(value + "." + await signature(value))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=660${secure ? "; Secure" : ""}`;
}
export async function getSession(request: Request): Promise<string | null> {
  try {
    const raw = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("her-session="))?.slice(12);
    if (!raw) return null;
    const parts = decodeURIComponent(raw).split("."); const sig = parts.pop(); const user = await studioUser();
    if (parts.length !== 3 || !user || user.userId !== parts[2] || Number(parts[1]) <= Date.now() || !/^c[a-zA-Z0-9_-]+$/.test(parts[0])) return null;
    if (sig !== await signature(parts.join("."))) return null;
    return parts[0];
  } catch { return null; }
}
