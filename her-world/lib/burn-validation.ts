type Instruction={programId?:string;parsed?:{type?:string;info?:Record<string,unknown>}|string};
type Tx={blockTime?:number|null;meta:{err:unknown}|null;transaction:{message:{accountKeys:{pubkey:string;signer:boolean}[];instructions:Instruction[]}}};
type Expected={wallet:string;mint:string;program:string;raw_amount:string;id:string;created_at:number;expires:number};
export function validateBurn(tx:Tx|null,expected:Expected){
 if(!tx||!tx.meta||tx.meta.err)throw new Error('The burn is not finalized successfully yet. Retry verification.');
 if(!tx.blockTime||tx.blockTime*1000<expected.created_at-30000||tx.blockTime*1000>expected.expires)throw new Error('This burn is outside the request window.');
 if(!tx.transaction.message.accountKeys.some(a=>a.pubkey===expected.wallet&&a.signer))throw new Error('The connected wallet did not sign this burn.');
 const list=tx.transaction.message.instructions;
 if(!list.some(i=>i.programId==='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'&&i.parsed===`HER:${expected.id}`))throw new Error('This burn belongs to a different request.');
 const burns=list.filter(i=>i.programId===expected.program&&typeof i.parsed==='object'&&i.parsed?.type==='burnChecked');
 if(burns.length!==1)throw new Error('Expected exactly one checked token burn.');
 const info=(burns[0].parsed as {info:Record<string,unknown>}).info;
 const tokenAmount=info.tokenAmount as {amount?:string}|undefined;
 if(info.mint!==expected.mint||info.authority!==expected.wallet||tokenAmount?.amount!==expected.raw_amount)throw new Error('The burn mint, wallet, or amount does not match this request.');
 return true;
}
