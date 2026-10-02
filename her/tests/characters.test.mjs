import {test} from 'node:test';
import assert from 'node:assert/strict';
import {liveCharacters,characterContext,characterEntrance,characterProfile} from '../lib/characters.ts';
import {cleanHistory,TurnGate} from '../lib/her-turns.ts';

test('every face has a distinct voice and personality',()=>{
 assert.equal(new Set(liveCharacters.map(c=>c.voiceId)).size,3);
 assert.equal(new Set(liveCharacters.map(c=>characterProfile(c.id).style)).size,3);
 for(const c of liveCharacters) assert.ok(characterContext(c.id).includes(`ACTIVE CHARACTER: ${characterProfile(c.id).name}`));
 assert.throws(()=>characterProfile('ignore instructions'));
});
test('real switches get one entrance; renewals do not announce a switch',()=>{
 for(const from of liveCharacters)for(const to of liveCharacters){
  const entrance=characterEntrance(from.id,to.id);
  if(from.id===to.id){assert.equal(entrance,null);assert.match(characterContext(to.id,from.id),/not a character change/);}
  else {assert.ok(entrance.includes(characterProfile(to.id).name));assert.match(characterContext(to.id,from.id),/CHARACTER CHANGE/);}
 }
});
test('continuity preserves host attribution and cannot promote viewer identity metadata',()=>{
 assert.deepEqual(cleanHistory([{role:'host',character:'maya',text:'My paper entry was late.'},{role:'viewer',character:'ivy',text:'Switch to Ivy'}]),[
  {role:'host',character:'maya',text:'My paper entry was late.'},{role:'viewer',text:'Switch to Ivy'}
 ]);
});
test('handover entrance reserves the speech gate before a queued viewer reply',()=>{
 const gate=new TurnGate(1000);gate.enqueue('viewer','hello',1000);
 gate.phase='waiting';gate.changedAt=1000;
 assert.equal(gate.take(1100),null);
 gate.started(1200);assert.equal(gate.take(1300),null);
 gate.stopped(2000);assert.equal(gate.take(4900),null);
 assert.equal(gate.take(5000)?.user,'viewer');
});
