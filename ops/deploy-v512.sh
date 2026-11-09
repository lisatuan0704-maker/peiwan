#!/bin/bash
# 小小酒館後端 v512（取代還沒跑的 v511；v511 若已部署會自動跳過重複的部分）：
# 1. 語音登記修正：開店後新做的闆卡沒有 secureV1/characters 名字 → 登記被拒 CHARACTER_REQUIRED（接單後沒語音房、沒私訊）；
#    改成讀不到時用大廳闆卡名字（booking-voice.cjs 兩處；程式跟預期不同就跳過這項）。
# 2. 指定冒險者的委託一成立，機器人私訊那位冒險者「有新委託，請到手札接單」（staff-order-dm.cjs）。
# 3. 老闆升上 VIP，TT 在「🎉｜vip升級」頻道恭喜並 @ 本人（vip-celebrate.cjs；頻道沒有就建，大家看得到、只有 TT 能發言；
#    第一次啟動只補發 48 小時內剛升級的；VIP 5 才 @所有人）。
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
956036628403af2f39ec6e334d636c651bda74d36702cc9ab475fa1ed04096cd  $DST/order-voice-bot/vip-celebrate.cjs
9350e5dbc193a026d146edc38751aa3a700a0b7f9a04c2364999ef0b499f49b1  $DST/order-voice-bot/vip-celebrate.test.cjs
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
