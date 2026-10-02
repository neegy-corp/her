import test from 'node:test';
import assert from 'node:assert/strict';
import {json} from '../lib/http.ts';
test('handover keeps all three independent session cookies',()=>{
 const headers=new Headers();
 headers.append('Set-Cookie','her-pending=; Path=/; Max-Age=0');
 headers.append('Set-Cookie','her-session=next; Path=/; HttpOnly');
 headers.append('Set-Cookie','her-retiring=previous; Path=/; HttpOnly');
 const response=json({committed:true},200,headers);
 assert.deepEqual(response.headers.getSetCookie(),headers.getSetCookie());
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
