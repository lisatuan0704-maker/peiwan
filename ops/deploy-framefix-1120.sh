#!/bin/bash
# 小小酒館後端 11/20（D「又壞了啦」）：冒險者頭像框顯示「已擁有」，按下去卻跳「尚未完成解鎖或儲存失敗，請稍後重試」。
#  原因：戴框時要求 secureV1/characters/<闆卡> 存在，開店後做的闆卡都沒有 → ACCOUNT_REQUIRED（11/19 時數改照買的小時後才有人解鎖，才踩到）。
#  改成：本人＋闆卡擁有者對得上、大廳有這張闆卡就能戴；secureV1/characters 有這張才順便記（loyalty-frames.cjs 一處）。
#  要先裝過 11/19 hourfix（沒裝會停止，不改任何東西）。
# 在主機的 root 終端機執行。找不到插入點就停止；測試失敗不會換版；健康檢查失敗自動還原舊版。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261120-framefix
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '
== %s
' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
if grep -q FRAMEFIX_1120 "$SRC/order-voice-bot/loyalty-frames.cjs"; then echo "已經部署過了，不用再貼。"; exit 0; fi
grep -q paidLedger "$SRC/order-voice-bot/loyalty-frames.cjs" || { echo "主機還沒裝 11/19 的頭像框時數修正（hourfix），為了安全停止，沒有任何變動。請拍給 Claude。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能上次做到一半），停止。請拍給 Claude。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
cat > /tmp/tt-framefix-patch.py <<'PY'
import os,sys
# 11/20 D「又壞了啦」：冒險者頭像框顯示「已擁有」，按下去卻跳「尚未完成解鎖或儲存失敗」。
# 原因：selectFrame 在整個 secureV1 交易裡要求 secureV1/characters/<闆卡> 存在，開店後做的闆卡都沒有這份（網站不會寫）
#      → 回 ACCOUNT_REQUIRED。11/19 時數改成照買了幾小時後才真的有人解鎖，才踩到。
# 改成：本人、闆卡擁有者對得上，而且大廳真的有這張闆卡（或 secureV1/characters 有）就可以戴；
#      secureV1/characters 有這張才順便記在那裡（資料庫規則讀它），沒有就不新建（私人房的衣櫃／資料會把它當成已建好的角色）。
#      也不再對整個 secureV1 做交易（人多時又慢又容易衝突）。
# 每個插入點都先核對「剛好出現一次」，對不上就整個停止，什麼都不改。
mode,root=sys.argv[1],sys.argv[2]
OLD=r'''let key,error;const tx=await db.ref('secureV1').transaction(state=>{
  if(state===null)return null;const member=state.members?.[identity.uid];
  if(!member?.active||!member.key||state.owners?.[member.key]!==identity.uid||!state.characters?.[member.key]){error=true;return undefined}
  key=member.key;const next=structuredClone(state);next.characters[key].pub??={};next.characters[key].pub.frm=frame.id;return next;
 },undefined,false);
 if(error||!tx.committed||!key)fail('ACCOUNT_REQUIRED');
'''
NEW=r'''// FRAMEFIX_1120：開店後做的闆卡沒有 secureV1/characters → 以前整筆被擋（ACCOUNT_REQUIRED）。改成看大廳的闆卡；secureV1/characters 有才順便記。
 const key=mem?.active&&typeof mem.key==='string'&&mem.key&&mem.key.length<=200&&!/[.#$\[\]\/]/.test(mem.key)?mem.key:null;
 if(!key||(await db.ref('secureV1/owners/'+key).once('value')).val()!==identity.uid)fail('ACCOUNT_REQUIRED');
 const charRef=db.ref('secureV1/characters/'+key);
 const [hasChar,lobbyName]=await Promise.all([charRef.once('value').then(s=>s.exists()),db.ref('peiwan/lobby/'+key+'/name').once('value').then(s=>s.val())]);
 if(!hasChar&&!(typeof lobbyName==='string'&&lobbyName.trim()))fail('ACCOUNT_REQUIRED');
 if(hasChar)await charRef.child('pub/frm').set(frame.id);
'''
f='loyalty-frames.cjs'
p=os.path.join(root,f)
if not os.path.isfile(p):print('找不到 '+f+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
s=open(p,encoding='utf-8',newline='').read().replace('\r\n','\n')
if 'FRAMEFIX_1120' in s:print('已經改過，跳過');sys.exit(0)
if 'paidLedger' not in s or "const mem=(await db.ref('secureV1/members/'+identity.uid).once('value')).val();" not in s:
  print('主機還沒裝 11/19 的頭像框時數修正（hourfix），這支是接在它後面的，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
if s.count(OLD)!=1:print('程式跟預期不同（%d），為了安全停止，沒有任何變動。請拍給 Claude。'%s.count(OLD));sys.exit(1)
if mode=='check':print('可以改（1 處）');sys.exit(0)
s=s.replace(OLD,NEW)
open(p,'w',encoding='utf-8',newline='').write(s)
print('冒險者頭像框：沒有 secureV1 角色資料的闆卡也能戴上（1 處）')
PY
cat > /tmp/tt-framefix-1120.test.cjs <<'JS'
'use strict';
// 11/20：冒險者頭像框——開店後做的闆卡（沒有 secureV1/characters）也能戴上
const test=require('node:test'),assert=require('node:assert/strict');
function fakeDb(data){
 const get=p=>p.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],data);
 const put=(p,v)=>{const ks=p.split('/').filter(Boolean);let o=data;ks.slice(0,-1).forEach(k=>{o=o[k]??={}});if(v===null)delete o[ks.at(-1)];else o[ks.at(-1)]=v};
 const snap=p=>({val:()=>get(p)??null,exists:()=>get(p)!=null});
 const ref=p=>({
  child:c=>ref(p+'/'+c),
  orderByChild:f=>({equalTo:v=>({once:async()=>{const all=get(p)||{},out={};for(const [k,x] of Object.entries(all))if(x&&x[f]===v)out[k]=x;return {val:()=>Object.keys(out).length?out:null}}})}),
  once:async()=>snap(p),
  set:async v=>put(p,v),remove:async()=>put(p,null),
  transaction:async()=>{throw Error('不應該再對整個 secureV1 做交易')}});
 return {ref,data};
}
const LF=require('./loyalty-frames.cjs');
const RIRA='-OxY7C4vDkgsr1zcyWbk',UID='discord_123456789012345678',KEY='Abc_def-1';
const tenHours=()=>{const o={};for(let k=0;k<10;k++)o['x'+k]={myKey:KEY,type:'play',staffCid:RIRA,planName:'休閒遊戲・一小時',status:'done'};return o;};
const base=extra=>Object.assign({secureV1:{members:{[UID]:{active:true,key:KEY}},owners:{[KEY]:UID}},peiwan:{clientOrders:tenHours(),lobby:{[KEY]:{name:'測試老闆',pub:{}}}}},extra||{});
const call=(db,frameId='companion_rira',uid=UID)=>LF.selectFrame({db,identity:{uid},body:{frameId}});
const code=async p=>{try{await p;return 'OK'}catch(e){return e.code||e.message}};

test('沒有 secureV1/characters 的闆卡：滿 10 小時可以戴，寫進大廳 pub.frm，不新建角色資料',async()=>{
 const db=fakeDb(base());
 const r=await call(db);
 assert.deepEqual(r,{frameId:'companion_rira',key:KEY});
 assert.equal(db.data.peiwan.lobby[KEY].pub.frm,'companion_rira');
 assert.equal(db.data.secureV1.characters,undefined);
});
test('有 secureV1/characters 的闆卡：兩邊都記（資料庫規則讀那邊）',async()=>{
 const d=base();d.secureV1.characters={[KEY]:{name:'測試老闆'}};const db=fakeDb(d);
 await call(db);
 assert.equal(db.data.secureV1.characters[KEY].pub.frm,'companion_rira');
 assert.equal(db.data.secureV1.characters[KEY].name,'測試老闆');
 assert.equal(db.data.peiwan.lobby[KEY].pub.frm,'companion_rira');
});
test('還沒滿 10 小時：FRAME_LOCKED，什麼都不寫',async()=>{
 const d=base();delete d.peiwan.clientOrders.x9;const db=fakeDb(d);
 assert.equal(await code(call(db)),'FRAME_LOCKED');assert.equal(db.data.peiwan.lobby[KEY].pub.frm,undefined);
});
test('別人的帳號、擁有者對不上、沒有綁定、闆卡不存在：ACCOUNT_REQUIRED',async()=>{
 let d=base();d.secureV1.owners[KEY]='discord_999999999999999999';assert.equal(await code(call(fakeDb(d))),'ACCOUNT_REQUIRED');
 d=base();d.secureV1.members[UID].active=false;assert.equal(await code(call(fakeDb(d))),'FRAME_LOCKED');
 d=base();delete d.peiwan.lobby[KEY];const db=fakeDb(d);assert.equal(await code(call(db)),'ACCOUNT_REQUIRED');assert.equal(db.data.peiwan.lobby?.[KEY],undefined);
 d=base();d.secureV1.members[UID].key='bad/key';d.secureV1.owners['bad/key']=UID;assert.notEqual(await code(call(fakeDb(d))),'OK');
});
test('不存在的框、多帶欄位、不是 Discord 登入：INVALID_REQUEST',async()=>{
 assert.equal(await code(call(fakeDb(base()),'companion_xx')),'INVALID_REQUEST');
 assert.equal(await code(LF.selectFrame({db:fakeDb(base()),identity:{uid:UID},body:{frameId:'companion_rira',x:1}})),'INVALID_REQUEST');
 assert.equal(await code(call(fakeDb(base()),'companion_rira','password_abc')),'INVALID_REQUEST');
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
cp /tmp/tt-framefix-1120.test.cjs "$DST/order-voice-bot/framefix-1120.test.cjs"; chmod 644 "$DST/order-voice-bot/framefix-1120.test.cjs"
python3 /tmp/tt-framefix-patch.py apply "$DST/order-voice-bot"
rm -f /tmp/tt-framefix-patch.py /tmp/tt-framefix-1120.test.cjs
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/loyalty-frames.cjs order-voice-bot/rehearsal.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/framefix-1120.test.cjs"
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
    echo "冒險者頭像框修好了：解鎖的老闆可以直接戴上。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
