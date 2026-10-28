#!/bin/bash
# 小小酒館後端 v462：冒險者應徵頻道（表單＋私人房間）。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。主機需為 v458。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261028-v462
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的程式是 v458"
H=$(sha256sum "$SRC/order-voice-bot/service-server.cjs" | cut -d' ' -f1)
[ "$H" = 5bd29db323b4db17a52d61975b938825316f5b5bcba0a5a1f2e129d33b8fa40e ] || { echo "主機上的 service-server.cjs 不是 v458（$H），停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v462.tgz" <<'B64'
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
B64
tar xzf "$DST/v462.tgz" -C "$DST" && rm "$DST/v462.tgz"
sha256sum -c - <<SUMS
61b64ea9e202324b0a74dc1e8f6f45897910141d681b9fdc7393dcd3b2963af9  $DST/order-voice-bot/recruit-desk.cjs
e6fc86a1977a463125412303a0e157b65f3b08cb121df344f0a1dafb9c860613  $DST/order-voice-bot/recruit-desk.test.cjs
27e0d6133fd48d08b70d43d2a36181f18357c53416396456c7bfbbc1022f2981  $DST/order-voice-bot/service-server.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/recruit-desk.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/recruit-desk.test.cjs order-voice-bot/member-lounge.test.cjs order-voice-bot/guide-channel.test.cjs order-voice-bot/server-layout.test.cjs order-voice-bot/member-roles.test.cjs order-voice-bot/counter-desk.test.cjs order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/vip-outfit.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v462"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v462" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "V462_DEPLOYED_AND_HEALTHY"
    sleep 15; echo "機器人狀態："; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^(RECRUIT_|GUIDE_|ROLES_|COUNTER_)' | grep -v STARTED | tail -14
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
