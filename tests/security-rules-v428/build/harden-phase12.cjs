// v502 掛機收益：離線也累積（上次領取後經過的時間），每小時 22 貓貓幣，最多存 8 小時（176）。可重複執行，不會重複套用。
// 使用者 11/08：每天只領一次的話，七天要夠抽一次十連（暫定 1,200）→ 只算掛機：22×8×7＝1,232。
// 1. idle/<key> {at,tx?,amount?}：at＝開始計時或上次領取的伺服器時間。本人與店員可讀。
//    開始計時：還沒有紀錄時本人寫入 {at:now}（不能帶 tx／amount，不能把時間寫早）。
//    領取：at 改成 now，amount 1～176 的整數，且 amount×1 小時 ≤ (now − 上次 at)×22（金額由伺服器時間把關，不信網頁算的），
//    同一次寫入要有 catTx/<key>/<tx>（type idle、amount 相同、ref＝tx）＋ cat/<key>/lastTx＝tx ＋ cat/<key>/balance 剛好加 amount。
//    本人不能刪、不能只改 at（at 一定要等於 now，領取時才會往後推）；店員可任意調整或刪除（刪除＝下次重新開始計時）。
// 2. catTx：多一種 type idle（只在同一次寫入有新的領取紀錄時）。
// 3. cat/<key>/balance：本人可剛好加上這次的掛機收益。
// 每小時與上限改了要同步 lobby-ui/idle-income.js 的 RATE／CAP_H。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const OWNER=`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`;
const RATE=22,CAP_H=8,CAP=RATE*CAP_H,HOUR=3600000;
const MARK="child('idle')";
if(!P.cat||!P.catTx)throw Error('phase9 not applied');
if(!P.houseInv)throw Error('phase11 not applied');
if(P.idle){console.log('phase12 already applied');process.exit(0);}

// ── 1. idle/<key> ──
{
 const NA="newData.child('amount')",NT="newData.child('tx')";
 const CT=`newData.parent().parent().child('catTx').child($k).child(${NT}.val())`;
 const START=`(!data.exists() && !${NT}.exists() && !${NA}.exists())`;
 const CLAIM=`(data.child('at').isNumber() && ${NA}.isNumber() && ${NA}.val() >= 1 && ${NA}.val() <= ${CAP} && ${NA}.val() % 1 == 0 && ${NA}.val() * ${HOUR} <= (now - data.child('at').val()) * ${RATE} && ${NT}.isString() && ${NT}.val() != data.child('tx').val() && !root.child('peiwan/catTx').child($k).child(${NT}.val()).exists() && ${CT}.child('type').val() == 'idle' && ${CT}.child('amount').val() == ${NA}.val() && newData.parent().parent().child('cat').child($k).child('lastTx').val() == ${NT}.val())`;
 P.idle={
  '.read':STAFF,
  $k:{
   '.read':`${OWNER} || ${STAFF}`,
   '.write':`${STAFF} || (${OWNER} && newData.exists() && newData.child('at').val() == now && (${START} || ${CLAIM}))`,
   '.validate':"!newData.exists() || ($k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['at']))",
   at:{'.validate':'newData.isNumber() && newData.val() <= now + 60000'},
   tx:{'.validate':'newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,64}$/)'},
   amount:{'.validate':`newData.isNumber() && newData.val() % 1 == 0 && newData.val() >= 1 && newData.val() <= ${CAP}`},
   $other:{'.validate':false}
  }
 };
}

// ── 2. catTx/<key>/<tx>：type idle ──
{
 const tx=P.catTx.$k.$tx;
 if(tx['.write'].includes(MARK))throw Error('catTx idle branch already there');
 const W='newData.parent().parent().parent()',AMT="newData.child('amount')";
 const CB=`${W}.child('cat').child($k).child('balance').val()`,RB=`root.child('peiwan/cat').child($k).child('balance')`;
 const IW=`${W}.${MARK}.child($k)`;
 tx['.write']+=` || (${OWNER} && !data.exists() && newData.child('type').val() == 'idle' && newData.child('ref').val() == $tx && ${AMT}.isNumber() && ${AMT}.val() >= 1 && ${AMT}.val() <= ${CAP} && ${AMT}.val() % 1 == 0 && ${IW}.child('tx').val() == $tx && ${IW}.child('amount').val() == ${AMT}.val() && ${IW}.child('at').val() == now && root.child('peiwan/idle').child($k).child('tx').val() != $tx && ${W}.child('cat').child($k).child('lastTx').val() == $tx && ((!${RB}.exists() && ${CB} == ${AMT}.val()) || ${CB} == ${RB}.val() + ${AMT}.val()))`;
}

// ── 3. cat/<key>/balance：加上這次的掛機收益 ──
{
 const bal=P.cat.$k.balance;
 if(bal['.write'].includes(MARK))throw Error('cat idle branch already there');
 const W='newData.parent().parent().parent()',LT="newData.parent().child('lastTx').val()";
 const NT=`${W}.child('catTx').child($k).child(${LT})`;
 const IW=`${W}.${MARK}.child($k)`;
 bal['.write']+=` || (${OWNER} && newData.isNumber() && ${LT} != null && ${LT} != data.parent().child('lastTx').val() && !root.child('peiwan/catTx').child($k).child(${LT}).exists() && ${NT}.child('type').val() == 'idle' && ${NT}.child('amount').isNumber() && ${IW}.child('tx').val() == ${LT} && ${IW}.child('amount').val() == ${NT}.child('amount').val() && root.child('peiwan/idle').child($k).child('tx').val() != ${LT} && ((!data.exists() && newData.val() == ${NT}.child('amount').val()) || (data.exists() && newData.val() == data.val() + ${NT}.child('amount').val())))`;
}

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase12 applied: idle '+RATE+'/h, cap '+CAP_H+'h = '+CAP);
