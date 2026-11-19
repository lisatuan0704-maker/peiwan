#!/bin/bash
# 小小酒館後端 11/20（老闆反應：冒險者角色框顯示已擁有，點了卻跳「尚未完成解鎖或儲存失敗」）：
#  戴角色框（/v1/voice/frame → loyalty-frames.cjs selectFrame）以前要 secureV1/characters/<闆卡> 存在，
#  這格只有私人房註冊才有，網站登入的老闆都沒有 → 一律失敗。改成確認大廳有這張闆卡；
#  secureV1/characters/<闆卡> 沒有就只建 pub.frm 這一格（資料庫規則要比對），其他欄位不動。
# 在主機的 root 終端機執行。找不到插入點就停止；測試失敗不會換版；健康檢查失敗自動還原舊版。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261120-framefix
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
if grep -q '11/20 闆卡要在' "$SRC/order-voice-bot/loyalty-frames.cjs"; then echo "已經部署過了，不用再貼。"; exit 0; fi
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能上次做到一半），停止。請拍給 Claude。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
cat > /tmp/tt-framefix-patch.py <<'PY'
import os,sys
# 11/20 老闆反應：冒險者角色框（縭／蕪／桃）顯示「已擁有」，點了卻跳「尚未完成解鎖或儲存失敗」。
# 原因：selectFrame 要 secureV1/characters/<闆卡> 存在才肯戴，但這格只有「私人房註冊」才會建立；
#       網站登入（Discord 綁定）的老闆只有 members／owners，沒有 characters → 一律 ACCOUNT_REQUIRED，角色框從來戴不上。
# 修法：改成確認 peiwan/lobby/<闆卡>/name 有這張闆卡；secureV1/characters/<闆卡> 沒有就只建 pub.frm 這一格
#       （資料庫規則要拿 lobby pub.frm 跟這格比對，大廳之後發佈名牌才不會被拒），已經有的不動其他欄位。
# 每個插入點都先核對「剛好出現一次」，有一個對不上就整個停止，什麼都不改。
mode,root=sys.argv[1],sys.argv[2]
R=[
 ('loyalty-frames.cjs',
  " if(!Number.isSafeInteger(seconds)||seconds<THRESHOLD)fail('FRAME_LOCKED');\n",
  " if(!Number.isSafeInteger(seconds)||seconds<THRESHOLD)fail('FRAME_LOCKED');\n"
  " const nm=(await db.ref('peiwan/lobby/'+mem.key+'/name').once('value')).val();if(typeof nm!=='string'||!nm.trim())fail('ACCOUNT_REQUIRED'); // 11/20 闆卡要在\n",1),
 ('loyalty-frames.cjs',
  "  if(!member?.active||!member.key||state.owners?.[member.key]!==identity.uid||!state.characters?.[member.key]){error=true;return undefined}\n"
  "  key=member.key;const next=structuredClone(state);next.characters[key].pub??={};next.characters[key].pub.frm=frame.id;return next;\n",
  "  if(!member?.active||!member.key||member.key!==mem.key||state.owners?.[member.key]!==identity.uid){error=true;return undefined}\n"
  "  // 11/20：網站登入的老闆沒有 secureV1/characters/<闆卡>（只有私人房註冊才有）→ 沒有就只建 pub.frm 這一格\n"
  "  key=member.key;const next=structuredClone(state);next.characters??={};next.characters[key]??={};next.characters[key].pub??={};next.characters[key].pub.frm=frame.id;return next;\n",1),
]
files={}
for f,_,_,_ in R:
 if f not in files:
  p=os.path.join(root,f)
  if not os.path.isfile(p):print('找不到 '+f+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
  files[f]=open(p,encoding='utf-8',newline='').read().replace('\r\n','\n')
if '11/20 闆卡要在' in files['loyalty-frames.cjs']:print('已經改過，跳過');sys.exit(0)
if 'paidLedger' not in files['loyalty-frames.cjs'] or "const mem=(await db.ref('secureV1/members/'+identity.uid)" not in files['loyalty-frames.cjs']:
 print('主機還沒有 11/19 的頭像框時數修正（hourfix），為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
bad=['%s（%d）'%(f,files[f].count(o)) for f,o,_,n in R if files[f].count(o)!=n]
if bad:print('程式跟預期不同：'+'、'.join(bad)+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
if mode=='check':print('可以改（%d 處）'%len(R));sys.exit(0)
for f,o,nw,n in R:files[f]=files[f].replace(o,nw)
for f,s in files.items():open(os.path.join(root,f),'w',encoding='utf-8',newline='').write(s)
print('冒險者角色框：網站登入的老闆也戴得上（%d 處）'%len(R))
PY
cat > /tmp/tt-frame-1120.test.cjs <<'JS'
'use strict';
// 11/20：網站登入的老闆（沒有 secureV1/characters）也戴得上冒險者角色框
const test=require('node:test'),assert=require('node:assert/strict');
function fakeDb(data){
 const get=p=>p.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],data);
 const put=(p,v)=>{const ks=p.split('/').filter(Boolean);let o=data;ks.slice(0,-1).forEach(k=>{o=o[k]??={}});if(v===null)delete o[ks.at(-1)];else o[ks.at(-1)]=v};
 const ref=p=>({
  child:c=>ref(p+'/'+c),
  orderByChild:f=>({equalTo:v=>({once:async()=>{const all=get(p)||{},out={};for(const [k,x] of Object.entries(all))if(x&&x[f]===v)out[k]=x;return {val:()=>Object.keys(out).length?out:null}}})}),
  once:async()=>({val:()=>get(p)??null}),
  set:async v=>put(p,v),remove:async()=>put(p,null),
  transaction:async fn=>{const cur=get(p);const nv=fn(cur===undefined?null:structuredClone(cur));if(nv===undefined)return {committed:false};put(p,nv);return {committed:true}}});
 return {ref,data};
}
const LF=require('./loyalty-frames.cjs');
const RIRA='-OxY7C4vDkgsr1zcyWbk',KAB='-OxY46ezlpnRt64hUIw9';
const UID='discord_123456789012345678';
const tenHours=(key,cid)=>{const o={};for(let k=0;k<10;k++)o['x'+k]={myKey:key,type:'play',staffCid:cid,planName:'休閒小遊戲',status:'done'};return o};
const base=(extra={})=>({secureV1:{members:{[UID]:{active:true,key:'K'}},owners:{K:UID},...extra},
  peiwan:{lobby:{K:{name:'羊',pub:{frm:'vip2'}}},clientOrders:tenHours('K',RIRA)}});
const call=(db,frameId,uid=UID)=>LF.selectFrame({db,identity:{uid},body:{frameId}});
test('網站登入的老闆（沒有 secureV1/characters）滿 10 小時：戴得上，只建 pub.frm',async()=>{
 const db=fakeDb(base({characters:{OTHER:{name:'別人',doll:{x:1}}}}));
 const r=await call(db,'companion_rira');
 assert.deepEqual(r,{frameId:'companion_rira',key:'K'});
 assert.deepEqual(db.data.secureV1.characters.K,{pub:{frm:'companion_rira'}});
 assert.deepEqual(db.data.secureV1.characters.OTHER,{name:'別人',doll:{x:1}});
 assert.equal(db.data.peiwan.lobby.K.pub.frm,'companion_rira');
 assert.deepEqual(db.data.secureV1.members[UID],{active:true,key:'K'});
});
test('連 characters 整個節點都沒有也可以',async()=>{
 const db=fakeDb(base());
 await call(db,'companion_rira');
 assert.equal(db.data.secureV1.characters.K.pub.frm,'companion_rira');
});
test('已經有 characters 的老闆：其他欄位不動',async()=>{
 const db=fakeDb(base({characters:{K:{name:'羊',doll:{front:2},pub:{frm:'companion_kabuki',x:1},_profileRevision:3}}}));
 await call(db,'companion_rira');
 assert.deepEqual(db.data.secureV1.characters.K,{name:'羊',doll:{front:2},pub:{frm:'companion_rira',x:1},_profileRevision:3});
});
test('時數不夠：FRAME_LOCKED，什麼都不寫',async()=>{
 const db=fakeDb(base());
 await assert.rejects(call(db,'companion_kabuki'),e=>e.code==='FRAME_LOCKED');
 assert.equal(db.data.secureV1.characters,undefined);
 assert.equal(db.data.peiwan.lobby.K.pub.frm,'vip2');
});
test('闆卡不在（被刪）：ACCOUNT_REQUIRED，什麼都不寫',async()=>{
 const d=base();delete d.peiwan.lobby.K;const db=fakeDb(d);
 await assert.rejects(call(db,'companion_rira'),e=>e.code==='ACCOUNT_REQUIRED');
 assert.equal(db.data.secureV1.characters,undefined);
});
test('owners 不是本人／帳號停用：ACCOUNT_REQUIRED',async()=>{
 const d=base();d.secureV1.owners.K='discord_999999999999999999';const db=fakeDb(d);
 await assert.rejects(call(db,'companion_rira'),e=>e.code==='ACCOUNT_REQUIRED');
 assert.equal(db.data.secureV1.characters,undefined);
 const d2=base();d2.secureV1.members[UID].active=false;const db2=fakeDb(d2);
 await assert.rejects(call(db2,'companion_rira'),e=>e.code==='FRAME_LOCKED'||e.code==='ACCOUNT_REQUIRED');
 assert.equal(db2.data.secureV1.characters,undefined);
});
test('不是角色框的 id：INVALID_REQUEST',async()=>{
 await assert.rejects(call(fakeDb(base()),'vip5'),e=>e.code==='INVALID_REQUEST');
});
JS
say "核對主機上的程式"
python3 /tmp/tt-framefix-patch.py check "$SRC/order-voice-bot"
if [ -z "$R" ]; then
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE '(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)' | sort -u || true)
  echo "$PRE" | grep -qx BOOKING_ROOM_READY || { echo "目前的服務狀態不明（找不到 BOOKING_ROOM_READY），為了安全停止，正式服務沒有變動。請拍給 Claude。"; exit 1; }
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session);P3=$(code /v1/voice/accept)
  echo "重啟前：voice=$P1 rooms=$P2 accept=$P3"
fi

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
cp /tmp/tt-frame-1120.test.cjs "$DST/order-voice-bot/frame-1120.test.cjs"; chmod 644 "$DST/order-voice-bot/frame-1120.test.cjs"
python3 /tmp/tt-framefix-patch.py apply "$DST/order-voice-bot"
rm -f /tmp/tt-framefix-patch.py /tmp/tt-frame-1120.test.cjs
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/loyalty-frames.cjs order-voice-bot/rehearsal.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/frame-1120.test.cjs"
for x in order-voice-bot/fix-1119.test.cjs order-voice-bot/booking-room.test.cjs order-voice-bot/room-stay-1111.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/booking-voice-pool.test.cjs order-voice-bot/staff-order-dm.test.cjs order-voice-bot/interview-dm.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; cd /; rm -rf "$DST"; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true

cp -p "$UNIT" "$UNIT.before-framefix"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-framefix" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "FRAMEFIX_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c）"
    echo "冒險者角色框（縭／蕪／桃）現在網站登入的老闆也戴得上了，請老闆重新整理後再點一次。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
