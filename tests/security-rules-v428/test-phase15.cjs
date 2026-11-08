// v504 規則測試第十五批：家具扭蛋——背包裡有的扭蛋家具可以擺進房間（與拜訪快照），抽卡紀錄只有本人與店員能讀。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'};
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1'},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true}},
 cat:{k1:{balance:3800,lastTx:'g1'}},
 catTx:{k1:{g1:{type:'spend',amount:-1200,ref:'g1',note:'家具扭蛋・人魚卡池十連',ts:1}}},
 houseInv:{k1:{vl_shellbed:{g1_0:{ts:1,src:'gacha'}},vp_mushhouse:{g1_1:{ts:1,src:'gacha'}}},k2:{vl_aquarium:{g9_0:{ts:1,src:'gacha'}}}},
 gachaLog:{k1:{g1:{pool:'sea',n:10,cost:1200,items:['vl_shellbed','vp_mushhouse'],ts:1}}}}});
const lay=(...a)=>({layout:a,at:{'.sv':'timestamp'}});
const view=(...a)=>({layout:a,vis:'public',at:{'.sv':'timestamp'},name:'小明',n:a.length});
// [名稱, 身分, 方法, 路徑, 內容, 預期]
const cases=[
 ['擺設放背包裡有的扭蛋家具（貝殼床）','me','PUT','peiwan/house/k1',lay({t:'vl_shellbed',i:3,j:4,dir:0},{t:'vp_mushhouse',i:8,j:2,dir:1}),true],
 ['扭蛋家具＋上架家具＋入住禮一起擺','me','PUT','peiwan/house/k1',lay({t:'vl_shellbed',i:3,j:4,dir:0},{t:'vf_bed',i:6,j:6,dir:0},{t:'vr_rug',i:5,j:5,dir:0}),true],
 ['擺設放背包裡沒有的扭蛋家具（水族箱）','me','PUT','peiwan/house/k1',lay({t:'vl_aquarium',i:3,j:4,dir:0}),false],
 ['擺設放別人背包才有的家具','me','PUT','peiwan/house/k1',lay({t:'vl_shellbed',i:3,j:4,dir:0},{t:'vl_aquarium',i:5,j:5,dir:0}),false],
 ['擺設放沒上架、背包也沒有的家具','me','PUT','peiwan/house/k1',lay({t:'vf_sofa',i:3,j:4,dir:0}),false],
 ['擺設家具名稱格式不對','me','PUT','peiwan/house/k1',lay({t:'VL/../x',i:3,j:4,dir:0}),false],
 ['扭蛋家具多寫欄位','me','PUT','peiwan/house/k1',lay({t:'vl_shellbed',i:3,j:4,dir:0,r:'limited'}),false],
 ['把扭蛋家具擺進別人的小屋','me','PUT','peiwan/house/k2',lay({t:'vl_shellbed',i:3,j:4,dir:0}),false],
 ['拜訪快照放背包裡有的扭蛋家具','me','PUT','peiwan/houseView/k1',view({t:'vl_shellbed',i:3,j:4,dir:0}),'view'],
 ['拜訪快照放背包裡沒有的家具','me','PUT','peiwan/houseView/k1',view({t:'vl_aquarium',i:3,j:4,dir:0}),false],
 ['自己把扭蛋家具寫進背包（沒有訂單）','me','PUT','peiwan/houseInv/k1/vl_aquarium/x1',{ts:1,src:'gacha'},false],
 ['自己寫抽卡紀錄','me','PUT','peiwan/gachaLog/k1/x2',{pool:'sea',n:10,cost:0,items:['vl_aquarium'],ts:1},false],
 ['讀自己的抽卡紀錄','me','GET','peiwan/gachaLog/k1',undefined,true],
 ['讀別人的抽卡紀錄','other','GET','peiwan/gachaLog/k1',undefined,false],
 ['未登入讀抽卡紀錄','anon','GET','peiwan/gachaLog/k1',undefined,false],
 ['店員讀抽卡紀錄','admin','GET','peiwan/gachaLog/k1',undefined,true],
 ['店員刪掉扭蛋家具（退款）','admin','DELETE','peiwan/houseInv/k1/vl_shellbed/g1_0',undefined,true],
 ['本人刪掉扭蛋家具紀錄','me','DELETE','peiwan/houseInv/k1/vl_shellbed/g1_0',undefined,false],
];
(async()=>{
 let pass=0,fail=0;
 const NEW=JSON.parse(fs.readFileSync(newFile,'utf8')),hasView=!!NEW.rules.peiwan.houseView;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',NEW]];
 for(const [label,rules] of sets){
  const ns='p15'+label.charCodeAt(0);await setRules(ns,rules);
  for(let [name,who,method,p,body,expect] of cases){
   if(expect==='view'){if(!hasView)continue;expect=true;}
   await seed(ns,data());
   const w={me:ME,other:OTHER,admin:ADMIN}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase15 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
