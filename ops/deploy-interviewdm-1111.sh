#!/bin/bash
# 小小酒館後端：面試體驗版手札的新單也由 TT 私訊面試者（D 11/11「他的 dc 私訊 tt 怎麼沒有發通知!! 下一個不要再錯了」）
# 新增 order-voice-bot/interview-dm.cjs（＋測試）：讀 peiwan/interviewDm（面試控制台寫的，規則第二十三批只讓店長寫），
#   每筆由 TT 私訊面試者一次（跟正式委託的新單私訊同一個樣子，標「面試體驗」），結果寫回 result 給控制台看。
#   只發「按下後 20 秒內」送得出去的：主機重啟、晚上線、斷線後才寫進來的都不會補發（之前面試過的人不會收到）。一小時最多 60 則。
#   另外要在 Firebase 主控台發布 security/database.rules.json（第二十三批 interviewDm），沒發布前控制台寫不進去、TT 不會私訊。
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
9af452b5fd124bd5bda19e740ca961248ee3b80fb6d10766d711c443ad4d24f7  $DST/order-voice-bot/interview-dm.cjs
3b5afd115943224e629f37093f33a614aae3f538f61cf1818d63cf0463f5d7c4  $DST/order-voice-bot/interview-dm.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/interview-dm.cjs "$DST"/order-voice-bot/interview-dm.test.cjs
say "service-server.cjs 接上「面試體驗：TT 私訊面試者」"
python3 - "$DST/order-voice-bot/service-server.cjs" <<'PY'
import sys
p=sys.argv[1];s=open(p,encoding='utf-8',newline='').read()
a="server.once('draining',()=>staffDm?.stop());"
b=a+"\n // 11/11 D：面試體驗版手札的新單也由 TT 私訊面試者（peiwan/interviewDm，只有店長能寫；只發按下後 20 秒內送得出去的，不補發）\n let interviewDm=null;try{if(process.env.DISCORD_BOT_TOKEN)interviewDm=require('./interview-dm.cjs').startInterviewDm({db:getDatabase(app),token:process.env.DISCORD_BOT_TOKEN,report:code=>console.log(code)});}catch(e){console.log('INTERVIEW_DM_START_FAILED')}\n server.once('draining',()=>interviewDm?.stop());"
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
trap rollback ERR      # 換版本之後任何一步意外失敗，都還原舊版
systemctl daemon-reload
systemctl restart tinytavern-service
last=''
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1 || true)
  miss=''; for c in $PRE INTERVIEW_DM_READY; do echo "$L" | grep -qx "$c" || miss="$miss $c"; done
  [ -z "$miss" ] || { last="還沒就緒：$miss"; continue; }
  a=$(code /v1/voice/session);b=$(code /v1/rooms/session);c=$(code /v1/voice/accept)
  if [ "$a" = "$P1" ] && [ "$b" = "$P2" ] && [ "$c" = "$P3" ]; then
    trap - ERR
    say "INTERVIEWDM_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c）"
    echo "主機好了。還要在 Firebase 主控台發布 security/database.rules.json（第二十三批 interviewDm）；"
    echo "發布之後，面試控制台發單時，TT 就會私訊已綁定 Discord 的面試者。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
trap - ERR
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20 || true
rollback
