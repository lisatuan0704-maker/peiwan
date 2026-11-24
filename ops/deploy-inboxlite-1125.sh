#!/bin/bash
# 小小酒館後端 11/25（Firebase 帳單一天 250 元，流量分析：orderVoiceV1 一分鐘被整包讀 88 次、6.7MB）：
#  ①收件匣 /v1/voice/inbox 每次整包讀 orderVoiceV1（約 76KB，網站每 5 秒問一次）→ 只讀這位用得到的（inbox-lite.cjs）
#  ②點單前檢查 /v1/voice/check 整包讀 orderVoiceV1 → 只讀冒險者綁定兩格
#  ③語音登記 registerOrder 整包讀 secureV1 → 只讀這位的 members／owners／闆卡名字
#  ④語音房已收掉的單每 30 秒重跑一遍 → 這次開機內記下來不再跑（worker-skip.cjs）
#  回應內容與資料庫寫入跟以前一模一樣（本機新舊逐項比對 31 項）。
# 在主機的 root 終端機執行。找不到插入點就停止；測試失敗不會換版；健康檢查失敗自動還原舊版。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261125-inboxlite
# v2：docker 舊紀錄被清掉時改看系統紀錄（第一版在主機停在「找不到 BOOKING_ROOM_READY」，沒有變動）
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
if grep -q 'inbox-lite.cjs' "$SRC/order-voice-bot/rehearsal.cjs"; then echo "已經部署過了，不用再貼。"; exit 0; fi
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能上次做到一半），停止。請拍給 Claude。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
T0=$(mktemp -d /tmp/tt-inboxlite.XXXXXX)
cat > "$T0/patch.py" <<'PY'
import os,sys
# 11/25 Firebase 帳單（一天 250 元）：
#  ①收件匣 /v1/voice/inbox 每次整包讀 orderVoiceV1（約 76KB）→ 只讀這位用得到的（inbox-lite.cjs）
#  ②點單前檢查 /v1/voice/check 整包讀 orderVoiceV1 → 只讀冒險者綁定兩格
#  ③語音登記 registerOrder 整包讀 secureV1（所有老闆的帳號與闆卡）→ 只讀這位的 members／owners／闆卡名字
#  ④語音房已收掉的單每 30 秒重跑一遍 → 這次開機內記下來不再跑（worker-skip.cjs）
# 每個插入點都先核對「剛好出現一次」，有一個對不上就整個停止，什麼都不改。
mode,root=sys.argv[1],sys.argv[2]
SECURE_FOR=(
"// 11/25 Firebase 帳單：以前整包讀 secureV1（所有老闆的帳號與闆卡），改成只讀這位的 members／owners／闆卡名字（registerOrder 只用到這三樣）\n"
"async function secureFor(db,uid){\n"
" const m=(await db.ref('secureV1/members/'+uid).once('value')).val(),out={members:{},owners:{},characters:{}};if(m==null)return out;out.members[uid]=m;\n"
" const k=m.key;if(typeof k!=='string'||!k||k.length>200||/[.#$\\[\\]\\/]/.test(k))return out;\n"
" const [o,n]=await Promise.all([db.ref('secureV1/owners/'+k).once('value'),db.ref('secureV1/characters/'+k+'/name').once('value')]);\n"
" if(o.val()!=null)out.owners[k]=o.val();if(n.val()!=null)out.characters[k]={name:n.val()};return out;\n"
"}\n")
R=[
 ('rehearsal.cjs',
  "    const s=(await ref.once('value')).val()||{};let recipient;\n"
  "    if(/^discord_\\d{17,20}$/.test(identity.uid)){const m=(await db.ref('secureV1/members/'+identity.uid).once('value')).val();if(!m?.active)fail('ACCOUNT_REQUIRED');recipient=identity.uid.slice(8)}\n"
  "    else{const pair=Object.entries(s.staffBindings||{}).find(([cid,b])=>b.verified&&b.authUid===identity.uid&&s.staffAccounts?.[cid]?.active&&s.staffAccounts[cid].authUid===identity.uid);if(!pair)fail('ACCOUNT_REQUIRED');recipient=pair[1].uid.slice(8)}\n",
  "    // 11/25 Firebase 帳單：以前這裡整包讀 orderVoiceV1（約 76KB，網站每 5 秒問一次），改成只讀這位用得到的（inbox-lite.cjs）\n"
  "    const {s,recipient}=await require('./inbox-lite.cjs').inboxState({ref,db,uid:identity.uid,ids:body?.action==='hide'&&Array.isArray(body.ids)?body.ids.slice(0,20):null,fail});\n"),
 ('rehearsal.cjs',
  "    const s=(await ref.once('value')).val()||{};for(const cid of body.staffIds){",
  "    // 11/25 只讀冒險者綁定兩格（以前整包讀 orderVoiceV1）\n"
  "    const s={staffAccounts:(await ref.child('staffAccounts').once('value')).val()||{},staffBindings:(await ref.child('staffBindings').once('value')).val()||{}};for(const cid of body.staffIds){"),
 ('booking-voice.cjs',
  "function fault(code,status=403){throw Object.assign(Error(code),{code,status})}\n",
  "function fault(code,status=403){throw Object.assign(Error(code),{code,status})}\n"+SECURE_FOR),
 ('booking-voice.cjs',
  "secure=(await db.ref('secureV1').once('value')).val()||{},m=secure.members?.[uid];",
  "secure=await secureFor(db,uid),m=secure.members?.[uid];"),
 ('runtime-worker.cjs',
  " return async()=>{\n",
  " const finished=new Set(); // 11/25 語音房已收掉的單，這次開機內不再每 30 秒重跑（worker-skip.cjs）\n return async()=>{\n"),
 ('runtime-worker.cjs',
  "  const result=await runBatch({store,service,report});\n",
  "  const sk=require('./worker-skip.cjs').skipFinished(store,report,finished);\n"
  "  const result=await runBatch({store:sk.store,service,report:sk.report});\n"),
]
files={}
for f,_,_ in R:
 if f not in files:
  p=os.path.join(root,f)
  if not os.path.isfile(p):print('找不到 '+f+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
  files[f]=open(p,encoding='utf-8',newline='').read().replace('\r\n','\n')
if 'inbox-lite.cjs' in files['rehearsal.cjs']:print('已經改過，跳過');sys.exit(0)
bad=['%s（%d）'%(f,files[f].count(o)) for f,o,_ in R if files[f].count(o)!=1]
if bad:print('程式跟預期不同：'+'、'.join(bad)+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
if mode=='check':print('可以改（%d 處）'%len(R));sys.exit(0)
for f,o,nw in R:files[f]=files[f].replace(o,nw)
for f,s in files.items():open(os.path.join(root,f),'w',encoding='utf-8',newline='').write(s)
print('語音主機省流量：收件匣、點單檢查、語音登記不再整包讀；收掉的語音房不再重跑（%d 處）'%len(R))
PY
cat > "$T0/inbox-lite.cjs" <<'JS'
'use strict';
// 11/25 Firebase 帳單（一天 250 元）：收件匣（/v1/voice/inbox）以前每次都整包讀 orderVoiceV1（約 76KB，單越多越大），
// 網站又每 5 秒問一次 → 一天好幾 GB（流量分析：一分鐘 88 次、6.7MB）。
// 改成只讀這位用得到的：冒險者綁定兩格、這位的單（老闆用 customerId 查；冒險者讀 orders）、
// 最新 20 張＋要隱藏的單的 jobs/<id>/data、自己的 inboxHidden。回傳的 s 跟以前整包讀的格式一樣（只少了用不到的部分），後面的程式照舊。
const SAFE=/^[-A-Za-z0-9_]{1,100}$/;
async function inboxState({ref,db,uid,ids,fail}){
 const val=async r=>(await r.once('value')).val();
 const [sb,sa]=(await Promise.all([val(ref.child('staffBindings')),val(ref.child('staffAccounts'))])).map(v=>v||{});
 let recipient,staff=false;
 if(/^discord_\d{17,20}$/.test(uid)){const m=await val(db.ref('secureV1/members/'+uid));if(!m?.active)fail('ACCOUNT_REQUIRED');recipient=uid.slice(8);staff=Object.values(sb).some(b=>b&&b.uid===uid)}
 else{const pair=Object.entries(sb).find(([cid,b])=>b.verified&&b.authUid===uid&&sa?.[cid]?.active&&sa[cid].authUid===uid);if(!pair)fail('ACCOUNT_REQUIRED');recipient=pair[1].uid.slice(8);staff=true}
 // 冒險者的單要看 staffIds（陣列查不了）→ 讀整個 orders（比整包 orderVoiceV1 小很多）；老闆只查自己的
 const orders=(staff?await val(ref.child('orders')):await val(ref.child('orders').orderByChild('customerId').equalTo(recipient)))||{};
 const top=Object.values(orders).filter(o=>o&&(o.customerId===recipient||o.staffIds?.includes(recipient))).sort((a,b)=>b.startAt-a.startAt).slice(0,20).map(o=>o.id);
 const want=[...new Set([...top,...(Array.isArray(ids)?ids:[])])].filter(id=>typeof id==='string'&&SAFE.test(id));
 const jobs={};await Promise.all(want.map(async id=>{const d=await val(ref.child('jobs/'+id+'/data'));if(d!=null)jobs[id]={data:d}}));
 const hidden=await val(ref.child('inboxHidden/'+recipient));
 return {s:{staffBindings:sb,staffAccounts:sa,orders,jobs,inboxHidden:hidden!=null?{[recipient]:hidden}:{}},recipient};
}
module.exports={inboxState};
JS
cat > "$T0/worker-skip.cjs" <<'JS'
'use strict';
// 11/25 Firebase 帳單：語音房已經收掉（job phase deleted）的單，以前每 30 秒都整張重跑一遍
// （搶租約、讀單、讀 job、清信件按鈕、放租約，每張好幾次讀寫，單越多越貴）。
// process() 一看到 deleted 就直接結束、不會再做別的事 → 這次開機內記下來，之後不再跑（重開機每張會再跑一次才記住）。
function skipFinished(store,report,finished){
 return {
  store:{...store,pending:async()=>(await store.pending()).filter(id=>!finished.has(id))},
  report:r=>{if(r&&r.state==='deleted'&&typeof r.orderId==='string')finished.add(r.orderId);return report(r)}
 };
}
module.exports={skipFinished};
JS
cat > "$T0/inbox-lite-1125.test.cjs" <<'JS'
'use strict';
// 11/25 Firebase 帳單：收件匣／點單檢查／語音登記不再整包讀 orderVoiceV1、secureV1；收掉的語音房不再每 30 秒重跑
const test=require('node:test'),assert=require('node:assert/strict');
const clone=v=>v==null?null:structuredClone(v);
function fakeDb(data){
 const reads=[];
 const seg=p=>p.split('/').filter(Boolean);
 const get=p=>seg(p).reduce((o,k)=>o==null?undefined:o[k],data);
 const put=(p,v)=>{const ks=seg(p);if(!ks.length){for(const k of Object.keys(data))delete data[k];Object.assign(data,v);return}let o=data;ks.slice(0,-1).forEach(k=>{o=o[k]??={}});if(v===null)delete o[ks.at(-1)];else o[ks.at(-1)]=v};
 const snap=v=>({val:()=>clone(v===undefined?null:v),exists:()=>v!=null});
 const ref=p=>({
  child:c=>ref(p+'/'+c),
  orderByChild:f=>({equalTo:v=>({once:async()=>{reads.push('query:'+p+':'+f);const all=get(p)||{},out={};for(const [k,x] of Object.entries(all))if(x&&x[f]===v)out[k]=x;return snap(Object.keys(out).length?out:null)}})}),
  once:async()=>{reads.push(seg(p).join('/'));return snap(get(p))},
  get:async()=>{reads.push(seg(p).join('/'));return snap(get(p))},
  set:async v=>put(p,clone(v)),remove:async()=>put(p,null),
  update:async o=>{for(const [k,v] of Object.entries(o))put(p+'/'+k,clone(v))},
  transaction:async fn=>{reads.push('tx:'+seg(p).join('/'));const cur=get(p);const nv=fn(cur===undefined?null:clone(cur));if(nv===undefined)return {committed:false,snapshot:snap(cur)};put(p,clone(nv));return {committed:true,snapshot:snap(nv)}}});
 return {ref,data,reads};
}
const RIRA='-OxY7C4vDkgsr1zcyWbk',KAB='-OxY46ezlpnRt64hUIw9',GUILD='111111111111111111';
const D_RIRA='200000000000000001',D_KAB='200000000000000002',C1='300000000000000001',C2='300000000000000002',C3='300000000000000003';
function fixture(now){
 const orders={},jobs={};
 const add=(id,o,job)=>{orders[id]={id,revision:1,sourceOrderIds:['src_'+id],staffCids:[RIRA],staffNames:['縭'],customerName:'客人',...o};if(job)jobs[id]={data:job,lock:null}};
 add('o1',{customerId:C1,staffIds:[D_RIRA],status:'confirmed',startAt:now-600000,endAt:now+3000000},{phase:'ready',channelId:'400000000000000001'});
 add('o2',{customerId:C1,staffIds:[D_RIRA],status:'confirmed',startAt:now-3*3600000,endAt:now-2*3600000},{phase:'deleted'});
 add('o3',{customerId:C2,staffIds:[D_KAB],staffCids:[KAB],status:'pending',booking:true,startAt:now+2*3600000,endAt:now+3*3600000});
 add('o4',{customerId:C2,staffIds:[D_RIRA],status:'cancelled',startAt:now-86400000,endAt:now-82800000},{phase:'closed'});
 for(let i=0;i<22;i++)add('old'+i,{customerId:C1,staffIds:[D_KAB],staffCids:[KAB],status:'confirmed',startAt:now-(10+i)*86400000,endAt:now-(10+i)*86400000+3600000},{phase:'deleted',channelId:'4000000000000001'+String(i).padStart(2,'0')});
 return {
  orderVoiceV1:{orders,jobs,inboxHidden:{[C1]:{o2:true}},staffAccounts:{[RIRA]:{active:true,authUid:'work_rira',name:'縭'},[KAB]:{active:true,authUid:'work_kab',name:'蕪'}},
   staffBindings:{[RIRA]:{verified:true,authUid:'work_rira',uid:'discord_'+D_RIRA},[KAB]:{verified:true,authUid:'work_kab',uid:'discord_'+D_KAB}},
   sourceIndex:{},loyalty:{x:{y:{seconds:1}}},mailIndex:{o2:{[C1]:{m1:true}}},partyV1:{parties:{p:{a:1}}}},
  secureV1:{members:{['discord_'+C1]:{active:true,key:'K1'},['discord_'+C2]:{active:true,key:'K2'},['discord_'+C3]:{active:false,key:'K3'},['discord_'+D_RIRA]:{active:true,key:'KR'}},
   owners:{K1:'discord_'+C1,K2:'discord_'+C2,KR:'discord_'+D_RIRA},characters:{K1:{name:'小羊',doll:{front:1},pub:{frm:'wr1'}},OTHER:{name:'別人',big:'x'.repeat(500)}}},
  peiwan:{lobby:{K1:{name:'小羊'},K2:{name:'阿二'}},clientOrders:{}}
 };
}
const {voiceHandler}=require('./rehearsal.cjs');
async function call(db,url,body,uid){
 const h=voiceHandler({db,auth:{verifyIdToken:async t=>({uid:t})},applicationId:'1',guildId:GUILD,enabled:true,clientAddress:()=>'a'+Math.random()});
 const raw=Buffer.from(JSON.stringify(body));
 const req={method:'POST',url,headers:{authorization:'Bearer '+uid},socket:{remoteAddress:'x'},async*[Symbol.asyncIterator](){yield raw}};
 let out;const res={statusCode:200,setHeader(){},end(s){out=JSON.parse(s)}};
 await h(req,res);return {status:res.statusCode,body:out};
}
const fullReads=db=>db.reads.filter(r=>r==='orderVoiceV1'||r==='secureV1'||r==='orderVoiceV1/jobs');
test('老闆收件匣：自己的單、最新 20 張、隱藏與語音房連結都對，不整包讀',async()=>{
 const db=fakeDb(fixture(Date.now()));
 const r=await call(db,'/v1/voice/inbox',{},'discord_'+C1);
 assert.equal(r.status,200);
 const ids=r.body.items.map(x=>x.id);
 assert.equal(ids.length,20);assert.equal(ids[0],'o1');assert.ok(ids.includes('o2'));assert.ok(!ids.includes('o3')&&!ids.includes('o4'));
 const o1=r.body.items.find(x=>x.id==='o1'),o2=r.body.items.find(x=>x.id==='o2');
 assert.equal(o1.url,'https://discord.com/channels/'+GUILD+'/400000000000000001');assert.equal(o1.state,'ready');assert.equal(o1.canDismiss,false);
 assert.equal(o2.hidden,true);assert.equal(o2.canDismiss,true);assert.equal(o2.state,'deleted');
 assert.deepEqual(fullReads(db),[]);
 assert.ok(db.reads.some(x=>x.startsWith('query:orderVoiceV1/orders:customerId')));
});
test('冒險者（工作帳號）收件匣：看到自己接的單',async()=>{
 const db=fakeDb(fixture(Date.now()));
 const r=await call(db,'/v1/voice/inbox',{},'work_kab');
 assert.equal(r.status,200);
 const ids=r.body.items.map(x=>x.id);
 assert.equal(ids[0],'o3');assert.equal(ids.length,20);assert.ok(!ids.includes('o1'));
 assert.deepEqual(fullReads(db),[]);
});
test('老闆的 Discord 剛好也是冒險者：兩種單都看得到',async()=>{
 const db=fakeDb(fixture(Date.now()));
 const r=await call(db,'/v1/voice/inbox',{},'discord_'+D_RIRA);
 const ids=r.body.items.map(x=>x.id);
 assert.ok(ids.includes('o1')&&ids.includes('o4')&&!ids.includes('o3'));
});
test('帳號停用、不是冒險者：ACCOUNT_REQUIRED',async()=>{
 const db=fakeDb(fixture(Date.now()));
 assert.deepEqual(await call(db,'/v1/voice/inbox',{},'discord_'+C3),{status:403,body:{error:'ACCOUNT_REQUIRED'}});
 assert.deepEqual(await call(db,'/v1/voice/inbox',{},'work_nobody'),{status:403,body:{error:'ACCOUNT_REQUIRED'}});
});
test('隱藏已結束的通知：自己的已結束單可以、進行中不行、別人的找不到',async()=>{
 const db=fakeDb(fixture(Date.now()));
 assert.deepEqual(await call(db,'/v1/voice/inbox',{action:'hide',ids:['old3','old4']},'discord_'+C1),{status:200,body:{ok:true}});
 assert.deepEqual(db.data.orderVoiceV1.inboxHidden[C1],{o2:true,old3:true,old4:true});
 assert.deepEqual(await call(db,'/v1/voice/inbox',{action:'hide',ids:['o1']},'discord_'+C1),{status:409,body:{error:'ORDER_ACTIVE'}});
 assert.deepEqual(await call(db,'/v1/voice/inbox',{action:'hide',ids:['o3']},'discord_'+C1),{status:404,body:{error:'NOT_FOUND'}});
 assert.deepEqual(fullReads(db),[]);
});
test('點單前檢查：冒險者有綁定才過，不整包讀',async()=>{
 const db=fakeDb(fixture(Date.now()));
 assert.deepEqual(await call(db,'/v1/voice/check',{staffIds:[RIRA]},'discord_'+C1),{status:200,body:{key:'K1'}});
 assert.deepEqual(await call(db,'/v1/voice/check',{staffIds:['-NotBound']},'discord_'+C1),{status:409,body:{error:'STAFF_NOT_BOUND'}});
 assert.deepEqual(await call(db,'/v1/voice/check',{staffIds:[RIRA]},'discord_'+D_RIRA),{status:400,body:{error:'INVALID_REQUEST'}});
 assert.deepEqual(fullReads(db),[]);
});
const {registerOrder}=require('./booking-voice.cjs');
const play=(now,o)=>({myKey:'K1',type:'play',status:'confirmed',createdAt:now-60000,staffCid:RIRA,planName:'休閒小遊戲 1 小時',...o});
test('語音登記：照樣建好語音單，不整包讀 secureV1',async()=>{
 const now=Date.now(),d=fixture(now);d.peiwan.clientOrders.c1=play(now);
 const db=fakeDb(d);
 const r=await registerOrder({db,identity:{uid:'discord_'+C1},body:{ids:['c1']},now});
 assert.equal(r.status,'pending');
 const o=db.data.orderVoiceV1.orders[r.id];
 assert.equal(o.customerId,C1);assert.equal(o.customerName,'小羊');assert.deepEqual(o.staffIds,[D_RIRA]);
 assert.equal(db.data.orderVoiceV1.sourceIndex.c1,r.id);
 assert.ok(!db.reads.includes('secureV1'));
 assert.ok(db.reads.includes('secureV1/members/discord_'+C1)&&db.reads.includes('secureV1/owners/K1'));
});
test('語音登記：闆卡不是本人 ACCOUNT_REQUIRED；沒有私人房闆卡就用大廳名字',async()=>{
 const now=Date.now(),d=fixture(now);d.peiwan.clientOrders.c1=play(now);d.secureV1.owners.K1='discord_999999999999999999';
 await assert.rejects(registerOrder({db:fakeDb(d),identity:{uid:'discord_'+C1},body:{ids:['c1']},now}),e=>e.code==='ACCOUNT_REQUIRED');
 const d2=fixture(now);d2.peiwan.clientOrders.c2=play(now,{myKey:'K2'});
 const db2=fakeDb(d2);
 const r=await registerOrder({db:db2,identity:{uid:'discord_'+C2},body:{ids:['c2']},now});
 assert.equal(db2.data.orderVoiceV1.orders[r.id].customerName,'阿二');
 const d3=fixture(now);d3.peiwan.clientOrders.c2=play(now,{myKey:'K2'});delete d3.peiwan.lobby.K2;
 await assert.rejects(registerOrder({db:fakeDb(d3),identity:{uid:'discord_'+C2},body:{ids:['c2']},now}),e=>e.code==='CHARACTER_REQUIRED');
});
const {skipFinished}=require('./worker-skip.cjs'),{runBatch}=require('./batch.cjs');
test('收掉的語音房：這次開機內只跑一次，其他單照跑',async()=>{
 const seen=[],reports=[],finished=new Set();
 const store={pending:async()=>['a','b','c'],order:async()=>({})};
 const state={a:'deleted',b:'ready',c:'deleted'};
 let cn=0;const service={process:async id=>{seen.push(id);if(id==='c'&&++cn===1)throw Object.assign(Error('x'),{code:'RATE_LIMITED'});return {state:state[id]}}};
 const run=async()=>{const sk=skipFinished(store,r=>reports.push(r),finished);return runBatch({store:sk.store,service,report:sk.report})};
 await run();assert.deepEqual(seen,['a','b','c']);
 seen.length=0;await run();assert.deepEqual(seen,['b','c']);   // a 收掉了跳過；c 上次出錯沒記住
 seen.length=0;await run();assert.deepEqual(seen,['b']);
 assert.equal(typeof store.order,'function');assert.ok(reports.some(r=>r.error==='RATE_LIMITED'));
});
JS
say "核對主機上的程式"
python3 "$T0/patch.py" check "$SRC/order-voice-bot" || { rm -rf "$T0"; exit 1; }
if [ -z "$R" ]; then
  MARK='(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)'
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE "$MARK" | sort -u || true)
  ST=''
  if ! echo "$PRE" | grep -qx BOOKING_ROOM_READY; then
    # v2（11/25 第一次貼時停在這裡）：主機開了好幾天，docker 的舊紀錄可能被清掉 → 改看系統紀錄裡「這次啟動之後」的標記
    ST=$(docker inspect -f '{{.State.StartedAt}}' tinytavern-service 2>/dev/null || true)
    SINCE=$(date -d "$ST" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || true)
    if [ -n "$SINCE" ]; then PRE=$(journalctl -u tinytavern-service --since "$SINCE" -o cat --no-pager 2>/dev/null | grep -xE "$MARK" | sort -u || true); fi
  fi
  if ! echo "$PRE" | grep -qx BOOKING_ROOM_READY; then
    say "找不到語音主機的啟動紀錄，先不換版（正式服務沒有變動）。下面這段請拍給 Claude："
    docker ps -a --filter name=tinytavern-service --format '{{.Names}}｜{{.Status}}｜{{.Image}}' 2>/dev/null || true
    echo "啟動時間：${ST:-?}｜docker 紀錄行數：$(docker logs tinytavern-service 2>&1 | wc -l)｜紀錄設定：$(docker inspect -f '{{json .HostConfig.LogConfig}}' tinytavern-service 2>/dev/null || true)"
    echo "系統紀錄裡的啟動標記："; journalctl -u tinytavern-service -o cat --no-pager 2>/dev/null | grep -xE "$MARK" | sort | uniq -c || true
    echo "最近的紀錄："; docker logs --tail 12 tinytavern-service 2>&1 | grep -v -i webhook | cut -c1-150 || true
    rm -rf "$T0"; exit 1
  fi
  echo "啟動標記：$(echo $PRE)"
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session);P3=$(code /v1/voice/accept);P4=$(code /v1/voice/inbox)
  echo "重啟前：voice=$P1 rooms=$P2 accept=$P3 inbox=$P4"
fi

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
for f in inbox-lite.cjs worker-skip.cjs inbox-lite-1125.test.cjs; do cp "$T0/$f" "$DST/order-voice-bot/$f"; chmod 644 "$DST/order-voice-bot/$f"; done
python3 "$T0/patch.py" apply "$DST/order-voice-bot" || { rm -rf "$T0" "$DST"; echo "修改失敗，正式服務沒有變動。"; exit 1; }
rm -rf "$T0"
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/rehearsal.cjs order-voice-bot/booking-voice.cjs order-voice-bot/runtime-worker.cjs order-voice-bot/inbox-lite.cjs order-voice-bot/worker-skip.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/inbox-lite-1125.test.cjs"
for x in order-voice-bot/framefix-1120.test.cjs order-voice-bot/frame-1120.test.cjs order-voice-bot/fix-1119.test.cjs order-voice-bot/booking-room.test.cjs order-voice-bot/room-stay-1111.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/booking-voice-pool.test.cjs order-voice-bot/staff-order-dm.test.cjs order-voice-bot/interview-dm.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; cd /; rm -rf "$DST"; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true

cp -p "$UNIT" "$UNIT.before-inboxlite"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-inboxlite" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
last=''
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1)
  miss=''; for c in $PRE; do echo "$L" | grep -qx "$c" || miss="$miss $c"; done
  [ -z "$miss" ] || { last="還沒就緒：$miss"; continue; }
  a=$(code /v1/voice/session);b=$(code /v1/rooms/session);c=$(code /v1/voice/accept);d=$(code /v1/voice/inbox)
  if [ "$a" = "$P1" ] && [ "$b" = "$P2" ] && [ "$c" = "$P3" ] && [ "$d" = "$P4" ]; then
    say "INBOXLITE_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c inbox=$d）"
    echo "語音主機省流量版上線了：收件匣、點單檢查、語音登記不再整包讀資料，收掉的語音房不再重跑。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c inbox=$d（重啟前 voice=$P1 rooms=$P2 accept=$P3 inbox=$P4）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
