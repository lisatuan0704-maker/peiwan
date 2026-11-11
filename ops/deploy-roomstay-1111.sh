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
 re.escape("await discord.patchChannel(job.channelId,{permission_overwrites:overwrites(guildId,botId)}).catch(e=>{if(e.code!=='NOT_FOUND')throw e});")+r"\r?\n[ \t]*"+re.escape("job=await rooms.hideText(discord,job,guildId,botId);"),
 "if(order.status==='cancelled'){await discord.patchChannel(job.channelId,{permission_overwrites:overwrites(guildId,botId)}).catch(e=>{if(e.code!=='NOT_FOUND')throw e});job=await rooms.hideText(discord,job,guildId,botId);} // 11/11 D：只有取消（退款）才把人請出去；冒險者按完成的單，等大家離開語音房再收",True))
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
 "test('時間結束、房間沒人：語音房和聊天室一起收',async()=>{",
 "test('時間過了、房間沒人：30 秒後語音房和聊天室一起收（不先把人請出去）',async()=>{",False))
R.append(('booking-room.test.cjs',
 "await s.svc.process(ID);assert(BigInt(ow(s.channels[textId].permission_overwrites,G).deny)&VIEW);assert(!ow(s.channels[textId].permission_overwrites,CUST),'聊天室先收起來');",
 "await s.svc.process(ID);assert(can(s.channels[textId].permission_overwrites,CUST,VIEW),'聊天室不先收起來');assert(can(s.channels[channelId].permission_overwrites,CUST,VIEW|CONNECT),'語音房權限不拿掉');",False))

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
 files[f]=re.sub(old,lambda m:new,files[f]) if rx else files[f].replace(old,new)
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
