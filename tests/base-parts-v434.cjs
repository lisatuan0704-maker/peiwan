// v434 工房初始部件單買：真實 Database Emulator＋大廳實際 payWithCoins，驗證 security/database.rules.json 第四批。
// 執行前先啟動 emulator（port 9273），並在 ../../../output/qa-runtime-v273 安裝 @firebase/rules-unit-testing。
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{createRequire}=require('module');
const req=createRequire(path.resolve(__dirname,'../../../output/qa-runtime-v273/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=req('@firebase/rules-unit-testing');
const {setup}=require('./payment-safety-v273.cjs');
(async()=>{
 const rules=fs.readFileSync(path.join(__dirname,'../security/database.rules.json'),'utf8');
 const env=await initializeTestEnvironment({projectId:'demo-tiny-tavern-v434',database:{host:'127.0.0.1',port:9273,rules}});
 const read=async()=>{let v;await env.withSecurityRulesDisabled(async c=>{v=(await c.database().ref('peiwan').once('value')).val();});return v;};
 const GUID='discord_100000000000000001';
 const reset=()=>env.withSecurityRulesDisabled(async c=>{await c.database().ref('secureV1').set({members:{[GUID]:{active:true,key:'guest'}},owners:{guest:GUID}});await c.database().ref('peiwan').set({config:{adminUid:'owner'},links:{staff1:{type:'char',refId:'cA',code:'X'}},shopConfig:{dyeTicket:{price:100},cloth9:{price:300}},wallet:{guest:{balance:1000}},owned:{guest:{dyeTickets:2}}});});
 const price=(t,p)=>{t.c.payFinalAmount=()=>p;};
 const pushIds=db=>{let n=0;return {ref(p){const r=db.ref(p);if(p==='peiwan/clientOrders')return {push:()=>({key:'ord'+(++n)+'_'+Math.random().toString(36).slice(2,7)})};return r;}};};

 try{
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async c=>{await c.database().ref('secureV1').set({members:{[GUID]:{active:true,key:'guest'}},owners:{guest:GUID}});await c.database().ref('peiwan').set({config:{adminUid:'owner',basePricing:{hair:100,face:50,cloth:50,acc:50}},lobby:{guest:{name:'客'}},wallet:{guest:{balance:500}},owned:{guest:{cloth0:{name:'c',ts:1}}}});});
  const guest=env.authenticatedContext(GUID).database();
  let t=setup({db:pushIds(guest)});t.c.curPlan={id:'base_hair_3',n:'工房部件・妹妹頭（前髮＋後髮）',p:100,itemId:'base_hair_3',itemName:'工房部件・妹妹頭'};price(t,100);await t.c.payWithCoins();
  assert(t.events.includes('success'),'買工房頭髮應成功 '+t.events);
  let d=await read();assert.equal(d.wallet.guest.balance,400);assert(d.owned.guest.base_hair_3&&d.clientOrders[d.owned.guest.base_hair_3.ref].amount===100);
  t=setup({db:pushIds(guest)});t.c.curPlan={id:'base_face_2',n:'工房部件',p:10,itemId:'base_face_2',itemName:'工房部件'};price(t,10);const before=await read();await t.c.payWithCoins();
  assert(!t.events.includes('success'),'竄改工房部件價格不應成功');assert.deepEqual(await read(),before);
  await assertSucceeds(env.unauthenticatedContext().database().ref('peiwan/owned/brandnew/baseStart').set({back:3,front:3,cloth:3,face:2,brow:1,at:1}));
  await assertFails(guest.ref('peiwan/owned/guest/baseStart').set({back:3,front:3,cloth:3,face:2,brow:1,at:1}));
  console.log('PASS: v434 workshop parts: real checkout of base_hair_3 at config/basePricing price, tampered price rejected atomically, new-card baseStart allowed, existing card cannot add baseStart');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
