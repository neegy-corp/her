import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatRelay } from '../scripts/chat-relay.mjs';
test('relay requires auth, preserves profanity, deduplicates, isolates rooms and advances cursor', async () => {
 const mint = '7VcPPRE78GZUHDaY9EoVhTvpAGcVWw5ucN41mvZYpump';
 const token = 'test-only-token-with-at-least-32-characters';
 const server = createChatRelay({mint,token});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base = `http://127.0.0.1:${server.address().port}`;
 const headers = {authorization:`Bearer ${token}`,'content-type':'application/json'};
 const post = body => fetch(`${base}/api/chat/incoming`,{method:'POST',headers,body:JSON.stringify(body)});
 try {
   assert.equal((await fetch(`${base}/feed?mint=${mint}`)).status,401);
   assert.equal((await post({text:''})).status,400);
   assert.equal((await post({text:'hello',mint:'wrong'})).status,400);
   const first = await post({id:'a',author:'viewer',text:'What the fuck?'});
   assert.equal(first.status,201); const message = await first.json();
   assert.equal((await (await post({id:'a',text:'duplicate'})).json()).duplicate,true);
   const second = await (await post({id:'b',text:'Well, shit.'})).json();
   assert.ok(second.timestamp > message.timestamp);
   const data = await (await fetch(`${base}/feed?mint=${mint}&after=${message.timestamp}`,{headers})).json();
   assert.deepEqual(data.messages.map(m=>m.text),['Well, shit.']);
   assert.equal((await fetch(`${base}/feed?mint=wrong`,{headers})).status,400);
   assert.equal((await fetch(`${base}/feed?mint=${mint}&after=nope`,{headers})).status,400);
 } finally { await new Promise(resolve=>server.close(resolve)); }
});
