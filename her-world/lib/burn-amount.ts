/** Parse token amounts as decimal strings so wallet amounts never use floating point. */
export function voteAmount(value:unknown,decimals=6){
 if(typeof value!=='string'||value.length>40||!/^\d+(\.\d+)?$/.test(value))throw new Error('Enter an amount of at least 10,000 HER.');
 const [whole,fraction='']=value.split('.');
 if(fraction.length>decimals)throw new Error(`HER supports up to ${decimals} decimal places.`);
 const raw=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(raw<10000n*10n**BigInt(decimals))throw new Error('The minimum burn is 10,000 HER.');
 if(raw>18446744073709551615n)throw new Error('This amount exceeds the token transaction limit.');
 const tail=fraction.replace(/0+$/,'');
 return `${BigInt(whole)}${tail?'.'+tail:''}`;
}
