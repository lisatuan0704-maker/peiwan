#!/bin/bash
# 小小酒館後端 v466b（資安）：闆卡認領只認 Discord username／ID 且鑰匙須由該帳號算出（拿掉 3 小時與顯示名稱規則）；
# 店方通知去掉客人文字中的假連結符號；送去 Discord 驗證前擋格式錯誤的憑證並限制全站失敗次數；限流表滿時淘汰最舊。
# 在主機的 root 終端機執行。任何一步失敗都會停止；重啟後健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261029-v466b
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
say "核對主機上要修改的三個檔案與預期相同"
cd "$SRC/order-voice-bot"
sha256sum -c --quiet - <<'SUMS' || { echo "主機上的檔案和預期不同（可能有人改過），為了安全停止，沒有任何變動。"; exit 1; }
fd00233152f9a123a43d46bc9ae41b49a9a264466c83d9d7dc63b0cedfd10f20  account-claim.cjs
272a25ebc2ce7ffd8adb8b908e6736887728681f93e6b0f370f813d95287eaab  order-notify.cjs
66c23fcdc6b0762a299e7222ebe6017542fd2c14f31717ac448acabbf70f3626  rehearsal.cjs
SUMS
cd /
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v466b.tgz" <<'B64'
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
B64
tar xzf "$DST/v466b.tgz" -C "$DST" && rm "$DST/v466b.tgz"
sha256sum -c - <<SUMS
19f77a474f955fec7bcde2176597a05118393e95780169b00fc669c8e092fd42  $DST/order-voice-bot/account-claim.cjs
2fc98c643b9e10fb9edd625aa7747c139db6c93002157e7508e9e3ea0ca4936b  $DST/order-voice-bot/order-notify.cjs
76777efd8a5cc4440f47a3acb14745f481c3d9544214894daf6a742b97757378  $DST/order-voice-bot/rehearsal.cjs
8498d654667af535121e6ff84f48782e5f1a473704cb85b2da4c95cb3c39dbad  $DST/order-voice-bot/account-claim-v466.test.cjs
470270cce7f7aea28a41a4eb804ada850a12222ac2b15f23dc0cd1659767c449  $DST/order-voice-bot/notify-v466.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/account-claim*.cjs "$DST"/order-voice-bot/order-notify.cjs "$DST"/order-voice-bot/rehearsal.cjs "$DST"/order-voice-bot/notify-v466.test.cjs
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/account-claim.cjs order-voice-bot/order-notify.cjs order-voice-bot/rehearsal.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test order-voice-bot/account-claim-v466.test.cjs order-voice-bot/notify-v466.test.cjs order-voice-bot/recruit-desk.test.cjs order-voice-bot/member-lounge.test.cjs order-voice-bot/guide-channel.test.cjs order-voice-bot/server-layout.test.cjs order-voice-bot/member-roles.test.cjs order-voice-bot/counter-desk.test.cjs order-voice-bot/party.test.cjs order-voice-bot/party-flow.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/staff-names.test.cjs > test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
docker run --rm --network none --entrypoint node tinytavern-service:$TAG order-voice-bot/recruit-desk.test.cjs >> test.log 2>&1 || { tail -20 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
cp -p "$UNIT" "$UNIT.before-v466b"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v466b" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "V466B_DEPLOYED_AND_HEALTHY"
    sleep 20; echo "機器人狀態："; docker logs --since 2m tinytavern-service 2>&1 | grep -E '^(RECRUIT_|GUIDE_|ROLES_|COUNTER_)' | grep -v STARTED | tail -14
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
