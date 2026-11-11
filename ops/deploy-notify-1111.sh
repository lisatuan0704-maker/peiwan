#!/bin/bash
# 小小酒館後端：Discord 通知分頻道（D 11/11「訂單通知／服務鈴／儲值通知要分開，訂單要分時裝還是委託」）
#   委託（找冒險者、併桌）  → 原本的「訂單通知」頻道（ORDER_NOTIFY_WEBHOOK_URL，不變）
#   商城（時裝、小屋、染髮券、會員…）→ SHOP_NOTIFY_WEBHOOK_URL
#   儲值（銀行轉帳待核帳＋線上儲值已入帳）→ TOPUP_NOTIFY_WEBHOOK_URL
#   服務鈴（櫃檯想了解服務、意見回饋）＋冒險者應徵 → DESK_NOTIFY_WEBHOOK_URL
# 執行時會請你一個一個貼上 Discord 頻道的 Webhook 網址（畫面不會顯示）；直接按 Enter＝那一種不分開，照舊發到訂單通知。
# 換掉 order-notify.cjs（先核對主機上是預期版本，不一樣就停止、什麼都不動）；service-server.cjs 只改三處 webhook 設定；
# counter-desk／recruit-desk 只加發送名稱（原本顯示 Spidey Bot）。分出去的頻道發不出去時會改發原本的訂單通知，不漏單。
# 在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版（程式＋設定檔）。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261111-notify
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
ENVP=$(grep -oE -- '--env-file[= ][^ ]+' "$UNIT" | head -1 | sed -E 's/^--env-file[= ]//' || true)
[ -n "$ENVP" ] || { echo "服務啟動設定裡找不到 --env-file（看到的設定方式：$(grep -oE -- '(--env-file|--env|-e|EnvironmentFile)[= ][A-Za-z0-9_/.-]+' "$UNIT" | sed -E 's/[= ].*//' | sort -u | tr '\n' ' ')），為了安全停止，沒有任何變動。請拍給 Claude。"; exit 1; }
ENVF=$R$ENVP
[ -f "$ENVF" ] || { echo "找不到設定檔 $ENVP，停止。"; exit 1; }
grep -q '^ORDER_NOTIFY_WEBHOOK_URL=' "$ENVF" || { echo "設定檔裡沒有原本的訂單通知網址（ORDER_NOTIFY_WEBHOOK_URL），停止。"; exit 1; }
say "核對主機上要換掉的檔案是預期版本"
h=$(sha256sum "$SRC/order-voice-bot/order-notify.cjs" | cut -d' ' -f1)
[ "$h" = 40644ad899d32e33b9474cf513d6512331b228194a5ed58f77398177e81f9994 ] || { echo "order-notify.cjs 跟預期版本不同（${h:0:16}），為了安全停止，沒有任何變動。請拍給 Claude。"; exit 1; }
cat > /tmp/tt-notify-patch.py <<'PY'
import sys
# service-server.cjs：委託照舊用 ORDER_NOTIFY_WEBHOOK_URL；商城／儲值多傳兩個網址給 order-notify；服務鈴＋應徵改用 DESK_NOTIFY_WEBHOOK_URL（沒設定照舊）
mode,p=sys.argv[1],sys.argv[2];s=open(p,encoding='utf-8',newline='').read()
if 'DESK_NOTIFY_WEBHOOK_URL' in s:
    print('service-server.cjs 已經改過，跳過');sys.exit(0)
old='webhookUrl:process.env.ORDER_NOTIFY_WEBHOOK_URL||null'
new='webhookUrl:process.env.DESK_NOTIFY_WEBHOOK_URL||process.env.ORDER_NOTIFY_WEBHOOK_URL||null'
o='startOrderNotify({db:getDatabase(app),webhookUrl:process.env.ORDER_NOTIFY_WEBHOOK_URL,'
lines=s.split('\n')
ci=[i for i,l in enumerate(lines) if 'createCounterDesk(' in l]
ri=[i for i,l in enumerate(lines) if 'createRecruitDesk(' in l]
ok=len(ci)==1 and lines[ci[0]].count(old)==1 and len(ri)==1 and lines[ri[0]].count(old)==1 and s.count(o)==1
if not ok:
    print('service-server.cjs 跟預期不同（櫃檯 %d／應徵 %d／訂單通知 %d），為了安全停止，沒有任何變動。請拍給 Claude。'%(len(ci),len(ri),s.count(o)));sys.exit(1)
if mode=='check':
    print('service-server.cjs 可以改');sys.exit(0)
for i in (ci[0],ri[0]):lines[i]=lines[i].replace(old,new)
s='\n'.join(lines).replace(o,o+'webhooks:{shop:process.env.SHOP_NOTIFY_WEBHOOK_URL,topup:process.env.TOPUP_NOTIFY_WEBHOOK_URL},')
open(p,'w',encoding='utf-8',newline='').write(s)
print('service-server.cjs：商城／儲值／服務鈴可以各自設定頻道')
PY
python3 /tmp/tt-notify-patch.py check "$SRC/order-voice-bot/service-server.cjs"

if [ -z "$R" ]; then
  say "記下目前服務的狀態（重啟後要一樣）"
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE '(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)' | sort -u || true)
  echo "$PRE" | grep -qx ORDER_NOTIFY_READY || { echo "目前的服務沒有在發訂單通知（找不到 ORDER_NOTIFY_READY），為了安全停止，正式服務沒有變動。請拍給 Claude。"; exit 1; }
  echo "$PRE" | tr '\n' ' '; echo
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session)
  echo "voice=$P1 rooms=$P2"
fi
say "貼上各頻道的 Webhook 網址"
echo "做法：Discord 頻道右邊齒輪（編輯頻道）→ 整合 → Webhook → 新 Webhook → 複製 Webhook 網址，回來這裡貼上按 Enter。"
echo "畫面不會顯示貼上的內容。直接按 Enter＝那一種不分開，照舊發到原本的「訂單通知」。"
RE='^https://(discord\.com|discordapp\.com)/api/webhooks/[0-9]{16,22}/[A-Za-z0-9_-]{20,120}$'
ask(){ local label=$1 v; while :; do printf '\n%s：' "$label" >&2; IFS= read -rs v || v=''; echo >&2; v=$(printf '%s' "$v" | tr -d '[:space:]'); if [ -z "$v" ]; then echo "  略過（照舊發到訂單通知）" >&2; printf ''; return; fi
  if printf '%s' "$v" | grep -qE "$RE"; then echo "  收到（網址不會顯示）" >&2; printf '%s' "$v"; return; fi
  echo "  這不像 Discord 的 Webhook 網址（要 https://discord.com/api/webhooks/ 開頭），再貼一次" >&2; done; }
NEW_SHOP=$(ask "① 商城訂單頻道（時裝、小屋、染髮券、會員）")
NEW_TOPUP=$(ask "② 儲值通知頻道（銀行轉帳待核帳、線上儲值已入帳）")
NEW_DESK=$(ask "③ 服務鈴頻道（櫃檯想了解服務、意見回饋、冒險者應徵）")
[ -n "$NEW_SHOP$NEW_TOPUP$NEW_DESK" ] || { echo "三個都略過，沒有要分開的頻道，停止，沒有任何變動。"; exit 1; }
for a in "$NEW_SHOP" "$NEW_TOPUP" "$NEW_DESK"; do [ -z "$a" ] || ! grep -qxF "ORDER_NOTIFY_WEBHOOK_URL=$a" "$ENVF" || { echo "有一個網址跟原本的訂單通知一樣，分開頻道要用新的 Webhook，停止，沒有任何變動。"; exit 1; }; done

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/notify.tgz" <<'B64'
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
W3/+Dy6oK2kAeAAA
B64
tar xzf "$DST/notify.tgz" -C "$DST" && rm "$DST/notify.tgz"
sha256sum -c - <<SUMS
000217cc325f7f33dd43042144955cc91296feef25116019ddc5ab7972148269  $DST/order-voice-bot/order-notify.cjs
56b705fd12318d1966f65103f6028c3ff3cc102a990ae08dc9a618be8f158293  $DST/order-voice-bot/notify-oen-v498b.test.cjs
6782db458e0cdca3cef45cdfc1c6566009e56e8cc645ec71e2c0b5d802a2321f  $DST/order-voice-bot/notify-split-1111.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/order-notify.cjs "$DST"/order-voice-bot/notify-oen-v498b.test.cjs "$DST"/order-voice-bot/notify-split-1111.test.cjs
python3 /tmp/tt-notify-patch.py apply "$DST/order-voice-bot/service-server.cjs"
python3 - "$DST/order-voice-bot" <<'PY'
import sys
# 櫃檯／應徵通知加上發送名稱（原本沒有名稱，Discord 顯示預設的 Spidey Bot）；找不到就跳過，不影響其他
d=sys.argv[1];a="body:JSON.stringify({content,allowed_mentions:{parse:[]}})"
for f,name in (('counter-desk.cjs','小小酒館・服務鈴'),('recruit-desk.cjs','小小酒館・冒險者應徵')):
    p=d+'/'+f;s=open(p,encoding='utf-8',newline='').read()
    if s.count(a)!=1:print('SKIP '+f+' 發送名稱（程式跟預期不同，跳過）');continue
    open(p,'w',encoding='utf-8',newline='').write(s.replace(a,"body:JSON.stringify({username:'"+name+"',content,allowed_mentions:{parse:[]}})"))
    print(f+'：通知名稱「'+name+'」')
PY
rm -f /tmp/tt-notify-patch.py
if [ -n "$R" ]; then
  cp -p "$ENVF" "$ENVF.before-notify"
  S="$NEW_SHOP" T="$NEW_TOPUP" D="$NEW_DESK" python3 - "$ENVF" <<'PY'
import os,sys
p=sys.argv[1];lines=open(p,encoding='utf-8').read().splitlines()
for k,v in (('SHOP_NOTIFY_WEBHOOK_URL',os.environ['S']),('TOPUP_NOTIFY_WEBHOOK_URL',os.environ['T']),('DESK_NOTIFY_WEBHOOK_URL',os.environ['D'])):
    if not v:continue
    lines=[l for l in lines if not l.startswith(k+'=')]+[k+'='+v]
open(p,'w',encoding='utf-8').write('\n'.join(lines)+'\n')
PY
  echo "TEST_ROOT: 檔案準備完成"; exit 0
fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/order-notify.cjs order-voice-bot/service-server.cjs order-voice-bot/counter-desk.cjs order-voice-bot/recruit-desk.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/notify-split-1111.test.cjs order-voice-bot/notify-oen-v498b.test.cjs"
for x in order-voice-bot/notify-v466.test.cjs order-voice-bot/counter-desk.test.cjs order-voice-bot/recruit-desk.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; cd /; rm -rf "$DST"; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true

say "寫進設定檔（舊的備份在 $ENVP.before-notify）"
cp -p "$UNIT" "$UNIT.before-notify"
cp -p "$ENVF" "$ENVF.before-notify"
S="$NEW_SHOP" T="$NEW_TOPUP" D="$NEW_DESK" python3 - "$ENVF" <<'PY'
import os,sys
p=sys.argv[1];lines=open(p,encoding='utf-8').read().splitlines()
for k,v in (('SHOP_NOTIFY_WEBHOOK_URL',os.environ['S']),('TOPUP_NOTIFY_WEBHOOK_URL',os.environ['T']),('DESK_NOTIFY_WEBHOOK_URL',os.environ['D'])):
    if not v:continue
    lines=[l for l in lines if not l.startswith(k+'=')]+[k+'='+v]
open(p,'w',encoding='utf-8').write('\n'.join(lines)+'\n')
PY
WANT="ORDER_NOTIFY_ROUTES shop=$(grep -q '^SHOP_NOTIFY_WEBHOOK_URL=.' "$ENVF" && echo 1 || echo 0) topup=$(grep -q '^TOPUP_NOTIFY_WEBHOOK_URL=.' "$ENVF" && echo 1 || echo 0)"
WDESK=$(grep -q '^DESK_NOTIFY_WEBHOOK_URL=.' "$ENVF" && echo 1 || echo 0)
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-notify" "$UNIT"; cp -p "$ENVF.before-notify" "$ENVF"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR（設定檔也還原）。"; exit 1; }

say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
last=''
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1)
  miss=''; for c in $PRE; do echo "$L" | grep -qx "$c" || miss="$miss $c"; done
  [ -z "$miss" ] || { last="還沒就緒：$miss"; continue; }
  echo "$L" | grep -qx "$WANT" || { last="分流設定沒有生效（要 $WANT）"; continue; }
  if [ "$WDESK" = 1 ]; then docker exec tinytavern-service node -e "process.exit(process.env.DESK_NOTIFY_WEBHOOK_URL?0:1)" || { last="服務鈴的網址沒有傳進服務"; continue; }; fi
  a=$(code /v1/voice/session);b=$(code /v1/rooms/session)
  if [ "$a" = "$P1" ] && [ "$b" = "$P2" ]; then
    say "NOTIFY_SPLIT_DEPLOYED_AND_HEALTHY（$WANT desk=$WDESK）"
    post(){ [ -n "$1" ] || return 0; r=$(printf '{"username":"%s","content":"%s","allowed_mentions":{"parse":[]}}' "$2" "$3" | curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d @- "$1" || true); echo "  $2：$r（204＝已送到頻道）"; }
    say "在每個新頻道發一則說明（確認有送到對的地方）"
    post "$NEW_SHOP" "小小酒館・商城訂單" "這個頻道之後會收到「商城」的新訂單通知（時裝、小屋、染髮券、會員…）。"
    post "$NEW_TOPUP" "小小酒館・儲值通知" "這個頻道之後會收到儲值通知（銀行轉帳待核帳、線上儲值已自動入帳）。"
    post "$NEW_DESK" "小小酒館・服務鈴" "這個頻道之後會收到服務鈴（櫃檯想了解服務、意見回饋）和冒險者應徵的通知。"
    exit 0
  fi
  last="voice=$a rooms=$b（重啟前 voice=$P1 rooms=$P2）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
