// v428 資安：真實 Database Emulator＋大廳實際 payWithCoins，驗證新版 security/database.rules.json。
// 執行前先啟動 emulator（port 9273），並在 ../../../output/qa-runtime-v273 安裝 @firebase/rules-unit-testing。
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{createRequire}=require('module');
const req=createRequire(path.resolve(__dirname,'../../../output/qa-runtime-v273/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=req('@firebase/rules-unit-testing');
const {setup}=require('./payment-safety-v273.cjs');
(async()=>{
 const rules=fs.readFileSync(path.join(__dirname,'../security/database.rules.json'),'utf8');
 const env=await initializeTestEnvironment({projectId:'demo-tiny-tavern-v428',database:{host:'127.0.0.1',port:9273,rules}});
 const read=async()=>{let v;await env.withSecurityRulesDisabled(async c=>{v=(await c.database().ref('peiwan').once('value')).val();});return v;};
 const GUID='discord_100000000000000001';
 const reset=()=>env.withSecurityRulesDisabled(async c=>{await c.database().ref('secureV1').set({members:{[GUID]:{active:true,key:'guest'}},owners:{guest:GUID}});await c.database().ref('peiwan').set({config:{adminUid:'owner',services:{s1:{name:'特戰',price:300,active:true},s2:{name:'特戰',price:300,active:true}}},links:{staff1:{type:'char',refId:'cA',code:'X'}},shopConfig:{dyeTicket:{price:100},cloth9:{price:300}},wallet:{guest:{balance:1000}},owned:{guest:{dyeTickets:2}}});});
 const price=(t,p)=>{t.c.payFinalAmount=()=>p;};
 const pushIds=db=>{let n=0;return {ref(p){const r=db.ref(p);if(p==='peiwan/clientOrders')return {push:()=>({key:'ord'+(++n)+'_'+Math.random().toString(36).slice(2,7)})};return r;}};};
 try{
  await env.clearDatabase();await reset();
  const guest=env.authenticatedContext(GUID).database();
  // 0. 沒有登入的人不能花這個帳號的錢
  let t0=setup({db:pushIds(env.unauthenticatedContext().database())});await t0.c.payWithCoins();assert(!t0.events.includes('success'),'未登入不應能付款');
  // 1. 實際結帳：染髮券（掌櫃設定 100）
  let t=setup({db:pushIds(guest)});await t.c.payWithCoins();assert(t.events.includes('success'),'買染髮券應成功 '+t.events);
  let d=await read();assert.equal(d.wallet.guest.balance,900);assert.equal(d.owned.guest.dyeTickets,3);
  const id1=Object.keys(d.clientOrders)[0];assert.equal(d.wallet.guest.lastTx,id1);assert.equal(d.walletTx.guest[id1].amount,-100);
  // 2. 實際結帳：時裝 300
  t=setup({db:pushIds(guest)});t.c.curPlan={id:'p2',n:'衣服',p:300,itemId:'cloth9',itemName:'衣服'};price(t,300);await t.c.payWithCoins();assert(t.events.includes('success'),'買衣服應成功 '+t.events);
  d=await read();assert.equal(d.wallet.guest.balance,600);assert(d.owned.guest.cloth9&&d.clientOrders[d.owned.guest.cloth9.ref].itemId==='cloth9');
  // 3. 竄改前端價格（300 的衣服改成 10）：整筆被拒，什麼都沒變
  await env.withSecurityRulesDisabled(c=>c.database().ref('peiwan/owned/guest/cloth9').remove());const before=await read();
  t=setup({db:pushIds(guest)});t.c.curPlan={id:'p3',n:'衣服',p:10,itemId:'cloth9',itemName:'衣服'};price(t,10);await t.c.payWithCoins();assert(!t.events.includes('success'),'竄改價格不應成功');
  assert.deepEqual(await read(),before,'被拒的購買不能留下任何變更');
  // 4. 陪玩金幣單（狀態 confirmed）
  t=setup({db:pushIds(guest)});t.c.curKind='play';t.c.curPlan={id:'svc_s1',n:'特戰 1hr',p:300};price(t,300);await t.c.payWithCoins();assert(t.events.some(x=>x==='success'||String(x).includes('付款')),'金幣陪玩單應成功 '+t.events);
  d=await read();assert.equal(d.wallet.guest.balance,300);
  // 5. 兩個裝置同時花掉餘額：只有一筆成功，不會變負數
  const a=setup({db:pushIds(env.authenticatedContext(GUID).database())}),b=setup({db:pushIds(env.authenticatedContext(GUID).database())});
  for(const x of [a,b]){x.c.curKind='play';x.c.curPlan={id:'svc_s2',n:'特戰 1hr',p:300};price(x,300);}
  await Promise.allSettled([a.c.payWithCoins(),b.c.payWithCoins()]);d=await read();assert.equal(d.wallet.guest.balance,0);
  assert.equal(Object.values(d.clientOrders).filter(o=>o.plan==='svc_s2').length,1,'同時送出只能成立一筆');
  // 6. 作弊手法直接寫資料庫
  await assertFails(guest.ref('peiwan/owned/guest/free').set({name:'free',ts:1}));
  await assertFails(guest.ref('peiwan/wallet/guest/balance').set(99999));
  await assertFails(guest.ref('peiwan/walletTx/guest/fake').set({type:'spend',amount:-1,ref:'fake',ts:1}));
  await assertFails(guest.ref('peiwan/shopConfig/cloth9/price').set(0));
  await assertFails(env.authenticatedContext('discord_1').database().ref('peiwan/wallet/guest/balance').set(99999));
  await assertSucceeds(env.authenticatedContext('owner').database().ref('peiwan/wallet/guest/balance').set(500));
  await assertSucceeds(env.authenticatedContext('staff1').database().ref('peiwan/clientOrders/'+id1+'/status').set('cancelled'));
  console.log('PASS: v428 rules + actual checkout: signed-out payment rejected, dye ticket/outfit/play purchases succeed, client price tampering rejected atomically, concurrent overspend rejected, direct item/coin/tx/price forgery rejected, staff/admin unaffected');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
