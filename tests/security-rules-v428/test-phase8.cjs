// v491 規則測試：VIP 回饋金幣（VIP 1～5 各一次 150／500／800／1200／1500），以及優惠券停用。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'},STRANGER={uid:'email_stranger'};
const GIFT={1:150,2:500,3:800,4:1200,5:1500};
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1',services:{s1:{price:300}}},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 vipServer:{k1:{lv:3,at:1},k2:{lv:1,at:1}},
 shopConfig:{cloth9:{price:300,active:true}},
 wallet:{k2:{balance:1000,lastTx:'old'}},walletTx:{k2:{old:{type:'spend',amount:-1,ref:'old'}}}}});
const inc=n=>({'.sv':{increment:n}});
const TS={'.sv':'timestamp'};
const claim=(k,lv,tx,o={})=>{const a=o.amount??GIFT[lv];return {
 ['vipGift/'+k+'/'+lv]:{tx:o.giftTx??tx,at:TS,amount:o.giftAmount??a},
 ['walletTx/'+k+'/'+tx]:{type:o.type??'vipgift',lv:String(o.txLv??lv),amount:a,ref:tx,note:'VIP 回饋',ts:TS},
 ['wallet/'+k+'/balance']:o.balance??inc(o.add??a),
 ['wallet/'+k+'/lastTx']:tx};};
const drop=(o,key)=>{const c={...o};delete c[key];return c;};
const pay=(id,o)=>({['clientOrders/'+id]:{myKey:'k1',paidBy:'wallet',status:o.type==='shop'?'done':'confirmed',createdAt:1,name:'小明',couponUsed:false,...o},['wallet/k1/balance']:inc(-o.amount),['wallet/k1/lastTx']:id,['walletTx/k1/'+id]:{type:'spend',amount:-o.amount,ref:id,ts:1}});
const buyItem=(id,amt,cp)=>({...pay(id,{type:'shop',plan:'cloth9',itemId:'cloth9',amount:amt,couponUsed:!!cp}),['owned/k1/cloth9']:{name:'cloth9',ts:1,ref:id}});
const rich=d=>{d.peiwan.wallet.k1={balance:5000,lastTx:'x0'};d.peiwan.walletTx.k1={x0:{type:'topup',amount:5000,ref:'x0'}};};
const cases=[
 ['VIP 3 領 VIP 1（還沒有錢包）','me','PATCH','peiwan',claim('k1',1,'g1'),true],
 ['VIP 3 領 VIP 3（800）','me','PATCH','peiwan',claim('k1',3,'g2'),true],
 ['VIP 1 領 VIP 1（已有錢包 1000）','other','PATCH','peiwan',claim('k2',1,'g3'),true],
 ['VIP 3 想領 VIP 4','me','PATCH','peiwan',claim('k1',4,'g4'),false],
 ['VIP 1 想領 VIP 2','other','PATCH','peiwan',claim('k2',2,'g5'),false],
 ['同一個等級領第二次','me','PATCH','peiwan',claim('k1',1,'g6'),false,'got1'],
 ['領過 VIP 1 再領 VIP 2','me','PATCH','peiwan',claim('k1',2,'g7'),true,'got1'],
 ['VIP 1 寫成 1500','me','PATCH','peiwan',claim('k1',1,'g8',{amount:1500}),false],
 ['交易 150 但錢包加 1500','me','PATCH','peiwan',claim('k1',1,'g9',{add:1500}),false],
 ['錢包直接寫成 99999','me','PATCH','peiwan',claim('k1',1,'g10',{balance:99999}),false],
 ['交易寫 VIP 3、紀錄寫 VIP 1','me','PATCH','peiwan',claim('k1',1,'g11',{txLv:3,amount:150}),false],
 ['交易類型寫成 topup','me','PATCH','peiwan',claim('k1',1,'g12',{type:'topup'}),false],
 ['紀錄指向別筆交易','me','PATCH','peiwan',claim('k1',1,'g13',{giftTx:'other'}),false],
 ['只加錢、不寫紀錄','me','PATCH','peiwan',drop(claim('k1',1,'g14'),'vipGift/k1/1'),false],
 ['只寫紀錄、不加錢','me','PATCH','peiwan',drop(drop(claim('k1',1,'g15'),'wallet/k1/balance'),'walletTx/k1/g15'),false],
 ['幫別人領','me','PATCH','peiwan',claim('k2',1,'g16'),false],
 ['未登入領',null,'PATCH','peiwan',claim('k1',1,'g17'),false],
 ['自己註冊的 Email 帳號領','stranger','PATCH','peiwan',claim('k1',1,'g18'),false],
 ['沒有店長確認的等級（vipServer 不存在）','me','PATCH','peiwan',claim('k1',1,'g19'),false,'nolv'],
 ['客人自己把 vipServer 改成 5','me','PUT','peiwan/vipServer/k1/lv',5,false],
 ['本人讀自己的紀錄','me','GET','peiwan/vipGift/k1',undefined,true,'got1'],
 ['讀別人的紀錄','me','GET','peiwan/vipGift/k2',undefined,false,'got1'],
 ['店長讀全部紀錄','admin','GET','peiwan/vipGift',undefined,true,'got1'],
 ['刪掉自己的紀錄想再領','me','DELETE','peiwan/vipGift/k1/1',undefined,false,'got1'],
 ['店長手動調整金幣仍可用','admin','PUT','peiwan/wallet/k1/balance',500,true],
 ['優惠券停用：VIP 3 陪玩單少付 80','me','PATCH','peiwan',pay('w1',{type:'play',plan:'svc_s1',amount:220,couponUsed:true}),false,'rich'],
 ['陪玩單照原價付仍可用','me','PATCH','peiwan',pay('w2',{type:'play',plan:'svc_s1',amount:300}),true,'rich'],
 ['優惠券停用：VIP 3 買時裝少付 80','me','PATCH','peiwan',buyItem('i1',220,true),false,'rich'],
 ['時裝照原價買仍可用','me','PATCH','peiwan',buyItem('i2',300,false),true,'rich'],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p8'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,setup] of cases){
   const d=data();
   if(setup==='got1'){d.peiwan.vipGift={k1:{1:{tx:'g0',at:1,amount:150}},k2:{1:{tx:'gx',at:1,amount:150}}};d.peiwan.wallet.k1={balance:150,lastTx:'g0'};d.peiwan.walletTx.k1={g0:{type:'vipgift',lv:'1',amount:150,ref:'g0'}};}
   if(setup==='nolv')delete d.peiwan.vipServer.k1;
   if(setup==='rich')rich(d);
   await seed(ns,d);
   const w={me:ME,other:OTHER,admin:ADMIN,stranger:STRANGER}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase8 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
