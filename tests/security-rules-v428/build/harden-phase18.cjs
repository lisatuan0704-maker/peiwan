// v508 規則第十八批。可重複執行，不會重複套用。
// 1. friends/<a>/<b>：b 用「a 送給 b 的邀請」把自己加進 a 的好友時，a 封鎖了 b 就不行
//    （原本 a 封鎖 b 之後，a 之前送出、b 還沒回的邀請還在，b 按接受就變回好友，還能看 a「只限好友」的小屋）。
// 2. house／houseView 的擺設：shopConfig 有這件「而且售價大於 0」才算上架家具。
//    （11/08 舊版店長頁把 71 件扭蛋家具用 0 元寫進 shopConfig，原本「有這筆就算」，沒抽到的人也能把扭蛋家具擺出來給別人看；
//     抽到的照舊靠 houseInv 擺。）
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
let changed=0;

// ── 1. friends ──
{
 const B=P.friends.$a.$b,old="root.child('peiwan/friendReq').child($b).child($a).exists()";
 if(!B['.write'].includes(old))throw Error('friends rule changed, check by hand');
 if(!B['.write'].includes("peiwan/blocks').child($a).child($b)")){
  B['.write']=B['.write'].replace(old,old+" && !root.child('peiwan/blocks').child($a).child($b).exists()");changed++;}
}

// ── 2. house／houseView 擺設 ──
{
 const oldT="root.child('peiwan/shopConfig').child('house:' + newData.child('t').val()).exists()";
 const newT="(root.child('peiwan/shopConfig').child('house:' + newData.child('t').val()).child('price').isNumber() && root.child('peiwan/shopConfig').child('house:' + newData.child('t').val()).child('price').val() > 0)";
 for(const node of [P.house.$k.layout.$i,P.houseView.$k.layout.$i]){
  if(node['.validate'].includes(newT))continue;
  if(!node['.validate'].includes(oldT))throw Error('layout rule changed, check by hand');
  node['.validate']=node['.validate'].replace(oldT,newT);changed++;}
}

if(!changed){console.log('phase18 already applied');process.exit(0);}
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase18 applied: block stops accept-back, layout needs a priced listing ('+changed+' changes)');
