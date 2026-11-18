#!/bin/bash
# 小小酒館後端 11/19：收掉冒險者招募（D「這個幫我刪掉」）。
# TT 原本每小時檢查「冒險者應徵」頻道與招募貼文，被刪就重建重貼 → 改成不再建立／補發（recruit-desk.cjs ensurePanel 直接返回）。
# 已開的應徵小房間、裡面的「結束應徵」照舊。部署完店長自己在 Discord 刪頻道。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261119-recruitoff
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '
== %s
' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
F=order-voice-bot/recruit-desk.cjs
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
if grep -q 'RECRUIT_OFF_1119' "$SRC/$F"; then echo "已經部署過了，不用再貼。"; exit 0; fi
[ ! -e "$DST" ] || { echo "$DST 已經存在，停止。請拍給 Claude。"; exit 1; }
N=$(grep -c 'async function ensurePanel(){' "$SRC/$F" || true)
[ "$N" = "1" ] || { echo "招募程式跟預期不同（$N），為了安全停止，沒有任何變動。請拍給 Claude。"; exit 1; }
if [ -z "$R" ]; then
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE '(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)' | sort -u || true)
  echo "$PRE" | grep -qx BOOKING_ROOM_READY || { echo "目前的服務狀態不明（找不到 BOOKING_ROOM_READY），為了安全停止，正式服務沒有變動。請拍給 Claude。"; exit 1; }
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session);P3=$(code /v1/voice/accept)
  echo "重啟前：voice=$P1 rooms=$P2 accept=$P3"
fi

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
sed -i 's|async function ensurePanel(){|async function ensurePanel(){return null; // RECRUIT_OFF_1119 D 11/19：招募收掉，不再建立頻道／補發貼文|' "$DST/$F"
grep -q 'RECRUIT_OFF_1119' "$DST/$F" || { rm -rf "$DST"; echo "修改失敗，正式服務沒有變動。"; exit 1; }
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in $F order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG -e "const d=require('./order-voice-bot/recruit-desk.cjs').createRecruitDesk({db:{ref:()=>({child:()=>({})})},discord:{request:async()=>{throw Error('不該呼叫 Discord')}},guildId:'100000000000000000',report:()=>{}});d.ensurePanel().then(v=>{if(v!==null)process.exit(1);console.log('RECRUIT_OFF_OK')})" || { cd /; rm -rf "$DST"; echo "檢查失敗，正式服務沒有變動。"; exit 1; }

cp -p "$UNIT" "$UNIT.before-recruitoff"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-recruitoff" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "RECRUITOFF_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c）"
    echo "TT 不會再建立「冒險者應徵」頻道和招募貼文了，現在可以手動把頻道刪掉。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
