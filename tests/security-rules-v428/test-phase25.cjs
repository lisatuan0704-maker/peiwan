// v539 規則測試：小屋光效的位置 x、y（房間的百分比，選填、兩個一起）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const U=n=>({uid:'discord_10000000000000000'+n});
const ME=U(1),FRIEND=U(2),GUEST=U(3),STAFF={uid:'staff_uid_1'};
const TS={'.sv':'timestamp'};
const E=(o)=>({a:100,s:100,n:100,r:100,o:0,...o});
// k1＝主人（公開小屋）、k2＝小華（k1 的好友）、k3＝小美（陌生老闆）；k4＝只限好友的小屋、k5＝不公開
const data=()=>{const now=Date.now();
 return {secureV1:{members:{[ME.uid]:{active:true,key:'k1'},[FRIEND.uid]:{active:true,key:'k2'},[GUEST.uid]:{active:true,key:'k3'}},
  owners:{k1:ME.uid,k2:FRIEND.uid,k3:GUEST.uid}},
  peiwan:{config:{adminUid:'admin1'},links:{staff_uid_1:{type:'char'}},lobby:{k1:{name:'小明'},k2:{name:'小華'},k3:{name:'小美'}},
   friends:{k1:{k2:true},k4:{k2:true},k5:{k2:true},k2:{k1:true}},
   houseView:{k1:{layout:[],vis:'public',at:now},k4:{layout:[],vis:'friends',at:now},k5:{layout:[],vis:'private',at:now}},
   houseFx:{k1:{at:now,e:{mermaid1:E({})}},k4:{at:now,e:{forest2:E({})}},k5:{at:now,e:{forest1:E({})}}}}};};
const cases=[
 ['主人擺光的位置','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:30,y:70})}},true],
 ['位置在角落 0、100','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:0,y:100})}},true],
 ['沒有位置照舊可以存','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({})}},true],
 ['兩個光效各自的位置','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:20,y:30}),forest2:E({x:80,y:60,o:1})}},true],
 ['只改位置','me','PATCH','peiwan/houseFx/k1/e/mermaid1',{x:40,y:40},true],
 ['只有 x 沒有 y','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:30})}},false],
 ['位置 101','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:101,y:50})}},false],
 ['位置負數','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:-1,y:50})}},false],
 ['位置帶小數','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:30.5,y:50})}},false],
 ['位置寫成文字','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:'中間',y:50})}},false],
 ['別人幫主人改位置','guest','PATCH','peiwan/houseFx/k1/e/mermaid1',{x:10,y:10},false],
 ['光效裡多塞欄位照樣拒絕','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({x:30,y:30,z:1})}},false],
 ['陌生老闆讀公開小屋（含位置）','guest','GET','peiwan/houseFx/k1',undefined,true],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p25'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={me:ME,friend:FRIEND,guest:GUEST,staff:STAFF}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase25 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
