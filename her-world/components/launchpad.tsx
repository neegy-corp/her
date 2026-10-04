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
  Wallet,
  CircleHelp,
  Layers3,
  Plus,
} from "lucide-react";
import { WalletRoot, useWallet } from "./wallet";
import { AcpNav, AcpFooter } from "./acp-nav";
import { shortWallet } from "@/lib/catalog";
import {
  newDraft,
  exportDraft,
  visualFingerprint,
  offlineStatus,
  samplePortrait,
  type CharacterDraft,
  type LaunchStatus,
} from "@/lib/launchpad";
import "./launchpad.css";
import "./acp-pages.css";
import ShowEditor from "./show-editor";
import CoinArtwork from "./coin-artwork";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import CharacterReferences from "./character-references";
import LaunchWalletPanel from "./launch-wallet-panel";
import { DRAFT_STORE, creatorPath, readLocalDrafts, keepDraft, type CreatorStep } from "@/lib/creator-navigation";

import { saveStudioDraft } from "@/lib/creator-workflow";

const STORE = DRAFT_STORE;
type Step = CreatorStep;
const steps = [
  { id: "character", label: "Character", icon: Palette },
  { id: "personality", label: "Voice & setting", icon: Mic2 },
  { id: "show", label: "Show", icon: Layers3 },
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
type EditorProps = { characterId?: string; initialStep?: Step };
export default function Launchpad(props: EditorProps) {
  return (
    <WalletRoot>
      <Home {...props} />
    </WalletRoot>
  );
}
function Home({ characterId, initialStep = "character" }: EditorProps) {
  const { viewer, connect, disconnect } = useWallet();
  const [draft, setDraft] = useState<CharacterDraft | null>(null),
    [saved, setSaved] = useState<CharacterDraft[]>([]),
    [step] = useState<Step>(initialStep);
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
    [showHelp, setShowHelp] = useState(false);
  const [portraitStatus, setPortraitStatus] = useState("");
  const studio = useRef<HTMLElement | null>(null),
    modal = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    try {
      const valid = readLocalDrafts(localStorage.getItem(STORE));
      setSaved(valid);
      setDraft(characterId ? valid.find(d => d.id === characterId) || null : newDraft());
    } catch {
      setDraft(characterId ? null : newDraft());
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

  }, [characterId]);
  useEffect(() => {
    if (!characterId || !viewer.wallet || !loaded) return;
    let cancelled = false;
    request<{ drafts: CloudDraft[] }>("drafts").then(({ drafts }) => {
      if (cancelled) return;
      const remote = drafts.find(d => d.id === characterId);
      if (!remote) return;
      setDraft(local => !local || remote.updatedAt > local.updatedAt ? remote : local);
      setFaceStatus(remote.faceStatus || "draft");
      setCoin(remote.mint ? { mint: remote.mint, signature: remote.signature, status: "confirmed" } : {});
    }).catch(() => { if (!cancelled) setError("Could not load your wallet copy. Local changes are preserved."); });
    return () => { cancelled = true; };
  }, [characterId, viewer.wallet, loaded]);
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
  function persistCurrent() {
    if (!draft) return true;
    try {
      localStorage.setItem(STORE, JSON.stringify(keepDraft(readLocalDrafts(localStorage.getItem(STORE)), draft)));
      return true;
    } catch { setError("Browser storage is full. Download your draft before leaving."); return false; }
  }
  function setStep(next: Step) {
    if (draft && persistCurrent()) window.location.assign(creatorPath(draft.id, next));
  }
  function begin() {
    if (persistCurrent()) window.location.assign("/create");
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
  async function openCredits() {
    if (!draft) return;
    if (!viewer.wallet) { connect(); return; }
    await task("Saving", async () => {
      await request("save", {draft});
      window.location.assign(`/credits/${encodeURIComponent(draft.id)}`);
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
      await portraitRequest("POST");
    });
  }
  async function portraitRequest(method: "GET" | "POST") {
    if (!draft) return;
    const result = await fetch(`/api/launchpad/portrait?id=${encodeURIComponent(draft.id)}`, { method });
    const body = await result.json() as { status: string; image?: string; imageFingerprint?: string; error?: string };
    if (!result.ok) throw new Error(body.error || "Could not check your portrait.");
    setPortraitStatus(body.status);
    if (body.status === "ready" && body.image && body.imageFingerprint) {
      setDraft(d => d?.id === draft.id ? { ...d, image: body.image!, imageFingerprint: body.imageFingerprint! } : d);
      setNotice("Higgsfield portrait saved. Review it before using it in the show.");
    } else setNotice(body.status === "failed" ? "Higgsfield could not generate this portrait. Adjust your appearance or scene before trying again." : body.status === "none" ? "No portrait job for the current appearance and background." : `Portrait ${body.status}. Use Check portrait to refresh this saved job without another charge.`);
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
  async function openStudio() {
    if (!draft || !persistCurrent()) return;
    if (!viewer.wallet) { connect(); return; }
    await task("Saving show", async () => {
      window.location.assign(await saveStudioDraft(draft));
    });
  }
  async function prepare() {
    if (!draft) return;
    await task("Preparing launch", async () => {
      await request("save", { draft });
      setReview(await request("prepare-coin", { id: draft.id }));
      setConfirm(false);
    });
  }
  async function launch() {
    if (!draft || !review) return;
    await task("Launching", async () => {
      setCoin(await request("confirm-coin", { id: draft.id }));
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
          ? "Coin confirmed. Open its broadcast studio, enter the Pump stream URL and key, then press Go Live."
          : "Launch status: " + r.status,
      );
    });
  }
  const activeStep = step === "scene" ? "personality" : step === "artwork" ? "launch" : step;
  const stepIndex = steps.findIndex(s => s.id === activeStep);
  const nextStep = steps[stepIndex + 1];
  const visualCurrent =
    !!draft?.image && draft.imageFingerprint === visualFingerprint(draft);
  return (
    <main className="lp acp-pages">
      <AcpNav active="create" action={<Button
          className="lp-wallet"
          onClick={() => (viewer.wallet ? void disconnect() : connect())}
        >
          <Wallet size={15} />
          {viewer.wallet ? shortWallet(viewer.wallet) : "Connect wallet"}
        </Button>} />
      <section className="lp-studio" id="studio" ref={studio}>
        <div className="lp-section-top"><div><h1 className="acp-studio-title">{draft?.name || "New character"}</h1><p className="acp-studio-intro">Make it yours. Bring it to life.</p></div><div className="lp-save-status"><Badge variant="secondary" title="Saved on this device">{localSaved ? <><Check size={13} /> Saved locally</> : "Saving locally…"}</Badge><Button variant="ghost" size="sm" onClick={begin}><Plus size={14} /> New character</Button></div></div>
        <div className="lp-workspace">
          <div className="lp-editor">
            <div
              className="lp-tabs"
              role="navigation"
              aria-label="Character editor"
            >
              {steps.map((s, index) => (
                <a
                  id={`tab-${s.id}`}
                  aria-current={activeStep === s.id ? "page" : undefined}
                  key={s.id}
                  href={draft ? creatorPath(draft.id, s.id) : "#"}
                  onClick={e => { if (!draft || !persistCurrent()) e.preventDefault(); }}
                >
                  <span className="lp-step-number">{index + 1}</span>
                  <span>{s.label}</span>
                </a>
              ))}
            </div>
            {!draft ? (
              <div className="lp-form">{loaded ? <>This character is not saved on this device. Connect its owner wallet to load it, or <a href="/developer">open your developer dashboard</a>.</> : "Opening your studio…"}</div>
            ) : (
              <div
                className="lp-form"
                id="studio-panel"
                role="region"
                aria-labelledby={`tab-${activeStep}`}
              >
                {step === "character" && (
                  <>
                    <FormTitle
                      kicker="START WITH A SPARK"
                      title="Create your character"
                    />
                    <div className="lp-field-row">
                      <Field
                        label="Character name"
                        value={draft.name}
                        maxLength={32}
                        onChange={(v) => edit({ name: v })}
                        placeholder="Give them a name"
                      />
                    </div>
                    <Field
                      label="Short bio"
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
                      hint="Describe the whole character: face, age, build, hair, skin, outfit, accessories, pose and surroundings. Your prompt controls the result."
                    />
                    <div className="lp-check"><Checkbox id="character-rights" checked={draft.rightsConfirmed} onCheckedChange={checked => edit({rightsConfirmed: checked === true})} /><Label htmlFor="character-rights">I own this character or have permission to use their likeness.</Label></div>
                    <CharacterReferences draft={draft} onChange={edit} />
                    <Button variant="outline" disabled={!!busy || !status.storage} onClick={() => void openCredits()}>Buy generation time</Button>
                    <p className="lp-field-note">Payment is required before portraits, AI scripts and videos are generated.</p>
                    <Button
                      className="lp-primary lp-wide"
                      disabled={
                        !!busy || !draft.rightsConfirmed || (draft.appearance.trim().length < 20 && !draft.referenceFingerprint) || !status.generation
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
                        : "Generate portrait"}
                    </Button>

                    {status.imageProvider === "higgsfield" && <Button variant="outline" className="lp-secondary" disabled={!!busy} onClick={() => void task("Checking portrait", () => portraitRequest("GET"))}>Check portrait {portraitStatus && `· ${portraitStatus}`}</Button>}
                    {!status.generation && (
                      <p className="lp-field-note">
                        Connect your wallet and generation services to create images.
                      </p>
                    )}
                    <Button
                      variant="outline" className="lp-secondary"
                      onClick={() => setStep("show")}
                    >
                      Write the video script <ArrowRight size={16} />
                    </Button>
                  </>
                )}
                {step === "personality" && (
                  <>
                    <FormTitle
                      kicker="A FACE IS ONLY THE START"
                      title="Generate their voice & world"
                    />
                    <Field
                      label="Personality"
                      value={draft.personality}
                      maxLength={2000}
                      onChange={(v) => edit({ personality: v })}
                      multiline
                      rows={5}
                      hint="Their interests, attitude and way of talking."
                    />
                    <Field label="Voice prompt" value={draft.voicePrompt || ""} maxLength={300} onChange={voicePrompt => edit({voicePrompt,voice:"generated"})} multiline rows={3} placeholder="A warm, slightly raspy voice. Light French accent, relaxed pace, dry humor." hint="Higgsfield generates the audio with each video. Describe tone, accent, language and delivery; leave blank to let it choose. Preview the result—voice consistency can vary between clips." />
                    <ScenePicker draft={draft} onChange={edit} busy={!!busy} onGenerate={() => void generate()} generationAvailable={status.generation} />
                  </>
                )}
                {step === "scene" && <ScenePicker draft={draft} onChange={edit} busy={!!busy} onGenerate={() => void generate()} generationAvailable={status.generation} />}
                {step === "show" && (
                  <ShowEditor
                    key={draft.id}
                    draft={draft}
                    onChange={(show) => edit({ show })}
                    onNotice={setNotice}
                    servicesAvailable={!!viewer.wallet && status.storage}
                    scriptsAvailable={status.scripts}
                    videosAvailable={status.videos}
                  />
                )}
                {step === "artwork" && <><FormTitle kicker="THE TOKEN IDENTITY" title="Give the coin its own look." /><CoinArtwork draft={draft} onChange={edit} servicesAvailable={!!viewer.wallet && status.storage} /><Button variant="ghost" className="lp-next" onClick={() => setStep("launch")}>Continue to launch <ArrowRight size={16} /></Button></>}
                {step === "launch" && (
                  <>
                    <FormTitle
                      kicker="FROM AN IDEA TO A PRESENCE"
                      title="Launch your character"
                    />
                    <div className="lp-launch-profile">                      <Field
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
<CoinArtwork draft={draft} onChange={edit} servicesAvailable={!!viewer.wallet && status.storage} /></div>
                    <LaunchWalletPanel id={draft.id} ready={!!viewer.wallet && status.storage} />
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
                      <LaunchStep number="02" title="Profile picture" text="A square image for your coin." status={draft.coinPfp ? "Ready" : "Add image"} />
                      <LaunchStep
                        number="03"
                        title="Create the coin on pump.fun"
                        text="Standard SOL coin launched from your launch wallet. Fees split 50% ACP, 50% your launch wallet. No initial buy."
                        status={
                          coin.status === "confirmed"
                            ? "Created"
                            : status.coinCreation
                              ? "Available"
                              : "Soon"
                        }
                      />
                    </ol>
                    <details className="lp-details"><summary>Talking face (optional)</summary><p>Train a face for scripted speech clips.</p>                      <Button
                        variant="outline" className="lp-secondary"
                        disabled={
                          !!busy ||
                          !visualCurrent ||
                          !status.faces ||
                          faceStatus !== "draft"
                        }
                        onClick={() => void train()}
                      >
                        Train live face
                      </Button>
                      {faceStatus !== "draft" && (
                        <Button
                          variant="outline" className="lp-secondary"
                          disabled={!!busy}
                          onClick={() => void checkFace()}
                        >
                          Check training
                        </Button>
                      )}
</details>
                    <div className="lp-launch-buttons">
                      <Button
                        className="lp-primary"
                        disabled={
                          !!busy ||
                          !status.coinCreation ||
                          !draft.coinPfp ||
                          !draft.rightsConfirmed ||
                          !!coin.signature ||
                          !!coin.mint
                        }
                        onClick={() => void prepare()}
                      >
                        Review coin launch <ArrowUpRight size={15} />
                      </Button>
                    </div>
                    {coin.signature && (
                      <div className="lp-inline">
                        <a
                          href={`https://solscan.io/tx/${coin.signature}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View transaction <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                        <Button
                          onClick={() => void checkCoin()}
                          disabled={!!busy}
                        >
                          Check confirmation
                        </Button>
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
                    <p className="lp-field-note">Coin creation and broadcasting are separate. <Button variant="link" disabled={!!busy || !status.storage} onClick={() => void openStudio()}>Open broadcast studio</Button></p>
                  </>
                )}
              </div>
            )}
            <div className="lp-editor-footer"><div className="lp-editor-utilities"><Button variant="ghost" size="sm" onClick={() => void saveCloud()} disabled={!!busy || !draft || !status.storage}><Save size={15} />{busy === "Saving" ? "Saving…" : "Sync"}</Button><Button variant="ghost" size="icon" onClick={download} disabled={!draft} aria-label="Download character package"><Download size={16} /></Button><Button variant="ghost" size="icon" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp} aria-label="Builder help"><CircleHelp size={16} /></Button></div>{nextStep && <Button disabled={!!busy || !draft} onClick={() => setStep(nextStep.id)}>Continue <ArrowRight size={16} /></Button>}</div>
          </div>
          <aside className="lp-preview"><div className="lp-preview-image">{draft?.image ? <img src={draft.image} alt={`Character reference for ${draft.name}`} /> : <div className="lp-preview-empty lp-preview-art"><img src="/images/acp-v2/studio.webp" alt="" /><p>Your character appears here</p></div>}{busy === "Generating portrait" && <div className="lp-preview-busy"><LoaderCircle size={28} className="lp-spin" /><span>Creating your portrait…</span></div>}</div><div className="lp-preview-caption"><h3>{draft?.name || "Your character"}</h3>{draft?.description && <p>{draft.description}</p>}</div><div className="lp-preview-meta"><span><Mic2 size={14} />{draft?.voicePrompt ? "Custom voice direction" : "Higgsfield-generated voice"}</span><span><Monitor size={14} />{draft?.background ? "Prompted setting" : "Setting from character prompt"}</span></div>{draft?.image && !visualCurrent && <p className="lp-preview-note">Your look has changed. Regenerate to update the preview.</p>}</aside>
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
            <Button
              aria-label="Dismiss message"
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              <X size={16} />
            </Button>
          </div>
        )}
      </section>
      <AcpFooter />
      <dialog
        className="lp-review"
        ref={modal}
        onCancel={() => setReview(null)}
        aria-labelledby="review-title"
      >
        <Button
          className="lp-close"
          aria-label="Close launch review"
          onClick={() => setReview(null)}
        >
          <X />
        </Button>
        <span className="lp-kicker">SOLANA MAINNET / TRANSACTION REVIEW</span>
        <h2 id="review-title">Create ${draft?.symbol}?</h2>
        <p>
          This creates a real pump.fun coin for {draft?.name}. The character’s
          launch wallet pays network and account-creation costs from the SOL you
          deposited. There is no initial buy and no automatic livestream.
        </p>
        <dl>
          <dt>Mint address</dt>
          <dd>{review?.mint}</dd>
          <dt>Creator (launch wallet)</dt>
          <dd>This character’s launch wallet (address shown on the launch step)</dd>
          <dt>Quote asset</dt>
          <dd>SOL</dd>
          <dt>Creator fees</dt>
          <dd>
            Paid in SOL. Split permanently 50% to ACP and 50% to this character’s launch
            wallet, which you can export and which pays for your video time. Pump
            protocol fees are additional.
          </dd>
        </dl>
        <label className="lp-check">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          <span>
            I reviewed this coin and understand the launch and the 50/50 fee split
            are permanent.
          </span>
        </label>
        <Button
          className="lp-primary lp-wide"
          disabled={!confirm || !!busy}
          onClick={() => void launch()}
        >
          Launch coin <ArrowUpRight size={17} />
        </Button>
      </dialog>
    </main>
  );
}
function FormTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="lp-form-heading">
      <div>

        <h3>{title}</h3>
      </div>

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
      <Label htmlFor={id}>{label}</Label>
      <div className={prefix ? "lp-input-prefix" : ""}>
        {prefix && <span>{prefix}</span>}
        {multiline ? (
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            {...props}
          />
        ) : (
          <Input
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
      <Button
        className="lp-card-image"
        onClick={action}
        aria-label={`Customize ${name}`}
      >
        <img src={image} alt={`${name}, AI character concept`} loading="lazy" />
        <span>CONCEPT / NOT LIVE</span>
        <span className="lp-card-arrow">
          <ArrowUpRight size={23} />
        </span>
      </Button>
      <div className="lp-card-details">
        <small>{tag}</small>
        <h3>{name}</h3>
        <p>{description}</p>
        <Button onClick={action}>
          Make it yours <ChevronRight size={14} />
        </Button>
      </div>
    </article>
  );
}

function ScenePicker({draft, onChange, busy, onGenerate, generationAvailable}: {draft: CharacterDraft; onChange: (patch: Partial<CharacterDraft>) => void; busy: boolean; onGenerate: () => void; generationAvailable: boolean}) {
  return <section className="lp-setting-section"><h3>Generate the setting</h3><Field label="Setting prompt" value={draft.background} maxLength={1000} onChange={background => onChange({background,scene:"custom"})} multiline rows={4} placeholder="A rain-soaked Tokyo side street at night, warm shop windows, handheld camera, realistic reflections…" hint="Describe any location, lighting and atmosphere. Higgsfield creates the background with the character; no stock setting is selected."/><Button variant="outline" disabled={busy || !draft.rightsConfirmed || !generationAvailable} onClick={onGenerate}><WandSparkles size={16}/>Generate character & setting</Button><p className="lp-field-note">Changing the visual prompt requires a new image. Voice direction is applied when you generate a video.</p></section>;
}
