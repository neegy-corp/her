// Retry for as long as the operator wants the stream running, without a request storm.
export function recoveryDelay(attempt: number) {
 return Math.min(30000, 2000 * 2 ** Math.min(4, Math.max(0, attempt - 1)));
}
export async function withDeadline<T>(operation: Promise<T>, ms: number): Promise<T> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connection timed out; retrying automatically.')),ms);})]);
 } finally { if(timer)clearTimeout(timer); }
}
