#!/bin/bash
# 小小酒館後端 v463：修正冒險者應徵模組未建立。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。主機需為 v462。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261028-v463
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的程式是 v462"
H=$(sha256sum "$SRC/order-voice-bot/service-server.cjs" | cut -d' ' -f1)
[ "$H" = 27e0d6133fd48d08b70d43d2a36181f18357c53416396456c7bfbbc1022f2981 ] || { echo "主機上的 service-server.cjs 不是 v462（$H），停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v463.tgz" <<'B64'
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
C/8Cqe1JjwBQAAA=
B64
tar xzf "$DST/v463.tgz" -C "$DST" && rm "$DST/v463.tgz"
sha256sum -c - <<SUMS
91e2dcfc2ace7b5901da36c8d671377c941cc78f5b7e271779d42c3b8c8d85bf  $DST/order-voice-bot/service-server.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/recruit-desk.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/recruit-desk.test.cjs order-voice-bot/member-lounge.test.cjs order-voice-bot/guide-channel.test.cjs order-voice-bot/server-layout.test.cjs order-voice-bot/member-roles.test.cjs order-voice-bot/counter-desk.test.cjs order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/vip-outfit.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v463"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v463" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
  echo "$L" | grep -q '^RECRUIT_STARTED$' || continue
  a=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/session || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/rooms/session || true)
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/vip-outfit || true)
  if [ "$a" = 401 ] && [ "$b" = 401 ] && [ "$c" = 401 ]; then
    say "V463_DEPLOYED_AND_HEALTHY"
    sleep 20; echo "機器人狀態："; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^(RECRUIT_|GUIDE_|ROLES_|COUNTER_)' | grep -v STARTED | tail -14
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
