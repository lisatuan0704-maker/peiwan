const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../lobby.html'),'utf8');
const marker=html.indexOf('/* ===== 眨眼:');const start=html.indexOf('(function(){',marker),end=html.indexOf('})();',start)+5;
let poll,finish,now=0;const poses=['idle','a','a2','b','b2'];
const a={frame:'idle',b:{doll:{}},frames:Object.fromEntries(poses.map(p=>[p,{eye:'open'}])),el:{style:{display:''}}};
a.cv={eye:'open',getContext:()=>({clearRect:()=>{},drawImage:f=>a.cv.eye=f.eye})};
const math=Object.create(Math);math.random=()=>0;
const context={Math:math,Date:{now:()=>now},agents:new Map([['test',a]]),document:{body:{classList:{contains:()=>false}}},matchMedia:()=>({matches:false}),setInterval:f=>{poll=f},setTimeout:f=>{finish=f},drawDollTo:(cv,d)=>{cv.eye=d._blink?'closed':'open'},POSES:poses};
const frameStart=html.indexOf('function setFrame(a,p)'),frameEnd=html.indexOf('function pickTarget',frameStart);
vm.createContext(context);vm.runInContext(html.slice(frameStart,frameEnd),context);vm.runInContext(html.slice(start,end),context);
poll();assert.equal(a.cv.eye,'open');now=7999;poll();assert.equal(a.cv.eye,'open');now=8000;poll();assert.equal(a.cv.eye,'closed');assert(!a.b.doll._blink);
context.setFrame(a,'a');assert.equal(a.cv.eye,'closed');assert(poses.every(p=>a.frames[p].eye==='open'));
// 部件在眨眼期間完成載入，重建各影格必須是睜眼。
const readyStart=html.indexOf('function tpReady(){'),readyEnd=html.indexOf('\n}',readyStart)+2;vm.runInContext(html.slice(readyStart,readyEnd),context);context.tpReady();assert(poses.every(p=>a.frames[p].eye==='open'));
now=8140;finish();assert.equal(a.cv.eye,'open');for(let i=0;i<80;i++){context.setFrame(a,poses[i%5]);assert.equal(a.cv.eye,'open')}
now=15999;poll();assert.equal(a.cv.eye,'open');now=16000;poll();assert.equal(a.cv.eye,'closed');now=16140;finish();assert.equal(a.cv.eye,'open');
console.log('PASS: 8-second minimum, 140ms blink, walking and idle share schedule, no doll mutation, asset-load frame cache remains open');

// 啟用頭髮動畫後，閉眼不能污染動畫快取，換髮色必須重建快取。
context.document.createElement=()=>({eye:'open',getContext:()=>({})});
a._hairMotion={mode:'walk',phase:2};a.frame=null;context.setFrame(a,'a');assert.equal(a.cv.eye,'open');
a._blinkUntil=now+140;a.frame=null;context.setFrame(a,'a');assert.equal(a.cv.eye,'closed');
a._blinkUntil=0;a.frame=null;context.setFrame(a,'a');assert.equal(a.cv.eye,'open');
const cache=a._hairCache;a.b.doll.hairHex='#E8A0C6';a.frame=null;context.setFrame(a,'a');assert.notEqual(a._hairCache,cache);
context.tpReady();assert.equal(a.cv.eye,'open');assert.equal(a._hairCache.size,1);
console.log('PASS: animated hair frames isolate blink and refresh on outfit/color and asset load');
