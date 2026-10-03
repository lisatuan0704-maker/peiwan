const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{createRequire}=require('module');
const req=createRequire(path.resolve(__dirname,'../../../output/qa-runtime-v273/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=req('@firebase/rules-unit-testing');
const {setup}=require('./payment-safety-v273.cjs');
(async()=>{
 const rules=fs.readFileSync(path.join(__dirname,'../security/database.rules.v273.json'),'utf8');
 const env=await initializeTestEnvironment({projectId:'demo-tiny-tavern-v273',database:{host:'127.0.0.1',port:9273,rules}});
 const read=async()=>{let value;await env.withSecurityRulesDisabled(async c=>{value=(await c.database().ref('peiwan').once('value')).val();});return value;};
 try{
  await env.clearDatabase();await env.withSecurityRulesDisabled(c=>c.database().ref('peiwan').set({config:{adminUid:'owner'},wallet:{guest:{balance:1000}},owned:{guest:{dyeTickets:2}}}));
  const guest=env.unauthenticatedContext().database(),admin=env.authenticatedContext('owner').database(),other=env.authenticatedContext('staff').database();
  let t=setup({db:guest});await t.c.payWithCoins();assert(t.events.includes('success'));
  let data=await read();
  assert.equal(data.wallet.guest.balance,900);assert.equal(data.owned.guest.dyeTickets,3);assert.equal(Object.keys(data.clientOrders).length,1);assert.equal(Object.keys(data.walletTx.guest).length,1);
  // 同一次更新有任一節點遭拒，餘額、訂單、明細及商品全部不動。
  const badDb={ref(p){const r=guest.ref(p);if(p==='peiwan')return {update:patch=>r.update({...patch,'config/forbidden':true})};return r;}};
  t=setup({db:badDb});await t.c.payWithCoins();assert(!t.events.includes('success'));assert(t.events.some(x=>x.includes('也未扣款')));
  const after=await read();assert.deepEqual(after,data);
  await assertFails(guest.ref('peiwan/wallet/new-account/balance').set(100000));
  await assertFails(guest.ref('peiwan/wallet/guest/balance').set(901));
  await assertFails(admin.ref('peiwan/wallet/guest/balance').set(-1));
  await assertFails(admin.ref('peiwan/wallet/guest/balance').set(1.5));
  await assertFails(other.ref('peiwan/config/adminUid').set('staff'));
  await assertFails(admin.ref('peiwan/config/adminUid').set('staff'));
  await assertSucceeds(admin.ref('peiwan/config/testFlag').set(true));
  await env.withSecurityRulesDisabled(c=>c.database().ref('peiwan/wallet/guest/balance').set(100));
  const spend=id=>env.unauthenticatedContext().database().ref('peiwan').update({['wallet/guest/balance']:{'.sv':{increment:-80}},['clientOrders/'+id]:{myKey:'guest',amount:80,paidBy:'wallet'},['owned/guest/'+id]:true});
  const outcomes=await Promise.allSettled([spend('race-a'),spend('race-b')]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  data=await read();assert.equal(data.wallet.guest.balance,20);assert.equal(['race-a','race-b'].filter(k=>data.clientOrders[k]).length,1);assert.equal(['race-a','race-b'].filter(k=>data.owned.guest[k]).length,1);
  console.log('PASS: real Firebase emulator + actual checkout: atomic debit/order/log/item, whole-write rollback, simultaneous overspend rejected, no guest initialization/increase, no negative/fraction balance, config admin takeover rejected');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
