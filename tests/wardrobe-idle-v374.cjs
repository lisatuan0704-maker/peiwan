const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('lobby.html','utf8'),context={};vm.createContext(context);vm.runInContext(src.match(/function ttIdlePose\([^]*?\n}/)[0],context);
for(const seed of [0,.7,3,9])for(const time of [0,1000/4.6,1000/2.3,3000/4.6,2000/2.3,1294,4000]){
 const pose=context.ttIdlePose(time,seed),pulse=Math.max(0,Math.sin(time/1000*2.3*Math.PI+seed));
 assert.equal(pose.sqx,1+pulse*.031);assert.equal(pose.sqy,1-pulse*.044);assert(pose.sqy<=1&&pose.sqy>=.956);
}
assert.equal(context.ttIdlePose(3000/4.6,0).sqy,1,'negative half-wave rests at natural size');
assert(src.includes('({sqx,sqy}=ttIdlePose(now,a.seed,a.slime))'),'lobby uses shared sampler');
const bridge=fs.readFileSync('tavern-ui-bridge.js','utf8');assert(bridge.includes('ttIdlePose(now??performance.now(),me()?.seed||0)'),'preview uses parent clock and player phase');assert(bridge.includes('previewFoot:cv=>TTScene.metrics({cv})'),'shared solid-pixel foot threshold');
assert(!fs.readFileSync('tavern-ui/live-wardrobe.css','utf8').includes('tt-wardrobe-idle'),'no approximate CSS cycle');
console.log('PASS: lobby and preview share exact idle samples, player phase, parent clock and pixel foot; no height overshoot');
