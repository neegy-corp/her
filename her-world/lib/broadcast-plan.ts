import { validateWhipEndpoint } from "./whip-publisher";
import type { ShowPlan } from "./show";
import { preparedSeconds } from "./show";
import type { RenderedClip } from "./show-runner";
export type StudioManifest = {
  name: string;
  mint: string | null;
  ready: boolean;
  show: ShowPlan;
  clips: RenderedClip[];
};
export function broadcastPreflight(
  manifest: StudioManifest | null,
  endpoint: string,
  key: string,
) {
  if (!manifest)
    throw new Error(
      "Connect the wallet that owns this character and load its show.",
    );
  if (!manifest.mint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(manifest.mint))
    throw new Error("Confirm this character’s coin launch before going live.");
  if (
    !manifest.ready ||
    !manifest.show.clips.length ||
    !manifest.show.clips.every((c) =>
      manifest.clips.some((r) => r.id === c.id && validMedia(r.url)),
    )
  )
    throw new Error(
      "Generate every current scene, then refresh the show before going live.",
    );
  validateWhipEndpoint(endpoint.trim());
  if (manifest.show.continuous && preparedSeconds(manifest.show) < (manifest.show.bufferMinutes || 5) * 60)
    throw new Error(`Prepare ${manifest.show.bufferMinutes || 5} minutes of fresh video before going live.`);
  if (!key.trim()) throw new Error("Enter the stream key for this coin.");
  if (key.trim().length > 4096 || !/^[\x21-\x7e]+$/.test(key.trim()))
    throw new Error("The stream key has an invalid format.");
  return {
    mint: manifest.mint,
    endpoint: endpoint.trim(),
    key: key.trim(),
    pumpUrl: `https://pump.fun/coin/${manifest.mint}`,
  };
}
function validMedia(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
