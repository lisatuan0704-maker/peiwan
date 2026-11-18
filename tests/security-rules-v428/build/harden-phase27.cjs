// v554 規則第二十七批。可重複執行，不會重複套用。
// 續單申請 renewReq/<訂單>：原本客人只能「還沒有申請單」時寫（!data.exists()），同一張單續過一次就再也續不了（送出失敗）。
//   改成：上一張申請單已經處理完（有 done）也可以整筆換成新的申請；處理中（沒有 done）照舊不能蓋，客人自己也不能帶 done。
//   其他條件（本人、訂單是自己的）不變。冒險者手札、店長頁照舊可寫。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const N=R.rules.peiwan.renewReq&&R.rules.peiwan.renewReq.$id;
if(!N||!N['.write'])throw new Error('找不到 renewReq/$id');
const OLD="(!data.exists() && newData.exists() && ";
const NEW="((!data.exists() || data.child('done').exists()) && newData.exists() && !newData.child('done').exists() && ";
if(N['.write'].includes(NEW)){console.log('phase27 already applied');process.exit(0);}
if(N['.write'].split(OLD).length!==2)throw new Error('renewReq/$id 的寫入規則跟預期不同');
N['.write']=N['.write'].replace(OLD,NEW);
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase27 applied: renewReq 處理完可以再送');
