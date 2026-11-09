// v513 規則第二十一批。可重複執行，不會重複套用。
// VIP 升級動圖（D 11/10：TT 在「酒館名人牆」發恭喜，附老闆自己小人的動圖）：
//   peiwan/vipCardReq/<闆卡> {lv,no,at}：主機（機器人）發現升級時寫的「請畫圖」單；本人與店員可讀，只有店長能改（主機用服務帳號不受規則限制）。
//   peiwan/vipCard/<闆卡>/<等級>：本人的大廳照「請畫圖」單畫好的 GIF（data:image/gif;base64,…，不到 2.4MB）。
//     本人只能交「目前請畫的那一級」、交過不能覆蓋；店員可讀、可刪。主機發完公告就刪掉。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const p=R.rules.peiwan;
if(p.vipCardReq&&p.vipCard){console.log('phase21 already applied');process.exit(0);}
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const ADMIN=`(auth != null && auth.uid == root.child('peiwan/config/adminUid').val())`;
const OWNER=`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`;
p.vipCardReq={
  '.read':STAFF,
  '$k':{
    '.read':`${OWNER} || ${STAFF}`,
    '.write':ADMIN,
    '.validate':`newData.hasChildren(['lv','at']) && newData.child('lv').isNumber() && newData.child('lv').val() >= 1 && newData.child('lv').val() <= 5`,
  },
};
p.vipCard={
  '.read':STAFF,
  '$k':{
    '.read':`${OWNER} || ${STAFF}`,
    '$lv':{
      '.write':`(${STAFF}) || (${OWNER} && !data.exists() && newData.exists() && (root.child('peiwan/vipCardReq').child($k).child('lv').val() + '') == $lv)`,
      '.validate':`newData.isString() && newData.val().beginsWith('data:image/gif;base64,') && newData.val().length < 2400000 && ($lv == '1' || $lv == '2' || $lv == '3' || $lv == '4' || $lv == '5')`,
    },
  },
};
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase21 applied: vipCardReq / vipCard');
