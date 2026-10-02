export type ChatTurn = { user: string; text: string; at: number };
export class TurnGate {
  phase: "ready" | "waiting" | "speaking" | "settling" = "waiting";
  pending: ChatTurn | null = null;
  changedAt = 0;
  readyAt = 0;
  recent = new Map<string, number>();
  constructor(now = Date.now()) { this.changedAt = now; }
  enqueue(user: string, text: string, now = Date.now()) {
    const clean = text.trim().slice(0, 400);
    if (!clean) return;
    const key = `${user}\n${clean}`;
    for (const [id, at] of this.recent) if (now - at > 30000) this.recent.delete(id);
    if (this.recent.has(key)) return;
    this.recent.set(key, now);
    // Keep only the freshest next question, never a growing reply backlog.
    this.pending = { user: user.slice(0, 40), text: clean, at: now };
  }
  started(now = Date.now()) { this.phase = "speaking"; this.changedAt = now; }
  stopped(now = Date.now()) {
    // A duplicate/late stop must not release a new request awaiting its start.
    if (this.phase !== "speaking") return;
    this.phase = "settling"; this.changedAt = now; this.readyAt = now + 3000;
  }
  take(now = Date.now()) {
    if (this.pending && now - this.pending.at > 20000) this.pending = null;
    if (this.phase === "settling" && now >= this.readyAt) this.phase = "ready";
    if (this.phase !== "ready" || !this.pending) return null;
    const next = this.pending; this.pending = null;
    this.phase = "waiting"; this.changedAt = now;
    return next;
  }
  clear() { this.pending = null; }
}
export type HistoryTurn = { role: "viewer" | "host"; user?: string; character?: string; text: string };
export function cleanHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-20).flatMap(item => {
    if (!item || !["viewer", "host"].includes(item.role) || typeof item.text !== "string" || !item.text.trim()) return [];
    return [{ role: item.role as "viewer" | "host", text: item.text.slice(0, 700), ...(item.role === "host" && ['olivia','maya','ivy'].includes(item.character) ? {character:item.character} : {}), ...(item.role === "viewer" && typeof item.user === "string" ? { user: item.user.slice(0, 40) } : {}) }];
  });
}
