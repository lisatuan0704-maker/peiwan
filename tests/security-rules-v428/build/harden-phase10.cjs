// v493 使用者更正：付費商品（時裝、部件、工房部件、寵物、座椅、染髮券、聊天氣泡）一律收金幣，
// 貓貓幣（每日任務、活動白送）只能買店長標成貓貓幣的商品（之後的小屋家具、店長送的免費時裝）。
// 以目前的 security/database.rules.json（第九批）為底；可重複執行，不會重複套用。
// 1. clientOrders paidBy 'cat'：商品必須在 shopConfig/<itemId>/cur 標 'cat'（shopConfig 只有店長能寫）。
//    背包 owned 本來就要求「同一次寫入的新訂單」，所以訂單擋下來，背包也拿不到。
// 2. 染髮券：拿掉第九批加的「以 cat/<key>/lastTx 找訂單 +1」分支，只剩金幣。
// 兌換、每日任務 11/07 起送 100 貓貓幣、店長調整不變。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const FLAG=`newData.child('itemId').isString() && root.child('peiwan/shopConfig').child(newData.child('itemId').val()).child('cur').val() == 'cat'`;
if(!P.cat)throw Error('phase9 not applied');
if(P.clientOrders.$id['.write'].includes(FLAG)){console.log('phase10 already applied');process.exit(0);}

// ── 1. clientOrders：貓貓幣只能付標了貓貓幣的商品 ──
{
 const co=P.clientOrders.$id;
 const head=`(newData.child('paidBy').val() == 'cat' && newData.child('type').val() == 'shop' && `;
 const n=co['.write'].split(head).length-1;if(n!==1)throw Error('clientOrders cat branch found '+n);
 co['.write']=co['.write'].replace(head,head+FLAG+' && ');
}

// ── 2. 染髮券：拿掉貓貓幣 +1 分支 ──
{
 const dy=P.owned.$k.dyeTickets;const s=dy['.write'];
 const mark=` || (newData.val() == (data.exists() ? data.val() : 0) + 1 && newData.parent().parent().parent().child('cat').child($k).child('lastTx').exists()`;
 const k=s.indexOf(mark);if(k<0||s.indexOf(mark,k+1)>=0)throw Error('dye cat branch not found');
 let depth=0,end=-1;
 for(let i=k+4;i<s.length;i++){const c=s[i];if(c==='(')depth++;else if(c===')'){depth--;if(depth===0){end=i;break;}}}
 if(end<0)throw Error('dye cat branch unbalanced');
 const cut=s.slice(k,end+1);
 if(!cut.includes("== 'cat'")||cut.includes("child('wallet')"))throw Error('dye cat branch shape changed');
 dy['.write']=s.slice(0,k)+s.slice(end+1);
 if(dy['.write'].includes("child('cat')"))throw Error('dye still references cat');
}

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase10 applied: cat pays only shopConfig/<item>/cur == cat; dye tickets gold only');
