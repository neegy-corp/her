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

## Higgsfield research and creator-controlled streaming

Higgsfield's own X post (January 21, 2026), inspected in the browser, advertises its Influencer Studio's customizable characters and full-motion videos: https://x.com/higgsfield_ai/status/2014055626050273444 . The accompanying announcement is https://x.com/higgsfield_ai/status/2014055614369112122 . These establish product capabilities advertised by Higgsfield, not provenance of the Jean Phil clip. Marketing revenue claims were not evaluated or adopted.

The API is a separately funded product and supports image/video generation from code: https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api . Soul ID adds a reusable character reference: https://open.higgsfield.ai/models/soul-id/api-reference . No Higgsfield API credential has been connected to ACP and no Higgsfield render has been tested through the application. Existing generation adapters remain unchanged until a provider integration is completed.

The per-character broadcast page now accepts the coin's Pump WHIP endpoint and stream key, with a single Go Live action. The manifest derives the chat mint from the owner's stored character; the user cannot replace that mint in the form. The supplied stream key itself determines the actual Pump destination, which cannot be verified from the key alone. Go Live requires a confirmed mint, every current scene rendered, and live audio/video tracks. Credentials remain in tab memory and request headers, with only same-origin WHIP session cleanup allowed. Stop cancels pending connection work and prevents an old connection from resuming.

Each character runs independently in an open browser tab. This is not unattended cloud hosting. Transport connection/bitrate/frame status is separate from public playback; no real broadcast was started during these changes.
