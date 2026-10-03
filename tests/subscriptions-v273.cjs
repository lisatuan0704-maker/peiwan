const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const html=fs.readFileSync(require('path').join(__dirname,'../lobby.html'),'utf8');
const start=html.indexOf('(function(){',html.indexOf('function submitTopup(){')),end=html.indexOf('/* ===== 訂單即時通知',start),active=new Map(),all=[],timers=[];
const c={db:{ref:path=>({on(t,fn){active.set(path,fn);all.push({path,fn});},off(t,fn){assert.equal(active.get(path),fn);active.delete(path);}})},ROOT:'peiwan',myKey:'a',setTimeout:fn=>timers.push(fn),claimMe(k){c.myKey=k;},updateCoinChip(){},document:{getElementById:()=>null},payMethod:'coin',renderCoinInfo(){},renderTopup(){},openTopup(){}};c.window=c;vm.createContext(c);vm.runInContext(html.slice(start,end),c);
const old=active.get('peiwan/wallet/a/balance');for(let i=0;i<50;i++){c.claimMe(i%2?'a':'b');while(timers.length)timers.shift()();assert.equal(active.size,3,'保持錢包、禁言與全站儲值方案三個監聽');}
c.claimMe('b');while(timers.length)timers.shift()();active.get('peiwan/wallet/b/balance')({val:()=>17});old({val:()=>999});assert.equal(c.__wallet,17,'舊帳號延遲回呼不得污染目前錢包');
const count=all.length;for(let i=0;i<50;i++){c.claimMe('b');while(timers.length)timers.shift()();}assert.equal(all.length,count,'重複認領不增加監聽');
c.claimMe(null);while(timers.length)timers.shift()();assert.equal(active.size,1);assert.equal(c.__wallet,0);assert.equal(c.__mute,null);
console.log('PASS: 100 account changes/claims do not grow wallet/mute subscriptions, stale callbacks ignored, sign-out releases listeners and clears values');
