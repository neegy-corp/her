"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AcpNav, AcpFooter } from "./acp-nav";
import type { PublicToken } from "@/lib/public-tokens";
import "./launchpad.css";
import "./acp-pages.css";
export default function TokenDirectory() {
  const [tokens, setTokens] = useState<PublicToken[]>([]),
    [next, setNext] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [configured, setConfigured] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  async function load(offset = 0) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/launchpad/tokens?offset=${offset}`);
      const body = (await response.json()) as {
        tokens: PublicToken[];
        nextOffset: number | null;
        configured?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Unable to load tokens.");
      setConfigured(body.configured !== false);
      setTokens((p) =>
        offset
          ? [
              ...new Map(
                [...p, ...body.tokens].map((t: PublicToken) => [t.mint, t]),
              ).values(),
            ]
          : body.tokens,
      );
      setNext(body.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load tokens.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const query = search.trim().toLowerCase(),
    visible = tokens.filter((t) =>
      `${t.name} ${t.symbol} ${t.mint}`.toLowerCase().includes(query),
    );
  return (
    <main className="lp acp-pages">
      <AcpNav active="tokens" />
      <section className="acp-directory">
        <div className="acp-directory-heading acp-art-heading">
          <img className="acp-heading-art" src="/images/acp-v2/discovery.webp" alt="" />
          <div>
            <h1>
              The characters.
              <br />
              <em>Their coins.</em>
            </h1>
            <p>
              Every confirmed ACP token launch, with a direct link to pump.fun.
              A listed coin does not mean its stream is currently live.
            </p>
            <Button asChild><Link href="/create">
              Create a character <ArrowUpRight size={14} aria-hidden="true" />
            </Link></Button>
          </div>
        </div>
        <div className="acp-token-tools">
          <Input
            aria-label="Search loaded tokens"
            placeholder="Search name, ticker or contract…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>
            {tokens.length} confirmed{" "}
            {tokens.length === 1 ? "launch" : "launches"} loaded
          </span>
        </div>
        {error && (
          <div className="acp-token-empty" role="alert">
            <h2>Couldn’t load the directory.</h2>
            <p>{error}</p>
            <Button
              onClick={() => void load(tokens.length ? next || 0 : 0)}
              disabled={loading}
            >
              Retry
            </Button>
          </div>
        )}
        {loading && !tokens.length ? (
          <div className="acp-token-empty" role="status">
            Loading confirmed launches…
          </div>
        ) : !error && !tokens.length ? (
          <div className="acp-token-empty">
            <h2>{configured ? "The first launch is still ahead." : "The directory isn’t connected here yet."}</h2>
            <p>
              {configured ? "No ACP-created tokens have been confirmed yet. Draft characters stay in your studio until their coin launch is confirmed on-chain." : "This local preview includes the directory interface. Confirmed launches appear when its database is connected. You can create and save character drafts on this device now."}
            </p>
            <Button asChild><Link href="/create">
              Open the creation studio <ArrowUpRight size={14} aria-hidden="true" />
            </Link></Button>
          </div>
        ) : (
          <>
            <div className="acp-token-grid">
              {visible.map((t) => (
                <article className="acp-token-card" key={t.mint}>
                  <div className="acp-token-cover">
                    {t.banner && (
                      <img
                        src={t.banner}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="acp-token-card-body">
                    <div className="acp-token-identity">
                      {t.pfp ? (
                        <img
                          src={t.pfp}
                          alt={`${t.name} token artwork`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="acp-token-monogram">{t.name[0]}</span>
                      )}
                      <div>
                        <h2>{t.name}</h2>
                        <small>${t.symbol}</small>
                      </div>
                    </div>
                    <p>{t.description}</p>
                    <code>{t.mint}</code>
                    <a
                      href={t.pumpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on pump.fun <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            {!visible.length && tokens.length > 0 && (
              <p role="status">
                No matches in the loaded tokens.{" "}
                {next !== null
                  ? "Load more to search additional launches."
                  : ""}
              </p>
            )}
          </>
        )}
        {next !== null && (
          <div className="acp-directory-more">
            <Button
              disabled={loading}
              onClick={() => void load(next)}
            >
              {loading ? "Loading…" : "Load more tokens"}
            </Button>
          </div>
        )}
      </section>
      <AcpFooter />
    </main>
  );
}
