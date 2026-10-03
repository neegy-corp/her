"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { WalletRoot, useWallet } from "./wallet";
import { AcpNav, AcpFooter } from "./acp-nav";
import { DRAFT_STORE, readLocalDrafts, creatorPath, keepDraft } from "@/lib/creator-navigation";
import type { CharacterDraft, LaunchStatus } from "@/lib/launchpad";
import { shortWallet } from "@/lib/catalog";
import "./launchpad.css";
import "./acp-pages.css";

type OwnedCharacter = CharacterDraft & { mint?: string; signature?: string; faceStatus?: string };
export default function DeveloperDashboard() { return <WalletRoot><Dashboard /></WalletRoot>; }
function Dashboard() {
  const { viewer, connect, disconnect } = useWallet();
  const [local, setLocal] = useState<CharacterDraft[]>([]), [remote, setRemote] = useState<OwnedCharacter[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [status, setStatus] = useState<LaunchStatus | null>(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    setLocal(readLocalDrafts(localStorage.getItem(DRAFT_STORE)));
    void fetch("/api/launchpad").then(r => r.ok ? r.json() as Promise<LaunchStatus> : Promise.reject()).then(setStatus).catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    let cancelled = false;
    setRemote([]); setError("");
    if (!viewer.wallet) { setLoading(false); return; }
    setLoading(true);
    void fetch("/api/launchpad?action=drafts", { cache: "no-store" }).then(async r => {
      const result = await r.json() as { drafts: OwnedCharacter[]; error?: string };
      if (!r.ok) throw new Error(result.error || "Could not load your wallet's characters.");
      if (!cancelled) setRemote(result.drafts);
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [viewer.wallet, revision]);
  const localOnly = local.filter(d => !remote.some(r => r.id === d.id));
  function stash(d: CharacterDraft) {
    // Keep newer unsaved device edits; never overwrite them with an older cloud draft.
    const current = readLocalDrafts(localStorage.getItem(DRAFT_STORE));
    const newer = current.find(x => x.id === d.id && x.updatedAt > d.updatedAt);
    localStorage.setItem(DRAFT_STORE, JSON.stringify(keepDraft(current, newer || d)));
  }
  function card(d: OwnedCharacter, cloud: boolean) {
    return <article className="acp-dev-card" key={d.id}>
      <div className="acp-dev-identity">
        {d.coinPfp || d.image ? <img src={d.coinPfp || d.image} alt="" /> : <span className="acp-dev-monogram">{(d.name || "?").slice(0, 1)}</span>}
        <div><span className="lp-kicker">{cloud ? d.mint ? "CONFIRMED ON PUMP" : "WALLET DRAFT" : "THIS DEVICE ONLY"}</span><h2>{d.name || "Untitled character"}</h2><p>{d.symbol ? `$${d.symbol}` : "No ticker yet"}</p></div>
      </div>
      <p>{d.description || "Your next character starts here."}</p>
      <div className="acp-dev-links">
        {([['character', 'Character'], ['personality', 'Voice'], ['scene', 'Background'], ['show', 'Show & scripts'], ['artwork', 'Coin artwork'], ['launch', 'Launch / status']] as const).map(([step, label]) => <Link key={step} href={creatorPath(d.id, step)} onClick={() => stash(d)}>{label} ↗</Link>)}
      </div>
      <div className="acp-dev-actions"><Link className="lp-primary" href={`/studio/${d.id}`}>Broadcast studio ↗</Link>{cloud && d.mint && <a className="lp-secondary" href={`https://pump.fun/coin/${d.mint}`} target="_blank" rel="noreferrer">Open pump.fun ↗</a>}</div>
      {cloud && d.mint && <p className="acp-dev-mint">{d.mint}</p>}
    </article>;
  }
  return <main className="lp acp-pages"><AcpNav active="developer" /><section className="acp-directory">
    <div className="acp-directory-heading"><div><span className="lp-kicker">YOUR CONTROL ROOM</span><h1>The developer<br /><em>dashboard.</em></h1><p>Manage your characters, launch their coins on Pump, and run each show from its own broadcast studio.</p></div><Link className="lp-primary" href="/create">New character ↗</Link></div>
    <div className="acp-dev-account"><div><strong>{viewer.wallet ? shortWallet(viewer.wallet) : "Connect your creator wallet"}</strong><p>{viewer.wallet ? "Only characters owned by this verified wallet appear below." : "Wallet sign-in unlocks your saved characters across devices. No email signup."}</p></div><button className="lp-secondary" onClick={() => viewer.wallet ? void disconnect() : connect()}>{viewer.wallet ? "Disconnect" : "Connect wallet"}</button>{viewer.wallet && <button className="lp-text-link" disabled={loading} onClick={() => setRevision(r => r + 1)}>Refresh</button>}</div>
    <div className="acp-dev-services"><span>Cloud drafts <b>{status ? status.storage ? "Connected" : "Offline" : "Checking"}</b></span><span>Pump creation <b>{status ? status.coinCreation ? "Enabled" : "Not activated" : "Checking"}</b></span><span>Portrait generation <b>{status ? status.generation ? "Enabled" : "Awaiting provider" : "Checking"}</b></span><span>Broadcast <b>Per-character studio</b></span></div>
    {error && <p role="alert" className="lp-inline">{error}</p>}
    {loading && <p role="status">Loading your wallet's characters…</p>}
    {!!remote.length && <div className="acp-dev-grid">{remote.map(d => card(d, true))}</div>}
    {!loading && viewer.wallet && !remote.length && !error && <div className="lp-empty"><h2>No wallet-saved characters yet.</h2><p>Create a character and choose Save to wallet to add it here.</p></div>}
    {!!localOnly.length && <><h2 className="acp-dev-local-title">On this device.</h2><p>Private browser drafts. Save to your connected wallet for access from another device.</p><div className="acp-dev-grid">{localOnly.map(d => card(d, false))}</div></>}
  </section><AcpFooter /></main>;
}
