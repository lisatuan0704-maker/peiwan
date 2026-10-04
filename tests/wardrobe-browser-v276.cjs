const fs=require('fs'),assert=require('assert/strict'),cp=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const testUrl=process.env.TT_TEST_URL||'http://127.0.0.1:8766';if(!['127.0.0.1','localhost'].includes(new URL(testUrl).hostname))throw Error('僅允許本機隔離測試');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{for(const round of [0,1,2,3]){
const page=await browser.newPage({viewport:{width:round===2?430:1280,height:960}});
await page.routeWebSocket('**',ws=>ws.close());await page.route(/(firebasedatabase\.app|firebaseio\.com|discord\.com\/api\/webhooks)/,r=>r.abort());
if(round===0)for(const file of ['tavern-ui-bridge.js','tavern-ui/live-wardrobe.js']){const body=cp.execFileSync('git',['show','8e0ba5c:'+file],{encoding:'utf8',maxBuffer:20e6});await page.route('**/'+file+'?*',r=>r.fulfill({body,contentType:'text/javascript'}));}
const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(testUrl+'/lobby.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.TinyTavernUI);
await page.evaluate(()=>{
 firebase.database().goOffline();
 const image=(cat,i,n)=>({d:'data:image/png;base64,'+TP.parts[cat][i].d,n,g:cat.includes('髮')});
 const partsA={front:image('前髮',0,'原前髮'),back:image('後髮',0,'原後髮'),cloth:image('衣服',0,'原衣服'),eye:image('眼睛',0,'原眼睛')};
 const partsB={front:image('前髮',1,'新前髮'),back:image('後髮',1,'新後髮'),cloth:image('衣服',1,'新衣服'),eye:image('眼睛',1,'新眼睛'),acc1:{...image('前髮',1,'頭飾'),n:'頭飾'},pet:image('衣服',2,'寵物'),seat:image('衣服',3,'座椅')};
 window.__shopCfg={qaA:{name:'原套裝',active:true,price:100,parts:partsA},qaB:{name:'測試套裝',active:true,price:200,parts:partsB},qaC:{name:'未購套裝',active:true,price:300,parts:{cloth:image('衣服',2,'未購衣服')}}};
 window.__outfitList=()=>Object.keys(__shopCfg).map(id=>({id,nm:__shopCfg[id].name,pr:__shopCfg[id].price,doll:{front:0,back:0,cloth:0,face:0,hair:0}}));
 window.__owned={qaA:true,qaB:true,dyeTickets:2,dyedHairSets:{saved:{name:'已存粉色',front:{slot:'front',source:'qaA'},back:{slot:'back',source:'qaA'},main:'#ed8abb',tail:'#bf70c5'}}};
 window.__ownedParts=()=>Object.fromEntries([['front','前髮'],['back','後髮'],['cloth','衣服'],['face','眼睛'],['brow','眉毛']].map(([k,c])=>[k,{items:TP.parts[c].map((p,idx)=>({idx,n:p.n||k+idx}))}]));
 for(const key of ['__shopCfg','__outfitList','__ownedParts'])Object.defineProperty(window,key,{value:window[key],writable:false,configurable:true});
 window.qaAgent={b:{name:'隔離測試',doll:{front:0,back:0,cloth:0,face:0,brow:0,hair:0,ps:{front:'qaA',back:'qaA',cloth:'qaA',eye:'qaA'},dyedHairSet:'saved',hairHex:'#ed8abb',hairHex2:'#bf70c5'}},x:.5,y:.7};
 me=()=>qaAgent;myKey='qa-local';window.qaWrites=[];
 db={ref:p=>({once:async()=>({val:()=>__owned}),transaction:async fn=>{if(p!==ROOT+'/owned/qa-local')throw Error('禁止非測試交易');const val=fn(JSON.parse(JSON.stringify(__owned)));if(!val)return {committed:false};const sorted=x=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;window.__owned=sorted(val);return {committed:true,snapshot:{val:()=>__owned}}},set:async d=>{if(p!==ROOT+'/lobby/qa-local/doll')throw Error('禁止非測試寫入');qaWrites.push(JSON.parse(JSON.stringify(d)));qaAgent.b.doll=d}})};
 const draw=TinyTavernUI.draw;TinyTavernUI.draw=(cv,d)=>{cv.dataset.doll=JSON.stringify(d);draw(cv,d)};
 TinyTavernUI.open('shop');
});
await page.waitForFunction(()=>{const outer=document.querySelector('#ttApprovedUI iframe');return !!outer?.contentDocument?.querySelector('#shopFrame')?.contentWindow?.ttDressArea});
const outer=page.frames().find(f=>f.url().includes('/tavern-ui/index.html'));const ward=page.frames().find(f=>f.url().includes(encodeURI('時裝間比較.html'))||f.url().includes('時裝間比較.html'));
assert(ward);await ward.locator('[data-category="cloth"]').click();await ward.locator('[data-item="qaB::cloth"]').click();await page.waitForTimeout(900);
if(round===0){assert((await ward.locator('#toast').innerText()).includes('染色組合必須整組穿戴'));results.push({baseline:'v275',reproduced:true});await page.close();continue;}
let doll=()=>ward.locator('#avatar').evaluate(cv=>JSON.parse(cv.dataset.doll));let d=await doll();assert.equal(d.ps.cloth,'qaB');assert.equal(d.dyedHairSet,'saved');assert.equal(d.hairHex,'#ed8abb');
const pixels=()=>ward.locator('#avatar').evaluate(cv=>cv.toDataURL());const clothB=await pixels();await ward.locator('[data-item="qaA::cloth"]').click();await page.waitForTimeout(600);assert.notEqual(await pixels(),clothB,'實際角色像素必須換衣');
await ward.locator('[data-category="hair"]').click();await ward.locator('[data-item="qaB::hair"]').click();d=await doll();assert.equal(d.ps.front,'qaB');assert(!d.dyedHairSet);assert(!d.hairHex);
await ward.locator('#reset').click();d=await doll();assert.equal(d.ps.front,'qaA');assert.equal(d.dyedHairSet,'saved');
await ward.locator('[data-category="bundles"]').click();await ward.locator('[data-try-outfit="qaB"]').click();d=await doll();assert.equal(d.ps.cloth,'qaB');assert.equal(d.ps.pet,'qaB');assert(!d.dyedHairSet);
await ward.locator('[data-area="bag"]').click();assert.equal(await ward.locator('[data-category="bundles"]').count(),0);await ward.locator('[data-category="hair"]').click();await ward.locator('[data-hair-section="saved"]').click();assert(await ward.locator('[data-hair-section="original"]').isVisible());await ward.locator('[data-saved="saved"]').click();d=await doll();assert.equal(d.dyedHairSet,'saved');
await ward.locator('[data-category="cloth"]').click();await ward.locator('[data-item="qaB::cloth"]').click();await ward.locator('#showWear').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>qaWrites.length),1);
await ward.locator('#reset').click();d=await doll();assert.equal(d.ps.cloth,'qaB');assert.equal(d.dyedHairSet,'saved');
for(const category of ['pet','seat']){await ward.locator('[data-category="'+category+'"]').click();await ward.locator('[data-item="qaB::'+category+'"]').click();assert.equal((await doll()).ps[category],'qaB');await ward.locator('#showWear').click();await page.waitForTimeout(60);await ward.locator('#reset').click();assert.equal((await doll()).ps[category],'qaB');await ward.locator('#removePart').click();assert(!(await doll()).ps[category]);assert((await doll()).uiBaseSlots.includes(category));}
await ward.locator('[data-area="store"]').click();await ward.locator('[data-category="cloth"]').click();if(!await ward.locator('[data-item="qaC::cloth"]').count())await ward.locator('#nextPage').click();await ward.locator('[data-item="qaC::cloth"]').click();assert.equal((await doll()).ps.cloth,'qaC');const writes=await page.evaluate(()=>qaWrites.length);await ward.evaluate(()=>document.getElementById('showWear').click());await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>qaWrites.length),writes);assert((await ward.locator('#toast').innerText()).includes('尚未取得'));
assert.equal(await page.evaluate(()=>__owned.dyeTickets),2);
await ward.locator('[data-area="bag"]').click();await ward.locator('[data-archive="collection"]').click();assert(!(await ward.locator('.preview').isVisible()),'收藏頁須隱藏試衣舞臺');assert(!(await ward.locator('#catalog').isVisible()),'收藏頁須隱藏衣櫥');await ward.locator('[data-archive="wear"]').click();assert(await ward.locator('.preview').isVisible());
await ward.locator('[data-category="acc"]').click();await ward.locator('[data-item="qaB::acc1"]').click();assert.equal((await doll()).uiAccessories.length,1);await ward.locator('#removePart').click();assert.equal((await doll()).uiAccessories.length,0);
await ward.locator('[data-area="store"]').click();
await ward.locator('#reset').click();await ward.locator('[data-category="cloth"]').click();await ward.locator('[data-item="qaB::cloth"]').click();await page.waitForTimeout(600);await page.screenshot({path:'../../output/wardrobe-v276-'+round+'.png'});
await ward.locator('#dyeTicket').click();await ward.locator('#dyeName').fill('測試紫色');await ward.locator('#dyeMain').fill('#8877cc');await ward.locator('#saveDye').click();await ward.waitForFunction(()=>document.getElementById('dyeDialog').hidden&&document.body.dataset.area==='bag');
assert.equal(await page.evaluate(()=>__owned.dyeTickets),1);assert.equal(await ward.locator('[data-hair-section="saved"]').getAttribute('aria-pressed'),'true');assert.equal(await ward.locator('[data-saved]').count(),2);
await ward.locator('[data-saved^="dye_"]').click();assert.equal((await doll()).hairHex,'#8877cc');await page.screenshot({path:'../../output/my-hair-v277-'+round+'.png'});await ward.locator('[data-hair-section="original"]').click();assert(await ward.locator('#grid').isVisible());assert(!(await ward.locator('#bundles').isVisible()));await ward.locator('[data-hair-section="saved"]').click();assert(!(await ward.locator('#grid').isVisible()));assert(await ward.locator('#bundles').isVisible());
assert.deepEqual(errors,[]);results.push({round,passed:true,realPixelChange:true,checks:['已染色換衣','髮型切換','還原','整套','保存組合','穿上後重開','寵物座椅保留及卸下','未購可試不可保存','免費試穿不扣券','保存新染色僅扣一次且顯示背包','資料庫鍵排序相容','收藏切換','配件卸下','頭髮雙分頁切換及保存導向']});await page.close();
}fs.writeFileSync('../../output/wardrobe-v276-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
