// v492 規則測試：貓貓幣（兌換、時裝付款、每日任務 11/07 起改送 100 貓貓幣）。
// 「11/07 以後」的案例用把切換時間改到過去的同一份規則來測。
// v493 第十批：貓貓幣只能付 shopConfig 標 cur:'cat' 的商品 → 這裡的 cloth9 標成貓貓幣商品，染髮券改為只收金幣。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const CUT='1793980800000';
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'},STRANGER={uid:'email_stranger'};
const NOW=Date.now(),TODAY=Math.floor((NOW+28800000)/86400000);
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1',services:{s1:{price:300}}},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{cloth9:{price:300,active:true,cur:'cat'}},
 chat:{m1:{key:'k1',name:'小明',text:'嗨',t:NOW,map:'hall'}},
 wallet:{k1:{balance:1000,lastTx:'x0'},k2:{balance:1000,lastTx:'y0'}},
 walletTx:{k1:{x0:{type:'topup',amount:1000,ref:'x0'}},k2:{y0:{type:'topup',amount:1000,ref:'y0'}}},
 cat:{k1:{balance:5000,lastTx:'c0'}},
 catTx:{k1:{c0:{type:'exchange',coin:500,amount:5000,ref:'c0'}}}}});
const inc=n=>({'.sv':{increment:n}});
const TS={'.sv':'timestamp'};
const bonus=c=>c===350?200:c===1000?1000:0;
const ex=(k,tx,coin,o={})=>{const amt=o.amount??coin*10+bonus(coin);const r={
 ['walletTx/'+k+'/'+tx]:{type:o.wtype??'exchange',amount:o.wamount??-coin,ref:tx,ts:1},
 ['wallet/'+k+'/balance']:inc(o.wdelta??-coin),
 ['wallet/'+k+'/lastTx']:tx,
 ['catTx/'+k+'/'+tx]:{type:'exchange',coin,amount:amt,ref:tx,ts:1},
 ['cat/'+k+'/balance']:inc(o.cdelta??amt),
 ['cat/'+k+'/lastTx']:tx};
 if(o.noWallet){delete r['walletTx/'+k+'/'+tx];delete r['wallet/'+k+'/balance'];delete r['wallet/'+k+'/lastTx'];}
 return r;};
const catOrder=(id,amt,o={})=>({
 ['clientOrders/'+id]:{myKey:'k1',paidBy:'cat',type:o.type??'shop',status:o.status??'done',plan:o.item??'cloth9',itemId:o.item??'cloth9',amount:amt,catAmount:o.catAmount??amt*10,createdAt:1,name:'小明'},
 ...(o.noPay?{}:{['catTx/k1/'+id]:{type:'spend',amount:o.txAmount??-(o.catAmount??amt*10),ref:id,ts:1},
 ['cat/k1/balance']:inc(o.balDelta??o.txAmount??-(o.catAmount??amt*10)),['cat/k1/lastTx']:id})});
const buyCloth=(id,amt,o={})=>({...catOrder(id,amt,o),['owned/k1/cloth9']:{name:'cloth9',ts:1,ref:id}});
const buyDye=(id,amt,o={})=>({...catOrder(id,amt,{...o,item:'dyeTicket'}),['owned/k1/dyeTickets']:inc(1)});
const walletPay=(id,o)=>({['clientOrders/'+id]:{myKey:'k1',paidBy:'wallet',status:o.type==='shop'?'done':'confirmed',createdAt:1,name:'小明',couponUsed:false,...o},['wallet/k1/balance']:inc(-o.amount),['wallet/k1/lastTx']:id,['walletTx/k1/'+id]:{type:'spend',amount:-o.amount,ref:id,ts:1}});
const dailyCat=(tx,o={})=>({['dailyTask/k1']:{day:TODAY,tx,chat:'m1',at:TS,amount:o.amount??100},['catTx/k1/'+tx]:{type:'daily',amount:o.amount??100,ref:tx,ts:TS},['cat/k1/balance']:inc(o.amount??100),['cat/k1/lastTx']:tx});
const dailyCoin=(tx,o={})=>({['dailyTask/k1']:{day:TODAY,tx,chat:'m1',at:TS,amount:10},['walletTx/k1/'+tx]:{type:'daily',amount:10,ref:tx,ts:TS},['wallet/k1/balance']:inc(10),['wallet/k1/lastTx']:tx});
const drop=(o,...keys)=>{const c={...o};for(const k of keys)delete c[k];return c;};
// [名稱, 身分, 方法, 路徑, 內容, 預期, 時間（now／after）, 前置]
const cases=[
 ['兌換 100 金幣 → 1000 貓貓幣','me','PATCH','peiwan',ex('k1','e1',100),true],
 ['兌換 350 金幣 → 3500＋加送 200','me','PATCH','peiwan',ex('k1','e2',350),true],
 ['兌換 1000 金幣 → 10000＋加送 1000','me','PATCH','peiwan',ex('k1','e3',1000),true],
 ['沒有貓貓幣錢包也能兌換（小華）','other','PATCH','peiwan',ex('k2','e4',100),true],
 ['兌換 100 卻寫 1200 貓貓幣','me','PATCH','peiwan',ex('k1','e5',100,{amount:1200}),false],
 ['兌換 349 自稱有加送','me','PATCH','peiwan',ex('k1','e6',349,{amount:3690}),false],
 ['只扣 10 金幣卻換 100 份','me','PATCH','peiwan',ex('k1','e7',100,{wamount:-10,wdelta:-10}),false],
 ['只加貓貓幣、不扣金幣','me','PATCH','peiwan',ex('k1','e8',100,{noWallet:true}),false],
 ['交易寫 1000 但餘額加 9999','me','PATCH','peiwan',ex('k1','e9',100,{cdelta:9999}),false],
 ['金幣不夠還兌換（1000 換 2000）','me','PATCH','peiwan',ex('k1','e10',2000),false],
 ['幫別人兌換','me','PATCH','peiwan',ex('k2','e11',100),false],
 ['未登入兌換',null,'PATCH','peiwan',ex('k1','e12',100),false],
 ['兌換的扣款拿去付陪玩單','me','PATCH','peiwan',{...ex('k1','e13',300),['clientOrders/e13']:{myKey:'k1',paidBy:'wallet',type:'play',plan:'svc_s1',amount:300,status:'confirmed',createdAt:1,name:'小明'}},false],
 ['兌換的扣款拿去當群組單','me','PATCH','peiwan',{...ex('k1','e14',300),['clientOrders/g1']:{myKey:'k1',paidBy:'wallet',type:'play',plan:'svc_s1',amount:300,groupId:'e14',status:'confirmed',createdAt:1,name:'小明'}},false],
 ['反向：貓貓幣換回金幣','me','PATCH','peiwan',{['catTx/k1/r1']:{type:'spend',amount:-1000,ref:'r1'},['cat/k1/balance']:inc(-1000),['cat/k1/lastTx']:'r1',['walletTx/k1/r1']:{type:'exchange',amount:100,ref:'r1'},['wallet/k1/balance']:inc(100),['wallet/k1/lastTx']:'r1'},false],
 ['用貓貓幣買衣服（300 → 3000）','me','PATCH','peiwan',buyCloth('o1',300),true],
 ['貓貓幣只付 2990','me','PATCH','peiwan',buyCloth('o2',299),false],
 ['訂單寫 3000 但只扣 30 貓貓幣','me','PATCH','peiwan',buyCloth('o3',300,{txAmount:-30}),false],
 ['catAmount 不是 10 倍（300 付 300）','me','PATCH','peiwan',buyCloth('o4',300,{catAmount:300}),false],
 ['貓貓幣訂單用「待確認」不付錢拿衣服','me','PATCH','peiwan',buyCloth('o5',300,{status:'pending',noPay:true}),false],
 ['貓貓幣訂單標已完成但沒扣款','me','PATCH','peiwan',buyCloth('o6',300,{noPay:true}),false],
 ['貓貓幣不夠（5000 買 6000）','me','PATCH','peiwan',{...catOrder('o7',600),['owned/k1/cloth9']:{name:'cloth9',ts:1,ref:'o7'}},false],
 ['用貓貓幣買染髮券（v493 起只收金幣）','me','PATCH','peiwan',buyDye('o8',299),false],
 ['染髮券貓貓幣只付 2980','me','PATCH','peiwan',buyDye('o9',298),false],
 ['用貓貓幣付陪玩單','me','PATCH','peiwan',catOrder('o10',300,{type:'play',item:'svc_s1'}),false],
 ['沒有金幣紀錄用貓貓幣買染髮券（v493 起只收金幣）','me','PATCH','peiwan',buyDye('o11',299),false,'now','nowallet'],
 ['沒有金幣紀錄也能用貓貓幣買衣服','me','PATCH','peiwan',buyCloth('o12',300),true,'now','nowallet'],
 ['沒有貓貓幣紀錄也能用金幣買染髮券','me','PATCH','peiwan',{...walletPay('w3',{type:'shop',plan:'dyeTicket',itemId:'dyeTicket',amount:299}),['owned/k1/dyeTickets']:inc(1)},true,'now','nocat'],
 ['貓貓幣直接寫成 99999','me','PUT','peiwan/cat/k1/balance',99999,false],
 ['扣貓貓幣但沒有交易紀錄','me','PATCH','peiwan',{['cat/k1/balance']:inc(-100),['cat/k1/lastTx']:'z1'},false],
 ['偽造一筆貓貓幣收入','me','PATCH','peiwan',{['catTx/k1/z2']:{type:'adjust',amount:500,ref:'z2'},['cat/k1/balance']:inc(500),['cat/k1/lastTx']:'z2'},false],
 ['刪除自己的貓貓幣紀錄','me','DELETE','peiwan/catTx/k1/c0',undefined,false],
 ['陌生人看小明的貓貓幣','stranger','GET','peiwan/cat/k1',undefined,false],
 ['小華看小明的貓貓幣','other','GET','peiwan/cat/k1',undefined,false],
 ['小明看自己的貓貓幣','me','GET','peiwan/cat/k1',undefined,true],
 ['小明看自己的貓貓幣紀錄','me','GET','peiwan/catTx/k1',undefined,true],
 ['店長讀全部貓貓幣','admin','GET','peiwan/cat',undefined,true],
 ['店長手動調整貓貓幣','admin','PATCH','peiwan',{['cat/k1/balance']:9000,['catTx/k1/a1']:{type:'adjust',amount:4000,ref:'a1',note:'補償'}},true],
 ['金幣買衣服仍可用（舊流程）','me','PATCH','peiwan',{...walletPay('w1',{type:'shop',plan:'cloth9',itemId:'cloth9',amount:300}),['owned/k1/cloth9']:{name:'cloth9',ts:1,ref:'w1'}},true],
 ['金幣付陪玩單仍可用','me','PATCH','peiwan',walletPay('w2',{type:'play',plan:'svc_s1',amount:300}),true],
 ['11/06 以前：每日任務 +10 金幣','me','PATCH','peiwan',dailyCoin('d1'),true,'now'],
 ['11/06 以前：每日任務 +100 貓貓幣','me','PATCH','peiwan',dailyCat('d2'),false,'now'],
 ['11/07 起：每日任務 +100 貓貓幣','me','PATCH','peiwan',dailyCat('d3'),true,'after'],
 ['11/07 起：沒有貓貓幣錢包也能領','me','PATCH','peiwan',dailyCat('d4'),true,'after','nocat'],
 ['11/07 起：每日任務 +10 金幣','me','PATCH','peiwan',dailyCoin('d5'),false,'after'],
 ['11/07 起：每日任務寫成 1000','me','PATCH','peiwan',dailyCat('d6',{amount:1000}),false,'after'],
 ['11/07 起：同一天領第二次','me','PATCH','peiwan',dailyCat('d7'),false,'after','claimed'],
 ['11/07 起：只加貓貓幣不寫任務紀錄','me','PATCH','peiwan',drop(dailyCat('d8'),'dailyTask/k1'),false,'after'],
 ['11/07 起：幫別人領','other','PATCH','peiwan',dailyCat('d9'),false,'after'],
];
(async()=>{
 let pass=0,fail=0;
 const newRules=JSON.parse(fs.readFileSync(newFile,'utf8'));
 const afterRules=JSON.parse(JSON.stringify(newRules).split(CUT).join('1700000000000'));
 if(!JSON.stringify(newRules).includes(CUT))throw Error('切換時間不在規則裡');
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8')),'now'],['新規則',newRules,'now'],['新規則',afterRules,'after']];
 for(const [label,rules,mode] of sets){
  const ns='p9'+label.charCodeAt(0)+mode;await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,when='now',setup] of cases){
   if(when!==mode&&!(when==='now'&&mode==='now'))continue;
   if(label==='舊規則'&&when!=='now')continue;
   const d=data();
   if(setup==='nocat'){delete d.peiwan.cat;delete d.peiwan.catTx;}
   if(setup==='nowallet'){delete d.peiwan.wallet.k1;delete d.peiwan.walletTx.k1;}
   if(setup==='claimed')d.peiwan.dailyTask={k1:{day:TODAY,tx:'dz',chat:'m1',at:1,amount:100}};
   await seed(ns,d);
   const w={me:ME,other:OTHER,admin:ADMIN,stranger:STRANGER}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase9 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
