// v466 規則測試：名冊不公開、禁言由資料庫把關、聊天與闆卡欄位限制。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'},STAFF={uid:'staff1'},STRANGER={uid:'email_stranger'};
const now=()=>Date.now();
const data=()=>({secureV1:{members:{discord_100000000000000001:{active:true,key:'k1'},discord_100000000000000002:{active:true,key:'k2'}},owners:{k1:'discord_100000000000000001',k2:'discord_100000000000000002'}},peiwan:{
 config:{adminUid:'admin1',services:{s1:{name:'特戰',price:350,active:true}}},tables:{t1:{title:'併桌',price:200,seats:4}},shopConfig:{cloth9:{price:350}},wallet:{k1:{balance:100000}},links:{staff1:{type:'char',cid:'c1'}},
 lobby:{k1:{name:'小明',quote:'hi',bm:3,bd:4,pub:{dc:'ming'}},k2:{name:'小華'}},
 pos:{k1:{x:1,y:2}},owned:{k1:{cloth0:{name:'c0',ts:1},baseStart:{back:1,front:1,cloth:1,face:1,brow:1,at:1}}},
 chat:{m1:{key:'k2',name:'小華',text:'哈囉',t:1}},
 mutes:{k2:{until:-1}},
 config2:null}});
const msg=(o={})=>({key:'k1',name:'小明',text:'大家好',map:'tavern',t:now(),...o});
const card={name:'新來的',tags:['貓控'],quote:'你好',doll:{hair:1},bm:5,bd:6,games:'LOL',updatedAt:1};
const inc=n=>({'.sv':{increment:n}});
const pay=(id,o)=>({['clientOrders/'+id]:{myKey:'k1',paidBy:'wallet',status:o.type==='shop'?'done':'confirmed',createdAt:1,name:'小明',couponUsed:false,...o},['wallet/k1/balance']:inc(-o.amount),['wallet/k1/lastTx']:id,['walletTx/k1/'+id]:{type:'spend',amount:-o.amount,ref:id,ts:1}});
const buyItem=(id,amt,cp)=>({...pay(id,{type:'shop',plan:'cloth9',itemId:'cloth9',amount:amt,couponUsed:!!cp}),['owned/k1/cloth9']:{name:'c9',ts:1,ref:id}});
const cases=[
 ['未登入讀整份名冊',null,'GET','peiwan/lobby',undefined,false],
 ['未登入讀別人闆卡全部',null,'GET','peiwan/lobby/k1',undefined,false],
 ['未登入只讀闆卡名字（工房與入口需要）',null,'GET','peiwan/lobby/k1/name',undefined,true],
 ['任何人自己註冊的 Email 帳號讀名冊','stranger','GET','peiwan/lobby',undefined,false],
 ['登入客人讀名冊','me','GET','peiwan/lobby',undefined,true],
 ['店員讀名冊','staff','GET','peiwan/lobby',undefined,true],
 ['店長讀名冊','admin','GET','peiwan/lobby',undefined,true],
 ['未登入讀位置',null,'GET','peiwan/pos',undefined,false],
 ['登入客人讀位置','me','GET','peiwan/pos',undefined,true],
 ['未登入讀所有人背包',null,'GET','peiwan/owned',undefined,false],
 ['未登入讀初始部件紀錄（工房需要）',null,'GET','peiwan/owned/k1/baseStart',undefined,true],
 ['登入客人讀自己背包','me','GET','peiwan/owned/k1',undefined,true],
 ['未登入讀聊天',null,'GET','peiwan/chat',undefined,false],
 ['登入客人讀聊天','me','GET','peiwan/chat',undefined,true],
 ['未登入讀禁言名單',null,'GET','peiwan/mutes',undefined,false],
 ['登入客人讀自己的禁言狀態','other','GET','peiwan/mutes/k2',undefined,true],
 ['正常發言','me','PUT','peiwan/chat/n1',msg(),true],
 ['永久禁言的人發言','other','PUT','peiwan/chat/n2',msg({key:'k2',name:'小華'}),false],
 ['禁言中（未到期）發言','me','PUT','peiwan/chat/n3',msg(),false,'muteFuture'],
 ['禁言已到期可發言','me','PUT','peiwan/chat/n4',msg(),true,'mutePast'],
 ['冒用別人的名字','me','PUT','peiwan/chat/n5',msg({name:'店長'}),false],
 ['訊息超過 200 字','me','PUT','peiwan/chat/n6',msg({text:'哈'.repeat(201)}),false],
 ['空白訊息','me','PUT','peiwan/chat/n7',msg({text:''}),false],
 ['夾帶其他欄位','me','PUT','peiwan/chat/n8',msg({html:'<img>'}),false],
 ['時間戳記寫到未來','me','PUT','peiwan/chat/n9',msg({t:now()+86400000}),false],
 ['用別人的鑰匙發言','me','PUT','peiwan/chat/n10',msg({key:'k2',name:'小華'}),false],
 ['刪除 6 小時前的舊訊息','me','DELETE','peiwan/chat/m1',undefined,true],
 ['新闆卡（未登入，工房）',null,'PUT','peiwan/lobby/newk',card,true],
 ['新闆卡名字超長',null,'PUT','peiwan/lobby/newk2',{...card,name:'名'.repeat(41)},false],
 ['新闆卡一句話超長',null,'PUT','peiwan/lobby/newk3',{...card,quote:'字'.repeat(121)},false],
 ['生日月份不合理',null,'PUT','peiwan/lobby/newk4',{...card,bm:13},false],
 ['本人修改一句話','me','PUT','peiwan/lobby/k1/quote','新的一句話',true],
 ['不能覆蓋別人的闆卡',null,'PUT','peiwan/lobby/k1',card,false],
 ['闆卡鑰匙含引號（拿來插入程式）',null,'PUT',"peiwan/lobby/x');alert(1);('",card,false],
 ['闆卡鑰匙含空白與雙引號',null,'PUT','peiwan/lobby/x" autofocus onfocus="alert(1)',card,false],
 ['客人卡片鑰匙含引號',null,'PUT',"peiwan/cards/a'b",{name:'x'},false],
 ['Discord 頭貼欄位放網址','me','PUT','peiwan/lobby/k1/pub/dcav','x" onerror="alert(1)',false],
 ['Discord 頭貼正常格式','me','PUT','peiwan/lobby/k1/pub/dcav','123456789012345678/0123456789abcdef0123456789abcdef',true],
 ['用帶引號的編號送轉帳單','me','PUT',"peiwan/clientOrders/o');x('",{type:'topup',amount:100,coinAmount:100,myKey:'k1',status:'pending',createdAt:1},false],
 ['轉帳單金幣數放文字','me','PUT','peiwan/clientOrders/t1',{type:'topup',amount:100,coinAmount:'<img src=x>',myKey:'k1',status:'pending',createdAt:1},false],
 ['正常轉帳儲值單','me','PATCH','peiwan',{'clientOrders/t2':{type:'topup',amount:100,coinAmount:100,myKey:'k1',status:'pending',createdAt:1,name:'小明',last5:'12345',hasProof:true,payDue:2,bonus:0,planName:'儲值 100 金幣'},'clientOrderProofs/t2':'data:image/jpeg;base64,AAAA'},true],
 ['付款截圖不是圖片','me','PATCH','peiwan',{'clientOrders/t3':{type:'topup',amount:100,coinAmount:100,myKey:'k1',status:'pending',createdAt:1,name:'小明',last5:'12345',hasProof:true,payDue:2,bonus:0,planName:'儲值 100 金幣'},'clientOrderProofs/t3':'x" onerror="alert(1)'},false],
 ['金幣付陪玩（價目 350）','me','PATCH','peiwan',pay('w1',{type:'play',plan:'svc_s1',amount:350}),true],
 ['金幣付陪玩只付 1','me','PATCH','peiwan',pay('w2',{type:'play',plan:'svc_s1',amount:1}),false],
 ['金幣付尊榮會員只付 1','me','PATCH','peiwan',pay('w3',{type:'play',plan:'m5000',amount:1}),false],
 ['金幣付尊榮會員 5000','me','PATCH','peiwan',pay('w4',{type:'play',plan:'m5000',amount:5000}),true],
 ['金幣付併桌一席 200','me','PATCH','peiwan',pay('w5',{type:'table',plan:'seat',itemId:'t1',amount:200}),true],
 ['金幣付併桌只付 10','me','PATCH','peiwan',pay('w6',{type:'table',plan:'seat',itemId:'t1',amount:10}),false],
 ['金幣付不存在的方案','me','PATCH','peiwan',pay('w7',{type:'play',plan:'svc_fake',amount:1}),false],
 ['非 VIP 自稱用優惠券折 200','me','PATCH','peiwan',pay('w8',{type:'play',plan:'svc_s1',amount:150,couponUsed:true}),false],
 ['VIP 3（店長確認）用優惠券折 80','me','PATCH','peiwan',pay('w9',{type:'play',plan:'svc_s1',amount:270,couponUsed:true}),true,'vip3'],
 ['VIP 3 想折 200','me','PATCH','peiwan',pay('w10',{type:'play',plan:'svc_s1',amount:150,couponUsed:true}),false,'vip3'],
 ['轉帳單（店長人工核對）金額照收','me','PUT','peiwan/clientOrders/b1',{type:'play',plan:'svc_s1',amount:350,myKey:'k1',status:'pending',createdAt:1,name:'小明',last5:'12345',hasProof:true},true],
 ['非 VIP 買時裝用優惠券少付 200','me','PATCH','peiwan',buyItem('i1',150,true),false],
 ['VIP 5 買時裝用優惠券折 200','me','PATCH','peiwan',buyItem('i2',150,true),true,'vip5'],
 ['正常買時裝','me','PATCH','peiwan',buyItem('i3',350,false),true],
 ['客人自己把 VIP 改成 5','me','PUT','peiwan/vipServer/k1',{lv:5,at:1},false],
 ['冒險者帳號改客人 VIP','staff','PUT','peiwan/vipServer/k1',{lv:5,at:1},false],
 ['店長寫入 VIP 等級','admin','PUT','peiwan/vipServer/k1',{lv:2,at:1},true],
 ['本人讀自己的 VIP','me','GET','peiwan/vipServer/k1',undefined,true,'vip3'],
 ['讀別人的 VIP','other','GET','peiwan/vipServer/k1',undefined,false,'vip3'],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));const ns='p5'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,setup] of cases){
   const d=data();
   if(setup==='muteFuture')d.peiwan.mutes.k1={until:now()+3600000};
   if(setup==='mutePast')d.peiwan.mutes.k1={until:now()-1000};
   if(setup==='vip3')d.peiwan.vipServer={k1:{lv:3,at:1}};
   if(setup==='vip5')d.peiwan.vipServer={k1:{lv:5,at:1}};
   delete d.peiwan.config2;
   await seed(ns,d);
   const w={me:ME,other:OTHER,admin:ADMIN,staff:STAFF,stranger:STRANGER}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 console.log((fail?'FAIL':'PASS')+': phase5 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
