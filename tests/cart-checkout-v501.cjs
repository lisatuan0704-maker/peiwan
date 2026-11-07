// v501 商城「全部結帳」：大廳實際 payCartWithCoins（lobby.html 抽出）＋本機 Database Emulator（預設 9273）＋正式規則 security/database.rules.json。
// 每件仍是一筆完整交易；驗證成功、餘額不足、第二件被拒、第二件結果不明＋重整、重複結帳、金幣＋貓貓幣、兩個分頁同時按。
// 用法：先啟動 RTDB emulator，node tests/cart-checkout-v501.cjs（TT_EMU=127.0.0.1:9000 可換位址）
'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {setup}=require('./payment-safety-v273.cjs');
const safety=require('../lobby-ui/payment-safety.js');
const EMU='http://'+(process.env.TT_EMU||'127.0.0.1:9273');
const rules=JSON.parse(fs.readFileSync(process.env.TT_RULES||path.join(__dirname,'../security/database.rules.json'),'utf8'));   // TT_RULES 可指定別份規則
const UID='discord_100000000000000001',KEY='guest';
const tok=uid=>{const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const n=Math.floor(Date.now()/1000);return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/my-shop-0520',aud:'my-shop-0520',iat:n,exp:n+3600,auth_time:n,sub:uid,user_id:uid,firebase:{sign_in_provider:'custom',identities:{}}})+'.';};
let NS;
async function call(method,p,body,who=UID){const q=new URLSearchParams({ns:NS});if(who!=='owner')q.set('auth',tok(who));const r=await fetch(`${EMU}/${p}.json?${q}`,{method,headers:who==='owner'?{Authorization:'Bearer owner'}:{},body:body===undefined?undefined:JSON.stringify(body)});return {ok:r.ok,status:r.status,body:await r.text()};}
const read=async()=>JSON.parse((await call('GET','peiwan',undefined,'owner')).body);
const ITEMS={itA:{name:'啟程旅人・眼鏡',price:30},itB:{name:'啟程旅人・菜刀',price:30},itC:{name:'微風日常・青春洋溢髮箍',price:30},itD:{name:'單買測試',price:40},catX:{name:'日常上衣',price:15,cur:'cat'}};
async function seed(o={}){
 const shopConfig={};for(const [k,v] of Object.entries(ITEMS))shopConfig[k]={name:v.name,price:v.price,active:true,...(v.cur?{cur:v.cur}:{})};Object.assign(shopConfig,o.shop||{});
 const peiwan={config:{adminUid:'admin1'},lobby:{[KEY]:{name:'測試'}},shopConfig,wallet:{[KEY]:{balance:o.wallet??1000,lastTx:'w0'}},walletTx:{[KEY]:{w0:{type:'topup',amount:o.wallet??1000,ref:'w0',ts:1}}}};
 if(o.cat!=null){peiwan.cat={[KEY]:{balance:o.cat,lastTx:'c0'}};peiwan.catTx={[KEY]:{c0:{type:'adjust',amount:o.cat,ref:'c0',ts:1}}};}
 const r=await call('PUT','',{secureV1:{members:{[UID]:{active:true,key:KEY}},owners:{[KEY]:UID}},peiwan},'owner');if(!r.ok)throw Error('seed '+r.body);
}
// 真的打到模擬資料庫的 db：push 產生編號、update＝REST 多路徑 PATCH（以本人身分，正式規則判斷）
function restDb(hook={}){let n=0;return {ref(p){return {key:p.split('/').pop(),
 push:()=>({key:'o'+Date.now().toString(36)+'_'+(++n)+Math.random().toString(36).slice(2,6)}),
 async update(changes){hook.n=(hook.n||0)+1;if(hook.before)await hook.before(hook.n,changes);const r=await call('PATCH',p,changes);
  if(!r.ok){if(r.status===401||/Permission denied/i.test(r.body))throw Object.assign(Error('拒絕'),{code:'PERMISSION_DENIED'});throw Error('寫入失敗 '+r.status);}
  if(hook.after)await hook.after(hook.n,changes);},
 on(){},off(){},once:async()=>({val:()=>null,exists:()=>false})};}};}
const plan=id=>({id,n:'時裝・'+ITEMS[id].name,p:ITEMS[id].price,itemId:id,itemName:ITEMS[id].name,...(ITEMS[id].cur?{cur:ITEMS[id].cur}:{})});
const cartPlan=items=>({id:'cart',cart:true,items,n:'一起結帳 '+items.length+' 件',p:items.filter(x=>x.cur!=='cat').reduce((n,x)=>n+x.p,0),catP:items.filter(x=>x.cur==='cat').reduce((n,x)=>n+x.p,0)});
// 一個「分頁」：大廳付款程式＋模擬資料庫；recheck 預設照資料庫的最新價格與持有重算（跟商城橋接 shopPlan 一樣會擋已持有）
async function tab(ids,o={}){
 const t=setup({db:restDb(o.hook),storage:o.storage,locks:o.locks});const c=t.c,d=await read();
 c.curPlan=cartPlan(ids.map(plan));c.__wallet=d.wallet?.[KEY]?.balance||0;c.__cat=d.cat?.[KEY]?.balance||0;
 c.firebaseConfig={databaseURL:'http://emu'};c.firebase.auth=()=>({currentUser:null});c.AbortController=AbortController;
 c.myOrderIds=()=>{try{return JSON.parse(t.storage.get('tt_orders')||'[]');}catch(_){return [];}};
 c.fetch=(u,opt)=>{const x=new URL(u.replace('http://emu',EMU));x.searchParams.set('ns',NS);x.searchParams.set('auth',tok(UID));return fetch(x,opt);};
 c.renderCoinInfo=()=>t.events.push('rerender');c.TTSeatUI={state:()=>({})};c.TTRetiredOutfits={retired:()=>false};
 c.ttConfirm=(title,sub)=>t.events.push({title,sub});
 c.TinyTavernUI={cartRecheck:items=>{if(o.stale)return cartPlan(items);const owned=d.owned?.[KEY]||{};return cartPlan(items.map(x=>{if(owned[x.itemId])throw Error('這件商品已在背包裡');const s=d.shopConfig[x.itemId];return {...x,p:s.price};}));}};
 return t;
}
const orders=d=>Object.entries(d.clientOrders||{});
(async()=>{
 NS='cart501'+Date.now()%100000;
 let r=await fetch(`${EMU}/.settings/rules.json?ns=${NS}`,{method:'PUT',headers:{Authorization:'Bearer owner'},body:JSON.stringify(rules)});if(!r.ok)throw Error('rules '+await r.text());
 const res=[];const ok=m=>{res.push(m);console.log('  ✓ '+m);};

 // 0. 單件結帳（v500 原流程，抽出 coinPayChanges 後）照常，當作訂單格式基準
 await seed();let t=setup({db:restDb()});Object.assign(t.c,{curPlan:plan('itD'),payFinalAmount:()=>40,__wallet:1000});await t.c.payWithCoins();
 let d=await read();assert(t.events.includes('success'),'單件應成功 '+t.events);assert.equal(d.wallet[KEY].balance,960);
 const single=Object.values(d.clientOrders)[0];ok('單件結帳照常（餘額 1000→960，訂單＋明細＋背包）');

 // 1. 三件一次結帳成功
 await seed();t=await tab(['itA','itB','itC']);await t.c.payWithCoins();d=await read();
 assert.equal(t.events.filter(x=>x==='success').length,1,'應只跳一次成功 '+JSON.stringify(t.events));
 assert.equal(d.wallet[KEY].balance,910,'餘額剛好減 90');assert.equal(orders(d).length,3,'三筆訂單');
 for(const id of ['itA','itB','itC']){const own=d.owned[KEY][id];assert(own,'背包要有 '+id);const ord=d.clientOrders[own.ref];assert.equal(ord.itemId,id);assert.equal(ord.amount,30);assert.equal(ord.paidBy,'wallet');assert.equal(ord.status,'done');assert.equal(d.walletTx[KEY][own.ref].amount,-30);}
 assert.deepEqual(Object.keys(Object.values(d.clientOrders)[0]).sort(),Object.keys(single).sort(),'一起結帳的訂單欄位要跟單件一樣');
 assert.equal(d.clientOrders[d.wallet[KEY].lastTx].itemId,'itC','lastTx 指向最後一筆');
 assert(!t.storage.has(safety.prefix+KEY),'不留未確認紀錄');assert.deepEqual(JSON.parse(t.storage.get('tt_orders')||'[]').length,3,'三筆訂單都記進本機訂單清單');
 ok('三件一次結帳：餘額 1000→910、三件都在背包、三筆訂單與扣款明細、格式同單件');

 // 2. 餘額不足：一件都不扣
 await seed({wallet:80});let before=await read();t=await tab(['itA','itB','itC']);await t.c.payWithCoins();
 assert.deepEqual(await read(),before,'餘額不足不能有任何寫入');assert(t.events.some(x=>typeof x==='string'&&x.includes('金幣不夠')),t.events);ok('餘額 80 買 90：沒有任何寫入，提示金幣不夠');

 // 3. 第二件被資料庫拒絕（結帳途中店長把價格調高）：第一件照常持有，第二件沒扣款，第三件不送
 await seed();t=await tab(['itA','itB','itC'],{stale:true,hook:{before:async n=>{if(n===2)await call('PUT','peiwan/shopConfig/itB/price',50,'owner');}}});await t.c.payWithCoins();d=await read();
 assert.equal(d.wallet[KEY].balance,970);assert.deepEqual(Object.keys(d.owned[KEY]),['itA']);assert.equal(orders(d).length,1);
 let msg=t.events.find(x=>x&&x.title);assert(msg&&msg.title==='買到 1 件，還有 2 件沒買到',JSON.stringify(t.events));assert(msg.sub.includes('沒買到：「啟程旅人・菜刀」，沒有扣款')&&msg.sub.includes('還沒結帳：「微風日常・青春洋溢髮箍」'),msg.sub);
 assert(!t.storage.has(safety.prefix+KEY),'被拒的不留未確認紀錄');assert(!t.events.includes('success'));
 ok('第二件被拒：只扣第一件 30、背包只有第一件、第二件沒扣款、第三件沒送出，視窗列出買到／沒買到／還沒結帳');

 // 4. 第二件送出後回應遺失（已寫入但不知道）：停下、留未確認紀錄；重整後再按，不會重複扣第二件
 await seed();const storage=new Map();
 t=await tab(['itA','itB','itC'],{storage,hook:{after:async n=>{if(n===2)throw Error('網路中斷');}}});await t.c.payWithCoins();d=await read();
 assert.equal(d.wallet[KEY].balance,940,'前兩件真的寫進去了');assert(!d.owned[KEY].itC,'第三件不送');msg=t.events.find(x=>x&&x.title);
 assert(msg&&msg.sub.includes('付款結果還沒確認'),JSON.stringify(t.events));assert(storage.has(safety.prefix+KEY),'留下未確認紀錄');
 // 重整：背包已有 A、B（recheck 會擋），老闆再按剩下的 C
 t=await tab(['itC'],{storage});await t.c.payWithCoins();d=await read();
 assert.equal(d.wallet[KEY].balance,940,'第一次再按：先確認上一筆，不扣款');assert(t.events.some(x=>typeof x==='string'&&x.includes('上一筆付款已確認完成')),JSON.stringify(t.events));assert(!storage.has(safety.prefix+KEY));
 t=await tab(['itC'],{storage});await t.c.payWithCoins();d=await read();
 assert.equal(d.wallet[KEY].balance,910);assert.equal(orders(d).length,3);assert.equal(Object.values(d.clientOrders).filter(o=>o.itemId==='itB').length,1,'第二件只有一筆');
 ok('第二件結果不明：停下並留紀錄；重整後先確認上一筆（不扣款），再買第三件，總共剛好扣 90、沒有重複');

 // 5. 全部買完後重整再按同一組：一件都不扣（商城重算擋下；就算畫面是舊的，資料庫也拒絕重複持有）
 await seed();t=await tab(['itA','itB','itC']);await t.c.payWithCoins();before=await read();
 t=await tab(['itA','itB','itC']);await t.c.payWithCoins();assert.deepEqual(await read(),before);assert(t.events.some(x=>typeof x==='string'&&x.includes('已在背包裡')),JSON.stringify(t.events));
 t=await tab(['itA','itB','itC'],{stale:true});await t.c.payWithCoins();assert.deepEqual(await read(),before,'舊畫面硬送也不能扣款');assert(t.events.some(x=>typeof x==='string'&&x.includes('也未扣款')),JSON.stringify(t.events));
 ok('重整後重複結帳同一組：商城重算擋下；舊畫面硬送也整筆被拒，餘額不變');

 // 6. 價格變了：先更新畫面，不扣款
 await seed();before=await read();t=await tab(['itA','itB']);t.c.curPlan.items[1].p=20;t.c.curPlan.p=50;await t.c.payWithCoins();
 assert.deepEqual(await read(),before);assert(t.events.includes('rerender')&&t.c.curPlan.p===60,'要換成新價格並重畫');ok('結帳前重讀價格：價格不同就更新畫面、不扣款');

 // 7. 金幣＋貓貓幣一起結帳
 await seed({cat:500});t=await tab(['itA','catX']);await t.c.payWithCoins();d=await read();
 assert.equal(d.wallet[KEY].balance,970);assert.equal(d.cat[KEY].balance,350);const cx=d.clientOrders[d.owned[KEY].catX.ref];assert.equal(cx.paidBy,'cat');assert.equal(cx.catAmount,150);
 ok('金幣 30＋貓貓幣 150 一起結帳：各扣各的、兩件都在背包');

 // 8. 兩個分頁同時按：只成立一組
 await seed();let held=false;const locks={async request(n,o,fn){if(held)return fn(null);held=true;try{return await fn({});}finally{held=false;}}},shared=new Map();
 const a=await tab(['itA','itB','itC'],{storage:shared,locks}),b=await tab(['itA','itB','itC'],{storage:shared,locks});
 await Promise.all([a.c.payWithCoins(),b.c.payWithCoins()]);d=await read();
 assert.equal(d.wallet[KEY].balance,910);assert.equal(orders(d).length,3);ok('兩個分頁同時按：只扣一次 90、三筆訂單（另一個分頁被交易鎖擋下）');

 console.log('PASS cart-checkout-v501: '+res.length+' 項');
})().catch(e=>{console.error(e);process.exitCode=1;});
