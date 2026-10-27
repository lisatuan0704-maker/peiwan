// Phase 3: customers act only as their own character.
// Customers sign in through /v1/voice/session (server verifies Discord, binds secureV1/members/<uid> <-> owners/<key>).
// OWNER(k): the signed-in Discord account owns character key k.
'use strict';
const fs=require('fs');
const [,,input,output]=process.argv;
const doc=JSON.parse(fs.readFileSync(input,'utf8'));
const P=doc.rules.peiwan,S=doc.rules.secureV1;

const ADMIN="(auth != null && auth.uid == root.child('peiwan/config/adminUid').val())";
const STAFF="(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))";
const ME="(auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true)";
const MK="root.child('secureV1/members').child(auth.uid).child('key').val()";
const OWNER=k=>`(${ME} && root.child('secureV1/owners').child(${k}).val() == auth.uid && ${MK} == ${k})`;
const REF="root.child('peiwan/links').child(auth.uid).child('refId').val()";
const PARTNER="(auth != null && root.child('peiwan/links').child(auth.uid).child('type').val() == 'char')";
const STAFFDM=`('staff_' + ${REF})`;
const inPair=(pair,who)=>`(${pair}.beginsWith(${who} + '~') || ${pair}.endsWith('~' + ${who}))`;

// ---- character profile & presence -----------------------------------------------
// A brand-new character may be created by anyone (the card page runs before login); after that only its owner (or staff) can change it.
const NEW_CHAR=`(!data.exists() && newData.exists())`;
// keep the existing $key children (pub/frm: companion frames can only come from the server-verified record)
const lobbyKey=P.lobby.$key||{};
P.lobby={'.read':true,'$key':{...lobbyKey,'.write':`${STAFF} || ${OWNER('$key')} || ${NEW_CHAR}`}};
P.cards={'.read':STAFF,'$k':{'.read':OWNER('$k'),'.write':`${STAFF} || ${OWNER('$k')} || ${NEW_CHAR}`}};
P.pos={'.read':true,'$k':{'.write':`${STAFF} || ${OWNER('$k')}`}};

// ---- lobby chat: post as yourself; anyone signed in may clear messages older than 6 hours ----
P.chat={'.read':true,'.indexOn':['t'],'$id':{'.write':`${STAFF} || (!data.exists() && ${OWNER("newData.child('key').val()")}) || (!newData.exists() && ${ME} && data.child('t').val() < now - 21600000)`}};

// ---- private messages: only the two people in the conversation (partners for their own staff_<cid> side) ----
P.dm={'$pair':{
  '.read':`${ADMIN} || (${ME} && ${inPair('$pair',MK)}) || (${PARTNER} && ${inPair('$pair',STAFFDM)})`,
  '.write':`(${ME} && ${inPair('$pair',MK)}) || (${PARTNER} && ${inPair('$pair',STAFFDM)})`
}};
P.dmMeta={'$o':{
  '.read':`${ADMIN} || (${ME} && $o == ${MK}) || (${PARTNER} && $o == ${STAFFDM})`,
  '$p':{'.read':`(${ME} && $p == ${MK}) || (${PARTNER} && $p == ${STAFFDM})`,'.write':`(${ME} && ($o == ${MK} || $p == ${MK})) || (${PARTNER} && ($o == ${STAFFDM} || $p == ${STAFFDM}))`}
}};
// friends / requests / blocks: your own lists; adding/removing a friendship touches both sides
P.friends={'.read':ADMIN,'$a':{'.read':`${ME} && $a == ${MK}`,'$b':{'.write':`${ADMIN} || (${ME} && ($a == ${MK} || ($b == ${MK} && (!newData.exists() || root.child('peiwan/friendReq').child($b).child($a).exists()))))`}}};
P.friendReq={'$to':{'.read':`${ME} && $to == ${MK}`,'$from':{'.read':`${ME} && $from == ${MK}`,'.write':`${ME} && ($from == ${MK} || $to == ${MK})`}}};
P.blocks={'.read':ADMIN,'$k':{'.read':`${ME} && $k == ${MK}`,'.write':`${ME} && $k == ${MK}`,'$o':{'.read':true}}};
// site mail: only the recipient (and staff) can read; staff send
P.mail={'.read':STAFF,'.write':STAFF,'$k':{'.read':`${ME} && $k == ${MK}`,'$id':{'read':{'.write':`${ME} && $k == ${MK}`},'hid':{'.write':`${ME} && $k == ${MK}`}}}};
// Discord account record: only that Discord account (and staff)
P.accounts['.indexOn']=['myKey'];
P.accounts.$id['.read']=`(auth != null && auth.uid == 'discord_' + $id) || ${STAFF}`;

// ---- money: only the owner can spend (on top of phase-2 consistency checks) ----
P.wallet['.read']=STAFF;P.wallet.$k['.read']=OWNER('$k');
P.wallet.$k.balance['.write']=P.wallet.$k.balance['.write'].replace(STAFF+' || (data.exists()',`${STAFF} || (${OWNER('$k')} && data.exists()`);
P.wallet.$k.lastTx['.write']=P.wallet.$k.lastTx['.write'].replace(' || (newData.isString()',` || (${OWNER('$k')} && newData.isString()`);
P.walletTx['.read']=STAFF;P.walletTx.$k['.read']=OWNER('$k');
P.walletTx.$k.$tx['.write']=P.walletTx.$k.$tx['.write'].replace(' || (!data.exists()',` || (${OWNER('$k')} && !data.exists()`);
P.owned.$k.$item['.write']=P.owned.$k.$item['.write'].replace(" || ($item != 'dyeTickets'",` || (${OWNER('$k')} && $item != 'dyeTickets'`);
P.owned.$k.dyeTickets['.write']=`${STAFF} || (${OWNER('$k')} && (`+P.owned.$k.dyeTickets['.write'].replace(STAFF+' || ','')+`))`;
P.owned.$k.dyeLast['.write']=P.owned.$k.dyeLast['.write'].replace(' || (newData.isString()',` || (${OWNER('$k')} && newData.isString()`);
P.owned.$k.dyedHairSets.$req['.write']=P.owned.$k.dyedHairSets.$req['.write'].replace(' || (!data.exists()',` || (${OWNER('$k')} && !data.exists()`);

// ---- orders: create only for yourself; read your own (by id or by myKey query); availability by staffCid ----
const co=P.clientOrders;
co.$id['.write']=co.$id['.write'].replace(/^\(!data\.exists\(\) && newData\.exists\(\)/,`(!data.exists() && newData.exists() && ${OWNER("newData.child('myKey').val()")}`);
co.$id['.read']=`!data.exists() || ${OWNER("data.child('myKey').val()")}`;
co['.read']=`${STAFF} || (query.orderByChild == 'myKey' && query.equalTo != null && ${OWNER('query.equalTo')}) || (query.orderByChild == 'staffCid' && query.equalTo != null && auth != null)`;
co['.indexOn']=['myKey','staffCid','staffName','createdAt'];
P.clientOrderProofs.$id['.write']=`(!data.exists() && newData.exists() && (${OWNER("newData.parent().parent().child('clientOrders').child($id).child('myKey').val()")})) || ${STAFF}`;
// cancellation / renewal requests: customers for their own orders, staff process them
for(const n of ['cancelReq','renewReq']){
  P[n]={'.read':`${STAFF} || (query.orderByChild == 'myKey' && query.equalTo != null && ${OWNER('query.equalTo')})`,'.indexOn':['myKey','staffCid'],
    '$id':{'.read':`${OWNER("data.child('myKey').val()")}`,
      '.write':`${STAFF} || (!data.exists() && newData.exists() && ${OWNER("newData.child('myKey').val()")} && root.child('peiwan/clientOrders').child($id).child('myKey').val() == newData.child('myKey').val())`}};
}
// work order number shown on the customer's order card (number only; the rest of the work order stays staff-only)
P.orders.$id={'no':{'.read':true}};
// reports / order problems: signed-in customers or staff
P.reports.$id['.write']=`(!data.exists() && ${ME}) || ${STAFF}`;
P.orderIssues.$id['.write']=`(!data.exists() && ${ME}) || ${STAFF}`;

// ---- manager can review and bind an account by hand (cases the server sends to review) ----
S.members=S.members||{};S.members.$uid=S.members.$uid||{};S.members.$uid['.write']=ADMIN;S.members['.read']=ADMIN;
S.owners=S.owners||{};S.owners.$key=S.owners.$key||{};S.owners.$key['.write']=ADMIN;S.owners['.read']=ADMIN;

const checks=[[P.wallet.$k.balance['.write'],'secureV1/owners'],[P.wallet.$k.lastTx['.write'],'secureV1/owners'],[P.walletTx.$k.$tx['.write'],'secureV1/owners'],[P.owned.$k.$item['.write'],'secureV1/owners'],[P.owned.$k.dyeLast['.write'],'secureV1/owners'],[P.owned.$k.dyedHairSets.$req['.write'],'secureV1/owners'],[co.$id['.write'],'secureV1/owners']];
checks.forEach(([r,t],i)=>{if(!r.includes(t))throw Error('replacement '+i+' did not apply')});
fs.writeFileSync(output,JSON.stringify(doc,null,2)+'\n');
console.log('written',output,'size',fs.statSync(output).size);
