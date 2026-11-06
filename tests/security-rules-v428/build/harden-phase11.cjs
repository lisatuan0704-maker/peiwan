// v494 小屋第一批家具：新增 peiwan/houseInv（買到的家具）與 peiwan/house（擺設）。可重複執行，不會重複套用。
// 1. houseInv/<key>/<家具>/<訂單編號> {ts}：每買一件一筆。本人只能「新增」，同一次寫入要有這張新訂單：
//    myKey＝本人、itemId＝'house:<家具>'、type shop、status done、paidBy cat，amount ≥ shopConfig/house:<家具>/price。
//    （訂單本身照第九、十批：cur:'cat' 才能付貓貓幣、catAmount＝amount×10、同一次寫入 catTx spend 與扣款。）
//    本人不能改、不能刪（退款由店員處理）；本人與店員可讀。
// 2. house/<key> {layout,at}：本人與店員可讀寫。layout 每件只能是上架的家具（shopConfig 有 house:<t>）或入住禮四件，
//    欄位只收 t／i／j／dir／wall／c／z／u／v／on，數字有範圍。擺設只是外觀，不檢查件數（之後開放拜訪再加）。
// 日常系列（daily_*）不用新規則：背包 owned 的一般商品分支照 shopConfig price 比價，第十批檢查 cur:'cat'。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const OWNER=`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`;
const STARTER=['vr_rug','vr_bed','vr_chair','vr_window'];   // 入住禮（house/catalog.json 的 starter），不用買
if(!P.cat)throw Error('phase9 not applied');
if(!P.clientOrders.$id['.write'].includes("child('cur').val() == 'cat'"))throw Error('phase10 not applied');
if(P.houseInv||P.house){console.log('phase11 already applied');process.exit(0);}

// ── 1. houseInv ──
{
 const ORD="newData.parent().parent().parent().parent().child('clientOrders').child($oid)";
 const PRICE="root.child('peiwan/shopConfig').child('house:' + $item).child('price')";
 P.houseInv={'$k':{
  '.read':`${STAFF} || ${OWNER}`,
  '.write':STAFF,
  '.validate':"$k.matches(/^[A-Za-z0-9_-]{1,200}$/)",
  '$item':{
   '.validate':"$item.matches(/^[a-z0-9_]{1,60}$/)",
   '$oid':{
    '.write':`${OWNER} && !data.exists() && newData.exists() && ${ORD}.exists() && !root.child('peiwan/clientOrders').child($oid).exists()`
      +` && ${ORD}.child('myKey').val() == $k && ${ORD}.child('itemId').val() == 'house:' + $item && ${ORD}.child('type').val() == 'shop'`
      +` && ${ORD}.child('status').val() == 'done' && ${ORD}.child('paidBy').val() == 'cat' && ${PRICE}.isNumber() && ${ORD}.child('amount').val() >= ${PRICE}.val()`,
    '.validate':"$oid.matches(/^[A-Za-z0-9_-]{1,40}$/) && newData.hasChildren(['ts'])",
    'ts':{'.validate':'newData.isNumber()'},
    '$other':{'.validate':false}}}}};
}

// ── 2. house ──
{
 const num=(a,b)=>`newData.isNumber() && newData.val() >= ${a} && newData.val() <= ${b}`;
 const T="newData.child('t')";
 const okT=`${T}.isString() && ${T}.val().matches(/^[a-z0-9_]{1,60}$/) && (root.child('peiwan/shopConfig').child('house:' + ${T}.val()).exists() || ${STARTER.map(k=>`${T}.val() == '${k}'`).join(' || ')})`;
 P.house={'$k':{
  '.read':`${STAFF} || ${OWNER}`,
  '.write':`${STAFF} || ${OWNER}`,
  '.validate':"$k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['layout'])",
  'at':{'.validate':'newData.isNumber()'},
  'layout':{'$i':{
   '.validate':`$i.matches(/^[0-9]{1,3}$/) && newData.hasChildren(['t']) && ${okT}`,
   't':{'.validate':'newData.isString()'},
   'i':{'.validate':num(-2,30)},'j':{'.validate':num(-2,30)},'c':{'.validate':num(-2,30)},
   'dir':{'.validate':num(0,3)},'z':{'.validate':num(-20,20)},'u':{'.validate':num(-2,30)},'v':{'.validate':num(-2,30)},'on':{'.validate':num(0,999)},
   'wall':{'.validate':"newData.val() == 'L' || newData.val() == 'R'"},
   '$other':{'.validate':false}}},
  '$other':{'.validate':false}}};
}

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase11 applied: houseInv (buy with cat order, add-only) and house layout');
