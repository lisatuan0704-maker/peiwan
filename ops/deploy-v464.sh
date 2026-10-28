#!/bin/bash
# 小小酒館後端 v464：應徵小房間改開在伺服器最下面的分類。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。主機需為 v463。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261028-v464
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的程式是 v463"
H=$(sha256sum "$SRC/order-voice-bot/service-server.cjs" | cut -d' ' -f1)
[ "$H" = 91e2dcfc2ace7b5901da36c8d671377c941cc78f5b7e271779d42c3b8c8d85bf ] || { echo "主機上的 service-server.cjs 不是 v463（$H），停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v464.tgz" <<'B64'
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
B64
tar xzf "$DST/v464.tgz" -C "$DST" && rm "$DST/v464.tgz"
sha256sum -c - <<SUMS
5f4935853cddfad9d98d146e50f7717f58bc8cc6c56cc2ce6d02aa8784ce9d8f  $DST/order-voice-bot/recruit-desk.cjs
35b2bbe5a36be834e7c8cd463e9e1a9ef52909822b2d1dae87db57bd3d000627  $DST/order-voice-bot/recruit-desk.test.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/recruit-desk.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/recruit-desk.test.cjs order-voice-bot/member-lounge.test.cjs order-voice-bot/guide-channel.test.cjs order-voice-bot/server-layout.test.cjs order-voice-bot/member-roles.test.cjs order-voice-bot/counter-desk.test.cjs order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/vip-outfit.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v464"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v464" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "V464_DEPLOYED_AND_HEALTHY"
    sleep 20; echo "機器人狀態："; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^(RECRUIT_|GUIDE_|ROLES_|COUNTER_)' | grep -v STARTED | tail -14
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
