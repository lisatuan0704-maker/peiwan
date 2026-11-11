// 11/11 規則第二十三批。可重複執行，不會重複套用。
// 面試體驗版手札（D：「他的 dc 私訊 tt 怎麼沒有發通知」）：面試控制台（店長登入）每發一張單，
//   寫一筆 peiwan/interviewDm/<id>{to,kind,room,who,plan,amount,mins,name,book,reserveAt,game,at}，主機 interview-dm.cjs 收到後由 TT 私訊面試者，
//   結果寫回 <id>/result（主機用服務帳號寫，不受規則限制）。
//   只有店長能讀寫；to 必須是 Discord ID、room 是體驗房間代碼、at 必須是伺服器時間（不能補寫舊的）。可以刪除。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
if(R.rules.peiwan.interviewDm){console.log('phase23 already applied');process.exit(0);}
const ADMIN="(auth != null && auth.uid == root.child('peiwan/config/adminUid').val())";
R.rules.peiwan.interviewDm={
  '.read':ADMIN,
  '.indexOn':['at'],
  '$id':{
    '.write':ADMIN,
    '.validate':"$id.matches(/^[A-Za-z0-9_-]{1,40}$/) && (!newData.exists() || (newData.hasChildren(['to','kind','room','at']) && newData.child('to').isString() && newData.child('to').val().matches(/^[0-9]{16,22}$/) && newData.child('room').isString() && newData.child('room').val().matches(/^[A-Za-z0-9]{4,32}$/) && newData.child('kind').isString() && newData.child('at').val() == now))"
  }
};
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase23 applied: interviewDm (admin only)');
