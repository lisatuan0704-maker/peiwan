#!/bin/bash
# 小小酒館後端 v428：Discord 登入綁定闆卡（/v1/voice/session）＋伺服器發送訂單通知。
# 在主機的 root 終端機整段貼上執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261027-v428
UNIT=$R/etc/systemd/system/tinytavern-service.service
ENVF=$R/etc/tinytavern/service.env
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
grep -q '/etc/tinytavern/service.env' "$UNIT" || { echo "服務設定沒有使用 /etc/tinytavern/service.env，停止（需要人工確認）。"; exit 1; }
say "核對主機上的程式和修改基礎版本一致"
sha256sum -c - <<SUMS
5910c345c121bf7e0bfabd542720ab18cd7cf60a60eea1356996c8ff9ed07c0a  $SRC/order-voice-bot/rehearsal.cjs
88f15dd6a72be1b16ed17cc2178c32244db9e07ca40d3bc107e987152bd0fed1  $SRC/order-voice-bot/service-server.cjs
SUMS
if [ -z "$R" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/session || true)
  [ "$code" = 401 ] || { echo "登入端點目前回應 $code（預期 401）。PARTNER_VOICE_ENABLED 可能沒開，停止。"; exit 1; }
fi
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v428.tgz" <<'B64'
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
B64
tar xzf "$DST/v428.tgz" -C "$DST" && rm "$DST/v428.tgz"
sha256sum -c - <<SUMS
e04b61407c2c8f4f2373d1c7241b65f2c1af1b4ef742ef0b4764956f4b0bb20b  $DST/order-voice-bot/rehearsal.cjs
7f6477820244c29f457c5cc0eb43e33d8ca8e7aa9944ea230b58a35c79cb40ad  $DST/order-voice-bot/service-server.cjs
fd00233152f9a123a43d46bc9ae41b49a9a264466c83d9d7dc63b0cedfd10f20  $DST/order-voice-bot/account-claim.cjs
14b8c2a6d9a0d86c2bf47f313cb06c8ab5bc1d2d889052d47318bd45324ea489  $DST/order-voice-bot/order-notify.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/service-server.cjs order-voice-bot/rehearsal.cjs order-voice-bot/account-claim.cjs order-voice-bot/order-notify.cjs; do
  docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f
done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "既有測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$ENVF" "$ENVF.before-v428"; chmod 600 "$ENVF.before-v428"
cp -p "$UNIT" "$UNIT.before-v428"
if ! grep -q '^ORDER_NOTIFY_WEBHOOK_URL=' "$ENVF"; then
  say "請貼上「新的」Discord 訂單通知 webhook 網址（舊的已公開過，請先在 Discord 刪掉舊的、建立新的）"
  read -r URL
  [[ "$URL" =~ ^https://(discord\.com|discordapp\.com)/api/webhooks/[0-9]{16,22}/[A-Za-z0-9_-]{20,120}$ ]] || { echo "網址格式不對，停止。正式服務沒有變動。"; exit 1; }
  printf '\nORDER_NOTIFY_WEBHOOK_URL=%s\n' "$URL" >> "$ENVF"
fi
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v428" "$UNIT"; cp -p "$ENVF.before-v428" "$ENVF"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
  if [ "$a" = 401 ] && [ "$b" = 401 ]; then say "V428_DEPLOYED_AND_HEALTHY"; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^(ORDER_NOTIFY|VOICE_|PARTY_)' | tail -5; exit 0; fi
done
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
