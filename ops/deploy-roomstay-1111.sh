#!/bin/bash
# 小小酒館後端：專屬聊天室／語音房不再「時間到就收」（D 11/11「老闆明明有續單…不要再加限時功能了。
#   規則就是創立，然後語音頻道全部人退出後刪掉聊天室跟語音頻道」）
# 原因：續單只延長網站上的單，主機開房時記的結束時間不會變 → 時間一到就把正在玩的房收掉
#       （拿掉語音房權限、聊天室藏起來、按鈕回「這間房已經結束囉」、網站進房鈕消失）。
# 修法：語音房開了以後不照時間收；大家都離開語音房（沒人 30 秒）才把語音房和聊天室一起刪。
#       預約時間內要老闆和冒險者都進來過才算（免得老闆先到、出去一下就被收）；冒險者按完成的單也等大家離開；
#       取消（退款）照舊馬上收。只改 voice.cjs／booking-room.cjs／voice-inbox.cjs／rehearsal.cjs／partner-access.cjs
#       （找不到插入點就停止）＋測試。在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
export PYTHONIOENCODING=utf-8
R="${TT_ROOT:-}"
TAG=20261111-roomstay
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
cat > /tmp/tt-roomstay-patch.py <<'PY'
import os,re,sys
# 11/11 D「老闆明明有續單…不要再加限時功能了。規則就是創立，然後語音頻道全部人退出後刪掉聊天室跟語音頻道」
# 續單只延長網站的單，主機開房時記下的結束時間不會變 → 時間一到就把正在玩的房收掉（拿掉權限、聊天室藏起來、按鈕說房間結束）。
# 改成：語音房開了以後不再照時間收；大家都離開語音房（沒人 30 秒）才把語音房和聊天室一起刪。
# 每個插入點都先核對「剛好出現一次」，有一個對不上就整個停止，什麼都不改。
mode,root=sys.argv[1],sys.argv[2]
R=[]  # (檔名, 舊, 新, 是否用 regex)
R.append(('voice.cjs',
 "const departed=participants.every(u=>seen.includes(u))&&state.members.length===0;",
 "const departed=state.members.length===0&&(participants.every(u=>seen.includes(u))||now()>=order.endAt+graceMs); // 11/11 D：大家都離開語音房才收。預約時間內要每個人都來過（免得老闆先到、出去一下就被收）；過了預約結束時間，房裡沒人就算大家都走了",False))
R.append(('voice.cjs',
 "const closed=!['pending','confirmed'].includes(order.status)||now()>=order.endAt+graceMs;",
 "const closed=!['pending','confirmed'].includes(order.status)||(!job.channelId&&now()>=order.endAt+graceMs); // 11/11 D「老闆有續單，不要再加限時功能」：續單不會改這裡的 endAt，語音房開了以後就不再照時間收；只有語音房沒開過、時間也過了才照舊收",False))
R.append(('voice.cjs',
 "if(!channel)job={...job,channelId:null,voiceAnnounced:false}; // 語音房被手動刪掉：重開一間",
 "if(!channel){if(now()>=order.endAt+graceMs){job=await rooms.dropText(discord,job);await store.save(id,owner,{...job,phase:'deleted',deletedAt:now(),reason:'CHANNEL_ALREADY_REMOVED'});await store.removeActions(id,order);return {state:'deleted'}}job={...job,channelId:null,voiceAnnounced:false}} // 語音房被手動刪掉：預約時間內重開一間；過了結束時間就當作收完了（11/11 不照時間收房後，不會替舊單重開）",False))
R.append(('booking-room.cjs',
 "if(!order||!['pending','confirmed'].includes(order.status)||t>=order.endAt+15*60000||job.phase==='deleted'||job.textGone)",
 "if(!order||!['pending','confirmed'].includes(order.status)||job.phase==='deleted'||job.phase==='closed'||job.textGone)",False))
R.append(('booking-room.cjs',
 "（語音房收起來的時候，這間聊天室也會一起收起來喔）",
 "（大家都離開語音房之後，語音房和這間聊天室會一起收起來喔）",False))
R.append(('booking-room.cjs',
 "老闆和冒險者的專屬聊天室 ✦ 語音房收起來的時候會一起收起來。",
 "老闆和冒險者的專屬聊天室 ✦ 大家都離開語音房後，會跟語音房一起收起來。",False))
R.append(('voice-inbox.cjs',
 "['cancelled','completed','expired'].includes(order.status)||Number(order.endAt)<=now}",
 "['cancelled','completed','expired'].includes(order.status)}",False))
R.append(('rehearsal.cjs',
 "&&Date.now()>=o.startAt-600000&&o.endAt>Date.now()?{url:",
 "&&Date.now()>=o.startAt-600000?{url:",False))
R.append(('partner-access.cjs',
 "if(!Number.isSafeInteger(order.endAt)||now>=order.endAt+900000)denied();",
 "if(!Number.isSafeInteger(order.endAt))denied(); // 11/11 D：不再照時間擋，房收起來了（下面看 job.phase）才擋",False))
R.append(('partner-access.cjs',
 "const job=(await voiceRef.child('jobs/'+orderId+'/data').once('value')).val();",
 "const job=(await voiceRef.child('jobs/'+orderId+'/data').once('value')).val();if(['deleted','closed'].includes(job?.phase))denied();",False))
R.append(('booking-room.test.cjs',
 "test('時間結束、房間沒人：不收權限，沒人 30 秒後語音房和聊天室一起刪',async()=>{",
 "test('時間過了、房間沒人：語音房開著就不照時間收，沒人 30 秒後語音房和聊天室一起刪',async()=>{",False))
R.append(('booking-room.test.cjs',
 re.escape("assert.equal((await s.svc.process(ID)).state,'closed');")+r"(\r?\n )"+re.escape("assert(can(s.channels[channelId].permission_overwrites,CUST,VIEW|CONNECT));assert(can(s.channels[textId].permission_overwrites,CUST,VIEW),'時間到不收權限');"),
 "assert.equal((await s.svc.process(ID)).state,'ready');"+r"\1"+"assert(can(s.channels[channelId].permission_overwrites,CUST,VIEW|CONNECT));assert(can(s.channels[textId].permission_overwrites,CUST,VIEW),'時間到不收權限');",True))
R.append(('booking-room.test.cjs',
 "for(let k=0;k<5;k++){s.tick(60000);assert.equal((await s.svc.process(ID)).state,'closed',how)}",
 "for(let k=0;k<5;k++){s.tick(60000);assert.equal((await s.svc.process(ID)).state,how==='timeUp'?'ready':'closed',how)}",False))
R.append(('booking-room.test.cjs',
 "assert.equal((await s.svc.process(ID)).state,'closed',how+' 剛走光先等 30 秒');",
 "assert.equal((await s.svc.process(ID)).state,how==='timeUp'?'ready':'closed',how+' 剛走光先等 30 秒');",False))

files={}
for f,_,_,_ in R:
 if f not in files:
  p=os.path.join(root,f)
  if not os.path.isfile(p):print('找不到 '+f+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
  files[f]=open(p,encoding='utf-8',newline='').read()
if 'graceMs); // 11/11 D' in files['voice.cjs']:
 print('已經改過，跳過');sys.exit(0)
bad=[]
for f,old,new,rx in R:
 n=len(re.findall(old,files[f])) if rx else files[f].count(old)
 if n!=1:bad.append('%s（%d）'%(f,n))
if bad:
 print('程式跟預期不同：'+'、'.join(bad)+'，為了安全停止，沒有任何變動。請拍給 Claude。');sys.exit(1)
if mode=='check':
 print('收房規則可以改（%d 處）'%len(R));sys.exit(0)
for f,old,new,rx in R:
 files[f]=re.sub(old,lambda m:m.expand(new),files[f]) if rx else files[f].replace(old,new)
for f,s in files.items():
 open(os.path.join(root,f),'w',encoding='utf-8',newline='').write(s)
print('收房規則：大家都離開語音房才收（%d 處）'%len(R))
PY
say "核對主機上的開房程式"
python3 /tmp/tt-roomstay-patch.py check "$SRC/order-voice-bot"
if [ -z "$R" ]; then
  PRE=$(docker logs tinytavern-service 2>&1 | grep -xE '(BOOKING_ROOM_READY|ORDER_NOTIFY_READY|STAFF_DM_READY|VIP_CELEBRATE_READY|ROLES_STARTED|COUNTER_STARTED|RECRUIT_STARTED)' | sort -u || true)
  echo "$PRE" | grep -qx BOOKING_ROOM_READY || { echo "目前的服務狀態不明（找不到 BOOKING_ROOM_READY），為了安全停止，正式服務沒有變動。請拍給 Claude。"; exit 1; }
  code(){ curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:8081$1" || true; }
  P1=$(code /v1/voice/session);P2=$(code /v1/rooms/session);P3=$(code /v1/voice/accept)
  echo "重啟前：voice=$P1 rooms=$P2 accept=$P3"
fi

say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/roomstay.tgz" <<'B64'
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
B64
tar xzf "$DST/roomstay.tgz" -C "$DST" && rm "$DST/roomstay.tgz"
sha256sum -c - <<SUMS
ebf63b8015a7d3ff9810b010835563ab1aa7e468361961339b549d2d4f7965b1  $DST/order-voice-bot/room-stay-1111.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/room-stay-1111.test.cjs
python3 /tmp/tt-roomstay-patch.py apply "$DST/order-voice-bot"
rm -f /tmp/tt-roomstay-patch.py
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi

say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; cd /; rm -rf "$DST"; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/voice.cjs order-voice-bot/booking-room.cjs order-voice-bot/voice-inbox.cjs order-voice-bot/rehearsal.cjs order-voice-bot/partner-access.cjs order-voice-bot/service-server.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/room-stay-1111.test.cjs"
for x in order-voice-bot/booking-room.test.cjs order-voice-bot/voice-open.test.cjs order-voice-bot/booking-voice-pool.test.cjs order-voice-bot/notify-split-1111.test.cjs order-voice-bot/notify-oen-v498b.test.cjs order-voice-bot/staff-order-dm.test.cjs order-voice-bot/interview-dm.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; cd /; rm -rf "$DST"; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true

cp -p "$UNIT" "$UNIT.before-roomstay"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-roomstay" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
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
  a=$(code /v1/voice/session);b=$(code /v1/rooms/session);c=$(code /v1/voice/accept)
  if [ "$a" = "$P1" ] && [ "$b" = "$P2" ] && [ "$c" = "$P3" ]; then
    say "ROOMSTAY_DEPLOYED_AND_HEALTHY（voice=$a rooms=$b accept=$c）"
    echo "專屬聊天室和語音房現在不會時間到就收了，大家都離開語音房 30 秒後才一起收。"
    exit 0
  fi
  last="voice=$a rooms=$b accept=$c（重啟前 voice=$P1 rooms=$P2 accept=$P3）"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | grep -v -i 'webhook' | tail -20
rollback
