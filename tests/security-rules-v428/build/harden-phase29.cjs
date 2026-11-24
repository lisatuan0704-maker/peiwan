// 11/25 規則第二十九批。可重複執行，不會重複套用。
// 語音主機（只有主機讀寫的 orderVoiceV1）查「這位老闆的語音單」改用 orders 依 customerId 查詢（收件匣 inbox-lite.cjs、收房時的 dropText）。
//   沒有索引時 Firebase 會把整個 orders 傳給主機再自己挑（單越多越貴）→ 加 .indexOn customerId，只傳那位老闆的。
//   只加索引：orderVoiceV1 照舊客人、冒險者、店長都不能直接讀寫（.read/.write false）。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const V=R.rules.orderVoiceV1;
if(!V||V['.read']!==false||V['.write']!==false)throw new Error('orderVoiceV1 規則跟預期不同');
if(V.orders&&JSON.stringify(V.orders)===JSON.stringify({'.indexOn':['customerId']})){console.log('phase29 already applied');process.exit(0);}
if(Object.keys(V).some(k=>!['.read','.write'].includes(k)))throw new Error('orderVoiceV1 底下已經有其他規則，請先確認');
V.orders={'.indexOn':['customerId']};
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase29 applied: orderVoiceV1/orders 依 customerId 查詢的索引');
