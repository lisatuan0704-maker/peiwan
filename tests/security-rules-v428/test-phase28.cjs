// 規則測試第二十八批：家具券——houseTix／houseTixTx 本人與店員可讀、誰都不能寫（只有主機寫）；
// 擺設（與拜訪快照）接受背包裡有的異色家具 <原key>~n；背包 key 格式接受 ~n（店員補發用，客人自己照舊寫不進來）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'};
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true}},
 houseInv:{k1:{vl_shellbed:{g1_0:{ts:1,src:'gacha'}},vs_luohan:{g2_0:{ts:2,src:'gacha'},t1:{ts:3,src:'tix'}},'vs_luohan~2':{t2:{ts:4,src:'tix'}}},k2:{vs_luohan:{g9_0:{ts:1,src:'gacha'}}}},
 houseTix:{k1:{balance:12,lastTx:'t2'},k2:{balance:3,lastTx:'g9_1'}},
 houseTixTx:{k1:{g2_1:{type:'dup',amount:3,ref:'g2',k:'vs_luohan',note:'扭蛋重複・蝠翼羅漢床',ts:2},t2:{type:'buy',amount:-15,ref:'t2',k:'vs_luohan~2',note:'家具券兌換・蝠翼羅漢床・翡翠',ts:4}}}}});
const lay=(...a)=>({layout:a,at:{'.sv':'timestamp'}});
const view=(...a)=>({layout:a,vis:'public',at:{'.sv':'timestamp'},name:'小明',n:a.length});
// [名稱, 身分, 方法, 路徑, 內容, 預期]
const cases=[
 ['讀自己的家具券餘額','me','GET','peiwan/houseTix/k1',undefined,true],
 ['讀自己的家具券紀錄','me','GET','peiwan/houseTixTx/k1',undefined,true],
 ['讀別人的家具券餘額','other','GET','peiwan/houseTix/k1',undefined,false],
 ['讀別人的家具券紀錄','other','GET','peiwan/houseTixTx/k1',undefined,false],
 ['未登入讀家具券餘額','anon','GET','peiwan/houseTix/k1/balance',undefined,false],
 ['讀整個 houseTix','me','GET','peiwan/houseTix',undefined,false],
 ['店員讀家具券餘額與紀錄','admin','GET','peiwan/houseTix/k1',undefined,true],
 ['店員讀家具券紀錄','admin','GET','peiwan/houseTixTx/k1',undefined,true],
 ['自己把家具券改成 999','me','PUT','peiwan/houseTix/k1/balance',999,false],
 ['自己加一筆家具券紀錄','me','PUT','peiwan/houseTixTx/k1/x1',{type:'dup',amount:10,ref:'x1',k:'vs_luohan',note:'假的',ts:5},false],
 ['自己刪掉家具券紀錄','me','DELETE','peiwan/houseTixTx/k1/t2',undefined,false],
 ['自己第一次建立家具券（沒有紀錄的人）','other','PUT','peiwan/houseTix/k2',{balance:50},false],
 ['店員改家具券（只有主機能寫）','admin','PUT','peiwan/houseTix/k1/balance',20,false],
 ['擺設放背包裡有的異色（vs_luohan~2）','me','PUT','peiwan/house/k1',lay({t:'vs_luohan~2',i:3,j:4,dir:0}),true],
 ['擺設原色＋異色＋扭蛋家具＋入住禮一起擺','me','PUT','peiwan/house/k1',lay({t:'vs_luohan',i:3,j:4,dir:0},{t:'vs_luohan~2',i:6,j:4,dir:1},{t:'vl_shellbed',i:8,j:8,dir:0},{t:'vr_rug',i:5,j:5,dir:0}),true],
 ['擺設放背包沒有的異色（vs_luohan~3）','me','PUT','peiwan/house/k1',lay({t:'vs_luohan~3',i:3,j:4,dir:0}),false],
 ['擺設放別人背包才有的異色','other','PUT','peiwan/house/k2',lay({t:'vs_luohan~2',i:3,j:4,dir:0}),false],
 ['擺設異色編號 0','me','PUT','peiwan/house/k1',lay({t:'vs_luohan~0',i:3,j:4,dir:0}),false],
 ['擺設異色編號兩位數','me','PUT','peiwan/house/k1',lay({t:'vs_luohan~12',i:3,j:4,dir:0}),false],
 ['擺設 key 只有 ~ 沒有編號','me','PUT','peiwan/house/k1',lay({t:'vs_luohan~',i:3,j:4,dir:0}),false],
 ['擺設 key 兩個 ~','me','PUT','peiwan/house/k1',lay({t:'vs~luohan~2',i:3,j:4,dir:0}),false],
 ['入住禮加 ~1（背包沒有）','me','PUT','peiwan/house/k1',lay({t:'vr_rug~1',i:3,j:4,dir:0}),false],
 ['原本的擺設照舊（扭蛋家具＋上架家具）','me','PUT','peiwan/house/k1',lay({t:'vl_shellbed',i:3,j:4,dir:0},{t:'vf_bed',i:6,j:6,dir:0}),true],
 ['拜訪快照放背包裡有的異色','me','PUT','peiwan/houseView/k1',view({t:'vs_luohan~2',i:3,j:4,dir:0}),'view'],
 ['拜訪快照放背包沒有的異色','me','PUT','peiwan/houseView/k1',view({t:'vs_luohan~1',i:3,j:4,dir:0}),false],
 ['自己把異色寫進背包（沒有訂單）','me','PUT','peiwan/houseInv/k1/vs_luohan~1/x1',{ts:1,src:'tix'},false],
 ['自己把原色寫進背包（沒有訂單）','me','PUT','peiwan/houseInv/k1/vs_luohan/x1',{ts:1},false],
 ['店員補發異色進背包','admin','PUT','peiwan/houseInv/k1/vs_luohan~1/fix1',{ts:1},true],
 ['店員寫格式不對的背包 key','admin','PUT','peiwan/houseInv/k1/vs_luohan~x/fix1',{ts:1},false],
 ['店員刪掉異色（退款）','admin','DELETE','peiwan/houseInv/k1/vs_luohan~2/t2',undefined,true],
 ['本人刪掉異色紀錄','me','DELETE','peiwan/houseInv/k1/vs_luohan~2/t2',undefined,false],
];
(async()=>{
 let pass=0,fail=0;
 const NEW=JSON.parse(fs.readFileSync(newFile,'utf8')),hasView=!!NEW.rules.peiwan.houseView;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',NEW]];
 for(const [label,rules] of sets){
  const ns='p28'+label.charCodeAt(0);await setRules(ns,rules);
  for(let [name,who,method,p,body,expect] of cases){
   if(expect==='view'){if(!hasView)continue;expect=true;}
   await seed(ns,data());
   const w={me:ME,other:OTHER,admin:ADMIN}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase28 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
