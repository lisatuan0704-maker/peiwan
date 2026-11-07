// v502 規則測試：掛機收益（離線也累積，每小時 22 貓貓幣，最多 8 小時＝176，金額由伺服器時間把關）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'},STRANGER={uid:'email_stranger'};
const H=3600000,RATE=22,CAP=176;
// k1：3 小時前開始計時（最多可領 66）、還沒有貓貓幣；k2：10 小時前上次領取（封頂 176）、已有 500 貓貓幣
const data=setup=>{
 const now=Date.now();
 const idle={k1:{at:now-3*H},k2:{at:now-10*H,tx:'i0',amount:50}};
 if(setup==='none')delete idle.k1;
 if(setup==='just')idle.k1={at:now-1000,tx:'i1',amount:66};
 return {secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
  config:{adminUid:'admin1'},
  lobby:{k1:{name:'小明'},k2:{name:'小華'}},
  idle,
  ...(setup==='just'?{cat:{k1:{balance:66,lastTx:'i1'},k2:{balance:500,lastTx:'i0'}},catTx:{k1:{i1:{type:'idle',amount:66,ref:'i1'}},k2:{i0:{type:'idle',amount:50,ref:'i0'}}}}
   :{cat:{k2:{balance:500,lastTx:'i0'}},catTx:{k2:{i0:{type:'idle',amount:50,ref:'i0'}}}})}};
};
const inc=n=>({'.sv':{increment:n}});
const TS={'.sv':'timestamp'};
// 領取：同一次寫入 idle 紀錄＋貓貓幣交易＋lastTx＋餘額
const claim=(k,tx,amt,o={})=>({
 ['idle/'+k]:{at:o.at??TS,tx:o.idleTx??tx,amount:o.idleAmt??amt},
 ['catTx/'+k+'/'+tx]:{type:o.type??'idle',amount:amt,ref:tx,note:'掛機收益',ts:TS},
 ['cat/'+k+'/balance']:o.balance??inc(o.add??amt),
 ['cat/'+k+'/lastTx']:tx});
const drop=(o,...keys)=>{const c={...o};keys.forEach(k=>delete c[k]);return c;};
// [名稱, 身分, 方法, 路徑, 內容, 預期, 初始資料]
const cases=[
 ['第一次開始計時（還沒有紀錄）','me','PUT','peiwan/idle/k1',{at:TS},true,'none'],
 ['開始計時把時間寫早（想直接領）','me','PUT','peiwan/idle/k1',{at:Date.now()-8*H},false,'none'],
 ['開始計時順便寫金額','me','PATCH','peiwan',claim('k1','s1',10),false,'none'],
 ['已經在計時，再重新開始一次','me','PUT','peiwan/idle/k1',{at:TS},false],
 ['3 小時後領 66（剛好）','me','PATCH','peiwan',claim('k1','a1',66),true],
 ['3 小時後少領 60','me','PATCH','peiwan',claim('k1','a2',60),true],
 ['3 小時後領 67（超過經過時間）','me','PATCH','peiwan',claim('k1','a3',67),false],
 ['10 小時後領 176（存滿封頂、已有貓貓幣）','other','PATCH','peiwan',claim('k2','b1',176),true],
 ['10 小時後領 220（超過 8 小時上限）','other','PATCH','peiwan',claim('k2','b2',220),false],
 ['10 小時後領 177','other','PATCH','peiwan',claim('k2','b3',177),false],
 ['領 0','me','PATCH','peiwan',claim('k1','a4',0),false],
 ['領負數','me','PATCH','peiwan',claim('k1','a5',-10),false],
 ['領小數 10.5','me','PATCH','peiwan',claim('k1','a6',10.5),false],
 ['剛領完馬上再領（重複領）','me','PATCH','peiwan',claim('k1','a7',1),false,'just'],
 ['剛領完用同一筆交易再領一次','me','PATCH','peiwan',claim('k1','i1',66),false,'just'],
 ['時間不改成現在（保留舊時間繼續累積）','me','PATCH','peiwan',claim('k1','a8',66,{at:Date.now()-3*H}),false],
 ['時間寫成未來','me','PATCH','peiwan',claim('k1','a9',66,{at:Date.now()+H}),false],
 ['交易寫 66 但貓貓幣加 1000','me','PATCH','peiwan',claim('k1','a10',66,{add:1000}),false],
 ['貓貓幣直接寫成 99999','me','PATCH','peiwan',claim('k1','a11',66,{balance:99999}),false],
 ['紀錄寫 60、交易與加錢寫 66','me','PATCH','peiwan',claim('k1','a12',66,{idleAmt:60}),false],
 ['交易類型寫成 daily','me','PATCH','peiwan',claim('k1','a13',66,{type:'daily'}),false],
 ['交易類型寫成 event','me','PATCH','peiwan',claim('k1','a14',66,{type:'event'}),false],
 ['領取紀錄指向別筆交易','me','PATCH','peiwan',claim('k1','a15',66,{idleTx:'zzz'}),false],
 ['只加錢、不寫領取紀錄','me','PATCH','peiwan',drop(claim('k1','a16',66),'idle/k1'),false],
 ['只寫領取紀錄、不加錢','me','PATCH','peiwan',drop(claim('k1','a17',66),'catTx/k1/a17','cat/k1/balance','cat/k1/lastTx'),false],
 ['寫領取紀錄＋交易，但餘額不動','me','PATCH','peiwan',drop(claim('k1','a18',66),'cat/k1/balance'),false],
 ['寫領取紀錄＋加錢，但沒有交易','me','PATCH','peiwan',drop(claim('k1','a19',66),'catTx/k1/a19'),false],
 ['幫別人的闆卡領','me','PATCH','peiwan',claim('k2','a20',176),false],
 ['未登入領',null,'PATCH','peiwan',claim('k1','a21',66),false],
 ['自己註冊的 Email 帳號領','stranger','PATCH','peiwan',claim('k1','a22',66),false],
 ['幫別人開始計時','me','PUT','peiwan/idle/k1',{at:TS},false,'none-other'],
 ['把上次領取時間改早','me','PUT','peiwan/idle/k1/at',Date.now()-8*H,false],
 ['刪掉自己的紀錄（想重新開始）','me','DELETE','peiwan/idle/k1',undefined,false],
 ['多寫其他欄位','me','PATCH','peiwan',{...claim('k1','a23',66),['idle/k1']:{at:TS,tx:'a23',amount:66,rate:99}},false],
 ['本人讀自己的紀錄','me','GET','peiwan/idle/k1',undefined,true],
 ['讀別人的紀錄','me','GET','peiwan/idle/k2',undefined,false],
 ['店長讀全部紀錄','admin','GET','peiwan/idle',undefined,true],
 ['店長調整紀錄','admin','PUT','peiwan/idle/k1',{at:Date.now()-5*H},true],
 ['店長刪除紀錄（重新開始計時）','admin','DELETE','peiwan/idle/k1',undefined,true],
 ['客人自己加 66（沒有掛機流程）','other','PUT','peiwan/cat/k2/balance',566,false],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p12'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,setup] of cases){
   const d=data(setup);
   if(setup==='none-other'){d.secureV1.owners.k1='discord_100000000000000002';d.secureV1.members.discord_100000000000000002.key='k1';delete d.peiwan.idle.k1;}
   await seed(ns,d);
   const w={me:ME,other:OTHER,admin:ADMIN,stranger:STRANGER}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 // 連續兩次：先領 66 成功，同一刻另一台裝置再送一次（新交易編號）要被擋
 {
  const ns='p12seq';await setRules(ns,JSON.parse(fs.readFileSync(newFile,'utf8')));await seed(ns,data());
  const a=await req(ns,'PATCH','peiwan',claim('k1','q1',66),ME),b=await req(ns,'PATCH','peiwan',claim('k1','q2',66),ME);
  const s=JSON.parse((await req(ns,'GET','peiwan',undefined,'owner')).body);
  const ok=a.ok&&!b.ok&&s.cat.k1.balance===66&&s.idle.k1.tx==='q1'&&s.idle.k1.amount===66&&Math.abs(s.idle.k1.at-Date.now())<10000&&!s.catTx.k1.q2;
  if(ok)pass++;else{fail++;console.log('✗ 兩台裝置同時領',a.ok,b.ok,JSON.stringify(s.cat),JSON.stringify(s.idle.k1));}
 }
 console.log((fail?'FAIL':'PASS')+': phase12 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
