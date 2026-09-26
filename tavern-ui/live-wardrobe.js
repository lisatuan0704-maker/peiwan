/* 時裝間正式資料介面；商品價格、持有狀態與穿戴都由主站驗證。 */
(() => {
 'use strict';
 const api=parent.parent.TinyTavernUI;if(!api)return;
 const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories=[['hair','頭髮'],['cloth','衣服'],['acc','配件'],['eye','臉'],['pet','寵物'],['seat','座椅']];
 const groupNames={head:'頭飾',ear:'耳環',face:'面部配件',hand:'手持物',back:'背飾／尾巴'};
 let data,selection={},color={},area='store',category='hair',mode='singles',filter='all',page=0,selected=null,saving=false;
 let dyeDraft=null,bagSection='wear',dyeSaving=false,dyeRequest=null;
 const bagNav=document.createElement('nav');bagNav.className='archive-nav';bagNav.setAttribute('aria-label','背包收納');
 bagNav.innerHTML='<button data-archive="wear" aria-pressed="true"><small>01 / DRESSING</small><b>我的穿搭</b><span>時裝與染色組合</span></button><button data-archive="collection" aria-pressed="false"><small>02 / KEEPSAKES</small><b>紀念收藏</b><span>小物與成就紀錄</span></button>';
 document.querySelector('.workspace').before(bagNav);
 const keepsakes=document.createElement('section');keepsakes.id='keepsakes';keepsakes.hidden=true;document.querySelector('.workspace').append(keepsakes);
 bagNav.querySelectorAll('button').forEach(b=>b.onclick=()=>{bagSection=b.dataset.archive;render();});
 function renderCollection(){
  const records=api.collection?.()||[];
  keepsakes.innerHTML='<div class="keepsake-intro"><small>KEEPSAKES & MEMORIES</small><h2>一起度過的日子，有跡可循。</h2><p>紀念小物、解鎖的成就，收進專屬於你的收藏冊。</p></div><div class="memory-grid">'+records.map((r,i)=>'<article class="memory-card"><span class="memory-no">'+String(i+1).padStart(2,'0')+'</span><img src="'+esc(r.image)+'" alt=""><small>'+esc(r.kind)+'</small><h3>'+esc(r.name)+'</h3><p>'+esc(r.description)+'</p><footer>取得來源 · '+esc(r.source)+'</footer><span class="memory-word" aria-hidden="true">MEMORY</span></article>').join('')+'</div><div class="souvenir-empty"><span aria-hidden="true">◇</span><div><h3>替下一份紀念，留一個位置。</h3><p>目前還沒有已發放的紀念小物。'+(!records.length?'解鎖的成就紀錄也會收在這裡。':'')+'</p></div></div>';
 }

 const ref=p=>p.base!==undefined?{base:p.base,slot:p.slot}:{source:p.source,slot:p.slot};
 const key=p=>p.category==='acc'?'accessory:'+p.group:p.slot;
 function isTrying(p){
  if(p.parts)return p.parts.every(isTrying);
  const r=selection[key(p)];
  if(r?.base===0&&p.source==='cloth0'&&['back','front','eye','cloth'].includes(p.slot)&&r.slot===p.slot)return true;
  return !!r&&r.slot===p.slot&&(p.base!==undefined?r.base===p.base:r.source===p.source);
 }
 function tell(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(tell.timer);tell.timer=setTimeout(()=>$('#toast').hidden=true,3500);}
 function init(){
  dyeDraft=null;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;
  data=api.state();selection={};const d=data.doll;
  for(const [sl,native] of [['front','front'],['back','back'],['cloth','cloth'],['eye','face'],['brow','brow']]){
   const source=d.ps?.[sl]||d.set;
   selection[sl]=source&&data.catalog.some(o=>o.id===source&&o.parts.some(p=>p.slot===sl))?{source,slot:sl}:{base:d[native]||0,slot:sl};
  }
  const accessories=d.uiAccessories||data.catalog.find(o=>o.id===d.set)?.parts.filter(p=>p.category==='acc')||Object.entries(d.ps||{}).filter(([k])=>/^acc\d*$/.test(k)).map(([slot,source])=>({source,slot}));
  accessories.forEach(r=>{const p=data.catalog.find(o=>o.id===r.source)?.parts.find(p=>p.slot===r.slot);if(p)selection[key(p)]=ref(p);});
  color=d.dyedHairSet&&data.dyed[d.dyedHairSet]?{savedId:d.dyedHairSet}:{hair:d.hair||0,keepOriginal:true};selected=null;page=0;
 }
 function products(){return data.catalog.filter(o=>area==='bag'?o.owned:o.sale);}
 function entries(){
  const out=[];
  for(const o of products()){
   const parts=o.parts.filter(p=>p.category===category);
   if(category==='hair'&&area==='store'){
    if(parts.length)out.push({id:o.id+'::hair',name:o.name+'・髮型',category:'hair',parts,product:o});
   }else for(const p of parts)if(category!=='acc'||filter==='all'||filter===p.group)out.push({...p,product:o});
  }
  if(area==='bag')for(const [native,v] of Object.entries(data.baseParts)){
   const sl=({face:'eye'}[native]||native),cat=({front:'hair',back:'hair',cloth:'cloth',eye:'eye'}[sl]);if(cat!==category)continue;
   for(const p of v.items||[]){
    // 露亞原有髮型、眼睛、衣服與露亞組合重複，保留組合中的命名；舊穿搭編號仍相容。
    if(p.idx===0&&['back','front','eye','cloth'].includes(sl)&&out.some(q=>q.source==='cloth0'&&q.slot===sl))continue;
    out.push({id:'base::'+sl+'::'+p.idx,slot:sl,base:p.idx,name:p.n,category:cat,product:{owned:true,name:'原有部件'}});
   }
  }
  return out;
 }
 function tryItem(p){
  if(!p)return;
  if(p.parts)p.parts.forEach(q=>selection[key(q)]=ref(q));else selection[key(p)]=ref(p);
  if(p.category==='hair'){color={hair:data.doll.hair||0};dyeDraft=null;}
  selected=p.id;render();
 }
 function drawPart(cv,p){
  if(p.parts){const c=cv.getContext('2d');c.clearRect(0,0,64,64);for(const slot of ['back','front']){const q=p.parts.find(x=>x.slot===slot);if(!q)continue;const tmp=document.createElement('canvas');tmp.width=tmp.height=64;api.drawPart(tmp,ref(q),color);c.drawImage(tmp,0,0);}}
  else api.drawPart(cv,ref(p),color);
 }
 function paint(){
  try{const d=api.makeDoll(selection,color);if(dyeDraft){d.hairHex=dyeDraft.main;d.hairHex2=dyeDraft.tail;}api.draw($('#avatar'),d);if(dyeDraft)api.draw($('#dyePreview'),d);}catch(e){tell(e.message);}
  const list=entries();$$('[data-preview]').forEach(cv=>{const p=list.find(p=>p.id===cv.dataset.preview);if(p)drawPart(cv,p);});
  $$('[data-outfit-preview]').forEach(cv=>{const o=data.catalog.find(o=>o.id===cv.dataset.outfitPreview);if(o)api.draw(cv,{...data.doll,...o.doll,set:o.id,ps:{},uiAccessories:undefined});});
  $$('[data-dyed-preview]').forEach(cv=>{const s=data.dyed[cv.dataset.dyedPreview];if(s)api.draw(cv,api.makeDoll({...selection,front:s.front,back:s.back},{savedId:cv.dataset.dyedPreview}));});
 }
 function setArea(next){area=next==='bag'?'bag':'store';bagSection='wear';category='hair';page=0;selected=null;filter='all';mode='singles';render();}
 function swatches(){
  const preset=[0,2,3,4,5,6,7,1,9].filter(i=>data.colors[i]);
  $('#dyePanel').innerHTML='<div class="dye-head"><strong>主色</strong><span>'+(color.savedId?'已保存髮色':'即時試色')+'</span></div><div class="swatches">'+preset.map(i=>'<button data-color="'+i+'" aria-label="試穿髮色 '+(i+1)+'" style="--swatch:'+data.colors[i]+'" aria-pressed="'+(color.hair===i)+'" '+(color.savedId?'disabled':'')+'></button>').join('')+'</div>';
  $$('[data-color]').forEach(b=>b.onclick=()=>{color={hair:Number(b.dataset.color)};swatches();paint();});
 }
 function render(){
  document.body.dataset.area=area;document.body.dataset.section=bagSection;
  bagNav.hidden=area!=='bag';bagNav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.archive===bagSection)));
  const collecting=area==='bag'&&bagSection==='collection';
  keepsakes.hidden=!collecting;$('#inventory').hidden=true;$('#catalog').hidden=collecting;document.querySelector('.preview').hidden=collecting;
  document.querySelector('.collection-mark span').textContent=area==='bag'?'只屬於你的收藏':'挑一件，換個心情。';
  document.querySelector('.collection-mark strong').textContent=area==='bag'?'OWNED & LOVED':'TRY SOMETHING NEW';
  document.querySelector('.paneltitle strong').textContent=area==='bag'?'今天的我':'試穿看看';
  document.querySelector('.stage-label').textContent=area==='bag'?'MY OUTFIT':'FITTING ROOM';
  $('#showWear').hidden=area!=='bag';$('#dyeTicket').hidden=area!=='bag';
  $('#dyeTicket strong').textContent='染髮 · 剩餘 '+data.tickets+' 張';
  if(collecting){renderCollection();return;}
  // 商城與背包由各自的大廳入口開啟，不交叉切換。
  $('#catalog .catalog-head h2').textContent=area==='store'?'本日選物':'我的衣櫥';
  $('#singlesMode').textContent='單品';$('#bundlesMode').textContent=area==='bag'?'染色組合':'當季組合';
  $('#singlesMode').setAttribute('aria-pressed',String(mode==='singles'));$('#bundlesMode').setAttribute('aria-pressed',String(mode==='bundles'));
  $('#singles').hidden=mode!=='singles';$('#bundles').hidden=mode!=='bundles';
  $('#categories').innerHTML=categories.map(([id,name])=>'<button data-category="'+id+'" aria-pressed="'+(id===category)+'"><span>'+name+'</span></button>').join('');
  $$('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;page=0;selected=null;render();});
  $('#singles').classList.toggle('has-accessory-filter',category==='acc');
  $('#subtabs').innerHTML=category==='acc'?'<nav class="accessory-filter" aria-label="配件部位">'+[['all','全部'],...Object.entries(groupNames)].map(([id,n])=>'<button data-group="'+id+'" aria-pressed="'+(id===filter)+'">'+n+'</button>').join('')+'</nav>':category==='hair'?(area==='bag'?'瀏海與後髮可分別搭配':'完整髮型 · 整組試穿'):'點圖片，即時試穿';
  $$('[data-group]').forEach(b=>b.onclick=()=>{filter=b.dataset.group;page=0;selected=null;render();});
  const list=entries(),per=innerWidth<601?2:6,pages=Math.max(1,Math.ceil(list.length/per));page=Math.min(page,pages-1);
  if(!list.some(p=>p.id===selected))selected=list.slice(page*per,(page+1)*per).find(isTrying)?.id||null;
  $('#grid').innerHTML=list.slice(page*per,(page+1)*per).map((p,i)=>'<button class="item" data-item="'+esc(p.id)+'" aria-label="試穿'+esc(p.name)+'" aria-pressed="'+isTrying(p)+'"><span class="itemtop"><span class="item-number">'+String(page*per+i+1).padStart(2,'0')+'</span><span class="status">'+(p.product.owned?'已擁有':'')+'</span></span><span class="thumb"><canvas width="64" height="64" data-preview="'+esc(p.id)+'"></canvas></span><span class="item-caption"><strong>'+esc(p.name)+'</strong><small>'+esc(area==='bag'?'已收藏 · 可搭配':p.product.owned?'已收藏':'整組 NT$'+p.product.price)+'</small></span></button>').join('')||'<p class="live-empty">'+(area==='bag'?'這個分類還沒有已取得的部件。':'目前沒有上架商品。')+'</p>';
  $$('[data-item]').forEach(b=>b.onclick=()=>tryItem(list.find(p=>p.id===b.dataset.item)));
  $('#pager').innerHTML='<button id="prevPage" '+(!page?'disabled':'')+'>←</button><span>'+String(page+1).padStart(2,'0')+' / '+String(pages).padStart(2,'0')+'</span><button id="nextPage" '+(page+1>=pages?'disabled':'')+'>→</button><small>'+list.length+' 款</small>';
  $('#prevPage').onclick=()=>{page--;selected=null;render();};$('#nextPage').onclick=()=>{page++;selected=null;render();};
  const p=list.find(p=>p.id===selected);
  $('#detail').innerHTML=p?'<div><small class="overline">'+(p.category==='acc'?'ACCESSORY / '+groupNames[p.group]:'YOUR STYLE')+'</small><h2>'+esc(p.name)+'</h2><p>'+esc(p.product.owned?'已取得，可自由搭配。':'包含於「'+p.product.name+'」，購買整組後可拆件搭配。')+'</p></div><div class="actions">'+(p.category==='acc'?'<button class="ghost" id="removePart">卸下</button>':'')+'<button class="primary" id="itemAction">'+(area==='bag'?'穿上目前搭配 →':p.product.owned?'已擁有':'選購整組 →')+'</button></div>':'<p>挑選另一個分類，繼續找喜歡的造型。</p>';
  if(p){$('#itemAction').disabled=area==='store'&&p.product.owned;$('#itemAction').onclick=()=>area==='bag'?wear():!p.product.owned&&buy(p.product.id);if($('#removePart'))$('#removePart').onclick=()=>{selection[key(p)]=null;render();};}
  if(mode==='bundles')renderBundles();
  swatches();paint();clearTimeout(render.imageTimer);render.imageTimer=setTimeout(paint,450);
 }
 function renderBundles(){
  $('#bundlePager').innerHTML='';
  if(area==='bag'){
   const saved=Object.entries(data.dyed);
   $('#bundlegrid').innerHTML=saved.map(([id,s])=>'<article class="bundle"><div class="bundlebody"><small>COLOR ARCHIVE</small><h2>'+esc(s.name||'專屬染髮')+'</h2><canvas class="dyed-preview" width="64" height="64" data-dyed-preview="'+esc(id)+'"></canvas><p>已固定瀏海、後髮與髮色。再次穿戴不扣券。</p><button class="primary" data-saved="'+esc(id)+'">試穿這組</button></div></article>').join('')||'<div class="live-empty"><p>還沒有保存染色組合。</p><button class="primary" id="emptyDye">開始染髮</button><p>先選好瀏海與後髮，再調整專屬髮色。</p></div>';
   if($('#emptyDye'))$('#emptyDye').onclick=openDye;
   $$('[data-saved]').forEach(b=>b.onclick=()=>{const s=data.dyed[b.dataset.saved];selection.front=s.front;selection.back=s.back;color={savedId:b.dataset.saved};swatches();paint();$('#detail').innerHTML='<p>已試穿完整染色組合。</p><button class="primary" id="wearSaved">穿上這組</button>';$('#wearSaved').onclick=wear;});
   $('#detail').innerHTML='<p>染色組合保存後可重複整組穿戴。</p>';
  }else{
   $('#bundlegrid').innerHTML=products().map(o=>'<article class="bundle"><div class="hero"><span class="ribbon">'+(o.owned?'已擁有':'整組 NT$'+o.price)+'</span><h2>'+esc(o.name)+'</h2><canvas width="64" height="64" data-outfit-preview="'+esc(o.id)+'"></canvas></div><div class="bundlebody"><p>'+o.parts.length+' 件可搭配部件</p><div class="bundlebtns"><button class="primary" data-try-outfit="'+esc(o.id)+'">試穿這組</button><button class="ghost" data-buy-outfit="'+esc(o.id)+'">'+(o.owned?'已擁有':'選購整組')+'</button></div></div></article>').join('')||'<p class="live-empty">目前沒有上架組合。</p>';
   $$('[data-try-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.tryOutfit);selection={};o.parts.forEach(p=>selection[key(p)]=ref(p));color={hair:data.doll.hair||0};paint();tell('已試穿「'+o.name+'」');});
   $$('[data-buy-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.buyOutfit);if(!o.owned)buy(o.id);});
   $('#detail').innerHTML='<p>整組購買後，部件會收進個人背包。</p>';
  }
 }
 function buy(id){try{api.buy(id);}catch(e){tell(e.message);}}
 async function wear(){if(saving)return;saving=true;try{await api.wear(selection,color);data=api.state();tell('穿搭已保存，回到大廳也會穿著這一套。');}catch(e){tell(e.message);}finally{saving=false;}}
 document.querySelector('.mode').remove();
 $('#singlesMode').onclick=()=>{mode='singles';render();};$('#bundlesMode').onclick=()=>{mode='bundles';render();};
 $('#reset').onclick=()=>{init();render();tell('已還原目前穿搭');};
 $('#showWear').textContent='穿上搭配';$('#showWear').onclick=wear;
 $('#dyeTicket strong').textContent='混搭後染髮';$('#dyeTicket small').textContent='先選瀏海與後髮，再調整髮色';
 $('#dyeTicket svg').innerHTML='<path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/><path d="M9 16a3 3 0 0 0 3 3"/>';
 $('#dyeTicket small').textContent='調整主色與漸層，保存才扣 1 張';
 $('#dyeDialog .dialog-card').innerHTML='<div class="dialog-head"><span class="eyebrow">YOUR HAIR COLOR</span><button id="closeDye" aria-label="關閉染髮">×</button></div><h2 id="dyeTitle">染一款，只屬於你的髮色。</h2><p>使用目前試穿的瀏海與後髮。預覽免費，保存組合才扣 1 張券。</p><div class="dye-workspace"><div class="dye-avatar"><canvas id="dyePreview" width="64" height="64" aria-label="染髮即時預覽"></canvas><span>即時預覽</span></div><div class="dye-controls"><label>組合名稱<input id="dyeName" maxlength="24" placeholder="專屬染髮"></label><label>主色<input id="dyeMain" type="color" aria-label="染髮主色"></label><label class="dye-gradient"><input id="dyeGradient" type="checkbox">加入髮尾漸層</label><label id="dyeTailLabel">髮尾色<input id="dyeTail" type="color" aria-label="染髮髮尾色"></label></div></div><div class="ticket-state" role="status"></div><p id="dyeError" role="alert" hidden></p><div class="dye-actions"><button id="cancelDye" class="ghost">取消</button><button id="saveDye" class="primary">使用 1 張並保存</button></div><p class="dye-note">保存後可在「染色組合」重複穿戴，不再扣券。</p>';
 function closeDye(){if(dyeSaving)return;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;dyeDraft=null;paint();$('#dyeTicket').focus();}
 function dyeStatus(){
  $('#dyeDialog .ticket-state').textContent='持有 '+data.tickets+' 張染髮券'+(data.tickets<1?' · 券不足，仍可免費預覽':' · 保存使用 1 張');
  $('#saveDye').disabled=dyeSaving||data.tickets<1;$('#saveDye').textContent=dyeSaving?'保存中…':'使用 1 張並保存';
  $$('#dyeDialog input, #closeDye, #cancelDye').forEach(el=>el.disabled=dyeSaving);
  $('#dyeTail').disabled=dyeSaving||!$('#dyeGradient').checked;
 }
 function updateDye(){
  dyeDraft={name:$('#dyeName').value,main:$('#dyeMain').value,tail:$('#dyeGradient').checked?$('#dyeTail').value:$('#dyeMain').value};
  $('#dyeTailLabel').hidden=!$('#dyeGradient').checked;dyeStatus();paint();
 }
 function openDye(){
  try{
   data=api.state();if(!data.loggedIn)throw Error('先登入自己的闆卡，再使用染髮');
   const d=api.makeDoll(selection,color,true);
   $('#dyeName').value='';$('#dyeMain').value=d.hairHex||data.colors[d.hair||0];$('#dyeTail').value=d.hairHex2||'#f3b8d8';
   $('#dyeGradient').checked=!!d.hairHex2&&d.hairHex2!==d.hairHex;$('#dyeError').hidden=true;
   $('#dyeDialog').hidden=false;document.querySelector('.shop').inert=true;dyeRequest=null;updateDye();$('#closeDye').focus();
  }catch(e){tell(e.message);}
 }
 async function saveDye(){
  if(dyeSaving||!dyeDraft)return;
  const signature=JSON.stringify([selection.front,selection.back,dyeDraft]);
  if(!dyeRequest||dyeRequest.signature!==signature)dyeRequest={signature,id:'dye_'+crypto.randomUUID()};
  dyeSaving=true;dyeStatus();$('#dyeError').hidden=true;
  try{
   const result=await api.saveDye(selection,dyeDraft,dyeRequest.id);
   data=api.state();color={savedId:result.id};dyeDraft=null;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;mode='bundles';render();
   tell('染色組合已保存！按「穿上搭配」即可在大廳使用。');$('#showWear').focus();
  }catch(e){$('#dyeError').textContent=e.message||'保存未完成，請重試';$('#dyeError').hidden=false;data=api.state();}
  finally{dyeSaving=false;dyeStatus();}
 }
 $('#closeDye').onclick=closeDye;$('#cancelDye').onclick=closeDye;$('#saveDye').onclick=saveDye;
 $$('#dyeDialog input').forEach(el=>el.oninput=updateDye);$('#dyeTicket').onclick=openDye;
 document.querySelector('.paneltitle strong').textContent='我的試衣舞臺';document.querySelector('.collection-mark span').textContent='星光換裝間';document.querySelector('.collection-mark strong').textContent='DRESS UP & PLAY';
 window.ttDressArea=next=>{init();setArea(next);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!$('#dyeDialog').hidden)closeDye();else api.close();}});
 window.addEventListener('resize',()=>render());
 init();render();[200,600,1400,3000].forEach(t=>setTimeout(paint,t));
 setInterval(()=>{if(api.isActive()){const next=api.state();if(next.tickets!==data.tickets||JSON.stringify(next.catalog)!==JSON.stringify(data.catalog)||JSON.stringify(next.dyed)!==JSON.stringify(data.dyed)){data=next;render();if(!$('#dyeDialog').hidden)dyeStatus();}}},2000);
})();
