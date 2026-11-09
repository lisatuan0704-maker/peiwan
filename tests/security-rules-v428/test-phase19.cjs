// v510 規則測試第十九批：小屋壁紙／地板（paint）只能貼自己買過的系列、格子編號要合法；拜訪快照同樣檢查主人的背包。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const A={uid:'discord_100000000000000001'},B={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'};
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true},'house:wall_forest':{name:'森林精靈小屋・壁紙',price:50,cur:'cat',type:'小屋壁紙',active:true},'house:floor_forest':{name:'森林精靈小屋・地板',price:50,cur:'cat',type:'小屋地板',active:true}},
 houseInv:{k1:{wall_forest:{o1:{ts:1}},floor_forest:{o2:{ts:1}}}},
 house:{k1:{layout:[{t:'vf_bed',i:1,j:1,dir:0}],at:1}}}});
const TS={'.sv':'timestamp'};
const lay=[{t:'vf_bed',i:1,j:1,dir:0}];
const house=paint=>({layout:lay,at:TS,...(paint?{paint}:{})});
const view=paint=>({layout:lay,vis:'public',at:TS,name:'小明',n:1,...(paint?{paint}:{})});
// [名稱, 身分, 方法, 路徑, 內容, 預期]
const cases=[
 ['照舊：存擺設（沒有 paint）','a','PUT','peiwan/house/k1',house(),true],
 ['貼自己買過的森林地板、壁紙','a','PUT','peiwan/house/k1',house({f:{'3_4':'forest','0_0':'forest'},w:{'L0':'forest','R13':'forest'}}),true],
 ['用 update 只改 paint','a','PATCH','peiwan/house/k1',{paint:{f:{'5_5':'forest'}},at:TS},true],
 ['刪掉 paint（整間還原）','a','PATCH','peiwan/house/k1',{paint:null,at:TS},true],
 ['貼沒買的人魚地板','a','PUT','peiwan/house/k1',house({f:{'3_4':'mermaid'}}),false],
 ['貼沒買的人魚壁紙','a','PUT','peiwan/house/k1',house({w:{'L2':'mermaid'}}),false],
 ['貼買過的森林壁紙到另一面牆','a','PUT','peiwan/house/k1',house({w:{'L2':'forest'}}),true],
 ['格子編號亂寫','a','PUT','peiwan/house/k1',house({f:{'abc':'forest'}}),false],
 ['牆段編號亂寫','a','PUT','peiwan/house/k1',house({w:{'X2':'forest'}}),false],
 ['系列名帶路徑','a','PUT','peiwan/house/k1',house({f:{'1_1':'forest/o1'}}),false],
 ['paint 多塞欄位','a','PUT','peiwan/house/k1',house({f:{'1_1':'forest'},x:{a:1}}),false],
 ['小華貼小明的小屋','b','PUT','peiwan/house/k1',house({f:{'1_1':'forest'}}),false],
 ['小華自己沒買卻貼森林','b','PUT','peiwan/house/k2',{layout:lay,at:TS,paint:{f:{'1_1':'forest'}}},false],
 ['拜訪快照帶著買過的 paint','a','PUT','peiwan/houseView/k1',view({f:{'1_1':'forest'},w:{'R0':'forest'}}),true],
 ['拜訪快照帶沒買的 paint','a','PUT','peiwan/houseView/k1',view({f:{'1_1':'mermaid'}}),false],
 ['店員改小屋 paint（照樣只能是主人買過的）','admin','PUT','peiwan/house/k1/paint',{f:{'2_2':'forest'}},true],
];
(async()=>{
 let pass=0,fail=0;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',JSON.parse(fs.readFileSync(newFile,'utf8'))]];
 for(const [label,rules] of sets){
  const ns='p19'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const r=await req(ns,method,p,body,{a:A,b:B,admin:ADMIN}[who]||null);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase19 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
