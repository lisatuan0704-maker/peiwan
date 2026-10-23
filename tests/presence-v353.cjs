const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={};vm.runInNewContext(fs.readFileSync('lobby-ui/presence.js','utf8'),ctx);
const P=ctx.TTPresence,actor=()=>({x:.1,y:.7,mapLoc:'hall',state:'idle',faceLeft:false});
const packet=(x,t,m='hall')=>({x:x/1600,y:.7,f:0,s:0,w:1,m,v:1,t});
const distance=(a,b)=>Math.hypot((a.x-b.x)*1600,(a.y-b.y)*900);
// A 700ms network/acknowledgement gap used to trigger the 96px teleport.
let a=actor();P.receive(a,packet(200,0),0);P.receive(a,packet(340,700),700);
assert.equal(a.x*1600,200,'same-map delayed update must not snap');
P.receive(a,packet(340,700),716);assert(a.x*1600>200&&a.x*1600<210);
for(let t=732;t<=1300;t+=16)P.receive(a,packet(340,700),t);assert.equal(a.x*1600,340);
// Irregular deliveries and a large reconnect correction remain continuous.
for(const gap of [150,350,700,1100]){
 a=actor();P.receive(a,packet(200,0),0);let last=0,latest=packet(200,0),peak=0;
 for(let now=16;now<12000;now+=16){
  if(now-last>=gap){last=now;latest=packet(Math.min(1300,200+now*.1),now);}
  const before={...a};P.receive(a,latest,now);peak=Math.max(peak,distance(a,before));
 }
 assert(peak<9,'visible per-frame jump at '+gap+'ms: '+peak);
 for(let t=13000;t<=14500;t+=16)P.receive(a,{...latest,w:0,t:13000},t);
 assert(distance(a,latest)<.00001);assert.equal(a.state,'idle');
}
a=actor();P.receive(a,packet(200,100),0);P.receive(a,packet(400,200),200);
P.receive(a,packet(100,150),280);assert(a.x*1600>200,'stale delivery must not reverse or freeze interpolation');
for(let t=296;t<=1400;t+=16)P.receive(a,packet(400,200),t);assert.equal(a.x*1600,400);
P.receive(a,packet(800,300,'forest'),1401);assert.equal(a.x*1600,800,'map transition aligns immediately');
const before={...a};assert.equal(P.receive(a,{x:NaN,y:.3},1010),false);assert.equal(a.x,before.x);
// Keep existing steady movement behavior: no growing queue or extrapolated drift.
a=actor();let latest=packet(200,0);P.receive(a,latest,0);let peakLag=0;
for(let now=10;now<=6000;now+=10){if(now%150===0)latest=packet(200+now*.1,now);P.receive(a,latest,now);peakLag=Math.max(peakLag,200+now*.1-a.x*1600);}
assert(peakLag<32);for(let t=7000;t<=8500;t+=16)P.receive(a,{...latest,w:0},t);assert.equal(a.x,latest.x);
console.log('PASS: 150–1100ms deliveries, >96px correction without teleport, stale packets, exact stop, map changes, invalid input; steady max lag '+peakLag.toFixed(1)+'px');
