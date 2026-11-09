#!/bin/bash
# 小小酒館：查「接單後沒有語音房、機器人沒私訊」卡在哪（只讀，不改任何資料、不重啟服務）。
# 印出：冒險者的 Discord 綁定、36 小時內每組委託在語音系統的狀態；沒登記到的，用主機上的程式「試跑登記」（不寫入）看被拒的原因；
# 以及服務紀錄裡跟訂單／語音／私訊有關的代碼次數。在主機的 root 終端機執行。
set -uo pipefail
echo "== 目前運行版本：$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' /etc/systemd/system/tinytavern-service.service | head -1)"
echo "== 服務狀態：$(systemctl is-active tinytavern-service)"
echo "== 服務紀錄（36 小時內，跟訂單／語音／私訊有關的代碼與次數）"
docker logs --since 36h tinytavern-service 2>&1 | grep -E '^[A-Z][A-Z0-9_]{3,60}$|VOICE|ORDER|BOOKING|DELIVER|WORKER|DISCORD' | cut -c1-160 | sort | uniq -c | sort -rn | head -40
docker exec -i tinytavern-service node - <<'JS'
const fs=require('fs');
const dir=[process.cwd()+'/order-voice-bot','/app/order-voice-bot',process.cwd()].find(d=>fs.existsSync(d+'/production-credential.cjs'));
const {initializeApp,cert,applicationDefault}=require(require.resolve('firebase-admin/app',{paths:[dir]}));
const {getDatabase}=require(require.resolve('firebase-admin/database',{paths:[dir]}));
const credential=process.env.NODE_ENV==='production'?cert(require(dir+'/production-credential.cjs').loadProductionCredential()):applicationDefault();
const app=initializeApp({credential,projectId:process.env.GOOGLE_CLOUD_PROJECT,databaseURL:process.env.DATABASE_URL},'diag511');
const db=getDatabase(app);
const v=async p=>(await db.ref(p).once('value')).val();
const tw=ms=>Number(ms)?new Date(Number(ms)+8*3600e3).toISOString().slice(5,16).replace('T',' '):'-';
const tail=s=>String(s||'').slice(-5);
// 只讀資料庫：寫入一律丟錯；transaction 只算結果、不寫入（給「試跑登記」用）
function ro(r){return new Proxy(r,{get(t,k){
  if(['set','update','push','remove','setWithPriority','setPriority','onDisconnect'].includes(k))return ()=>{throw Error('READ_ONLY')};
  if(k==='transaction')return async fn=>{const cur=(await t.once('value')).val();const out=fn(cur==null?null:JSON.parse(JSON.stringify(cur)));globalThis.__dry=out===undefined?'拒絕':'會成功';return {committed:false,snapshot:{val:()=>cur}};};
  const x=t[k];
  if(typeof x==='function')return (...a)=>{const y=x.apply(t,a);return y&&typeof y==='object'&&typeof y.once==='function'?ro(y):y;};
  return x&&typeof x==='object'&&typeof x.once==='function'?ro(x):x;}});}
const rodb={ref:p=>ro(db.ref(p))};
(async()=>{
 const now=Date.now(),since=now-36*3600e3;
 const orders=(await db.ref('peiwan/clientOrders').orderByChild('createdAt').startAt(since).once('value')).val()||{};
 const ov=(await v('orderVoiceV1'))||{};
 console.log('== 語音系統：語音單 '+Object.keys(ov.orders||{}).length+'、工作 '+Object.keys(ov.jobs||{}).length+'、來源索引 '+Object.keys(ov.sourceIndex||{}).length);
 console.log('== 冒險者 Discord 綁定');
 for(const cid of new Set([...Object.keys(ov.staffAccounts||{}),...Object.keys(ov.staffBindings||{})])){const a=ov.staffAccounts?.[cid]||{},b=ov.staffBindings?.[cid]||{};
  console.log('  '+cid+' 啟用='+!!a.active+' 已驗證='+!!b.verified+' 帳號一致='+(!!a.authUid&&a.authUid===b.authUid)+' DC='+(b.uid?'有':'無'));}
 const groups={};for(const [id,o] of Object.entries(orders)){if(!o||o.type!=='play')continue;(groups[o.groupId||id]??=[]).push([id,o]);}
 console.log('== 36 小時內的委託 '+Object.keys(groups).length+' 組（時間為台灣時間）');
 let bv=null;try{bv=require(dir+'/booking-voice.cjs');}catch(e){console.log('  讀不到 booking-voice：'+e.message);}
 let shown=false;
 for(const [g,list] of Object.entries(groups).sort((a,b)=>a[1][0][1].createdAt-b[1][0][1].createdAt)){
  const o=list[0][1],uid=await v('secureV1/owners/'+o.myKey);
  const links=[...new Set(list.map(([id])=>ov.sourceIndex?.[id]).filter(Boolean))];
  console.log('-- '+tw(o.createdAt)+' 組#'+tail(g)+' '+list.length+'位 '+list.map(([,x])=>(x.staffName||'不指定')+':'+x.status+(x.accepted?'/接':'')+(x.servingSince?'/開始':'')+(x.workOrderId?'/工單':'')).join(' ')
   +' 付款='+(o.paidBy||'轉帳')+' 預約='+(o.booking?tw(o.reserveAt):'否')+' groupSize='+(o.groupSize||1)+' 老闆DC='+(uid?'有':'無'));
  if(links.length){for(const vid of links){const vo=ov.orders?.[vid]||{},job=ov.jobs?.[vid]?.data||{};
    const dl=Object.values(job.deliveries||{}).map(d=>d.state+(d.error?'('+d.error+')':'')).join(',');
    console.log('   語音單 '+tail(vid)+' 狀態='+vo.status+' 冒險者確認='+Object.keys(vo.approvedStaff||{}).length+'/'+(vo.staffCids||[]).length+' 開始='+tw(vo.startAt)+' 結束='+tw(vo.endAt)+' 工作='+(job.phase||'無')+(job.error?' 錯誤='+job.error:'')+' 私訊='+(dl||'無'));
    if(!shown){shown=true;console.log('   （欄位：語音單 '+Object.keys(vo).join(',')+'／工作 '+Object.keys(job).join(',')+'）');}}}
  else{let r='沒有登記到語音系統';
   if(bv&&uid){globalThis.__dry=null;try{await bv.registerOrder({db:rodb,identity:{uid},body:{ids:list.map(([id])=>id)},now});r+='；試跑：會成功';}
    catch(e){r+='；試跑：'+(globalThis.__dry==='會成功'&&e.code==='ORDER_NOT_READY'?'會成功（試跑不寫入）':'被拒 '+(e.code||e.message));}}
   console.log('   '+r);}
 }
 const act={};for(const o of Object.values(ov.orders||{}))if(o.endAt>now&&['pending','confirmed'].includes(o.status)&&!['deleted','closed'].includes(ov.jobs?.[o.id]?.data?.phase))act[o.customerId]=(act[o.customerId]||0)+1;
 const many=Object.entries(act).filter(([,n])=>n>=3);console.log('== 進行中語音單 3 筆以上的老闆：'+(many.map(([c,n])=>'…'+tail(c)+'='+n).join(' ')||'無'));
 process.exit(0);
})().catch(e=>{console.log('DIAG_FAILED '+e.message);process.exit(1);});
JS
echo "== 診斷結束（沒有改任何東西）"
