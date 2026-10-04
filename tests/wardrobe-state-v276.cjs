const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync('tavern-ui/live-wardrobe.js','utf8');
const parts=['front','back','cloth','eye','pet','seat','acc1'].map(slot=>({slot,source:'set',category:slot==='acc1'?'acc':'cloth',group:'head'}));
const c={data:{catalog:[{id:'set',parts}],doll:{hair:0}},selection:{cloth:{source:'old',slot:'cloth'}},color:{savedId:'saved'},selected:'old',dyeDraft:null,api:{makeDoll(){throw Error('無效部件')}},tell(){},render(){throw Error('失敗時不可更新選中標示')}};
vm.createContext(c);for(const pattern of [/const ref=p=>[^\n]+/,/const key=p=>[^\n]+/,/function selectionFromDoll\([^]*?\n }/,/function tryItem\([^]*?\n }/])vm.runInContext(s.match(pattern)[0],c);
const d=c.selectionFromDoll({set:'set',uiBaseSlots:['front','pet'],front:3,uiAccessories:[]});assert.equal(d.front.base,3);assert.equal(d.back.source,'set');assert.equal(d.pet,null);assert.equal(d.seat.source,'set');assert(!d['accessory:head']);
const before=JSON.stringify(c.selection);c.tryItem({source:'invalid',slot:'cloth',category:'cloth',id:'invalid'});assert.equal(JSON.stringify(c.selection),before);assert.equal(c.selected,'old');assert.equal(c.color.savedId,'saved');
console.log('PASS: 重開保留原有部件、寵物卸下與座椅、自訂配件空清單；失敗試穿不更新搭配或選中標示');
