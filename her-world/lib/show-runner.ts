import {
  acknowledgeChat,
  clipEnded,
  generationCompleted,
  generationFailed,
  initialShow,
  nextChat,
  queueChat,
  startShow,
  tickShow,
  type ChatMessage,
  type ShowPlan,
  type ShowState,
} from "./show";
export type RenderedClip = { id: string; url: string };
export type ShowDriver = {
  play: (clip: RenderedClip, signal: AbortSignal) => Promise<void>;
  reply: (message: ChatMessage, signal: AbortSignal) => Promise<RenderedClip>;
  generate: (
    messages: ChatMessage[],
    signal: AbortSignal,
  ) => Promise<RenderedClip>;
};
// One runner per character/mint. No global playlist, chat queue, credentials or generation state.
export class ShowRunner {
  state: ShowState = initialShow();
  busy = false;
  error = "";
  private abort = new AbortController();
  private media = new Map<string, RenderedClip>();
  constructor(
    readonly mint: string,
    readonly plan: ShowPlan,
    private driver: ShowDriver,
  ) {}
  start(clips: RenderedClip[]) {
    if (this.state.phase !== "stopped")
      throw new Error("This show is already running.");
    this.media = new Map(clips.map((clip) => [clip.id, clip]));
    this.state = startShow(this.plan, new Set(this.media.keys()));
    this.abort = new AbortController();
    this.error = "";
  }
  receive(mint: string, message: ChatMessage, now = Date.now()) {
    if (mint === this.mint && this.state.phase !== "stopped")
      this.state = queueChat(this.state, message, now);
  }
  stop() {
    this.abort.abort();
    this.state = initialShow();
  }
  async tick(now = Date.now()) {
    if (
      this.busy ||
      this.abort.signal.aborted ||
      this.state.phase === "stopped"
    )
      return;
    const signal = this.abort.signal;
    this.busy = true;
    try {
      this.state = tickShow(this.state, this.plan, now);
      if (this.state.phase === "playing" && this.state.activeClip) {
        const clip = this.media.get(this.state.activeClip);
        if (!clip) throw new Error("The next video is missing.");
        await this.driver.play(clip, signal);
        if (!signal.aborted)
          this.state = clipEnded(this.state, this.plan, clip.id, Date.now());
      } else if (this.state.phase === "chat") {
        const message = nextChat(this.state, now, false);
        if (message) {
          // Claim before paid work: an ambiguous render failure must not submit the same reply twice.
          this.state = acknowledgeChat(this.state, message.id);
          const clip = await this.driver.reply(message, signal);
          if (!signal.aborted) await this.driver.play(clip, signal);
        }
      } else if (this.state.phase === "generating") {
        const clip = await this.driver.generate(
          [...this.state.messages],
          signal,
        );
        if (!signal.aborted) {
          this.media.set(clip.id, clip);
          this.state = generationCompleted(this.state, clip.id);
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        this.error =
          error instanceof Error ? error.message : "Show driver failed.";
        if (this.state.phase === "playing") this.stop();
        else this.state = generationFailed(this.state);
      }
    } finally {
      this.busy = false;
    }
  }
}
