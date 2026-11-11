// 11/11 規則測試：面試控制台請 TT 私訊面試者（peiwan/interviewDm），只有店長能讀寫。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ADMIN={uid:'admin1'},CUSTOMER={uid:'discord_100000000000000001'},STAFF={uid:'staffuid1'};
const TS={'.sv':'timestamp'};
const data=()=>({secureV1:{members:{[CUSTOMER.uid]:{active:true,key:'k1'}},owners:{k1:CUSTOMER.uid}},
  peiwan:{config:{adminUid:'admin1'},links:{staffuid1:{type:'char',refId:'c1',code:'X1'}},lobby:{k1:{name:'小明'}},
   interviewDm:{old1:{to:'123456789012345678',kind:'order',room:'abcd1234',at:1700000000000,result:{state:'sent',at:1700000000000}}}}});
const R=(extra)=>Object.assign({to:'123456789012345678',kind:'order',room:'abc23def45gh',who:'花熙',plan:'Valorant・1 小時',amount:350,mins:60,name:'旅行的貓頭鷹',book:false,reserveAt:0,game:'',at:TS},extra||{});
const cases=[
 ['店長發一筆私訊請求','admin','PUT','peiwan/interviewDm/r1',R(),true],
 ['店長發續單請求','admin','PUT','peiwan/interviewDm/r2',R({kind:'renew'}),true],
 ['店長讀全部請求與結果','admin','GET','peiwan/interviewDm',undefined,true],
 ['店長刪掉舊請求','admin','DELETE','peiwan/interviewDm/old1',undefined,true],
 ['客人（Discord 登入）發請求','customer','PUT','peiwan/interviewDm/r3',R(),false],
 ['冒險者帳號發請求','staff','PUT','peiwan/interviewDm/r4',R(),false],
 ['未登入發請求',null,'PUT','peiwan/interviewDm/r5',R(),false],
 ['客人讀請求（看得到別人的 Discord ID）','customer','GET','peiwan/interviewDm',undefined,false],
 ['冒險者讀請求','staff','GET','peiwan/interviewDm/old1',undefined,false],
 ['店長請求的 Discord ID 不是數字','admin','PUT','peiwan/interviewDm/r6',R({to:'@everyone'}),false],
 ['店長請求的房間代碼怪怪的','admin','PUT','peiwan/interviewDm/r7',R({room:'../../x'}),false],
 ['店長補寫舊時間（不是伺服器現在）','admin','PUT','peiwan/interviewDm/r8',R({at:1700000000000}),false],
 ['店長請求少了 kind','admin','PUT','peiwan/interviewDm/r9',(()=>{const x=R();delete x.kind;return x;})(),false],
 ['客人刪掉請求','customer','DELETE','peiwan/interviewDm/old1',undefined,false],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p23'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect] of cases){
   await seed(ns,data());
   const w={admin:ADMIN,customer:CUSTOMER,staff:STAFF}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase23 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
