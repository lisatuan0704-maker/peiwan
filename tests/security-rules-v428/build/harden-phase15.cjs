// v504 規則第十五批：家具扭蛋（D 2026/11/08「上酒館大廳」，伺服器抽）。可重複執行，不會重複套用。
// 扭蛋家具（海底人魚屋、森林精靈小屋）家具店不賣，shopConfig 沒有它們；抽到的家具由付款主機（服務帳號，不受規則限制）
// 一次寫入 cat 扣款＋catTx spend＋houseInv/<闆卡>/<家具>/<抽卡編號>{ts,src:'gacha'}＋gachaLog/<闆卡>/<抽卡編號>。客人自己寫不進背包（第十一批照舊）。
// 1. house/<key>/layout（與第十四批的 houseView/<key>/layout）的家具多接受「自己背包 houseInv/<key> 裡有這件」——
//    原本只接受 shopConfig 有上架的家具＋入住禮四件，扭蛋家具擺不進房間。
// 2. gachaLog/<key>：抽卡紀錄，本人與店員可讀，客人不能寫（只有主機寫）。
// 第十四批之後執行；若用 rules-before-v504.json 重跑第十四批，要再跑這一批。
'use strict';
const fs=require('fs'),path=require('path');
const file=process.env.RULES_FILE||path.join(__dirname,'../../../security/database.rules.json');   // RULES_FILE＝先套在別份檔案上試
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const owner=v=>`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child(${v}).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == ${v})`;
if(!P.house||!P.houseInv)throw Error('phase11 not applied');
const SHOP="(root.child('peiwan/shopConfig').child('house:' + newData.child('t').val()).exists() || ";
const OWNED="root.child('peiwan/houseInv').child($k).child('' + newData.child('t').val()).exists() || ";
let n=0;
for(const node of [P.house,P.houseView]){
 const v=node&&node.$k&&node.$k.layout&&node.$k.layout.$i;if(!v)continue;
 const s=v['.validate'];
 if(s.includes(OWNED))continue;
 if(!s.includes(SHOP))throw Error('layout 規則跟預期不同，沒有改');
 v['.validate']=s.replace(SHOP,SHOP+OWNED);n++;
}
if(!P.gachaLog){P.gachaLog={$k:{'.read':STAFF+' || '+owner('$k'),'.write':false}};n++;}
if(!n){console.log('phase15 already applied');process.exit(0);}
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase15 applied（'+n+' 處）');
