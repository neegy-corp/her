export function json(body:unknown,status=200,headers:HeadersInit={}){
 const result=new Headers(headers);
 if(!result.has('Cache-Control'))result.set('Cache-Control','no-store');
 return Response.json(body,{status,headers:result});
}
