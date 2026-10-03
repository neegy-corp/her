# ACP — Artificial Character Protocol

The public application is now branded ACP. Existing HER database names, environment variables, domain and `/collective` remain compatible. No funded signing credential belongs in this launchpad or its broadcast studios.

## Current implementation

- `/developer` is the wallet owner's dashboard. `/create` starts a blank character; `/create/<id>/character`, `/personality`, `/scene`, `/show`, `/artwork`, and `/launch` (under the same character prefix) are separate editor pages. `/tokens` is the public directory and `/studio/<id>` is the broadcaster. Route navigation preserves local edits and only loads cloud characters owned by the verified wallet.
- Original character identity, personality, background, voice selection and an eight-scene editable show. Unfinished drafts can be saved to a wallet; provider and launch operations still validate their required fields.
- Higgsfield API integration: Soul 2 portraits and Kling O3 reference videos with native sound. One to four uploaded reference views go to the video model. Paid jobs are claimed durably before submission; status checks do not resubmit. Completed Higgsfield images/videos are copied to Vercel Blob before being marked ready. Provider host checks and bounded streams protect media downloads. The funded pilot produced a portrait and a 5.04-second 1080×1920, 24-fps video with non-silent stereo audio; browser playback reached the end and the authenticated studio manifest reported ready. Video generation took several minutes, so this is not instant live conversation. Public Pump playback and simultaneous public streams remain unverified pending coin-specific credentials.
- Separate coin PFP and banner uploads. Artwork never enters the character-reference set. References use four database-enforced slots: one frontal image plus three additional views for Kling v3. Each image is limited to 4 MiB, PNG/JPEG/WebP.
- AI scene-writing endpoint (`ACP_SCRIPTS_ENABLED`) uses Claude when `ANTHROPIC_API_KEY` is configured, with a forced scene tool, strict validation, owner authentication, provider quota and untrusted-chat separation. OpenAI remains an optional fallback only when Claude is not configured; a failed paid request is never retried through another provider. Dialogue duration expands to accommodate word count. Scenes can be reviewed before rendering.
- Durable video submission records, no automatic retry of an ambiguous paid submission, and owner-scoped render polling.
- NVDAX Pump `create_v2`, exact quote mint `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh`, Token-2022 resolved on chain, 100 basis-point creator fee, no initial buy, no cashback or holder rewards.
- Creator/fee recipient: `6n3erAFxnvfjsAfbPdabwnpvfGpi2RW5Z8Yk1AYspzXs`. This is the **on-chain creator**, not merely an off-chain referral. The launching wallet is the transaction payer. Fees accrue in the Pump creator vault in NVDAX and require collection by the platform wallet. Pump protocol/LP fees are additional; this is not a transfer tax or a guaranteed fee on unrelated DEX trades. Pump can change fee configuration; every preparation and submission checks the live settings.
- `/studio/<character-id>` provides an authenticated, experimental browser broadcaster with a single Go Live action after entering the coin’s WHIP URL and stream key. Prepared scenes and a confirmed character coin are required; portrait and landscape output retain the entire clip with a blurred backdrop. Each character has its own show runner, video/audio capture, chat room, WHIP connection and stop control. The same browser cannot open two active runners for the same character. A shared durable lease across different machines is still required for unattended hosting.
- Continuous mode prepares a 5- or 10-minute fresh-video buffer (up to 48 scenes). Preparation saves each script and resumes from durable render records, with two video requests at a time. Broadcast preflight checks actual media durations, not just requested durations.
- The continuous runner keeps playback independent from two background generation jobs. It collects each coin's recent comments for the configured chat window (30 seconds by default), groups repeated suggestions by distinct viewers, and sends the batch plus recent scene history to the scene writer. Completed audience scenes get the next clip boundary. Used comments are claimed before submitting a paid job; stale, duplicate and other-coin comments are excluded. Quiet-chat continuations are paced and use at most one slot, leaving the other available for chat. A second video element preloads the next clip while the current clip plays. There is no automatic stream shutdown. Keep the studio tab open and the computer awake.
- The saved new-video limit caps additional paid requests, including ambiguous failures. A provider error pauses generation without stopping playback or automatically retrying a paid request. Once fresh content runs out, existing scenes replay with a visible replay label. This is continuity fallback, not fresh real-time video generation. Provider rendering is currently substantially slower than playback.
- WHIP keys stay in tab memory. They are not stored in browser storage, backend drafts, URLs or logs. The studio reports transport byte/frame progress separately from public playback. It does not claim that an accepted WHIP request proves Pump playback.

## Deployment state and outstanding gates

Storage migration `20261003034000_acp_artwork.sql` and the updated allowlist gateway were applied to the existing Supabase project. The fixture records used for gateway verification were removed.

Vercel Blob `acp-media` is connected to Production. Image, video and script gates are enabled for an explicitly allowlisted pilot wallet after funding. Claude is stored as a Sensitive Production secret. Face-training remains off. `broadcast:false` remains intentional: the browser studio is not an unattended cloud service and no public test broadcast has been verified.

The invented starter cast has been removed from the homepage and creation defaults. New characters begin blank; existing private drafts are preserved. `/tokens` lists only confirmed matching coin records with public artwork and Pump links. The directory gateway query is deployed and verified. The Higgsfield provider constraint migration is applied with existing RLS and server-role permissions preserved; claims and deduplication were checked through the actual gateway. See `AI-VIDEO-REFERENCES.md` for observations of the X references; their original provider is not established.

The user-authorized isolated test wallet was used privately for a single mainnet test launch after signed simulation, a 0.05 SOL cost ceiling, and no initial buy. Coin `DyZzyejVNNmKHX1UsUWBXcJoBTb8Wb1bXoNAnKPFRDhg` is confirmed; its NVDAX quote mint, platform creator and 100-bps fee were verified on chain. It is visible on Pump and `/tokens`. The test spent 0.00776716 SOL. The key was never uploaded to ACP, Vercel or Git. No new public livestream was submitted. The existing stopped HER broadcast stays stopped.

### Funding and setup

1. [Higgsfield API billing](https://open.higgsfield.ai/billing): a $20 API top-up was verified. `HF_API_KEY` is installed as a Sensitive Production secret. A real Soul 2 portrait completed and was persisted to Blob through ACP. Image/video gates are restricted by `HER_LAUNCHPAD_CREATOR_WALLETS`; do not open them globally without per-user credit accounting.
2. Claude script writing and chat-scene planning are connected with `ANTHROPIC_API_KEY`, `ACP_SCRIPTS_ENABLED` and `ACP_SCRIPT_MODEL=claude-haiku-4-5-20251001`. Real opening, viewer reply and audience recommendation requests passed through the deployed ACP endpoint. Manual scripts work without it. OpenAI is optional, not an additional required purchase.
3. Tavus is optional for trained speaking faces/stock voices. When no trained Tavus face is configured, Higgsfield renders spoken replies as reference videos with native audio; Tavus stock voice selection does not control Higgsfield's generated voice. Existing fal integration is a fallback when Higgsfield is absent.
4. Vercel Blob is connected. Reference/PFP/banner uploads are available to verified creator wallets, capped at 15 per wallet/day and 200 across the platform/day. Usage charges follow the existing Vercel plan; no plan was upgraded.
5. [Cloud server](https://console.hetzner.com/): required for unattended multi-character broadcasting. No instance was purchased. Browser tabs are a supervised pilot, not a production worker fleet.
6. Connect a permitted pilot wallet. Review and sign the coin deployment in that wallet. Verify Pump's creator/stream permissions when the platform wallet is the on-chain creator, and obtain each coin's own stream credentials. Never reuse an old coin's key to imply a new coin is live.

Before enabling public paid generation or unattended hosting: add durable worker leases and recovery, per-creator credit accounting, deletion/retention controls, moderation and the verified Pump stream provisioning flow. Verify clip CORS, voice identity and audio sync with funded actual renders. User uploads are public provider-accessible media URLs, disclosed in the editor.

## Verification

Continuous-runner tests cover ten simulated minutes, slow renders, clip-boundary replies, generation failure, request limits, stop cancellation and isolated token queues. They do not establish ten minutes of actual fresh provider output or public Pump playback. The funded pilot currently has one five-second generated clip; preparing a full buffer requires additional paid rendering. The longer-document migration and 150-render query allowlist are deployed with RLS preserved.

`node --experimental-transform-types --test scripts/launchpad.test.mjs scripts/operator.test.mjs scripts/wallet-reader.test.mjs scripts/trades.test.mjs scripts/burn-amount.test.mjs scripts/burn-validation.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit --incremental false`

`node node_modules/next/dist/bin/next build --webpack`

`node scripts/acp-pair-check.mjs` reads current Pump configuration without any wallet secret or transaction submission.

`node scripts/acp-simulate-coin.mjs <public-payer>` only simulates an unsigned transaction. It cannot deploy a coin. A funded test-wallet simulation passed at 156,858 compute units; a separate signed simulation preceded the confirmed pilot launch.

The real gateway integration check covers tenant isolation, render claims, reference slot limits, artwork separation and rejection of unowned image URLs. SDK tests decode the actual create instruction and check quote token program, fee recipient and 100 bps. Multi-show tests use injected mock playback/provider adapters; they are not public-stream evidence.

## Sources

- [Pump supported pairs](https://pump.fun/docs/custom-pairs)
- [Pump coin creation specification](https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md)
- [Kling v3 image/reference schema](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api)
- [WHIP protocol](https://www.rfc-editor.org/rfc/rfc9725.html)
