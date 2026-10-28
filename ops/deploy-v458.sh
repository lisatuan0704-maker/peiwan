#!/bin/bash
# 小小酒館後端 v458：客人頻道（大廳閒聊、組隊揪揪、揪團佈告欄等）原本私人也開給旅人。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。主機需為 v457。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261028-v458
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的程式是 v457"
H=$(sha256sum "$SRC/order-voice-bot/service-server.cjs" | cut -d' ' -f1)
[ "$H" = 3beaf9dde3f946b1516ffff212af2273a066ccf0a3916c4ff2436a468c9682b5 ] || { echo "主機上的 service-server.cjs 不是 v457（$H），停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v458.tgz" <<'B64'
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
B64
tar xzf "$DST/v458.tgz" -C "$DST" && rm "$DST/v458.tgz"
sha256sum -c - <<SUMS
4ee4b26068ac9b07c596a83efd41815c600f7596dab57dc7b72235ac3bb71e35  $DST/order-voice-bot/server-layout.cjs
253a9f822dc3a166005fc7d611a0fa0a508539722b0a806e2eddbe1752905793  $DST/order-voice-bot/server-layout.test.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/server-layout.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/guide-channel.test.cjs order-voice-bot/server-layout.test.cjs order-voice-bot/member-roles.test.cjs order-voice-bot/counter-desk.test.cjs order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/vip-outfit.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v458"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v458" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1)
  echo "$L" | grep -q '^ORDER_NOTIFY_READY$' || continue
  echo "$L" | grep -q '^ROLES_STARTED$' || continue
  echo "$L" | grep -q '^COUNTER_STARTED$' || continue
  a=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/session || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/rooms/session || true)
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/vip-outfit || true)
  if [ "$a" = 401 ] && [ "$b" = 401 ] && [ "$c" = 401 ]; then
    say "V458_DEPLOYED_AND_HEALTHY"
    sleep 15; echo "機器人狀態："; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^(LAYOUT_|GUIDE_|ROLES_|COUNTER_)' | grep -v STARTED | tail -10
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
