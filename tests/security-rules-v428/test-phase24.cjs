// v526 規則測試：小屋光效 houseFx（主人開了哪些系列光效、各自的亮度／速度／數量／範圍；來玩的人照小屋開放設定讀得到）。
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
 ['主人開兩個光效（混搭）','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({a:80}),forest2:E({s:150,n:40,r:120,o:1})}},true],
 ['主人開深海天光、關掉周圍變暗','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({d:false})}},true],
 ['主人全部關掉（e 拿掉）','me','PUT','peiwan/houseFx/k1',{at:TS},true],
 ['主人只改一個光效的亮度','me','PATCH','peiwan/houseFx/k1/e/mermaid1',{a:140},true],
 ['主人刪掉整筆','me','DELETE','peiwan/houseFx/k1',undefined,true],
 ['亮度最低 30、最高 150','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({a:30}),forest1:E({a:150})}},true],
 ['亮度 151','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({a:151})}},false],
 ['速度 0','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({s:0})}},false],
 ['範圍帶小數','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({r:100.5})}},false],
 ['數量寫成文字','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({n:'很多'})}},false],
 ['少了速度','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:{a:100,n:100,r:100,o:0}}},false],
 ['不存在的系列','me','PUT','peiwan/houseFx/k1',{at:TS,e:{rainbow1:E({})}},false],
 ['不存在的階段 3','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid3:E({})}},false],
 ['光效裡多塞欄位','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({img:'x'})}},false],
 ['整筆多塞欄位','me','PUT','peiwan/houseFx/k1',{at:TS,e:{},gift:1},false],
 ['沒有 at','me','PUT','peiwan/houseFx/k1',{e:{mermaid1:E({})}},false],
 ['at 寫到明天','me','PUT','peiwan/houseFx/k1',{at:Date.now()+86400000,e:{mermaid1:E({})}},false],
 ['周圍變暗寫成文字','me','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid2:E({d:'off'})}},false],
 ['幫別人開光效','guest','PUT','peiwan/houseFx/k1',{at:TS,e:{mermaid1:E({})}},false],
 ['好友幫主人改亮度','friend','PATCH','peiwan/houseFx/k1/e/mermaid1',{a:30},false],
 ['未登入寫',null,'PUT','peiwan/houseFx/k1',{at:TS},false],
 ['店員可以改','staff','PUT','peiwan/houseFx/k1',{at:TS},true],
 ['主人讀自己的','me','GET','peiwan/houseFx/k1',undefined,true],
 ['陌生老闆讀公開小屋的光效','guest','GET','peiwan/houseFx/k1',undefined,true],
 ['好友讀只限好友小屋的光效','friend','GET','peiwan/houseFx/k4',undefined,true],
 ['陌生老闆讀只限好友小屋的光效','guest','GET','peiwan/houseFx/k4',undefined,false],
 ['好友讀不公開小屋的光效','friend','GET','peiwan/houseFx/k5',undefined,false],
 ['未登入讀公開小屋的光效',null,'GET','peiwan/houseFx/k1',undefined,false],
 ['整包讀全部人的光效','guest','GET','peiwan/houseFx',undefined,false],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p24'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={me:ME,friend:FRIEND,guest:GUEST,staff:STAFF}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase24 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
