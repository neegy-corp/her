import { initialShow, queueChat, type ChatMessage, type ShowPlan, type ShowState } from "./show";
import type { RenderedClip, ShowDriver } from "./show-runner";
import { VIDEO_CREDIT_EXHAUSTED } from "./stream-plans";

/** Rendering never owns the playback lock. Each token has an independent queue and budget. */
export class ContinuousShowRunner {
  state: ShowState = initialShow();
  error = "";
  busy = false;
  rendering = 0;
  submitted = 0;
  replaying = false;
  generationPaused = false;
  private abort = new AbortController();
  private queue: RenderedClip[] = [];
  private replies: RenderedClip[] = [];
  private library: RenderedClip[] = [];
  private replayIndex = 0;
  private claimed = new Set<string>();
  private history: string[] = [];
  private chatSince: number | null = null;
  private nextBackgroundAt = 0;
  constructor(readonly mint: string, readonly plan: ShowPlan, private driver: ShowDriver) {}
  updateVideoAllowance(seconds: number) {
    this.plan.maxGenerations = this.submitted + Math.floor(Math.max(0,seconds)/3);
    // Only resume a request rejected before paid generation, never a failed or
    // ambiguous provider submission. Continuous scenes request 15 seconds.
    if (seconds>=15 && this.generationPaused && this.error===VIDEO_CREDIT_EXHAUSTED) {
      this.generationPaused=false;this.error="";
    }
  }
  get buffered() { return this.queue.length + this.replies.length; }
  get nextClip() { return this.replies[0] || this.queue[0] || this.library[this.replayIndex % this.library.length]; }
  start(clips: RenderedClip[]) {
    if (this.state.phase !== "stopped") throw new Error("This show is already running.");
    const ordered = this.plan.clips.map(c => clips.find(r => r.id === c.id));
    if (!ordered.length || ordered.some(c => !c)) throw new Error("Prepare every scene first.");
    this.abort = new AbortController();
    this.queue = ordered as RenderedClip[];
    this.library = [...this.queue];
    this.history = this.plan.clips.map(c => c.script).slice(-6);
    this.state = { ...initialShow(), phase: "playing" };
    this.replies = []; this.claimed.clear(); this.submitted = 0; this.rendering = 0;
    this.replayIndex = 0;
    this.chatSince = null; this.nextBackgroundAt = 0;
    this.busy = false; this.replaying = false; this.generationPaused = false; this.error = "";
  }
  receive(mint: string, message: ChatMessage, now = Date.now()) {
    if (mint !== this.mint || this.state.phase === "stopped") return;
    this.state = { ...this.state, messages: this.state.messages.filter(m => m.at >= now - 120000 && !this.claimed.has(m.id)) };
    if (!this.state.messages.length) this.chatSince = null;
    this.state = queueChat(this.state, message, now);
    if (this.state.messages.length && this.chatSince === null) this.chatSince = now;
  }
  stop() { this.abort.abort(); this.state = initialShow(); this.queue = []; this.replies = []; }
  private fill(now: number) {
    const signal = this.abort.signal;
    if (signal.aborted || !this.plan.generative || this.generationPaused) return;
    // Batch audience ideas; claim before the paid request so overlapping ticks cannot reuse them.
    if (this.rendering < 2 && this.submitted < this.plan.maxGenerations) {
      const fresh = this.state.messages.filter(m => m.at >= now - 120000 && !this.claimed.has(m.id));
      if (fresh.length && (this.chatSince === null || now < this.chatSince + this.plan.chatWindow * 1000)) return;
      // Keep one slot available for audience ideas, and pace quiet-chat continuations.
      if (!fresh.length && (this.rendering > 0 || now < this.nextBackgroundAt || this.queue.length >= this.plan.clips.length + 2)) return;
      for (const message of fresh) this.claimed.add(message.id);
      this.state = { ...this.state, messages: [] };
      this.chatSince = null;
      this.nextBackgroundAt = now + this.plan.chatWindow * 1000;
      if (this.claimed.size > 1000) this.claimed = new Set([...this.claimed].slice(-500));
      this.submitted++; this.rendering++;
      const sequence = this.submitted;
      const work = Promise.resolve().then(() => {
        if (signal.aborted) throw new Error("Stopped.");
        return this.driver.generate(fresh, signal, { sequence, recentScripts: [...this.history] });
      });
      void work.then(clip => {
        if (signal.aborted) return;
        if (fresh.length) this.replies.push(clip); else this.queue.push(clip);
        this.library.push(clip); this.library = this.library.slice(-48);
        if (clip.script) this.history = [...this.history, clip.script].slice(-6);
        this.state = { ...this.state, generated: this.state.generated + 1 };
      }).catch(error => {
        if (signal.aborted) return;
        this.error = error instanceof Error ? error.message : "Generation failed; playback continues.";
        this.generationPaused = true;
      }).finally(() => { if (!signal.aborted) this.rendering--; });
    }
  }
  async tick(now = Date.now()) {
    if (this.abort.signal.aborted || this.state.phase === "stopped") return;
    this.fill(now);
    if (this.busy) return;
    const signal = this.abort.signal;
    const next = this.replies.shift() || this.queue.shift();
    this.replaying = !next;
    const clip = next || this.library[this.replayIndex++ % this.library.length];
    if (!clip) return;
    this.busy = true;
    this.state = { ...this.state, phase: "playing", activeClip: clip.id };
    try { await this.driver.play(clip, signal); }
    catch (error) { if (!signal.aborted) this.error = error instanceof Error ? error.message : "Playback interrupted; trying the next scene."; }
    finally { if (!signal.aborted) this.busy = false; }
    if (!signal.aborted) this.state = { ...this.state, activeClip: null };
  }
}
