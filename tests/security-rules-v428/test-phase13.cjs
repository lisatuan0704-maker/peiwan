// v503 規則測試：金幣群組單（多位冒險者一起點）每張訂單加總不能超過那一筆扣款；商城不走群組。
// 正常群組單用 lobby-ui/order-flow.js 實際的 pricing／makeRecords 產生（改了網頁的分攤方式，這裡會跟著測到）。
// 有填「舊規則預期」的項目也會檢查舊規則（證明漏洞原本存在、正常寫法原本就能過）。
'use strict';
const fs=require('fs'),path=require('path');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const ME={uid:'discord_100000000000000001'},OTHER={uid:'discord_100000000000000002'},ADMIN={uid:'admin1'};
// 從大廳點單程式抽出分攤與訂單格式
const src=fs.readFileSync(path.join(__dirname,'../../lobby-ui/order-flow.js'),'utf8');
const fn=name=>{const s=src.indexOf('function '+name+'(');if(s<0)throw Error('order-flow.js 找不到 '+name);let d=0,i=src.indexOf('{',s);for(;i<src.length;i++){if(src[i]==='{')d++;else if(src[i]==='}'&&!--d)break;}return src.slice(s,i+1);};
const {pricing,makeRecords}=new Function('PAY_MINS',fn('pricing')+fn('makeRecords')+'return {pricing,makeRecords};')(60);
const data=()=>({secureV1:{members:{[ME.uid]:{active:true,key:'k1'},[OTHER.uid]:{active:true,key:'k2'}},owners:{k1:ME.uid,k2:OTHER.uid}},peiwan:{
 config:{adminUid:'admin1',services:{s1:{name:'特戰',price:300,active:true},s2:{name:'陪聊',price:90,active:true}}},
 lobby:{k1:{name:'小明'},k2:{name:'小華'}},
 shopConfig:{itA:{name:'眼鏡',price:30,active:true},itB:{name:'菜刀',price:30,active:true},itC:{name:'髮箍',price:30,active:true}},
 wallet:{k1:{balance:5000,lastTx:'w0'},k2:{balance:5000,lastTx:'w0'}},
 walletTx:{k1:{w0:{type:'topup',amount:5000,ref:'w0',ts:1}},k2:{w0:{type:'topup',amount:5000,ref:'w0',ts:1}}}}});
const inc=n=>({'.sv':{increment:n}});
const clean=o=>JSON.parse(JSON.stringify(o,(k,v)=>v===null?undefined:v));
let seq=0;const uid=p=>p+Date.now().toString(36)+(++seq);
// 扣款：同一次寫入 walletTx＋lastTx＋餘額（跟網頁一樣用 increment）
const spend=(key,tx,amt,extra={})=>({['walletTx/'+key+'/'+tx]:{type:'spend',amount:-amt,ref:tx,note:'測試',ts:Date.now(),...extra},['wallet/'+key+'/lastTx']:tx,['wallet/'+key+'/balance']:inc(-amt)});
// 網頁實際的金幣群組單（order-flow.js submitGroup 的寫入內容）
function group(n,o={}){
 const key=o.key||'k1',list=Array.from({length:n},(_,i)=>({name:'冒險者'+(i+1),cid:'c'+(i+1)})),price=pricing(o.unit||300,n,o.disc||0);
 const ids=list.map(()=>uid('g')),gid=ids[0];
 const recs=makeRecords({list,plan:{id:o.plan||'svc_s1',n:'特戰'},price,name:'小明',last5:'',booking:false,reserveAt:null,key,method:'coin',createdAt:Date.now()},ids,gid);
 const u=spend(key,gid,price.amount,{groupId:gid,orderIds:ids});recs.forEach(r=>u['clientOrders/'+r.id]=clean(r.order));
 return {u,ids,gid,price};
}
// 自己組的群組單：amounts＝每張訂單金額、D＝扣款、type、orderIds／groupSize 可竄改
function forged({amounts,D,type='play',oi,size,noOi,items}){
 const ids=amounts.map(()=>uid('f')),gid=ids[0];
 const u=spend('k1',gid,D,{groupId:gid,...(noOi?{}:{orderIds:oi?oi(ids):ids})});
 amounts.forEach((a,i)=>{
  const o={amount:a,origAmount:a,type,paidBy:'wallet',status:type==='shop'?'done':'confirmed',myKey:'k1',name:'小明',createdAt:Date.now(),groupId:gid,groupSize:size===undefined?amounts.length:size};
  if(type==='shop'){o.itemId=items[i];o.itemName=items[i];o.plan='shop_'+items[i];}else{o.plan='svc_s1';o.staffName='冒險者'+(i+1);o.staffCid='c'+(i+1);}
  if(o.groupSize===null)delete o.groupSize;
  u['clientOrders/'+ids[i]]=o;
  if(type==='shop')u['owned/k1/'+items[i]]={name:items[i],ts:Date.now(),ref:ids[i]};
 });
 return u;
}
// 單件（payWithCoins／v501 一次結帳每一件）
function single(kind,o={}){
 const id=uid('s'),amt=kind==='shop'?30:300,key=o.key||'k1';
 const ord={plan:kind==='shop'?'shop_'+(o.item||'itA'):'svc_s1',planName:'測試',amount:amt,origAmount:amt,couponUsed:false,couponDisc:0,type:kind,name:'小明',paidBy:'wallet',status:kind==='shop'?'done':'confirmed',createdAt:Date.now(),myKey:key,booking:false};
 if(kind==='shop'){ord.itemId=o.item||'itA';ord.itemName=ord.itemId;}else{ord.staffName='縭';ord.staffCid='c1';}
 const u={['clientOrders/'+id]:ord,...spend(key,id,amt)};
 if(kind==='shop')u['owned/'+key+'/'+ord.itemId]={name:ord.itemId,ts:Date.now(),ref:id};
 return u;
}
// [名稱, 身分, 寫入內容（函式）, 新規則預期, 舊規則預期（不填＝只列出）]
const cases=[
 // ── 漏洞案例 ──
 ['【漏洞】扣 30、兩張商城訂單各 30＋背包兩件','me',()=>forged({amounts:[30,30],D:30,type:'shop',items:['itA','itB'],noOi:true}),false,true],
 ['【漏洞】同上，明細也列出兩張訂單','me',()=>forged({amounts:[30,30],D:30,type:'shop',items:['itA','itB']}),false,true],
 ['【漏洞】付一位的錢（300）成立兩位冒險者','me',()=>forged({amounts:[300,300],D:300}),false,true],
 ['【漏洞】付一位的錢成立三位冒險者','me',()=>forged({amounts:[300,300,300],D:300}),false,true],
 ['【漏洞】兩位冒險者，人數寫 1','me',()=>forged({amounts:[300,300],D:300,size:1}),false,true],
 ['【漏洞】兩位冒險者，明細只列第一張','me',()=>forged({amounts:[300,300],D:300,size:1,oi:ids=>[ids[0]]}),false,true],
 ['【漏洞】明細同一張列兩次（想讓第二張不用列）','me',()=>forged({amounts:[300,300],D:600,oi:ids=>[ids[0],ids[0]]}),false,true],
 ['【漏洞】明細編號跳號 {0,2}','me',()=>forged({amounts:[300,300],D:300,size:1,oi:ids=>({0:ids[0],2:ids[1]})}),false,true],
 ['【漏洞】人數寫小數 1.5','me',()=>forged({amounts:[300,300],D:600,size:1.5}),false,true],
 ['【漏洞】沒有人數','me',()=>forged({amounts:[300,300],D:600,size:null}),false,true],
 ['【漏洞】扣 600，第二位多算 1（300＋301）','me',()=>forged({amounts:[300,301],D:600}),false,true],
 ['【漏洞】第一張當單筆吃掉整筆扣款（600），另兩張掛群組各 300','me',()=>{
   // 明細編號＝第一張訂單編號（網頁也是這樣），第一張不帶 groupId 走單筆對帳，明細 orderIds 只列另外兩張
   const u=forged({amounts:[300,300,300],D:600});const [a,b,c]=Object.keys(u).filter(k=>k.startsWith('clientOrders/')),id=a.split('/')[1];
   delete u[a].groupId;delete u[a].groupSize;u[a].amount=600;u[b].groupSize=u[c].groupSize=2;
   u['walletTx/k1/'+id].orderIds=[b.split('/')[1],c.split('/')[1]];return u;},false,true],
 ['群組單混一張商城訂單（加總沒有超過）','me',()=>{const u=forged({amounts:[300,30],D:330});const k=Object.keys(u).filter(k=>k.startsWith('clientOrders/'))[1];Object.assign(u[k],{type:'shop',itemId:'itA',itemName:'itA',plan:'shop_itA',status:'done'});u['owned/k1/itA']={name:'itA',ts:Date.now(),ref:k.split('/')[1]};return u;},false],
 ['商城走群組（加總正確也不行，網頁不會這樣寫）','me',()=>forged({amounts:[30,30],D:60,type:'shop',items:['itA','itB']}),false],
 ['零頭多的一位排在前面（網頁不會這樣排）','me',()=>forged({amounts:[301,300],D:601}),false],
 ['幫別人的闆卡寫群組單','other',()=>group(2).u,false,false],
 // ── 正常寫法 ──
 ['兩位冒險者一起點（600）','me',()=>group(2).u,true,true],
 ['三位冒險者一起點（900）','me',()=>group(3).u,true,true],
 ['三位冒險者有零頭（單價 100、折 10 → 96／97／97）','me',()=>{const g=group(3,{unit:100,disc:10,plan:'svc_s2'});if(g.price.shares.map(s=>s.amount).join()!=='96,97,97')throw Error('分攤方式改了：'+g.price.shares.map(s=>s.amount));return g.u;},true,true],
 ['兩位冒險者有零頭（單價 100、折 1 → 99／100）','me',()=>group(2,{unit:100,disc:1,plan:'svc_s2'}).u,true,true],
 ['十位冒險者（上限）','me',()=>group(10,{unit:100,plan:'svc_s2'}).u,true,true],
 ['十一位冒險者（超過上限）','me',()=>group(11,{unit:100,plan:'svc_s2'}).u,false,true],
 ['單件商城購買','me',()=>single('shop'),true,true],
 ['單人點冒險者','me',()=>single('play'),true,true],
 ['單件訂單的明細帶 orderIds（冒充群組明細）','me',()=>{const u=single('play');const k=Object.keys(u).find(k=>k.startsWith('walletTx/'));u[k].orderIds=[k.split('/')[2]];return u;},false,true],
 ['轉帳群組單（待確認，不扣金幣）','me',()=>{const list=[{name:'縭',cid:'c1'},{name:'桃',cid:'c2'}],price=pricing(300,2,0),ids=[uid('t'),uid('t')];
   const recs=makeRecords({list,plan:{id:'svc_s1',n:'特戰'},price,name:'小明',last5:'12345',booking:false,reserveAt:null,key:'k1',method:'transfer',createdAt:Date.now()},ids,ids[0]);
   const u={};recs.forEach(r=>{u['clientOrders/'+r.id]=clean(r.order);u['clientOrderProofs/'+r.id]='data:image/png;base64,AAAA';});return u;},true,true],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p13'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,make,expect,oldExpect] of cases){
   await seed(ns,data());
   const w={me:ME,other:OTHER,admin:ADMIN}[who]||null;
   const r=await req(ns,'PATCH','peiwan',make(),w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else{
    const tag=oldExpect===undefined?'':r.ok===oldExpect?'':'  ✗ 舊規則預期'+(oldExpect?'允許':'拒絕');
    if(oldExpect!==undefined){if(r.ok===oldExpect)pass++;else fail++;}
    console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name+tag);
   }
  }
 }
 // v501 一次結帳：三件逐件送出（每件一筆明細），全部成立、餘額 5000→4910、背包三件
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const ns='p13cart'+label.charCodeAt(0);await setRules(ns,JSON.parse(fs.readFileSync(rulesFile,'utf8')));await seed(ns,data());
  const rs=[];for(const it of ['itA','itB','itC'])rs.push(await req(ns,'PATCH','peiwan',single('shop',{item:it}),ME));
  const s=JSON.parse((await req(ns,'GET','peiwan',undefined,'owner')).body);
  const ok=rs.every(r=>r.ok)&&s.wallet.k1.balance===4910&&['itA','itB','itC'].every(i=>s.owned?.k1?.[i]);
  if(ok)pass++;else{fail++;console.log('✗ 一次結帳逐件（'+label+'）',rs.map(r=>r.ok),s.wallet.k1.balance);}
 }
 // 正常群組單寫入後：明細、訂單金額加總剛好等於扣款，同一個 groupId 之後不能再掛訂單
 {
  const ns='p13after';await setRules(ns,JSON.parse(fs.readFileSync(newFile,'utf8')));await seed(ns,data());
  const g=group(3,{unit:100,disc:10,plan:'svc_s2'});const a=await req(ns,'PATCH','peiwan',g.u,ME);
  const s=JSON.parse((await req(ns,'GET','peiwan',undefined,'owner')).body);
  const sum=g.ids.reduce((n,id)=>n+s.clientOrders[id].amount,0);
  const late=uid('x'),extra={...s.clientOrders[g.ids[1]],staffName:'多一位'};
  const b=await req(ns,'PATCH','peiwan',{['clientOrders/'+late]:extra},ME);
  const ok=a.ok&&sum===290&&s.wallet.k1.balance===4710&&s.walletTx.k1[g.gid].amount===-290&&!b.ok;
  if(ok)pass++;else{fail++;console.log('✗ 群組單寫入後加總／事後補掛',a.ok,sum,s.wallet?.k1?.balance,b.ok);}
 }
 console.log((fail?'FAIL':'PASS')+': phase13 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
