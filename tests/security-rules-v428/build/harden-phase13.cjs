// v503 規則第十三批：金幣群組單（多位冒險者一起點，lobby-ui/order-flow.js submitGroup）每張訂單「加總」不能超過那一筆扣款。可重複執行，不會重複套用。
// 群組單寫法（v234 起，同一次寫入）：walletTx/<key>/<groupId> {type:'spend',amount:-整組實付,groupId,orderIds:[每張訂單編號…]}
//   ＋ 每張 clientOrders/<id> {groupId,groupSize,amount＝分攤,type:'play'…}（第一張的編號就是 groupId）。
// 1. 群組分支只給 type play（商城沒有群組結帳；v501 一起結帳是逐件、每件一筆明細）。
// 2. groupSize 是 1～MAX 的整數，明細 orderIds 剛好是 0…groupSize−1 連號 → 同一筆扣款底下每張訂單的人數一定一樣。
// 3. 這張訂單的編號要在 orderIds 第 j 格，且 amount × groupSize ≤ 扣款 + j（＝第 j 格最多 floor((扣款+j)/人數)，
//    全部格子加起來剛好等於扣款）。一格只放得下一個編號，幾張訂單就佔幾格，所以加總一定 ≤ 扣款。
//    零頭少 1 的要排在前面格子，跟 order-flow.js pricing 的 shares 順序一致；改 pricing 要同步這裡。
// 4. 單筆分支（沒有 groupId）不能拿群組明細（有 orderIds 的那筆）來對帳，免得群組第一張單又當單筆把整筆扣款吃掉。
// 一組超過 MAX 位冒險者會被拒（目前店裡 3 位）。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const MAX=10;
const MARK="child('orderIds')";
if(!P.idle)throw Error('phase12 not applied');
const co=P.clientOrders.$id;
if(co['.write'].includes(MARK)){console.log('phase13 already applied');process.exit(0);}
const NA="newData.child('amount').val()",NG="newData.child('groupSize')";
const TX="newData.parent().parent().child('walletTx').child(newData.child('myKey').val())";
const W=`${TX}.child(newData.child('groupId').val())`,WS=`${TX}.child($id)`,OI=`${W}.${MARK}`,D=`-${W}.child('amount').val()`;
const once=(s,from,to)=>{const n=s.split(from).length-1;if(n!==1)throw Error('expected once, found '+n+': '+from.slice(0,90));return s.replace(from,()=>to);};
let w=co['.write'];

// ── 1～3. 群組分支 ──
{
 const SIZE=`${NG}.isNumber() && ${NG}.val() % 1 == 0 && ${NG}.val() >= 1 && ${NG}.val() <= ${MAX} && `
  +Array.from({length:MAX+1},(_,k)=>k===0?`${OI}.child('0').isString()`:k===MAX?`!${OI}.child('${MAX}').exists()`:`(${NG}.val() > ${k} ? ${OI}.child('${k}').isString() : !${OI}.child('${k}').exists())`).join(' && ');
 const SLOT='('+Array.from({length:MAX},(_,j)=>`(${OI}.child('${j}').val() == $id && ${NA} * ${NG}.val() <= ${D}${j?' + '+j:''})`).join(' || ')+')';
 w=once(w,`(newData.child('groupId').isString() && ${W}.exists()`,`(newData.child('groupId').isString() && newData.child('type').val() == 'play' && ${W}.exists()`);
 w=once(w,`${D} >= ${NA})`,`${SIZE} && ${SLOT})`);
}

// ── 4. 單筆分支 ──
w=once(w,`(!newData.child('groupId').exists() && ${WS}.child('amount')`,`(!newData.child('groupId').exists() && !${WS}.${MARK}.exists() && ${WS}.child('amount')`);

co['.write']=w;
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase13 applied: wallet group orders sum ≤ spend, max '+MAX+' per group');
