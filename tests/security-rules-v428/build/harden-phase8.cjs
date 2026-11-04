// v491 VIP 回饋金幣（取代點單優惠券）：VIP 1～5 各送一次 150／500／800／1200／1500 金幣，由本人領取。
// 以目前的 security/database.rules.json（第七批）為底；可重複執行，不會重複套用。
// 等級以店長頁確認的 peiwan/vipServer/<key>/lv 為準（客人改不了）。
// 一次領取必須同時寫入：vipGift/<key>/<等級>（不能已存在）＋ walletTx/<key>/<tx>（type vipgift、lv、amount 剛好）
// ＋ wallet/<key>/lastTx＝tx ＋ wallet/<key>/balance 剛好加這個金額（沒有錢包時從 0 開始）。
// 同時停用優惠券：所有價格檢查中的「優惠券可折金額」改為 0。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const MARK="child('vipGift')";
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const OWNER=`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`;
const GIFT={1:150,2:500,3:800,4:1200,5:1500};
const AMT=L=>`(${L} == '1' ? ${GIFT[1]} : ${L} == '2' ? ${GIFT[2]} : ${L} == '3' ? ${GIFT[3]} : ${L} == '4' ? ${GIFT[4]} : ${L} == '5' ? ${GIFT[5]} : -1)`;
const LVV=`root.child('peiwan/vipServer').child($k).child('lv')`;
const REACHED=L=>`(${LVV}.isNumber() && ((${L} == '1' && ${LVV}.val() >= 1) || (${L} == '2' && ${LVV}.val() >= 2) || (${L} == '3' && ${LVV}.val() >= 3) || (${L} == '4' && ${LVV}.val() >= 4) || (${L} == '5' && ${LVV}.val() >= 5)))`;

// 1. 領取紀錄：本人與店員可讀；本人每個已達到的等級只能新增一次
const NROOT='newData.parent().parent().parent()';
P.vipGift={
 '.read':STAFF,
 $k:{
  '.read':`${OWNER} || ${STAFF}`,
  $lv:{
   '.write':`${STAFF} || (${OWNER} && !data.exists() && ${REACHED('$lv')} && newData.child('tx').isString() && ${NROOT}.child('walletTx').child($k).child(newData.child('tx').val()).child('type').val() == 'vipgift' && ${NROOT}.child('walletTx').child($k).child(newData.child('tx').val()).child('lv').val() == $lv && ${NROOT}.child('wallet').child($k).child('lastTx').val() == newData.child('tx').val())`,
   '.validate':`!newData.exists() || ($lv.matches(/^[1-5]$/) && $k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['tx','at','amount']))`,
   tx:{'.validate':'newData.isString() && newData.val().length <= 64'},
   at:{'.validate':'newData.isNumber() && newData.val() <= now + 60000'},
   amount:{'.validate':`newData.val() == ${AMT('$lv')}`},
   $other:{'.validate':false}
  }
 }
};

// 2. 交易明細：多一種 type vipgift（lv 是已達到的等級、amount 剛好、同一次寫入有領取紀錄、這個等級以前沒領過）
const tx=P.walletTx.$k.$tx;
if(!tx['.write'].includes(MARK)){
 const L="newData.child('lv').val()",W=`newData.parent().parent().parent()`;
 tx['.write']+=` || (${OWNER} && !data.exists() && newData.child('type').val() == 'vipgift' && newData.child('lv').isString() && ${REACHED(L)} && newData.child('ref').val() == $tx && newData.child('amount').val() == ${AMT(L)} && !root.child('peiwan/vipGift').child($k).child(${L}).exists() && ${W}.${MARK}.child($k).child(${L}).child('tx').val() == $tx && ${W}.child('wallet').child($k).child('lastTx').val() == $tx && ((!root.child('peiwan/wallet').child($k).child('balance').exists() && ${W}.child('wallet').child($k).child('balance').val() == ${AMT(L)}) || ${W}.child('wallet').child($k).child('balance').val() == root.child('peiwan/wallet').child($k).child('balance').val() + ${AMT(L)}))`;
}

// 3. 餘額：本人可以剛好加這個等級的金額（只在同一次寫入有新的 vipgift 交易與領取紀錄時）
const bal=P.wallet.$k.balance;
if(!bal['.write'].includes(MARK)){
 const LT=`newData.parent().child('lastTx').val()`,W='newData.parent().parent().parent()';
 const NT=`${W}.child('walletTx').child($k).child(${LT})`,L=`${NT}.child('lv').val()`;
 bal['.write']+=` || (${OWNER} && newData.isNumber() && ${LT} != null && ${LT} != data.parent().child('lastTx').val() && !root.child('peiwan/walletTx').child($k).child(${LT}).exists() && ${NT}.child('type').val() == 'vipgift' && ${NT}.child('lv').isString() && ${REACHED(L)} && !root.child('peiwan/vipGift').child($k).child(${L}).exists() && ${W}.${MARK}.child($k).child(${L}).child('tx').val() == ${LT} && ((!data.exists() && newData.val() == ${AMT(L)}) || (data.exists() && newData.val() == data.val() + ${AMT(L)})))`;
}

// 4. 停用優惠券：v466 依 VIP 等級可折 30～200 的運算式全部換成 0
const LV=k=>`root.child('peiwan/vipServer').child(${k}).child('lv')`;
const OFFBY=k=>`(${LV(k)}.isNumber() ? (${LV(k)}.val() >= 5 ? 200 : ${LV(k)}.val() >= 4 ? 120 : ${LV(k)}.val() >= 3 ? 80 : ${LV(k)}.val() >= 2 ? 50 : ${LV(k)}.val() >= 1 ? 30 : 0) : 0)`;
let s=JSON.stringify(R);let n=0;
for(const k of ['$k',"newData.child('myKey').val()"]){const a=JSON.stringify(OFFBY(k)).slice(1,-1);n+=s.split(a).length-1;s=s.split(a).join('0');}
const R2=JSON.parse(s);
if(s.includes('>= 5 ? 200'))throw Error('coupon discount still present');
fs.writeFileSync(file,JSON.stringify(R2,null,2)+'\n');
console.log('phase8 applied: vipGift '+JSON.stringify(GIFT)+'; coupon discounts removed: '+n);
