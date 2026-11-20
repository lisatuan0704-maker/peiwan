// 規則第二十八批：家具券（D 2026/11/21 拍板，11/23 中華卡池起所有卡池）。可重複執行，不會重複套用。
// 抽到重複的家具改給家具券；家具券可以買抽過的家具（原色再一件）與異色家具。券由付款主機（服務帳號，不受規則限制）寫：
//   houseTix/<闆卡>{balance,lastTx}、houseTixTx/<闆卡>/<編號>{type,amount,ref,k,note,ts}、
//   用券買的家具 houseInv/<闆卡>/<key>/<編號>{ts,src:'tix'}，異色 key＝<原key>~<n>（例：vs_luohan~2）。
// 1. houseTix/<key>、houseTixTx/<key>：本人與店員可讀（同 gachaLog），客人與店員都不能寫（只有主機寫）。
// 2. house/<key>/layout 與 houseView/<key>/layout 的家具 t 多接受異色 key（<原key>~1..9）——
//    原本 t 只能是 [a-z0-9_]，異色擺不進房間與拜訪快照。異色一樣要「自己背包 houseInv/<key> 裡有這個 key」才能擺
//    （第十五批那一段照舊；家具店 shopConfig 沒有異色、入住禮四件也不是異色）。
// 3. houseInv/<key>/<家具> 的 key 格式也接受 ~n（主機寫不受規則限制；這是讓店員後台補發／修正異色時不被擋）。
//    客人自己買家具店家具那一段照舊要 shopConfig 有上架＋訂單，異色不在家具店，客人自己寫不進來。
// 第十五批之後執行。
'use strict';
const fs=require('fs'),path=require('path');
const file=process.env.RULES_FILE||path.join(__dirname,'../../../security/database.rules.json');   // RULES_FILE＝先套在別份檔案上試
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const owner=v=>`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child(${v}).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == ${v})`;
if(!P.houseInv||!P.house||!P.gachaLog)throw Error('第十一／十五批還沒套用');
let n=0;
// 1. 家具券餘額與紀錄
for(const k of ['houseTix','houseTixTx']){
 if(P[k])continue;
 P[k]={$k:{'.read':STAFF+' || '+owner('$k'),'.write':false}};n++;
}
// 2. 擺設接受異色 key
const T_OLD="newData.child('t').val().matches(/^[a-z0-9_]{1,60}$/)";
const T_NEW="newData.child('t').val().matches(/^[a-z0-9_]{1,60}(~[1-9])?$/)";
for(const node of [P.house,P.houseView]){
 const v=node&&node.$k&&node.$k.layout&&node.$k.layout.$i;if(!v)continue;
 const s=v['.validate'];
 if(s.includes(T_NEW))continue;
 if(s.split(T_OLD).length!==2)throw Error('layout 規則跟預期不同，沒有改');
 v['.validate']=s.replace(T_OLD,T_NEW);n++;
}
// 3. 背包 key 格式接受 ~n
const I=P.houseInv.$k&&P.houseInv.$k.$item;
if(!I)throw Error('找不到 houseInv/$k/$item');
const I_OLD="$item.matches(/^[a-z0-9_]{1,60}$/)",I_NEW="$item.matches(/^[a-z0-9_]{1,60}(~[1-9])?$/)";
if(!I['.validate'].includes(I_NEW)){
 if(I['.validate']!==I_OLD)throw Error('houseInv/$k/$item 的格式規則跟預期不同，沒有改');
 I['.validate']=I_NEW;n++;
}
if(!n){console.log('phase28 already applied');process.exit(0);}
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase28 applied（'+n+' 處）：家具券 houseTix／houseTixTx 本人與店員可讀、擺設與背包接受異色 key');
