#!/bin/bash
# 小小酒館後端 v512（取代還沒跑的 v511；v511 若已部署會自動跳過重複的部分）：
# 1. 語音登記修正：開店後新做的闆卡沒有 secureV1/characters 名字 → 登記被拒 CHARACTER_REQUIRED（接單後沒語音房、沒私訊）；
#    改成讀不到時用大廳闆卡名字（booking-voice.cjs 兩處；程式跟預期不同就跳過這項）。
# 2. 指定冒險者的委託一成立，機器人私訊那位冒險者「有新委託，請到手札接單」（staff-order-dm.cjs）。
# 3. 老闆升上 VIP：TT 在「✦｜酒館名人牆」頻道用碰杯點字圖＋大字 @所有人恭喜並 @ 本人（不列獎勵），另外私訊老闆本人這一級的獎勵（vip-celebrate.cjs；頻道沒有就建，大家看得到、只有 TT 能發言；
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
B64
tar xzf "$DST/v512.tgz" -C "$DST" && rm "$DST/v512.tgz"
sha256sum -c - <<SUMS
ba678bfb482a6749f188f2e87609e28806686d02ae6708eb1a52c207cb10b405  $DST/order-voice-bot/staff-order-dm.cjs
0739ebac757af382daf4b28aa7c7b28ad436c09f69e27541f71564a722c54c36  $DST/order-voice-bot/staff-order-dm.test.cjs
2d6cf8e30c99d39ab5d763d4a7fb6f14dd33db0ea814f3ab330d5bc06f74ebac  $DST/order-voice-bot/vip-celebrate.cjs
7ab5b7f4b0e9e6749de9e24ef9c5dfe231747e7c9916790e3b63f82aa1a6d9c3  $DST/order-voice-bot/vip-celebrate.test.cjs
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
    sleep 15; echo "私訊冒險者／VIP 恭喜狀態："; docker logs --since 3m tinytavern-service 2>&1 | grep -E '^(STAFF_DM_|VIP_CELEBRATE_|VIP_DM_|ORDER_NOTIFY_)' | sort | uniq -c
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
