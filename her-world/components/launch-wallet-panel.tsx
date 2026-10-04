"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
type View = { address: string; balanceLamports: number; minLamports: number; feeSetup: string; exported: boolean };
const sol = (lamports: number) => (lamports / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 });
// Each character has its own launch wallet. ACP holds the key so the coin can launch and its
// trading fees can fund video automatically; the owner can export the key whenever they like.
export default function LaunchWalletPanel({ id, ready }: { id: string; ready: boolean }) {
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [secret, setSecret] = useState(""),
    [copied, setCopied] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/launchpad?action=launch-wallet&id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = (await r.json()) as View & { error?: string };
      if (!r.ok) throw new Error(data.error || "Launch wallet unavailable.");
      setView(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch wallet unavailable.");
    } finally {
      setBusy(false);
    }
  }, [id]);
  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);
  async function reveal() {
    if (!window.confirm("Anyone with this key controls the wallet and its coin fees. Show it only on a private screen, and never share it. Continue?")) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/launchpad?action=export-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await r.json()) as { secretKey?: string; error?: string };
      if (!r.ok || !data.secretKey) throw new Error(data.error || "Export failed.");
      setSecret(data.secretKey);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }
  const funded = !!view && view.balanceLamports >= view.minLamports;
  return (
    <div className="lp-pair-info" aria-live="polite">
      <strong>Launch wallet · deposit SOL to launch</strong>
      <p>
        Send at least {view ? sol(view.minLamports) : "0.05"} SOL to this character’s launch wallet. It creates the coin
        on pump.fun with no initial buy. Trading fees are paid in SOL: half goes to ACP and half stays in this wallet for you.
        The split is locked on-chain once set. You can export this wallet’s key at any time.
        Generation is purchased separately before use; the selected price is paid from this wallet when you confirm a purchase.
      </p>
      {!ready ? (
        <p>Save this character to your wallet to get its launch wallet address.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !view ? (
        <p>Loading launch wallet…</p>
      ) : (
        <>
          <p>
            <code>{view.address}</code>
          </p>
          <p>
            Balance: <b>{sol(view.balanceLamports)} SOL</b> · {funded ? "Ready to launch" : `Needs ${sol(Math.max(0, view.minLamports - view.balanceLamports))} more SOL`}
          </p>
        </>
      )}
      {view && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void copy("address", view.address)}>
            {copied === "address" ? "Copied" : "Copy address"}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
            Refresh balance
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void reveal()}>
            Export private key
          </Button>
        </div>
      )}
      {secret && (
        <div role="region" aria-label="Exported private key">
          <p>
            <b>Private key (base58).</b> Import it into Phantom or Solflare. Store it somewhere safe, then hide it.
          </p>
          <p>
            <code style={{ wordBreak: "break-all" }}>{secret}</code>
          </p>
          <Button variant="outline" size="sm" onClick={() => void copy("key", secret)}>
            {copied === "key" ? "Copied" : "Copy key"}
          </Button>{" "}
          <Button variant="ghost" size="sm" onClick={() => setSecret("")}>
            Hide key
          </Button>
        </div>
      )}
    </div>
  );
}
