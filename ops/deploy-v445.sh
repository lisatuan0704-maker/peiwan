#!/bin/bash
# 小小酒館後端 v445：VIP3 專屬時裝二選一（/v1/voice/vip-outfit，伺服器重新計算累積支持金額）。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261028-v445
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的程式是 v433"
sha256sum -c - <<SUMS
9d10d0fb9a65fa4dba6b7ec1d6951ae06e7b35e24824b5a98f05e2065d3d9dcb  $SRC/order-voice-bot/rehearsal.cjs
SUMS
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v445.tgz" <<'B64'
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
B64
tar xzf "$DST/v445.tgz" -C "$DST" && rm "$DST/v445.tgz"
sha256sum -c - <<SUMS
0b05162943b105f9355122402e9a6c0b0dffb99667b3214f0b5bb43d14384ae0  $DST/order-voice-bot/rehearsal.cjs
7f84f2b05e6040473a9dc8660d35e5318ef6bf0156b486c9dc11c4ca0fbaa2ab  $DST/order-voice-bot/vip-outfit.cjs
b726192ac3ab0b9a72f5e1eb8786bcff2a04e5028164acb7bd2db2c3954330e1  $DST/order-voice-bot/vip-outfit.test.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/rehearsal.cjs order-voice-bot/vip-outfit.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/vip-outfit.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v445"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v445" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  docker logs --since 2m tinytavern-service 2>&1 | grep -q '^ORDER_NOTIFY_READY$' || continue
  a=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/session || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/rooms/session || true)
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/vip-outfit || true)
  if [ "$a" = 401 ] && [ "$b" = 401 ] && [ "$c" = 401 ]; then say "V445_DEPLOYED_AND_HEALTHY"; exit 0; fi
done
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
