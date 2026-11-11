// v522 規則第二十二批。可重複執行，不會重複套用。
// 小屋朋友即時同步（D：好，小屋也做）：houseRoom/<主人>/<座位> 多一個選填欄位 r＝「走路中剩下要轉的彎」，
//   格式 "9,4;12,4;12,8"（格子 i,j，用分號隔開，最多 80 字），朋友照這條路線推算你現在走到哪（跟大廳 v521 一樣），不用固定晚 0.15 秒。
//   停下時刪掉。只能是數字、逗號、分號。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const s=R.rules.peiwan.houseRoom.$o.$s;
if(s.r){console.log('phase22 already applied');process.exit(0);}
const out={};
for(const [k,v] of Object.entries(s)){if(k==='$other')out.r={'.validate':'newData.isString() && newData.val().length >= 3 && newData.val().length <= 80 && newData.val().matches(/^[0-9,;]+$/)'};out[k]=v;}
R.rules.peiwan.houseRoom.$o.$s=out;
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase22 applied: houseRoom r (route)');
