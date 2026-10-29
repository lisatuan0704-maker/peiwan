// Phase 2 rules test: purchases and coins. Simulates the real client writes (multi-path update + server increment).
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,liveFile,newFile]=process.argv;
const OWNERMODE=process.env.OWNER==='1';const ADMIN={uid:'admin1'},ANON=OWNERMODE?{uid:'discord_100000000000000001'}:null,DISCORD={uid:'discord_123456789012345678'};
const inc=n=>({'.sv':{increment:n}});
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'}},owners:{k1:'discord_100000000000000001'}},peiwan:{
  config:{adminUid:'admin1',partPricing:{hair:100,face:100,cloth:100,acc:30}},
  links:{partnerA:{type:'char',refId:'cA',code:'OLD1'}},
  shopConfig:{cloth9:{price:300},season_x:{price:350,partPrices:{cloth:80}}},
  wallet:{k1:{balance:1000},k2:{balance:500}},vipServer:{k1:{lv:5,at:1}},  // v466: 優惠券改依店長確認的 VIP 等級
  walletTx:{k1:{old1:{type:'spend',amount:-10,ref:'old1',ts:1}}},
  clientOrders:{old1:{type:'shop',itemId:'x',amount:10,paidBy:'wallet',status:'done',myKey:'k1'}},
  owned:{k1:{cloth0:{name:'c0',ts:1},dyeTickets:1},k2:{cloth0:{name:'c0',ts:1}}},
}});
const order=(id,o)=>({['clientOrders/'+id]:{type:'shop',paidBy:'wallet',status:'done',myKey:'k1',couponUsed:false,createdAt:1,...o}});
const spend=(id,amt,key='k1')=>({['wallet/'+key+'/balance']:inc(-amt),['wallet/'+key+'/lastTx']:id,['walletTx/'+key+'/'+id]:{type:'spend',amount:-amt,ref:id,ts:1}});
const grant=(item,id,key='k1')=>({['owned/'+key+'/'+item]:{name:item,ts:1,ref:id}});
const buy=(id,item,amt,extra={})=>({...order(id,{itemId:item,amount:amt,...extra}),...spend(id,amt),...grant(item,id)});

const cases=[
 ['正常用金幣買衣服（300）','anon','PATCH','peiwan',buy('o1','cloth9',300),true],
 ['不付錢直接把衣服放進背包','anon','PUT','peiwan/owned/k1/cloth9',{name:'x',ts:1},false],
 ['只付 10 金幣買 300 的衣服','anon','PATCH','peiwan',buy('o2','cloth9',10),false],
 ['VIP 5（店長確認）優惠券折 200（付 100）','anon','PATCH','peiwan',buy('o3','cloth9',100,{couponUsed:true}),true],
 ['假優惠券折超過 200（付 99）','anon','PATCH','peiwan',buy('o4','cloth9',99,{couponUsed:true}),false],
 ['憑空把金幣變多','anon','PUT','peiwan/wallet/k1/balance',99999,false],
 ['扣金幣但沒有交易紀錄','anon','PATCH','peiwan',{'wallet/k1/balance':inc(-5)},false],
 ['交易紀錄 -300 但只扣 10','anon','PATCH','peiwan',{...order('o5',{itemId:'cloth9',amount:300}),'wallet/k1/balance':inc(-10),'wallet/k1/lastTx':'o5','walletTx/k1/o5':{type:'spend',amount:-300,ref:'o5',ts:1},...grant('cloth9','o5')},false],
 ['偽造一筆交易紀錄','anon','PUT','peiwan/walletTx/k1/fake',{type:'spend',amount:-1,ref:'fake',ts:1},false],
 ['刪除別人的交易紀錄','anon','DELETE','peiwan/walletTx/k1/old1',undefined,false],
 ['重複使用舊交易編號','anon','PATCH','peiwan',{...order('o6',{itemId:'cloth9',amount:300}),'wallet/k1/balance':inc(-300),'wallet/k1/lastTx':'old1','walletTx/k1/old1':{type:'spend',amount:-300,ref:'old1',ts:1}},false],
 ['金幣訂單卻沒扣款（假裝已付）','anon','PUT','peiwan/clientOrders/o7',{type:'play',paidBy:'wallet',status:'confirmed',amount:600,myKey:'k1'},false],
 ['轉帳訂單（待店長確認）','anon','PUT','peiwan/clientOrders/o8',{type:'play',paidBy:'transfer',status:'pending',amount:600,myKey:'k1'},true],
 ['轉帳訂單直接標成已確認','anon','PUT','peiwan/clientOrders/o9',{type:'play',paidBy:'transfer',status:'confirmed',amount:600,myKey:'k1'},false],
 ['儲值訂單（待店長確認）','anon','PUT','peiwan/clientOrders/o10',{type:'topup',status:'pending',amount:1000,myKey:'k1'},true],
 ['買聊天氣泡 50 金幣','anon','PATCH','peiwan',buy('o11','bubble_rose',50),true],
 ['買聊天氣泡只付 49','anon','PATCH','peiwan',buy('o12','bubble_rose',49),false],
 ['單買部件（套組自訂價 80）','anon','PATCH','peiwan',buy('o13','season_x::cloth',80),true],
 ['單買部件付太少（79）','anon','PATCH','peiwan',buy('o14','season_x::cloth',79),false],
 ['單買配件（全站價 30）','anon','PATCH','peiwan',buy('o15','season_x::acc2',30),true],
 ['單買配件付太少（29）','anon','PATCH','peiwan',buy('o16','season_x::acc2',29),false],
 ['商城沒有標價的商品','anon','PATCH','peiwan',buy('o17','secret_item',1),false],
 ['買染髮券（預設 299）','anon','PATCH','peiwan',{...order('o18',{itemId:'dyeTicket',amount:299}),...spend('o18',299),'owned/k1/dyeTickets':inc(1)},true],
 ['染髮券只付 1 金幣','anon','PATCH','peiwan',{...order('o19',{itemId:'dyeTicket',amount:1}),...spend('o19',1),'owned/k1/dyeTickets':inc(1)},false],
 ['用 1 張染髮券保存染髮','anon','PATCH','peiwan/owned/k1',{dyeTickets:0,dyeLast:'r1','dyedHairSets/r1':{front:'a',back:'b',at:1}},true],
 ['不保存染髮就把券扣掉/改掉','anon','PATCH','peiwan/owned/k1',{dyeTickets:0},false],
 ['沒用券就新增染髮組合','anon','PATCH','peiwan/owned/k1',{dyeLast:'r2','dyedHairSets/r2':{front:'a',back:'b',at:1}},false],
 ['憑空增加染髮券','anon','PUT','peiwan/owned/k1/dyeTickets',5,false],
 ['群組陪玩單（2 人共 600）','anon','PATCH','peiwan',{'clientOrders/g1a':{type:'play',paidBy:'wallet',status:'confirmed',amount:300,myKey:'k1',groupId:'g1'},'clientOrders/g1b':{type:'play',paidBy:'wallet',status:'confirmed',amount:300,myKey:'k1',groupId:'g1'},...spend('g1',600)},true],
 ['群組單金額比扣款多','anon','PATCH','peiwan',{'clientOrders/g2a':{type:'play',paidBy:'wallet',status:'confirmed',amount:900,myKey:'k1',groupId:'g2'},...spend('g2',100)},false],
 ['清空別人的背包','anon','PUT','peiwan/owned/k2',{},false],
 ['刪除別人背包的一件衣服','anon','DELETE','peiwan/owned/k2/cloth0',undefined,false],
 ['Discord 客人自己發商品','discord','PUT','peiwan/owned/k1/cloth9',{name:'x',ts:1},false],
 ['店長手動發商品','admin','PUT','peiwan/owned/k1/cloth9',{name:'x',ts:1},true],
 ['店長儲值金幣','admin','PUT','peiwan/wallet/k1/balance',5000,true],
 ['店長確認訂單','admin','PUT','peiwan/clientOrders/old1/status','cancelled',true],
];
const WHO={admin:ADMIN,anon:ANON,discord:DISCORD};
async function run(rules){const out=[];for(const [label,who,method,path,body] of cases){await setRules('t2',{rules:{'.read':false,'.write':false}});await seed('t2',data());await setRules('t2',rules);const r=await req('t2',method,path,body,WHO[who]);out.push({allowed:r.ok,detail:r.ok?'':r.body.slice(0,90)});}return out;}
(async()=>{
  const live=await run(JSON.parse(fs.readFileSync(liveFile)));const hard=await run(JSON.parse(fs.readFileSync(newFile)));
  let fails=0;const f=a=>a?'允許':'擋下';console.log('結果 | 情境 | 舊規則 | 新規則');
  cases.forEach((c,i)=>{const ok=hard[i].allowed===c[5];if(!ok)fails++;console.log(`${ok?'PASS':'FAIL'} | ${c[0]} | ${f(live[i].allowed)} | ${f(hard[i].allowed)}${ok?'':'  <-- expected '+f(c[5])+' '+hard[i].detail}`)});
  console.log(`\n${cases.length-fails}/${cases.length} passed`);process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
