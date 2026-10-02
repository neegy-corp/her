# HER: realism and integration decisions

Researched October 1, 2026. Tavus credentials are configured in the private studio. A real session with the stock Anna face passed text-to-response, 1280×720 video, live audio-track, transcript, and end-session checks. Two delivery requests returned “Well, shit. That escalated fast. What the fuck was that? Okay, I'm listening.” without text censorship. A fresh typed message was answered with its supplied name and favorite color. This verifies the live integration and response text; it is not a completed subjective voice or lip-sync review. The local audition audio is saved in ignored `outputs/her-live-audition.webm`.

The original HER portrait has been submitted as a Phoenix-4.5 face with the Anna voice. At the latest check, its base status was `completed` and `finetune_status` was `training`. Production uses that custom face and requires fine-tuning to finish before a session can start. The completed audition used a stock face; it does not establish the custom face's final visual quality. No user coin or public broadcast has been tested.

## Face and movement

For this chest-up studio, start with a **tuned Phoenix-4.5 face**, using the fictional HER portrait as a training candidate. Tavus says 4.5 improves upper-body movement; video training generally gives more natural motion than a single image. Its guide still identifies Phoenix-4 video as a high-fidelity option, especially for full-body work. This is a fit-for-purpose choice, not a measured claim that 4.5 always wins. [Training comparison](https://docs.tavus.io/sections/faces/which-training-path).

An image should show one adult, frontal face, head and shoulders, with clear lighting and at least 512×512 pixels. Upload `public/her-host.png` through PAL Maker, or provide a fetchable image URL to the setup script. The private studio asset URL cannot be assumed fetchable by Tavus. Keep auto-fix off initially to avoid changing HER's identity. A licensed performer recorded in a continuous shot is the stronger next step if the image-trained movement looks synthetic. [Image requirements](https://docs.tavus.io/sections/faces/phoenix-45-image-requirements), [video requirements](https://docs.tavus.io/sections/faces/phoenix-45-video-requirements).

Do not judge the final result from the first watermarked preview. The app requires `status=completed` and, for 4.5, `finetune_status=completed`. A failed fine-tune is not accepted as finished. [Preview lifecycle](https://docs.tavus.io/sections/faces/phoenix-45-preview-and-status).

## Voice and personality

Use one consistent adult female voice. The setup supports a Tavus voice ID or an explicit Cartesia/ElevenLabs voice and model. Avoid a changing automatic voice selection for a recurring character. `anna` is the documented image-training starter; audition it before settling on it. Tavus handles emotion from persona instructions; there is no extra “enable emotions” switch to invent. HER's prompt uses short, varied replies and restrained reactions instead of constant smiling or exaggerated hype. [Image voices](https://docs.tavus.io/sections/faces/voices-for-image-based-faces), [TTS configuration](https://docs.tavus.io/sections/conversational-video-interface/pal/tts), [emotional expression](https://docs.tavus.io/sections/conversational-video-interface/quickstart/emotional-expression).

Possible audition alternatives: Cartesia Skylar (`db6b0ed5-d5d3-463d-ae85-518a07d3c2b4`, US) and Jacqueline (`9626c31c-bec5-4cca-baa8-f8ba9e84c8bc`, US). Cartesia's current model is Sonic 3.6; Tavus's integration example still specifies Sonic 3. Confirm the chosen model works through Tavus before pinning it. These are candidates from the vendor catalog, not voices we have listened to or benchmarked. [Cartesia catalog and model](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest).

HER explicitly allows ordinary swearing, including “fuck” and “shit,” with no app-side profanity filter. The **Test delivery** button exercises this. Provider and voice-owner moderation can still affect output; it is not honest to promise an unrestricted voice before a real audition. ElevenLabs voice owners can enable Live Moderation. [Tavus policy](https://www.tavus.io/acceptable-use-policy), [ElevenLabs Live Moderation](https://help.elevenlabs.io/hc/en-us/articles/25844954413841-What-is-Live-Moderation).

## What Griffin Live contributes

Inspected through the connected GitHub account at commit `c4ead7633d41e8371269741c3b1005e02af3ba53`: [repository](https://github.com/neegy-corp/griffin-live/tree/c4ead7633d41e8371269741c3b1005e02af3ba53).

| Finding | HER decision |
| --- | --- |
| HTTP incoming chat, then browser forwarding over Daily | Added an independent authenticated relay accepting the same `author` / `text` input shape. |
| PAL ID cached across restarts | Added persistent local setup state and explicit update command; creation is not repeated automatically. |
| `conversation.respond` over the call data channel | Already used by HER; keep bounded queue and wait for speech completion. |
| No real pump.fun reader | A reader/provider still must feed the relay. This repo does not close that gap. |
| No Griffin model implementation | It is a Tavus client; its name is not evidence of access to Griffin. Future compatibility needs checking when an API exists. |
| No female face, voice audition, or streaming output | Keep HER's separate face setup and OBS broadcast workflow. |

No license file was present. No repository source was copied, no dependencies installed from it, and no changes were pushed to that upstream repository. The connected account has read access, not push access. The new relay is independently implemented and tested.

The upstream prototype's unauthenticated ingestion, burst forwarding without speech completion, and automatic conversation creation are unsuitable for exposing publicly as-is. HER retains private studio access, server-side keys, bounded queues, explicit session start/end, and duration limits. The separate relay requires a bearer token, validates its single room, caps storage, and deduplicates source IDs.

## Alternative and acceptance criteria

HeyGen LiveAvatar offers full-stack and audio-driven modes, but switching would require a different session integration. No comparable independent benchmark was found that justifies replacing the existing Tavus implementation now. [LiveAvatar overview](https://www.heygen.com/blog/liveavatar-by-heygen).

Before broadcasting, audition the finished live face at the intended OBS resolution: normal conversation, a joke, a serious reply, and the unbleeped delivery sample. Check lip timing, teeth, blinks, head movement, voice consistency, pauses, and reconnect behavior. Run a full ten-minute session and a chat burst; measure response delay rather than inventing a latency guarantee. Confirm actual pump.fun messages arrive once and the OBS destination receives picture and audio. The browser rehearsal verifies controls and text only; it cannot validate realism, live profanity delivery, or platform acceptance.
