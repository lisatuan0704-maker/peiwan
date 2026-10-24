const fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm'),assert=require('node:assert/strict');
const before=JSON.parse(cp.execFileSync('git',['show','bb764ba:img/season-v291/catalog.json'],{encoding:'utf8'}));
const after=JSON.parse(fs.readFileSync('img/season-v291/catalog.json','utf8')),ctx={window:{}};
vm.runInNewContext(fs.readFileSync('tavern-ui/season-v291.js','utf8'),ctx);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.TTSeasonDrafts)),after,'browser and source metadata match');
for(const [id,outfit] of Object.entries(after))for(const [slot,part] of Object.entries(outfit.parts)){
 assert(!/灰階|前髮後|帽子[上下前後]|身體後|手上道具|辮子上的/.test(part.n),id+' '+slot+' has a customer-facing name');
 const old=before[id].parts[slot];
 for(const key of ['d','x','y','z','group','independent','defaultEquipped'])assert.deepEqual(part[key],id==='season291_wolf'&&slot==='acc5'&&key==='independent'?true:old[key],id+' '+slot+' '+key+' preserved');
 if(part.highlight)for(const key of ['d','x','y','g'])assert.deepEqual(part.highlight[key],old.highlight[key]);
 assert.equal(part.g,id==='season291_wolf'&&['acc2','acc3','acc5'].includes(slot)?1:old.g);
}
assert.deepEqual(after.season291_wolf.parts.acc6.requiresPart,{source:'season291_wolf',slot:'acc3'});
console.log('PASS: public labels, source/browser consistency, original art paths and layer metadata preserved, three grayscale accessories recolorable');
