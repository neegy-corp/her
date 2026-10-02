// Run from the project root with Node 24+. Keys stay in .env / process.env.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { buildPalConfig, faceReadiness } from '../lib/her-production.ts';
if (existsSync('.env')) loadEnvFile('.env');
const env = process.env;
const command = process.argv[2] || 'plan';
const statePath = '.sites-runtime/her-tavus.json';
mkdirSync('.sites-runtime', { recursive: true });
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const faceId = env.TAVUS_FACE_ID || state.face_id;
const palId = env.TAVUS_PAL_ID || state.pal_id;
// Face mode preserves each character's own voice when the shared PAL switches faces.
const voice = env.HER_VOICE_MODE === 'face' ? {} : { voiceId: env.TAVUS_VOICE_ID || undefined, engine: env.HER_TTS_ENGINE || undefined, externalVoiceId: env.HER_EXTERNAL_VOICE_ID || undefined, model: env.HER_TTS_MODEL || undefined, apiKey: env.HER_TTS_API_KEY || undefined };
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const output = value => console.log(JSON.stringify(value, (k, v) => /api_key/i.test(k) && v ? '[redacted]' : v, 2));
async function api(path, method = 'GET', body) {
  if (!env.TAVUS_API_KEY) throw new Error('Set TAVUS_API_KEY in the ignored .env file. Do not paste keys into chat.');
  const response = await fetch(`https://tavusapi.com/v2/${path}`, { method, headers: { 'x-api-key': env.TAVUS_API_KEY, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (response.status === 304) return {};
  if (!response.ok) throw new Error(`Tavus returned HTTP ${response.status}. Check the account dashboard; a 409 may mean unapplied PAL Maker edits. No changes are forced.`);
  return response.json();
}
async function create(kind, body) {
  if (state.pending) throw new Error('A previous creation has an unknown outcome. Check Tavus, recover its ID into this state file, and clear pending before retrying.');
  state.pending = { kind, started_at: new Date().toISOString() }; save();
  // Never retry creation automatically: a timeout can occur after the provider creates it.
  const result = await api(kind === 'face' ? 'faces' : 'pals', 'POST', body);
  const id = result[`${kind}_id`];
  if (typeof id !== 'string') throw new Error('Creation response lacked an ID. Check Tavus before retrying.');
  state[`${kind}_id`] = id; delete state.pending; save(); output({ [`${kind}_id`]: id });
}
try {
  if (voice.engine && !['cartesia', 'elevenlabs'].includes(voice.engine)) throw new Error('HER_TTS_ENGINE must be cartesia or elevenlabs.');
  if (command === 'plan') {
    output({ note: 'Dry run only. No provider calls. The preview ID below is a placeholder.', pal: buildPalConfig(faceId || 'rpreview', voice) });
  } else if (command === 'create-face') {
    if (faceId) throw new Error('A face ID is already configured or cached. Use status; creation is not repeated.');
    if (!env.TAVUS_API_KEY) throw new Error('Set TAVUS_API_KEY before creation.');
    if (!env.HER_TRAIN_IMAGE_URL) throw new Error('Set HER_TRAIN_IMAGE_URL to a Tavus-fetchable HTTPS image URL, or upload the portrait in PAL Maker.');
    const source = new URL(env.HER_TRAIN_IMAGE_URL);
    if (source.protocol !== 'https:' || source.username || source.password) throw new Error('Training source must be HTTPS without embedded credentials.');
    await create('face', { face_name: 'HER', model_name: 'phoenix-4.5', train_image_url: source.href, ...(voice.voiceId ? { default_voice_id: voice.voiceId } : { voice_name: env.HER_TRAIN_VOICE_NAME || 'anna' }), auto_fix_training_image: false });
  } else if (command === 'status') {
    if (!faceId || !/^r[\w-]+$/.test(faceId)) throw new Error('Configure a valid TAVUS_FACE_ID or create a face first.');
    const face = await api(`faces/${faceId}`);
    output({ face_id: faceId, status: face.status, model_name: face.model_name, finetune_status: face.finetune_status, ...faceReadiness(face), pal_id: palId || null });
  } else if (command === 'create-pal' || command === 'update-pal') {
    if (!faceId) throw new Error('Create or configure a female face first.');
    const config = buildPalConfig(faceId, voice);
    if (env.HER_VOICE_MODE === 'face') config.layers.tts = { tts_engine: 'tavus-auto', tts_emotion_control: true };
    const quality = faceReadiness(await api(`faces/${faceId}`));
    if (!quality.ready) throw new Error(quality.reason);
    if (command === 'create-pal') {
      if (palId) throw new Error('A PAL ID already exists. Use update-pal so the saved persona is reused.');
      await create('pal', config);
    } else {
      if (!palId || !/^p[\w-]+$/.test(palId)) throw new Error('Configure a valid TAVUS_PAL_ID first.');
      const current = await api(`pals/${palId}`);
      const { layers, pipeline_mode, ...fields } = config;
      if (current.pipeline_mode !== pipeline_mode) throw new Error('This is not a full-pipeline PAL. Create a dedicated HER PAL.');
      const patch = Object.entries(fields).map(([key, value]) => ({ op: key in current ? 'replace' : 'add', path: `/${key}`, value }));
      if (!current.layers) patch.push({ op: 'add', path: '/layers', value: layers });
      else for (const [key, value] of Object.entries(layers)) patch.push({ op: key in current.layers ? 'replace' : 'add', path: `/layers/${key}`, value });
      await api(`pals/${palId}`, 'PATCH', patch);
      output({ pal_id: palId, updated: true });
    }
  } else throw new Error('Commands: plan, create-face, status, create-pal, update-pal');
} catch (error) { console.error(error instanceof Error ? error.message : 'Setup failed.'); process.exitCode = 1; }
