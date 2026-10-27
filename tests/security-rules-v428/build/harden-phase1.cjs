// Phase 1: staff/admin permission hardening on top of the LIVE rules snapshot.
// Usage: node harden-phase1.cjs <live-rules.json> <out.json>
'use strict';
const fs=require('fs');
const [,,input,output]=process.argv;
const doc=JSON.parse(fs.readFileSync(input,'utf8'));
const P=doc.rules.peiwan;

const ADMIN="(auth != null && auth.uid == root.child('peiwan/config/adminUid').val())";
// A real staff member = admin, or an account whose links entry was created with a valid invite.
const STAFF="(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))";
const PARTNER=cid=>`(auth != null && root.child('peiwan/links').child(auth.uid).child('type').val() == 'char' && root.child('peiwan/links').child(auth.uid).child('refId').val() == ${cid})`;

function must(node,name){if(!node)throw Error('missing node '+name);return node;}

// --- Staff-only collections -------------------------------------------------
must(P.mutes,'mutes')['.write']=STAFF;
must(P.board,'board')['.write']=ADMIN;
must(P.shopConfig,'shopConfig')['.write']=ADMIN;
must(P.tables,'tables')['.write']=ADMIN;
Object.assign(must(P.characters,'characters'),{'.read':STAFF,'.write':ADMIN});
Object.assign(must(P.staff,'staff'),{'.read':STAFF,'.write':ADMIN});
Object.assign(must(P.orders,'orders'),{'.read':STAFF,'.write':STAFF});

// Partner cards: admin, or the partner who owns that card.
P.staffCards={'.read':true,'.write':ADMIN,'$cid':{'.write':PARTNER('$cid')}};
// Clock-in status: admin, or the partner it belongs to. Everyone can still see who is on duty.
P.staffStatus={'.read':true,'.write':ADMIN,'$cid':{'.write':PARTNER('$cid')}};

// --- Invites & staff registration ------------------------------------------
// Nobody but the admin can list invite codes; a code can be checked only by someone who already knows it.
// A code can be used once: registration writes links/<uid> and invites/<code>/usedBy together.
P.invites={
  '.read':ADMIN,'.write':ADMIN,
  '$code':{
    '.read':'auth != null',
    'usedBy':{
      '.write':`auth != null && !data.exists() && newData.val() == auth.uid && newData.parent().parent().parent().child('links').child(auth.uid).child('code').val() == $code`
    }
  }
};
P.links={
  '.read':ADMIN,'.write':ADMIN,
  '$uid':{
    '.read':`auth != null && auth.uid == $uid`,
    '.write':`auth != null && auth.uid == $uid && !data.exists() && newData.exists()`
      +` && root.child('peiwan/invites').child(newData.child('code').val()).exists()`
      +` && !root.child('peiwan/invites').child(newData.child('code').val()).child('usedBy').exists()`
      +` && newData.parent().parent().child('invites').child(newData.child('code').val()).child('usedBy').val() == auth.uid`
      +` && root.child('peiwan/invites').child(newData.child('code').val()).child('type').val() == newData.child('type').val()`
      +` && root.child('peiwan/invites').child(newData.child('code').val()).child('refId').val() == newData.child('refId').val()`,
    '.validate':"newData.hasChildren(['type','refId','code']) && (newData.child('type').val() == 'char' || newData.child('type').val() == 'staff')"
  }
};

// --- Orders written by customers, managed by staff ---------------------------
// Customers may only create; changing an existing order is staff-only (any logged-in Discord user could before).
P.clientOrders.$id['.write']=`!data.exists() || ${STAFF}`;
Object.assign(P.clientOrderProofs,{'.read':STAFF});P.clientOrderProofs.$id['.write']=`!data.exists() || ${STAFF}`;
Object.assign(P.reports,{'.read':STAFF});P.reports.$id['.write']=`!data.exists() || ${STAFF}`;
Object.assign(P.orderIssues,{'.read':STAFF});P.orderIssues.$id['.write']=`!data.exists() || ${STAFF}`;

// Site mail: only staff can send; customers keep marking their own mail read/hidden.
P.mail['.write']=STAFF;

// Customer account directory: only staff can list every account.
P.accounts['.read']=STAFF;

// Wallet top-ups/refunds: staff only (was: any logged-in Discord user could set any balance).
P.wallet.$k.balance['.write']=`${STAFF} || (data.exists() && newData.isNumber() && newData.val() >= 0 && newData.val() <= data.val())`;

fs.writeFileSync(output,JSON.stringify(doc,null,2)+'\n');
console.log('written',output);
