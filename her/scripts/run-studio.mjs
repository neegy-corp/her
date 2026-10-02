// Local studio supervisor. Stop this process explicitly to stop automatic restarts.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let child, retry, stopping=false;
function run(){
 if(stopping)return;
 child=spawn(process.execPath,['--env-file=.env','scripts/run-framework.mjs','dev'],{cwd:root,stdio:'inherit',windowsHide:true});
 child.once('error',error=>console.error('Studio process error:',error.message));
 child.once('close',code=>{
  if(stopping)return;
  console.error(`Studio exited (${code}); restarting in five seconds.`);
  retry=setTimeout(run,5000);
 });
}
function stop(){stopping=true;clearTimeout(retry);child?.kill();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
run();
