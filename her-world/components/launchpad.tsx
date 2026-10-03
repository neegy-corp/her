"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  LoaderCircle,
  Mic2,
  Monitor,
  Palette,
  Radio,
  Save,
  Sparkles,
  WandSparkles,
  X,
  Volume2,
  Wallet,
  CircleHelp,
  Layers3,
} from "lucide-react";
import { WalletRoot, useWallet } from "./wallet";
import { shortWallet } from "@/lib/catalog";
import {
  newDraft,
  scenes,
  voices,
  exportDraft,
  localDraftSchema,
  visualFingerprint,
  offlineStatus,
  samplePortrait,
  type CharacterDraft,
  type LaunchStatus,
} from "@/lib/launchpad";
import "./launchpad.css";
import ShowEditor from "./show-editor";
import CoinArtwork from "./coin-artwork";
import { ACP_FEE_WALLET, ACP_QUOTE_MINT } from "@/lib/acp-config";

const STORE = "her-launchpad-drafts-v1";
type Step = "character" | "personality" | "scene" | "show" | "launch";
const steps = [
  { id: "character", label: "Character", icon: Palette },
  { id: "personality", label: "Voice", icon: Mic2 },
  { id: "scene", label: "The scene", icon: Monitor },
  { id: "show", label: "The show", icon: Layers3 },
  { id: "launch", label: "Launch", icon: Radio },
] as const;
type CloudDraft = CharacterDraft & {
  faceStatus?: string;
  mint?: string;
  signature?: string;
};
async function request<T>(action: string, body?: unknown): Promise<T> {
  const r = await fetch(
    `/api/launchpad?action=${action}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(data.error || "Could not complete the request.");
  return data;
}
export default function Launchpad() {
  return (
    <WalletRoot>
      <Home />
    </WalletRoot>
  );
}
function Home() {
  const { viewer, connect, signTransaction, disconnect } = useWallet();
  const [draft, setDraft] = useState<CharacterDraft | null>(null),
    [saved, setSaved] = useState<CharacterDraft[]>([]),
    [step, setStep] = useState<Step>("character");
  const [status, setStatus] = useState<LaunchStatus>(offlineStatus),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [localSaved, setLocalSaved] = useState(false);
  const [faceStatus, setFaceStatus] = useState("draft"),
    [coin, setCoin] = useState<{
      mint?: string;
      signature?: string;
      status?: string;
    }>({});
  const [review, setReview] = useState<{
      unsignedTransaction: string;
      mint: string;
      expires: number;
    } | null>(null),
    [confirm, setConfirm] = useState(false),
    [showHelp, setShowHelp] = useState(false),
    [filter, setFilter] = useState("all");
  const [activeVoice, setActiveVoice] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null),
    studio = useRef<HTMLElement | null>(null),
    modal = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(STORE) || "[]");
      const valid = Array.isArray(data)
        ? data
            .map((x) => localDraftSchema.safeParse(x))
            .filter((x) => x.success)
            .map((x) => x.data as CharacterDraft)
            .slice(0, 12)
        : [];
      setSaved(valid);
      setDraft(valid[0] || newDraft());
    } catch {
      setDraft(newDraft());
    }
    setLoaded(true);
    request<LaunchStatus>("status")
      .then(setStatus)
      .catch(() =>
        setStatus({
          ...offlineStatus,
          message:
            "Launch services are unavailable. Local editing still works.",
        }),
      );
    return () => audio.current?.pause();
  }, []);
  useEffect(() => {
    if (!loaded || !draft) return;
    setLocalSaved(false);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORE,
          JSON.stringify(
            [draft, ...saved.filter((x) => x.id !== draft.id)].slice(0, 12),
          ),
        );
        setLocalSaved(true);
      } catch {
        setError("Browser storage is full. Download your draft to keep it.");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, loaded, saved]);
  useEffect(() => {
    if (review) modal.current?.showModal();
    else modal.current?.close();
  }, [review]);
  function edit(patch: Partial<CharacterDraft>) {
    setDraft((d) => (d ? { ...d, ...patch, updatedAt: Date.now() } : d));
    setNotice("");
    setError("");
    setReview(null);
  }
  function begin(preset = "marcel") {
    if (draft)
      setSaved((p) =>
        [draft, ...p.filter((x) => x.id !== draft.id)].slice(0, 12),
      );
    const d = newDraft(preset);
    if (preset === "blank")
      Object.assign(d, {
        name: "",
        symbol: "",
        description: "",
        appearance: "",
        personality: "",
      });
    setDraft(d);
    setFaceStatus("draft");
    setCoin({});
    setStep("character");
    studio.current?.scrollIntoView({ behavior: "smooth" });
  }
  async function task(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy("");
    }
  }
  async function saveCloud() {
    if (!draft) return;
    if (!viewer.wallet) {
      connect();
      return;
    }
    await task("Saving", async () => {
      await request("save", { draft });
      setNotice("Saved to your wallet.");
    });
  }
  async function generate() {
    if (!draft) return;
    if (!viewer.wallet) {
      connect();
      return;
    }
    await task("Generating portrait", async () => {
      await request("save", { draft });
      const image = await request<{ image: string; imageFingerprint: string }>(
        "generate",
        { id: draft.id },
      );
      setDraft((d) => (d?.id === draft.id ? { ...d, ...image } : d));
      setNotice(
        "Portrait generated. Review it before training your live character.",
      );
    });
  }
  async function train() {
    if (!draft) return;
    await task("Starting face training", async () => {
      await request("save", { draft });
      const result = await request<{ status: string }>("train", {
        id: draft.id,
      });
      setFaceStatus(result.status);
      setNotice("Training submitted. Check status before launching.");
    });
  }
  async function checkFace() {
    if (!draft) return;
    await task("Checking face", async () => {
      const r = await request<{ status: string; previewReady?: boolean }>(
        `face&id=${draft.id}`,
      );
      setFaceStatus(r.status);
      setNotice(
        r.previewReady && r.status !== "ready"
          ? "Preview ready; full face is still training."
          : `Face status: ${r.status}.`,
      );
    });
  }
  function download() {
    if (!draft) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exportDraft(draft), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `acp-${draft.symbol.toLowerCase() || "untitled"}-character.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Character package downloaded. No coin or stream was created.");
  }
  function playVoice(id: string) {
    audio.current?.pause();
    if (activeVoice === id) {
      setActiveVoice("");
      return;
    }
    const player = new Audio(voices.find((v) => v.id === id)!.sample);
    audio.current = player;
    player.onended = () => setActiveVoice("");
    player.onerror = () => {
      setActiveVoice("");
      setError("Voice preview unavailable. Try another sample.");
    };
    setActiveVoice(id);
    void player.play().catch(() => {
      setActiveVoice("");
      setError("Browser blocked the audio preview. Try again.");
    });
  }
  async function restoreCloud() {
    if (!viewer.wallet) {
      connect();
      return;
    }
    await task("Loading characters", async () => {
      const r = await request<{ drafts: CloudDraft[] }>("drafts");
      if (!r.drafts.length) {
        setNotice(
          "No wallet-saved characters yet. Save your first draft below.",
        );
        return;
      }
      setSaved(r.drafts);
      openDraft(r.drafts[0]);
      setNotice("Wallet drafts loaded.");
    });
  }
  function openDraft(d: CloudDraft) {
    setDraft(d);
    setFaceStatus(d.faceStatus || "draft");
    setCoin(
      d.mint
        ? { mint: d.mint, status: "confirmed", signature: d.signature }
        : {},
    );
    setStep("character");
    studio.current?.scrollIntoView({ behavior: "smooth" });
  }
  async function prepare() {
    if (!draft) return;
    await task("Preparing launch", async () => {
      if (faceStatus === "draft") await request("save", { draft });
      setReview(await request("prepare-coin", { id: draft.id }));
      setConfirm(false);
    });
  }
  async function launch() {
    if (!draft || !review) return;
    await task("Waiting for wallet", async () => {
      const signedTransaction = await signTransaction(
        review.unsignedTransaction,
      );
      setCoin(
        await request("confirm-coin", { id: draft.id, signedTransaction }),
      );
      setReview(null);
      setNotice("Submitted. Check confirmation before making another launch.");
    });
  }
  async function checkCoin() {
    if (!draft) return;
    await task("Checking confirmation", async () => {
      const r = await request<typeof coin>(`coin&id=${draft.id}`);
      setCoin(r);
      setNotice(
        r.status === "confirmed"
          ? "Coin confirmed. Broadcast setup is separate."
          : "Launch status: " + r.status,
      );
    });
  }
  const visualCurrent =
    !!draft?.image && draft.imageFingerprint === visualFingerprint(draft);
  return (
    <main className="lp">
      <header className="lp-header">
        <a className="lp-logo" href="/" aria-label="ACP launchpad">
          acp<span>®</span>
          <small>ARTIFICIAL CHARACTER PROTOCOL</small>
        </a>
        <nav aria-label="Main navigation">
          <a href="#studio">Create</a>
          <a href="#characters">Discover</a>
          <a href="/collective">
            HER collective <ArrowUpRight size={13} />
          </a>
        </nav>
        <button
          className="lp-wallet"
          onClick={() => (viewer.wallet ? void disconnect() : connect())}
        >
          <Wallet size={15} />
          {viewer.wallet ? shortWallet(viewer.wallet) : "Connect wallet"}
        </button>
      </header>
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <div className="lp-kicker">
            <span /> A LITTLE HUMAN. ENTIRELY YOURS.
          </div>
          <h1>
            The internet needs
            <br />
            <em>more characters.</em>
          </h1>
          <p>
            Upload a face. Write the show.
            <br />
            Give chat a say in what happens next.
          </p>
          <div className="lp-hero-actions">
            <a className="lp-primary" href="#studio">
              Create a character <ArrowUpRight size={19} />
            </a>
            <a className="lp-text-link" href="#how">
              How it works <ArrowRight size={15} />
            </a>
          </div>
          <div className="lp-hero-bottom">
            <span>01 / THE CHARACTER</span>
            <span>02 / THE SHOW</span>
            <span>03 / THE LAUNCH</span>
          </div>
        </div>
        <div className="lp-hero-art">
          <img
            src="/images/launchpad-marcel.png"
            alt="Marcel, an original fictional AI radio host"
          />
          <span className="lp-art-label">
            <span /> CHARACTER CONCEPT
          </span>
          <div className="lp-art-caption">
            <div>
              <small>MEET YOUR NEXT ALTER EGO</small>
              <strong>
                Someone only
                <br />
                <i>you could imagine.</i>
              </strong>
            </div>
            <span className="lp-art-arrow">↗</span>
          </div>
        </div>
      </section>
      <div className="lp-ticker">
        <span>ONE FACE. A WHOLE PERSONALITY.</span>
        <span>✳</span>
        <span>PROMPT YOUR WORLD</span>
        <span>✳</span>
        <span>BUILT FOR CONVERSATION</span>
        <span>✳</span>
        <span>YOUR CHARACTER. YOUR COIN.</span>
      </div>
      <section className="lp-studio" id="studio" ref={studio}>
        <div className="lp-section-top">
          <div>
            <span className="lp-kicker">THE CHARACTER STUDIO / 001</span>
            <h2>
              Make someone <em>memorable.</em>
            </h2>
          </div>
          <div className="lp-save-status">
            <span className={localSaved ? "saved" : ""} />
            {localSaved
              ? "Draft saved on this device"
              : "Preparing your workspace"}
          </div>
        </div>
        <div className="lp-workspace">
          <div className="lp-editor">
            <div
              className="lp-tabs"
              role="tablist"
              aria-label="Character editor"
            >
              {steps.map((s) => (
                <button
                  role="tab"
                  id={`tab-${s.id}`}
                  aria-controls="studio-panel"
                  aria-selected={step === s.id}
                  key={s.id}
                  onClick={() => setStep(s.id)}
                >
                  <s.icon size={17} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            {!draft ? (
              <div className="lp-form">Opening your studio…</div>
            ) : (
              <div
                className="lp-form"
                id="studio-panel"
                role="tabpanel"
                aria-labelledby={`tab-${step}`}
              >
                {step === "character" && (
                  <>
                    <FormTitle
                      kicker="START WITH A SPARK"
                      title="Who are we meeting?"
                    />
                    <div className="lp-field-row">
                      <Field
                        label="Character name"
                        value={draft.name}
                        maxLength={32}
                        onChange={(v) => edit({ name: v })}
                        placeholder="Give them a name"
                      />
                      <Field
                        label="Coin ticker"
                        value={draft.symbol}
                        maxLength={10}
                        onChange={(v) =>
                          edit({
                            symbol: v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                          })
                        }
                        prefix="$"
                      />
                    </div>
                    <Field
                      label="The one-line introduction"
                      value={draft.description}
                      maxLength={500}
                      onChange={(v) => edit({ description: v })}
                    />
                    <Field
                      label="Describe their appearance"
                      value={draft.appearance}
                      maxLength={1400}
                      onChange={(v) => edit({ appearance: v })}
                      multiline
                      rows={5}
                      hint="Be specific: age, hair, wardrobe, expression. Original adult characters work best."
                    />
                    <label className="lp-check">
                      <input
                        type="checkbox"
                        checked={draft.rightsConfirmed}
                        onChange={(e) =>
                          edit({ rightsConfirmed: e.target.checked })
                        }
                      />
                      <span>
                        This is an original character, or I have permission to
                        use this likeness.
                      </span>
                    </label>
                    <button
                      className="lp-primary lp-wide"
                      disabled={
                        !!busy || !draft.rightsConfirmed || !status.generation
                      }
                      onClick={() => void generate()}
                    >
                      {busy === "Generating portrait" ? (
                        <LoaderCircle className="lp-spin" size={17} />
                      ) : (
                        <WandSparkles size={17} />
                      )}{" "}
                      {busy === "Generating portrait"
                        ? "Creating your portrait…"
                        : "Generate character portrait"}
                    </button>
                    {!status.generation && (
                      <p className="lp-field-note">
                        Generation is opening soon. Design, save and export your
                        character now.
                      </p>
                    )}
                    <button
                      className="lp-next"
                      onClick={() => setStep("personality")}
                    >
                      Next: personality & voice <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {step === "personality" && (
                  <>
                    <FormTitle
                      kicker="A FACE IS ONLY THE START"
                      title="Give them a point of view."
                    />
                    <Field
                      label="Personality & conversation style"
                      value={draft.personality}
                      maxLength={2000}
                      onChange={(v) => edit({ personality: v })}
                      multiline
                      rows={5}
                      hint="What do they love? How do they joke? How should they respond to chat?"
                    />
                    <label className="lp-field-label">
                      Choose a voice <span>Listen before you choose</span>
                    </label>
                    <div className="lp-voices">
                      {voices.map((v) => (
                        <div
                          key={v.id}
                          className={draft.voice === v.id ? "chosen" : ""}
                        >
                          <button
                            className="lp-voice-select"
                            aria-pressed={draft.voice === v.id}
                            onClick={() => edit({ voice: v.id })}
                          >
                            <span>{v.name}</span>
                            <small>{v.style}</small>
                            {draft.voice === v.id && <Check size={14} />}
                          </button>
                          <button
                            className="lp-voice-play"
                            aria-label={`${activeVoice === v.id ? "Stop" : "Play"} ${v.name} voice sample`}
                            onClick={() => playVoice(v.id)}
                          >
                            {activeVoice === v.id ? "■" : <Volume2 size={15} />}
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="lp-field-note">
                      Tavus stock voice samples. Your live face uses the voice
                      selected here.
                    </p>
                    <button
                      className="lp-next"
                      onClick={() => setStep("scene")}
                    >
                      Next: set the scene <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {step === "scene" && (
                  <>
                    <FormTitle
                      kicker="EVERY CHARACTER HAS A WORLD"
                      title="Where do they belong?"
                    />
                    <div className="lp-scenes">
                      {scenes.map((s) => (
                        <button
                          key={s.id}
                          aria-pressed={draft.scene === s.id}
                          onClick={() =>
                            edit({ scene: s.id, background: s.prompt })
                          }
                        >
                          <span style={{ background: s.color }}>
                            <span className={`lp-scene-drawing ${s.id}`} />
                          </span>
                          <strong>{s.name}</strong>
                          {draft.scene === s.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                    <Field
                      label="Prompt the background"
                      value={draft.background}
                      maxLength={1000}
                      onChange={(v) => edit({ background: v, scene: "custom" })}
                      multiline
                      rows={5}
                      hint="Describe the room, lighting, time of day and mood. The generated portrait includes this setting."
                    />
                    <button
                      className="lp-primary lp-wide"
                      onClick={() => void generate()}
                      disabled={
                        !!busy || !draft.rightsConfirmed || !status.generation
                      }
                    >
                      <Sparkles size={17} />
                      {busy === "Generating portrait"
                        ? "Generating your scene…"
                        : "Generate portrait in this scene"}
                    </button>
                    <p className="lp-field-note">
                      Scene tiles are mood sketches. The portrait changes after
                      a successful generation.
                    </p>
                    <button className="lp-next" onClick={() => setStep("show")}>
                      Next: write the show <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {step === "show" && (
                  <ShowEditor
                    key={draft.id}
                    draft={draft}
                    onChange={(show) => edit({ show })}
                    onNotice={setNotice}
                    onImage={(image) => edit(image)}
                  />
                )}
                {step === "launch" && (
                  <>
                    <FormTitle
                      kicker="FROM AN IDEA TO A PRESENCE"
                      title="Your character, out in the world."
                    />
                    <div className="lp-launch-summary">
                      <img
                        src={draft.image || samplePortrait(draft)}
                        alt="Character preview"
                      />
                      <div>
                        <h4>{draft.name || "Untitled character"}</h4>
                        <p>
                          ${draft.symbol || "TICKER"} ·{" "}
                          {voices.find((v) => v.id === draft.voice)?.name}
                        </p>
                        <small>
                          {draft.image
                            ? "Generated portrait"
                            : "Example artwork — generate your own"}
                        </small>
                      </div>
                    </div>
                    <CoinArtwork draft={draft} onChange={edit} />
                    <a
                      className="lp-text-link"
                      href={`/studio/${draft.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open this character’s broadcast studio ↗
                    </a>
                    <div className="lp-pair-info">
                      <strong>NVDAX pair · 1% ACP creator fee</strong>
                      <p>
                        Trades use NVIDIA xStock (NVDAX). The 1% creator fee
                        accrues to ACP’s Pump creator vault in NVDAX; Pump
                        protocol fees are additional. The platform wallet claims
                        the accrued fees.
                      </p>
                      <a
                        href="https://pump.fun/docs/custom-pairs"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Pair eligibility and issuer terms ↗
                      </a>
                    </div>
                    <ol className="lp-launch-checklist">
                      <LaunchStep
                        number="01"
                        title="Approve the character"
                        text={
                          visualCurrent
                            ? "Generated image matches your appearance and scene."
                            : "Generate a portrait from your final appearance and scene prompts."
                        }
                        status={visualCurrent ? "Ready" : "Draft"}
                      />
                      <LaunchStep
                        number="02"
                        title="Train the live face"
                        text={
                          faceStatus === "draft"
                            ? "Your portrait and voice become a talking character."
                            : `Training status: ${faceStatus}`
                        }
                        status={
                          faceStatus === "ready"
                            ? "Ready"
                            : status.faces
                              ? "Available"
                              : "Soon"
                        }
                      />
                      <LaunchStep
                        number="03"
                        title="Create the coin on pump.fun"
                        text="NVDAX pair. Review the 1% creator fee and approve in your wallet. No initial buy."
                        status={
                          coin.status === "confirmed"
                            ? "Created"
                            : status.coinCreation
                              ? "Available"
                              : "Soon"
                        }
                      />
                      <LaunchStep
                        number="04"
                        title="Start the live character"
                        text="A dedicated broadcaster and pump.fun stream access are required."
                        status="Not connected"
                      />
                    </ol>
                    <div className="lp-launch-buttons">
                      <button
                        className="lp-secondary"
                        disabled={
                          !!busy ||
                          !visualCurrent ||
                          !status.faces ||
                          faceStatus !== "draft"
                        }
                        onClick={() => void train()}
                      >
                        Train live face
                      </button>
                      {faceStatus !== "draft" && (
                        <button
                          className="lp-secondary"
                          disabled={!!busy}
                          onClick={() => void checkFace()}
                        >
                          Check training
                        </button>
                      )}
                      <button
                        className="lp-primary"
                        disabled={
                          !!busy ||
                          !status.coinCreation ||
                          !draft.coinPfp ||
                          !!coin.signature ||
                          !!coin.mint
                        }
                        onClick={() => void prepare()}
                      >
                        Review coin launch <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {coin.signature && (
                      <div className="lp-inline">
                        <a
                          href={`https://solscan.io/tx/${coin.signature}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View transaction ↗
                        </a>
                        <button
                          onClick={() => void checkCoin()}
                          disabled={!!busy}
                        >
                          Check confirmation
                        </button>
                      </div>
                    )}
                    {coin.mint && coin.status === "confirmed" && (
                      <a
                        className="lp-next"
                        href={`https://pump.fun/coin/${coin.mint}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open your coin <ArrowUpRight size={16} />
                      </a>
                    )}
                    <p className="lp-field-note">
                      Creating a coin does not start a stream. Live publishing
                      is unavailable until the broadcast service is connected.
                    </p>
                    <button className="lp-next" onClick={download}>
                      Download character package <Download size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="lp-editor-footer">
              <button
                onClick={() => void saveCloud()}
                disabled={!!busy || !draft || !status.storage}
              >
                <Save size={15} />
                {busy === "Saving" ? "Saving…" : "Save to wallet"}
              </button>
              <button
                onClick={download}
                disabled={!draft}
                aria-label="Download character package"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => setShowHelp(!showHelp)}
                aria-expanded={showHelp}
              >
                <CircleHelp size={16} />
                <span>Need a hand?</span>
              </button>
            </div>
          </div>
          <aside className="lp-preview">
            <div className="lp-preview-head">
              <span>
                <span className="lp-preview-dot" /> CHARACTER PREVIEW
              </span>
              <span>9:16</span>
            </div>
            <div className="lp-preview-image">
              <img
                src={draft?.image || samplePortrait(draft)}
                alt={
                  draft?.image
                    ? `Generated portrait of ${draft.name}`
                    : `Example portrait for ${draft?.name || "your character"}; upload or generate your own reference`
                }
              />
              {busy === "Generating portrait" && (
                <div className="lp-preview-busy">
                  <LoaderCircle size={30} className="lp-spin" />
                  <span>Making someone new.</span>
                </div>
              )}
              <span className="lp-ai-label">AI CHARACTER</span>
              <div className="lp-preview-caption">
                <small>
                  {draft?.image
                    ? "YOUR GENERATED CHARACTER"
                    : "EXAMPLE ARTWORK"}
                </small>
                <h3>
                  {draft?.name || "Your character"}
                  <span>↗</span>
                </h3>
                <p>{draft?.description || "A new face for the internet."}</p>
              </div>
            </div>
            <div className="lp-preview-meta">
              <span>
                <Mic2 size={14} />
                {voices.find((v) => v.id === draft?.voice)?.name ||
                  "Choose a voice"}
              </span>
              <span>
                <Monitor size={14} />
                {scenes.find((s) => s.id === draft?.scene)?.name ||
                  "Custom scene"}
              </span>
            </div>
            <p className="lp-preview-note">
              {draft?.image && !visualCurrent
                ? "Prompts changed. Generate a new portrait to apply them."
                : "A still preview. No camera session or livestream is running."}
            </p>
          </aside>
        </div>
        {showHelp && (
          <div className="lp-help">
            <h3>A recognizable character starts with specifics.</h3>
            <p>
              Try a consistent outfit, a strong point of view, and one familiar
              setting. Voice samples are real; example artwork is not live
              video. Local drafts stay in this browser. Connect a wallet to save
              across devices when cloud storage is available.
            </p>
          </div>
        )}
        {(notice || error) && (
          <div
            className={`lp-feedback ${error ? "error" : ""}`}
            role={error ? "alert" : "status"}
          >
            <span>{error || notice}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </section>
      <section className="lp-discover" id="characters">
        <div className="lp-section-top">
          <div>
            <span className="lp-kicker">THE CAST IS JUST GETTING STARTED</span>
            <h2>
              Different faces.
              <br />
              <em>Same main-character energy.</em>
            </h2>
          </div>
          <div className="lp-discover-actions">
            <div className="lp-filters">
              <button
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                Starter characters
              </button>
              <button
                aria-pressed={filter === "drafts"}
                onClick={() => {
                  if (draft)
                    setSaved((p) => [
                      draft,
                      ...p.filter((x) => x.id !== draft.id),
                    ]);
                  setFilter("drafts");
                }}
              >
                My drafts
              </button>
            </div>
            <button
              className="lp-text-link"
              onClick={() => void restoreCloud()}
              disabled={!!busy}
            >
              <Wallet size={14} /> Load wallet drafts
            </button>
          </div>
        </div>
        <div className="lp-character-grid">
          {filter === "all" ? (
            <>
              <CharacterCard
                name="Jean-Paul"
                tag="THE ESPRESSO PHILOSOPHER"
                image="/images/acp-jean-paul.png"
                description="One espresso. Several opinions. An original fictional character."
                action={() => begin("jean-paul")}
              />
              <CharacterCard
                name="Marcel"
                tag="THE AFTER-HOURS HOST"
                image="/images/launchpad-marcel.png"
                description="Dry wit. Warm voice. A story for every caller."
                action={() => begin("marcel")}
              />
              <CharacterCard
                name="Olivia"
                tag="THE ORIGINAL HER"
                image="/images/olivia.jpg"
                description="Curious by nature. Unfiltered by design."
                action={() => begin("olivia")}
              />
              <button
                className="lp-new-character"
                onClick={() => begin("blank")}
              >
                <span className="lp-new-symbol">✳</span>
                <div>
                  <small>THE NEXT ONE IS YOURS</small>
                  <h3>
                    Not quite
                    <br />
                    <em>like anyone.</em>
                  </h3>
                  <span>
                    Start with your idea <ArrowUpRight size={21} />
                  </span>
                </div>
              </button>
            </>
          ) : saved.length ? (
            saved.map((d) => (
              <CharacterCard
                key={d.id}
                name={d.name || "Untitled"}
                tag="SAVED DRAFT"
                image={d.image || samplePortrait(d)}
                description={d.description}
                action={() => openDraft(d)}
              />
            ))
          ) : (
            <div className="lp-empty">
              <Layers3 size={28} />
              <h3>Your cast starts here.</h3>
              <p>
                Create a character in the studio. It saves on this device as you
                work.
              </p>
            </div>
          )}
        </div>
        <p className="lp-examples-note">
          Starter concepts, not active coins or live broadcasts. Make them your
          own before launching.
        </p>
      </section>
      <section className="lp-how" id="how">
        <div>
          <span className="lp-kicker">THE PATH TO PUMP.FUN</span>
          <h2>
            A character.
            <br />A world.
            <br />
            <em>A place to go live.</em>
          </h2>
          <p>
            One studio for the creative work.
            <br />
            Clear steps for everything that comes next.
          </p>
        </div>
        <div className="lp-how-steps">
          {[
            {
              title: "Make the character",
              text: "Describe the face, write the personality and choose a voice. Generate a portrait you actually want to bring to life.",
            },
            {
              title: "Set the scene",
              text: "A corner café, an after-hours studio, a place that only exists in your head. Describe the background in your own words.",
            },
            {
              title: "Review the coin",
              text: "Choose the name and ticker, then review and sign the pump.fun creation transaction with your own wallet.",
            },
            {
              title: "Bring it to the chat",
              text: "Train the live face and connect broadcast access. Live publishing opens when the dedicated streaming service is ready.",
            },
          ].map((s, i) => (
            <div key={s.title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
              <ArrowUpRight size={20} />
            </div>
          ))}
        </div>
      </section>
      <footer className="lp-footer">
        <a className="lp-logo" href="/">
          acp<span>®</span>
        </a>
        <p>Invent a character. Give it a world.</p>
        <a href="/collective">
          The HER collective <ArrowUpRight size={13} />
        </a>
        <span>BUILT FOR THE INTERNET / 2026</span>
      </footer>
      <dialog
        className="lp-review"
        ref={modal}
        onCancel={() => setReview(null)}
        aria-labelledby="review-title"
      >
        <button
          className="lp-close"
          aria-label="Close launch review"
          onClick={() => setReview(null)}
        >
          <X />
        </button>
        <span className="lp-kicker">SOLANA MAINNET / TRANSACTION REVIEW</span>
        <h2 id="review-title">Create ${draft?.symbol}?</h2>
        <p>
          This creates a real pump.fun coin for {draft?.name}. Your wallet pays
          network and account-creation costs. There is no initial buy and no
          automatic livestream.
        </p>
        <dl>
          <dt>Mint address</dt>
          <dd>{review?.mint}</dd>
          <dt>Creator wallet</dt>
          <dd>{ACP_FEE_WALLET}</dd>
          <dt>Launch payer</dt>
          <dd>{viewer.wallet}</dd>
          <dt>Quote asset — NVDAX</dt>
          <dd>{ACP_QUOTE_MINT}</dd>
          <dt>ACP creator fee</dt>
          <dd>
            1% in NVDAX, accrued to the platform creator vault. Pump protocol
            fees are additional.
          </dd>
        </dl>
        <label className="lp-check">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          <span>
            I reviewed this coin, am eligible under the linked NVDAX issuer
            terms, and understand the transaction is permanent.
          </span>
        </label>
        <button
          className="lp-primary lp-wide"
          disabled={!confirm || !!busy}
          onClick={() => void launch()}
        >
          Approve in wallet <ArrowUpRight size={17} />
        </button>
      </dialog>
    </main>
  );
}
function FormTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="lp-form-heading">
      <div>
        <span className="lp-kicker">{kicker}</span>
        <h3>{title}</h3>
      </div>
      <span className="lp-mini-symbol">✳</span>
    </div>
  );
}
function LaunchStep({
  number,
  title,
  text,
  status,
}: {
  number: string;
  title: string;
  text: string;
  status: string;
}) {
  return (
    <li>
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <span className="lp-state-label">{status}</span>
    </li>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  hint,
  prefix,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  prefix?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = "lp-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="lp-field">
      <label htmlFor={id}>{label}</label>
      <div className={prefix ? "lp-input-prefix" : ""}>
        {prefix && <span>{prefix}</span>}
        {multiline ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            {...props}
          />
        ) : (
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...props}
          />
        )}
      </div>
      {hint && <p>{hint}</p>}
    </div>
  );
}
function CharacterCard({
  name,
  tag,
  image,
  description,
  action,
}: {
  name: string;
  tag: string;
  image: string;
  description: string;
  action: () => void;
}) {
  return (
    <article className="lp-character-card">
      <button
        className="lp-card-image"
        onClick={action}
        aria-label={`Customize ${name}`}
      >
        <img src={image} alt={`${name}, AI character concept`} loading="lazy" />
        <span>CONCEPT / NOT LIVE</span>
        <span className="lp-card-arrow">
          <ArrowUpRight size={23} />
        </span>
      </button>
      <div className="lp-card-details">
        <small>{tag}</small>
        <h3>{name}</h3>
        <p>{description}</p>
        <button onClick={action}>
          Make it yours <ChevronRight size={14} />
        </button>
      </div>
    </article>
  );
}
