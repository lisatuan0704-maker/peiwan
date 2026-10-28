#!/bin/bash
# 小小酒館後端 v458：客人頻道（大廳閒聊、組隊揪揪、揪團佈告欄等）原本私人也開給旅人；酒館指南頻道導覽改為酒館居民。
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
XJWrcv3O1/8A/jLnsgB4AAA=
B64
tar xzf "$DST/v458.tgz" -C "$DST" && rm "$DST/v458.tgz"
sha256sum -c - <<SUMS
4ee4b26068ac9b07c596a83efd41815c600f7596dab57dc7b72235ac3bb71e35  $DST/order-voice-bot/server-layout.cjs
253a9f822dc3a166005fc7d611a0fa0a508539722b0a806e2eddbe1752905793  $DST/order-voice-bot/server-layout.test.cjs
b1e8afb5eb50b3bf70d070b195f351dd3f98e6e7098100622a2d7c3ea20d820e  $DST/order-voice-bot/guide-channel.cjs
742ad9122355bd703a829051145d9ab10b8cd93c6d0a5b89d0d047d392f7e6fb  $DST/order-voice-bot/guide-channel.test.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/server-layout.cjs order-voice-bot/guide-channel.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
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
