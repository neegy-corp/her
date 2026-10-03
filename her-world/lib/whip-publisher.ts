export function validateWhipEndpoint(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    (u.port && u.port !== "443") ||
    !/^pump-[a-z0-9-]+\.whip\.livekit\.cloud$/.test(u.hostname) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new Error("Use the HTTPS WHIP endpoint supplied by pump.fun.");
  return u;
}
export class WhipPublisher {
  private peer: RTCPeerConnection | null = null;
  private location = "";
  private key = "";
  private bytes = 0;
  private frames = 0;
  private timestamp = 0;
  private operation = 0;
  private pending: AbortController | null = null;
  async start(
    stream: MediaStream,
    endpoint: string,
    key: string,
    signal?: AbortSignal,
  ) {
    if (this.peer) throw new Error("This publisher is already connected.");
    const target = validateWhipEndpoint(endpoint);
    if (!key.trim()) throw new Error("A stream key is required.");
    if (key.trim().length > 4096 || !/^[\x21-\x7e]+$/.test(key.trim()))
      throw new Error("Invalid stream key format.");
    if (signal?.aborted) throw new Error("Broadcast start cancelled.");
    if (
      !stream.getVideoTracks().some((t) => t.readyState === "live") ||
      !stream.getAudioTracks().some((t) => t.readyState === "live")
    )
      throw new Error(
        "The character's video and audio must be ready before going live.",
      );
    const operation = ++this.operation;
    const pending = new AbortController();
    this.pending = pending;
    const abort = signal
      ? AbortSignal.any([signal, pending.signal])
      : pending.signal;
    const assertCurrent = () => {
      if (abort.aborted || operation !== this.operation)
        throw new Error("Broadcast start cancelled.");
    };
    const peer = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
    this.peer = peer;
    this.key = key.trim();
    try {
      for (const track of stream.getTracks())
        peer.addTransceiver(track, {
          direction: "sendonly",
          streams: [stream],
        });
      await peer.setLocalDescription(await peer.createOffer());
      assertCurrent();
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          peer.removeEventListener("icegatheringstatechange", changed);
          abort.removeEventListener("abort", cancelled);
        };
        const cancelled = () => {
          done();
          reject(new Error("Broadcast start cancelled."));
        };
        const changed = () => {
          if (peer.iceGatheringState === "complete") {
            done();
            resolve();
          }
        };
        const timer = setTimeout(() => {
          done();
          reject(new Error("ICE gathering timed out."));
        }, 12000);
        peer.addEventListener("icegatheringstatechange", changed);
        abort.addEventListener("abort", cancelled, { once: true });
        if (abort.aborted) {
          cancelled();
          return;
        }
        changed();
      });
      assertCurrent();
      const response = await fetch(target.href, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/sdp",
        },
        body: peer.localDescription!.sdp,
        redirect: "error",
        signal: AbortSignal.any([abort, AbortSignal.timeout(20000)]),
      });
      if (response.status !== 201)
        throw new Error(`Pump WHIP rejected the stream (${response.status}).`);
      const location = response.headers.get("location");
      if (!location)
        throw new Error(
          "Pump WHIP did not expose its session URL. Check CORS support.",
        );
      const resource = new URL(location, target);
      if (
        resource.origin !== target.origin ||
        resource.username ||
        resource.password ||
        resource.hash
      )
        throw new Error("Unexpected WHIP session origin.");
      if (abort.aborted || operation !== this.operation) {
        await fetch(resource.href, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${key.trim()}` },
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        }).catch(() => undefined);
        throw new Error("Broadcast start cancelled.");
      }
      this.location = resource.href;
      await peer.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
      assertCurrent();
    } catch (error) {
      if (operation === this.operation) await this.stop();
      else peer.close();
      throw error;
    }
  }
  async health() {
    if (!this.peer)
      return {
        state: "stopped",
        kbps: 0,
        advancingFrames: false,
        publicPlaybackVerified: false,
      };
    const peer = this.peer;
    const reports = await peer.getStats();
    if (this.peer !== peer)
      return {
        state: "stopped",
        kbps: 0,
        advancingFrames: false,
        publicPlaybackVerified: false,
      };
    let bytes = 0,
      frames = 0;
    reports.forEach((r) => {
      if (r.type === "outbound-rtp" && !r.isRemote) {
        bytes += r.bytesSent || 0;
        frames += r.framesEncoded || 0;
      }
    });
    const now = Date.now(),
      elapsed = now - this.timestamp;
    const result = {
      state: this.peer.connectionState,
      kbps:
        this.timestamp && elapsed > 0
          ? Math.max(0, ((bytes - this.bytes) * 8) / elapsed)
          : 0,
      advancingFrames: this.timestamp > 0 && frames > this.frames,
      publicPlaybackVerified: false,
    };
    this.bytes = bytes;
    this.frames = frames;
    this.timestamp = now;
    return result;
  }
  async stop() {
    ++this.operation;
    this.pending?.abort();
    this.pending = null;
    this.peer?.close();
    this.peer = null;
    const location = this.location,
      key = this.key;
    this.location = "";
    this.key = "";
    this.bytes = 0;
    this.frames = 0;
    this.timestamp = 0;
    if (location)
      await fetch(location, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${key}` },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
  }
}
