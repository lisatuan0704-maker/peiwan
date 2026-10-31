// v472 開幕禮：已登入並綁定闆卡的客人，活動期間（台灣時間 2026-11-08 00:00 前）可自己領一次 350 金幣。
// 以目前的 security/database.rules.json（第五批）為底；可重複執行，不會重複套用。
// 一次領取必須同時寫入：welcomeGift/<key>（不能已存在）＋ walletTx/<key>/<tx>（type welcome、amount 350）
// ＋ wallet/<key>/lastTx＝tx ＋ wallet/<key>/balance 剛好加 350（沒有錢包時從 0 開始）。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const MARK="child('welcomeGift')";
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const OWNER=`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`;
const END=Date.parse('2026-11-08T00:00:00+08:00');
const AMT=350;
const OPEN=`now < ${END} && !root.child('peiwan/welcomeGift').child($k).exists()`;

// 1. 領取紀錄：本人與店員可讀；本人只能在活動期間新增一次，且同一次寫入要有對應的交易與錢包
const giftWrite=`${STAFF} || (${OWNER} && !data.exists() && ${OPEN} && newData.child('tx').isString() && newData.parent().parent().child('walletTx').child($k).child(newData.child('tx').val()).child('type').val() == 'welcome' && newData.parent().parent().child('wallet').child($k).child('lastTx').val() == newData.child('tx').val())`;
P.welcomeGift={
 '.read':STAFF,
 $k:{
  '.read':`${OWNER} || ${STAFF}`,
  '.write':giftWrite,
  '.validate':"!newData.exists() || ($k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['tx','at']))",
  tx:{'.validate':'newData.isString() && newData.val().length <= 64'},
  at:{'.validate':'newData.isNumber() && newData.val() <= now + 60000'},
  amount:{'.validate':`newData.val() == ${AMT}`},
  $other:{'.validate':false}
 }
};

// 2. 交易明細：多一種 type welcome（amount 剛好 350、ref＝自己的編號、同一次寫入有領取紀錄）
const tx=P.walletTx.$k.$tx;
if(!tx['.write'].includes(MARK)){
 tx['.write']+=` || (${OWNER} && !data.exists() && ${OPEN} && newData.child('type').val() == 'welcome' && newData.child('ref').val() == $tx && newData.child('amount').val() == ${AMT} && newData.parent().parent().parent().${MARK}.child($k).child('tx').val() == $tx && newData.parent().parent().parent().child('wallet').child($k).child('lastTx').val() == $tx && ((!root.child('peiwan/wallet').child($k).child('balance').exists() && newData.parent().parent().parent().child('wallet').child($k).child('balance').val() == ${AMT}) || newData.parent().parent().parent().child('wallet').child($k).child('balance').val() == root.child('peiwan/wallet').child($k).child('balance').val() + ${AMT}))`;
}

// 3. 餘額：本人可以剛好加 350（只在同一次寫入有新的 welcome 交易與領取紀錄時）
const bal=P.wallet.$k.balance;
if(!bal['.write'].includes(MARK)){
 const LT=`newData.parent().child('lastTx').val()`;
 bal['.write']+=` || (${OWNER} && ${OPEN} && newData.isNumber() && ${LT} != null && ${LT} != data.parent().child('lastTx').val() && !root.child('peiwan/walletTx').child($k).child(${LT}).exists() && newData.parent().parent().parent().child('walletTx').child($k).child(${LT}).child('type').val() == 'welcome' && newData.parent().parent().parent().${MARK}.child($k).child('tx').val() == ${LT} && ((!data.exists() && newData.val() == ${AMT}) || (data.exists() && newData.val() == data.val() + ${AMT})))`;
}
// lastTx 原本的規則已允許本人指向同一次寫入新增的交易，不需修改。

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase6 applied: welcomeGift / walletTx welcome / wallet balance +'+AMT+' until '+new Date(END).toISOString());
