#!/bin/bash
# 小小酒館：查「分享闆卡到 Discord → 產生預覽 → 分享功能暫時休息中」卡在哪（只讀：不改資料、不重啟服務、不發 Discord）。
# 印出：分享服務／畫小人服務的狀態與紀錄、磁碟與記憶體、用假角色試畫一張、再用最近 20 位客人的小人試畫（只畫不存）。
# 在主機的 root 終端機執行。
set -uo pipefail
say(){ printf '\n== %s\n' "$*"; }
UNIT=/etc/systemd/system/tinytavern-card-share.service
say "分享服務版本：$(grep -o 'tinytavern-card-share:[A-Za-z0-9._-]*' "$UNIT" 2>/dev/null | head -1)"
echo "card-share=$(systemctl is-active tinytavern-card-share) renderer=$(systemctl is-active tinytavern-renderer 2>/dev/null) 開始時間=$(systemctl show -p ActiveEnterTimestamp --value tinytavern-card-share)"
say "健康檢查"; curl -s -m 5 127.0.0.1:8083/health; echo
say "畫小人服務的連線檔"; ls -la /opt/tinytavern/runtime/party-render/ 2>&1 | head -8
say "磁碟／記憶體"; df -h / 2>/dev/null | tail -1; du -sh /opt/tinytavern/runtime/card-share 2>/dev/null; free -m | sed -n 2p
say "容器"; docker ps -a --format '{{.Names}}  {{.Status}}  {{.Image}}' | grep -iE 'card-share|render|party' || true
say "分享服務紀錄（48 小時，相同的行合併計數）"
docker logs --since 48h tinytavern-card-share 2>&1 | cut -c1-180 | sed -E 's/[0-9a-f]{8}-[0-9a-f-]{27}/<id>/g' | sort | uniq -c | sort -rn | head -40
say "畫小人服務紀錄（48 小時）"
for n in $(docker ps -a --format '{{.Names}}' | grep -iE 'render' | grep -v card-share); do echo "-- $n"; docker logs --since 48h "$n" 2>&1 | cut -c1-180 | sort | uniq -c | sort -rn | head -15; done
journalctl -u tinytavern-renderer --since '48 hours ago' --no-pager 2>/dev/null | tail -15 | cut -c1-180
say "試畫：假角色（不讀真資料）＋最近 20 位客人的小人（只畫不存、不發 Discord）"
docker exec -i tinytavern-card-share node - <<'JS'
'use strict';
const D='/card-share/';
const {renderCharacter}=require(D+'live-profiles.cjs'),{createRenderer}=require(D+'renderer.cjs');
const short=e=>String(e&&(e.code||e.message)||e).replace(/[^\w .:-]/g,'').slice(0,140);
(async()=>{
 let step='小人';
 try{const c=await renderCharacter({doll:{front:3,back:3,cloth:3,face:2,hair:6,skin:0,uiBaseSlots:['pet']},products:{}});console.log('假角色小人 OK',c.bytes.length,'bytes');
  step='整張卡';const r=createRenderer();try{const png=await r.render({name:'旅人測試',character:c});console.log('假角色整張卡 OK',png.length,'bytes 版本',r.version);}finally{await r.close();}
 }catch(e){console.log('假角色失敗在「'+step+'」：',short(e));}
 try{
  const {initializeApp,cert}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
  const {publicAppearance}=require(D+'server-source/public-appearance.cjs');
  const credential=require(D+'server-source/production-credential.cjs').loadProductionCredential();
  const app=initializeApp({credential:cert(credential),projectId:process.env.GOOGLE_CLOUD_PROJECT,databaseURL:process.env.DATABASE_URL},'diag523');
  const db=getDatabase(app),read=async p=>(await db.ref(p).once('value')).val();
  const safe=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(k);
  const lobby=(await db.ref('peiwan/lobby').orderByKey().limitToLast(20).once('value')).val()||{};
  const tally={},t0=Date.now();let streak=0;
  for(const [key,raw] of Object.entries(lobby)){
   if(streak>=3||Date.now()-t0>90000){console.log('（連續失敗 3 位或超過 90 秒，後面不試了）');break;}
   if(!raw||!raw.name||!raw.doll){tally['沒有小人資料']=(tally['沒有小人資料']||0)+1;continue;}
   const doll=structuredClone(publicAppearance(raw).doll);if(doll.ps)delete doll.ps.pet;doll.uiBaseSlots=[...new Set([...(doll.uiBaseSlots||[]),'pet'])];
   const ids=[...new Set([doll.set,...Object.values(doll.ps||{}),...(doll.uiAccessories||[]).map(x=>x.source)].filter(safe))],products={};
   await Promise.all(ids.map(async id=>{const v=await read('peiwan/shopConfig/'+id);if(v&&v.parts)products[id]={parts:v.parts};}));
   const t=Date.now();let res;
   try{const c=await renderCharacter({doll,products});res='OK';}catch(e){res='失敗 '+short(e);}
   tally[res]=(tally[res]||0)+1;streak=res==='OK'?0:streak+1;
   if(res!=='OK')console.log('…'+key.slice(-5),res,(Date.now()-t)+'ms','部件:',Object.keys(doll).join(','),'商品數:',ids.length,'JSON大小:',JSON.stringify({doll,products}).length);
  }
  console.log('最近客人小人試畫結果：',JSON.stringify(tally));
  process.exit(0);
 }catch(e){console.log('讀客人資料失敗：',short(e));process.exit(0);}
})();
JS
say "完成（這支只讀，沒有改任何東西）"
