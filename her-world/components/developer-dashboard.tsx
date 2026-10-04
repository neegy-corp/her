"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletRoot, useWallet } from "./wallet";
import { AcpNav, AcpFooter } from "./acp-nav";
import { DRAFT_STORE, readLocalDrafts, creatorPath, keepDraft } from "@/lib/creator-navigation";
import type { CharacterDraft, LaunchStatus } from "@/lib/launchpad";
import { shortWallet } from "@/lib/catalog";
import "./launchpad.css";
import "./acp-pages.css";

import { saveStudioDraft } from "@/lib/creator-workflow";

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
  async function openStudio(draft: CharacterDraft) {
    if (!viewer.wallet) { connect(); return; }
    setLoading(true); setError("");
    try {
      const device = readLocalDrafts(localStorage.getItem(DRAFT_STORE)).find(d => d.id === draft.id);
      window.location.assign(await saveStudioDraft(device && device.updatedAt > draft.updatedAt ? device : draft));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not open the studio."); }
    finally { setLoading(false); }
  }
  function card(d: OwnedCharacter, cloud: boolean) {
    return <article className="acp-dev-card" key={d.id}>
      <div className="acp-dev-identity">
        {d.coinPfp || d.image ? <img src={d.coinPfp || d.image} alt="" /> : <span className="acp-dev-monogram">{(d.name || "?").slice(0, 1)}</span>}
        <div><h2>{d.name || "Untitled character"}</h2><p>{d.symbol ? `$${d.symbol}` : "No ticker yet"} <span className="acp-draft-scope">{cloud ? d.mint ? "Confirmed launch" : "Wallet draft" : "Saved locally"}</span></p></div>
      </div>
      <p>{d.description || "Your next character starts here."}</p>
      <div className="acp-dev-links">
        {([['character', 'Character'], ['personality', 'Voice & setting'], ['show', 'Show'], ['launch', 'Launch']] as const).map(([step, label]) => <Link key={step} href={creatorPath(d.id, step)} onClick={() => stash(d)}>{label} <ArrowUpRight size={14} aria-hidden="true" /></Link>)}
      </div>
      <div className="acp-dev-actions"><Button disabled={loading || !status?.storage} onClick={() => void openStudio(d)}>Broadcast studio <ArrowUpRight size={14} aria-hidden="true" /></Button>{cloud && d.mint && <Button variant="outline" asChild><a href={`https://pump.fun/coin/${d.mint}`} target="_blank" rel="noreferrer">Open pump.fun <ArrowUpRight size={14} aria-hidden="true" /></a></Button>}</div>
      {cloud && d.mint && <p className="acp-dev-mint">{d.mint}</p>}
    </article>;
  }
  return <main className="lp acp-pages"><AcpNav active="developer" /><section className="acp-directory">
    <div className="acp-directory-heading acp-art-heading acp-studio-heading"><img className="acp-heading-art" src="/images/acp-v2/studio.webp" alt="" /><div><h1>Your characters.<br /><em>Your creative control.</em></h1><p>Pick up a draft, prepare your next launch, or open a character’s broadcast studio.</p></div><Button asChild><Link href="/create">New character <ArrowUpRight size={14} aria-hidden="true" /></Link></Button></div>
    <div className="acp-dev-account"><div><strong>{viewer.wallet ? shortWallet(viewer.wallet) : "Connect your creator wallet"}</strong><p>{viewer.wallet ? "Only characters owned by this verified wallet appear below." : "Wallet sign-in unlocks your saved characters across devices. No email signup."}</p></div><Button variant="outline" onClick={() => viewer.wallet ? void disconnect() : connect()}>{viewer.wallet ? "Disconnect" : "Connect wallet"}</Button>{viewer.wallet && <Button variant="ghost" disabled={loading} onClick={() => setRevision(r => r + 1)}>Refresh</Button>}</div>
    <div className="acp-dev-services"><span>Cloud drafts <b>{status ? status.storage ? "Connected" : "Offline" : "Checking"}</b></span><span>Pump creation <b>{status ? status.coinCreation ? "Enabled" : "Not activated" : "Checking"}</b></span><span>Portrait generation <b>{status ? status.generation ? "Enabled" : "Awaiting provider" : "Checking"}</b></span><span>Broadcast <b>Per-character studio</b></span></div>
    {error && <p role="alert" className="lp-inline">{error}</p>}
    {loading && <p role="status">Loading your wallet's characters…</p>}
    {!loading && !localOnly.length && !remote.length && !error && <div className="studio-empty"><div className="studio-empty-symbol" aria-hidden="true"><Plus size={36} strokeWidth={1.5} /></div><div><h2>Make your first main character.</h2><p>Start with a name and a point of view. Your draft saves on this device as you work; connect a wallet to save it across devices when cloud storage is available.</p><Button asChild><Link href="/create">Open the character builder <ArrowUpRight size={14} aria-hidden="true" /></Link></Button></div></div>}
    {!!remote.length && <div className="acp-dev-grid">{remote.map(d => card(d, true))}</div>}
    {!loading && viewer.wallet && !remote.length && !error && <div className="lp-empty"><h2>No wallet-saved characters yet.</h2><p>Create a character and choose Sync to add it here.</p></div>}
    {!!localOnly.length && <><h2 className="acp-dev-local-title">On this device.</h2><p>Private browser drafts. Save to your connected wallet for access from another device.</p><div className="acp-dev-grid">{localOnly.map(d => card(d, false))}</div></>}
  </section><AcpFooter /></main>;
}
