"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AcpNav, AcpFooter } from "./acp-nav";
import type { PublicToken } from "@/lib/public-tokens";
import "./launchpad.css";
import "./acp-pages.css";
export default function TokenDirectory() {
  const [tokens, setTokens] = useState<PublicToken[]>([]),
    [next, setNext] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
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
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Unable to load tokens.");
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
        <div className="acp-directory-heading">
          <div>
            <span className="lp-kicker">THE ACP DIRECTORY</span>
            <h1>
              The characters.
              <br />
              <em>Their coins.</em>
            </h1>
            <p>
              Every confirmed ACP token launch, with a direct link to pump.fun.
              A listed coin does not mean its stream is currently live.
            </p>
          </div>
          <Link className="lp-primary" href="/create">
            Create a character ↗
          </Link>
        </div>
        <div className="acp-token-tools">
          <input
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
            <button
              className="lp-primary"
              onClick={() => void load(tokens.length ? next || 0 : 0)}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}
        {loading && !tokens.length ? (
          <div className="acp-token-empty" role="status">
            Loading confirmed launches…
          </div>
        ) : !error && !tokens.length ? (
          <div className="acp-token-empty">
            <span>✳</span>
            <h2>The first launch is still ahead.</h2>
            <p>
              No ACP-created tokens have been confirmed yet. Draft characters
              appear in your studio until their coin creation is confirmed
              on-chain.
            </p>
            <Link className="lp-primary" href="/create">
              Open the creation studio ↗
            </Link>
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
                      View on pump.fun ↗
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
            <button
              className="lp-primary"
              disabled={loading}
              onClick={() => void load(next)}
            >
              {loading ? "Loading…" : "Load more tokens"}
            </button>
          </div>
        )}
      </section>
      <AcpFooter />
    </main>
  );
}
