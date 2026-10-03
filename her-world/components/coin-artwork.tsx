"use client";
import { useEffect, useState } from "react";
import type { CharacterDraft } from "@/lib/launchpad";
import { IMAGE_MAX_BYTES } from "@/lib/acp-config";

export default function CoinArtwork({
  draft,
  onChange,
}: {
  draft: CharacterDraft;
  onChange: (patch: Partial<CharacterDraft>) => void;
}) {
  return (
    <section className="lp-coin-art" aria-label="Separate coin artwork">
      <h4>The coin has its own look.</h4>
      <p>
        These images are only for the coin. They never replace your character’s
        face or reference photos.
      </p>
      <div className="lp-art-grid">
        <ArtworkSlot
          key={`${draft.id}-pfp`}
          purpose="pfp"
          draft={draft}
          onChange={onChange}
        />
        <ArtworkSlot
          key={`${draft.id}-banner`}
          purpose="banner"
          draft={draft}
          onChange={onChange}
        />
      </div>
    </section>
  );
}
function ArtworkSlot({
  purpose,
  draft,
  onChange,
}: {
  purpose: "pfp" | "banner";
  draft: CharacterDraft;
  onChange: (patch: Partial<CharacterDraft>) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const field = purpose === "pfp" ? "coinPfp" : "coinBanner";
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const save = await fetch("/api/launchpad?action=save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!save.ok)
        throw new Error(
          ((await save.json()) as { error?: string }).error ||
            "Connect and verify your wallet first.",
        );
      const form = new FormData();
      form.set("id", draft.id);
      form.set("purpose", purpose);
      form.set("image", file);
      const response = await fetch("/api/launchpad/assets", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as { error?: string; url: string };
      if (!response.ok) throw new Error(result.error || "Upload unavailable.");
      const patch = { [field]: result.url };
      onChange(patch);
      const persisted = await fetch("/api/launchpad?action=save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: { ...draft, ...patch } }),
      });
      if (!persisted.ok)
        throw new Error(
          "Image uploaded. Use Save to wallet to finish saving the artwork.",
        );
      setMessage("Uploaded and saved to your wallet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`lp-art-slot ${purpose}`}>
      <strong>{purpose === "pfp" ? "Coin PFP" : "Coin banner"}</strong>
      <div className="lp-art-preview">
        {preview || draft[field] ? (
          <img src={preview || draft[field]} alt={`${purpose} preview`} />
        ) : (
          <span>{purpose === "pfp" ? "Square artwork" : "Wide artwork"}</span>
        )}
      </div>
      <label className="lp-secondary">
        Choose {purpose}
        <input
          aria-label={`Choose coin ${purpose}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (!next) return;
            if (
              next.size > IMAGE_MAX_BYTES ||
              !["image/png", "image/jpeg", "image/webp"].includes(next.type)
            ) {
              setMessage("Choose a PNG, JPEG or WebP under 4 MB.");
              return;
            }
            setFile(next);
            setMessage("Local preview. Upload to save this artwork.");
          }}
        />
      </label>
      <button
        className="lp-secondary"
        disabled={!file || busy}
        onClick={() => void upload()}
      >
        {busy ? "Uploading…" : "Upload artwork"}
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
