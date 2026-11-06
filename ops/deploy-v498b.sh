#!/bin/bash
# 小小酒館後端 v498b：線上付款（應援）的儲值單由付款主機在客人按付款時建立（還沒付錢），確認付款後主機自動入帳。
# 店方 Discord 通知改為：建單時不通知（不再 @here「儲值待核帳」），自動入帳後發一則不 @ 人的「線上儲值已自動入帳」。
# 銀行轉帳儲值、點單、會員等其他通知完全不變。只替換 order-voice-bot/order-notify.cjs（並新增它的測試）。
# 在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261107-v498b
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的 order-notify.cjs（v466b 版）"
H=$(sha256sum "$SRC/order-voice-bot/order-notify.cjs" | cut -d' ' -f1)
[ "$H" = 2fc98c643b9e10fb9edd625aa7747c139db6c93002157e7508e9e3ea0ca4936b ] || { echo "主機上的 order-notify.cjs 和預期不同（$H），為了安全停止，沒有任何變動。"; exit 1; }
grep -q "require('./order-notify.cjs').startOrderNotify" "$SRC/order-voice-bot/service-server.cjs" || { echo "service-server.cjs 沒有啟動 order-notify，停止。"; exit 1; }
[ -f "$SRC/order-voice-bot/staff-names.cjs" ] || { echo "找不到 staff-names.cjs，停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v498b.tgz" <<'B64'
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
tVqrtVrr+Nc/IqeI/gBQAAA=
B64
tar xzf "$DST/v498b.tgz" -C "$DST" && rm "$DST/v498b.tgz"
sha256sum -c - <<SUMS
40644ad899d32e33b9474cf513d6512331b228194a5ed58f77398177e81f9994  $DST/order-voice-bot/order-notify.cjs
d5933a26b78091156517d29fe618a29dc9efd3f71e2b5aa496ca02af422ae7a4  $DST/order-voice-bot/notify-oen-v498b.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/order-notify.cjs "$DST"/order-voice-bot/notify-oen-v498b.test.cjs
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/order-notify.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/notify-oen-v498b.test.cjs order-voice-bot/notify-v466.test.cjs"
if [ -f order-voice-bot/staff-names.test.cjs ]; then T="$T order-voice-bot/staff-names.test.cjs"; fi
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true
cp -p "$UNIT" "$UNIT.before-v498b"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v498b" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1)
  echo "$L" | grep -q '^ORDER_NOTIFY_READY$' || continue
  echo "$L" | grep -q '^ORDER_NOTIFY_OEN_READY$' || continue
  echo "$L" | grep -q '^ROLES_STARTED$' || continue
  echo "$L" | grep -q '^COUNTER_STARTED$' || continue
  echo "$L" | grep -q '^RECRUIT_STARTED$' || continue
  a=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/session || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/rooms/session || true)
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/vip-outfit || true)
  if [ "$a" = 401 ] && [ "$b" = 401 ] && [ "$c" = 401 ]; then
    say "V498B_DEPLOYED_AND_HEALTHY"
    sleep 15; echo "訂單通知狀態："; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^ORDER_NOTIFY_' | tail -8
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
