// 闆卡分享網站介面回歸 v418／v419（模擬 client，不連正式 API、不向 Discord 發文）
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const SRC=fs.readFileSync(path.join(__dirname,'..','lobby-ui','card-share.mjs'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function installCardShare','function installCardShare');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();
 await ctx.route('https://audit.local/**',async r=>{const u=new URL(r.request().url());
  if(u.pathname==='/')return r.fulfill({contentType:'text/html',body:'<html><body></body></html>'});
  if(u.pathname.startsWith('/img/ok'))return r.fulfill({contentType:'image/png',body:PNG});
  if(u.pathname.startsWith('/img/slow')){await new Promise(x=>setTimeout(x,1500));return r.fulfill({contentType:'image/png',body:PNG});}
  return r.fulfill({status:404,body:'x'});});
 async function setup(){const p=await ctx.newPage();p.on('pageerror',e=>{console.log('PAGEERROR',e.message);fails++;});await p.goto('https://audit.local/?cardshare=1');
  await p.evaluate(()=>{
   window.me=()=>({b:{tags:['測試標籤'],games:'valorant'}});
   window.T={calls:{current:0,preview:0,status:0,publish:[]},pub:null,curFail:false,imgKind:'ok',statusMode:'processing',pubMode:'ok'};
   const wait=()=>{let res,rej;const pr=new Promise((a,b)=>{res=a;rej=b});return {pr,res,rej};};
   window.mock={reset(){T.resets=(T.resets||0)+1},
    async current(){T.calls.current++;if(T.curFail)throw Object.assign(Error('x'),{code:'TEMPORARILY_UNAVAILABLE'});return {publication:T.pub}},
    preview(fields){T.calls.preview++;T.sent=fields;const w=wait();T.finishPreview=f=>w.res({previewId:'pv'+T.calls.preview,selectedFields:fields,discordIdentity:{id:'123',displayName:'Akian'},destination:{name:'旅人相遇處'},expiresAt:Date.now()+9e5,imagePath:'/x'});return w.pr},
    async image(){return 'https://audit.local/img/'+T.imgKind+'?'+Math.random()},
    publish(pid,rid){T.calls.publish.push(rid);const w=wait();T.finishPublish=w;return w.pr},
    async status(){T.calls.status++;return T.statusMode==='processing'?{publicationId:'pub1',status:'processing'}:{publicationId:'pub1',status:'published',messageUrl:'https://discord.com/channels/1/2/3',publishedAt:Date.now()}},
    async withdraw(){T.pub=null;return {status:'withdrawn'}}};
   window.U={uid:'discord_12345678901234567',getIdToken:async()=>'t'};window.cbs=[];
   window.auth={get currentUser(){return window.U},onAuthStateChanged(fn){cbs.push(fn);fn(window.U)}};
   window.switchUser=u=>{window.U=u;cbs.forEach(f=>f(u));};
  });
  await p.addScriptTag({content:'const createCardShareClient=()=>window.mock;const beginVoiceLogin=()=>{};'+SRC+'\ninstallCardShare({auth:window.auth});'});
  return p;}
 const q=(p,s)=>p.evaluate(s=>{const n=document.querySelector(s);return n?{dis:n.disabled,chk:n.checked,txt:n.textContent}:null},s);
 const field=(p,lb)=>p.evaluate(lb=>{const l=[...document.querySelectorAll('.cs-field')].find(x=>x.textContent.trim().startsWith(lb));const i=l.querySelector('input');return {dis:i.disabled,chk:i.checked}},lb);
 const forceToggle=(p,lb)=>p.evaluate(lb=>{const l=[...document.querySelectorAll('.cs-field')].find(x=>x.textContent.trim().startsWith(lb));const i=l.querySelector('input');i.checked=!i.checked;i.dispatchEvent(new Event('change'))},lb);
 const click=(p,txt)=>p.evaluate(t=>{const x=[...document.querySelectorAll('#cardShareM button')].find(b=>b.textContent.includes(t));x.click();},txt);
 const tick=ms=>new Promise(r=>setTimeout(r,ms));

 // 1. 預覽期間欄位停用；強制改欄位也不生效；回來的預覽與畫面欄位一致
 {const p=await setup();await p.evaluate(()=>TTCardShare.open());await tick(100);
  await click(p,'產生預覽');await tick(50);
  const f=await field(p,'標籤');ok(f.dis,'預覽進行中欄位停用');
  await forceToggle(p,'標籤');await tick(50);
  await p.evaluate(()=>T.finishPreview());await tick(400);
  const f2=await field(p,'標籤');ok(!f2.chk&&JSON.stringify(await p.evaluate(()=>T.sent))==='["name","character"]','強制勾選被忽略，畫面欄位與送出欄位一致');
  ok(!(await field(p,'標籤')).dis,'預覽完成後欄位恢復可改');
  ok(!(await q(p,'.cs-consent input')).dis,'圖片載入成功後才能勾同意');
  // 改欄位 → 舊預覽失效
  await forceToggle(p,'標籤');await tick(50);ok(!(await p.$('.cs-preview')),'改欄位後舊預覽清除');
  await p.close();}
 // 1b. 預覽中換帳號：舊回應不套用，舊 finally 不動新狀態
 {const p=await setup();await p.evaluate(()=>TTCardShare.open());await tick(100);await click(p,'產生預覽');await tick(50);
  const old=await p.evaluate(()=>T.finishPreview);
  await p.evaluate(()=>switchUser({uid:'discord_99999999999999999',getIdToken:async()=>'t2'}));await tick(100);
  await p.evaluate(()=>{T.finishPreview()});await tick(300);
  ok(!(await p.$('.cs-preview')),'換帳號後舊預覽回應不顯示');
  const gen=await p.evaluate(()=>[...document.querySelectorAll('#cardShareM button')].find(b=>/預覽/.test(b.textContent)));
  ok(!(await field(p,'標籤')).dis,'舊請求結束不會把新帳號狀態卡在忙碌');
  await p.close();}
 // 2. 每次打開都重讀 current；另一分頁撤下後重開顯示欄位
 {const p=await setup();await p.evaluate(()=>{T.pub={status:'published',publicationId:'pub1',publishedAt:Date.now(),messageUrl:'https://discord.com/channels/1/2/3'}});
  await p.evaluate(()=>TTCardShare.open());await tick(150);ok(await p.evaluate(()=>document.body.innerText.includes('你的闆卡已經分享到 Discord')),'第一次打開顯示已分享');
  await click(p,'×');const before=await p.evaluate(()=>T.calls.current);await p.evaluate(()=>{T.pub=null});
  await p.evaluate(()=>TTCardShare.open());await tick(150);
  ok(await p.evaluate(()=>T.calls.current)===before+1,'重開時重新呼叫 current');
  ok(!(await p.evaluate(()=>document.body.innerText.includes('你的闆卡已經分享到 Discord')))&&!!(await p.$('.cs-field')),'別處撤下後重開回到欄位選擇');
  // current 失敗：顯示重新讀取，不當成沒有分享
  await click(p,'×');await p.evaluate(()=>{T.curFail=true});await p.evaluate(()=>TTCardShare.open());await tick(150);
  ok(!(await p.$('.cs-field'))&&await p.evaluate(()=>document.body.innerText.includes('讀取分享狀態失敗')),'current 失敗不顯示欄位選擇');
  await p.evaluate(()=>{T.curFail=false;T.pub={status:'published',publicationId:'pub1',publishedAt:Date.now()}});await click(p,'重新讀取');await tick(150);
  ok(await p.evaluate(()=>document.body.innerText.includes('你的闆卡已經分享到 Discord')),'按重新讀取後顯示正確狀態');
  await p.close();}
 // 2b. processing 輪詢到上限後重開可刷新，且只有一個輪詢
 {const p=await setup();await p.clock.install();await p.evaluate(()=>{T.pub={status:'processing',publicationId:'pub1'}});
  await p.evaluate(()=>TTCardShare.open());await p.clock.runFor(200);
  await p.clock.runFor(3100*6);const n1=await p.evaluate(()=>T.calls.status);
  ok(n1===5,'輪詢 5 次後停止（實際 '+n1+'）');
  await click(p,'×');await p.evaluate(()=>TTCardShare.open());await p.evaluate(()=>TTCardShare.open());await p.clock.runFor(200);
  await p.evaluate(()=>{T.statusMode='published'});await p.clock.runFor(3100);
  const n2=await p.evaluate(()=>T.calls.status);ok(n2===6,'重開後重新輪詢且不重複（多開兩次只多 1 次查詢，實際 '+(n2-n1)+'）');
  ok(await p.evaluate(()=>document.body.innerText.includes('你的闆卡已經分享到 Discord')),'輪詢取得已分享');
  await p.close();}
 // 3. 圖片載入失敗：不能同意、有重試；圖片慢：載入前不能同意；載入後不無限重畫
 {const p=await setup();await p.evaluate(()=>{T.imgKind='bad'});await p.evaluate(()=>TTCardShare.open());await tick(100);
  await click(p,'產生預覽');await tick(30);await p.evaluate(()=>T.finishPreview());await tick(600);
  ok(!(await p.$('.cs-consent input'))||(await q(p,'.cs-consent input')).dis,'圖片失敗時不能勾同意');
  ok(await p.evaluate(()=>document.body.innerText.includes('重新載入圖片')),'圖片失敗顯示重新載入');
  ok((await q(p,'.cs-primary')).dis,'圖片失敗時不能分享');
  await p.evaluate(()=>{T.imgKind='slow'});await click(p,'重新載入圖片');await tick(400);
  ok((await q(p,'.cs-consent input')).dis,'圖片還沒顯示前不能勾同意');
  await tick(1800);ok(!(await q(p,'.cs-consent input')).dis,'圖片顯示後可以勾同意');
  const muts=await p.evaluate(()=>new Promise(r=>{let n=0;const o=new MutationObserver(()=>n++);o.observe(document.getElementById('cardShareM'),{childList:true,subtree:true});setTimeout(()=>{o.disconnect();r(n)},800)}));
  ok(muts===0,'圖片載入後沒有重畫循環（'+muts+' 次變動）');
  // 同意 → 發布中欄位停用 → 逾時 → 再試一次沿用 requestId
  await p.evaluate(()=>{const c=document.querySelector('.cs-consent input');c.click();});await tick(50);
  ok(!(await q(p,'.cs-primary')).dis,'勾同意後可以確認分享');
  await click(p,'確認分享');await tick(50);ok((await field(p,'標籤')).dis,'發布進行中欄位停用');
  await p.evaluate(()=>T.finishPublish.rej(Object.assign(new Error('t'),{name:'TimeoutError'})));await tick(100);
  await click(p,'再試一次');await tick(50);const ids=await p.evaluate(()=>T.calls.publish);
  ok(ids.length===2&&ids[0]===ids[1],'重試沿用同一個 requestId');
  // 發布中換帳號：舊回應不套用
  await p.evaluate(()=>switchUser({uid:'discord_88888888888888888',getIdToken:async()=>'t3'}));await tick(100);
  await p.evaluate(()=>T.finishPublish.res({publicationId:'pubX',status:'published',messageUrl:'https://discord.com/channels/1/2/9'}));await tick(200);
  ok(!(await p.evaluate(()=>document.body.innerText.includes('你的闆卡已經分享到 Discord'))),'換帳號後舊發布回應不套用到新帳號');
  await p.close();}
 // 4. 晚到的舊輪詢不能蓋掉較新的 current（v419）
 for(const mode of ['null','newer','reopen']){const p=await setup();await p.clock.install();
  await p.evaluate(()=>{T.pub={status:'processing',publicationId:'pub1'};T.olds=[];mock.status=()=>{T.calls.status++;return new Promise(r=>T.olds.push(r))};});
  await p.evaluate(()=>TTCardShare.open());await p.clock.runFor(2900);
  const c0=await p.evaluate(()=>T.calls.status);await p.clock.runFor(300);const c1=await p.evaluate(()=>T.calls.status);
  if(mode==='null')ok(c0===0&&c1===1,'輪詢間隔 3 秒（2.9 秒 '+c0+' 次、3.2 秒 '+c1+' 次）');
  await p.evaluate(m=>{T.pub=m==='newer'?{status:'published',publicationId:'pub2',publishedAt:Date.now(),messageUrl:'https://discord.com/channels/1/2/8'}:null},mode);
  if(mode==='reopen'){await click(p,'×');await p.evaluate(()=>TTCardShare.open());}else await click(p,'重新讀取');
  await p.clock.runFor(20);
  const want=mode==='newer'?'published':'fields';
  const now=async()=>p.evaluate(()=>document.body.innerText.includes('你的闆卡已經分享到 Discord')?'published':document.querySelector('.cs-field')?'fields':'other');
  ok(await now()===want,'['+mode+'] 新的 current 先顯示正確（'+want+'）');
  await p.evaluate(m=>T.olds[0](m==='newer'?{publicationId:'pub1',status:'processing'}:{publicationId:'pub1',status:'published',publishedAt:Date.now()}),mode);
  await p.clock.runFor(20);ok(await now()===want,'['+mode+'] 晚到的舊 status 回應不讓畫面倒退');
  if(mode==='newer')ok(await p.evaluate(()=>!document.body.innerText.includes('發布中')&&(document.querySelector('.cs-link')||{}).href==='https://discord.com/channels/1/2/8'),'[newer] 仍顯示較新的那則分享連結');
  await p.clock.runFor(3100*6);ok(await p.evaluate(()=>T.calls.status)===c1,'['+mode+'] 舊回應沒有再啟動新的輪詢（status 共 '+(await p.evaluate(()=>T.calls.status))+' 次）');
  await p.close();}
 // 5. 重新讀取後仍是 processing：只剩一條新輪詢，仍是每 3 秒、最多 5 次
 {const p=await setup();await p.clock.install();
  await p.evaluate(()=>{T.pub={status:'processing',publicationId:'pub1'};T.olds=[];mock.status=()=>{T.calls.status++;return new Promise(r=>T.olds.push(r))};});
  await p.evaluate(()=>TTCardShare.open());await p.clock.runFor(3100);
  await click(p,'重新讀取');await p.clock.runFor(20);
  await p.evaluate(()=>{T.olds[0]({publicationId:'pub1',status:'processing'});mock.status=async()=>{T.calls.status++;return {publicationId:'pub1',status:'processing'}};});
  await p.clock.runFor(20);const base=await p.evaluate(()=>T.calls.status);
  await p.clock.runFor(3100*7);const n=await p.evaluate(()=>T.calls.status)-base;
  ok(n===5,'重新讀取後只有一條輪詢，最多 5 次（實際 '+n+' 次）');
  ok(await p.evaluate(()=>document.body.innerText.includes('重新讀取')),'輪詢到上限後仍可重新讀取');
  await p.close();}
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exitCode=fails?1:0;})();
