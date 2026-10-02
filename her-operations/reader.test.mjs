import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPumpReader, normalizePumpMessage } from './pump-reader.mjs';
import { createChatRelay } from '../her/scripts/chat-relay.mjs';
const mint='2MsXjGge1F9GY2uHXaKZijreBi2zeg4ib7fjpTuKpump';
test('reader rejects another room and old history while retaining profanity',()=>{
 const message={id:'m1',roomId:mint,username:'viewer',message:'what the fuck',timestamp:new Date(1000).toISOString()};
 assert.equal(normalizePumpMessage(message,mint,2000),null);
 assert.equal(normalizePumpMessage({...message,roomId:'other'},mint,0),null);
 assert.equal(normalizePumpMessage(message,mint,0).text,'what the fuck');
});
test('socket events reach real HTTP relay once; old history is not replayed',async()=>{
 const token='test-only-secret-with-more-than-32-characters';
 const server=createChatRelay({mint,token});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 let socket;const sent=[];
 class FakeSocket{constructor(){socket=this;}send(s){sent.push(s);}close(){this.onclose?.();}message(s){this.onmessage({data:s});}}
 const states=[];
 const reader=startPumpReader({mint,WebSocketClass:FakeSocket,onStatus:s=>states.push(s.state),onMessage:async body=>{const r=await fetch(base+'/api/chat/incoming',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)});assert.equal(r.status,201);}});
 try {
  socket.message('0{"pingInterval":25000,"pingTimeout":20000}');socket.message('40{}');socket.message('430[{"authenticated":false}]');
  const message={id:'live1',roomId:mint,username:'viewer',message:'Well, shit.',timestamp:new Date(Date.now()+10).toISOString()};
  socket.message('431'+JSON.stringify([[{...message,id:'old',timestamp:'2001-01-01'}]]));
  socket.message('42'+JSON.stringify(['newMessage',message]));socket.message('42'+JSON.stringify(['newMessage',message]));
  await reader.drained();
  const body=await(await fetch(base+`/feed?mint=${mint}`,{headers:{authorization:`Bearer ${token}`}})).json();
  assert.deepEqual(body.messages.map(x=>x.text),['Well, shit.']);assert.ok(states.includes('connected'));
  assert.ok(sent.every(x=>!x.includes('sendMessage')));
 }finally{reader.stop();await new Promise(r=>server.close(r));}
});
