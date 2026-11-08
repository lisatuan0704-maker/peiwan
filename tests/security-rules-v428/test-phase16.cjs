// v505 規則測試第十六批：空的小屋存得起來、拜訪快照可以是空房間、房間裡坐座椅的位置封包（st／sa）送得出去。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001',claims:{socialSession:'s1'}},OTHER={uid:'discord_100000000000000002',claims:{socialSession:'s2'}};
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},
 socialV1:{control:{current:{discord_100000000000000001:'r1'},rooms:{r1:{kind:'public',members:{discord_100000000000000001:{session:'s1',leaseUntil:9e12}}}}}},
 peiwan:{config:{adminUid:'admin1'},lobby:{k1:{name:'小明'},k2:{name:'小華'}},
  shopConfig:{'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true}}}});
const TS={'.sv':'timestamp'};
const pos=extra=>({x:800,y:600,f:0,s:0,w:0,m:'hall',v:1,at:TS,...extra});
// [名稱, 身分, 方法, 路徑, 內容, 預期]
const cases=[
 ['家具全部收回背包（只有存檔時間）','me','PUT','peiwan/house/k1',{at:TS},true],
 ['空小屋＋開放設定','me','PUT','peiwan/house/k1',{at:TS,vis:'friends'},true],
 ['新小屋只寫開放設定（沒有時間也沒有擺設）','me','PUT','peiwan/house/k1',{vis:'public'},false],
 ['照舊：有擺設的小屋','me','PUT','peiwan/house/k1',{layout:[{t:'vr_bed',i:0,j:0,dir:0}],at:TS},true],
 ['把別人的小屋清空','me','PUT','peiwan/house/k2',{at:TS},false],
 ['拜訪快照是空房間','me','PUT','peiwan/houseView/k1',{vis:'public',at:TS,name:'小明',n:0},true],
 ['拜訪快照少了開放設定','me','PUT','peiwan/houseView/k1',{at:TS,name:'小明',n:0},false],
 ['拜訪快照少了時間','me','PUT','peiwan/houseView/k1',{vis:'public',name:'小明',n:0},false],
 ['替別人寫空的拜訪快照','me','PUT','peiwan/houseView/k2',{vis:'public',at:TS,name:'小華',n:0},false],
 ['房間裡坐上自己的座椅（seat3）','me','PUT','socialV1/live/r1/positions/discord_100000000000000001',pos({st:'seat3',sa:1794000000000}),true],
 ['房間裡坐不存在的座椅','me','PUT','socialV1/live/r1/positions/discord_100000000000000001',pos({st:'seat9',sa:1}),false],
 ['座椅時間是 0','me','PUT','socialV1/live/r1/positions/discord_100000000000000001',pos({st:'seat4',sa:0}),false],
 ['照舊：沒坐座椅的位置','me','PUT','socialV1/live/r1/positions/discord_100000000000000001',pos({}),true],
 ['照舊：寫別人的位置','other','PUT','socialV1/live/r1/positions/discord_100000000000000001',pos({}),false],
];
(async()=>{
 let pass=0,fail=0;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',JSON.parse(fs.readFileSync(newFile,'utf8'))]];
 for(const [label,rules] of sets){
  const ns='p16'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={me:ME,other:OTHER}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase16 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
