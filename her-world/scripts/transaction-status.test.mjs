import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionStatus, validatePurchaseInput } from '../lib/transaction-status.ts';

function rpc(receipts, height = 110, transaction = null) {
  let index = 0;
  return {
    getSignatureStatuses: async (_signatures, options) => {
      assert.equal(options.searchTransactionHistory, true);
      return { value: [receipts[Math.min(index++, receipts.length - 1)]] };
    },
    getBlockHeight: async commitment => { assert.equal(commitment, 'finalized'); return height; },
    getTransaction: async () => transaction,
  };
}
test('missing receipt remains pending while blockhash can land, regardless of wall-clock time', async () => {
  assert.equal(await transactionStatus(rpc([null], 99), 'sig', 100), 'pending');
  assert.equal(await transactionStatus(rpc([null], 100), 'sig', 100), 'pending');
  assert.equal(await transactionStatus(rpc([null]), 'sig', null), 'pending');
});
test('processed success or failure remains pending until consensus', async () => {
  for (const err of [null, { InstructionError: [0, 'x'] }])
    assert.equal(await transactionStatus(rpc([{ confirmationStatus: 'processed', err }]), 'sig', 100), 'pending');
});
test('confirmed success/failure and history race are classified without resubmission', async () => {
  const confirmed = { confirmationStatus: 'confirmed', err: null };
  assert.equal(await transactionStatus(rpc([confirmed]), 'sig', 100), 'confirmed');
  assert.equal(await transactionStatus(rpc([{ ...confirmed, err: {} }]), 'sig', 100), 'failed');
  assert.equal(await transactionStatus(rpc([null, confirmed]), 'sig', 100), 'confirmed');
  assert.equal(await transactionStatus(rpc([null], 110, { meta: { err: null } }), 'sig', 100), 'confirmed');
  assert.equal(await transactionStatus(rpc([null]), 'sig', 100), 'expired');
});
test('RPC failures do not turn an unknown payment into an expired one', async () => {
  const broken = rpc([null]); broken.getTransaction = async () => { throw new Error('RPC unavailable'); };
  await assert.rejects(transactionStatus(broken, 'sig', 100), /RPC unavailable/);
});
test('purchase requires explicit valid limit and stable request identity', () => {
  const requestId = crypto.randomUUID();
  for (const maxLamports of [null, undefined, NaN, Infinity, 0, -1, 1.2, '10', Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => validatePurchaseInput({ requestId, maxLamports }), /maximum/);
  for (const id of [null, undefined, '', 'request'])
    assert.throws(() => validatePurchaseInput({ requestId: id, maxLamports: 100 }), /ID/);
  assert.deepEqual(validatePurchaseInput({ requestId, maxLamports: 100 }), { requestId, maxLamports: 100 });
});
