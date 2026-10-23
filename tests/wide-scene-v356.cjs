const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('lobby.html','utf8');
const expression=html.match(/const fitZoom = ([^;]+);/)[1];
for(const [vw,vh] of [[1280,800],[1000,1200],[800,600],[1920,900]]){
 const z=vm.runInNewContext(expression,{vw,vh,WORLD:{w:1600,h:900},curMap:'hall'});
 const left=vw/2-960*z,right=vw/2+960*z,top=vh/2-450*z;
 assert.ok(left<=1e-8&&right>=vw-1e-8&&top<=1e-8,`${vw}x${vh} must fill viewport without borders`);
}
const nodes=[];const c={document:{createElement:()=>({dataset:{},style:{},setAttribute(){}})}};vm.runInNewContext(fs.readFileSync('lobby-ui/scene.js','utf8'),c);c.TTScene.mount({append:n=>nodes.push(n)});
assert.equal(nodes.length,10);for(const n of nodes){assert.equal(n.width,1920);assert.ok(fs.existsSync(n.src));}
assert.equal(nodes.find(n=>n.dataset.layer==='stall').style.clipPath,'inset(0px 1200px 0px 0px)');
const layout=JSON.parse(html.match(/const STAFF_LAYOUT=([^;]+);/)[1]);assert.deepEqual(layout['-OxY7C4vDkgsr1zcyWbk'],{x:410,y:436,mirror:false});
console.log('PASS: approved B artwork fills four viewport shapes; full-width depth layers; requested Rira position');
const wrapper=fs.readFileSync('lobby-view.html','utf8');const fit=wrapper.match(/const fit=\(\)=>\{([^]*?)\};fit\(\)/)[1];
for(const [innerWidth,innerHeight]of [[1280,720],[1000,1200],[800,600],[2400,900]]){const frame={style:{}};vm.runInNewContext(fit,{innerWidth,innerHeight,frame});const scale=Number(frame.style.transform.match(/[\d.]+/)[0]);assert.ok(Math.abs(parseFloat(frame.style.width)*scale-innerWidth)<.001);assert.ok(Math.abs(parseFloat(frame.style.height)*scale-innerHeight)<.001);assert.ok(parseFloat(frame.style.width)>=1280);assert.ok(parseFloat(frame.style.height)>=720);}
console.log('PASS: wrapper fills every viewport with no letterbox and preserves UI scale');
