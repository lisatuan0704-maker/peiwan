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
AACuHk/IhVAAyAAA
B64
tar xzf "$DST/v512.tgz" -C "$DST" && rm "$DST/v512.tgz"
sha256sum -c - <<SUMS
ba678bfb482a6749f188f2e87609e28806686d02ae6708eb1a52c207cb10b405  $DST/order-voice-bot/staff-order-dm.cjs
0739ebac757af382daf4b28aa7c7b28ad436c09f69e27541f71564a722c54c36  $DST/order-voice-bot/staff-order-dm.test.cjs
2a03c1390630ee41510f627db74f4db301f7cffd9de8edabf632bf65317845ce  $DST/order-voice-bot/vip-celebrate.cjs
27bd5f9d19ee112ec4fe43aa30d4df09d704e270a4dcb6a2434599f730fe6c15  $DST/order-voice-bot/vip-celebrate.test.cjs
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
