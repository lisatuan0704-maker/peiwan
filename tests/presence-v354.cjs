const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={};vm.runInNewContext(fs.readFileSync('lobby-ui/presence.js','utf8'),c);
const P=c.TTPresence,p=(x,t)=>({x:x/1600,y:.7,m:'hall',f:0,s:0,w:1,v:1,t}),actor=()=>({x:0,y:.7,mapLoc:'hall'});
const a=actor();P.receive(a,p(200,0),0);P.receive(a,p(340,700),700);P.receive(a,p(340,700),716);
let before=a.x*1600;P.receive(a,p(340,700),1216);
assert(a.x*1600-before<=16.01,'500ms rendering stall must not jump '+(a.x*1600-before).toFixed(1)+'px');
// Resume after a hidden tab or a 2fps modal; never consume paused time at once.
before=a.x*1600;P.receive(a,p(340,700),8000);assert(a.x*1600-before<=16.01);
for(let t=8016;t<10000;t+=16)P.receive(a,{...p(340,700),w:0},t);
assert.equal(a.x*1600,340);assert.equal(a.state,'idle');
// Large correction: visible speed is bounded even while the network jumps far ahead.
P.receive(a,p(1300,10001),10001);before=a.x*1600;
P.receive(a,p(1300,10001),10017);assert(a.x*1600-before<=5.13);
for(let t=10033;t<16000;t+=16)P.receive(a,p(1300,10001),t);assert.equal(a.x*1600,1300);
console.log('PASS: 500ms stalled render, long background pause, exact rest, large reconnect correction at bounded speed');
