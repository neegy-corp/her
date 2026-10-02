import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoveryDelay,withDeadline} from '../lib/live-recovery.ts';

test('retries continue beyond three failures with bounded backoff',()=>{
 assert.deepEqual([1,2,3,4,5,500,1000000].map(recoveryDelay),[2000,4000,8000,16000,30000,30000,30000]);
});
test('a hanging transport operation times out so recovery can proceed',async()=>{
 await assert.rejects(withDeadline(new Promise(()=>{}),10),/timed out/);
 assert.equal(await withDeadline(Promise.resolve('connected'),1000),'connected');
 await assert.rejects(withDeadline(Promise.reject(new Error('offline')),1000),/offline/);
});
