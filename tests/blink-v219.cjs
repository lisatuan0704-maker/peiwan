const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../lobby.html'),'utf8');
const marker=html.indexOf('/* ===== 眨眼:');
const start=html.indexOf('(function(){',marker),end=html.indexOf('})();',start)+5;
let poll,finish,timers=0,draws=0;
const poses=['idle','a','a2','b','b2'];
const a={state:'idle',frame:'idle',cv:{eye:'open'},b:{doll:{}},frames:Object.fromEntries(poses.map(p=>[p,{eye:'open'}])),el:{style:{display:''}}};
const math=Object.create(Math);math.random=()=>0;
const context={Math:math,agents:new Map([['test',a]]),document:{body:{classList:{contains:()=>false}}},matchMedia:()=>({matches:false}),
 setInterval:f=>{poll=f;},setTimeout:f=>{finish=f;timers++;},
 drawDollTo:(cv,d)=>{draws++;cv.eye=d._blink?'closed':'open';},
 setFrame:(actor,p)=>{if(actor.frame===p)return;actor.frame=p;actor.cv.eye=actor.frames[p].eye;}};
vm.runInNewContext(html.slice(start,end),context);
poll();assert(a.cv.eye==='closed');assert(poses.every(p=>a.frames[p].eye==='open'));
// 眨眼途中開始走路，計時結束必須還原當下影格，不能污染另一幀。
a.state='walk';context.setFrame(a,'a');assert(a.cv.eye==='open');finish();
for(let i=0;i<80;i++){context.setFrame(a,poses[1+i%4]);assert(a.cv.eye==='open');poll();}
assert(timers===1);assert(draws===1);assert(!a.b.doll._blink);
a.state='idle';context.setFrame(a,'idle');poll();assert(a.cv.eye==='closed');finish();assert(a.cv.eye==='open');
console.log('眨眼快取隔離、移動中停止眨眼、80 次步伐輪播、停止時正常眨眼：通過');
