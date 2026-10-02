import { HER_PERSONA } from "./her.ts";
export type VoiceConfig = { voiceId?: string; engine?: "cartesia" | "elevenlabs"; externalVoiceId?: string; model?: string; apiKey?: string };
export function buildPalConfig(faceId: string, voice: VoiceConfig = {}) {
  if (!/^r[a-zA-Z0-9_-]+$/.test(faceId)) throw new Error("A valid Tavus face ID is required.");
  if (voice.voiceId && (voice.externalVoiceId || voice.engine || voice.apiKey || voice.model)) throw new Error("Use either a Tavus voice ID or an external provider configuration, not both.");
  if (voice.engine && (!voice.externalVoiceId || !voice.model)) throw new Error("External voices require both a voice ID and a pinned model.");
  if (!voice.engine && (voice.externalVoiceId || voice.model || voice.apiKey)) throw new Error("Choose cartesia or elevenlabs for an external voice.");
  return {
    pal_name: "HER — natural livestream host", pipeline_mode: "full", default_face_id: faceId,
    system_prompt: HER_PERSONA, languages: ["en"],
    disclosure_type: "always", verbal_disclosure: "I'm HER, your AI host.", visual_disclosure: "HER · AI host",
    layers: {
      llm: { model: "tavus-gemma-4" },
      ...(voice.voiceId ? { tts: { voice_id: voice.voiceId } } : voice.engine ? { tts: { tts_engine: voice.engine, external_voice_id: voice.externalVoiceId!, tts_model_name: voice.model!, ...(voice.apiKey ? { api_key: voice.apiKey } : {}), ...(voice.engine === "elevenlabs" ? { voice_settings: { speed: 1.0, stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true } } : {}) } } : {}),
      conversational_flow: { turn_detection_model: "sparrow-2", turn_taking_patience: "medium", pal_interruptibility: "low", idle_engagement: "off" },
    },
  };
}
export function faceReadiness(face: { status?: string; model_name?: string; finetune_status?: string | null }) {
  if (face.status !== "completed") return { ready: false, reason: "The live face is not ready. Wait for face training to complete." };
  if (!face.model_name || !["phoenix-4", "phoenix-4.5"].includes(face.model_name)) return { ready: false, reason: "Select a Phoenix-4 or Phoenix-4.5 face for HER's realistic live video." };
  if (face.model_name === "phoenix-4.5" && face.finetune_status !== "completed") return { ready: false, reason: face.finetune_status === "errored" ? "Face tuning failed. The watermarked preview is not the finished HER face." : "HER's face is still tuning. Wait for finetune_status=completed for the finished live face." };
  return { ready: true, reason: "Finished face is ready for an audition." };
}
