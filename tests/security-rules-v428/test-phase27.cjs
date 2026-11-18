// v554 規則測試：續單申請處理完可以再送一張（同一張單續第二次）；處理中不能蓋、客人不能自己帶 done。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const U=n=>({uid:'discord_10000000000000000'+n});
const ME=U(1),OTHER=U(2),STAFF={uid:'staff_uid_1'},ADMIN={uid:'admin1'};
const R={myKey:'k1',staffCid:'c1',planName:'休閒小遊戲',mins:60,price:280,at:1763452345690};
const data=()=>({secureV1:{members:{[ME.uid]:{active:true,key:'k1'},[OTHER.uid]:{active:true,key:'k2'}},owners:{k1:ME.uid,k2:OTHER.uid}},
  peiwan:{config:{adminUid:'admin1'},links:{staff_uid_1:{type:'char'}},
   clientOrders:{o1:{myKey:'k1',staffCid:'c1',status:'confirmed'},o2:{myKey:'k1',staffCid:'c2',status:'confirmed'},o3:{myKey:'k1',staffCid:'c1',status:'confirmed'},o9:{myKey:'k2',staffCid:'c1',status:'confirmed'}},
   renewReq:{o1:{...R,done:1,ok:true,why:'',ver:'25',lock:{by:'c1',at:1}},o3:{...R,lock:{by:'c1',at:1}},o9:{...R,myKey:'k2',done:1,ok:true}}}});
const cases=[
 ['第一次續單（還沒有申請單）','me','PUT','peiwan/renewReq/o2',R,true],
 ['同一張單第二次續單（上一張處理完）','me','PUT','peiwan/renewReq/o1',R,true],
 ['上一張還在處理中不能蓋','me','PUT','peiwan/renewReq/o3',R,false],
 ['客人自己帶 done','me','PUT','peiwan/renewReq/o2',{...R,done:1,ok:true},false],
 ['處理完的單客人自己寫成成功','me','PUT','peiwan/renewReq/o1',{...R,done:2,ok:true},false],
 ['幫別人的單續單','me','PUT','peiwan/renewReq/o9',{...R,myKey:'k2'},false],
 ['用自己的名義續別人的單','me','PUT','peiwan/renewReq/o9',R,false],
 ['客人刪掉處理完的申請單','me','DELETE','peiwan/renewReq/o1',undefined,false],
 ['沒登入續單','none','PUT','peiwan/renewReq/o2',R,false],
 ['冒險者寫處理結果','staff','PATCH','peiwan/renewReq/o3',{done:3,ok:true},true],
 ['店長回絕卡住的申請','admin','PATCH','peiwan/renewReq/o3',{done:3,ok:false},true],
 ['本人查自己的申請單','me','GET','peiwan/renewReq?orderBy=%22myKey%22&equalTo=%22k1%22',undefined,true],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p27'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={me:ME,staff:STAFF,admin:ADMIN}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase27 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
