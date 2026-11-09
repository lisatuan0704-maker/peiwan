#!/bin/bash
# 小小酒館後端 v513（取代還沒跑的 v511／v512；已部署過的部分會自動跳過，只換新檔）：
# 1. 語音登記修正：開店後新做的闆卡沒有 secureV1/characters 名字 → 登記被拒 CHARACTER_REQUIRED（接單後沒語音房、沒私訊）；
#    改成讀不到時用大廳闆卡名字（booking-voice.cjs 兩處；程式跟預期不同就跳過這項）。
# 2. 指定冒險者的委託一成立，機器人私訊那位冒險者「有新委託，請到手札接單」（staff-order-dm.cjs）。
# 3. 老闆升上 VIP：TT 先寫「請畫圖」單（peiwan/vipCardReq），老闆的大廳（網站 v513）照他當下的闆卡小人畫好去背動圖交回（peiwan/vipCard），
#    TT 再在「✦｜酒館名人牆」頻道大字 @所有人恭喜並 @ 本人、附動圖（不列獎勵），另外私訊老闆本人這一級的獎勵（也附動圖）。
#    24 小時沒收到動圖就只發文字。需要先發布資料庫規則第二十一批（vipCardReq／vipCard）。第一次啟動只補發 7 天內剛升級的；每一級都 @所有人。
# service-server.cjs 只在訂單通知那行後面多接幾行。其他功能完全不變。
# 在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261110-v513
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
[ -f "$SRC/order-voice-bot/staff-names.cjs" ] || { echo "找不到 staff-names.cjs，停止。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v513.tgz" <<'B64'
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
B64
tar xzf "$DST/v513.tgz" -C "$DST" && rm "$DST/v513.tgz"
sha256sum -c - <<SUMS
ba678bfb482a6749f188f2e87609e28806686d02ae6708eb1a52c207cb10b405  $DST/order-voice-bot/staff-order-dm.cjs
0739ebac757af382daf4b28aa7c7b28ad436c09f69e27541f71564a722c54c36  $DST/order-voice-bot/staff-order-dm.test.cjs
bedbe8e41bdda830572d5ffa892df84ec47009eead0a6ba64c88fd9520d11b6d  $DST/order-voice-bot/vip-celebrate.cjs
0ac5b1c8236be55d63d31b74483cac567891d264088e68725dd097f9ac5cca18  $DST/order-voice-bot/vip-celebrate.test.cjs
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
if "vip-celebrate" not in s:
    add+="""
 // v512／v513 D：老闆升上 VIP，TT 在「酒館名人牆」頻道恭喜並 @ 本人（附老闆小人的動圖）
 let vipCheer=null;try{if(process.env.DISCORD_BOT_TOKEN&&process.env.DISCORD_GUILD_ID)vipCheer=require('./vip-celebrate.cjs').startVipCelebrate({db:getDatabase(app),token:process.env.DISCORD_BOT_TOKEN,guildId:process.env.DISCORD_GUILD_ID,botId:process.env.DISCORD_BOT_USER_ID,report:code=>console.log(code)});}catch(e){console.log('VIP_CELEBRATE_START_FAILED')}
 server.once('draining',()=>vipCheer?.stop());"""
    print('接上 VIP 升級恭喜')
else:
    print('VIP 升級恭喜已經接過（v512 已部署），只換新檔')
open(p,'w',encoding='utf-8',newline='').write(s.replace(a,a+add))
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
cp -p "$UNIT" "$UNIT.before-v513"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v513" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
    say "V513_DEPLOYED_AND_HEALTHY"
    sleep 15; echo "私訊冒險者／VIP 恭喜狀態："; docker logs --since 3m tinytavern-service 2>&1 | grep -E '^(STAFF_DM_|VIP_CELEBRATE_|VIP_CARD_|VIP_DM_|ORDER_NOTIFY_)' | sort | uniq -c
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
