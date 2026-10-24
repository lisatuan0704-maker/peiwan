const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),out=path.resolve('../../output/drink-fit-v374');fs.mkdirSync(out,{recursive:true});
const before=process.argv.includes('--before');
const products=JSON.parse(fs.readFileSync('img/season-v283/products.json','utf8')).products;
products.cloth2=JSON.parse(fs.readFileSync('tests/fixtures/star-accessories.json','utf8'));
products.cloth2.name='星夜吟遊裝';products.cloth2.parts.eye={...products.cloth2.parts.acc,n:'星夜吟遊裝・眼型'};
products.cloth3={active:true,name:'貓耳限定裝',parts:{brow:{...products.cloth2.parts.acc,n:'貓耳限定裝・眉毛'}}};
for(const [id,asset,name] of [['pet_bubu','kabuki','布布'],['pet_guigui','rira','鬼鬼'],['pet_dengdeng','momo','燈燈']])products[id]={custom:true,active:true,type:'寵物',name,price:99,img:'https://tinytavern.tw/img/companions-v352/'+asset+'-pet.gif',parts:{pet:{d:'img/companions-v352/'+asset+'-pet.gif',n:name,g:0,x:0,y:0}}};
for(const tone of ['blue','ghost','sakura'])products['pet_drink_'+tone]={custom:true,active:true,type:'其他',name:tone,price:99,img:'https://tinytavern.tw/img/pet-drinks-v311/'+tone+'.png',parts:{pet:{d:'img/pet-drinks-v311/'+tone+'-wear.png',n:tone,g:0,x:0,y:0}}};
products.cloth_mslu9a8o={custom:1,active:true,name:'星夜漫遊裝',type:'時裝',parts:{cloth:{d:products.season283_devil.parts.cloth.d}},price:99};
for(const id of ['seat3','seat4'])products[id]={active:true,price:99};
function rects(){return {w:innerWidth,h:innerHeight,wide:document.documentElement.scrollWidth>innerWidth+2,items:['.shophead','.workspace','.catalog','.preview','.stage','#avatar','.season-card','.season-visual','.season-visual canvas','.season-info','.season-actions','#detail','#grid','#pager','#dyeTicket','.previewbar'].flatMap(s=>[...document.querySelectorAll(s)].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).display!=='none').map(e=>({s,...e.getBoundingClientRect().toJSON()})))};}
(async()=>{
 const original=before?cp.execFileSync('git',['show','HEAD:tavern-ui/unified-window.css'],{encoding:'utf8'}):null;
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.join(root,name);res.setHeader('Content-Type',/\.m?js$/.test(file)?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.gif')?'image/gif':'text/html; charset=utf-8');if(before&&name.endsWith('/shop-layout.css'))return res.end('');if(before&&name.endsWith('/unified-window.css'))return res.end(original);fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return}res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
 try{for(const [width,height,mobile] of before||process.argv.includes('--quick')?[[1685,900,false]]:process.argv.includes('--mobile')?[[390,844,true],[320,740,true]]:[[1685,900,false],[1920,1080,false],[1366,768,false],[1024,768,false],[390,844,true],[320,740,true]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket('**',ws=>ws.close());await page.route(/(firebasedatabase\.app|firebaseio\.com|api\.tinytavern\.tw|discord\.com\/api\/webhooks)/,r=>r.abort());
  await page.route('https://cdn.discordapp.com/avatars/**',r=>r.fulfill({body:fs.readFileSync('tavern-ui/assets/avatar-KABUKI.png'),contentType:'image/png'}));
  await page.route('https://tinytavern.tw/**',r=>{const p=path.join(root,decodeURIComponent(new URL(r.request().url()).pathname));if(fs.existsSync(p))return r.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.png')?'image/png':p.endsWith('.gif')?'image/gif':'application/javascript'});return r.abort();});
  await page.goto(origin+(mobile?'/lobby.html?preview=1&mobile=1':'/lobby-view.html?preview=1'));
  let lobby;for(let n=0;n<100;n++){lobby=page.frames().find(f=>new URL(f.url()||origin).pathname==='/lobby.html');if(lobby)break;await new Promise(r=>setTimeout(r,50));}
  await lobby.waitForFunction(()=>window.TinyTavernUI);await lobby.addStyleTag({content:'#dcGate,#intro,#loadscr{display:none!important}'});
  await lobby.evaluate(cfg=>{firebase.database().goOffline();db=null;window.__shopCfg=cfg;Object.defineProperty(window,'__shopCfg',{value:cfg,writable:false,configurable:true});window.__owned={};window.qaAgent={b:{name:'版面測試',doll:{front:3,back:3,cloth:3,face:2,hair:6,skin:0}},x:.5,y:.7};me=()=>qaAgent;myKey='qa-local';window.TTVoiceOrders={userId:()=> 'qa',drinks:async()=>({inventory:{pet_drink_blue:3,pet_drink_ghost:3,pet_drink_sakura:3}})};window.qaWrites=[];window.__owned=Object.fromEntries(TinyTavernUI.state().catalog.map(o=>[o.id,true]));const outfit=TinyTavernUI.state().catalog.find(o=>o.id==='season283_devil');if(outfit){const chosen=Object.fromEntries(outfit.parts.filter(p=>p.defaultEquipped!==false).map(p=>[p.category==='acc'?TinyTavernUI.accessoryKey(p):p.slot,{source:p.source,slot:p.slot}]));qaAgent.b.doll=TinyTavernUI.makeDoll(chosen,{hair:6});}db={ref:()=>({set:async d=>qaWrites.push(d)})};const oldDraw=TinyTavernUI.draw;TinyTavernUI.draw=(cv,d,done)=>{cv.dataset.qaDoll=JSON.stringify(d);oldDraw(cv,d,done);};TinyTavernUI.open('shop');},products);
  let ward;for(let n=0;n<100;n++){ward=page.frames().find(f=>decodeURI(f.url()).includes('時裝間比較.html'));if(ward)break;await new Promise(r=>setTimeout(r,50));}await ward.locator('#avatar').waitFor();
  await ward.waitForFunction(()=>{const cv=document.querySelector('#avatar');return cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.some((v,i)=>i%4===3&&v)});

  await ward.locator('[data-category=other]').click();
  await ward.waitForFunction(()=>document.querySelectorAll('#detail .drink-slide').length===3);await page.waitForTimeout(600);
  const layout=await ward.evaluate(()=>{const rect=e=>e.getBoundingClientRect().toJSON(),track=document.querySelector('.drink-track'),shop=document.querySelector('.shop');return {width:innerWidth,height:innerHeight,shop:{...rect(shop),scrollHeight:shop.scrollHeight,clientHeight:shop.clientHeight},track:{...rect(track),scrollWidth:track.scrollWidth,clientWidth:track.clientWidth},cards:[...document.querySelectorAll('#detail .drink-slide')].map(e=>({...rect(e),scene:rect(e.querySelector('.drink-scene')),heading:rect(e.querySelector('.drink-heading')),style:e.querySelector('.drink-scene').getAttribute('style'),tone:e.dataset.tone})),pageOverflow:document.documentElement.scrollHeight>innerHeight+1}});
  assert(!layout.pageOverflow,'no vertical page overflow');assert(layout.shop.scrollHeight<=layout.shop.clientHeight+1,'shop does not vertically scroll');
  for(const c of layout.cards){assert(c.top>=-1&&c.bottom<=layout.height+1,'full card fits vertical viewport');assert(c.heading.top>=c.top&&c.heading.bottom<c.scene.top,'heading clears original artwork');assert(Math.abs(c.scene.width/c.scene.height-320/430)<.001,'original composition aspect ratio');const scale=c.scene.width/320;assert(c.scene.left-10*scale>c.left&&c.scene.left+352*scale<c.right&&c.scene.top+454*scale<c.bottom,'full original alpha bounds including edge decorations remain inside card');}
  if(!mobile){assert(layout.track.scrollWidth<=layout.track.clientWidth+1,'desktop shows all three cards without horizontal scrolling');for(const c of layout.cards)assert(c.left>=-1&&c.right<=layout.width+1,'all three desktop cards fit');}
  else {assert(layout.track.scrollWidth>layout.track.clientWidth,'mobile retains horizontal card browsing');const c=layout.cards[0];assert(c.left>=layout.track.left-1&&c.right<=layout.track.right+1,'mobile shows one full card');}
  await page.screenshot({path:path.join(out,'drinks-'+width+'.png')});
  // Every card remains selectable; the popup retains the exact saved layout variables.
  for(let i=0;i<3;i++){
    if(mobile){await ward.locator('.drink-track').evaluate((e,i)=>{const card=e.children[i];e.scrollLeft=card.offsetLeft-e.offsetLeft-(e.clientWidth-card.offsetWidth)/2},i);await page.waitForTimeout(500);}
    const card=ward.locator('#detail .drink-slide').nth(i),original=await card.locator('.drink-scene').getAttribute('style');await card.click();await ward.locator('#drinkOrderDialog[open]').waitFor();
    assert.equal(await ward.locator('#drinkOrderDialog .drink-scene').getAttribute('style'),original,'order keeps approved composition');
    const name=await card.locator('h2').textContent();assert.equal(await ward.locator('#drinkOrderDialog .order-product').textContent(),name);
    if(!mobile){await ward.locator('#drinkQuantity').fill('12');await ward.locator('#drinkQuantity').dispatchEvent('input');assert((await ward.locator('#drinkSubmit').textContent()).includes('1188'));}
    await ward.locator('#drinkOrderDialog .order-close').click();assert.equal(await ward.locator('#drinkOrderDialog[open]').count(),0);
  }
  assert.deepEqual(await lobby.evaluate(()=>qaWrites),[]);assert.deepEqual(errors,[]);report.push({width,height,mobile,layout});console.log('PASS drink fit '+width+'x'+height);await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
