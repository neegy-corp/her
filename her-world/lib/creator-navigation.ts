import { localDraftSchema, type CharacterDraft } from "./launchpad";

export const DRAFT_STORE = "her-launchpad-drafts-v1";
export const creatorSteps = ["character", "personality", "scene", "show", "artwork", "launch"] as const;
export type CreatorStep = typeof creatorSteps[number];
export function creatorPath(id: string, step: CreatorStep = "character") {
  return `/create/${encodeURIComponent(id)}/${step}`;
}
export function readLocalDrafts(raw: string | null): CharacterDraft[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(value => {
      const result = localDraftSchema.safeParse(value);
      return result.success ? [result.data as CharacterDraft] : [];
    }).slice(0, 12);
  } catch { return []; }
}
export function keepDraft(drafts: CharacterDraft[], draft: CharacterDraft) {
  return [draft, ...drafts.filter(d => d.id !== draft.id)].slice(0, 12);
}
