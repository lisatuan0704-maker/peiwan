// v508 規則測試第十八批：封鎖後對方不能用舊邀請變回好友；擺設只認售價大於 0 的上架家具（扭蛋家具要自己抽到）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const A={uid:'discord_100000000000000001'},B={uid:'discord_100000000000000002'};
const data=(o={})=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 friendReq:{k2:{k1:{name:'小明',at:1}}},   // 小明（k1）邀請過小華（k2），小華還沒回
 ...(o.block?{blocks:{k1:{k2:{name:'小華',at:2}}}}:{}),
 shopConfig:{'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true},'house:vl_shellbed':{name:'貝殼床',price:0,cur:'cat',type:'小屋家具',active:true}},
 houseInv:{k2:{vl_shellbed:{g1:{ts:1,src:'gacha'}}}}}});
const TS={'.sv':'timestamp'};
const lay=t=>({layout:[{t,i:2,j:2,dir:0}],at:TS});
const view=t=>({layout:[{t,i:2,j:2,dir:0}],vis:'public',at:TS,name:'小明',n:1});
// [名稱, 身分, 方法, 路徑, 內容, 預期, 起始資料]
const cases=[
 ['照舊：小華接受邀請，把自己加進小明的好友','b','PUT','peiwan/friends/k1/k2',{name:'小華',at:3},true],
 ['小明封鎖小華後，小華用舊邀請把自己加回去','b','PUT','peiwan/friends/k1/k2',{name:'小華',at:3},false,{block:true}],
 ['照舊：封鎖後小華可以把小明從自己的好友刪掉','b','DELETE','peiwan/friends/k2/k1',undefined,true,{block:true}],
 ['照舊：小明自己加好友那一筆','a','PUT','peiwan/friends/k1/k2',{name:'小華',at:3},true,{block:true}],
 ['照舊：擺上架家具（售價 40）','a','PUT','peiwan/house/k1',lay('vf_bed'),true],
 ['擺沒抽到的扭蛋家具（shopConfig 誤上架 0 元）','a','PUT','peiwan/house/k1',lay('vl_shellbed'),false],
 ['照舊：擺自己抽到的扭蛋家具','b','PUT','peiwan/house/k2',lay('vl_shellbed'),true],
 ['照舊：入住禮','a','PUT','peiwan/house/k1',lay('vr_bed'),true],
 ['拜訪快照放沒抽到的扭蛋家具','a','PUT','peiwan/houseView/k1',view('vl_shellbed'),false],
 ['照舊：拜訪快照放上架家具','a','PUT','peiwan/houseView/k1',view('vf_bed'),true],
];
(async()=>{
 let pass=0,fail=0;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',JSON.parse(fs.readFileSync(newFile,'utf8'))]];
 for(const [label,rules] of sets){
  const ns='p18'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,start] of cases){
   await seed(ns,data(start||{}));
   const r=await req(ns,method,p,body,{a:A,b:B}[who]||null);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase18 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
