#!/bin/bash
# 小小酒館後端 v467b：冒險者應徵小房間的應徵表、酒館櫃檯討論串的歡迎訊息發不出去（Discord 訊息編號超過 25 字被拒）。
# 修正編號長度；啟動後自動把之前沒貼出來的應徵表補貼回各自的小房間（已有的不重複）。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261031-v467b
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上要修改的兩個檔案與預期相同"
cd "$SRC/order-voice-bot"
sha256sum -c --quiet - <<'SUMS' || { echo "主機上的檔案和預期不同（可能有人改過），為了安全停止，沒有任何變動。"; exit 1; }
cf2b34a592e22a9e5e946df0a924d8c905aad9df69e515e91438ed35356743a8  recruit-desk.cjs
45761bc9428f7f50c40a5bf177d910dc1a0b61538519652ed06e18aa5e82ef48  counter-desk.cjs
SUMS
cd /
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v467b.tgz" <<'B64'
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
B64
tar xzf "$DST/v467b.tgz" -C "$DST" && rm "$DST/v467b.tgz"
sha256sum -c - <<SUMS
8fe5f8b4eea06e6f5e70110b1a81884088c77c12637dd62d22907a31e62a3384  $DST/order-voice-bot/recruit-desk.cjs
29ba6dac508c9f587a2add8fbf336bcd8c33b24a5909ba4a2381cfcd0f718981  $DST/order-voice-bot/counter-desk.cjs
a6c3addb78f6bd4bef2101d3ab05ef13667e1ef2308bae07933d4aa9962a5052  $DST/order-voice-bot/recruit-nonce-v467.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/recruit-desk.cjs "$DST"/order-voice-bot/counter-desk.cjs "$DST"/order-voice-bot/recruit-nonce-v467.test.cjs
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/recruit-desk.cjs order-voice-bot/counter-desk.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/recruit-nonce-v467.test.cjs order-voice-bot/account-claim-v466.test.cjs order-voice-bot/notify-v466.test.cjs order-voice-bot/recruit-desk.test.cjs order-voice-bot/member-lounge.test.cjs order-voice-bot/guide-channel.test.cjs order-voice-bot/server-layout.test.cjs order-voice-bot/member-roles.test.cjs order-voice-bot/counter-desk.test.cjs order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/recruit-desk.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v467b"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v467b" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "V467B_DEPLOYED_AND_HEALTHY"
    sleep 30; echo "機器人狀態："; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^(RECRUIT_|GUIDE_|ROLES_|COUNTER_)' | grep -v STARTED | tail -14
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
