// v466 資安第五批：客人名冊不再公開、禁言由資料庫把關、聊天與闆卡欄位長度限制。
// 以目前的 security/database.rules.json（第四批）為底；可重複執行，不會重複套用。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
// 已用 Discord 登入、帳號有綁定闆卡且未停用的客人
const MEMBER=`(auth != null && root.child('secureV1/members').child(auth.uid).child('key').isString() && root.child('secureV1/members').child(auth.uid).child('active').val() != false)`;
const INSIDE=`(${STAFF} || ${MEMBER})`;

// 1. 名冊、位置、背包、聊天、禁言名單：只有登入的客人與店員能讀（以前未登入也能整包下載 Discord 名稱、ID、生日）
for(const n of ['lobby','pos','owned','chat','mutes'])P[n]['.read']=INSIDE;
// 闆卡工房與入口在登入前只需要知道「這張闆卡存在嗎」
P.lobby.$key.name=Object.assign(P.lobby.$key.name||{},{'.read':true});
P.owned.$k.baseStart['.read']=true;
// 自己的禁言狀態（登入的本人可讀，原本的父層已涵蓋；這裡保底）
P.mutes.$k=Object.assign(P.mutes.$k||{},{});

// 2. 闆卡公開欄位長度（工房上限：名字 10、遊戲 24、一句話 20；留寬鬆空間）
const str=n=>({'.validate':`newData.isString() && newData.val().length <= ${n}`});
Object.assign(P.lobby.$key.name,str(40));
P.lobby.$key.quote=Object.assign(P.lobby.$key.quote||{},str(120));
P.lobby.$key.games=Object.assign(P.lobby.$key.games||{},str(120));
P.lobby.$key.tags=Object.assign(P.lobby.$key.tags||{},{$i:{'.validate':'newData.isString() && newData.val().length <= 20'}});
for(const k of ['bm','bd'])P.lobby.$key[k]={'.validate':`newData.isNumber() && newData.val() >= 0 && newData.val() <= ${k==='bm'?12:31}`};

// 3. 聊天：被禁言不能發言（以前只在網頁擋）；欄位與長度限制、不能冒用別人的名字
const MUTE=`root.child('peiwan/mutes').child(newData.child('key').val())`;
const notMuted=`(!${MUTE}.exists() || (${MUTE}.child('until').val() != -1 && ${MUTE}.child('until').val() < now))`;
const w=P.chat.$id['.write'];
const memberWrite=`(!data.exists() && ((auth != null && root.child('secureV1/members')`;
if(!w.includes(memberWrite)&&!w.includes("child('peiwan/mutes')"))throw Error('chat write anchor not found');
if(!w.includes("child('peiwan/mutes')"))P.chat.$id['.write']=w.replace(memberWrite,`(!data.exists() && ${notMuted} && ((auth != null && root.child('secureV1/members')`);
P.chat.$id['.validate']="!newData.exists() || newData.hasChildren(['key','text','t'])";
Object.assign(P.chat.$id,{
 key:{'.validate':'newData.isString() && newData.val().length <= 100'},
 name:{'.validate':"newData.isString() && newData.val().length <= 40 && ("+STAFF+" || newData.val() == root.child('peiwan/lobby').child(newData.parent().child('key').val()).child('name').val() || newData.val() == '？')"},
 text:{'.validate':'newData.isString() && newData.val().length >= 1 && newData.val().length <= 200'},
 map:{'.validate':'newData.isString() && newData.val().length <= 30'},
 t:{'.validate':'newData.isNumber() && newData.val() <= now + 300000'},
 $other:{'.validate':false}
});
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase5 applied');
