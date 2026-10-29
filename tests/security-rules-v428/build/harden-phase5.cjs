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

// 4. 紀錄編號只能是英數字、底線、連字號（以前可以放引號或括號，拿來在店長頁插入程式）
const KEY=v=>`${v}.matches(/^[A-Za-z0-9_-]{1,200}$/)`;
const addV=(node,expr)=>{const cur=node['.validate'];if(cur&&cur.includes(expr))return;node['.validate']=cur?`(${cur}) && ${expr}`:expr;};
for(const [n,w] of [['lobby','$key'],['cards','$k'],['clientOrders','$id'],['clientOrderProofs','$id'],['reports','$id'],['orderIssues','$id'],['cancelReq','$id'],['renewReq','$id'],['mutes','$k'],['walletTx','$k'],['wallet','$k'],['owned','$k'],['pos','$k']]){
 if(!P[n]||!P[n][w])throw Error('missing '+n+'/'+w);
 addV(P[n][w],`!newData.exists() || ${KEY(w)}`);
}
addV(P.walletTx.$k.$tx,`!newData.exists() || ${KEY('$tx')}`);
P.accounts.$id=Object.assign(P.accounts.$id,{});
addV(P.accounts.$id,`!newData.exists() || $id.matches(/^[0-9]{5,25}$/)`);
// 5. 客人可寫、店長頁會顯示的欄位：型別限制
P.lobby.$key.pub.dcav={'.validate':"newData.isString() && (newData.val() == '' || newData.val().matches(/^[0-9]{16,22}\\/(a_)?[a-f0-9]{32}$/))"};
P.clientOrders.$id.coinAmount={'.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() % 1 == 0'};
P.clientOrders.$id.amount=Object.assign(P.clientOrders.$id.amount||{},{'.validate':'newData.isNumber() && newData.val() >= 0'});
addV(P.clientOrderProofs.$id,"!newData.exists() || (newData.isString() && newData.val().length < 3000000 && newData.val().matches(/^data:image\\/(png|jpeg|jpg|webp|gif);base64,/))");
P.orderIssues.$id.amount={'.validate':'newData.isNumber()'};
for(const f of ['vip','spent'])P.accounts.$id[f]={'.validate':'newData.isNumber() && newData.val() >= 0'};

// 6. 優惠券與金幣訂單價格（以前優惠券只在網頁判斷，任何人都能每筆折 200；金幣付的陪玩／會員／併桌單沒有價格下限）
// VIP 等級改由店長頁計算後寫入 peiwan/vipServer/<key>/lv（只有店長能寫），規則依等級決定可折金額。
const ADMIN=`(auth != null && auth.uid == root.child('peiwan/config/adminUid').val())`;
P.vipServer={'.read':STAFF,'$k':{
 '.read':`(auth != null && root.child('secureV1/owners').child($k).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == $k)`,
 '.write':ADMIN,
 '.validate':`${KEY('$k')} && newData.hasChildren(['lv'])`,
 lv:{'.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() <= 5 && newData.val() % 1 == 0'},
 at:{'.validate':'newData.isNumber()'},
 $other:{'.validate':false}}};
const LV=k=>`root.child('peiwan/vipServer').child(${k}).child('lv')`;
const OFFBY=k=>`(${LV(k)}.isNumber() ? (${LV(k)}.val() >= 5 ? 200 : ${LV(k)}.val() >= 4 ? 120 : ${LV(k)}.val() >= 3 ? 80 : ${LV(k)}.val() >= 2 ? 50 : ${LV(k)}.val() >= 1 ? 30 : 0) : 0)`;
// 6a. 商品（owned）價格檢查中的「優惠券 200」改為依 VIP 等級
const fixOwned=str=>str.split(".child('couponUsed').val() == true ? 200 : 0)").join(".child('couponUsed').val() == true ? "+OFFBY('$k')+" : 0)");
P.owned.$k.$item['.write']=fixOwned(P.owned.$k.$item['.write']);
P.owned.$k.dyeTickets['.write']=fixOwned(P.owned.$k.dyeTickets['.write']);
if((P.owned.$k.$item['.write']+P.owned.$k.dyeTickets['.write']).includes('? 200 : 0)'))throw Error('coupon 200 still present');
// 6b. 金幣付款的陪玩／會員／併桌單：金額不得低於價目（店長價目表 config/services、會員方案、併桌每席價）減去可折金額
const N="newData";
const PLAN=`${N}.child('plan').val()`;
const PRICE=`(${PLAN}.beginsWith('svc_') ? root.child('peiwan/config/services').child(${PLAN}.replace('svc_','')).child('price').val() : `+
 `${PLAN} == 'm1200' ? 1200 : ${PLAN} == 'm3000' ? 3000 : ${PLAN} == 'm5000' ? 5000 : ${PLAN} == 'val2' ? 600 : (${PLAN} == 'val1' || ${PLAN} == 'chat1') ? 300 : `+
 `${PLAN} == 'seat' ? root.child('peiwan/tables').child(${N}.child('itemId').val()).child('price').val() : 999999999)`;
const OFFORD=`(${N}.child('couponUsed').val() == true ? ${OFFBY(N+".child('myKey').val()")} : 0)`;
const WALLETPRICE=`(${N}.child('paidBy').val() != 'wallet' || ${N}.child('type').val() == 'shop' || (${N}.child('plan').isString() && ${N}.child('amount').val() >= ${PRICE} - ${OFFORD}))`;
const cw=P.clientOrders.$id['.write'];
const anchor="(!data.exists() && newData.exists() && ";
if(!cw.includes("child('peiwan/tables').child(newData.child('itemId').val()).child('price')")){
 if(!cw.startsWith(anchor))throw Error('clientOrders anchor');
 P.clientOrders.$id['.write']=anchor+`${WALLETPRICE} && `+cw.slice(anchor.length);
}
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase5 applied');
