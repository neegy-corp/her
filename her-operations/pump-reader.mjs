import { pathToFileURL } from 'node:url';
export function normalizePumpMessage(message, mint, since) {
  if (!message || message.roomId !== mint || typeof message.id !== 'string' || typeof message.message !== 'string' || !message.message.trim()) return null;
  const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.parse(message.timestamp);
  if (!Number.isFinite(timestamp) || timestamp < since) return null;
  return { id: message.id.slice(0,180), author: typeof message.username === 'string' ? message.username.slice(0,40) : 'viewer', text: message.message.slice(0,400), mint };
}
export function startPumpReader({ mint, onMessage, onStatus = () => {}, WebSocketClass = WebSocket }) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || '')) throw new Error('A valid token mint is required.');
  let stopped = false, ws, retry, heartbeat, attempts = 0;
  const since = Date.now(), seen = new Set();
  let delivery = Promise.resolve();
  let outstanding = 0;
  const report = state => onStatus({ state, mint });
  function receive(raw) {
    const message = normalizePumpMessage(raw, mint, since);
    if (!message || seen.has(message.id)) return;
    if (outstanding >= 100) { report('delivery-backlog-full'); return; }
    seen.add(message.id); if (seen.size > 2000) seen.delete(seen.values().next().value);
    outstanding++;
    delivery = delivery.then(async()=>{for(let attempt=0;attempt<3&&!stopped;attempt++){try{await onMessage(message);return;}catch{if(attempt<2)await new Promise(r=>setTimeout(r,500*(attempt+1)));}}if(!stopped)report('delivery-failed');}).finally(()=>{outstanding--;});
  }
  function connect() {
    if (stopped) return;
    report('connecting');
    ws = new WebSocketClass('wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket');
    function watchdog(ms=45000) { clearTimeout(heartbeat); heartbeat=setTimeout(()=>ws.close(),ms); }
    watchdog(15000);
    ws.onmessage = event => {
      const packet=String(event.data); if(packet.length>200000)return;
      try {
        if(packet==='2'){ws.send('3');watchdog();return;}
        if(packet.startsWith('0')){const hello=JSON.parse(packet.slice(1));watchdog(Math.min(90000,(hello.pingInterval||25000)+(hello.pingTimeout||20000)+2000));ws.send('40'+JSON.stringify({origin:'https://pump.fun',timestamp:Date.now(),token:null}));}
        else if(packet.startsWith('40'))ws.send('420'+JSON.stringify(['joinRoom',{roomId:mint,username:'anonymous'}]));
        else if(packet.startsWith('430')){const ack=JSON.parse(packet.slice(3));if(ack[0]?.error){report('room-rejected');stop();return;}attempts=0;report('connected');ws.send('421'+JSON.stringify(['getMessageHistory',{roomId:mint,before:null,limit:100}]));}
        else if(packet.startsWith('431')){const ack=JSON.parse(packet.slice(3));if(Array.isArray(ack[0]))for(const message of [...ack[0]].reverse())receive(message);}
        else if(packet.startsWith('42')){const [name,payload]=JSON.parse(packet.slice(2));if(name==='newMessage')receive(payload);}
        else if(packet.startsWith('44')){report('authentication-required');stop();}
      }catch{report('invalid-packet');}
    };
    ws.onerror=()=>{report('connection-error');ws.close();};
    ws.onclose=()=>{clearTimeout(heartbeat);if(!stopped){report('reconnecting');retry=setTimeout(connect,Math.min(30000,1000*2**Math.min(attempts++,5)));}};
  }
  function stop(){stopped=true;clearTimeout(retry);clearTimeout(heartbeat);ws?.close();}
  connect(); return { stop, drained:()=>delivery };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mint=process.env.HER_RELAY_MINT, token=process.env.HER_RELAY_TOKEN;
 if(!token)throw new Error('HER_RELAY_TOKEN is required.');
 const reader=startPumpReader({mint,onStatus:s=>console.log(JSON.stringify(s)),onMessage:async body=>{const r=await fetch('http://127.0.0.1:4501/api/chat/incoming',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('Relay rejected message');}});
 process.on('SIGINT',()=>reader.stop());process.on('SIGTERM',()=>reader.stop());
}
