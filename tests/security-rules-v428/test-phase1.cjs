// Phase 1 rules test: run against LIVE rules and the hardened rules, print a before/after table.
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,liveFile,newFile]=process.argv;

const ADMIN={uid:'admin1'},PARTNER={uid:'partnerA'},KEFU={uid:'kefuB'},DISCORD={uid:'discord_123456789012345678'},RANDO={uid:'rando'},NEWBIE={uid:'newbie'},NEWBIE2={uid:'newbie2'},ANON=null;
const data=()=>({peiwan:{
  config:{adminUid:'admin1'},
  links:{partnerA:{type:'char',refId:'cA',code:'OLD1'},kefuB:{type:'staff',refId:'sB',code:'OLD2'}},
  invites:{CODE1:{type:'char',refId:'cNew'},CODE0:{type:'char',refId:'cX',usedBy:'someone'}},
  staffCards:{cA:{intro:'hi'},cB:{intro:'yo'}},
  staffStatus:{cA:{on:false}},
  shopConfig:{cloth0:{price:300}},
  clientOrders:{o1:{status:'pending',amount:300,myKey:'k1'}},
  wallet:{k1:{balance:100}},
  accounts:{'123456789012345678':{myKey:'k1'}},
  orders:{w1:{status:'running'}},
  characters:{cA:{name:'A'}},
  staff:{sB:{name:'B'}},
  mail:{k1:{m1:{title:'t'}}},
}});

const P3=process.env.PHASE3==='1';
const cases=[
 // [label, who, method, path, body, expectAllowed]
 ['Discord 客人改商品價格','discord','PUT','peiwan/shopConfig/cloth0/price',0,false],
 ['自行註冊的帳號改商品價格','rando','PUT','peiwan/shopConfig/cloth0/price',0,false],
 ['店長改商品價格','admin','PUT','peiwan/shopConfig/cloth0/price',350,true],
 ['自行註冊的帳號改員工資料','rando','PUT','peiwan/staff/sB/name','X',false],
 ['店長改員工資料','admin','PUT','peiwan/staff/sB/name','B2',true],
 ['陪玩改自己的卡片','partner','PUT','peiwan/staffCards/cA/intro','new',true],
 ['陪玩改別人的卡片','partner','PUT','peiwan/staffCards/cB/intro','hack',false],
 ['Discord 客人改陪玩卡片','discord','PUT','peiwan/staffCards/cA/intro','hack',false],
 ['陪玩打卡','partner','PATCH','peiwan/staffStatus/cA',{on:true},true],
 ['陌生人替陪玩打卡','anon','PATCH','peiwan/staffStatus/cA',{on:true},false],
 ['自行註冊的帳號讀全部邀請碼','rando','GET','peiwan/invites',undefined,false],
 ['店長讀全部邀請碼','admin','GET','peiwan/invites',undefined,true],
 ['用邀請碼註冊陪玩（正常流程）','newbie','PATCH','peiwan',{'links/newbie':{type:'char',refId:'cNew',code:'CODE1'},'invites/CODE1/usedBy':'newbie'},true],
 ['已用過的邀請碼再註冊','newbie2','PATCH','peiwan',{'links/newbie2':{type:'char',refId:'cX',code:'CODE0'},'invites/CODE0/usedBy':'newbie2'},false],
 ['不用邀請碼自己寫成店員','rando','PUT','peiwan/links/rando',{type:'staff',refId:'sB',code:'NOPE'},false],
 ['邀請碼但冒充別的身分','newbie','PATCH','peiwan',{'links/newbie':{type:'staff',refId:'sB',code:'CODE1'},'invites/CODE1/usedBy':'newbie'},false],
 ['陌生人建立新訂單','anon','PUT','peiwan/clientOrders/o2',{status:'pending',amount:300,myKey:'k9'},!P3],
 ['陌生人把訂單改成已付款','anon','PUT','peiwan/clientOrders/o1/status','confirmed',false],
 ['Discord 客人把訂單改成已付款','discord','PUT','peiwan/clientOrders/o1/status','confirmed',false],
 ['陪玩更新訂單狀態','partner','PUT','peiwan/clientOrders/o1/status','confirmed',true],
 ['Discord 客人把金幣改成 99999','discord','PUT','peiwan/wallet/k1/balance',99999,false],
 ['陌生人把金幣變多','anon','PUT','peiwan/wallet/k1/balance',101,false],
 ['店長儲值金幣','admin','PUT','peiwan/wallet/k1/balance',600,true],
 ['Discord 客人發站內信給別人','discord','PUT','peiwan/mail/k1/m2',{title:'假客服'},false],
 ['陪玩發站內信','partner','PUT','peiwan/mail/k1/m3',{title:'hello'},true],
 ['客人標記信件已讀','anon','PUT','peiwan/mail/k1/m1/read',1,!P3],
 ['Discord 客人讀全部客戶帳號','discord','GET','peiwan/accounts',undefined,false],
 ['店長讀全部客戶帳號','admin','GET','peiwan/accounts',undefined,true],
 ['Discord 客人改工單','discord','PUT','peiwan/orders/w1/status','done',false],
 ['客服改工單','kefu','PUT','peiwan/orders/w1/status','done',true],
 ['Discord 客人讀員工角色資料','discord','GET','peiwan/characters',undefined,false],
 ['陪玩讀員工角色資料','partner','GET','peiwan/characters',undefined,true],
];
const WHO={admin:ADMIN,partner:PARTNER,kefu:KEFU,discord:DISCORD,rando:RANDO,newbie:NEWBIE,newbie2:NEWBIE2,anon:ANON};

async function run(rules){
  const out=[];
  for(const [label,who,method,path,body,expect] of cases){
    await setRules('t',{rules:{'.read':false,'.write':false}});await seed('t',data());await setRules('t',rules);
    const r=await req('t',method,path,body,WHO[who]);
    out.push({label,expect,allowed:r.ok,detail:r.ok?'':r.body.slice(0,80)});
  }
  return out;
}
(async()=>{
  const live=await run(JSON.parse(fs.readFileSync(liveFile)));
  const hard=await run(JSON.parse(fs.readFileSync(newFile)));
  let fails=0;
  console.log('結果 | 情境 | 舊規則 | 新規則');
  cases.forEach((c,i)=>{const ok=hard[i].allowed===c[5];if(!ok)fails++;const f=a=>a?'允許':'擋下';console.log(`${ok?'PASS':'FAIL'} | ${c[0]} | ${f(live[i].allowed)} | ${f(hard[i].allowed)}${ok?'':'  <-- expected '+f(c[5])+' '+hard[i].detail}`)});
  console.log(`\n${cases.length-fails}/${cases.length} passed`);process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
