// v526 規則第二十四批。可重複執行，不會重複套用。
// 小屋光效（D 11/13：「客人收集到了但沒有拿到特效」「取得後能選擇要混搭裝備哪個特效，並且給客人調整的參數」）：
//   新節點 houseFx/<主人>{at, e:{<系列><階段>:{a 亮度,s 速度,n 數量,r 範圍,o 順序,d 周圍變暗?}}}，存主人在小屋開了哪些光效、各自調成怎樣。
//   讀：主人、店員，以及看得到這間小屋的人（跟 houseView 一樣：公開＝登入的老闆、只限好友＝主人的好友）——來玩的人才看得到主人的光效。
//   寫：只有主人（與店員）。光效名稱只能是現有系列＋1／2，數字都有範圍。
//   ⚠ 規則數不了背包裡有幾件，所以「有沒有集到」只在網頁擋；硬寫的人只能讓自己房間多一道光，拿不到別的東西。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
if(P.houseFx){console.log('phase24 already applied');process.exit(0);}
const hv=P.houseView.$k;
const OWNER=hv['.write'];                                      // 店員或主人本人
const READ=hv['.read'].split("data.child('vis')").join("root.child('peiwan/houseView').child($k).child('vis')");
if(READ===hv['.read'])throw new Error('houseView .read 找不到 data.child(\'vis\')，規則結構變了，先看一下再套');
const SETS='cn|valentine|bear|wolf|wind|kabuki|rira|momo|bakery|astro|mermaid|xmas|academy|onsen|forest|arcade|arabian|steam|tropic|garden';
const int=(lo,hi)=>({'.validate':`newData.isNumber() && newData.val() % 1 == 0 && newData.val() >= ${lo} && newData.val() <= ${hi}`});
P.houseFx={$k:{
 '.read':READ,
 '.write':OWNER,
 '.validate':"!newData.exists() || ($k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['at']))",
 at:{'.validate':'newData.isNumber() && newData.val() <= now + 60000'},
 e:{$f:{
  '.validate':`$f.matches(/^(${SETS})[12]$/) && newData.hasChildren(['a','s','n','r','o'])`,
  a:int(30,150),s:int(30,200),n:int(0,200),r:int(60,160),o:int(0,99),
  d:{'.validate':'newData.isBoolean()'},
  $other:{'.validate':false}}},
 $other:{'.validate':false}}};
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase24 applied: houseFx');
