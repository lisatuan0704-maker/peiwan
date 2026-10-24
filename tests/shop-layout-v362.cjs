const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),out=path.resolve('../../output/shop-layout-v362');fs.mkdirSync(out,{recursive:true});
const before=process.argv.includes('--before');
const products=JSON.parse(fs.readFileSync('img/season-v283/products.json','utf8')).products;
for(const [id,asset,name] of [['pet_bubu','kabuki','布布'],['pet_guigui','rira','鬼鬼'],['pet_dengdeng','momo','燈燈']])products[id]={custom:true,active:true,type:'寵物',name,price:99,img:'https://tinytavern.tw/img/companions-v352/'+asset+'-pet.gif',parts:{pet:{d:'img/companions-v352/'+asset+'-pet.gif',n:name,g:0,x:0,y:0}}};
for(const id of ['seat3','seat4'])products[id]={active:true,price:99};
function rects(){return {w:innerWidth,h:innerHeight,wide:document.documentElement.scrollWidth>innerWidth+2,items:['.shophead','.workspace','.catalog','.preview','.stage','#avatar','.season-card','.season-visual','.season-visual canvas','.season-info','.season-actions','#detail','#grid','#pager','#dyeTicket','.previewbar'].flatMap(s=>[...document.querySelectorAll(s)].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).display!=='none').map(e=>({s,...e.getBoundingClientRect().toJSON()})))};}
(async()=>{
 const original=before?cp.execFileSync('git',['show','HEAD:tavern-ui/unified-window.css'],{encoding:'utf8'}):null;
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.join(root,name);res.setHeader('Content-Type',/\.m?js$/.test(file)?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.gif')?'image/gif':'text/html; charset=utf-8');if(before&&name.endsWith('/shop-layout.css'))return res.end('');if(before&&name.endsWith('/unified-window.css'))return res.end(original);fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return}res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
 try{for(const [width,height,mobile] of before||process.argv.includes('--quick')?[[1685,900,false]]:[[1685,900,false],[1920,1080,false],[1366,768,false],[1024,768,false],[390,844,true],[320,740,true]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket('**',ws=>ws.close());await page.route(/(firebasedatabase\.app|firebaseio\.com|api\.tinytavern\.tw|discord\.com\/api\/webhooks)/,r=>r.abort());
  await page.route('https://tinytavern.tw/**',r=>{const p=path.join(root,decodeURIComponent(new URL(r.request().url()).pathname));if(fs.existsSync(p))return r.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.png')?'image/png':p.endsWith('.gif')?'image/gif':'application/javascript'});return r.abort();});
  await page.goto(origin+(mobile?'/lobby.html?preview=1&mobile=1':'/lobby-view.html?preview=1'));
  let lobby;for(let n=0;n<100;n++){lobby=page.frames().find(f=>new URL(f.url()||origin).pathname==='/lobby.html');if(lobby)break;await new Promise(r=>setTimeout(r,50));}
  await lobby.waitForFunction(()=>window.TinyTavernUI);await lobby.addStyleTag({content:'#dcGate,#intro,#loadscr{display:none!important}'});
  await lobby.evaluate(cfg=>{firebase.database().goOffline();db=null;window.__shopCfg=cfg;Object.defineProperty(window,'__shopCfg',{value:cfg,writable:false,configurable:true});window.__owned={};window.qaAgent={b:{name:'版面測試',doll:{front:3,back:3,cloth:3,face:2,hair:6,skin:0}},x:.5,y:.7};me=()=>qaAgent;myKey='qa-local';window.TTVoiceOrders={userId:()=> 'qa',drinks:async()=>({inventory:{}})};window.qaWrites=[];window.__owned=Object.fromEntries(TinyTavernUI.state().catalog.map(o=>[o.id,true]));const outfit=TinyTavernUI.state().catalog.find(o=>o.id==='season283_devil');if(outfit){const chosen=Object.fromEntries(outfit.parts.filter(p=>p.defaultEquipped!==false).map(p=>[p.category==='acc'?TinyTavernUI.accessoryKey(p):p.slot,{source:p.source,slot:p.slot}]));qaAgent.b.doll=TinyTavernUI.makeDoll(chosen,{hair:6});}db={ref:()=>({set:async d=>qaWrites.push(d)})};TinyTavernUI.open('shop');},products);
  let ward;for(let n=0;n<100;n++){ward=page.frames().find(f=>decodeURI(f.url()).includes('時裝間比較.html'));if(ward)break;await new Promise(r=>setTimeout(r,50));}await ward.locator('#avatar').waitFor();
  await ward.waitForFunction(()=>document.querySelector('#avatar').getContext('2d').getImageData(0,0,64,64).data.some((v,i)=>i%4===3&&v));
  await page.screenshot({path:path.join(out,(before?'before':'after')+'-'+width+'.png')});const seasonal=await ward.evaluate(rects);report.push({width,height,mobile,seasonal});
  if(!mobile&&!before){
   assert(!seasonal.wide,'no horizontal overflow');
   for(const selector of ['.season-actions','#dyeTicket','.previewbar'])for(const r of seasonal.items.filter(x=>x.s===selector))assert(r.bottom<=seasonal.h+1,selector+' stays visible');
   const visual=seasonal.items.find(x=>x.s==='.season-visual'),info=seasonal.items.find(x=>x.s==='.season-info');assert(visual.height>info.height*1.2,'art gets more room than copy');
   for(const r of seasonal.items.filter(x=>x.s==='.season-visual canvas')){assert(Math.abs(r.width-r.height)<1,'square product artwork');assert(r.height>=185,'product art remains legible');}
   for(const category of ['cloth','hair','pet','seat','other','dye']){
    await ward.locator('[data-category='+category+']').click();const g=await ward.evaluate(rects);assert(!g.wide,'no overflow '+category);
    if(['cloth','hair','pet'].includes(category)){
     assert.equal(await ward.locator('#grid').evaluate(e=>getComputedStyle(e).overflow),'auto','items clip and scroll before pager');
     const grid=g.items.find(x=>x.s==='#grid'),pager=g.items.find(x=>x.s==='#pager');assert(grid.bottom<=pager.top,'items and pager do not overlap');
     await ward.locator('#grid .item').last().scrollIntoViewIfNeeded();await ward.locator('#grid').evaluate(e=>e.scrollTop=0);
    }
    if(['cloth','hair','pet'].includes(category))for(const selector of ['.previewbar','#dyeTicket','#pager'])for(const r of g.items.filter(x=>x.s===selector))assert(r.bottom<=g.h+1,selector+' '+category+' visible');
    if(width===1685)await page.screenshot({path:path.join(out,category+'-'+width+'.png')});
   }
   await ward.locator('[data-category=pet]').click();await ward.locator('[data-item="pet_dengdeng::pet"]').click();await ward.waitForFunction(()=>document.getElementById('wardrobePet')?.complete&&document.getElementById('wardrobeParty')?.style.transform);
   const ratio=await ward.evaluate(()=>{const a=document.getElementById('avatar').getBoundingClientRect(),p=document.getElementById('wardrobePet').getBoundingClientRect();return {ratio:p.width/a.width,x:(p.x+p.width/2-a.x-a.width/2)/(a.width/160)};});assert(Math.abs(ratio.ratio-125/160)<.001);assert(Math.abs(ratio.x+89)<.1);
   await page.screenshot({path:path.join(out,'pet-preview-'+width+'.png')});
   await lobby.evaluate(()=>TinyTavernUI.open('bag'));await ward.waitForFunction(()=>document.body.dataset.area==='bag');
   const bag=await ward.evaluate(rects);assert(!bag.wide);await page.screenshot({path:path.join(out,'bag-'+width+'.png')});
   const shell=page.frames().find(f=>f.url().includes('/tavern-ui/index.html'));
   await lobby.evaluate(()=>TinyTavernUI.open('roster'));assert.equal(await shell.locator('#shopWindow').isVisible(),false,'hidden shop must not cover the roster');
   await lobby.evaluate(()=>TinyTavernUI.open('shop'));await ward.locator('[data-try-outfit="season291_bear"]').click();await ward.locator('#reset').click();
   await ward.locator('#seasonNext').click();assert.equal(await ward.locator('[data-try-outfit="season291_bear"]').count(),0);await ward.locator('#seasonPrev').click();assert.equal(await ward.locator('[data-try-outfit="season291_bear"]').count(),1);
  }
  if(mobile){assert.equal(await ward.locator('body').getAttribute('data-area'),'bag');assert(!seasonal.wide);}
  assert.deepEqual(await lobby.evaluate(()=>qaWrites),[]);assert.deepEqual(errors,[]);
  console.log('PASS '+width+'x'+height+(mobile?' mobile bag':' scaled desktop shop')+(before?' baseline':''));await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,before?'before.json':'report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
