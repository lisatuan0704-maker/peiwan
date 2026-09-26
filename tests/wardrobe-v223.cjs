const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../lobby.html'),'utf8');
const source=html.match(/function tpPosed\([^]*?\n  }/)[0];
const data=html.match(/const TP = (.*);/)[1];
const TP=JSON.parse(data),ctx={TP};
vm.runInNewContext(source,ctx);
let checked=0;
for(const cat of ['後髮','前髮','衣服','眼睛']){
  const base=TP.parts[cat];
  for(const [idx,part] of base.entries()){
    for(const pose of ['idle','a','a2','b','b2']){
      assert.strictEqual(ctx.tpPosed(cat,idx,pose),part,`${cat} ${idx} ${pose} 不可換款`);checked++;
    }
  }
  // 未交齊的姿勢圖，只能對應同一款；後續款式回退自己的原圖。
  const posed={n:'同款姿勢圖'};
  TP.parts[cat+'_a']=[posed];
  assert.strictEqual(ctx.tpPosed(cat,0,'a'),posed);
  assert.strictEqual(ctx.tpPosed(cat,3,'a'),base[3]);
  assert.strictEqual(ctx.tpPosed(cat,0,'idle'),base[0]);
  assert.strictEqual(ctx.tpPosed(cat,999,'a'),null);
}
assert.strictEqual(ctx.tpPosed('不存在',0,'idle'),null);
assert(!/tpPosed\([^\n]*,[23],pose\)/.test(html),'呼叫端不可保留舊款數上限');
console.log(`${checked} 組實際部件與姿勢、缺幀同款回退、無效編號：通過`);
const wardrobe=fs.readFileSync(path.join(__dirname,'../tavern-ui/live-wardrobe.js'),'utf8');
const choice={selection:{back:{base:3,slot:'back'},front:{source:'cloth0',slot:'front'},'accessory:hand':{source:'cloth0',slot:'acc1'}}};
vm.runInNewContext(wardrobe.match(/const key=p=>[^\n]+/)[0]+wardrobe.match(/function isTrying\([^]*?\n }/)[0],choice);
assert(choice.isTrying({base:3,slot:'back'}));
assert(!choice.isTrying({source:'cloth0',slot:'back'}),'第一張卡不可冒充已試穿後髮');
assert(choice.isTrying({source:'cloth0',slot:'front'}),'前髮與後髮可同時選中');
assert(!choice.isTrying({base:0,slot:'front'}));
assert(choice.isTrying({category:'acc',group:'hand',source:'cloth0',slot:'acc1'}));
assert(!choice.isTrying({parts:[{source:'cloth0',slot:'front'},{source:'cloth0',slot:'back'}]}));
assert(!wardrobe.includes('(selected===p.id)'));
console.log('自訂及原有部件選取標示、混搭、配件與整組匹配：通過');
