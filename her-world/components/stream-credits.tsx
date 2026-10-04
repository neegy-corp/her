"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./wallet";
import { Button } from "./ui/button";
import type { StreamCreditState } from "@/lib/stream-plans";
const minutes = (seconds: number) => `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`;
const sol = (lamports: number) => (lamports / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 });
export default function StreamCredits({ id, onState }: { id: string; onState?: (state: StreamCreditState) => void }) {
  const { viewer, connect } = useWallet();
  const [state, setState] = useState<StreamCreditState | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const purchaseBusy = useRef(false);
  const call = useCallback(
    async (action?: string, body?: unknown) => {
      const r = await fetch(`/api/launchpad/credits?id=${encodeURIComponent(id)}${action ? `&action=${action}` : ""}`,
        body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error || "Video time unavailable.");
      return data;
    },
    [id],
  );
  const refresh = useCallback(async () => {
    const value = (await call()) as StreamCreditState;
    setState(value);
    onState?.(value);
    return value;
  }, [call, onState]);
  useEffect(() => {
    setState(null);
    setMessage("");
    if (!viewer.wallet) return;
    let active = true;
    const load = () => {
      void call()
        .then((data) => {
          const value = data as StreamCreditState;
          if (!active) return;
          setState(value);
          onState?.(value);
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [viewer.wallet, call, onState]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function buy(plan: { minutes: number; lamports: number }) {
    if (purchaseBusy.current) return;
    purchaseBusy.current = true;
    try {
    // Keep the ID across network failures/reloads; only a resolved receipt ends this intent.
    const storageKey = `acp-purchase:${viewer.wallet}:${id}:${plan.minutes}`;
    const requestId = localStorage.getItem(storageKey) || crypto.randomUUID();
    localStorage.setItem(storageKey, requestId);
    const result = (await call("buy", { requestId, minutes: plan.minutes, maxLamports: Math.ceil(plan.lamports * 1.02) })) as { status: string; message?: string; streamSeconds?: number };
    if (["credited", "expired", "failed"].includes(result.status)) localStorage.removeItem(storageKey);
    const next = await refresh();
    setMessage(
      result.status === "credited"
        ? `Payment confirmed. Available stream time: ${minutes(next.streamSeconds)}.`
        : result.message || (result.status === "pending" ? "Payment is confirming. Your time is added once it lands." : "The payment did not go through. Nothing was charged."),
    );
    } finally { purchaseBusy.current = false; }
  }
  async function collect() {
    const result = (await call("collect", {})) as { message?: string };
    await refresh();
    setMessage(result.message || "Checked trading fees.");
  }
  const live = !!state && state.endsAt > state.serverNow;
  const ready = !!state?.enabled;
  return (
    <section className="lp-stream-setup" aria-label="Stream time">
      <h3>Video time for this character</h3>
      <p>
        Pay before generating. Each minute includes 60 seconds of video, one portrait and 20 AI scripts.
        A purchase transfers SOL from your character’s launch wallet to ACP. You can purchase before launching the coin.
        Network fees are additional; the SOL quote allows up to 2% price movement.
      </p>
      {state && (
        <p>
          Unstarted time: {minutes(state.streamSeconds)} · Video allowance: {minutes(state.videoSeconds)}
          {` · Portraits: ${state.portraitCredits} · Scripts: ${state.scriptCredits}`}
          {live ? ` · Active until ${new Date(state.endsAt).toLocaleTimeString()}` : ""}
          {state.walletLamports !== null ? ` · Launch wallet: ${sol(state.walletLamports)} SOL` : ""}
        </p>
      )}
      {state?.sessionId && live && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void run(async () => { await call("stop", { sessionId: state.sessionId }); await refresh(); setMessage("Session ended. Unused time was saved."); })}
        >
          End paid session and save remaining time
        </Button>
      )}
      {state && !state.enabled && <p>Video time opens once streaming is activated. Nothing is being charged.</p>}
      {!viewer.wallet ? (
        <Button onClick={connect}>Connect developer wallet</Button>
      ) : (
        ready && (
          <>
            {state.quotes ? (
              <div className="lp-clip-options" role="group" aria-label="Buy video time">
                {!state.quotes.length && <p>Generation capacity is sold out while ACP replenishes provider credits. No payment will be taken.</p>}
                {state.quotes.map((q) => (
                  <Button
                    key={q.minutes}
                    variant="outline"
                    disabled={busy || !!state.pending.length}
                    onClick={() => void run(() => buy(q))}
                    title={`${q.minutes} minutes for ${sol(q.lamports)} SOL, paid from your launch wallet`}
                  >
                    {q.minutes} min · {sol(q.lamports)} SOL (~${q.usd})
                  </Button>
                ))}
              </div>
            ) : (
              <p>Prices are loading. The SOL price feed is briefly unavailable.</p>
            )}
            <Button variant="outline" disabled={busy || state.feeSetup !== "confirmed"} onClick={() => void run(collect)}>
              Collect trading fees now
            </Button>
          </>
        )
      )}
      {state?.enabled && state.feeSetup !== "confirmed" && (
        <p>Trading-fee collection becomes available after launching your coin and confirming its split.
          <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { await call("setup", {}); await refresh(); })}>Check fee setup</Button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
