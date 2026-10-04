# Paid generation and creator-fee funding

Generation requires payment before any portrait, AI script or video request. Editing drafts and writing scripts manually remain free. No automatic free grant is issued when a coin launches.

## Customer flow

1. Save a character and open **Buy generation time**. `/credits/[id]` shows its custodial launch wallet and available packages. Its AES-256-GCM key is bound to character and owner; only the authenticated owner can export it.
2. Deposit SOL. A deposit alone does not purchase credits. Select 5, 10, 15, 20 or 25 minutes to authorize payment to `5psWWm8BAjWBGt54jSn8DgCrQEDnq8FurqbaTAuaCqyi`. Payment works before launching a coin.
3. Each minute grants 60 video seconds, 60 stream seconds, one portrait and 20 AI script requests. Provider requests reserve their allowance before submission. Unknown submissions retain it until reviewed. Checking a saved portrait/video job never resubmits it.
4. Launch a standard SOL-quoted Pump coin from the character wallet with no initial buy. Minimum launch deposit: 0.05 SOL, separate from generation. Locked creator-fee split: 50% ACP and 50% character wallet. This is a share of Pump's creator fees, not a 50% trading tax. Historical coins keep their original settings.
5. Collect accrued fees or deposit SOL, then purchase more time. Purchases are explicit; there is no automatic renewal. Publishing starts the stream clock; stopping saves unused time.

## Prices and spending controls

`ACP_VIDEO_USD_PER_SECOND=0.20` gives $60/$120/$180/$240/$300 for 5/10/15/20/25 minutes. Authenticated Jupiter SOL/USD determines the SOL quote, with its block time checked through Solana RPC. Authenticated Pyth is also supported when PYTH_API_KEY is configured. Missing, stale, future-dated or implausible prices are rejected. Production ignores the development price override. Purchases require a valid maximum lamport amount and stable UUID; the UI permits at most 2% movement above its displayed quote. Network fees are additional.

`ACP_PUBLIC_GENERATION_ENABLED=false` keeps the `HER_LAUNCHPAD_CREATOR_WALLETS` pilot allowlist. Public activation also requires `ACP_STREAM_CREDITS_ENABLED=true` and a positive provider budget; it never bypasses paid allowances.

`ACP_PROVIDER_BUDGET_USD` is a **lifetime funded fulfillment ceiling**, not a daily reset. SQL atomically reserves $10.70 per purchased minute: conservative $0.17/video second, $0.10/portrait and $0.02/script. Only packages fitting remaining capacity are offered. Failed/expired payments release capacity once; successful payments keep it reserved, including after consumption. Increase this ceiling only after actual provider top-ups. Never zero the reservation ledger. SOL revenue does not automatically refill Higgsfield or the script provider.

Higgsfield's model page on October 4 listed Kling O3 Image Reference at $0.084/second before a temporary account discount. The reserve leaves room for audio/model price differences and image/script requests. Recheck actual billed costs before changing models or prices. Reference: https://open.higgsfield.ai/models/kling-video/o3/image-reference/playground

## Financial durability

- One pending payment per character and a permanent unique request ID prevent concurrent charges and replay.
- Persist signature, validity height and capacity reservation before sending. A clock timeout never expires a transaction.
- Reconcile history and finalized block height. RPC failures remain unknown; do not resubmit as a new payment.
- Payment and allowances are credited in one SQL statement. Polling only reconciles saved signatures.
- Fee setup and collection persist claims before sending; unknown collection is pending, not empty.
- Owner-scoped queries, authenticated mutation guards and private RLS protect records. Secrets never enter public assets.

## Deployment and verification

Apply `20261004230000_acp_fee_funded_video.sql` then `20261004233000_acp_paid_generation.sql`; regenerate/deploy the `her-database` allowlist. Preserve custom server authentication and existing credentials. Back up the 32-byte base64 `ACP_LAUNCH_WALLET_KEY`, stored as Sensitive Production. Never replace an existing key without a wallet migration.

The migration and gateway have been exercised on the real project with disposable unfunded fixtures. Tests cover purchase races, owner isolation, request replay, exactly-once credits, generation overdrafts and session refunds. `scripts/fee-funding-integration.mjs` requires disposable fixture records and the actual gateway credential; it sends no chain transactions.

Before opening publicly, verify a real checkout, the current SOL coin launch, locked split and fee collection. Synthetic tests do not prove chain operations or public streaming. Keep the public flag off until these checks and provider funding pass. The historical NVDAX coin does not verify the new SOL/custodial flow.

## Operational limits

Provider top-ups are manual. Maintain Higgsfield and script balances separately. Video generation takes minutes. This change does not obtain Pump stream credentials or prove simultaneous public streams. Preserve stopped broadcasts unless explicitly instructed to start them.
