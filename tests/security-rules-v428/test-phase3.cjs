// Phase 3 rules test: customers act only as their own character.
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,liveFile,newFile]=process.argv;
const A='discord_111111111111111111',B='discord_222222222222222222',C='discord_333333333333333333';
const ALICE={uid:A},BOB={uid:B},CAROL={uid:C},ADMIN={uid:'admin1'},PARTNER={uid:'partnerA'},ANON=null;
const NOW=Date.now();
const inc=n=>({'.sv':{increment:n}});
const data=()=>({
 secureV1:{members:{[A]:{active:true,key:'kA'},[B]:{active:true,key:'kB'},[C]:{active:true,key:'kC'}},owners:{kA:A,kB:B,kC:C}},
 peiwan:{config:{adminUid:'admin1'},links:{partnerA:{type:'char',refId:'cA',code:'X'}},
  shopConfig:{cloth9:{price:300}},
  lobby:{kA:{name:'Alice',pub:{status:'on'}},kB:{name:'Bob'},kC:{name:'Carol'}},cards:{kA:{dcid:'@alice'}},
  wallet:{kA:{balance:1000},kB:{balance:500}},
  chat:{m1:{key:'kA',text:'hi',t:NOW-60000},old:{key:'kA',text:'old',t:NOW-7*3600000}},
  dm:{'kA~kB':{x1:{f:'kA',x:'hey',at:1}},'kB~staff_cA':{x2:{f:'kB',x:'hello',at:1}}},
  dmMeta:{kA:{kB:{unread:0}},kB:{kA:{unread:1}}},
  friends:{kA:{kB:{name:'Bob'}},kB:{kA:{name:'Alice'}}},friendReq:{kA:{kC:{name:'Carol',at:1}}},
  mail:{kA:{m1:{title:'t'}}},orders:{w1:{no:12,staffCid:'cA',secret:'x'}},
  accounts:{'111111111111111111':{myKey:'kA'}},
  clientOrders:{oA:{myKey:'kA',type:'play',paidBy:'wallet',status:'confirmed',amount:300,staffCid:'cA',createdAt:1},oB:{myKey:'kB',type:'play',status:'pending',amount:300,staffCid:'cA',createdAt:1}},
 }});
const buy=(key,id)=>({['clientOrders/'+id]:{type:'shop',itemId:'cloth9',amount:300,paidBy:'wallet',status:'done',myKey:key,couponUsed:false,createdAt:1},['wallet/'+key+'/balance']:inc(-300),['wallet/'+key+'/lastTx']:id,['walletTx/'+key+'/'+id]:{type:'spend',amount:-300,ref:id,ts:1},['owned/'+key+'/cloth9']:{name:'c',ts:1,ref:id}});
const cases=[
 ['陌生人建立新的闆卡','anon','PUT','peiwan/lobby/kNew',{name:'新人'},true],
 ['陌生人覆蓋別人的闆卡（輸入別人的 DC ID）','anon','PUT','peiwan/lobby/kA',{name:'假的'},false],
 ['Bob 改 Alice 的闆卡','bob','PATCH','peiwan/lobby/kA/pub',{status:'off'},false],
 ['Alice 改自己的狀態','alice','PATCH','peiwan/lobby/kA/pub',{status:'off'},true],
 ['陌生人假冒 Alice 移動位置','anon','PUT','peiwan/pos/kA',{x:1,y:1},false],
 ['Alice 更新自己的位置','alice','PUT','peiwan/pos/kA',{x:1,y:1},true],
 ['Alice 用自己的名義聊天','alice','PUT','peiwan/chat/m2',{key:'kA',text:'yo',t:NOW},true],
 ['Bob 冒用 Alice 的名義聊天','bob','PUT','peiwan/chat/m3',{key:'kA',text:'假訊息',t:NOW},false],
 ['陌生人聊天','anon','PUT','peiwan/chat/m4',{key:'kA',text:'x',t:NOW},false],
 ['Bob 刪掉 Alice 剛講的話','bob','DELETE','peiwan/chat/m1',undefined,false],
 ['清掉 6 小時前的舊訊息','bob','DELETE','peiwan/chat/old',undefined,true],
 ['陌生人偷看 Alice 和 Bob 的私訊','anon','GET','peiwan/dm/kA~kB',undefined,false],
 ['Carol 偷看 Alice 和 Bob 的私訊','carol','GET','peiwan/dm/kA~kB',undefined,false],
 ['Bob 看自己的私訊','bob','GET','peiwan/dm/kA~kB',undefined,true],
 ['Alice 傳私訊給 Bob','alice','PUT','peiwan/dm/kA~kB/x3',{f:'kA',x:'hi',at:2},true],
 ['Carol 插進別人的私訊','carol','PUT','peiwan/dm/kA~kB/x4',{f:'kC',x:'hi',at:2},false],
 ['陪玩讀客人私訊自己的對話','partner','GET','peiwan/dm/kB~staff_cA',undefined,true],
 ['陪玩偷看客人之間的私訊','partner','GET','peiwan/dm/kA~kB',undefined,false],
 ['Carol 讀 Alice 的私訊清單','carol','GET','peiwan/dmMeta/kA',undefined,false],
 ['Alice 讀自己的私訊清單','alice','GET','peiwan/dmMeta/kA',undefined,true],
 ['Bob 替 Alice 的未讀數 +1（傳訊時）','bob','PUT','peiwan/dmMeta/kA/kB/unread',1,true],
 ['Bob 讀 Alice 那邊關於自己的未讀數（傳訊 transaction 需要）','bob','GET','peiwan/dmMeta/kA/kB',undefined,true],
 ['Carol 讀 Alice 那邊關於 Bob 的紀錄','carol','GET','peiwan/dmMeta/kA/kB',undefined,false],
 ['陌生人讀 Alice 的好友名單','anon','GET','peiwan/friends/kA',undefined,false],
 ['Alice 讀自己的好友名單','alice','GET','peiwan/friends/kA',undefined,true],
 ['Carol 竄改 Alice 的好友','carol','PUT','peiwan/friends/kA/kC',{name:'Carol'},false],
 ['Alice 接受 Bob 的好友邀請（雙方名單）','alice','PATCH','peiwan',{'friends/kA/kC':{name:'Carol'},'friends/kC/kA':{name:'Alice'}},true],
 ['Bob 解除和 Alice 的好友','bob','DELETE','peiwan/friends/kA/kB',undefined,true],
 ['陌生人讀 Alice 的站內信','anon','GET','peiwan/mail/kA',undefined,false],
 ['Alice 讀自己的站內信','alice','GET','peiwan/mail/kA',undefined,true],
 ['Bob 把 Alice 的信標成已讀','bob','PUT','peiwan/mail/kA/m1/read',1,false],
 ['陌生人用 Discord ID 查角色鑰匙','anon','GET','peiwan/accounts/111111111111111111',undefined,false],
 ['Alice 讀自己的帳號紀錄','alice','GET','peiwan/accounts/111111111111111111',undefined,true],
 ['陌生人看 Alice 的金幣餘額','anon','GET','peiwan/wallet/kA',undefined,false],
 ['Alice 看自己的餘額','alice','GET','peiwan/wallet/kA',undefined,true],
 ['Alice 用自己的金幣買衣服','alice','PATCH','peiwan',buy('kA','p1'),true],
 ['Bob 花 Alice 的金幣','bob','PATCH','peiwan',buy('kA','p2'),false],
 ['陌生人花 Alice 的金幣','anon','PATCH','peiwan',buy('kA','p3'),false],
 ['Alice 建立自己的轉帳訂單','alice','PUT','peiwan/clientOrders/t1',{myKey:'kA',type:'play',status:'pending',amount:300,createdAt:1},true],
 ['Bob 用 Alice 的名義下單','bob','PUT','peiwan/clientOrders/t2',{myKey:'kA',type:'play',status:'pending',amount:300,createdAt:1},false],
 ['Alice 讀自己的訂單','alice','GET','peiwan/clientOrders/oA',undefined,true],
 ['Bob 讀 Alice 的訂單','bob','GET','peiwan/clientOrders/oA',undefined,false],
 ['陌生人讀全部訂單','anon','GET','peiwan/clientOrders',undefined,false],
 ['Alice 查自己的全部訂單','alice','GET','peiwan/clientOrders?orderBy="myKey"&equalTo="kA"',undefined,true],
 ['Bob 查 Alice 的全部訂單','bob','GET','peiwan/clientOrders?orderBy="myKey"&equalTo="kA"',undefined,false],
 ['客人查陪玩檔期（預約用）','bob','GET','peiwan/clientOrders?orderBy="staffCid"&equalTo="cA"',undefined,true],
 ['付款復原查不存在的訂單','alice','GET','peiwan/clientOrders/nope',undefined,true],
 ['Bob 取消 Alice 的訂單','bob','PUT','peiwan/cancelReq/oA',{myKey:'kA',amount:300,at:1},false],
 ['Alice 取消自己的訂單','alice','PUT','peiwan/cancelReq/oA',{myKey:'kA',amount:300,at:1},true],
 ['客人看自己訂單卡上的工單號碼','alice','GET','peiwan/orders/w1/no',undefined,true],
 ['客人讀工單內容','alice','GET','peiwan/orders/w1',undefined,false],
 ['陪玩更新訂單狀態','partner','PUT','peiwan/clientOrders/oB/status','confirmed',true],
 ['店長手動綁定帳號（審核）','admin','PUT','secureV1/owners/kZ','discord_444444444444444444',true],
 ['店長查詢某個 Discord 的綁定','admin','GET','secureV1/members/discord_111111111111111111',undefined,true],
 ['客人查別人的綁定','bob','GET','secureV1/members/discord_111111111111111111',undefined,false],
 ['客人自己改帳號綁定','alice','PUT','secureV1/owners/kB',A,false],
];
const WHO={alice:ALICE,bob:BOB,carol:CAROL,admin:ADMIN,partner:PARTNER,anon:ANON};
async function run(rules){const out=[];for(const [label,who,method,path,body] of cases){await setRules('t3',{rules:{'.read':false,'.write':false}});await seed('t3',data());await setRules('t3',rules);const r=await req('t3',method,path,body,WHO[who]);out.push({allowed:r.ok,detail:r.ok?'':r.body.slice(0,90)});}return out;}
(async()=>{
  const live=await run(JSON.parse(fs.readFileSync(liveFile)));const hard=await run(JSON.parse(fs.readFileSync(newFile)));
  let fails=0;const f=a=>a?'允許':'擋下';console.log('結果 | 情境 | 舊規則 | 新規則');
  cases.forEach((c,i)=>{const ok=hard[i].allowed===c[5];if(!ok)fails++;console.log(`${ok?'PASS':'FAIL'} | ${c[0]} | ${f(live[i].allowed)} | ${f(hard[i].allowed)}${ok?'':'  <-- expected '+f(c[5])+' '+hard[i].detail}`)});
  console.log(`\n${cases.length-fails}/${cases.length} passed`);process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
