#!/bin/bash
# 小小酒館後端 v450：VIP 3 用 500 金幣購買另一套 VIP 時裝（伺服器檢查 VIP 3、扣款、發放，不需店長上架）。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261028-v450
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的程式是 v445b"
sha256sum -c - <<SUMS
7f84f2b05e6040473a9dc8660d35e5318ef6bf0156b486c9dc11c4ca0fbaa2ab  $SRC/order-voice-bot/vip-outfit.cjs
SUMS
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v450.tgz" <<'B64'
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
trKVrWz9P67/AGAxv5IAUAAA
B64
tar xzf "$DST/v450.tgz" -C "$DST" && rm "$DST/v450.tgz"
sha256sum -c - <<SUMS
62f6c53e0035856d80d00ad9373de68542c991830348ada4e096230dac4da9e6  $DST/order-voice-bot/vip-outfit.cjs
fc34ae258254e234c8b7c1907792730f4a1048aaf71568dbead8e5a38051a5cb  $DST/order-voice-bot/vip-outfit.test.cjs
SUMS
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/vip-outfit.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/vip-outfit.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v450"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v450" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
  if [ "$a" = 401 ] && [ "$b" = 401 ] && [ "$c" = 401 ]; then say "V450_DEPLOYED_AND_HEALTHY"; exit 0; fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
