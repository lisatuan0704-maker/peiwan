// Phase 2: coins and purchases must be real. Applied on top of phase 1 output.
// A customer purchase is one multi-path update that must contain, consistently:
//   clientOrders/<id>          the order (amount, itemId, myKey, paidBy:'wallet')
//   walletTx/<key>/<tx>        a NEW spend record, amount == -paid
//   wallet/<key>/balance       old balance + tx.amount (never below 0)
//   wallet/<key>/lastTx        == <tx>   (links the balance change to that record)
//   owned/<key>/<item>         {ref:<id>,...} only if the order paid at least the shop price
// Staff (admin/partners/kefu via links) and the backend (admin SDK) are unrestricted as before.
'use strict';
const fs=require('fs');
const [,,input,output]=process.argv;
const doc=JSON.parse(fs.readFileSync(input,'utf8'));
const P=doc.rules.peiwan;

const STAFF="(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))";
const NEW="newData.parent().parent().parent()"; // peiwan/ after this write, from a node 3 levels down (e.g. wallet/$k/balance)

// ---- wallet ---------------------------------------------------------------
// balance: staff may set anything (top-ups, refunds). Customers may only spend, and only together with a new spend record.
const LAST=`newData.parent().child('lastTx').val()`;
P.wallet={
  '.read':true,
  '$k':{
    'balance':{
      '.write':`${STAFF} || (data.exists() && newData.isNumber() && newData.val() < data.val()`
        +` && ${LAST} != null && ${LAST} != data.parent().child('lastTx').val()`
        +` && !root.child('peiwan/walletTx').child($k).child(${LAST}).exists()`
        +` && ${NEW}.child('walletTx').child($k).child(${LAST}).child('amount').val() == newData.val() - data.val())`,
      '.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() % 1 == 0'
    },
    'lastTx':{
      '.write':`${STAFF} || (newData.isString() && newData.val() != data.val() && ${NEW}.child('walletTx').child($k).child(newData.val()).exists() && !root.child('peiwan/walletTx').child($k).child(newData.val()).exists())`,
      '.validate':'newData.isString() && newData.val().length <= 64'
    }
  }
};

// ---- walletTx: history can no longer be forged, edited or deleted by customers ----
const TXP='newData.parent().parent().parent()'; // peiwan/ from walletTx/$k/$tx
P.walletTx={
  '.read':true,
  '.write':STAFF,
  '$k':{
    '.write':STAFF,
    '$tx':{
      '.write':`${STAFF} || (!data.exists() && newData.child('type').val() == 'spend' && newData.child('ref').val() == $tx`
        +` && newData.child('amount').isNumber() && newData.child('amount').val() < 0 && newData.child('amount').val() % 1 == 0`
        +` && ${TXP}.child('wallet').child($k).child('lastTx').val() == $tx`
        +` && ${TXP}.child('wallet').child($k).child('balance').val() == root.child('peiwan/wallet').child($k).child('balance').val() + newData.child('amount').val())`
    }
  }
};

// ---- clientOrders: what a customer may create --------------------------------
// bank transfer / top-up: must start as 'pending' (the manager confirms the money arrived).
// coin payment: must be backed by a new spend record of at least the order amount.
const OP='newData.parent().parent()'; // peiwan/ from clientOrders/$id
const TXOF=id=>`${OP}.child('walletTx').child(newData.child('myKey').val()).child(${id})`;
const PAID_SINGLE=`(!newData.child('groupId').exists() && ${TXOF('$id')}.child('amount').val() == -newData.child('amount').val() && !root.child('peiwan/walletTx').child(newData.child('myKey').val()).child($id).exists())`;
const PAID_GROUP=`(newData.child('groupId').isString() && ${TXOF("newData.child('groupId').val()")}.exists() && !root.child('peiwan/walletTx').child(newData.child('myKey').val()).child(newData.child('groupId').val()).exists() && -${TXOF("newData.child('groupId').val()")}.child('amount').val() >= newData.child('amount').val())`;
P.clientOrders.$id={
  '.write':`(!data.exists() && newData.exists() && newData.child('myKey').isString() && newData.child('amount').isNumber() && newData.child('amount').val() >= 0 && newData.child('amount').val() % 1 == 0`
    +` && ((newData.child('paidBy').val() != 'wallet' && newData.child('status').val() == 'pending')`
    +` || (newData.child('paidBy').val() == 'wallet' && (newData.child('status').val() == 'done' || newData.child('status').val() == 'confirmed') && (${PAID_SINGLE} || ${PAID_GROUP}))))`
    +` || ${STAFF}`
};

// ---- owned: items only appear when they were paid for --------------------------
// price = shopConfig/<item>/price; chat bubbles 50; dye ticket shopConfig/dyeTicket/price or 299;
// part units <set>::hair|face|cloth|accN use shopConfig/<set>/partPrices/<unit> or config/partPricing/<kind>.
// A VIP coupon can take at most 200 off (the largest VIP coupon).
const OWN='newData.parent().parent().parent()'; // peiwan/ from owned/$k/$item
const ORD=`${OWN}.child('clientOrders').child(newData.child('ref').val())`;
const OFF=`(${ORD}.child('couponUsed').val() == true ? 200 : 0)`;
const AMT=`${ORD}.child('amount').val()`;
const CFG=`root.child('peiwan/shopConfig')`;
const PP=`root.child('peiwan/config/partPricing')`;
function partUnit(kind,suffixes){
  return suffixes.map(sfx=>{
    const set=`$item.replace('${sfx}','')`;
    const over=`${CFG}.child(${set}).child('partPrices').child('${sfx.slice(2)}')`;
    return `($item.endsWith('${sfx}') && ((${over}.isNumber() && ${AMT} >= ${over}.val() - ${OFF}) || (!${over}.exists() && ${PP}.child('${kind}').isNumber() && ${PP}.child('${kind}').val() > 0 && ${AMT} >= ${PP}.child('${kind}').val() - ${OFF})))`;
  }).join(' || ');
}
const ACC=Array.from({length:12},(_,i)=>'::acc'+i);
const PRICE_OK=`(`
  +`($item.beginsWith('bubble_') && ${AMT} >= 50)`
  +` || (!$item.contains('::') && !$item.beginsWith('bubble_') && ${CFG}.child($item).child('price').isNumber() && ${AMT} >= ${CFG}.child($item).child('price').val() - ${OFF})`
  +` || ${partUnit('hair',['::hair'])} || ${partUnit('face',['::face'])} || ${partUnit('cloth',['::cloth'])} || ${partUnit('acc',ACC)}`
  +`)`;
const PURCHASED=`(!data.exists() && newData.child('ref').isString()`
  +` && ${ORD}.exists() && !root.child('peiwan/clientOrders').child(newData.child('ref').val()).exists()`
  +` && ${ORD}.child('myKey').val() == $k && ${ORD}.child('itemId').val() == $item && ${ORD}.child('type').val() == 'shop' && ${ORD}.child('paidBy').val() == 'wallet'`
  +` && ${PRICE_OK})`;
// Dye tickets: +1 only together with a paid dyeTicket order; -1 only together with a new saved dye set.
const DT_ORDER=`${OWN}.child('clientOrders').child(${OWN}.child('wallet').child($k).child('lastTx').val())`;
const DYE_BUY=`(newData.val() == (data.exists() ? data.val() : 0) + 1 && ${DT_ORDER}.child('itemId').val() == 'dyeTicket' && ${DT_ORDER}.child('myKey').val() == $k && ${DT_ORDER}.child('paidBy').val() == 'wallet'`
  +` && !root.child('peiwan/clientOrders').child(${OWN}.child('wallet').child($k).child('lastTx').val()).exists()`
  +` && ((${CFG}.child('dyeTicket/price').isNumber() && ${DT_ORDER}.child('amount').val() >= ${CFG}.child('dyeTicket/price').val() - (${DT_ORDER}.child('couponUsed').val() == true ? 200 : 0)) || (!${CFG}.child('dyeTicket/price').exists() && ${DT_ORDER}.child('amount').val() >= 299 - (${DT_ORDER}.child('couponUsed').val() == true ? 200 : 0))))`;
const DL=`newData.parent().child('dyeLast').val()`;
const DYE_USE=`(data.exists() && newData.val() == data.val() - 1 && ${DL} != null && ${DL} != data.parent().child('dyeLast').val() && newData.parent().child('dyedHairSets').child(${DL}).exists() && !data.parent().child('dyedHairSets').child(${DL}).exists())`;
P.owned={
  '.read':true,
  '.write':STAFF,
  '$k':{
    '.write':STAFF,
    '$item':{
      '.write':`${STAFF} || ($item != 'dyeTickets' && $item != 'dyedHairSets' && $item != 'dyeLast' && ${PURCHASED})`
    },
    'dyeTickets':{
      '.write':`${STAFF} || ${DYE_BUY} || ${DYE_USE}`,
      '.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() % 1 == 0'
    },
    'dyeLast':{
      '.write':`${STAFF} || (newData.isString() && newData.val() != data.val() && newData.parent().child('dyeTickets').val() == data.parent().child('dyeTickets').val() - 1 && newData.parent().child('dyedHairSets').child(newData.val()).exists() && !data.parent().child('dyedHairSets').child(newData.val()).exists())`
    },
    'dyedHairSets':{
      '$req':{
        // saving a dye uses exactly one ticket in the same write
        '.write':`${STAFF} || (!data.exists() && newData.exists() && newData.parent().parent().child('dyeTickets').val() == data.parent().parent().child('dyeTickets').val() - 1 && newData.parent().parent().child('dyeLast').val() == $req)`
      }
    }
  }
};

fs.writeFileSync(output,JSON.stringify(doc,null,2)+'\n');
console.log('written',output,'size',fs.statSync(output).size);
