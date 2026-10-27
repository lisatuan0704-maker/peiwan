// v432 店內名稱對照：舊名稱快照（大卡／小mo／Caboo／卡布）與角色 ID 一律顯示蕪／縭／桃；其他名稱原樣。
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const win={};win.window=win;vm.createContext(win);vm.runInContext(fs.readFileSync(path.join(__dirname,'../lobby-ui/staff-names.js'),'utf8'),win);
const N=win.TTStaffNames;
assert.equal(N.display('大卡'),'縭');assert.equal(N.display('小mo'),'桃');assert.equal(N.display('小MO'),'桃');assert.equal(N.display('Caboo'),'蕪');assert.equal(N.display('卡布'),'蕪');
assert.equal(N.display('隨便','-OxY7C4vDkgsr1zcyWbk'),'縭');assert.equal(N.display('新冒險者'),'新冒險者');assert.equal(N.display('',null,'冒險者'),'冒險者');
assert.equal(N.display('陪陪'),'冒險者');assert.equal(N.display('接單陪玩'),'冒險者');assert.equal(N.display('不指定'),'不指定');
assert.equal(N.text('與大卡、小mo一起玩'),'與縭、桃一起玩');
// 客人看得到的網頁不再直接寫死舊名稱
for(const f of ['lobby.html','partner.html','admin.html','kefu.html','index.html','guide.html','card.html','dc.html','tavern-ui/portrait-adjust.html']){
  const p=path.join(__dirname,'..',f);if(!fs.existsSync(p))continue;const s=fs.readFileSync(p,'utf8').replace(/^.*const legacy=new Map.*$/m,'');
  assert(!/大卡|小mo|Caboo|卡布/.test(s),f+' 仍有舊名稱');
}
console.log('PASS: staff display names (legacy names, ids, unknown names, free text) and no hard-coded old names in pages');
