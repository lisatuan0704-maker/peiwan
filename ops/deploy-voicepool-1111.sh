#!/bin/bash
# 小小酒館後端：隨機單（不指定）的「確認語音」按了沒反應（D 11/11「這個問題怎麼又來了，可以好好排修嗎」）
# 原因：老闆選「不指定」點單時還沒有冒險者，語音登記被拒（ORDER_NOT_ELIGIBLE）；冒險者接走後沒有人重新登記，
#       冒險者按確認語音一直拿到 CUSTOMER_BINDING_PENDING（手札默默重試，畫面沒反應）。
# 修法：booking-voice.cjs 的確認（/v1/voice/accept）找不到語音登記時，先確認按的人就是接這張單的冒險者，
#       再由主機替老闆補登記（同一組要每張都有人接，否則回 GROUP_NOT_READY），然後照原本流程確認。其他流程不變。
# 只在 booking-voice.cjs 插一段（找不到插入點就停止）＋新增測試。在主機的 root 終端機執行。
# 任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261111-voicepool
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
cat > /tmp/tt-voicepool-patch.py <<'PY'
import sys
# 11/11 D「隨機單（不指定）的確認語音按了沒反應」：booking-voice.cjs approveOrder 在找不到語音登記時，由主機替老闆補登記再確認。
# 只在 approveOrder 的 transaction 前面插一段；找不到插入點（程式跟預期不同）就停止，什麼都不改。
mode,p=sys.argv[1],sys.argv[2]
s=open(p,encoding='utf-8',newline='').read()
if 'GROUP_NOT_READY' in s:
    print('booking-voice.cjs 已經改過，跳過');sys.exit(0)
anchor=" const ref=db.ref('orderVoiceV1');let result;\n const tx=await ref.transaction(s=>{if(s===null)return null;try{const id=s.sourceIndex?.[body.orderId],o=s.orders?.[id];if(!o)fault('CUSTOMER_BINDING_PENDING',409);"
need=["async function approveOrder({db,identity,body,now=Date.now()}){","async function registerOrder({db,identity,body,now=Date.now()}){"]
if s.count(anchor)!=1 or any(s.count(x)!=1 for x in need):
    print('booking-voice.cjs 跟預期不同（插入點 %d），為了安全停止，沒有任何變動。請拍給 Claude。'%s.count(anchor));sys.exit(1)
if mode=='check':
    print('booking-voice.cjs 可以改');sys.exit(0)
add=(" // 11/11 D「隨機單的確認語音按了沒反應」：老闆選「不指定」的單，點單時還沒有冒險者，語音登記被拒（ORDER_NOT_ELIGIBLE），\n"
" // 冒險者接走之後也沒有人重新登記 → 冒險者按確認一直拿到 CUSTOMER_BINDING_PENDING。現在先確認按的人就是接這張單的冒險者，再由主機替老闆補登記。\n"
" if(!(await db.ref('orderVoiceV1/sourceIndex/'+body.orderId).once('value')).val()){\n"
"  const cid=legacy.staffCid,acc=(await db.ref('orderVoiceV1/staffAccounts/'+cid).once('value')).val(),bind=(await db.ref('orderVoiceV1/staffBindings/'+cid).once('value')).val();\n"
"  if(!acc?.active||acc.authUid!==identity.uid||!bind?.verified||bind.authUid!==identity.uid)fault('STAFF_ACCESS_DENIED');\n"
"  const owner=(await db.ref('secureV1/owners/'+legacy.myKey).once('value')).val();\n"
"  if(typeof owner!=='string'||!/^discord_\\d{17,20}$/.test(owner))fault('CUSTOMER_BINDING_PENDING',409);\n"
"  let ids=[body.orderId];\n"
"  if(legacy.groupId&&(legacy.groupSize||1)>1){   // 同一組（一次點好幾位）：錢包付款看 walletTx 的 orderIds，轉帳付款用 groupId 找\n"
"   const tx0=(await db.ref('peiwan/walletTx/'+legacy.myKey+'/'+legacy.groupId+'/orderIds').once('value')).val();\n"
"   if(Array.isArray(tx0)&&tx0.length)ids=tx0.filter(x=>typeof x==='string');\n"
"   else{const g=(await db.ref('peiwan/clientOrders').orderByChild('groupId').equalTo(legacy.groupId).once('value')).val()||{};ids=Object.keys(g).filter(k=>g[k]&&g[k].myKey===legacy.myKey);}\n"
"  }\n"
"  try{await registerOrder({db,identity:{uid:owner},body:{ids},now});}\n"
"  catch(e){if(e.code==='ORDER_NOT_ELIGIBLE'||e.code==='ORDER_GROUP_MISMATCH')fault('GROUP_NOT_READY',409);if(e.code!=='ORDER_ALREADY_LINKED')throw e;}\n"
" }\n")
s=s.replace(anchor,add+anchor)
open(p,'w',encoding='utf-8',newline='').write(s)
print('booking-voice.cjs：隨機單由主機替老闆補登記語音')
PY
say "核對主機上的語音登記程式"
python3 /tmp/tt-voicepool-patch.py check "$SRC/order-voice-bot/booking-voice.cjs"
if [ -z "$R" ]; then
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE '(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)' | sort -u || true)
  echo "$PRE" | grep -qx ORDER_NOTIFY_READY || { echo "目前的服務狀態不明（找不到 ORDER_NOTIFY_READY），為了安全停止，正式服務沒有變動。請拍給 Claude。"; exit 1; }
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session);P3=$(code /v1/voice/accept)
  echo "重啟前：voice=$P1 rooms=$P2 accept=$P3"
fi

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/voicepool.tgz" <<'B64'
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
B64
tar xzf "$DST/voicepool.tgz" -C "$DST" && rm "$DST/voicepool.tgz"
sha256sum -c - <<SUMS
a728896c908f0ee16f9d4b0e96641ea4ff2ad756e175bc6edf4c549cc7289726  $DST/order-voice-bot/booking-voice-pool.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/booking-voice-pool.test.cjs
python3 /tmp/tt-voicepool-patch.py apply "$DST/order-voice-bot/booking-voice.cjs"
rm -f /tmp/tt-voicepool-patch.py
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/booking-voice.cjs order-voice-bot/rehearsal.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/booking-voice-pool.test.cjs"
for x in order-voice-bot/notify-split-1111.test.cjs order-voice-bot/notify-oen-v498b.test.cjs order-voice-bot/booking-room.test.cjs order-voice-bot/staff-order-dm.test.cjs order-voice-bot/voice-open.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; cd /; rm -rf "$DST"; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true

cp -p "$UNIT" "$UNIT.before-voicepool"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-voicepool" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "VOICEPOOL_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c）"
    echo "冒險者在手札重新整理後，再按一次「確認這筆訂單的語音」就可以了。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
