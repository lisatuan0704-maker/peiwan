#!/bin/bash
# 小小酒館後端 v445：VIP3 專屬時裝二選一（/v1/voice/vip-outfit，伺服器重新計算累積支持金額）。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261028-v445b
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
8985db3631fdc8b6e9662ab18d12015c65f6c9ec2443d1d144ccd3a7d4c3ce90  $SRC/secure-social-v295/server.cjs
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
ca3b2b6577a503856f22471fd2700bb62a749dabede9fd90867ca9b939ecf0b9  $DST/secure-social-v295/server.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/rehearsal.cjs order-voice-bot/vip-outfit.cjs secure-social-v295/server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
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
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
