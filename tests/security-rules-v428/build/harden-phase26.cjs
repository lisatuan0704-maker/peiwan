// v552 規則第二十六批。可重複執行，不會重複套用。
// 大廳位置同步的流量（D 11/17：這個月已下載 31.89 GB，跟在線人數平方成長）：
//   pos/<地圖>/<key>：位置按地圖分開（地圖只能是 hall、forest、house），寫入權限同 pos/<key>（本人或後台），要有 x、y 數字。
//   pos 加 .indexOn v：過渡期新版只抓舊版分頁寫的舊路徑（orderByChild('v').equalTo(1)），伺服器端篩選。
//   online/<key>：在線節點 {m:地圖, at:伺服器時間}，讀取同 pos、寫入同 pos/<key>，不能塞其他欄位。
//   舊路徑 pos/<key> 不動（舊分頁還在用；下一版拿掉）。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan.pos;
if(!P||!P.$k||!P.$k['.write'])throw new Error('找不到 pos/$k');
if(P.hall&&R.rules.peiwan.online){console.log('phase26 already applied');process.exit(0);}
const W=P.$k['.write'],KEY="$k.matches(/^[A-Za-z0-9_-]{1,200}$/)";
const mapNode=()=>({'$k':{'.write':W,'.validate':`!newData.exists() || (${KEY} && newData.child('x').isNumber() && newData.child('y').isNumber())`}});
P['.indexOn']=['v'];
for(const m of ['hall','forest','house'])P[m]=mapNode();
R.rules.peiwan.online={'.read':P['.read'],'$k':{'.write':W,
 '.validate':`!newData.exists() || (${KEY} && newData.hasChildren(['m','at']))`,
 'm':{'.validate':"newData.isString() && newData.val().matches(/^(hall|forest|house)$/)"},
 'at':{'.validate':'newData.isNumber() && newData.val() == now'},
 '$other':{'.validate':false}}};
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase26 applied: pos/<map>/<key>, pos .indexOn v, online/<key>');
