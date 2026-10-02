import test from 'node:test';
import assert from 'node:assert/strict';
import {voteAmount} from '../lib/burn-amount.ts';
test('accepts the minimum and arbitrary larger amounts exactly',()=>{
 for(const n of ['10000','10001','12500.123456','1000000.000001'])assert.equal(voteAmount(n),n);
 assert.equal(voteAmount('0010000.500000'),'10000.5');
});
test('rejects below minimum, malformed amounts, excessive precision and integer overflow',()=>{
 for(const n of ['9999.999999','0','-10000','1e5','10,000','Infinity','','10000.0000001','18446744073709.551616',10000,null])assert.throws(()=>voteAmount(n));
});
