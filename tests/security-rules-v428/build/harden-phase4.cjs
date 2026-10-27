// v434: 工房初始部件單買（owned/<key>/base_<kind>_<n>，價格 config/basePricing/<kind>）與新闆卡初始部件紀錄（owned/<key>/baseStart）。
// 以目前發布的 security/database.rules.json 為底，只加這兩處。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan,item=P.owned.$k.$item;
const OWN='newData.parent().parent().parent()',ORD=`${OWN}.child('clientOrders').child(newData.child('ref').val())`;
const OFF=`(${ORD}.child('couponUsed').val() == true ? 200 : 0)`,AMT=`${ORD}.child('amount').val()`,BP=`root.child('peiwan/config/basePricing')`;
const base=['hair','face','cloth','acc'].map(k=>`($item.beginsWith('base_${k}_') && ${BP}.child('${k}').isNumber() && ${BP}.child('${k}').val() > 0 && ${AMT} >= ${BP}.child('${k}').val() - ${OFF})`).join(' || ');
const anchor=`($item.beginsWith('bubble_') && ${AMT} >= 50)`;
if(!item['.write'].includes(anchor))throw Error('price anchor not found');
if(!item['.write'].includes("beginsWith('base_hair_')"))item['.write']=item['.write'].replace(anchor,`${base} || ${anchor}`);
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const n=k=>({[k]:{'.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() < 100 && newData.val() % 1 == 0'}});
P.owned.$k.baseStart={
 '.write':`${STAFF} || (!data.exists() && newData.exists() && !root.child('peiwan/lobby').child($k).exists())`,
 '.validate':"newData.hasChildren(['back','front','cloth','face','brow'])",
 ...n('back'),...n('front'),...n('cloth'),...n('face'),...n('brow'),
 at:{'.validate':'newData.isNumber()'},$other:{'.validate':false}
};
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase4 applied');
