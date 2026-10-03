# ACP — Artificial Character Protocol

The public application is now branded ACP. Existing HER database names, environment variables, domain and `/collective` remain compatible. No funded signing credential belongs in this launchpad or its broadcast studios.

## Current implementation

- Original character identity, personality, background, voice selection and an eight-scene editable show.
- Separate coin PFP and banner uploads. Artwork never enters the character-reference set. References use four database-enforced slots: one frontal image plus three additional views for Kling v3. Each image is limited to 4 MiB, PNG/JPEG/WebP.
- AI scene-writing endpoint (`ACP_SCRIPTS_ENABLED`) with bounded output, owner authentication, provider quota and untrusted-chat separation. Scenes can be reviewed before rendering.
- Durable video submission records, no automatic retry of an ambiguous paid submission, and owner-scoped render polling.
- NVDAX Pump `create_v2`, exact quote mint `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh`, Token-2022 resolved on chain, 100 basis-point creator fee, no initial buy, no cashback or holder rewards.
- Creator/fee recipient: `6n3erAFxnvfjsAfbPdabwnpvfGpi2RW5Z8Yk1AYspzXs`. This is the **on-chain creator**, not merely an off-chain referral. The launching wallet is the transaction payer. Fees accrue in the Pump creator vault in NVDAX and require collection by the platform wallet. Pump protocol/LP fees are additional; this is not a transfer tax or a guaranteed fee on unrelated DEX trades. Pump can change fee configuration; every preparation and submission checks the live settings.
- `/studio/<character-id>` provides an authenticated, experimental browser broadcaster. Each character has its own show runner, video/audio capture, chat room, WHIP connection and stop control. The same browser cannot open two active runners for the same character. A shared durable lease across different machines is still required for unattended hosting.
- The continuous canvas/audio output survives clip transitions and retains the last frame while a new clip is generated. Generated video replies read one viewer at a time during pauses. Generation is serialized, and a full script finishes before audience-driven scenes begin.
- WHIP keys stay in tab memory. They are not stored in browser storage, backend drafts, URLs or logs. The studio reports transport byte/frame progress separately from public playback. It does not claim that an accepted WHIP request proves Pump playback.

## Deployment state and outstanding gates

Storage migration `20261003034000_acp_artwork.sql` and the updated allowlist gateway were applied to the existing Supabase project. The fixture records used for gateway verification were removed.

Paid image, video, face, script and coin-creation gates remain disabled until provider funding and acceptance checks are complete. `broadcast:false` remains intentional: the browser studio is not an unattended cloud service and no public test broadcast has been verified.

The new fictional Jean-Paul portrait at `/images/acp-jean-paul.png` was generated using the assistant's image tool. Its included scripts are authored starter examples. Neither is proof that the application's paid media APIs have been exercised. No Jean-Paul video has yet been rendered by those APIs.

No supplied test-wallet private key was imported or used. No actual mainnet transaction or new public livestream was submitted. The existing stopped HER broadcast stays stopped.

### Funding and setup

1. [fal credits](https://fal.ai/dashboard/billing): Kling performance clips. Store `FAL_KEY` server-side, never in chat or client code.
2. [OpenAI API billing](https://platform.openai.com/settings/organization/billing/overview): image generation and scene writing. Store `OPENAI_API_KEY` server-side. ChatGPT subscriptions do not configure this site's API account.
3. Tavus: custom trained speaking faces and voice-led replies require active API access/credits; do not substitute stock-face IDs for custom faces without an explicit choice.
4. Vercel Blob: provision storage and its server-side token before cloud image upload or coin metadata creation.
5. [Cloud server](https://console.hetzner.com/): required for unattended multi-character broadcasting. No instance was purchased. Browser tabs are a supervised pilot, not a production worker fleet.
6. Connect a permitted pilot wallet. Review and sign the coin deployment in that wallet. Verify Pump's creator/stream permissions when the platform wallet is the on-chain creator, and obtain each coin's own stream credentials. Never reuse an old coin's key to imply a new coin is live.

Before enabling public self-service: add durable worker leases and recovery, per-creator credit accounting, persistent rendered-media storage, deletion/retention controls, moderation and the verified Pump stream provisioning flow. Verify clip CORS, custom voice identity and audio sync with funded actual renders. User uploads are public provider-accessible media URLs, disclosed in the editor.

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
