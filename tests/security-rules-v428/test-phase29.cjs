// 11/25 規則測試：orderVoiceV1/orders 加 customerId 索引；客人、冒險者、店長照舊都讀不到語音資料。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},STAFF={uid:'staff_uid_1'},ADMIN={uid:'admin1'};
const data=()=>({secureV1:{members:{[ME.uid]:{active:true,key:'k1'}},owners:{k1:ME.uid}},
  peiwan:{config:{adminUid:'admin1'},links:{staff_uid_1:{type:'char'}}},
  orderVoiceV1:{orders:{b1:{id:'b1',customerId:'100000000000000001',status:'confirmed'},b2:{id:'b2',customerId:'100000000000000002',status:'pending'},b3:{id:'b3',customerId:'100000000000000001',status:'done'}},
   jobs:{b1:{data:{phase:'ready'}}},staffBindings:{c1:{uid:'discord_1'}}}});
const Q='orderVoiceV1/orders?orderBy=%22customerId%22&equalTo=%22100000000000000001%22';
const cases=[
 ['主機依老闆查語音單（只回這位的兩張）','owner','GET',Q,undefined,true,b=>{const v=JSON.parse(b);return Object.keys(v).sort().join()==='b1,b3';}],
 ['客人讀自己的語音單','me','GET',Q,undefined,false],
 ['客人讀整個語音資料','me','GET','orderVoiceV1',undefined,false],
 ['冒險者讀語音單','staff','GET','orderVoiceV1/orders',undefined,false],
 ['店長讀語音單','admin','GET','orderVoiceV1/orders',undefined,false],
 ['沒登入讀語音單','none','GET','orderVoiceV1/orders',undefined,false],
 ['客人寫語音單','me','PUT','orderVoiceV1/orders/b9',{id:'b9',customerId:'100000000000000001'},false],
 ['店長寫冒險者綁定','admin','PUT','orderVoiceV1/staffBindings/c2',{uid:'discord_2'},false],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p29'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,check] of cases){
   await seed(ns,data());
   const w=who==='owner'?'owner':({me:ME,staff:STAFF,admin:ADMIN}[who]||null);
   const r=await req(ns,method,p,body,w);
   const ok=r.ok&&(!check||check(r.body));
   if(label==='新規則'){if(ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((ok?'舊規則允許':'舊規則拒絕')+'｜'+name+(r.ok?'':'（'+r.body.slice(0,60)+'）'));
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase29 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
