const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../output/order-display-v377');
const people=[{cid:'-OxY46ezlpnRt64hUIw9',old:'Caboo',name:'蕪'},{cid:'-OxY7C4vDkgsr1zcyWbk',old:'大卡',name:'縭'},{cid:'-OzbfbQcF6J6fIR6YYGh',old:'小mo',name:'桃'}];
const fixtures={};
for(const status of ['confirmed','done'])for(const [i,p] of [...people].reverse().entries())fixtures['qa-'+status+'-'+p.name]={type:'play',planName:'遊戲陪伴・2 小時',staffCid:p.cid,staffName:p.old,status,createdAt:Date.UTC(2026,9,25,4,0),amount:320,paidBy:'wallet',accepted:true,groupId:'qa-group-'+status,groupSize:2,groupAmount:640,groupStaffNames:['Caboo','大卡'],no:'QA-'+(status==='done'?'H':'A')+'0'+i};
const fixtureSnapshot=JSON.stringify(fixtures);
const contentType=p=>({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'})[path.extname(p)]||'text/html; charset=utf-8';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',contentType(p));res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
 try{
  for(const [width,height,mobile] of [[1366,768,false],[390,844,true]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'}),errors=[],blocked=[];
   page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',ws=>ws.close());
   await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(!['GET','HEAD'].includes(req.method())||/(firebaseio\.com|firebasedatabase\.app|api\.tinytavern\.tw|discord\.com\/api\/webhooks)/.test(req.url())||url.pathname.startsWith('/api/')){blocked.push({method:req.method(),url:url.origin+url.pathname});return route.abort();}if(url.hostname==='tinytavern.tw'){const p=path.join(root,decodeURIComponent(url.pathname));if(fs.existsSync(p)&&fs.statSync(p).isFile())return route.fulfill({body:fs.readFileSync(p),contentType:contentType(p)});return route.abort();}return route.continue();});
   await page.goto(origin+(mobile?'/lobby.html?preview=1&mobile=1':'/lobby-view.html?preview=1'));
   let lobby;for(let n=0;n<80;n++){lobby=page.frames().find(f=>{try{return new URL(f.url()).pathname==='/lobby.html';}catch{return false;}});if(lobby)break;await page.waitForTimeout(50);}assert(lobby,'actual lobby frame exists');
   await lobby.waitForFunction(()=>window.TTLivePresentation&&window.TTVoiceOrders&&typeof ttOrderStaffDisplayName==='function');
   await lobby.evaluate(()=>document.fonts.ready);await lobby.addStyleTag({content:'#dcGate,#intro,#loadscr,#signinTip,#emptyMsg{display:none!important}'});
   await lobby.evaluate(data=>{try{firebase.database().goOffline();}catch{}db=null;myKey=null;const freeze=o=>{Object.values(o).filter(v=>v&&typeof v==='object').forEach(freeze);return Object.freeze(o);};window.qaOriginalOrderSnapshot=JSON.stringify(data);myOrdersCache=freeze(data);localStorage.setItem('tt_orders',JSON.stringify(Object.keys(data)));_ordTab='active';_ordPage=0;shopOpen(4);},fixtures);
   const states=[];
   for(const tab of ['active','history']){
    await lobby.locator(tab==='active'?'#ordTabA':'#ordTabH').click();await page.waitForTimeout(160);
    const state=await lobby.evaluate(()=>{const list=document.getElementById('ordList'),panel=document.querySelector('#shopM4 .panel'),lr=list.getBoundingClientRect(),pr=panel.getBoundingClientRect();return {selectedTab:document.getElementById('ordTabA').getAttribute('aria-selected')==='true'?'active':'history',text:list.innerText,cardCount:list.querySelectorAll('.order').length,rect:pr.toJSON(),list:{clientWidth:list.clientWidth,scrollWidth:list.scrollWidth,clientHeight:list.clientHeight,scrollHeight:list.scrollHeight},cards:[...list.querySelectorAll('.order')].map(el=>({heading:el.querySelector('.order-top small')?.textContent,note:el.querySelector('.tt-order-note')?.textContent,amount:el.querySelector('.order-top strong')?.textContent,left:el.getBoundingClientRect().left-lr.left,right:el.getBoundingClientRect().right-lr.right})),unchanged:JSON.stringify(myOrdersCache)===window.qaOriginalOrderSnapshot};});
    assert.equal(state.selectedTab,tab);assert.equal(state.cardCount,3);assert(state.unchanged,'rendering must preserve original old-name records');
    for(const p of people){assert(state.text.includes('與 '+p.name+' 一起玩'));assert(state.text.includes('這張為 '+p.name+' 的陪玩紀錄'));assert(!state.text.includes(p.old));}
    for(const card of state.cards){assert.equal(card.amount,'NT$ 320');assert(card.note.includes('同組 2 位陪玩・整組實付 NT$ 640'));assert(card.left>=-1&&card.right<=1,'order card must not overflow its list horizontally');}
    assert(state.list.scrollWidth<=state.list.clientWidth+1,'no horizontal list overflow');
    await lobby.locator('#ordList').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(out,`orders-${tab}-${width}-full.png`)});
    for(const p of people){const card=lobby.locator('#ordList .order').filter({has:lobby.locator('.order-top small',{hasText:'與 '+p.name+' 一起玩'})});await card.scrollIntoViewIfNeeded();await card.screenshot({path:path.join(out,`orders-${tab}-${width}-${p.name}.png`)});}
    states.push(state);
   }
   const aliases=await lobby.evaluate(()=>({withoutCid:['Caboo','大卡','小mo'].map(staffName=>ttOrderStaffDisplayName({staffName})),withCidMissingName:ttOrderStaffDisplayName({staffCid:'-OxY46ezlpnRt64hUIw9'}),storedNames:Object.values(myOrdersCache).map(o=>o.staffName),unchanged:JSON.stringify(myOrdersCache)===window.qaOriginalOrderSnapshot}));
   assert.deepEqual(aliases.withoutCid,['蕪','縭','桃']);assert.equal(aliases.withCidMissingName,'蕪');assert(aliases.unchanged);assert.deepEqual(errors,[]);
   results.push({viewport:[width,height],mobile,states,aliases,pageErrors:errors,blockedRequests:blocked,isolated:true,externalWritesAllowed:false});console.log(`PASS ${width}x${height}: active/history 3 formal names in both card positions; group NT$640 / 2 people; snapshots unchanged; no horizontal overflow`);await page.close();
  }
  assert.equal(JSON.stringify(fixtures),fixtureSnapshot);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({allPassed:true,fixtureSnapshot:fixtures,results},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
