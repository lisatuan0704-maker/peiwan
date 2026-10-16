const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const server=http.createServer((req,res)=>{const f=path.join(process.cwd(),decodeURIComponent(new URL(req.url,'http://local').pathname));fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':f.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(b);});});
await new Promise(r=>server.listen(8771,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(let round=1;round<=3;round++){
 const page=await browser.newPage({viewport:round===2?{width:390,height:844}:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',ws=>ws.close());await page.route(/(firebasedatabase\.app|firebaseio\.com|discord\.com\/api\/webhooks)/,r=>r.abort());
 await page.goto('http://127.0.0.1:8771/lobby.html');await page.waitForFunction(()=>window.TinyTavernUI);
 await page.evaluate(()=>{
 firebase.database().goOffline();window.__shopCfg={older:{name:'既有套裝',seasonFeatured:283,price:300,active:true,parts:TTSeasonDrafts.season291_bear.parts}};window.__outfitList=()=>[{id:'older'}];window.__owned={dyeTickets:2};window.__ownedParts=()=>Object.fromEntries([['front','前髮'],['back','後髮'],['cloth','衣服'],['face','眼睛'],['brow','眉毛']].map(([k,c])=>[k,{items:TP.parts[c].map((p,idx)=>({idx,n:p.n||k+idx}))}]));
 for(const k of ['__shopCfg','__outfitList','__ownedParts'])Object.defineProperty(window,k,{value:window[k],writable:false,configurable:true});
 window.qaAgent={b:{doll:{front:0,back:0,cloth:0,face:0,hair:0}}};me=()=>qaAgent;myKey='qa-only';window.qaWrites=0;
 db={ref:p=>({once:async()=>({val:()=>__owned}),transaction:async fn=>{assertLocal(p);const next=fn(JSON.parse(JSON.stringify(__owned)));if(next===undefined)return {committed:false};qaWrites++;window.__owned=next;return {committed:true,snapshot:{val:()=>__owned}};},set:async d=>{if(p!==ROOT+'/lobby/qa-only/doll')throw Error('非測試寫入');qaAgent.b.doll=d;}})};
 function assertLocal(p){if(p!==ROOT+'/owned/qa-only')throw Error('非測試交易');}
 const draw=TinyTavernUI.draw;TinyTavernUI.draw=(cv,d)=>{cv.dataset.doll=JSON.stringify(d);draw(cv,d);};TinyTavernUI.open('shop');
 });
 let ward;for(let n=0;n<150;n++){ward=page.frames().find(f=>decodeURI(f.url()).includes('時裝間比較'));if(ward)break;await page.waitForTimeout(50);}assert(ward);
 await ward.locator('[data-try-outfit="season291_bear"]').waitFor();assert.equal(await ward.locator('.season-card').count(),2);
 assert(await ward.locator('#seasonNext').isVisible());await ward.locator('#seasonNext').click();assert(await ward.locator('[data-buy-outfit="older"]').isEnabled());await ward.locator('#seasonPrev').click();
 const fits=await ward.locator('.season-actions').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().bottom<=innerHeight));assert(fits,'兩套新品與操作必須留在首屏');
 for(const id of ['season291_bear','season291_wolf']){
  assert(await ward.locator('[data-buy-outfit="'+id+'"]').isDisabled());await ward.locator('[data-try-outfit="'+id+'"]').click();await page.waitForTimeout(400);
  const d=await ward.locator('#avatar').evaluate(c=>JSON.parse(c.dataset.doll));assert.equal(d.ps.front,id);assert.equal(d.ps.back,id);
  if(id.endsWith('wolf')){const names=await page.evaluate(d=>d.uiAccessories.map(r=>TTSeasonDrafts[r.source].parts[r.slot].n),d);assert(names.some(n=>n.includes('吉他')));assert(!names.some(n=>n.includes('爪子')));}
 }
 await assert.rejects(()=>page.evaluate(()=>TinyTavernUI.buy('season291_wolf')),/售價尚未設定/);
 await ward.locator('#dyeTicket').click();assert(await ward.locator('#dyeHighlight').isVisible());assert(await ward.locator('#dyeGradient').isVisible());
 await ward.locator('#dyeGradient').check();await ward.locator('#dyeMain').fill('#583578');await ward.locator('#dyeTail').fill('#75bddd');await ward.locator('#dyeHighlight').fill('#ff4060');await page.waitForTimeout(150);
 const before=await ward.locator('#dyePreview').evaluate(c=>c.toDataURL());await ward.locator('#dyeHighlight').fill('#40ff60');await page.waitForTimeout(150);assert.notEqual(await ward.locator('#dyePreview').evaluate(c=>c.toDataURL()),before);
 const dye=await ward.locator('#dyePreview').evaluate(c=>JSON.parse(c.dataset.doll));assert.equal(dye.hairHex,'#583578');assert.equal(dye.hairHex2,'#75bddd');assert.equal(dye.hairHighlight,'#40ff60');
 // 未取得髮型只可預覽，保存不得扣券。
 await ward.locator('#saveDye').click();await ward.locator('#dyeError').waitFor();assert.equal(await page.evaluate(()=>__owned.dyeTickets),2);
 await page.evaluate(()=>__owned.season291_wolf=true);await ward.locator('#saveDye').click();await ward.waitForFunction(()=>document.getElementById('dyeDialog').hidden);
 const saved=await page.evaluate(()=>Object.entries(__owned.dyedHairSets));assert.equal(saved.length,1);assert.equal(saved[0][1].highlight,'#40ff60');assert.equal(await page.evaluate(()=>__owned.dyeTickets),1);
 await page.evaluate(async saved=>{const [id,s]=saved;const selection={front:s.front,back:s.back};await TinyTavernUI.saveDye(selection,s,id);if(__owned.dyeTickets!==1)throw Error('重試重複扣券');},saved[0]);
 await ward.locator('[data-saved]').click();const restored=await ward.locator('#avatar').evaluate(c=>JSON.parse(c.dataset.doll));assert.equal(restored.hairHighlight,'#40ff60');assert.equal(restored.hairHex2,'#75bddd');
 await page.evaluate(()=>__owned.dyeTickets=0);await ward.locator('#dyeTicket').click();assert(await ward.locator('#saveDye').isHidden());await ward.locator('#cancelDye').click();
 await ward.locator('[data-area="store"]').click();await page.waitForTimeout(200);assert(await ward.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'../../output/season291-round-'+round+'.png',fullPage:true});assert.deepEqual(errors,[]);await page.close();console.log('PASS '+round+': two outfits, try-on, separate highlight/gradient, owned validation, one-ticket save, idempotency, reload, zero-ticket preview');
}}
finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
