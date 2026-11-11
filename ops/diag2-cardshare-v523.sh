#!/bin/bash
# 小小酒館：闆卡分享第二次檢查（只讀：不改資料、不重啟服務、不發 Discord）。
# 第一次檢查：畫小人服務正常，但「整張卡」那步整支程式無聲結束 → 查記憶體／行程上限／暫存空間，並一步一步試開 Chromium 看死在哪。
# 也印出主機上分享程式的雜湊，跟 Claude 手上的版本比對。在主機的 root 終端機執行。
set -uo pipefail
say(){ printf '\n== %s\n' "$*"; }
C=tinytavern-card-share
say "主機上的程式雜湊（v2＝Claude 手上的版本）"
declare -A V2=([adapters.cjs]=06a14493 [core.cjs]=646cdd09 [fonts.cjs]=d67836dd [http.cjs]=ba75df8e [live-profiles.cjs]=22be6688 [production.cjs]=0f0e2223 [renderer.cjs]=96d51d85)
for f in adapters.cjs core.cjs fonts.cjs http.cjs live-profiles.cjs production.cjs renderer.cjs; do
  h=$(docker exec $C sha256sum /card-share/$f 2>/dev/null | cut -c1-8); [ "$h" = "${V2[$f]}" ] && m=v2 || m=不同; echo "$f $h $m"
done
docker exec $C ls /card-share /card-share/assets 2>&1 | tr '\n' ' '; echo
say "容器限制與用量"
docker inspect -f 'Memory={{.HostConfig.Memory}} Swap={{.HostConfig.MemorySwap}} Pids={{.HostConfig.PidsLimit}} Shm={{.HostConfig.ShmSize}} OOMKilled={{.State.OOMKilled}} Restarts={{.RestartCount}}' $C
docker stats --no-stream --format '用量 {{.MemUsage}} ({{.MemPerc}})  行程數 {{.PIDs}}  CPU {{.CPUPerc}}' $C
say "容器裡的行程（看 Chromium 還在不在）"
docker top $C -o pid,rss,etime,args 2>/dev/null | cut -c1-150 | head -25
echo "chrome 行程數：$(docker top $C -o args 2>/dev/null | grep -ci chrom)"
say "暫存空間 /tmp、/dev/shm"
docker exec $C sh -c 'df -h /tmp /dev/shm 2>/dev/null; ls -la /tmp 2>/dev/null | head -15; du -sh /tmp/* 2>/dev/null | sort -h | tail -5'
say "系統的記憶體不足紀錄（14 天）"
journalctl -k --since '14 days ago' --no-pager 2>/dev/null | grep -iE 'oom|killed process|out of memory' | tail -12 | cut -c1-200
dmesg -T 2>/dev/null | grep -iE 'oom|killed process' | tail -6 | cut -c1-200
say "一步一步試開 Chromium 畫一張卡（假資料，90 秒內）"
timeout 90 docker exec -i $C node - <<'JS'
'use strict';
process.on('exit',c=>console.log('NODE_EXIT',c));
process.on('uncaughtException',e=>{console.log('UNCAUGHT',String(e&&e.message||e).slice(0,200));process.exit(2);});
process.on('unhandledRejection',e=>{console.log('UNHANDLED',String(e&&e.message||e).slice(0,200));});
const t0=Date.now(),step=s=>console.log('STEP',((Date.now()-t0)/1000).toFixed(1)+'s',s,'rss',Math.round(process.memoryUsage().rss/1048576)+'MB');
const keep=setInterval(()=>{},1000);
(async()=>{
 try{
  step('start');const {chromium}=require('/card-share/node_modules/playwright');
  step('launch '+process.env.TT_CHROMIUM_PATH);
  const b=await chromium.launch({headless:true,executablePath:process.env.TT_CHROMIUM_PATH,env:{PATH:process.env.PATH,HOME:process.env.HOME||'/tmp',LANG:'C.UTF-8'},timeout:40000});
  step('launched '+b.version());b.on('disconnected',()=>step('DISCONNECTED'));
  const p=await b.newPage({viewport:{width:1100,height:680}});step('page');
  await p.setContent('<body style="margin:0;background:#fde">測試</body>');step('content');
  const png=await p.screenshot({type:'png'});step('screenshot '+png.length);
  await b.close();step('closed');
  const {createRenderer}=require('/card-share/renderer.cjs'),{renderCharacter}=require('/card-share/live-profiles.cjs');
  const ch=await renderCharacter({doll:{front:3,back:3,cloth:3,face:2,hair:6,skin:0,uiBaseSlots:['pet']},products:{}});step('character '+ch.bytes.length);
  const r=createRenderer();try{const card=await r.render({name:'旅人測試',character:ch});step('CARD_OK '+card.length+' '+r.version);}finally{await r.close();}
 }catch(e){step('FAIL '+String(e&&e.message||e).replace(/\s+/g,' ').slice(0,300));}
 clearInterval(keep);
})();
JS
echo "docker exec 結束碼：$?（137＝被系統強制結束，通常是記憶體不足；124＝超過 90 秒）"
docker stats --no-stream --format '試畫後用量 {{.MemUsage}}  行程數 {{.PIDs}}' $C
say "完成（這支只讀，沒有改任何東西）"
