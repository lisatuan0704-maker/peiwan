// v510 規則測試第二十批：金幣換貓貓幣改成 1 金幣＝5 貓貓幣（剛好 350 加送 150、剛好 1000 加送 500）；舊匯率的寫入一律拒絕；商品用貓貓幣付款照舊 ×10。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'};
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'}},owners:{k1:'discord_100000000000000001'}},peiwan:{
 config:{adminUid:'admin1'},lobby:{k1:{name:'小明'}},
 shopConfig:{'house:vf_bed':{name:'貓咪單人床',price:40,cur:'cat',type:'小屋家具',active:true}},
 wallet:{k1:{balance:5000,lastTx:'w0'}},walletTx:{k1:{w0:{type:'topup',amount:5000,ref:'w0'}}},
 cat:{k1:{balance:1000,lastTx:'c0'}},catTx:{k1:{c0:{type:'daily',amount:1000,ref:'c0'}}}}});
const inc=n=>({'.sv':{increment:n}});
const ex=(tx,coin,amt)=>({['walletTx/k1/'+tx]:{type:'exchange',amount:-coin,ref:tx,ts:1},['wallet/k1/balance']:inc(-coin),['wallet/k1/lastTx']:tx,
 ['catTx/k1/'+tx]:{type:'exchange',coin,amount:amt,ref:tx,ts:1},['cat/k1/balance']:inc(amt),['cat/k1/lastTx']:tx});
// [名稱, 內容, 預期]
const cases=[
 ['100 金幣換 500','e1',100,500,true],
 ['1 金幣換 5','e2',1,5,true],
 ['351 金幣換 1755（沒有加送）','e3',351,1755,true],
 ['350 金幣換 1750＋加送 150＝1900','e4',350,1900,true],
 ['1000 金幣換 5000＋加送 500＝5500','e5',1000,5500,true],
 ['舊匯率：100 金幣換 1000','e6',100,1000,false],
 ['舊匯率：350 金幣換 3700','e7',350,3700,false],
 ['舊匯率：1000 金幣換 11000','e8',1000,11000,false],
 ['350 沒算加送（1750）','e9',350,1750,false],
 ['1000 沒算加送（5000）','e10',1000,5000,false],
 ['351 硬寫加送（1905）','e11',351,1905,false],
 ['多寫 5（100 換 505）','e12',100,505,false],
].map(([n,tx,coin,amt,exp])=>[n,'PATCH','peiwan',ex(tx,coin,amt),exp]);
cases.push(['照舊：用貓貓幣買家具（40 金幣等值＝400 貓貓幣）','PATCH','peiwan',{
 'clientOrders/f1':{myKey:'k1',paidBy:'cat',type:'shop',status:'done',plan:'house:vf_bed',itemId:'house:vf_bed',amount:40,catAmount:400,createdAt:1,name:'小明',couponUsed:false},
 'catTx/k1/f1':{type:'spend',amount:-400,ref:'f1',ts:1},'cat/k1/balance':inc(-400),'cat/k1/lastTx':'f1','houseInv/k1/vf_bed/f1':{ts:1}},true]);
(async()=>{
 let pass=0,fail=0;
 const sets=[['舊規則',JSON.parse(fs.readFileSync(oldFile,'utf8'))],['新規則',JSON.parse(fs.readFileSync(newFile,'utf8'))]];
 for(const [label,rules] of sets){
  const ns='p20'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,method,p,body,expect] of cases){
   await seed(ns,data());
   const r=await req(ns,method,p,body,ME);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase20 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
