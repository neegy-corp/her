# HER

AI livestream host for pump.fun, with a public character-voting site at https://heronsol.live.

## Current implementation

- Olivia, Maya and Ivy each have their own Tavus face, native voice and personality.
- The studio reads one viewer comment at a time, including the sender, and preserves conversation history and host identity across reconnects and character switches.
- New hosts acknowledge real character changes once; routine renewals do not reintroduce the host.
- Wallet-connected visitors can burn at least 10,000 HER, with larger custom amounts supported. Verified totals determine each 30-minute round's character. Ties and empty rounds retain the selection.
- Supabase stores wallet sessions, burn intents, finalized receipts and round state. The private controller prepares the replacement video before retiring the previous session.
- Camera connections retry indefinitely with bounded backoff. A supervisor restarts a crashed studio. OBS automatic stop timing is disabled, with reconnect enabled.

The video model is **Tavus Phoenix 4.5**, not Griffin. The host discusses learning through simulated trading; no real trade execution or deposits are implemented. Stage access remains disabled until separately configured.

## Repository layout

| Directory | Contents |
| --- | --- |
| `her/` | Studio, Tavus integration, chat relay, personalities, handovers and recovery |
| `her-world/` | Website, wallet connection, verified burns, rounds, Supabase functions and migrations |
| `her-operations/` | Read-only pump.fun reader and Windows/OBS setup tools |
| `assets/` | Earlier artwork; current character images are in the projects' public directories |

Studio source snapshot: `f59ccf4`. Website source snapshot: `2489dc6`. Both include additional environment-template documentation in this combined snapshot. Earlier dated app/operations notes are historical; this README and the recovery/burn documents describe current behavior.

## Local setup

Requires Node.js 24+, npm, Windows and OBS with WHIP support.

1. Run `npm ci` in `her/`, copy `.env.example` to `.env`, and configure Tavus. `HER_VOICE_MODE=face` preserves each character's voice.
2. Run `./Start-HER.ps1 -Mint <coin-mint>` in `her-operations/`. Match the studio relay credential to the generated local relay credential and set `PUMP_CHAT_FEED_URL=http://127.0.0.1:4501/feed`.
3. Set the same private `HER_CONTROL_TOKEN` in the studio and website server environments.
4. Run `node scripts/run-studio.mjs` in `her/` to supervise the studio on port 5173.
5. OBS uses `http://127.0.0.1:5173/?camera=1`, 1920x1080, 30 fps, with browser audio. **Opening this source starts paid Tavus sessions when configured.** Enter stream credentials directly in OBS.

Tavus calls rotate before their ten-minute limit; this is not an overall stream stop timer. See [recovery operations](her/STREAM-RECOVERY.md). To shut down intentionally, stop OBS, end the avatar session, stop the supervisor and its child, and run `Stop-HER.ps1`.

## Public website

Run `npm ci` in `her-world/` and configure its environment template. See [burn voting](her-world/BURNS.md), SQL in `her-world/db/`, migrations in `her-world/supabase/migrations/`, and the `her-database` Edge Function. The gateway targets the existing Supabase project; forks must change the endpoint and provision their own database and roles.

The website runs on Vercel. External Solana wallets connect through the Turnkey bridge without email signup. Managed Turnkey organization/auth proxy IDs must be configured separately if that optional flow is enabled. Burns remain disabled in the template until the mint, RPC, database and live controller are ready.

## Verification

- Studio: `npx tsc --noEmit` and `node --test tests/*.test.mjs` (17 tests).
- Reader: `node --test reader.test.mjs` in `her-operations/`.
- Website: `npx tsc --noEmit`, `node --test scripts/burn-amount.test.mjs scripts/burn-validation.test.mjs`, and `npm run build` in `her-world/`. Wallet integration tests require a configured local app and database.

Prior checks include production wallet auth, rollback-only settlement tests, live handovers and studio crash recovery. No real user tokens were burned in testing.

## Credentials and uptime

Credentials, browser sessions, logs, recordings, runtime state and dependencies are excluded. Configure credentials separately on each deployment. Pushing this snapshot does not itself redeploy running services.

The computer, OBS, internet and provider account must remain available. Recovery cannot guarantee service during power loss, exhausted credit or provider outages. Tavus usage and handover overlap can incur charges; recovery does not purchase or change plans.
