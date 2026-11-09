#!/bin/bash
# 小小酒館後端 v512（取代還沒跑的 v511；v511 若已部署會自動跳過重複的部分）：
# 1. 語音登記修正：開店後新做的闆卡沒有 secureV1/characters 名字 → 登記被拒 CHARACTER_REQUIRED（接單後沒語音房、沒私訊）；
#    改成讀不到時用大廳闆卡名字（booking-voice.cjs 兩處；程式跟預期不同就跳過這項）。
# 2. 指定冒險者的委託一成立，機器人私訊那位冒險者「有新委託，請到手札接單」（staff-order-dm.cjs）。
# 3. 老闆升上 VIP，TT 在「🎉｜vip升級」頻道恭喜並 @ 本人（vip-celebrate.cjs；頻道沒有就建，大家看得到、只有 TT 能發言；
#    第一次啟動只補發 48 小時內剛升級的；每一級升級都 @所有人）。
# service-server.cjs 只在訂單通知那行後面多接幾行。其他功能完全不變。
# 在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261109-v512
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
SS="$SRC/order-voice-bot/service-server.cjs"
ANCHOR="server.once('draining',()=>orderNotify?.stop());"
[ "$(grep -cF "$ANCHOR" "$SS")" = 1 ] || { echo "service-server.cjs 找不到訂單通知那一行（或不只一行），為了安全停止，沒有任何變動。"; exit 1; }
! grep -q "vip-celebrate" "$SS" || { echo "service-server.cjs 已經接過 vip-celebrate（v512 已部署過），停止。"; exit 1; }
[ -f "$SRC/order-voice-bot/staff-names.cjs" ] || { echo "找不到 staff-names.cjs，停止。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v512.tgz" <<'B64'
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
AAA=
B64
tar xzf "$DST/v512.tgz" -C "$DST" && rm "$DST/v512.tgz"
sha256sum -c - <<SUMS
ba678bfb482a6749f188f2e87609e28806686d02ae6708eb1a52c207cb10b405  $DST/order-voice-bot/staff-order-dm.cjs
0739ebac757af382daf4b28aa7c7b28ad436c09f69e27541f71564a722c54c36  $DST/order-voice-bot/staff-order-dm.test.cjs
662792c505055bb0468fc74d2dbd13a77208165c6325ac9db5acf9158facdee6  $DST/order-voice-bot/vip-celebrate.cjs
5f611699cc08fb8d1070349ce12cd6fc2180d2c26b1df9540e574e5866a62b22  $DST/order-voice-bot/vip-celebrate.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/staff-order-dm.cjs "$DST"/order-voice-bot/staff-order-dm.test.cjs "$DST"/order-voice-bot/vip-celebrate.cjs "$DST"/order-voice-bot/vip-celebrate.test.cjs
say "service-server.cjs 接上私訊冒險者、VIP 升級恭喜"
python3 - "$DST/order-voice-bot/service-server.cjs" <<'PY'
import sys
p=sys.argv[1];s=open(p,encoding='utf-8',newline='').read()
a="server.once('draining',()=>orderNotify?.stop());"
assert s.count(a)==1
add=""
if "staff-order-dm" not in s:
    add+="""
 // v511 D：指定冒險者的委託一成立，機器人私訊那位冒險者去手札接單
 let staffDm=null;try{if(process.env.DISCORD_BOT_TOKEN)staffDm=require('./staff-order-dm.cjs').startStaffOrderDm({db:getDatabase(app),token:process.env.DISCORD_BOT_TOKEN,report:code=>console.log(code)});}catch(e){console.log('STAFF_DM_START_FAILED')}
 server.once('draining',()=>staffDm?.stop());"""
    print('接上私訊冒險者')
else:
    print('私訊冒險者已經接過（v511 已部署），跳過')
add+="""
 // v512 D：老闆升上 VIP，TT 在「vip升級」頻道恭喜並 @ 本人
 let vipCheer=null;try{if(process.env.DISCORD_BOT_TOKEN&&process.env.DISCORD_GUILD_ID)vipCheer=require('./vip-celebrate.cjs').startVipCelebrate({db:getDatabase(app),token:process.env.DISCORD_BOT_TOKEN,guildId:process.env.DISCORD_GUILD_ID,botId:process.env.DISCORD_BOT_USER_ID,report:code=>console.log(code)});}catch(e){console.log('VIP_CELEBRATE_START_FAILED')}
 server.once('draining',()=>vipCheer?.stop());"""
open(p,'w',encoding='utf-8',newline='').write(s.replace(a,a+add))
print('接上 VIP 升級恭喜')
PY
say "語音登記：沒有角色名字時改用大廳闆卡名字"
python3 - "$DST/order-voice-bot/booking-voice.cjs" <<'PY'
import sys
# v511：老闆沒有 secureV1/characters/<闆卡>/name（開店後新做的闆卡沒人寫這份）→ 語音登記被拒 CHARACTER_REQUIRED。
# 改成讀不到時用大廳闆卡 peiwan/lobby/<闆卡>/name。找不到預期的程式片段就不動（印 SKIP），不影響其他部署。
p=sys.argv[1];s=open(p,encoding='utf-8',newline='').read()
a1="const orders=await Promise.all(ids.map(async id=>(await db.ref('peiwan/clientOrders/'+id).once('value')).val()));"
a2="const name=secure.characters?.[m.key]?.name;"
if s.count(a1)!=1 or s.count(a2)!=1 or 'lobbyName' in s:
    print('SKIP booking-voice 跟預期不同（或已改過），角色名字備援這項跳過');sys.exit(0)
s=s.replace(a1,"const lobbyName=await db.ref('peiwan/lobby/'+m.key+'/name').once('value').then(x=>x.val(),()=>null);"+a1)
s=s.replace(a2,"const name=secure.characters?.[m.key]?.name||(typeof lobbyName==='string'&&lobbyName.trim()?lobbyName.trim():null);")
open(p,'w',encoding='utf-8',newline='').write(s)
print('PATCHED 語音登記：沒有角色名字時改用大廳闆卡名字')
PY
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/staff-order-dm.cjs order-voice-bot/vip-celebrate.cjs order-voice-bot/service-server.cjs order-voice-bot/booking-voice.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/staff-order-dm.test.cjs order-voice-bot/vip-celebrate.test.cjs"
for x in order-voice-bot/booking-voice-test.cjs order-voice-bot/notify-oen-v498b.test.cjs order-voice-bot/notify-v466.test.cjs order-voice-bot/staff-names.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true
cp -p "$UNIT" "$UNIT.before-v512"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v512" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1)
  echo "$L" | grep -q '^ORDER_NOTIFY_READY$' || continue
  echo "$L" | grep -q '^STAFF_DM_READY$' || continue
  echo "$L" | grep -q '^VIP_CELEBRATE_READY$' || continue
  echo "$L" | grep -q '^ROLES_STARTED$' || continue
  echo "$L" | grep -q '^COUNTER_STARTED$' || continue
  echo "$L" | grep -q '^RECRUIT_STARTED$' || continue
  a=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/session || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/rooms/session || true)
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/vip-outfit || true)
  if [ "$a" = 401 ] && [ "$b" = 401 ] && [ "$c" = 401 ]; then
    say "V512_DEPLOYED_AND_HEALTHY"
    sleep 15; echo "私訊冒險者／VIP 恭喜狀態："; docker logs --since 3m tinytavern-service 2>&1 | grep -E '^(STAFF_DM_|VIP_CELEBRATE_|ORDER_NOTIFY_)' | sort | uniq -c
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
