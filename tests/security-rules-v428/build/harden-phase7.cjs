// v475 每日任務：已登入並綁定闆卡的客人，每天（台灣時間）在大廳發過一則訊息後，可自己領一次 10 金幣。
// 以目前的 security/database.rules.json（第六批）為底；可重複執行，不會重複套用。
// 一次領取必須同時寫入：dailyTask/<key>（day＝今天、比上次大、chat 指向自己今天發的大廳訊息）
// ＋ walletTx/<key>/<tx>（type daily、amount 10）＋ wallet/<key>/lastTx＝tx ＋ wallet/<key>/balance 剛好加 10。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const MARK="child('dailyTask')";
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const OWNER=`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`;
const AMT=10;
const T='(now + 28800000)';                                   // 台灣時間
const TODAY=`((${T} - ${T} % 86400000) / 86400000)`;          // 台灣時間的第幾天
const DAYSTART=`(${TODAY} * 86400000 - 28800000)`;           // 今天 00:00（台灣）的時間戳
const NOTYET=`(!root.child('peiwan/dailyTask').child($k).child('day').exists() || root.child('peiwan/dailyTask').child($k).child('day').val() < ${TODAY})`;
const DT=`newData.parent().parent().parent().${MARK}.child($k)`;

// 1. 領取紀錄：本人與店員可讀；本人每天新增一次，必須指向自己今天在大廳發的訊息，且同一次寫入有對應交易與錢包
const CHAT="root.child('peiwan/chat').child(newData.child('chat').val())";
P.dailyTask={
 '.read':STAFF,
 $k:{
  '.read':`${OWNER} || ${STAFF}`,
  '.write':`${STAFF} || (${OWNER} && newData.exists() && ${NOTYET} && newData.child('day').val() == ${TODAY} && newData.child('chat').isString() && ${CHAT}.child('key').val() == $k && ${CHAT}.child('t').val() >= ${DAYSTART} && newData.child('tx').isString() && newData.parent().parent().child('walletTx').child($k).child(newData.child('tx').val()).child('type').val() == 'daily' && newData.parent().parent().child('wallet').child($k).child('lastTx').val() == newData.child('tx').val())`,
  '.validate':"!newData.exists() || ($k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['day','tx','chat','at']))",
  day:{'.validate':'newData.isNumber()'},
  tx:{'.validate':'newData.isString() && newData.val().length <= 64'},
  chat:{'.validate':'newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,64}$/)'},
  at:{'.validate':'newData.isNumber() && newData.val() <= now + 60000'},
  amount:{'.validate':`newData.val() == ${AMT}`},
  $other:{'.validate':false}
 }
};

// 2. 交易明細：多一種 type daily（amount 剛好 10、ref＝自己的編號、同一次寫入有今天的領取紀錄）
const tx=P.walletTx.$k.$tx;
if(!tx['.write'].includes(MARK)){
 tx['.write']+=` || (${OWNER} && !data.exists() && ${NOTYET} && newData.child('type').val() == 'daily' && newData.child('ref').val() == $tx && newData.child('amount').val() == ${AMT} && ${DT}.child('tx').val() == $tx && ${DT}.child('day').val() == ${TODAY} && newData.parent().parent().parent().child('wallet').child($k).child('lastTx').val() == $tx && ((!root.child('peiwan/wallet').child($k).child('balance').exists() && newData.parent().parent().parent().child('wallet').child($k).child('balance').val() == ${AMT}) || newData.parent().parent().parent().child('wallet').child($k).child('balance').val() == root.child('peiwan/wallet').child($k).child('balance').val() + ${AMT}))`;
}

// 3. 餘額：本人可以剛好加 10（只在同一次寫入有新的 daily 交易與今天的領取紀錄時）
const bal=P.wallet.$k.balance;
if(!bal['.write'].includes(MARK)){
 const LT=`newData.parent().child('lastTx').val()`;
 const DTB=`newData.parent().parent().parent().${MARK}.child($k)`;
 bal['.write']+=` || (${OWNER} && ${NOTYET} && newData.isNumber() && ${LT} != null && ${LT} != data.parent().child('lastTx').val() && !root.child('peiwan/walletTx').child($k).child(${LT}).exists() && newData.parent().parent().parent().child('walletTx').child($k).child(${LT}).child('type').val() == 'daily' && ${DTB}.child('tx').val() == ${LT} && ${DTB}.child('day').val() == ${TODAY} && ((!data.exists() && newData.val() == ${AMT}) || (data.exists() && newData.val() == data.val() + ${AMT})))`;
}

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase7 applied: dailyTask / walletTx daily / wallet balance +'+AMT);
