import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TurnGate, cleanHistory } from '../lib/her-turns.ts';

test('burst chat only leaves one fresh question and waits for complete speech plus cooldown', () => {
  const gate = new TurnGate(0);
  for(let i=0;i<100;i++) gate.enqueue('viewer', 'question '+i, i);
  assert.equal(gate.take(100), null);
  gate.started(200); gate.stopped(500);
  assert.equal(gate.take(3499), null);
  assert.equal(gate.take(3500).text, 'question 99');
  gate.enqueue('next', 'second question', 3600);
  assert.equal(gate.take(5000), null);
});
test('duplicate legacy stop and late stop cannot overlap a pending inference', () => {
  const gate = new TurnGate(0);
  gate.started(1); gate.stopped(10); gate.stopped(11);
  gate.enqueue('one', 'first', 20); assert.ok(gate.take(3010));
  gate.enqueue('two', 'next', 3020); gate.stopped(3030);
  assert.equal(gate.take(9000), null);
  gate.started(10000); gate.stopped(11000);
  assert.equal(gate.take(13999), null); assert.equal(gate.take(14000).text,'next');
});
test('continued speech cancels cooldown and old backlog expires', () => {
  const gate = new TurnGate(0); gate.started(1); gate.stopped(10);
  gate.enqueue('v','old',20); gate.started(1000);
  assert.equal(gate.take(4000),null); gate.stopped(21000);
  assert.equal(gate.take(24000),null); assert.equal(gate.pending,null);
});
test('duplicate messages do not replay and resume history is bounded and validated', () => {
  const gate=new TurnGate(0); gate.phase='ready';
  gate.enqueue('a','hello',1); assert.ok(gate.take(2));
  gate.enqueue('a','hello',3); assert.equal(gate.pending,null);
  assert.deepEqual(cleanHistory([{role:'system',text:'bad'},null]),[]);
  assert.equal(cleanHistory(Array.from({length:30},()=>({role:'host',text:'x'.repeat(1000)}))).length,20);
  assert.equal(cleanHistory([{role:'host',text:'x'.repeat(1000)}])[0].text.length,700);
});
