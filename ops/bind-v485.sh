#!/bin/bash
# 小小酒館：店長手動把客人的 Discord 帳號綁到他的闆卡（會先印出現況，輸入 y 才寫入；不刪任何資料）。
# 用法：bash d.sh <Discord ID> <闆卡 key>
set -euo pipefail
ID="${1:-}";KEY="${2:-}"
[[ "$ID" =~ ^[0-9]{16,22}$ ]] || { echo "第一個參數要是 Discord ID（數字）"; exit 1; }
[[ "$KEY" =~ ^[A-Za-z0-9_-]{1,100}$ ]] || { echo "第二個參數要是闆卡 key"; exit 1; }
run(){ docker exec -i -e TT_ID="$ID" -e TT_KEY="$KEY" -e TT_DO="$1" tinytavern-service node - <<'JS'
const fs=require('fs');
const dir=[process.cwd()+'/order-voice-bot','/app/order-voice-bot',process.cwd()].find(d=>fs.existsSync(d+'/production-credential.cjs'));
const {initializeApp,cert,applicationDefault}=require(require.resolve('firebase-admin/app',{paths:[dir]}));
const {getDatabase}=require(require.resolve('firebase-admin/database',{paths:[dir]}));
const credential=process.env.NODE_ENV==='production'?cert(require(dir+'/production-credential.cjs').loadProductionCredential()):applicationDefault();
const app=initializeApp({credential,projectId:process.env.GOOGLE_CLOUD_PROJECT,databaseURL:process.env.DATABASE_URL},'bind');
const db=getDatabase(app),id=process.env.TT_ID,uid='discord_'+id,key=process.env.TT_KEY;
const v=async p=>(await db.ref(p).once('value')).val();
(async()=>{
 const [name,card,owner,member,acct]=await Promise.all([v('peiwan/lobby/'+key+'/name'),v('peiwan/cards/'+key),v('secureV1/owners/'+key),v('secureV1/members/'+uid),v('peiwan/accounts/'+id)]);
 console.log('闆卡名字：'+name+'　闆卡填的 Discord：'+(card&&card.dcid));
 console.log('這張闆卡目前的擁有者：'+(owner||'（沒有）'));
 console.log('這個 Discord 目前綁的闆卡：'+(member?JSON.stringify(member):'（沒有）'));
 console.log('帳號紀錄 myKey：'+(acct&&acct.myKey||'（沒有）'));
 if(typeof name!=='string'||!name.trim()){console.log('BIND_STOP 找不到這張闆卡');process.exit(1)}
 if(owner&&owner!==uid){console.log('BIND_STOP 這張闆卡已綁定另一個 Discord（'+owner+'），請先確認');process.exit(1)}
 if(member&&member.key!==key){
   const old=await v('peiwan/lobby/'+member.key+'/name');
   if(typeof old==='string'&&old.trim()){console.log('BIND_STOP 這個 Discord 已經綁另一張還存在的闆卡「'+old+'」，請先確認');process.exit(1)}
   console.log('（舊綁定指向已刪除的闆卡，會改綁）');
 }
 if(process.env.TT_DO!=='1'){console.log('BIND_READY');process.exit(0)}
 const now=Date.now();
 const t1=await db.ref('secureV1/owners/'+key).transaction(c=>c===null||c===uid?uid:undefined,undefined,false);
 if(!t1.committed){console.log('BIND_FAILED 擁有者剛被改過');process.exit(1)}
 await db.ref('secureV1/members/'+uid).set({active:true,key,claimedAt:now,manual:true});
 if(member&&member.key&&member.key!==key)await db.ref('secureV1/owners/'+member.key).transaction(c=>c===uid?null:undefined,undefined,false);
 await db.ref('peiwan/accounts/'+id).update({myKey:key,seenAt:now});
 console.log('BIND_DONE 已綁定：Discord '+id+' → 闆卡「'+name+'」');
 process.exit(0);
})().catch(e=>{console.log('BIND_FAILED '+e.message);process.exit(1)});
JS
}
run 0 | tee /tmp/tt-bind.log
grep -q BIND_READY /tmp/tt-bind.log || exit 1
read -r -p "確定要綁定嗎？(y/N) " ok </dev/tty
[ "$ok" = y ] || [ "$ok" = Y ] || { echo "沒有寫入。"; exit 0; }
run 1
