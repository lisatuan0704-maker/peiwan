// v472 規則測試：開幕禮 350 金幣（本人在活動期間自己領一次）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'},STRANGER={uid:'email_stranger'};
const END=Date.parse('2026-11-08T00:00:00+08:00');
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},shopConfig:{cloth9:{price:350}},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 wallet:{k2:{balance:1000,lastTx:'old'}},walletTx:{k2:{old:{type:'spend',amount:-1,ref:'old'}}}}});
const inc=n=>({'.sv':{increment:n}});
const TS={'.sv':'timestamp'};
const claim=(k,tx,o={})=>({
 ['welcomeGift/'+k]:{tx,at:TS,amount:350,...(o.gift||{})},
 ['walletTx/'+k+'/'+tx]:{type:'welcome',amount:o.amount??350,ref:tx,note:'開幕禮',ts:TS,...(o.txExtra||{})},
 ['wallet/'+k+'/balance']:o.balance??inc(o.add??350),
 ['wallet/'+k+'/lastTx']:tx});
const drop=(o,key)=>{const c={...o};delete c[key];return c;};
const cases=[
 ['第一次領（還沒有錢包）','me','PATCH','peiwan',claim('k1','wg1'),true],
 ['第一次領（已有錢包 1000）','other','PATCH','peiwan',claim('k2','wg2'),true],
 ['已經領過再領一次','me','PATCH','peiwan',claim('k1','wg3'),false,'claimed'],
 ['一次領 500','me','PATCH','peiwan',claim('k1','wg4',{amount:500,add:500}),false],
 ['交易寫 350 但錢包加 700','me','PATCH','peiwan',claim('k1','wg5',{add:700}),false],
 ['錢包直接寫成 99999','me','PATCH','peiwan',claim('k1','wg6',{balance:99999}),false],
 ['只加錢、不寫領取紀錄','me','PATCH','peiwan',drop(claim('k1','wg7'),'welcomeGift/k1'),false],
 ['只寫領取紀錄、不加錢','me','PATCH','peiwan',drop(drop(claim('k1','wg8'),'wallet/k1/balance'),'walletTx/k1/wg8'),false],
 ['領取紀錄指向別筆交易','me','PATCH','peiwan',claim('k1','wg9',{gift:{tx:'other'}}),false],
 ['交易類型寫成 topup','me','PATCH','peiwan',claim('k1','wg10',{txExtra:{type:'topup'}}),false],
 ['幫別人的闆卡領','me','PATCH','peiwan',claim('k2','wg11'),false],
 ['未登入領',null,'PATCH','peiwan',claim('k1','wg12'),false],
 ['自己註冊的 Email 帳號領','stranger','PATCH','peiwan',claim('k1','wg13'),false],
 ['活動結束後領','me','PATCH','peiwan',claim('k1','wg14'),false,'ended'],
 ['本人讀自己的領取紀錄','me','GET','peiwan/welcomeGift/k1',undefined,true,'claimed'],
 ['讀別人的領取紀錄','me','GET','peiwan/welcomeGift/k2',undefined,false,'claimed'],
 ['店長讀全部領取紀錄','admin','GET','peiwan/welcomeGift',undefined,true,'claimed'],
 ['客人刪掉自己的領取紀錄（想再領）','me','DELETE','peiwan/welcomeGift/k1',undefined,false,'claimed'],
 ['店長手動調整金幣仍可用','admin','PUT','peiwan/wallet/k1/balance',500,true],
 ['客人自己加 350（沒有領取流程）','other','PUT','peiwan/wallet/k2/balance',1350,false],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const text=fs.readFileSync(rulesFile,'utf8');
  for(const variant of ['now','ended']){
   const rules=JSON.parse(variant==='ended'?text.split(String(END)).join(String(Date.now()-60000)):text);
   const ns='p6'+label.charCodeAt(0)+variant;await setRules(ns,rules);
   for(const [name,who,method,p,body,expect,setup] of cases){
    if((setup==='ended')!==(variant==='ended'))continue;
    const d=data();
    if(setup==='claimed'){d.peiwan.welcomeGift={k1:{tx:'wg0',at:1,amount:350},k2:{tx:'wgx',at:1,amount:350}};d.peiwan.wallet.k1={balance:350,lastTx:'wg0'};d.peiwan.walletTx.k1={wg0:{type:'welcome',amount:350,ref:'wg0'}};}
    await seed(ns,d);
    const w={me:ME,other:OTHER,admin:ADMIN,stranger:STRANGER}[who]||null;
    const r=await req(ns,method,p,body,w);
    if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
    else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
   }
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase6 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
