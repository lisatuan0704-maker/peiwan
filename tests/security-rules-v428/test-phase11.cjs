// v494 規則測試：小屋家具（houseInv、house）與日常系列（daily_*，用既有的背包一般商品分支＋第十批 cur:'cat'）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'};
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true},'house:vf_chair':{name:'粉墊木椅',price:15,cur:'cat',type:'小屋家具',active:true},
  daily_hair_A:{name:'蓬鬆長髮',price:30,cur:'cat',custom:true,active:true,type:'時裝'},daily_top_B:{name:'水手領上衣',price:15,custom:true,active:true,type:'時裝'}},
 cat:{k1:{balance:5000,lastTx:'c0'},k2:{balance:5000,lastTx:'c9'}},
 catTx:{k1:{c0:{type:'daily',amount:5000,ref:'c0'}},k2:{c9:{type:'daily',amount:5000,ref:'c9'}}},
 houseInv:{k1:{vf_chair:{old1:{ts:1}}},k2:{vf_bed:{old2:{ts:1}}}},
 house:{k2:{layout:[{t:'vf_bed',i:1,j:1,dir:0}],at:1}}}});
const inc=n=>({'.sv':{increment:n}});
// 用貓貓幣買家具 k（金幣等值價 amt，實扣 amt×10），同一次寫入放進 houseInv
const buyHouse=(id,k,amt,o={})=>{const who=o.who||'k1',item=o.item||'house:'+k;return {
 ['clientOrders/'+id]:{myKey:who,paidBy:o.paidBy||'cat',type:'shop',status:'done',plan:item,itemId:item,amount:amt,catAmount:amt*10,createdAt:1,name:'小明',couponUsed:false},
 ...(o.paidBy==='wallet'?{['wallet/k1/balance']:inc(-amt),['wallet/k1/lastTx']:id,['walletTx/k1/'+id]:{type:'spend',amount:-amt,ref:id,ts:1}}
   :{['catTx/'+who+'/'+id]:{type:'spend',amount:-amt*10,ref:id,ts:1},['cat/'+who+'/balance']:inc(-amt*10),['cat/'+who+'/lastTx']:id}),
 ...(o.noInv?{}:{['houseInv/'+(o.invKey||who)+'/'+(o.invItem||k)+'/'+id]:{ts:1,...(o.extra||{})}})};};
const buyDaily=(id,item,amt,o={})=>({
 ['clientOrders/'+id]:{myKey:'k1',paidBy:'cat',type:'shop',status:'done',plan:item,itemId:item,amount:amt,catAmount:amt*10,createdAt:1,name:'小明',couponUsed:false},
 ['catTx/k1/'+id]:{type:'spend',amount:-amt*10,ref:id,ts:1},['cat/k1/balance']:inc(-amt*10),['cat/k1/lastTx']:id,
 ['owned/k1/'+item]:{name:item,ts:1,ref:id}});
const lay=(...a)=>({layout:a,at:{'.sv':'timestamp'}});
// [名稱, 身分, 方法, 路徑, 內容, 預期]
const cases=[
 ['貓貓幣買家具（訂單＋扣款＋放進家具背包）','me','PATCH','peiwan',buyHouse('o1','vf_bed',40),true],
 ['同一件家具再買一件','me','PATCH','peiwan',buyHouse('o2','vf_chair',15),true],
 ['只寫家具背包、沒有訂單','me','PUT','peiwan/houseInv/k1/vf_bed/x1',{ts:1},false],
 ['訂單是別件家具','me','PATCH','peiwan',buyHouse('o3','vf_bed',40,{invItem:'vf_chair'}),false],
 ['少付（39 → 390）','me','PATCH','peiwan',buyHouse('o4','vf_bed',39),false],
 ['用金幣訂單換家具','me','PATCH','peiwan',buyHouse('o5','vf_bed',40,{paidBy:'wallet'}),false],
 ['沒上架的家具','me','PATCH','peiwan',buyHouse('o6','vf_sofa',40),false],
 ['放進別人的家具背包','me','PATCH','peiwan',buyHouse('o7','vf_bed',40,{invKey:'k2'}),false],
 ['家具背包多寫欄位','me','PATCH','peiwan',buyHouse('o8','vf_bed',40,{extra:{n:99}}),false],
 ['用舊訂單編號再放一件','me','PUT','peiwan/houseInv/k1/vf_chair/old1',{ts:2},false],
 ['本人刪掉家具紀錄','me','DELETE','peiwan/houseInv/k1/vf_chair/old1',undefined,false],
 ['讀自己的家具背包','me','GET','peiwan/houseInv/k1',undefined,true],
 ['讀別人的家具背包','me','GET','peiwan/houseInv/k2',undefined,false],
 ['店員退款刪掉家具紀錄','admin','DELETE','peiwan/houseInv/k1/vf_chair/old1',undefined,true],
 ['存擺設（上架家具＋入住禮）','me','PUT','peiwan/house/k1',lay({t:'vf_bed',i:3,j:4,dir:1},{t:'vr_rug',i:5,j:5,dir:0},{t:'vr_window',wall:'R',c:6,dir:1,z:0.5}),true],
 ['擺設放沒上架的家具','me','PUT','peiwan/house/k1',lay({t:'vf_sofa',i:3,j:4,dir:0}),false],
 ['擺設多寫欄位','me','PUT','peiwan/house/k1',lay({t:'vf_bed',i:3,j:4,dir:0,price:0}),false],
 ['擺設數字超出範圍','me','PUT','peiwan/house/k1',lay({t:'vf_bed',i:3,j:400,dir:0}),false],
 ['擺設寫進別人的小屋','me','PUT','peiwan/house/k2',lay({t:'vf_bed',i:3,j:4,dir:0}),false],
 ['讀別人的擺設','me','GET','peiwan/house/k2',undefined,false],
 ['未登入讀擺設','anon','GET','peiwan/house/k2',undefined,false],
 ['店員讀擺設','admin','GET','peiwan/house/k2',undefined,true],
 ['日常系列：貓貓幣買蓬鬆長髮（300）','me','PATCH','peiwan',buyDaily('d1','daily_hair_A',30),true],
 ['日常系列：少付（29 → 290）','me','PATCH','peiwan',buyDaily('d2','daily_hair_A',29),false],
 ['日常系列：沒標貓貓幣的那件','me','PATCH','peiwan',buyDaily('d3','daily_top_B',15),false],
];
(async()=>{
 let pass=0,fail=0;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',JSON.parse(fs.readFileSync(newFile,'utf8'))]];
 for(const [label,rules] of sets){
  const ns='p11'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={me:ME,other:OTHER,admin:ADMIN}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase11 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
