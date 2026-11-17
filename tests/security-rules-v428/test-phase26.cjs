// v552 規則測試：位置按地圖分開 pos/<地圖>/<key>、在線節點 online/<key>、舊路徑 pos/<key> 照舊。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const U=n=>({uid:'discord_10000000000000000'+n});
const ME=U(1),OTHER=U(2),STRANGER={uid:'random_uid_9'},STAFF={uid:'staff_uid_1'},ADMIN={uid:'admin1'};
const TS={'.sv':'timestamp'};
const P={x:.5123,y:.7123,w:1,ts:1763452345690,r:[700,420],sp:165,sb:165};
const data=()=>({secureV1:{members:{[ME.uid]:{active:true,key:'k1'},[OTHER.uid]:{active:true,key:'k2'}},owners:{k1:ME.uid,k2:OTHER.uid}},
  peiwan:{config:{adminUid:'admin1'},links:{staff_uid_1:{type:'char'}},lobby:{k1:{name:'小明'},k2:{name:'小華'}},
   pos:{k2:{x:.4,y:.6,m:'hall',v:1,t:1},hall:{k2:{x:.4,y:.6}}},online:{k2:{m:'hall',at:1}}}});
const cases=[
 ['本人寫大廳位置','me','PUT','peiwan/pos/hall/k1',P,true],
 ['本人寫森林位置','me','PUT','peiwan/pos/forest/k1',P,true],
 ['本人刪自己的大廳位置','me','DELETE','peiwan/pos/hall/k1',undefined,true],
 ['舊路徑照舊可以寫','me','PUT','peiwan/pos/k1',{x:.5,y:.5,m:'hall',v:1,t:1},true],
 ['幫別人寫位置','me','PUT','peiwan/pos/hall/k2',P,false],
 ['刪別人的位置','me','DELETE','peiwan/pos/hall/k2',undefined,false],
 ['不在白名單的地圖','me','PUT','peiwan/pos/plaza/k1',P,false],
 ['整張地圖蓋掉','me','PUT','peiwan/pos/hall',{k1:P},false],
 ['位置沒有 x','me','PUT','peiwan/pos/hall/k1',{y:.5,w:1},false],
 ['x 寫成文字','me','PUT','peiwan/pos/hall/k1',{x:'中間',y:.5},false],
 ['沒登入寫位置','none','PUT','peiwan/pos/hall/k1',P,false],
 ['陌生帳號寫位置','stranger','PUT','peiwan/pos/hall/k1',P,false],
 ['後台可以清別人的位置','admin','DELETE','peiwan/pos/hall/k2',undefined,true],
 ['會員讀這張地圖','me','GET','peiwan/pos/hall',undefined,true],
 ['沒登入讀這張地圖','none','GET','peiwan/pos/hall',undefined,false],
 ['會員用 v 查舊路徑','me','GET','peiwan/pos?orderBy=%22v%22&equalTo=1',undefined,true],
 ['本人寫在線','me','PUT','peiwan/online/k1',{m:'house',at:TS},true],
 ['在線：在大廳','me','PUT','peiwan/online/k1',{m:'hall',at:TS},true],
 ['在線：本人刪掉','me','DELETE','peiwan/online/k1',undefined,true],
 ['在線：幫別人寫','me','PUT','peiwan/online/k2',{m:'hall',at:TS},false],
 ['在線：時間自己填','me','PUT','peiwan/online/k1',{m:'hall',at:1},false],
 ['在線：地圖亂填','me','PUT','peiwan/online/k1',{m:'plaza',at:TS},false],
 ['在線：多塞欄位','me','PUT','peiwan/online/k1',{m:'hall',at:TS,x:1},false],
 ['在線：少了地圖','me','PUT','peiwan/online/k1',{at:TS},false],
 ['會員讀在線名單','me','GET','peiwan/online',undefined,true],
 ['沒登入讀在線名單','none','GET','peiwan/online',undefined,false],
 ['冒險者讀在線名單','staff','GET','peiwan/online',undefined,true],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p26'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={me:ME,stranger:STRANGER,staff:STAFF,admin:ADMIN}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase26 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
