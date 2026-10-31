#!/bin/bash
# 小小酒館後端 v485：開店清資料後，Discord 登入找不回闆卡（變成訪客、工房又說已經有闆卡）。
# 綁定的闆卡已不存在時改綁這個帳號現在的闆卡；本機沒有鑰匙（無痕、換裝置）時也會找工房闆卡。
# 只替換 order-voice-bot/account-claim.cjs。在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261101-v485
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上的 account-claim.cjs"
H=$(sha256sum "$SRC/order-voice-bot/account-claim.cjs" | cut -d' ' -f1)
case "$H" in
  19f77a474f955fec7bcde2176597a05118393e95780169b00fc669c8e092fd42) echo "v466b 版本，符合。";;
  fd00233152f9a123a43d46bc9ae41b49a9a264466c83d9d7dc63b0cedfd10f20) echo "v466b 之前的版本，也可以直接更新。";;
  *) echo "主機上的 account-claim.cjs 和預期不同（$H），為了安全停止，沒有任何變動。"; exit 1;;
esac
grep -q "account-claim" "$SRC/order-voice-bot/rehearsal.cjs" || { echo "rehearsal.cjs 沒有使用 account-claim，停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v485.tgz" <<'B64'
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
B64
tar xzf "$DST/v485.tgz" -C "$DST" && rm "$DST/v485.tgz"
sha256sum -c - <<SUMS
0f6b85fcbd55673171334ab23f167c111be3f4c8d767f7a139ca89050e4ee592  $DST/order-voice-bot/account-claim.cjs
afe03f5c0b9a233597d615fdf65aae970f813333c037396366df748696a1d786  $DST/order-voice-bot/account-claim-v485.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/account-claim.cjs "$DST"/order-voice-bot/account-claim-v485.test.cjs
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v485"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v485" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "V485_DEPLOYED_AND_HEALTHY"
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
