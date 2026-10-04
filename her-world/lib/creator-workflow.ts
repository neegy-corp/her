import type { CharacterDraft } from "./launchpad";
import type { ShowClip, ShowPlan } from "./show";

export const emptyScene = (clip: ShowClip) => !clip.script.trim() && !clip.direction.trim();

export function addGeneratedScene(show: ShowPlan, clip: ShowClip): ShowPlan {
  const empty = show.clips.findIndex(emptyScene);
  if (empty < 0 && show.clips.length >= 48) throw new Error("This show already has 48 scenes.");
  return { ...show, clips: empty < 0 ? [...show.clips, clip] : show.clips.map((current, index) =>
    index === empty ? { ...clip, id: current.id } : current) };
}

// A studio consumes the cloud manifest, so persist device edits before navigating.
export async function saveStudioDraft(draft: CharacterDraft, send: typeof fetch = fetch) {
  const response = await send("/api/launchpad?action=save", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  });
  if (!response.ok) {
    const result = await response.json() as { error?: string };
    throw new Error(result.error || "Could not save the show. Stay here and try Sync again.");
  }
  return `/studio/${encodeURIComponent(draft.id)}`;
}
