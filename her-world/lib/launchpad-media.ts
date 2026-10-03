import { createHash } from "node:crypto";
import { createFalClient } from "@fal-ai/client";
import { setting } from "./server";
import type { ShowClip } from "./show";
export const KLING = "fal-ai/kling-video/v3/pro/image-to-video";
export const falClient = () =>
  createFalClient({ credentials: setting("FAL_KEY") });
export const digest = (input: string | Buffer) =>
  createHash("sha256").update(input).digest("hex");
export function imageType(bytes: Uint8Array) {
  if (bytes.length < 12) return null;
  if (
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return { ext: "png", mime: "image/png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { ext: "jpg", mime: "image/jpeg" };
  if (
    Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  return null;
}
export function fundedCreator(owner: string) {
  if (
    !setting("HER_LAUNCHPAD_CREATOR_WALLETS")
      .split(",")
      .map((s) => s.trim())
      .includes(owner)
  )
    throw new Error(
      "Generation credits are not active for this wallet. Your draft is preserved.",
    );
}
export async function tavusVideo(path: string, body?: unknown) {
  const r = await fetch(`https://tavusapi.com/v2/videos${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "x-api-key": setting("TAVUS_API_KEY"),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok)
    throw new Error(
      "The video provider is unavailable. Check the saved render before retrying.",
    );
  return r.json() as Promise<{
    video_id?: string;
    status?: string;
    download_url?: string;
    stream_url?: string;
  }>;
}
export function performanceInput(clip: ShowClip, images: string[]) {
  return {
    start_image_url: images[0],
    prompt: `One fictional adult character. Preserve their identity, wardrobe and setting from the reference. Creative direction: ${JSON.stringify(clip.direction)}. ${clip.script ? `Dialogue: ${JSON.stringify(clip.script)}.` : ""} No captions, subtitles or logos.`,
    duration: String(clip.duration) as "5",
    generate_audio: true,
    ...(images.length > 1
      ? {
          elements: [
            {
              frontal_image_url: images[0],
              reference_image_urls: images.slice(1),
            },
          ],
        }
      : {}),
  };
}
export function safeVideoUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
