// v510 規則第二十批。可重複執行，不會重複套用。
// 金幣換貓貓幣的匯率（D 11/09：「1 金＝5 貓」）：catTx 兌換那一筆 amount＝coin×5＋加送（剛好 350 加送 150、剛好 1000 加送 500，其他不加送）。
// 原本（第九批）是 ×10、加送 200／1000。cat 餘額、walletTx、wallet 都是對照這筆 catTx 的 amount／coin，不用改。
// 商品用貓貓幣付款的價格（clientOrders catAmount＝amount×10）是商品標價，跟兌換無關，照舊。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const node=R.rules.peiwan.catTx.$k.$tx;
const OLD="newData.child('amount').val() == newData.child('coin').val() * 10 + (newData.child('coin').val() == 350 ? 200 : newData.child('coin').val() == 1000 ? 1000 : 0)";
const NEW="newData.child('amount').val() == newData.child('coin').val() * 5 + (newData.child('coin').val() == 350 ? 150 : newData.child('coin').val() == 1000 ? 500 : 0)";
if(node['.write'].includes(NEW)){console.log('phase20 already applied');process.exit(0);}
if(!node['.write'].includes(OLD))throw Error('catTx exchange rule changed, check by hand');
node['.write']=node['.write'].split(OLD).join(NEW);
fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase20 applied: exchange 1 gold = 5 cat (bonus 350→150, 1000→500)');
