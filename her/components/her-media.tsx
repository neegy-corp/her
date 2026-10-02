"use client";
import { useEffect, useRef } from "react";
export function HerMedia({ video, audio, muted, onBlocked }: { video: MediaStream | null; audio: MediaStream | null; muted: boolean; onBlocked: () => void }) {
  const picture = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const error = useRef(onBlocked); error.current = onBlocked;
  useEffect(() => {
    const element = picture.current;
    if (!element) return;
    // One media element and one stream let the browser synchronize both tracks.
    const combined = stream.current ??= new MediaStream();
    const next = [...(video?.getVideoTracks() ?? []), ...(audio?.getAudioTracks() ?? [])];
    for (const track of combined.getTracks()) if (!next.includes(track)) combined.removeTrack(track);
    for (const track of next) if (!combined.getTracks().includes(track)) combined.addTrack(track);
    if (!next.length) { element.srcObject = null; return; }
    if (element.srcObject !== combined) element.srcObject = combined;
    void element.play().catch(() => error.current());
  }, [video, audio, muted]);
  return <video hidden={!video} ref={picture} className="live-video" autoPlay muted={muted} playsInline aria-label="HER live AI video"/>;
}
