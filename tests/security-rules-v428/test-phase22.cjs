// v522 規則測試：小屋座位多帶「剩下要轉的彎」r（朋友照路線推算現在位置）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const U=n=>({uid:'discord_10000000000000000'+n});
const ME=U(1),FRIEND=U(2),GUEST=U(3);
const TS={'.sv':'timestamp'};
// k1＝主人（小明）坐 0 號、k3＝來玩的老闆（小美）坐 2 號；小屋公開
const data=()=>{const now=Date.now(),seat=(k,name)=>({k,name,i:5,j:5,f:1,at:now});
 return {secureV1:{members:{[ME.uid]:{active:true,key:'k1'},[FRIEND.uid]:{active:true,key:'k2'},[GUEST.uid]:{active:true,key:'k3'}},
  owners:{k1:ME.uid,k2:FRIEND.uid,k3:GUEST.uid}},
  peiwan:{config:{adminUid:'admin1'},lobby:{k1:{name:'小明'},k2:{name:'小華'},k3:{name:'小美'}},
   house:{k1:{at:now}},houseView:{k1:{layout:[],vis:'public',at:now,name:'小明',n:0}},houseDir:{k1:{at:now,n:0}},
   houseRoom:{k1:{'0':seat('k1','小明'),'2':{...seat('k3','小美'),r:'9,4'}}}}};};
const cases=[
 ['客人走路時回報位置＋路線','guest','PATCH','peiwan/houseRoom/k1/2',{i:6,j:6,f:1,at:TS,r:'6,4;9,4;9,8'},true],
 ['客人停下時刪掉路線','guest','PATCH','peiwan/houseRoom/k1/2',{i:9,j:4,f:1,at:TS,r:null},true],
 ['主人在自己家回報路線','me','PATCH','peiwan/houseRoom/k1/0',{i:5.5,j:5.5,f:-1,at:TS,r:'2,5;2,3'},true],
 ['坐下時就帶路線（整筆寫入）','friend','PUT','peiwan/houseRoom/k1/1',{k:'k2',name:'小華',i:8.5,j:10.5,f:1,at:TS,r:'8,10'},true],
 ['最長的路線（80 字）','guest','PATCH','peiwan/houseRoom/k1/2',{r:'1,1;'.repeat(20).slice(0,79)+'1',at:TS},true],
 ['路線超過 80 字','guest','PATCH','peiwan/houseRoom/k1/2',{r:'1,1;'.repeat(21)+'1,1',at:TS},false],
 ['路線夾了文字','guest','PATCH','peiwan/houseRoom/k1/2',{r:'9,4;<b>',at:TS},false],
 ['路線寫成負數','guest','PATCH','peiwan/houseRoom/k1/2',{r:'-1,4',at:TS},false],
 ['路線寫成數字','guest','PATCH','peiwan/houseRoom/k1/2',{r:94,at:TS},false],
 ['路線太短（空字串以外）','guest','PATCH','peiwan/houseRoom/k1/2',{r:'9',at:TS},false],
 ['座位多帶別的欄位（仍然擋）','guest','PATCH','peiwan/houseRoom/k1/2',{r:'9,4',gift:100},false],
 ['替別人的座位寫路線','guest','PATCH','peiwan/houseRoom/k1/0',{r:'1,1'},false],
 ['未登入寫路線',null,'PATCH','peiwan/houseRoom/k1/2',{r:'1,1'},false],
 ['朋友讀得到座位上的路線','friend','GET','peiwan/houseRoom/k1',undefined,true],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p22'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={me:ME,friend:FRIEND,guest:GUEST}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase22 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
