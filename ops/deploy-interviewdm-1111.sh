#!/bin/bash
# 小小酒館後端：面試體驗版手札的新單也由 TT 私訊面試者（D 11/11「他的 dc 私訊 tt 怎麼沒有發通知!! 下一個不要再錯了」）
# 新增 order-voice-bot/interview-dm.cjs（＋測試）：讀 peiwan/interviewDm（面試控制台寫的，規則第二十三批只讓店長寫），
#   每筆由 TT 私訊面試者一次（跟正式委託的新單私訊同一個樣子，標「面試體驗」），結果寫回 result 給控制台看。
#   只處理 5 分鐘內的新請求：主機重啟、晚上線都不會補發舊的（之前面試過的人不會收到）。一小時最多 60 則。
# service-server.cjs 只在「私訊冒險者」那行後面多接一行。其他功能完全不變。
# 在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261111-interviewdm
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
SS="$SRC/order-voice-bot/service-server.cjs"
ANCHOR="server.once('draining',()=>staffDm?.stop());"
[ "$(grep -cF "$ANCHOR" "$SS")" = 1 ] || { echo "service-server.cjs 找不到「私訊冒險者」那一行（或不只一行），為了安全停止，沒有任何變動。請拍給 Claude。"; exit 1; }
! grep -q "interview-dm" "$SS" || { echo "service-server.cjs 已經接過 interview-dm（已部署過），停止。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
if [ -z "$R" ]; then
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE '(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)' | sort -u || true)
  echo "$PRE" | grep -qx ORDER_NOTIFY_READY || { echo "目前的服務狀態不明（找不到 ORDER_NOTIFY_READY），為了安全停止，正式服務沒有變動。請拍給 Claude。"; exit 1; }
  echo "$PRE" | grep -qx STAFF_DM_READY || { echo "目前的服務沒有「私訊冒險者」（STAFF_DM_READY），TT 私訊的設定可能不同，為了安全停止。請拍給 Claude。"; exit 1; }
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session);P3=$(code /v1/voice/accept)
  echo "重啟前：voice=$P1 rooms=$P2 accept=$P3"
fi

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/interviewdm.tgz" <<'B64'
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
B64
tar xzf "$DST/interviewdm.tgz" -C "$DST" && rm "$DST/interviewdm.tgz"
sha256sum -c - <<SUMS
3b44a58be3735433b267efa2185e03b92dd9bdf05283b1a146acbe1acb6cdbcd  $DST/order-voice-bot/interview-dm.cjs
f7f1f630dee7ebe4ed5c50b8652f9f6ad4f48183a3fcccda050384153c639f86  $DST/order-voice-bot/interview-dm.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/interview-dm.cjs "$DST"/order-voice-bot/interview-dm.test.cjs
say "service-server.cjs 接上「面試體驗：TT 私訊面試者」"
python3 - "$DST/order-voice-bot/service-server.cjs" <<'PY'
import sys
p=sys.argv[1];s=open(p,encoding='utf-8',newline='').read()
a="server.once('draining',()=>staffDm?.stop());"
b=a+"\n // 11/11 D：面試體驗版手札的新單也由 TT 私訊面試者（peiwan/interviewDm，只有店長能寫；只發 5 分鐘內的新請求）\n let interviewDm=null;try{if(process.env.DISCORD_BOT_TOKEN)interviewDm=require('./interview-dm.cjs').startInterviewDm({db:getDatabase(app),token:process.env.DISCORD_BOT_TOKEN,report:code=>console.log(code)});}catch(e){console.log('INTERVIEW_DM_START_FAILED')}\n server.once('draining',()=>interviewDm?.stop());"
assert s.count(a)==1 and 'interview-dm' not in s
open(p,'w',encoding='utf-8',newline='').write(s.replace(a,b))
print('已接上')
PY
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/interview-dm.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/interview-dm.test.cjs"
for x in order-voice-bot/staff-order-dm.test.cjs order-voice-bot/booking-voice-pool.test.cjs order-voice-bot/notify-split-1111.test.cjs order-voice-bot/booking-room.test.cjs order-voice-bot/voice-open.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; cd /; rm -rf "$DST"; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true

cp -p "$UNIT" "$UNIT.before-interviewdm"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-interviewdm" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
last=''
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1)
  miss=''; for c in $PRE INTERVIEW_DM_READY; do echo "$L" | grep -qx "$c" || miss="$miss $c"; done
  [ -z "$miss" ] || { last="還沒就緒：$miss"; continue; }
  a=$(code /v1/voice/session);b=$(code /v1/rooms/session);c=$(code /v1/voice/accept)
  if [ "$a" = "$P1" ] && [ "$b" = "$P2" ] && [ "$c" = "$P3" ]; then
    say "INTERVIEWDM_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c）"
    echo "面試控制台發單時，TT 會私訊已綁定 Discord 的面試者了。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
