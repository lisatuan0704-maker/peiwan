// v510 規則第十九批。可重複執行，不會重複套用。
// 小屋壁紙／地板（D 11/08：小屋商城賣各系列的壁紙跟地板，可以選要貼哪幾面牆、哪幾格地板）：
//   house/<key>/paint {f:{'i_j':系列}, w:{'L3'／'R3':系列}}、houseView/<key>/paint 同格式（拜訪的人看得到）。
//   每一格只能貼主人自己 houseInv 裡有的 floor_<系列>／wall_<系列>（壁紙、地板跟家具同一條購買路，買了才進 houseInv）。
//   格子編號限 0～99，系列名限小寫英文；其他欄位一律拒絕。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
let changed=0;
const cell=(re,pre)=>({'.validate':"$c.matches("+re+") && newData.isString() && newData.val().matches(/^[a-z]{2,20}$/) && root.child('peiwan/houseInv').child($k).child('"+pre+"' + newData.val()).exists()"});
const paint={'f':{'$c':cell('/^[0-9]{1,2}_[0-9]{1,2}$/','floor_')},'w':{'$c':cell('/^[LR][0-9]{1,2}$/','wall_')},'$other':{'.validate':false}};
for(const node of [P.house.$k,P.houseView.$k]){
 if(node.paint)continue;
 node.paint=JSON.parse(JSON.stringify(paint));changed++;}
if(!changed){console.log('phase19 already applied');process.exit(0);}
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase19 applied: house/houseView paint ('+changed+' nodes)');
