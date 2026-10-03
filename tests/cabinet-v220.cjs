// v273：以 v265 繪師分層取代 v220 舊櫃體座標，保留家具阻擋及坐墊排序驗證。
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),crypto=require('crypto');
const fixture=require('./fixtures/artist-footprints-v273.json'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../lobby-ui/scene.js'),'utf8'),ctx);const s=ctx.TTScene;
for(const [file,hash] of Object.entries(fixture.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../img/lobby-layers-v260',file))).digest('hex'),hash,'繪師圖層變更後需重新校正');
for(const p of fixture.blocked)assert(!s.valid(p),'腳底穿入繪師家具接地像素 '+p);
ctx.document={createElement:()=>({dataset:{},style:{},setAttribute(){}})};const layers=[];s.mount({append:el=>layers.push(el)});const z=id=>Number(layers.find(x=>x.dataset.layer===id).style.zIndex);
assert(z('cushions')>z('stall'));assert(z('wolf')>z('cushions'));assert(z('stools')>z('counter'));assert(s.valid([700,350]),'保留吧台後方露頭通道');
console.log('PASS: '+fixture.blocked.length+' artist-layer contact pixels blocked, immutable source artwork, cushions above stall and below character, behind-bar corridor preserved');
