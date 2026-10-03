# ACP — Artificial Character Protocol

The public application is now branded ACP. Existing HER database names, environment variables, domain and `/collective` remain compatible. No funded signing credential belongs in this launchpad or its broadcast studios.

## Current implementation

- `/developer` is the wallet owner's dashboard. `/create` starts a blank character; `/create/<id>/character`, `/personality`, `/scene`, `/show`, `/artwork`, and `/launch` (under the same character prefix) are separate editor pages. `/tokens` is the public directory and `/studio/<id>` is the broadcaster. Route navigation preserves local edits and only loads cloud characters owned by the verified wallet.
- Original character identity, personality, background, voice selection and an eight-scene editable show. Unfinished drafts can be saved to a wallet; provider and launch operations still validate their required fields.
- Higgsfield API integration: Soul 2 portraits and Kling O3 reference videos with native sound. One to four uploaded reference views go to the video model. Paid jobs are claimed durably before submission; status checks do not resubmit. Completed Higgsfield images/videos are copied to Vercel Blob before being marked ready. Provider host checks and bounded streams protect media downloads. Actual funded generation remains an acceptance gate.
- Separate coin PFP and banner uploads. Artwork never enters the character-reference set. References use four database-enforced slots: one frontal image plus three additional views for Kling v3. Each image is limited to 4 MiB, PNG/JPEG/WebP.
- AI scene-writing endpoint (`ACP_SCRIPTS_ENABLED`) with bounded output, owner authentication, provider quota and untrusted-chat separation. Scenes can be reviewed before rendering.
- Durable video submission records, no automatic retry of an ambiguous paid submission, and owner-scoped render polling.
- NVDAX Pump `create_v2`, exact quote mint `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh`, Token-2022 resolved on chain, 100 basis-point creator fee, no initial buy, no cashback or holder rewards.
- Creator/fee recipient: `6n3erAFxnvfjsAfbPdabwnpvfGpi2RW5Z8Yk1AYspzXs`. This is the **on-chain creator**, not merely an off-chain referral. The launching wallet is the transaction payer. Fees accrue in the Pump creator vault in NVDAX and require collection by the platform wallet. Pump protocol/LP fees are additional; this is not a transfer tax or a guaranteed fee on unrelated DEX trades. Pump can change fee configuration; every preparation and submission checks the live settings.
- `/studio/<character-id>` provides an authenticated, experimental browser broadcaster with a single Go Live action after entering the coin’s WHIP URL and stream key. Prepared scenes and a confirmed character coin are required; portrait and landscape output retain the entire clip with a blurred backdrop. Each character has its own show runner, video/audio capture, chat room, WHIP connection and stop control. The same browser cannot open two active runners for the same character. A shared durable lease across different machines is still required for unattended hosting.
- The continuous canvas/audio output survives clip transitions and retains the last frame while a new clip is generated. Generated video replies read one viewer at a time during pauses. Generation is serialized, and a full script finishes before audience-driven scenes begin.
- WHIP keys stay in tab memory. They are not stored in browser storage, backend drafts, URLs or logs. The studio reports transport byte/frame progress separately from public playback. It does not claim that an accepted WHIP request proves Pump playback.

## Deployment state and outstanding gates

Storage migration `20261003034000_acp_artwork.sql` and the updated allowlist gateway were applied to the existing Supabase project. The fixture records used for gateway verification were removed.

Vercel Blob `acp-media` is connected to Production. The Pump coin-creation gate is enabled after a live NVDAX/100-bps capability check and a successful real unsigned creation-transaction preparation through the deployed API. No coin transaction was signed or submitted. Paid image/video/face/script gates remain disabled pending funding. `broadcast:false` remains intentional: the browser studio is not an unattended cloud service and no public test broadcast has been verified.

The invented starter cast has been removed from the homepage and creation defaults. New characters begin blank; existing private drafts are preserved. `/tokens` lists only confirmed matching coin records with public artwork and Pump links. The directory gateway query is deployed and verified. The Higgsfield provider constraint migration is applied with existing RLS and server-role permissions preserved; claims and deduplication were checked through the actual gateway. See `AI-VIDEO-REFERENCES.md` for observations of the X references; their original provider is not established.

No supplied test-wallet private key was imported or used. No actual mainnet transaction or new public livestream was submitted. The existing stopped HER broadcast stays stopped.

### Funding and setup

1. [Higgsfield API billing](https://open.higgsfield.ai/billing): minimum $5 prepaid top-up observed at setup. API billing is separate from the consumer website subscription. `HF_API_KEY` is installed as a Sensitive Production secret and an authenticated read returned 200. Its balance was $0 at setup. Enable image/video flags only after funding and add approved pilot wallets to `HER_LAUNCHPAD_CREATOR_WALLETS`. Do not create a second key unnecessarily.
2. [OpenAI API billing](https://platform.openai.com/settings/organization/billing/overview): AI script writing and chat-scene planning still need `OPENAI_API_KEY` and `ACP_SCRIPTS_ENABLED`. Manual scripts work without it. ChatGPT subscriptions do not configure this site's API account. OpenAI portrait generation remains a fallback when Higgsfield is absent.
3. Tavus is optional for trained speaking faces/stock voices. When no trained Tavus face is configured, Higgsfield renders spoken replies as reference videos with native audio; Tavus stock voice selection does not control Higgsfield's generated voice. Existing fal integration is a fallback when Higgsfield is absent.
4. Vercel Blob is connected. Reference/PFP/banner uploads are available to verified creator wallets, capped at 15 per wallet/day and 200 across the platform/day. Usage charges follow the existing Vercel plan; no plan was upgraded.
5. [Cloud server](https://console.hetzner.com/): required for unattended multi-character broadcasting. No instance was purchased. Browser tabs are a supervised pilot, not a production worker fleet.
6. Connect a permitted pilot wallet. Review and sign the coin deployment in that wallet. Verify Pump's creator/stream permissions when the platform wallet is the on-chain creator, and obtain each coin's own stream credentials. Never reuse an old coin's key to imply a new coin is live.

Before enabling public paid generation or unattended hosting: add durable worker leases and recovery, per-creator credit accounting, deletion/retention controls, moderation and the verified Pump stream provisioning flow. Verify clip CORS, voice identity and audio sync with funded actual renders. User uploads are public provider-accessible media URLs, disclosed in the editor.

## Verification

`node --experimental-transform-types --test scripts/launchpad.test.mjs scripts/operator.test.mjs scripts/wallet-reader.test.mjs scripts/trades.test.mjs scripts/burn-amount.test.mjs scripts/burn-validation.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit --incremental false`

`node node_modules/next/dist/bin/next build --webpack`

`node scripts/acp-pair-check.mjs` reads current Pump configuration without any wallet secret or transaction submission.

`node scripts/acp-simulate-coin.mjs <public-payer>` only simulates an unsigned transaction. It cannot deploy a coin. The available public test-payer simulations did not succeed: one payer account was absent, and the existing project wallet lacked sufficient rent balance. This does not determine the balance of the user's separately supplied test key, which was not imported.

The real gateway integration check covers tenant isolation, render claims, reference slot limits, artwork separation and rejection of unowned image URLs. SDK tests decode the actual create instruction and check quote token program, fee recipient and 100 bps. Multi-show tests use injected mock playback/provider adapters; they are not public-stream evidence.

## Sources

- [Pump supported pairs](https://pump.fun/docs/custom-pairs)
- [Pump coin creation specification](https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md)
- [Kling v3 image/reference schema](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api)
- [WHIP protocol](https://www.rfc-editor.org/rfc/rfc9725.html)
