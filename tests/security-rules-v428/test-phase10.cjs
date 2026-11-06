// v493 規則測試：付費商品一律金幣，貓貓幣只能付 shopConfig 標 cur:'cat' 的商品；染髮券只收金幣。
// 「11/07 以後」的案例用把切換時間改到過去的同一份規則來測。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const CUT='1793980800000';
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'};
const NOW=Date.now(),TODAY=Math.floor((NOW+28800000)/86400000);
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1',basePricing:{hair:100,face:50,cloth:50,acc:50},partPricing:{hair:100,face:100,cloth:100,acc:30}},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{cloth9:{price:300,active:true},pet_sweet:{price:399,active:true,type:'寵物'},seat3:{price:399,active:true},furn1:{price:50,active:true,cur:'cat'}},
 chat:{m1:{key:'k1',name:'小明',text:'嗨',t:NOW,map:'hall'}},
 wallet:{k1:{balance:1000,lastTx:'x0'}},
 walletTx:{k1:{x0:{type:'topup',amount:1000,ref:'x0'}}},
 cat:{k1:{balance:50000,lastTx:'c0'}},
 catTx:{k1:{c0:{type:'daily',amount:50000,ref:'c0'}}}}});
const inc=n=>({'.sv':{increment:n}});
const TS={'.sv':'timestamp'};
// 用貓貓幣買 item（金幣等值價 amt，實扣 amt×10），同一次寫入放進背包
const catBuy=(id,item,amt,o={})=>({
 ['clientOrders/'+id]:{myKey:'k1',paidBy:'cat',type:'shop',status:'done',plan:item,itemId:item,amount:amt,catAmount:o.catAmount??amt*10,createdAt:1,name:'小明'},
 ['catTx/k1/'+id]:{type:'spend',amount:-(o.catAmount??amt*10),ref:id,ts:1},
 ['cat/k1/balance']:inc(-(o.catAmount??amt*10)),['cat/k1/lastTx']:id,
 ...(o.noOwned?{}:item==='dyeTicket'?{['owned/k1/dyeTickets']:inc(1)}:{['owned/k1/'+item]:{name:item,ts:1,ref:id}})});
const walletBuy=(id,item,amt)=>({
 ['clientOrders/'+id]:{myKey:'k1',paidBy:'wallet',type:'shop',status:'done',plan:item,itemId:item,amount:amt,createdAt:1,name:'小明',couponUsed:false},
 ['wallet/k1/balance']:inc(-amt),['wallet/k1/lastTx']:id,['walletTx/k1/'+id]:{type:'spend',amount:-amt,ref:id,ts:1},
 ...(item==='dyeTicket'?{['owned/k1/dyeTickets']:inc(1)}:{['owned/k1/'+item]:{name:item,ts:1,ref:id}})});
const dailyCat=tx=>({['dailyTask/k1']:{day:TODAY,tx,chat:'m1',at:TS,amount:100},['catTx/k1/'+tx]:{type:'daily',amount:100,ref:tx,ts:TS},['cat/k1/balance']:inc(100),['cat/k1/lastTx']:tx});
// [名稱, 身分, 方法, 路徑, 內容, 預期, 時間（now／after）]
const cases=[
 ['貓貓幣買時裝（沒標貓貓幣）','me','PATCH','peiwan',catBuy('o1','cloth9',300),false],
 ['貓貓幣買寵物','me','PATCH','peiwan',catBuy('o2','pet_sweet',399),false],
 ['貓貓幣買座椅','me','PATCH','peiwan',catBuy('o3','seat3',399),false],
 ['貓貓幣買染髮券','me','PATCH','peiwan',catBuy('o4','dyeTicket',299),false],
 ['貓貓幣買工房部件','me','PATCH','peiwan',catBuy('o5','base_hair_3',100),false],
 ['貓貓幣買時裝部件','me','PATCH','peiwan',catBuy('o6','cloth9::hair',100),false],
 ['只寫貓貓幣訂單、不放背包（沒標貓貓幣）','me','PATCH','peiwan',catBuy('o7','cloth9',300,{noOwned:true}),false],
 ['客人自己把時裝標成貓貓幣','me','PUT','peiwan/shopConfig/cloth9/cur','cat',false],
 ['同一次寫入先標貓貓幣再買','me','PATCH','peiwan',{...catBuy('o8','cloth9',300),['shopConfig/cloth9/cur']:'cat'},false],
 ['貓貓幣買標了貓貓幣的商品（家具樣品 50 → 500）','me','PATCH','peiwan',catBuy('o9','furn1',50),true],
 ['標了貓貓幣的商品少付（49 → 490）','me','PATCH','peiwan',catBuy('o10','furn1',49),false],
 ['標了貓貓幣的商品 catAmount 不是 10 倍','me','PATCH','peiwan',catBuy('o11','furn1',50,{catAmount:50}),false],
 ['金幣買時裝照常','me','PATCH','peiwan',walletBuy('w1','cloth9',300),true],
 ['金幣買寵物照常','me','PATCH','peiwan',walletBuy('w2','pet_sweet',399),true],
 ['金幣買染髮券照常','me','PATCH','peiwan',walletBuy('w3','dyeTicket',299),true],
 ['金幣買工房部件照常','me','PATCH','peiwan',walletBuy('w4','base_hair_3',100),true],
 ['店長可以把商品標成貓貓幣','admin','PUT','peiwan/shopConfig/cloth9/cur','cat',true],
 ['店長手動調整貓貓幣','admin','PATCH','peiwan',{['cat/k1/balance']:9000,['catTx/k1/a1']:{type:'adjust',amount:-41000,ref:'a1',note:'退回兌換'}},true],
 ['11/07 起：每日任務 +100 貓貓幣照常','me','PATCH','peiwan',dailyCat('d1'),true,'after'],
];
(async()=>{
 let pass=0,fail=0;
 const newRules=JSON.parse(fs.readFileSync(newFile,'utf8'));
 const afterRules=JSON.parse(JSON.stringify(newRules).split(CUT).join('1700000000000'));
 if(!JSON.stringify(newRules).includes(CUT))throw Error('切換時間不在規則裡');
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8')),'now'],['新規則',newRules,'now'],['新規則',afterRules,'after']];
 for(const [label,rules,mode] of sets){
  const ns='p10'+label.charCodeAt(0)+mode;await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,when='now'] of cases){
   if(when!==mode)continue;
   await seed(ns,data());
   const w={me:ME,other:OTHER,admin:ADMIN}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase10 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
