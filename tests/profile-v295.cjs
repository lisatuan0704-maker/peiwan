const fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const server=http.createServer((req,res)=>{const f=path.join(process.cwd(),decodeURIComponent(new URL(req.url,'http://local').pathname));fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':f.endsWith('.webp')?'image/webp':'text/html; charset=utf-8');res.end(b);});});
await new Promise(r=>server.listen(8774,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [1280,390,768]){
const page=await browser.newPage({viewport:{width,height:900}});
await page.routeWebSocket('**',ws=>ws.close());await page.route(/(firebasedatabase\.app|firebaseio\.com|discord\.com\/api\/webhooks)/,r=>r.abort());
await page.goto('http://127.0.0.1:8774/lobby.html');await page.waitForFunction(()=>window.TinyTavernUI);
await page.addStyleTag({content:'#dcGate,#intro,#loadscr{display:none!important}'});
await page.evaluate(()=>{firebase.database().goOffline();db=null;window.qaProfile={b:{name:'驗證旅人',pub:{nopic:true},doll:{front:0,back:0,cloth:0,face:0,hair:0},quote:'測試個人資料，不應被框外小人遮住。'}};me=()=>qaProfile;});
for(const frame of ['wr1','vip1','vip5']){
await page.evaluate(async frame=>{qaProfile.b.pub.frm=frame;await openCard(qaProfile);},frame);
assert.equal(await page.locator('#pcStage canvas').count(),2);assert.equal(await page.locator('#pcStage .pcBeside').count(),1);const bounds=await page.locator('#pcStage .pcBeside').evaluate(e=>({sprite:e.getBoundingClientRect().toJSON(),column:e.closest('.pcL').getBoundingClientRect().toJSON()}));assert(bounds.sprite.right<=bounds.column.right,'companion overlaps profile details');assert(bounds.sprite.left>=bounds.column.left,'companion outside illustration column');
await page.evaluate(()=>closeCard());await page.evaluate(()=>openCard(qaProfile));assert.equal(await page.locator('#pcStage canvas').count(),2);
}
await page.evaluate(()=>{qaProfile.b.pub.frm='wr1';drawFullCard(qaProfile.b);}); const shape=await page.locator('#pcStage > .ttfAva > canvas').evaluate(c=>({shadow:getComputedStyle(c).boxShadow,width:c.getBoundingClientRect().width,box:c.parentElement.getBoundingClientRect().width}));assert.equal(shape.shadow,'none');assert(Math.abs(shape.width-shape.box)<1);await page.waitForTimeout(650);await page.screenshot({path:'../../output/profile295-'+width+'.png'});
await page.evaluate(()=>{qaProfile.b.pub={pic:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="pink"/></svg>'};drawFullCard(qaProfile.b);});
assert.equal(await page.locator('#pcStage canvas').count(),1);assert.equal(await page.locator('#pcStage .ttfAva img').count(),1);
await page.evaluate(()=>{closeCard();_bkTab='me';bkPaint();});
assert.equal(await page.locator('#bkAvaHost canvas').count(),2);assert.equal(await page.locator('#bkAvaHost .pcBeside').count(),1);
await page.evaluate(()=>{bkGo('frames');bkGo('me');});assert.equal(await page.locator('#bkAvaHost canvas').count(),2);
console.log('PASS '+width+': three frames, reopen, photo, notebook tab return, outside avatar retained; inner canvas fills opening without legacy outline');await page.close();
}}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
