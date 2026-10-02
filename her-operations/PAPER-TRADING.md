# HER autonomous paper experiment

This is an isolated simulation, not real wallet trading. It never signs or sends a
transaction. It has no route to the operator desk, Tavus, OBS, or public Trades.
Do not describe its entries as real purchases or mix its journal with chain data.

The worker searches DEX Screener's sampled Pump.fun/PumpSwap pools every minute and
requires a Jupiter quote in both directions before recording a simulated entry.
Discovery is not a complete launch index. Requiring a Pump DEX plus a `pump` mint
suffix is a conservative screen, not an independent token-origin/security audit.

The experimental rule requires pool age at least one hour, $25,000 liquidity,
$5,000 five-minute volume, 1–10% five-minute price growth, nonnegative hourly
growth, at least ten buys and a buy/sell count ratio of at least 1.2. It ranks by
volume/liquidity and tries at most ten candidates. These are simulation assumptions,
not a validated profitable strategy. No LLM or chat message chooses the trades.

Only one paper position can be open. Simulated exits use a fresh Jupiter reverse
quote, 1% adverse slippage and 0.00001 SOL assumed network cost per side. The same
slippage/cost assumptions apply on entry; aggregator fees already reflected in
quotes are not counted again. Stops: 10% position loss, 20% profit, 30-minute hold,
or the configured daily net loss (realized and unrealized). There is a five-minute
cooldown. Remaining daily loss budget must cover nominal 12% position risk plus
fees before entry. A daily halt stays latched until the next UTC day; its baseline
is the first freshly priced observation that day. Gaps and disappearing routes
can exceed any modeled loss threshold; this is not a guaranteed loss cap.

Missing quotes pause entries and leave positions unpriced, never invent a sale.
Restart resumes the saved paper journal. Corruption/config changes fail closed.
The active streamed coin is excluded when its local config is available at start.

## Local setup (Node 24+)

Inside `her-operations/.sites-runtime/paper-trader/`, create:

- `config.json`: `mode` must be `paper`; `tradeSol`, `dailyLossSol`, and
  `virtualCapitalSol` must be explicit positive decimal **strings**. There are no
  implicit trade-size/loss defaults. Virtual capital is separate from wallet SOL.
- `quotes.env`: only `JUPITER_API_KEY`, for read-only price requests. Never copy a
  wallet key or the full production/studio env into this file.

Run `node --test paper.test.mjs`, then `node run-paper.mjs --once` for one cycle or
`node run-paper.mjs` continuously. Inspect `state.json` for status, virtual cash,
equity, the open position and simulated events (all SOL amounts are lamports).
The last 1,000 events are retained. This worker has no reboot service or supervisor.
It uses an exclusive `worker.lock`; after a crash, verify its recorded PID is dead
before removing the lock. Never start two workers against the same state file.
Stop only this worker with Ctrl+C; the stream is independent.

Sources: [Jupiter quote-only requests](https://developers.jup.ag/docs/swap/order-and-execute)
and [DEX Screener API](https://docs.dexscreener.com/api/reference).
