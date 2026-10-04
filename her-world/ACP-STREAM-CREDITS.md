# ACP stream-time credits

The developer wallet burns the **shared main ACP token**, never the character coin. Pricing:

| Wall-clock stream time | ACP burned | Requested video allowance |
| --- | ---: | ---: |
| 15 minutes | 50,000 | 900 seconds |
| 30 minutes | 100,000 | 1,800 seconds |
| 45 minutes | 150,000 | 2,700 seconds |
| 1 hour | 200,000 | 3,600 seconds |

The main mint has not been supplied. Purchases require both the exact `ACP_CREDIT_MINT` and `ACP_STREAM_CREDITS_ENABLED=true`. Default: disabled. Do not substitute the pilot character token, the old HER coin, or a guessed mint. These settings are server-only and require a new deployment.

## Receipt and accounting rules

- Signed wallet sessions and character ownership are required for every endpoint. The developer must hold enough main ACP in the standard associated token account and SOL for network fees.
- Review fixes the exact mint, amount, character and unique memo. The wallet signs a BurnChecked transaction. The server accepts only that exact reviewed message, persists its signature before submission, and credits only a successfully finalized, matching receipt.
- Receipt replay cannot award credits twice. Submitted receipts are retained after uncertain RPC responses. Verify the existing receipt rather than making another burn. Unconfirmed/failed submissions require reconciliation before a new purchase; there is no automatic paid retry or assumption that a timeout means failure.
- Credits belong to one character and its developer. The database atomically claims each render and debits its requested duration. Concurrent renders cannot overdraw. Provider errors and unknown submissions retain the debit pending review, preventing free duplicate jobs.
- Video preparation uses the video allowance without starting the stream clock. Publishing starts the server timestamp after WHIP accepts the connection. Retrying the same session does not reset the deadline. An active purchase extends its deadline.
- Normal Stop returns whole unused seconds. Closing/crashing the browser may prevent that request; the clock continues until stopped or expired. Use **End paid session and save remaining time** to recover an abandoned session. No credit refund creates tokens; on-chain burns are permanent.
- The studio stops at expiration, checking the server first for a recent extension. Ending a session from another tab is observed on its next 15-second credit poll.

## Operational limits and activation

This is supervised browser broadcasting. Keep the studio tab open and computer awake. The timer controls ACP's browser publisher and backend generation; it cannot control an unrelated OBS broadcast using the same stream key. A fleet of hosted broadcast workers is not implemented.

The video allowance caps **requested generation seconds**, not a promise of continuously new footage. Existing scenes replay while providers render. The continuous studio still requires its verified five- or ten-minute prepared buffer. Video generation can take minutes, incur provider charges, or fail. Provider funding and the existing funded-creator allowlist remain required. Burns do not pay Higgsfield/Anthropic bills. When credits are enabled, per-wallet daily request limits are 500 videos and 600 scripts in addition to the actual credit balance.

Before enabling sales: supply/verify the main ACP mint and its token program/decimals, verify funded provider access, complete a wallet-reviewed receipt test, verify public Pump playback, stream expiry/recovery and concurrent characters. No real ACP burn or public timed broadcast was tested while the mint was unavailable.

Apply the stream-credit migration and deploy the generated `her-database` allowlist before enabling. Tables live in `her_private`; only `her_web` has access, with RLS as defense in depth. Anonymous and authenticated Supabase clients have no table privileges. Existing gateway custom authentication remains mandatory.

Validation: `node --experimental-transform-types --test scripts/stream-credits.test.mjs scripts/launchpad.test.mjs scripts/burn-validation.test.mjs scripts/burn-amount.test.mjs`. The deployed gateway was additionally checked with isolated disposable database fixtures for duplicate receipts, ownership, session retry/conflict, stop refunds, active extensions, concurrent debit, and render replay. These checks never submit chain transactions or call paid media providers.
