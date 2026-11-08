// v507 小屋擴建（D 11/08：花比較多的貓貓幣可以擴建）。可重複執行，不會重複套用。
// 1. house/<key>/size：14 → 18 → 22，本人一次只能往上擴一級，而且同一次寫入要有這張新訂單（sizeRef 指向它）：
//    myKey＝本人、itemId＝'house:size<新大小>'、type shop、status done、paidBy cat，amount ≥ shopConfig/house:size<新大小>/price。
//    訂單本身照第九、十批：shopConfig 標 cur:'cat' 才能付貓貓幣、catAmount＝amount×10、同一次寫入 catTx spend 與扣款。
//    大小沒變照過（重存整間小屋）；店員可以直接設 14／18／22（退款後改回來）。不能跳級、不能縮小、不能沿用舊訂單。
// 2. house/<key>/sizeRef：訂單編號格式。
// 3. houseView/<key>/size：拜訪看到的房間大小，14／18／22，而且不能比 house/<key>/size（同一次寫入後的）大。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
if(!P.house||!P.houseView)throw Error('phase11/14 not applied');
const H=P.house.$k,V=P.houseView.$k;
if(H.size&&V.size){console.log('phase17 already applied');process.exit(0);}

// ── 1、2. house/<key>/size、sizeRef ──
{
 const REF="newData.parent().child('sizeRef')";
 const ORD=`newData.parent().parent().parent().child('clientOrders').child(${REF}.val())`;
 const PRICE=n=>`root.child('peiwan/shopConfig').child('house:size${n}').child('price')`;
 // 先確認 sizeRef 是合法字串再拿去找訂單（child(null) 會讓整條規則失敗）
 const paid=n=>`(newData.val() == ${n} && ${REF}.isString() && ${REF}.val().matches(/^[A-Za-z0-9_-]{1,40}$/)`
  +` && ${ORD}.exists() && !root.child('peiwan/clientOrders').child(${REF}.val()).exists()`
  +` && ${ORD}.child('myKey').val() == $k && ${ORD}.child('itemId').val() == 'house:size${n}' && ${ORD}.child('type').val() == 'shop'`
  +` && ${ORD}.child('status').val() == 'done' && ${ORD}.child('paidBy').val() == 'cat'`
  +` && ${PRICE(n)}.isNumber() && ${ORD}.child('amount').isNumber() && ${ORD}.child('amount').val() >= ${PRICE(n)}.val())`;
 const step="((newData.val() == 18 && (!data.exists() || data.val() == 14)) || (newData.val() == 22 && data.val() == 18))";
 H.size={'.validate':`newData.isNumber() && (newData.val() == 14 || newData.val() == 18 || newData.val() == 22)`
  +` && (${STAFF} || newData.val() == data.val() || (${step} && (${paid(18)} || ${paid(22)})))`};
 H.sizeRef={'.validate':"newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,40}$/)"};
}

// ── 3. houseView/<key>/size ──
{
 const HS="newData.parent().parent().parent().child('house').child($k).child('size')";
 V.size={'.validate':`newData.isNumber() && (newData.val() == 14 || ((newData.val() == 18 || newData.val() == 22) && ${HS}.isNumber() && ${HS}.val() >= newData.val()))`};
}

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase17 applied: house size (paid one-step expansion) and houseView size');
