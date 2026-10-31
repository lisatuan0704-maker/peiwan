#!/bin/bash
# 小小酒館：查某位客人為什麼 Discord 登入找不到闆卡（只讀，不改任何資料）。用法：bash d.sh <Discord ID>
set -euo pipefail
ID="${1:-}"; [[ "$ID" =~ ^[0-9]{16,22}$ ]] || { echo "請在指令最後加上客人的 Discord ID（一串數字）"; exit 1; }
echo "== 目前運行版本：$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' /etc/systemd/system/tinytavern-service.service | head -1)"
docker exec tinytavern-service sh -c 'grep -c "v485" order-voice-bot/account-claim.cjs 2>/dev/null || grep -rc "v485" /app/order-voice-bot/account-claim.cjs 2>/dev/null || echo 0' | sed 's/^/== 認領程式含 v485 修正（>0 才是新版）：/'
docker exec -i -e TT_ID="$ID" tinytavern-service node - <<'JS'
const path=require('path'),fs=require('fs');
const dir=[process.cwd()+'/order-voice-bot','/app/order-voice-bot',process.cwd()].find(d=>fs.existsSync(d+'/production-credential.cjs'));
const {initializeApp,cert,applicationDefault}=require(require.resolve('firebase-admin/app',{paths:[dir]}));
const {getDatabase}=require(require.resolve('firebase-admin/database',{paths:[dir]}));
const credential=process.env.NODE_ENV==='production'?cert(require(dir+'/production-credential.cjs').loadProductionCredential()):applicationDefault();
const app=initializeApp({credential,projectId:process.env.GOOGLE_CLOUD_PROJECT,databaseURL:process.env.DATABASE_URL},'diag');
const db=getDatabase(app),id=process.env.TT_ID,uid='discord_'+id;
const v=async p=>(await db.ref(p).once('value')).val();
const keyFor=u=>Buffer.from(encodeURIComponent('@'+String(u||'').trim()),'utf8').toString('base64').replace(/[=+/]/g,'');
(async()=>{
 const member=await v('secureV1/members/'+uid),acct=await v('peiwan/accounts/'+id),hold=await v('secureV1/legacyHolds/'+uid);
 console.log('MEMBER',JSON.stringify(member));console.log('ACCOUNT',JSON.stringify(acct&&{myKey:acct.myKey,username:acct.username,deleted:acct.deleted}));console.log('HOLD',JSON.stringify(hold));
 if(member?.key)console.log('MEMBER_CARD',JSON.stringify(await v('peiwan/lobby/'+member.key+'/name')),'owner',await v('secureV1/owners/'+member.key));
 const cards=await v('peiwan/cards')||{},since=Date.now()-12*3600e3,rows=[];
 for(const [k,c] of Object.entries(cards)){if(!c||Number(c.updatedAt)<since)continue;
  const lob=await v('peiwan/lobby/'+k+'/name'),own=await v('secureV1/owners/'+k);
  const others=Object.keys((await db.ref('peiwan/accounts').orderByChild('myKey').equalTo(k).once('value')).val()||{});
  rows.push({key:k,name:c.name,dcid:c.dcid,lobbyName:lob,keyOK:keyFor(String(c.dcid||'').replace(/^@+/,''))===k,owner:own,accountsPointing:others,at:new Date(Number(c.updatedAt)).toISOString()});}
 console.log('RECENT_CARDS_12H '+rows.length);rows.sort((a,b)=>a.at<b.at?1:-1).slice(0,25).forEach(r=>console.log(JSON.stringify(r)));
 process.exit(0);
})().catch(e=>{console.log('DIAG_FAILED '+e.message);process.exit(1)});
JS
