// v434 規則測試：工房部件單買與新闆卡初始部件紀錄。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},ADMIN={uid:'admin1'};
const inc=n=>({'.sv':{increment:n}});
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'}},owners:{k1:'discord_100000000000000001'}},peiwan:{
 config:{adminUid:'admin1',basePricing:{hair:100,face:50,cloth:50,acc:50}},
 lobby:{k1:{name:'舊老闆'}},wallet:{k1:{balance:1000}},owned:{k1:{cloth0:{name:'c0',ts:1}}}}});
const buy=(id,item,amt)=>({['clientOrders/'+id]:{type:'shop',paidBy:'wallet',status:'done',myKey:'k1',couponUsed:false,createdAt:1,itemId:item,amount:amt},['wallet/k1/balance']:inc(-amt),['wallet/k1/lastTx']:id,['walletTx/k1/'+id]:{type:'spend',amount:-amt,ref:id,ts:1},['owned/k1/'+item]:{name:item,ts:1,ref:id}});
const start={back:3,front:3,cloth:3,face:2,brow:1,at:1};
const cases=[
 ['買工房頭髮（100）','me','PATCH','peiwan',buy('b1','base_hair_3',100),true],
 ['工房頭髮只付 50','me','PATCH','peiwan',buy('b2','base_hair_4',50),false],
 ['買工房臉（50）','me','PATCH','peiwan',buy('b3','base_face_2',50),true],
 ['買花箋蝴蝶結（50）','me','PATCH','peiwan',buy('b4','base_acc_4',50),true],
 ['不付錢直接放進背包','me','PUT','peiwan/owned/k1/base_cloth_4',{name:'x',ts:1},false],
 ['店長沒設價格時不能買','me','PATCH','peiwan',{'config/basePricing':null,...buy('b5','base_cloth_3',50)},false],
 ['新闆卡記錄初始部件（未登入、還沒有大廳資料）',null,'PUT','peiwan/owned/newkey/baseStart',start,true],
 ['已有闆卡的人不能補寫初始部件','me','PUT','peiwan/owned/k1/baseStart',start,false],
 ['初始部件紀錄不能改','seedNew','PUT','peiwan/owned/k2/baseStart',{...start,back:4},false],
 ['初始部件欄位不完整',null,'PUT','peiwan/owned/newkey2/baseStart',{back:3},false],
 ['初始部件夾帶其他欄位',null,'PUT','peiwan/owned/newkey3/baseStart',{...start,hair_free:true},false],
 ['店長可修正初始部件','admin','PUT','peiwan/owned/k1/baseStart',start,true],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));const ns='p4'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   const d=data();if(who==='seedNew'){d.peiwan.owned.k2={baseStart:start};}
   await seed(ns,d);
   const w=who==='me'||who==='seedNew'?ME:who==='admin'?ADMIN:null;
   if(name==='店長沒設價格時不能買'){await req(ns,'DELETE','peiwan/config/basePricing',undefined,'owner');}
   const b=name==='店長沒設價格時不能買'?buy('b5','base_cloth_3',50):body;
   const r=await req(ns,method,p,b,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,120));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase4 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
