// v539 規則第二十五批。可重複執行，不會重複套用。
// 小屋光效的位置（D 11/16：「我想設計成玩家可以自己調整這個光效要在哪」）：
//   houseFx/<主人>/e/<光效> 多兩個選填欄位 x、y＝光的落點在房間的哪裡（房間寬的百分比，0～100 的整數）；沒有＝照舊自動找空地。
//   兩個要一起出現。其他欄位與讀寫權限不變。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const F=R.rules.peiwan.houseFx&&R.rules.peiwan.houseFx.$k.e.$f;
if(!F)throw new Error('找不到 houseFx（要先套第二十四批）');
if(F.x){console.log('phase25 already applied');process.exit(0);}
const pct=other=>({'.validate':`newData.isNumber() && newData.val() % 1 == 0 && newData.val() >= 0 && newData.val() <= 100 && newData.parent().child('${other}').exists()`});
F.x=pct('y');F.y=pct('x');
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase25 applied: houseFx x/y');
