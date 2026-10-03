const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const safety=require('../lobby-ui/payment-safety.js'),html=fs.readFileSync(require('path').join(__dirname,'../lobby.html'),'utf8');
function setup(opt={}){
 const storage=opt.storage||new Map(),held=new Set(),locks=opt.locks||{async request(n,o,fn){if(held.has(n))return fn(null);held.add(n);try{return await fn({});}finally{held.delete(n);}}};
 let balance=1000,debits=0,refunds=0,release,updates=[],events=[],timers=[];const values={};
 const nodes={payNameCoin:{value:'測試'},paySubmitBtn:{disabled:false,textContent:'送出訂單'}};
 const db={ref(path){return {key:path.split('/').pop(),push:()=>({key:'order1'}),on(type,fn){fn({val:()=>balance});return fn;},off(){},transaction(fn,cb){if(path.endsWith('/balance')){
  const v=fn(balance);if(v===undefined)return cb(null,false,{val:()=>balance});
  if(v<balance){debits++;if(opt.debitFail)return cb(Object.assign(Error('拒絕'),{code:'PERMISSION_DENIED'}),false);balance=v;cb(null,true,{val:()=>balance});}
  else {refunds++;if(opt.refundFail)return cb(Error('退款失敗'),false);balance=v;cb(null,true,{val:()=>balance});}
 }},once:async()=>({val:()=>values[path.replace(/^peiwan\//,'')]||null}),async update(patch){
  if(opt.hold)await new Promise(r=>release=r);
  if(opt.commitFail||opt.debitFail)throw Object.assign(Error('拒絕'),{code:'PERMISSION_DENIED'});
  if(opt.unknown)throw Error('回應不明');
  const delta=patch['wallet/guest/balance']?.['.sv']?.increment||0;
  if(balance+delta<0)throw Object.assign(Error('不足'),{code:'PERMISSION_DENIED'});
  balance+=delta;debits++;updates.push(JSON.parse(JSON.stringify(patch)));for(const [k,v]of Object.entries(patch))values[k]=v?.['.sv']?(values[k]||0)+v['.sv'].increment:v;
 }}}};
 const c={TTPaymentSafety:safety,navigator:{locks},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(opt.storageFail)throw Error('full');storage.set(k,v)},removeItem:k=>storage.delete(k)},db:opt.db||db,ROOT:'peiwan',Number,Promise,Set,Date,Error,document:{getElementById:id=>nodes[id]},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},toast:m=>events.push(m),shake(){},_submitting:false,myKey:'guest',curKind:'shop',curPlan:{id:'plan1',n:'染髮券',p:100,itemId:'dyeTicket',itemName:'染髮券'},curBooking:false,curReserveAt:null,selStaff:null,_selStaff:()=>null,payFinalAmount:()=>opt.amount??100,_coinCoupon:false,couponsLeft:()=>0,__wallet:1000,firebase:{database:{ServerValue:{increment:n=>({'.sv':{increment:n}})}}},myOrderIds:()=>[],shopClose(){events.push('close')},celebrate(){events.push('success')},statInc(){},notifyOrder(){events.push('notify')},watchMyOrders(){}};
 c.window=c;vm.createContext(c);
 const a=html.indexOf('function walletSafety()'),b=html.indexOf('/* 錢包顯示 + 儲值 */',a);vm.runInContext(html.slice(a,b),c);
 const g=html.indexOf('function submitGuard('),e=html.indexOf('/* ===================== 🔁',g);vm.runInContext(html.slice(g,e),c);
 return {c,storage,nodes,values,events,timers,release:()=>release(),state:()=>({balance,debits,refunds,updates})};
}
if(require.main===module)(async()=>{
 let t=setup();await t.c.payWithCoins();assert.equal(t.state().balance,900);assert.equal(t.values['owned/guest/dyeTickets'],1);assert(t.values['clientOrders/order1']);assert.equal(t.state().updates.length,1);assert.equal(t.events.filter(x=>x==='success').length,1);assert(!t.storage.has(safety.prefix+'guest'));
 t=setup({commitFail:true});await t.c.payWithCoins();assert.equal(t.state().balance,1000);assert(!t.values['owned/guest/dyeTickets']);assert(!t.values['clientOrders/order1']);assert(!t.events.includes('success'));assert(t.events.some(x=>x.includes('也未扣款')));
 t=setup({debitFail:true});await t.c.payWithCoins();assert.equal(t.state().balance,1000);assert.equal(t.state().updates.length,0);assert(!t.storage.has(safety.prefix+'guest'));
 t=setup({unknown:true});await t.c.payWithCoins();assert.equal(t.state().refunds,0,'未知結果不能假設失敗而退款');assert(t.storage.has(safety.prefix+'guest'));assert(!t.events.includes('success'));
 t=setup({storageFail:true});await t.c.payWithCoins();assert.equal(t.state().debits,0);
 for(const amount of [-1,NaN,Infinity,1.5]){t=setup({amount});await t.c.payWithCoins();assert.equal(t.state().debits,0);}
 t=setup({hold:true});const pending=t.c.payWithCoins();await new Promise(r=>setImmediate(r));assert(!t.events.includes('success'));assert(!t.values['owned/guest/dyeTickets']);t.timers[0]();assert(t.nodes.paySubmitBtn.disabled);assert(t.c._submitting);await t.c.payWithCoins();assert.equal(t.state().debits,0);t.c.myKey='other';t.c.curPlan.n='另一方案';t.release();await pending;assert.equal(t.values['clientOrders/order1'].myKey,'guest');assert.equal(t.values['clientOrders/order1'].planName,'染髮券');assert(!t.values['owned/other/dyeTickets']);
 // 同一分頁及不同分頁共用鎖；刷新後初始紀錄仍阻擋第二次扣款。
 let held=false,done;const locks={async request(n,o,fn){if(held)return fn(null);held=true;try{return await fn({});}finally{held=false;}}};
 const shared=new Map();const a=setup({locks,storage:shared,hold:true}),b=setup({locks,storage:shared});const first=a.c.payWithCoins();await new Promise(r=>setImmediate(r));await b.c.payWithCoins();assert.equal(b.state().debits,0);a.release();await first;
 shared.set(safety.prefix+'guest',JSON.stringify({stage:'debit_pending',ids:['old']}));const reload=setup({storage:shared});await reload.c.payWithCoins();assert.equal(reload.state().debits,0);assert(reload.events.some(x=>x.includes('上一筆')));
 // 成功但回應遺失：確認舊訂單後只清除舊紀錄，不再送出新扣款。
 const store=new Map([[safety.prefix+'guest',JSON.stringify({ids:['prior'],amount:100,stage:'commit_unconfirmed'})]]);
 const engine=safety.create({storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},locks:{request:async(n,o,fn)=>fn({})}});let writes=0;
 await assert.rejects(engine.execute({key:'guest',amount:100,ids:['next'],lookup:async()=>[{myKey:'guest',paidBy:'wallet',amount:100}],commit:async()=>writes++}),e=>e.code==='RECOVERED');assert.equal(writes,0);assert(!store.has(safety.prefix+'guest'));
 const unsupported=safety.create({storage:{},locks:null});await assert.rejects(unsupported.execute({key:'guest',amount:100,ids:['x'],commit:async()=>writes++}),e=>e.code==='UNSUPPORTED');
 // 網頁回跳參數不能宣稱付款成功，審核中不可建立線上付款。
 assert(!html.includes("title:'付款完成!'"));assert(html.includes('const ONLINE_PAYMENT_READY=false;'));assert(html.includes('if(!ONLINE_PAYMENT_READY)'));
 assert(!html.includes('saveProof(ref.key, proofData).then'));assert(!html.includes('saveProof(ref.key, tuProofData).then'));
 console.log('PASS: actual single-order flow, atomic delivery, all-or-nothing debit/order/delivery and unknown acknowledgement, invalid amounts, delayed commit, timeout lock, mutable form snapshot, cross-tab contention, reload journal, payment-return wording and pending gateway');
})().catch(e=>{console.error(e);process.exitCode=1});

module.exports={setup};
