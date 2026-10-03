export function validateWhipEndpoint(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
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
  async start(stream: MediaStream, endpoint: string, key: string) {
    if (this.peer) throw new Error("This publisher is already connected.");
    const target = validateWhipEndpoint(endpoint);
    if (!key.trim()) throw new Error("A stream key is required.");
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
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          peer.removeEventListener("icegatheringstatechange", changed);
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
        changed();
      });
      const response = await fetch(target.href, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/sdp",
        },
        body: peer.localDescription!.sdp,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (response.status !== 201)
        throw new Error(`Pump WHIP rejected the stream (${response.status}).`);
      const location = response.headers.get("location");
      if (!location)
        throw new Error(
          "Pump WHIP did not expose its session URL. Check CORS support.",
        );
      const resource = new URL(location, target);
      if (resource.origin !== target.origin)
        throw new Error("Unexpected WHIP session origin.");
      this.location = resource.href;
      await peer.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
    } catch (error) {
      await this.stop();
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
    const reports = await this.peer.getStats();
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
