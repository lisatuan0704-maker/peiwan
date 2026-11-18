#!/bin/bash
# 小小酒館後端 11/19（D 營業中緊急）：
#  ① 頭像框時數改成「買了幾小時」：每張委託 1 小時＋續單續的時間，不管什麼遊戲、冒險者幾分鐘按結束；取消／退款不算；
#     冒險者結單或時間過了就算。直接從 clientOrders 算，以前沒記到的單也補回（loyalty-frames.cjs、rehearsal.cjs）。
#  ② 同一位老闆同時好幾張單（各開一組房間），空著那組被收時把大家正在用的聊天室刪了 →
#     這位老闆還有別組房間沒收：聊天室先留著，等最後一組房間收掉時一起刪（booking-room.cjs、voice.cjs）。
# 在主機的 root 終端機執行。找不到插入點就停止；測試失敗不會換版；健康檢查失敗自動還原舊版。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261119-hourfix
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '
== %s
' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
if grep -q paidLedger "$SRC/order-voice-bot/loyalty-frames.cjs"; then echo "已經部署過了，不用再貼。"; exit 0; fi
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能上次做到一半），停止。請拍給 Claude。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
cat > /tmp/tt-hourfix-patch.py <<'PY'
import os,sys
# 11/19 D：①頭像框時數改成「買了幾小時」：每張委託 1 小時＋續單續的時間（不管什麼遊戲、冒險者幾分鐘按結束），取消／退款不算，
#           冒險者結單或時間過了就算；直接看 clientOrders 重算，以前沒記到的也補回。
#         ②同一位老闆同時好幾張單（各開一組房間），空著那組被收時把大家在用的聊天室一起刪了
#           → 這位老闆還有別組房間沒收，聊天室先留著，等他最後一組房間收掉時一起刪。
# 每個插入點都先核對「剛好出現一次」，有一個對不上就整個停止，什麼都不改。
mode,root=sys.argv[1],sys.argv[2]
LEDGER=r'''// 11/19 D「當然是一單就是一小時」「不論遊戲都是算一小時的一個價位」：頭像框時數＝買了幾小時（每張委託 1 小時＋續單的分鐘），
// 不看冒險者實際計時；取消／退款／冒險者拒接不算；冒險者結單（done）或時間已過才算。直接從 clientOrders 算，以前沒記到的也算進去。
function planMins(n){const s=String(n||'');let m=s.match(/(\d+(?:\.\d+)?)\s*小時/);if(m)return Math.round(parseFloat(m[1])*60);m=s.match(/(\d+)\s*分/);if(m)return parseInt(m[1],10);return 60}
async function paidLedger(db,key,now=Date.now()){
 const out={};if(typeof key!=='string'||!key||key.length>200||/[.#$\[\]\/]/.test(key))return out;
 const all=(await db.ref('peiwan/clientOrders').orderByChild('myKey').equalTo(key).once('value')).val()||{};
 for(const o of Object.values(all)){
  if(!o||o.myKey!==key||!FRAMES.some(f=>f.cid===o.staffCid))continue;
  if(o.type&&o.type!=='play')continue;
  if(o.testOnly||o.refunded||o.staffDeclined||o.status==='cancelled')continue;
  const mins=planMins(o.planName)+Math.max(0,Math.min(1440,Math.round(+o.extraMins||0)));
  let ok=o.status==='done';
  if(!ok&&o.status==='confirmed'&&o.accepted){const base=+o.servingSince||(o.booking?+o.reserveAt:0)||+o.acceptedAt||+o.createdAt||0;ok=base>0&&base+mins*60000<=now}
  if(!ok)continue;
  (out[o.staffCid]??={seconds:0}).seconds+=mins*60;
 }
 return out;
}
'''
DROP=r'''async function dropText(discord,job,order,selfId){
 if(!job.textId||job.textGone)return job;
 // 11/19 D：同一位老闆同時好幾張單（各開一組房間），大家擠在其中一間語音房，空著那組被收時把大家正在用的聊天室刪掉了
 // → 這位老闆還有別組房間沒收：聊天室先留著（記在 orphanTexts），等他最後一組房間收掉時再一起刪。
 try{
  const cid=order?.customerId,db=cfg?.db;
  if(db&&/^\d{17,20}$/.test(cid||'')){
   const vr=db.ref('orderVoiceV1');
   const others=(await vr.child('orders').orderByChild('customerId').equalTo(cid).once('value')).val()||{};
   let live=false;
   for(const oid of Object.keys(others)){
    if(oid===selfId)continue;
    const j=(await vr.child('jobs/'+oid+'/data').once('value')).val();
    if(j&&j.phase!=='deleted'&&(j.channelId||(j.textId&&!j.textGone))){live=true;break}
   }
   if(live){await vr.child('orphanTexts/'+cid+'/'+job.textId).set(Date.now());cfg.report('BOOKING_ROOM_TEXT_KEPT');return {...job,textGone:true,textKept:true}}
   const orphans=(await vr.child('orphanTexts/'+cid).once('value')).val()||{};
   for(const t of Object.keys(orphans)){
    if(/^\d{17,20}$/.test(t)&&t!==job.textId){try{await discord.deleteChannel(t)}catch(e){if(!gone(e)&&transient(e))throw e}}
    await vr.child('orphanTexts/'+cid+'/'+t).remove();
   }
  }
 }catch(e){if(transient(e))throw e;cfg?.report('BOOKING_ROOM_TEXT_KEEP_CHECK_FAILED')}
'''
R=[
 ('loyalty-frames.cjs',"module.exports={FRAMES,THRESHOLD,changeTime,recordTime,projectRewards,selectFrame};",
   LEDGER+"module.exports={FRAMES,THRESHOLD,changeTime,recordTime,projectRewards,selectFrame,paidLedger,planMins};",1),
 ('loyalty-frames.cjs',"const seconds=(await db.ref('orderVoiceV1/loyalty/'+identity.uid+'/'+frame.cid+'/seconds').once('value')).val();",
   "const mem=(await db.ref('secureV1/members/'+identity.uid).once('value')).val();const seconds=mem?.active&&mem.key?((await paidLedger(db,mem.key))[frame.cid]?.seconds||0):0; // 11/19 照買了幾小時",1),
 ('rehearsal.cjs',"const ledger=(await ref.child('loyalty/'+identity.uid).once('value')).val();",
   "const ledger=await require('./loyalty-frames.cjs').paidLedger(db,member.key); // 11/19 D：頭像框時數照買了幾小時算",1),
 ('booking-room.cjs',"async function dropText(discord,job){\n if(!job.textId||job.textGone)return job;\n",DROP,1),
 ('voice.cjs',"rooms.dropText(discord,job)","rooms.dropText(discord,job,order,id)",5),
]
files={}
for f,_,_,_ in R:
 if f not in files:
  p=os.path.join(root,f)
  if not os.path.isfile(p):print('找不到 '+f+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
  files[f]=open(p,encoding='utf-8',newline='').read().replace('\r\n','\n')
if 'paidLedger' in files['loyalty-frames.cjs']:print('已經改過，跳過');sys.exit(0)
bad=['%s（%d）'%(f,files[f].count(o)) for f,o,_,n in R if files[f].count(o)!=n]
if bad:print('程式跟預期不同：'+'、'.join(bad)+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
if mode=='check':print('可以改（%d 處）'%len(R));sys.exit(0)
for f,o,nw,n in R:files[f]=files[f].replace(o,nw)
for f,s in files.items():open(os.path.join(root,f),'w',encoding='utf-8',newline='').write(s)
print('頭像框時數改照買了幾小時、同一位老闆還有別組房間時聊天室先留著（%d 處）'%len(R))
PY
cat > /tmp/tt-fix-1119.test.cjs <<'JS'
'use strict';
// 11/19：頭像框時數照買了幾小時；同一位老闆還有別組房間時聊天室先留著
const test=require('node:test'),assert=require('node:assert/strict');
function fakeDb(data){
 const get=p=>p.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],data);
 const put=(p,v)=>{const ks=p.split('/').filter(Boolean);let o=data;ks.slice(0,-1).forEach(k=>{o=o[k]??={}});if(v===null)delete o[ks.at(-1)];else o[ks.at(-1)]=v};
 const ref=p=>({
  child:c=>ref(p+'/'+c),
  orderByChild:f=>({equalTo:v=>({once:async()=>{const all=get(p)||{},out={};for(const [k,x] of Object.entries(all))if(x&&x[f]===v)out[k]=x;return {val:()=>Object.keys(out).length?out:null}}})}),
  once:async()=>({val:()=>get(p)??null}),
  set:async v=>put(p,v),remove:async()=>put(p,null)});
 return {ref,data};
}
const LF=require('./loyalty-frames.cjs');
const RIRA='-OxY7C4vDkgsr1zcyWbk',KAB='-OxY46ezlpnRt64hUIw9';
test('頭像框時數：每張委託 1 小時＋續單，不看實際計時；取消／退款／還沒結束不算',async()=>{
 const now=Date.parse('2026-11-19T02:00:00+08:00');
 const db=fakeDb({peiwan:{clientOrders:{
  a:{myKey:'K',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'done'},                       // 1h（冒險者 40 分就按結束也算 1h）
  b:{myKey:'K',type:'play',staffCid:RIRA,planName:'Valorant',status:'done',extraMins:60},           // 2h
  c:{myKey:'K',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'confirmed',accepted:true,servingSince:now-90*60000}, // 時間過了 1h
  d:{myKey:'K',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'confirmed',accepted:true,servingSince:now-20*60000}, // 還在玩，不算
  e:{myKey:'K',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'cancelled'},
  f:{myKey:'K',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'done',refunded:true},
  g:{myKey:'K',type:'play',staffCid:KAB,planName:'今天想聊天嗎？',status:'done',extraMins:30},       // 1.5h
  h:{myKey:'OTHER',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'done'},
  i:{myKey:'K',type:'shop',staffCid:RIRA,status:'done'},
  j:{myKey:'K',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'pending'}}}});
 const L=await LF.paidLedger(db,'K',now);
 assert.equal(L[RIRA].seconds,4*3600);assert.equal(L[KAB].seconds,1.5*3600);
 const r=LF.projectRewards(L);assert.equal(r.frames.find(f=>f.cid===RIRA).seconds,4*3600);assert.equal(r.frames.find(f=>f.cid===RIRA).unlocked,false);
});
test('滿 10 小時（10 張單）解鎖',async()=>{
 const o={};for(let k=0;k<10;k++)o['x'+k]={myKey:'K',type:'play',staffCid:RIRA,planName:'休閒小遊戲',status:'done'};
 const L=await LF.paidLedger(fakeDb({peiwan:{clientOrders:o}}),'K');assert.equal(LF.projectRewards(L).frames.find(f=>f.cid===RIRA).unlocked,true);
});
test('收房：同一位老闆還有別組房間 → 聊天室留著；最後一組收掉時一起刪',async()=>{
 const rooms=require('./booking-room.cjs');rooms.reset?.();
 const CUST='111111111111111111';
 const db=fakeDb({orderVoiceV1:{orders:{o1:{customerId:CUST},o2:{customerId:CUST},o3:{customerId:'222222222222222222'}},
  jobs:{o1:{data:{textId:'900000000000000001',channelId:'800000000000000001'}},o2:{data:{textId:'900000000000000002',channelId:'800000000000000002'}}}}});
 const deleted=[];const discord={deleteChannel:async id=>{deleted.push(id)}};
 rooms.configure({db,discord,guildId:'100000000000000000',botId:'100000000000000001',categoryId:'100000000000000002'});
 const j1=await rooms.dropText(discord,{textId:'900000000000000001',channelId:'800000000000000001'},{customerId:CUST},'o1');
 assert.equal(j1.textGone,true);assert.deepEqual(deleted,[],'o2 還在 → o1 的聊天室不刪');
 assert.ok(db.data.orderVoiceV1.orphanTexts[CUST]['900000000000000001']);
 db.data.orderVoiceV1.jobs.o1.data={...j1,phase:'deleted'};
 await rooms.dropText(discord,{textId:'900000000000000002',channelId:'800000000000000002'},{customerId:CUST},'o2');
 assert.deepEqual(deleted.sort(),['900000000000000001','900000000000000002'],'最後一組收掉：兩間聊天室都刪');
 assert.equal(Object.keys(db.data.orderVoiceV1.orphanTexts?.[CUST]||{}).length,0);
});
test('收房：沒有設定資料庫時照舊直接刪',async()=>{
 const rooms=require('./booking-room.cjs');rooms.reset?.();
 const deleted=[];const discord={deleteChannel:async id=>{deleted.push(id)}};
 const j=await rooms.dropText(discord,{textId:'900000000000000009'},{customerId:'111111111111111111'},'o9');
 assert.equal(j.textGone,true);assert.deepEqual(deleted,['900000000000000009']);
});
JS
say "核對主機上的程式"
python3 /tmp/tt-hourfix-patch.py check "$SRC/order-voice-bot"
if [ -z "$R" ]; then
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE '(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)' | sort -u || true)
  echo "$PRE" | grep -qx BOOKING_ROOM_READY || { echo "目前的服務狀態不明（找不到 BOOKING_ROOM_READY），為了安全停止，正式服務沒有變動。請拍給 Claude。"; exit 1; }
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session);P3=$(code /v1/voice/accept)
  echo "重啟前：voice=$P1 rooms=$P2 accept=$P3"
fi

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
cp /tmp/tt-fix-1119.test.cjs "$DST/order-voice-bot/fix-1119.test.cjs"; chmod 644 "$DST/order-voice-bot/fix-1119.test.cjs"
python3 /tmp/tt-hourfix-patch.py apply "$DST/order-voice-bot"
rm -f /tmp/tt-hourfix-patch.py /tmp/tt-fix-1119.test.cjs
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/voice.cjs order-voice-bot/booking-room.cjs order-voice-bot/loyalty-frames.cjs order-voice-bot/rehearsal.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/fix-1119.test.cjs"
for x in order-voice-bot/booking-room.test.cjs order-voice-bot/room-stay-1111.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/booking-voice-pool.test.cjs order-voice-bot/staff-order-dm.test.cjs order-voice-bot/interview-dm.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; cd /; rm -rf "$DST"; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true

cp -p "$UNIT" "$UNIT.before-hourfix"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-hourfix" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
  a=$(code /v1/voice/session);b=$(code /v1/rooms/session);c=$(code /v1/voice/accept)
  if [ "$a" = "$P1" ] && [ "$b" = "$P2" ] && [ "$c" = "$P3" ]; then
    say "HOURFIX_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c）"
    echo "頭像框時數改成照買了幾小時算（以前的單也重算）；同一位老闆還有別組房間時，聊天室不會被刪。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
