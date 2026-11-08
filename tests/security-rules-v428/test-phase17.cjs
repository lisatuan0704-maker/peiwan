// v507 規則測試第十七批：小屋擴建（house/<key>/size 要付對應的貓貓幣訂單、一次一級）與拜訪快照的房間大小。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'};
const data=(o={})=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{'house:size18':{name:'小屋擴建・18×18',price:300,cur:'cat',type:'小屋擴建',active:true},'house:size22':{name:'小屋擴建・22×22',price:600,cur:'cat',type:'小屋擴建',active:true},
  'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true}},
 cat:{k1:{balance:20000,lastTx:'c0'},k2:{balance:20000,lastTx:'c9'}},
 catTx:{k1:{c0:{type:'daily',amount:20000,ref:'c0'}},k2:{c9:{type:'daily',amount:20000,ref:'c9'}}},
 clientOrders:{old18:{myKey:'k1',paidBy:'cat',type:'shop',status:'done',plan:'house:size18',itemId:'house:size18',amount:300,catAmount:3000,createdAt:1,name:'小明',couponUsed:false}},
 house:{k1:{layout:[{t:'vf_bed',i:1,j:1,dir:0}],at:1,...(o.k1||{})},k2:{at:1}}}});
const inc=n=>({'.sv':{increment:n}});
const TS={'.sv':'timestamp'};
// 用貓貓幣擴建到 size（訂單金幣等值價 amt，實扣 amt×10），同一次寫入把小屋大小改大
const expand=(id,size,amt,o={})=>{const who=o.who||'k1',item=o.item||'house:size'+size;return {
 ['clientOrders/'+id]:{myKey:who,paidBy:'cat',type:'shop',status:'done',plan:item,itemId:item,amount:amt,catAmount:amt*10,createdAt:1,name:'小明',couponUsed:false},
 ['catTx/'+who+'/'+id]:{type:'spend',amount:-amt*10,ref:id,ts:1},['cat/'+who+'/balance']:inc(-amt*10),['cat/'+who+'/lastTx']:id,
 ...(o.noSize?{}:{['house/'+(o.houseKey||who)+'/size']:size,['house/'+(o.houseKey||who)+'/sizeRef']:o.ref||id,['house/'+(o.houseKey||who)+'/at']:TS})};};
const view=size=>({vis:'public',at:TS,name:'小明',n:1,layout:[{t:'vf_bed',i:1,j:1,dir:0}],size});
// [名稱, 身分, 方法, 路徑, 內容, 預期, 起始資料]
const cases=[
 ['14 → 18：付 3,000 貓貓幣擴建','me','PATCH','peiwan',expand('o1',18,300),true],
 ['18 → 22：付 6,000 貓貓幣擴建','me','PATCH','peiwan',expand('o2',22,600),true,{k1:{size:18}}],
 ['跳級 14 → 22','me','PATCH','peiwan',expand('o3',22,600),false],
 ['少付（299 → 2,990）','me','PATCH','peiwan',expand('o4',18,299),false],
 ['用 18 的訂單擴到 22','me','PATCH','peiwan',expand('o5',22,300,{item:'house:size18'}),false,{k1:{size:18}}],
 ['沒有訂單只改大小','me','PATCH','peiwan',{'house/k1/size':18,'house/k1/sizeRef':'zz1','house/k1/at':TS},false],
 ['沿用舊的擴建訂單','me','PATCH','peiwan',{'house/k1/size':18,'house/k1/sizeRef':'old18','house/k1/at':TS},false],
 ['沒有 sizeRef','me','PATCH','peiwan',{...expand('o6',18,300,{noSize:true}),'house/k1/size':18,'house/k1/at':TS},false],
 ['替別人擴建（訂單寫別人的）','me','PATCH','peiwan',expand('o7',18,300,{who:'k2'}),false],
 ['自己付錢、擴別人的小屋','me','PATCH','peiwan',expand('o8',18,300,{houseKey:'k2'}),false],
 ['縮小 22 → 18','me','PUT','peiwan/house/k1/size',18,false,{k1:{size:22}}],
 ['照舊：存擺設（大小不變）','me','PUT','peiwan/house/k1',{layout:[{t:'vf_bed',i:17,j:20,dir:0}],at:TS,size:22,sizeRef:'old18'},true,{k1:{size:22,sizeRef:'old18'}}],
 ['大小寫成 20','me','PUT','peiwan/house/k1/size',20,false],
 ['店員把小屋改回 14','admin','PUT','peiwan/house/k1/size',14,true,{k1:{size:22}}],
 ['拜訪快照寫 18（小屋是 18）','me','PUT','peiwan/houseView/k1',view(18),true,{k1:{size:18}}],
 ['拜訪快照寫 22（小屋只有 18）','me','PUT','peiwan/houseView/k1',view(22),false,{k1:{size:18}}],
 ['拜訪快照寫 18（還沒擴建）','me','PUT','peiwan/houseView/k1',view(18),false],
 ['拜訪快照寫 14','me','PUT','peiwan/houseView/k1',view(14),true],
 ['照舊：買家具不受影響','me','PATCH','peiwan',{
   'clientOrders/f1':{myKey:'k1',paidBy:'cat',type:'shop',status:'done',plan:'house:vf_bed',itemId:'house:vf_bed',amount:40,catAmount:400,createdAt:1,name:'小明',couponUsed:false},
   'catTx/k1/f1':{type:'spend',amount:-400,ref:'f1',ts:1},'cat/k1/balance':inc(-400),'cat/k1/lastTx':'f1','houseInv/k1/vf_bed/f1':{ts:1}},true],
];
(async()=>{
 let pass=0,fail=0;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',JSON.parse(fs.readFileSync(newFile,'utf8'))]];
 for(const [label,rules] of sets){
  const ns='p17'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,start] of cases){
   await seed(ns,data(start||{}));
   const w={me:ME,other:OTHER,admin:ADMIN}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase17 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
