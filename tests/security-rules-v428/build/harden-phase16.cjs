// v505 規則第十六批（11/08 全站查 bug）。可重複執行，不會重複套用。
// 1. house/<key>：擺設全部收回背包時 layout 是空的（Firebase 會把空陣列存成「沒有」），原本規定一定要有 layout → 存不起來，
//    重新整理後家具又回來。改成「有 layout 或有 at（存檔時間）」都可以；空的小屋＝有 at 沒 layout。
// 2. houseView/<key>：同上，拜訪快照可以沒有 layout（空房間），但 vis、at 一定要有。
// 3. socialV1/live/<房間>/positions/<uid>：公開房、私人房裡坐上自己的座椅（seat3／seat4），位置封包會帶 st、sa，
//    原本規則不認識這兩個欄位（$other 擋掉）→ 一坐下位置就一直送不出去、一直跳「房間連線暫時中斷」。
// 第十五批之後執行。
'use strict';
const fs=require('fs'),path=require('path');
const file=process.env.RULES_FILE||path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
if(!P.houseView||!P.gachaLog)throw Error('phase14/15 not applied');
let n=0;
const H=P.house.$k,HOLD="$k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['layout'])",HNEW="$k.matches(/^[A-Za-z0-9_-]{1,200}$/) && (newData.hasChildren(['layout']) || newData.hasChildren(['at']))";
if(H['.validate']===HOLD){H['.validate']=HNEW;n++;}else if(H['.validate']!==HNEW)throw Error('house 規則跟預期不同，沒有改');
const V=P.houseView.$k,VOLD="newData.hasChildren(['layout','vis','at'])",VNEW="newData.hasChildren(['vis','at'])";
if(V['.validate'].includes(VOLD)){V['.validate']=V['.validate'].replace(VOLD,VNEW);n++;}else if(!V['.validate'].includes(VNEW))throw Error('houseView 規則跟預期不同，沒有改');
const POS=R.rules.socialV1&&R.rules.socialV1.live&&R.rules.socialV1.live.$room&&R.rules.socialV1.live.$room.positions&&R.rules.socialV1.live.$room.positions.$uid;
if(!POS)throw Error('socialV1 positions 規則不見了');
if(!POS.st){POS.st={'.validate':"newData.val() == 'seat3' || newData.val() == 'seat4'"};POS.sa={'.validate':'newData.isNumber() && newData.val() > 0'};n++;}
if(!n){console.log('phase16 already applied');process.exit(0);}
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase16 applied（'+n+' 處）');
