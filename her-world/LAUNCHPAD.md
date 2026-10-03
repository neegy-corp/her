# HER character launchpad

## Implemented

- Character, personality/voice, background, and show editor at `/`; existing HER features preserved at `/collective`.
- Versioned browser drafts including incomplete forms; reference photos stored on-device in IndexedDB.
- Wallet-authenticated Supabase drafts. Private tables, server role only, owner-scoped reads/writes, same-origin mutations.
- Up to eight scripted scenes with dialogue, action directions, selected duration, and a chat break after each.
- Explicit photo upload (PNG/JPEG/WebP, 4 MiB each), provider-readable public media URLs, and consent checkbox. First uploaded photo becomes the character portrait. Public media links are not private storage.
- Paid provider adapters: OpenAI portrait generation, Tavus image-to-face and scripted speech videos, fal Kling 3 Pro image-to-video action clips. Credentials stay server-side.
- Durable render claims before paid submission. Identical clip requests deduplicate; ambiguous submissions remain `submitting` for reconciliation. Refresh polls jobs without resubmitting them. Daily pilot quotas and a wallet allowlist limit sponsored usage.
- Official Pump SDK coin preparation with no initial buy. Creator reviews/signs their own transaction; exact message/signatures checked server-side; signature persisted before submission and reconciled afterward.
- Pure show scheduler in `lib/show.ts`: all clips must be ready, script plays in order, one chat reply during a pause, wait for speech to finish, collect recommendations after the script, and stop at the creator's generation limit. Chat is bounded, deduplicated and kept as untrusted data.

## Not yet operational

The scheduler is tested code, **not an installed broadcast runner**. There is no multi-tenant stream worker, stream-key onboarding, real Pump chat integration for creator shows, model call generating the next audience scene, creator payment ledger, or automatic public livestream. `broadcast` always reports false. No prototype state should be advertised as a running stream.

Motion-video speech can vary from the selected Tavus voice and may not reproduce dialogue exactly. Use scripted-speech clips when exact words and a consistent face voice matter. Clips require preview before publication. Generated-video links currently remain with providers and may expire; production broadcasting needs durable caching of completed output.

Automatic launch cannot be enabled merely by setting flags. Before public availability:
1. Provision a dedicated broadcaster with per-character process/session isolation, durable leases and resume state, media cache, health/bitrate checks, and encrypted stream destination storage. Vercel serves the site/API, not the continuous media process.
2. Obtain legitimate Pump livestream access for each creator/coin. No documented public stream-key issuance API was verified; do not infer access from mint creation.
3. Wire `lib/show.ts` to real playback-ended and speech-ended events, the per-coin authenticated chat reader, safe recommendation generation, render jobs, and an uninterrupted output mixer.
4. Implement prepaid creator credits, a cost ledger, per-show budgets, moderation and deletion/retention controls before removing the pilot allowlist.
5. Test rendered speech/motion, reference consistency, chat handovers, restart recovery, public Pump playback and actual output bitrate with a funded owner-authorized pilot. Automated tests do not establish any of those outcomes.

The former HER livestream remains stopped. No paid generation or mainnet transaction is part of the test suite.

## Configuration and activation

See `.env.example`. Only `HER_LAUNCHPAD_ENABLED` is needed for wallet drafts after the migration and gateway are deployed. Preserve all existing environment values. Provider flags default off and need real server credentials. `HER_LAUNCHPAD_CREATOR_WALLETS` is an exact comma-separated wallet allowlist for upload and paid generation. It is not a public credit system.

Storage: connect Vercel Blob to the project for `BLOB_READ_WRITE_TOKEN`. Uploads currently use public random object URLs because media providers must fetch them. Never upload secrets or sensitive reference material.

- Motion generation: [fal account/credits](https://fal.ai/dashboard/billing), `FAL_KEY`.
- Talking faces and speech: [Tavus Developer plans](https://www.tavus.io/pricing), `TAVUS_API_KEY`.
- Optional prompted portraits: [OpenAI API billing](https://platform.openai.com/settings/organization/billing/overview), `OPENAI_API_KEY`.
- Broadcast host candidate: [Hetzner Cloud](https://www.hetzner.com/cloud/). Select and benchmark a CPU/memory allocation for actual concurrent streams before claiming capacity or buying a plan.

SQL migration: `supabase/migrations/20261003030051_launchpad_characters.sql`. It is not idempotent; inspect history/schema first. Run `npm run db:queries` and deploy the existing `her-database` function with its custom server authentication preserved. Do not remove unrelated existing queries.

Validation:
```powershell
node --experimental-transform-types --test scripts/launchpad.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build --webpack
```
`scripts/launchpad-db-check.mjs` is an opt-in real gateway integration test. It creates a uniquely identified unfunded fixture and reports its ID for owner-scoped cleanup. It does not submit provider jobs or blockchain transactions.

## Research and design rationale

The Jean Philanthrope / Jean Phil trend combines a recognizable recurring face, costume and mannerisms with varied scenarios. [Know Your Meme](https://knowyourmeme.com/memes/jean-philanthrope-jean-phil) and [Dexerto](https://www.dexerto.com/tiktok/who-is-jean-phil-ai-character-behind-multimillion-dollar-meme-coin-sparks-fake-persona-trend-3412528/) describe the character/trend. The original creator's exact toolchain was not independently verified. HER's proposed stack is our implementation choice, not a claim about that creator.

Primary technical references:
- [Kling 3 Pro image-to-video API](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api): image references, native audio, 3–15 second clips, asynchronous queues. It is generative video, not instantaneous chat response.
- [Tavus image-to-face](https://docs.tavus.io/sections/faces/image-to-face-quickstart): train a talking face from an image and chosen voice.
- [Tavus Phoenix 4.5 preview status](https://docs.tavus.io/sections/faces/phoenix-45-preview-and-status): preview and full tuning are different states.
- [Tavus create video](https://docs.tavus.io/api-reference/video-request/create-video) and [get video](https://docs.tavus.io/api-reference/video-request/get-video): scripted render jobs.
- [Pump official coin creation](https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md): creator-signed mint creation, separate from broadcasting.
- [LiveKit ingress](https://docs.livekit.io/transport/media/ingress-egress/ingress/): media transport does not establish authorization to publish to a particular Pump coin.

Marcel is original example artwork, not an actual launched character or Jean Phil clone. Generated with the built-in image tool using a portrait brief: an original fictional middle-aged radio host with swept-back dark curls, thin moustache, amber spectacles, burgundy velvet blazer and cream knit polo, natural skin texture, in a warm walnut radio studio with green acoustic panels; editorial photorealism, direct eye contact, no text or logos. The static example is labeled throughout the UI.
