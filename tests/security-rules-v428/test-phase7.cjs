// v475 規則測試：每日任務 10 金幣（本人每天在大廳發一則訊息後自己領一次）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'},STRANGER={uid:'email_stranger'};
const NOW=Date.now(),TW=NOW+28800000,TODAY=(TW-TW%86400000)/86400000,DAYSTART=TODAY*86400000-28800000;
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 chat:{c1:{key:'k1',name:'小明',text:'嗨',t:NOW-1000},cOld:{key:'k1',name:'小明',text:'昨天',t:DAYSTART-1000},c2:{key:'k2',name:'小華',text:'哈囉',t:NOW-1000}},
 wallet:{k2:{balance:1000,lastTx:'old'}},walletTx:{k2:{old:{type:'spend',amount:-1,ref:'old'}}}}});
const inc=n=>({'.sv':{increment:n}});
const TS={'.sv':'timestamp'};
const claim=(k,tx,o={})=>({
 ['dailyTask/'+k]:{day:o.day??TODAY,tx:o.giftTx??tx,chat:o.chat??(k==='k1'?'c1':'c2'),at:TS,amount:10},
 ['walletTx/'+k+'/'+tx]:{type:o.type??'daily',amount:o.amount??10,ref:tx,note:'每日任務',ts:TS},
 ['wallet/'+k+'/balance']:o.balance??inc(o.add??10),
 ['wallet/'+k+'/lastTx']:tx});
const drop=(o,key)=>{const c={...o};delete c[key];return c;};
const cases=[
 ['今天第一次領（還沒有錢包）','me','PATCH','peiwan',claim('k1','d1'),true],
 ['今天第一次領（已有錢包 1000）','other','PATCH','peiwan',claim('k2','d2'),true],
 ['今天已經領過再領一次','me','PATCH','peiwan',claim('k1','d3'),false,'today'],
 ['昨天領過、今天再領','me','PATCH','peiwan',claim('k1','d4'),true,'yday'],
 ['一次領 20','me','PATCH','peiwan',claim('k1','d5',{amount:20,add:20}),false],
 ['交易寫 10 但錢包加 100','me','PATCH','peiwan',claim('k1','d6',{add:100}),false],
 ['錢包直接寫成 99999','me','PATCH','peiwan',claim('k1','d7',{balance:99999}),false],
 ['用昨天發的訊息領','me','PATCH','peiwan',claim('k1','d8',{chat:'cOld'}),false],
 ['用別人發的訊息領','me','PATCH','peiwan',claim('k1','d9',{chat:'c2'}),false],
 ['訊息不存在（沒發言）','me','PATCH','peiwan',claim('k1','d10',{chat:'nope'}),false],
 ['日期寫成明天','me','PATCH','peiwan',claim('k1','d11',{day:TODAY+1}),false],
 ['今天領過、日期寫成明天想多領','me','PATCH','peiwan',claim('k1','d12',{day:TODAY+1}),false,'today'],
 ['交易類型寫成 topup','me','PATCH','peiwan',claim('k1','d13',{type:'topup'}),false],
 ['領取紀錄指向別筆交易','me','PATCH','peiwan',claim('k1','d14',{giftTx:'other'}),false],
 ['只加錢、不寫領取紀錄','me','PATCH','peiwan',drop(claim('k1','d15'),'dailyTask/k1'),false],
 ['只寫領取紀錄、不加錢','me','PATCH','peiwan',drop(drop(claim('k1','d16'),'wallet/k1/balance'),'walletTx/k1/d16'),false],
 ['幫別人的闆卡領','me','PATCH','peiwan',claim('k2','d17'),false],
 ['未登入領',null,'PATCH','peiwan',claim('k1','d18'),false],
 ['自己註冊的 Email 帳號領','stranger','PATCH','peiwan',claim('k1','d19'),false],
 ['本人讀自己的紀錄','me','GET','peiwan/dailyTask/k1',undefined,true,'today'],
 ['讀別人的紀錄','me','GET','peiwan/dailyTask/k2',undefined,false,'today'],
 ['店長讀全部紀錄','admin','GET','peiwan/dailyTask',undefined,true,'today'],
 ['客人刪掉自己的紀錄（想再領）','me','DELETE','peiwan/dailyTask/k1',undefined,false,'today'],
 ['客人自己加 10（沒有任務流程）','other','PUT','peiwan/wallet/k2/balance',1010,false],
 ['店長手動調整金幣仍可用','admin','PUT','peiwan/wallet/k1/balance',500,true],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p7'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,setup] of cases){
   const d=data();
   if(setup==='today'||setup==='yday'){const day=setup==='today'?TODAY:TODAY-1;d.peiwan.dailyTask={k1:{day,tx:'d0',chat:'cOld',at:1,amount:10},k2:{day,tx:'dx',chat:'c2',at:1,amount:10}};d.peiwan.wallet.k1={balance:10,lastTx:'d0'};d.peiwan.walletTx.k1={d0:{type:'daily',amount:10,ref:'d0'}};}
   await seed(ns,d);
   const w={me:ME,other:OTHER,admin:ADMIN,stranger:STRANGER}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase7 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
