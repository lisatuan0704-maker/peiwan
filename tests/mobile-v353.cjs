const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('lobby-ui/fixed-view.js','utf8');
function boot(fine,width,height){const classes=[],redirects=[],location={search:'',hash:'',replace:s=>redirects.push(s)},window={innerWidth:width,innerHeight:height,location};window.top=window.self=window.parent=window;vm.runInNewContext(source,{window,location,URLSearchParams,matchMedia:()=>({matches:fine}),document:{documentElement:{classList:{add:c=>classes.push(c)}},addEventListener(){}}});return {window,classes,redirects};}
for(const [w,h] of [[390,844],[844,390]]){const r=boot(false,w,h);assert(r.window.TTMobile);assert(r.classes.includes('tt-mobile'));assert.equal(r.redirects.length,0);}
assert.equal(boot(true,390,844).window.TTMobile,false,'a narrow desktop keeps the fixed desktop layout');
const html=fs.readFileSync('lobby.html','utf8'),start=html.indexOf('function tick(now){'),stop=html.indexOf('  if(document.hidden)',start);let scheduled=0;
vm.runInNewContext(html.slice(start,stop)+'}',{window:{TTMobile:true},last:0,requestAnimationFrame:()=>scheduled++});
const c={window:{TTMobile:true},last:0,requestAnimationFrame:()=>scheduled++};vm.createContext(c);vm.runInContext(html.slice(start,stop)+'}',c);c.tick(123);assert.equal(c.last,123);assert.equal(scheduled,1,'mobile skips world rendering and all position publication');
assert(!html.includes('把手機轉橫,體驗完整 2.5D'));
assert(html.includes("function isPortraitHome(){ return !!window.TTMobile; }"));
console.log('PASS: portrait and landscape functional mode, narrow desktop route, no mobile world tick/publication, no enter-lobby prompt');
