import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ticketInput,replyUpdates} from '../lobby-ui/support-core.mjs';
const input=ticketInput({category:'其他問題',subject:'客服測試',text:'這是一筆隔離環境測試。'});
assert.throws(()=>ticketInput({...input,text:'少'}));
assert.throws(()=>ticketInput({...input,category:'未知'}));
assert.throws(()=>replyUpdates({uid:'../other',id:'test',ticket:input,text:'回覆',at:Date.now()}));
assert.throws(()=>replyUpdates({uid:'discord_a',id:'test',ticket:{...input,reply:{}},text:'回覆',at:Date.now()}));
const base='http://127.0.0.1:9009',ns='demo-support';
function token(uid,extra={}){const now=Math.floor(Date.now()/1000);return [Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'},socialSession:'test',...extra})).toString('base64url'),''].join('.');}
async function request(path,{method='GET',body,auth}={}){const r=await fetch(`${base}/${path}.json?ns=${ns}${auth && auth!=='owner'?'&auth='+encodeURIComponent(auth):''}`,{method,headers:{'Content-Type':'application/json',...(auth==='owner'?{Authorization:'Bearer owner'}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
// Start the official Realtime Database emulator on 127.0.0.1:9009 first.
// This suite uses only demo-support and never contacts the production database.
const rules={rules:{supportV1:JSON.parse(fs.readFileSync(new URL('../security/support.rules.json',import.meta.url),'utf8'))}};
assert.equal((await request('.settings/rules',{method:'PUT',body:rules,auth:'owner'})).status,200,'rules compile');
assert.equal((await request('',{method:'PUT',auth:'owner',body:{peiwan:{config:{adminUid:'admin'}},secureV1:{members:{discord_a:{active:true,key:'char_a'},discord_b:{active:true,key:'char_b'}},owners:{char_a:'discord_a',char_b:'discord_b'}}}})).status,200);
const a=token('discord_a'),b=token('discord_b'),admin=token('admin'),at={'.sv':'timestamp'};
const ticket={...input,myKey:'char_a',name:'測試客人',at};
async function check(label,path,args,want){const result=await request(path,args);assert.equal(result.status,want,label+' '+JSON.stringify(result.data));console.log('PASS '+label);return result;}
await check('anonymous cannot create','supportV1/tickets/discord_a/t1',{method:'PUT',body:ticket},401);
await check('owner can create','supportV1/tickets/discord_a/t1',{method:'PUT',body:ticket,auth:a},200);
await check('owner can read own ticket','supportV1/tickets/discord_a/t1',{auth:a},200);
await check('other member cannot read ticket','supportV1/tickets/discord_a/t1',{auth:b},401);
await check('other member cannot enumerate','supportV1/tickets',{auth:b},401);
await check('owner cannot change submitted text','supportV1/tickets/discord_a/t1/text',{method:'PUT',body:'修改既有訊息',auth:a},401);
await check('cannot spoof another character','supportV1/tickets/discord_a/t2',{method:'PUT',body:{...ticket,myKey:'char_b'},auth:a},401);
await check('oversized subject rejected','supportV1/tickets/discord_a/t2',{method:'PUT',body:{...ticket,subject:'長'.repeat(61)},auth:a},401);
await check('owner cannot fake staff reply','supportV1/tickets/discord_a/t2',{method:'PUT',body:{...ticket,reply:{text:'偽造回覆',at}},auth:a},401);
await check('admin can list tickets','supportV1/tickets',{auth:admin},200);
const updates=replyUpdates({uid:'discord_a',id:'t1',ticket,text:'已收到測試訊息，這是店長回覆。',at});
await check('atomic admin reply and inbox delivery','',{method:'PATCH',body:updates,auth:admin},200);
await check('reply cannot be sent twice','',{method:'PATCH',body:updates,auth:admin},401);
await check('owner can read reply inbox','supportV1/inbox/discord_a',{auth:a},200);
await check('other member cannot read reply','supportV1/inbox/discord_a/t1',{auth:b},401);
await check('anonymous cannot read reply','supportV1/inbox/discord_a/t1',{},401);
await check('owner marks read','supportV1/inbox/discord_a/t1/read',{method:'PUT',body:at,auth:a},200);
await check('owner cannot forge reply text','supportV1/inbox/discord_a/t1/text',{method:'PUT',body:'假的客服回覆',auth:a},401);
await check('owner hides own reply','supportV1/inbox/discord_a/t1/hid',{method:'PUT',body:at,auth:a},200);
await check('other member cannot hide reply','supportV1/inbox/discord_a/t1/hid',{method:'PUT',body:at,auth:b},401);
await check('missing ticket cannot receive a reply','',{method:'PATCH',body:replyUpdates({uid:'discord_a',id:'missing',ticket,text:'回覆',at}),auth:admin},401);
await check('inactive user cannot access tickets','secureV1/members/discord_a/active',{method:'PUT',body:false,auth:'owner'},200);
await check('inactive owner denied','supportV1/tickets/discord_a',{auth:a},401);
console.log('All core and Firebase authorization checks passed. Only local emulator was used.');
