import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePumpUrl, normalizeFeed, rehearsalReply } from '../lib/her.ts';
import { buildPalConfig, faceReadiness } from '../lib/her-production.ts';
test('pump URL validation excludes wrong hosts, credentials, schemes and invalid mints', () => {
 const mint = '7VcPPRE78GZUHDaY9EoVhTvpAGcVWw5ucN41mvZYpump';
 assert.equal(parsePumpUrl(`https://pump.fun/coin/${mint}?x=1`), mint);
 assert.equal(parsePumpUrl(`https://pump.fun/${mint}`), mint);
 for (const url of ['https://pump.fun.evil.test/coin/'+mint, 'http://pump.fun/'+mint, 'https://u:p@pump.fun/'+mint, 'https://pump.fun/coin/invalid', 'javascript:alert(1)']) assert.equal(parsePumpUrl(url), null);
});

test('ordinary profanity survives feed normalization and rehearsal', () => {
 const text = 'What the fuck? That was some wild shit.';
 assert.equal(normalizeFeed([{id:'raw',user:'viewer',text,timestamp:123}])[0].text, text);
 assert.match(rehearsalReply('Can you swear?', 'viewer'), /fuck/);
});
test('live quality gate distinguishes tuned output from a watermarked preview', () => {
 assert.equal(faceReadiness({status:'completed', model_name:'phoenix-4.5',finetune_status:'started'}).ready,false);
 assert.equal(faceReadiness({status:'completed', model_name:'phoenix-4.5',finetune_status:'errored'}).ready,false);
 assert.equal(faceReadiness({status:'completed', model_name:'phoenix-4.5',finetune_status:'completed'}).ready,true);
 assert.equal(faceReadiness({status:'completed', model_name:'phoenix-4'}).ready,true);
 assert.equal(faceReadiness({status:'error', model_name:'phoenix-4'}).ready,false);
});
test('PAL payload keeps stable voice selection mutually exclusive', () => {
 const pal = buildPalConfig('rtest', {voiceId:'vtest'});
 assert.equal(pal.layers.tts.voice_id, 'vtest');
 assert.deepEqual(pal.languages, ['en']);
 assert.match(pal.system_prompt,/Ordinary non-targeted profanity is allowed/);
 assert.throws(()=>buildPalConfig('rtest',{voiceId:'vtest',engine:'cartesia'}));
 assert.throws(()=>buildPalConfig('rtest',{engine:'cartesia',externalVoiceId:'some-voice'}));
 const external = buildPalConfig('rtest',{engine:'elevenlabs',externalVoiceId:'voice',model:'eleven_flash_v2_5'});
 assert.equal(external.layers.tts.external_voice_id,'voice');
 assert.equal(external.layers.tts.voice_id,undefined);
});
test('chat adapter rejects malformed messages and bounds untrusted content', () => {
 assert.throws(() => normalizeFeed({}));
 assert.deepEqual(normalizeFeed([{id: '1', user: 'a', text: 'bad', timestamp: 'yesterday'}]), []);
 assert.deepEqual(normalizeFeed([{id: '1', user: 'a', text: 'ok', timestamp: 123}]), [{id: '1', user: 'a', text: 'ok', timestamp: 123}]);
 assert.equal(normalizeFeed([{id: '1', user: 'x'.repeat(70), text: 'y'.repeat(900), timestamp: 123}])[0].text.length, 400);
 assert.equal(normalizeFeed(Array.from({length: 150}, (_, i) => ({id: String(i), user:'a',text:'ok',timestamp:i}))).length, 100);
});
