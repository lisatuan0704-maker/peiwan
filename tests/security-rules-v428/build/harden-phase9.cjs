// v492 雙幣制：新增貓貓幣（peiwan/cat、peiwan/catTx），時裝類商品改用貓貓幣付款，金幣可單向換成貓貓幣。
// 以目前的 security/database.rules.json（第八批）為底；可重複執行，不會重複套用。
// 1. cat/<key>：balance＋lastTx。本人只能「花掉（spend）」「每日任務 +100」「用金幣兌換」三種寫法，其餘只有店員可寫。
// 2. catTx/<key>/<tx>：spend（負數）／daily（+100，2026-11-07 起）／exchange（金幣 N → 貓貓幣 N×10＋加送）。
// 3. 兌換＝同一次寫入：walletTx exchange −N、wallet 扣 N、catTx exchange +N×10＋加送、cat 加同額，兩邊交易編號相同。
// 4. 時裝訂單 clientOrders paidBy 'cat'：amount 仍記「金幣等值價」（背包規則照舊比價），catAmount＝amount×10，
//    同一次寫入 catTx spend −catAmount。paidBy 'cat' 不能用「待確認」狀態跳過付款。
// 5. 每日任務 2026-11-07 00:00（台北）起改送 100 貓貓幣，之前照舊 10 金幣。
// 6. 金幣交易明細的 exchange 不能被訂單拿去當付款紀錄。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const OWNER=`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`;
const KEYOK=`!newData.exists() || $k.matches(/^[A-Za-z0-9_-]{1,200}$/)`;
const RATE=10,DAILY=100,CUT=1793980800000;              // 2026-11-07 00:00 台北
const DAY=`(((now + 28800000) - (now + 28800000) % 86400000) / 86400000)`;
const NOT_CLAIMED=`(!root.child('peiwan/dailyTask').child($k).child('day').exists() || root.child('peiwan/dailyTask').child($k).child('day').val() < ${DAY})`;
// 兌換加送：剛好 350 送 200、剛好 1000 送 1000，其他數量不加送
const BONUS=c=>`(${c} == 350 ? 200 : ${c} == 1000 ? 1000 : 0)`;
const DONE="'peiwan/cat'";
if(P.cat){console.log('phase9 already applied');process.exit(0);}

// ── 1. cat/<key> ──
{
 const W='newData.parent().parent().parent()',LT="newData.parent().child('lastTx').val()";
 const NT=`${W}.child('catTx').child($k).child(${LT})`;
 const BASE=`${OWNER} && newData.isNumber() && ${LT} != null && ${LT} != data.parent().child('lastTx').val() && !root.child('peiwan/catTx').child($k).child(${LT}).exists()`;
 const ADD=a=>`((!data.exists() && newData.val() == ${a}) || (data.exists() && newData.val() == data.val() + ${a}))`;
 P.cat={
  '.read':STAFF,
  $k:{
   '.read':`${OWNER} || ${STAFF}`,
   '.validate':KEYOK,
   balance:{
    '.write':[
     STAFF,
     `(${BASE} && data.exists() && newData.val() < data.val() && ${NT}.child('type').val() == 'spend' && ${NT}.child('amount').val() == newData.val() - data.val())`,
     `(${BASE} && now >= ${CUT} && ${NOT_CLAIMED} && ${NT}.child('type').val() == 'daily' && ${W}.child('dailyTask').child($k).child('tx').val() == ${LT} && ${W}.child('dailyTask').child($k).child('day').val() == ${DAY} && ${ADD(DAILY)})`,
     `(${BASE} && ${NT}.child('type').val() == 'exchange' && ${NT}.child('amount').isNumber() && ${NT}.child('amount').val() > 0 && ${ADD(`${NT}.child('amount').val()`)})`
    ].join(' || '),
    '.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() % 1 == 0'
   },
   lastTx:{
    '.write':`${STAFF} || (${OWNER} && newData.isString() && newData.val() != data.val() && newData.parent().parent().parent().child('catTx').child($k).child(newData.val()).exists() && !root.child('peiwan/catTx').child($k).child(newData.val()).exists())`,
    '.validate':'newData.isString() && newData.val().length <= 64'
   },
   $other:{'.validate':false}
  }
 };
}

// ── 2. catTx/<key>/<tx> ──
{
 const W='newData.parent().parent().parent()';
 const CB=`${W}.child('cat').child($k).child('balance').val()`,RB=`root.child('peiwan/cat').child($k).child('balance')`;
 const SETS=a=>`((!${RB}.exists() && ${CB} == ${a}) || ${CB} == ${RB}.val() + ${a})`;
 const AMT="newData.child('amount')",COIN="newData.child('coin')";
 const WT=`${W}.child('walletTx').child($k).child($tx)`;
 P.catTx={
  '.read':STAFF,
  '.write':STAFF,
  $k:{
   '.read':`${OWNER} || ${STAFF}`,
   '.write':STAFF,
   '.validate':KEYOK,
   $tx:{
    '.write':[
     STAFF,
     // 花掉：負整數，餘額同步減少
     `(${OWNER} && !data.exists() && newData.child('type').val() == 'spend' && newData.child('ref').val() == $tx && ${AMT}.isNumber() && ${AMT}.val() < 0 && ${AMT}.val() % 1 == 0 && ${W}.child('cat').child($k).child('lastTx').val() == $tx && ${CB} == ${RB}.val() + ${AMT}.val())`,
     // 每日任務：2026-11-07 起 +100
     `(${OWNER} && !data.exists() && now >= ${CUT} && ${NOT_CLAIMED} && newData.child('type').val() == 'daily' && newData.child('ref').val() == $tx && ${AMT}.val() == ${DAILY} && ${W}.child('dailyTask').child($k).child('tx').val() == $tx && ${W}.child('dailyTask').child($k).child('day').val() == ${DAY} && ${W}.child('cat').child($k).child('lastTx').val() == $tx && ${SETS(DAILY)})`,
     // 兌換：金幣 coin → 貓貓幣 coin×10＋加送；同一次寫入扣金幣
     `(${OWNER} && !data.exists() && newData.child('type').val() == 'exchange' && newData.child('ref').val() == $tx && ${COIN}.isNumber() && ${COIN}.val() % 1 == 0 && ${COIN}.val() >= 1 && ${COIN}.val() <= 100000 && ${AMT}.val() == ${COIN}.val() * ${RATE} + ${BONUS(`${COIN}.val()`)} && !root.child('peiwan/walletTx').child($k).child($tx).exists() && ${WT}.child('type').val() == 'exchange' && ${WT}.child('amount').val() == -${COIN}.val() && ${W}.child('wallet').child($k).child('lastTx').val() == $tx && ${W}.child('wallet').child($k).child('balance').val() == root.child('peiwan/wallet').child($k).child('balance').val() - ${COIN}.val() && ${W}.child('cat').child($k).child('lastTx').val() == $tx && ${SETS(`${AMT}.val()`)})`
    ].join(' || '),
    '.validate':"!newData.exists() || ($tx.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['type','amount']))",
    amount:{'.validate':'newData.isNumber() && newData.val() % 1 == 0'}
   }
  }
 };
}

// ── 3. walletTx：新增 exchange（扣金幣、同一次寫入有對應的貓貓幣兌換）；每日任務的金幣分支只到 11/06 ──
{
 const tx=P.walletTx.$k.$tx;
 const W='newData.parent().parent().parent()';
 const CT=`${W}.child('catTx').child($k).child($tx)`;
 tx['.write']+=` || (${OWNER} && !data.exists() && newData.child('type').val() == 'exchange' && newData.child('ref').val() == $tx && newData.child('amount').isNumber() && newData.child('amount').val() < 0 && newData.child('amount').val() % 1 == 0 && ${W}.child('wallet').child($k).child('lastTx').val() == $tx && ${W}.child('wallet').child($k).child('balance').val() == root.child('peiwan/wallet').child($k).child('balance').val() + newData.child('amount').val() && ${CT}.child('type').val() == 'exchange' && ${CT}.child('coin').val() == -newData.child('amount').val() && !root.child('peiwan/catTx').child($k).child($tx).exists())`;
 const daily="newData.child('type').val() == 'daily'";
 if(!tx['.write'].includes(daily))throw Error('walletTx daily branch not found');
 tx['.write']=tx['.write'].replace(daily,`now < ${CUT} && ${daily}`);
 const bal=P.wallet.$k.balance;
 const bdaily=`child('type').val() == 'daily'`;
 const i=bal['.write'].indexOf(bdaily);if(i<0)throw Error('wallet daily branch not found');
 // 在每日任務分支開頭加上時間限制
 const start=bal['.write'].lastIndexOf(' || (',i);
 bal['.write']=bal['.write'].slice(0,start)+` || (now < ${CUT} && `+bal['.write'].slice(start+5);
}

// ── 4. dailyTask：11/07 前看金幣、之後看貓貓幣 ──
{
 const d=P.dailyTask.$k;
 const oldTail=`newData.parent().parent().child('walletTx').child($k).child(newData.child('tx').val()).child('type').val() == 'daily' && newData.parent().parent().child('wallet').child($k).child('lastTx').val() == newData.child('tx').val())`;
 if(!d['.write'].endsWith(oldTail))throw Error('dailyTask tail not found');
 d['.write']=d['.write'].slice(0,-oldTail.length)+`((now < ${CUT} && newData.parent().parent().child('walletTx').child($k).child(newData.child('tx').val()).child('type').val() == 'daily' && newData.parent().parent().child('wallet').child($k).child('lastTx').val() == newData.child('tx').val()) || (now >= ${CUT} && newData.parent().parent().child('catTx').child($k).child(newData.child('tx').val()).child('type').val() == 'daily' && newData.parent().parent().child('cat').child($k).child('lastTx').val() == newData.child('tx').val())))`;
 d.amount['.validate']=`(now < ${CUT} && newData.val() == 10) || (now >= ${CUT} && newData.val() == ${DAILY})`;
}

// ── 5. clientOrders：paidBy 'cat'；待確認狀態不能用 cat；金幣訂單不能拿 exchange 當付款紀錄 ──
{
 const co=P.clientOrders.$id;let w=co['.write'];
 const pend=`(newData.child('paidBy').val() != 'wallet' && newData.child('status').val() == 'pending')`;
 if(!w.includes(pend))throw Error('pending branch not found');
 const W='newData.parent().parent()',MK="newData.child('myKey').val()";
 const CT=`${W}.child('catTx').child(${MK}).child($id)`;
 const catPay=`(newData.child('paidBy').val() == 'cat' && newData.child('type').val() == 'shop' && newData.child('status').val() == 'done' && !newData.child('groupId').exists() && newData.child('catAmount').isNumber() && newData.child('catAmount').val() == newData.child('amount').val() * ${RATE} && ${CT}.child('type').val() == 'spend' && ${CT}.child('amount').val() == -newData.child('catAmount').val() && !root.child('peiwan/catTx').child(${MK}).child($id).exists())`;
 w=w.replace(pend,`(newData.child('paidBy').val() != 'wallet' && newData.child('paidBy').val() != 'cat' && newData.child('status').val() == 'pending') || ${catPay}`);
 // 金幣付款紀錄不可是兌換
 const one=`${W}.child('walletTx').child(${MK}).child($id).child('amount').val() == -newData.child('amount').val()`;
 if(!w.includes(one))throw Error('wallet single branch not found');
 w=w.replace(one,`${one} && ${W}.child('walletTx').child(${MK}).child($id).child('type').val() != 'exchange'`);
 const grp=`${W}.child('walletTx').child(${MK}).child(newData.child('groupId').val()).exists()`;
 if(!w.includes(grp))throw Error('wallet group branch not found');
 w=w.replace(grp,`${grp} && ${W}.child('walletTx').child(${MK}).child(newData.child('groupId').val()).child('type').val() != 'exchange'`);
 co['.write']=w;
 co.catAmount={'.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() % 1 == 0'};
}

// ── 6. 背包：時裝訂單可以是 wallet 或 cat ──
{
 const it=P.owned.$k.$item;
 const a=`newData.parent().parent().parent().child('clientOrders').child(newData.child('ref').val()).child('paidBy').val() == 'wallet'`;
 if(!it['.write'].includes(a))throw Error('owned paidBy not found');
 it['.write']=it['.write'].split(a).join(`(${a} || newData.parent().parent().parent().child('clientOrders').child(newData.child('ref').val()).child('paidBy').val() == 'cat')`);
 // 染髮券：再加一條「以 cat/<key>/lastTx 找訂單」的 +1 分支（複製金幣版，改看 cat）
 const dy=P.owned.$k.dyeTickets;
 const s=dy['.write'],i=s.indexOf('((newData.val() == (data.exists() ? data.val() : 0) + 1 && '),j=s.indexOf(' || (data.exists() && newData.val() == data.val() - 1');
 if(i<0||j<i)throw Error('dye +1 branch not found');
 // 「+1」整個括號分支。child(null) 在規則裡是錯誤、會讓整條規則失敗（不只這個分支），
 // 所以先確認 lastTx 存在再拿它找訂單：沒有金幣紀錄的人用貓貓幣買、沒有貓貓幣紀錄的人用金幣買都不會被誤擋。
 const PLUS='(newData.val() == (data.exists() ? data.val() : 0) + 1 && ';
 const A0=s.slice(i+1,j);if(!A0.startsWith(PLUS))throw Error('dye +1 branch shape changed');
 const A=PLUS+`newData.parent().parent().parent().child('wallet').child($k).child('lastTx').exists() && `+A0.slice(PLUS.length);
 const catA=A.split(`child('wallet').child($k).child('lastTx')`).join(`child('cat').child($k).child('lastTx')`).split(`child('paidBy').val() == 'wallet'`).join(`child('paidBy').val() == 'cat'`);
 if(catA===A||A.includes("== 'cat'")||!catA.includes("== 'cat'")||catA.includes("child('wallet')"))throw Error('dye cat branch build failed');
 dy['.write']=s.slice(0,i+1)+A+' || '+catA+s.slice(j);
}

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase9 applied: cat/catTx, exchange 1:'+RATE+', daily '+DAILY+' cat from '+new Date(CUT).toISOString());
