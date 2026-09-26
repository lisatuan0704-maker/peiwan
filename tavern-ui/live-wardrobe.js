/* 時裝間正式資料介面；商品價格、持有狀態與穿戴都由主站驗證。 */
(() => {
 'use strict';
 const api=parent.parent.TinyTavernUI;if(!api)return;
 const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories=[['hair','頭髮'],['cloth','衣服'],['acc','配件'],['eye','臉'],['pet','寵物'],['seat','座椅']];
 const groupNames={head:'頭飾',ear:'耳環',face:'面部配件',hand:'手持物',back:'背飾／尾巴'};
 let data,selection={},color={},area='store',category='hair',mode='singles',filter='all',page=0,selected=null,saving=false;
 let dyeDraft=null,bagSection='wear';
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
  return !!r&&r.slot===p.slot&&(p.base!==undefined?r.base===p.base:r.source===p.source);
 }
 function tell(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(tell.timer);tell.timer=setTimeout(()=>$('#toast').hidden=true,3500);}
 function init(){
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
   for(const p of v.items||[])out.push({id:'base::'+sl+'::'+p.idx,slot:sl,base:p.idx,name:p.n,category:cat,product:{owned:true,name:'原有部件'}});
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
  try{const d=api.makeDoll(selection,color);if(dyeDraft){d.hairHex=dyeDraft.main;d.hairHex2=dyeDraft.tail;}api.draw($('#avatar'),d);}catch(e){tell(e.message);}
  const list=entries();$$('[data-preview]').forEach(cv=>{const p=list.find(p=>p.id===cv.dataset.preview);if(p)drawPart(cv,p);});
  $$('[data-outfit-preview]').forEach(cv=>{const o=data.catalog.find(o=>o.id===cv.dataset.outfitPreview);if(o)api.draw(cv,{...data.doll,...o.doll,set:o.id,ps:{},uiAccessories:undefined});});
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
   $('#bundlegrid').innerHTML=saved.map(([id,s])=>'<article class="bundle"><div class="bundlebody"><small>COLOR ARCHIVE</small><h2>'+esc(s.name||'專屬染髮')+'</h2><div class="saved-hair-colors" style="background:linear-gradient('+esc(s.main)+','+esc(s.tail)+')"></div><p>已固定搭配與髮色，整組穿戴。</p><button class="primary" data-saved="'+esc(id)+'">試穿這組</button></div></article>').join('')||'<p class="live-empty">尚未保存染色組合。</p>';
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
 function closeDye(){ $('#dyeDialog').hidden=true;$('#dyeTicket').focus(); }
 $('#dyeDialog h2').textContent='混搭染髮，準備中。';
 $('#dyeDialog>div>p').textContent='先在個人背包選好瀏海與後髮；染髮券功能開放後，就能把這組搭配染成專屬髮色。';
 $('#dyeDialog .ticket-state').textContent='功能尚未開放，目前不扣券、不保存染色。';
 $('#dyeDialog .ticket-art').setAttribute('aria-hidden','true');
 $('#getTicket').textContent='回到試衣間';$('#getTicket').onclick=closeDye;
 $('#closeDye').onclick=closeDye;
 $('#toDyedBag').hidden=true;
 $('#dyeTicket').onclick=()=>{if(api.beginDye){api.beginDye(selection,color,{open:(draft)=>{dyeDraft=draft;}});}else{$('#dyeDialog').hidden=false;$('#closeDye').focus();}};
 document.querySelector('.paneltitle strong').textContent='我的試衣舞臺';document.querySelector('.collection-mark span').textContent='星光換裝間';document.querySelector('.collection-mark strong').textContent='DRESS UP & PLAY';
 window.ttDressArea=next=>{init();setArea(next);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!$('#dyeDialog').hidden)closeDye();else api.close();}});
 window.addEventListener('resize',()=>render());
 init();render();[200,600,1400,3000].forEach(t=>setTimeout(paint,t));
 setInterval(()=>{if(api.isActive()){const next=api.state();if(JSON.stringify(next.catalog)!==JSON.stringify(data.catalog)||JSON.stringify(next.dyed)!==JSON.stringify(data.dyed)){data=next;render();}}},2000);
})();
