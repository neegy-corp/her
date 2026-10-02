import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const image=readFileSync('../her/public/her-host.png');
const path='/'+randomBytes(24).toString('hex')+'/her.png';
writeFileSync('.training-path',path);
const server=createServer((req,res)=>{if(req.url!==path||!['GET','HEAD'].includes(req.method)){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':'image/png','content-length':image.length,'cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:image);console.log(JSON.stringify({served:true,method:req.method,at:new Date().toISOString()}));});
server.listen(4502,'127.0.0.1',()=>console.log('Dedicated training-image server ready.'));
