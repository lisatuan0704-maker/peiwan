// v513 規則測試：VIP 升級動圖（請畫圖單＋本人交 GIF）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'},STAFF={uid:'staff1'},STRANGER={uid:'email_stranger'};
const GIF='data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const data=setup=>({
 secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},
 peiwan:{config:{adminUid:'admin1'},links:{staff1:{type:'char',refId:'c1'}},lobby:{k1:{name:'魚油'},k2:{name:'小華'}},
  vipCardReq:setup==='none'?{}:{k1:{lv:1,no:1,at:1}},
  vipCard:setup==='done'?{k1:{'1':GIF}}:{}},
});
const cases=[
 ['本人交這一級的動圖','me','PUT','peiwan/vipCard/k1/1',GIF,true],
 ['本人交別的等級（沒有請畫）','me','PUT','peiwan/vipCard/k1/3',GIF,false],
 ['沒有請畫圖單就交','me','PUT','peiwan/vipCard/k1/1',GIF,false,'none'],
 ['已經交過，再交一次覆蓋','me','PUT','peiwan/vipCard/k1/1',GIF,false,'done'],
 ['本人刪掉已交的動圖','me','DELETE','peiwan/vipCard/k1/1',undefined,false,'done'],
 ['交的不是 GIF（PNG）','me','PUT','peiwan/vipCard/k1/1','data:image/png;base64,iVBORw0KGgo=',false],
 ['交的不是圖片（網址）','me','PUT','peiwan/vipCard/k1/1','https://evil.example/x.gif',false],
 ['交太大的檔案（超過 2.4MB）','me','PUT','peiwan/vipCard/k1/1','data:image/gif;base64,'+'A'.repeat(2400001),false],
 ['幫別人的闆卡交','other','PUT','peiwan/vipCard/k1/1',GIF,false],
 ['未登入交',null,'PUT','peiwan/vipCard/k1/1',GIF,false],
 ['自己註冊的 Email 帳號交','stranger','PUT','peiwan/vipCard/k1/1',GIF,false],
 ['本人自己寫請畫圖單','me','PUT','peiwan/vipCardReq/k1',{lv:5,no:9,at:1},false,'none'],
 ['本人改請畫圖單的等級','me','PUT','peiwan/vipCardReq/k1/lv',5,false],
 ['本人讀自己的請畫圖單','me','GET','peiwan/vipCardReq/k1',undefined,true],
 ['讀別人的請畫圖單','other','GET','peiwan/vipCardReq/k1',undefined,false],
 ['本人讀自己交的動圖','me','GET','peiwan/vipCard/k1',undefined,true,'done'],
 ['讀別人交的動圖','other','GET','peiwan/vipCard/k1',undefined,false,'done'],
 ['店長讀全部請畫圖單','admin','GET','peiwan/vipCardReq',undefined,true],
 ['店長寫請畫圖單','admin','PUT','peiwan/vipCardReq/k2',{lv:2,no:3,at:1},true],
 ['店長寫請畫圖單（等級 7）','admin','PUT','peiwan/vipCardReq/k2',{lv:7,no:3,at:1},false],
 ['店長刪掉動圖','admin','DELETE','peiwan/vipCard/k1/1',undefined,true,'done'],
 ['冒險者讀動圖','staff','GET','peiwan/vipCard',undefined,true,'done'],
 ['冒險者寫請畫圖單','staff','PUT','peiwan/vipCardReq/k2',{lv:2,no:3,at:1},false],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p21'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,setup] of cases){
   await seed(ns,data(setup));
   const w={me:ME,other:OTHER,admin:ADMIN,staff:STAFF,stranger:STRANGER}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase21 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
