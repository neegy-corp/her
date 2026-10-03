# ACP creative references — October 3, 2026

The owner's references were inspected directly in the signed-in X browser:

- https://x.com/jeanphil_nft/status/2104972219642216727 — approximately 19-second, 720×1280 vertical performance. A distinctive blond bob, curled mustache and checked jacket remain recognizable across a close, overhead-looking view and a wider outdoor night shot. Expressive facial movement, gesture and changing camera distance are central to the format. The post is on a self-described fan account. Its caption references a song; ACP does not copy those lyrics.
- https://x.com/fer_hinoc/status/2104334196030197928 — a still image of the same character, with commentary describing an AI-generated character and its associated memecoin. This second reference is not itself a video in the inspected post.

Neither post establishes the original generation model or full production process. Do not attribute either to Tavus, Kling, Veo or another vendor without evidence. The earlier invented cafe philosopher was not this character and has been removed from the site's presets and marketing.

## Product direction

Creators upload their own reference images, write a script, and specify action, camera movement and setting for generated performance clips. Keep identity consistent while allowing scenes to change. Assemble multiple clips into a show, pause for queued chat replies, then generate a new scene from audience suggestions. Token PFP/banner remain independent assets. Do not use the reference influencer as an ACP customer, deployed ACP token or ready-to-use licensed avatar.

The existing implementation uses Kling v3 Pro image-to-video for performances and a separate speech provider for chat replies. Official schema: https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api . It supports reference elements, native audio and 3–15 second clips; longer shows comprise multiple clips. This is an implementation choice, not an attribution of the source videos. Paid generation and public broadcast still require funding and end-to-end verification.

## Routes

- `/` — ACP introduction and workflow; no invented influencer catalog.
- `/create` — private character creation, references, scripts, artwork and coin review; existing local drafts preserved.
- `/tokens` — paginated confirmed ACP launches, public artwork and pump.fun links. No draft, pending creation or unverified live badge.
- `/api/launchpad/tokens` — explicit public projection joined to confirmed creation records with matching mint/signature. Wallets, private creative prompts, provider IDs and transactions are excluded.
