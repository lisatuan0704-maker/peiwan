/* 時裝間正式資料介面；商品價格、持有狀態與穿戴都由主站驗證。 */
(() => {
 'use strict';
 const api=parent.parent.TinyTavernUI;if(!api)return;
 const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories=[['hair','頭髮'],['cloth','衣服'],['acc','配件'],['eye','臉'],['pet','寵物'],['seat','座椅']];
 const groupNames={head:'頭飾',ear:'耳環',face:'面部配件',hand:'手持物',back:'背飾／尾巴'};
 let data,selection={},color={},area='store',category='bundles',mode='singles',filter='all',page=0,selected=null,saving=false;
 let hairSection='original';
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
 const key=p=>p.category==='acc'?(api.accessoryKey?.(p)||'accessory:'+p.group):p.slot;
 function isTrying(p){
  if(p.parts)return p.parts.every(isTrying);
  const r=selection[key(p)];
  if(r?.base===0&&p.source==='cloth0'&&['back','front','eye','cloth'].includes(p.slot)&&r.slot===p.slot)return true;
  return !!r&&r.slot===p.slot&&(p.base!==undefined?r.base===p.base:r.source===p.source);
 }
 function tell(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(tell.timer);tell.timer=setTimeout(()=>$('#toast').hidden=true,3500);}
 function selectionFromDoll(d){
  const next={};
  for(const [sl,native] of [['front','front'],['back','back'],['cloth','cloth'],['eye','face'],['brow','brow'],['pet','pet'],['seat','seat']]){
   const source=d.uiBaseSlots?.includes(sl)?null:(d.ps?.[sl]||d.set);
   const custom=source&&data.catalog.some(o=>o.id===source&&o.parts.some(p=>p.slot===sl));
   next[sl]=custom?{source,slot:sl}:['pet','seat'].includes(sl)?null:{base:d[native]||0,slot:sl};
  }
  const accessories=d.uiAccessories||data.catalog.find(o=>o.id===d.set)?.parts.filter(p=>p.category==='acc')||Object.entries(d.ps||{}).filter(([k])=>/^acc\d*$/.test(k)).map(([slot,source])=>({source,slot}));
  (api.expandAccessories?.(accessories,d)||accessories).forEach(r=>{const p=data.catalog.find(o=>o.id===r.source)?.parts.find(p=>p.slot===r.slot);if(p)next[key(p)]=ref(p);});
  return api.normalizeSelection?.(next)||next;
 }
 function init(){
  dyeDraft=null;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;
  data=api.state();const d=data.doll;selection=selectionFromDoll(d);
  const saved=d.dyedHairSet&&data.dyed[d.dyedHairSet];
  if(saved){selection.front={...saved.front};selection.back={...saved.back};}
  color=saved?{savedId:d.dyedHairSet}:{hair:d.hair||0,keepOriginal:true};selected=null;page=0;
 }
 function outfitSelection(o){const next=selectionFromDoll(o.doll||{});o.parts.forEach(p=>next[key(p)]=ref(p));return next;}
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
  let next={...selection};const nextColor=p.category==='hair'?{hair:data.doll.hair||0}:color;
  const removing=['acc','pet','seat'].includes(p.category)&&isTrying(p);
  if(removing)next[key(p)]=null;
  else if(p.parts)p.parts.forEach(q=>next[key(q)]=ref(q));else next[key(p)]=ref(p);
  const normalized=p.category==='hair'?(api.normalizeSelection?.(next)||next):next;
  const removedDependency=Object.keys(next).some(k=>next[k]&&normalized[k]===null);next=normalized;
  try{api.makeDoll(next,nextColor);}catch(e){tell(e.message);return;}
  selection=next;color=nextColor;if(p.category==='hair')dyeDraft=null;
  selected=p.id;render();
  if(removing)tell('已卸下「'+p.name+'」；完成後按「穿上搭配」保存。');
  else if(removedDependency)tell('已更換髮型，並卸下不適用的紅寶石髮飾。');
 }
 function drawPart(cv,p){
  if(p.parts){const c=cv.getContext('2d');c.clearRect(0,0,64,64);for(const slot of ['back','front']){const q=p.parts.find(x=>x.slot===slot);if(!q)continue;const tmp=document.createElement('canvas');tmp.width=tmp.height=64;api.drawPart(tmp,ref(q),color);c.drawImage(tmp,0,0);}}
  else api.drawPart(cv,ref(p),color);
 }
 let paintFrame=0;
 function requestPaint(){if(paintFrame)return;paintFrame=requestAnimationFrame(()=>{paintFrame=0;paint();});}
 function paint(){
  const dyeVisible=!!dyeDraft&&!$('#dyeDialog').hidden;
  try{const d=api.makeDoll(selection,color);if(dyeVisible){d.hairHex=dyeDraft.main;d.hairHex2=dyeDraft.tail;}api.draw($(dyeVisible?'#dyePreview':'#avatar'),d);}catch(e){tell(e.message);}
  // 染髮彈窗遮住的商品與主舞臺不跟著每一次色票事件重畫。
  if(dyeVisible)return;
  const list=entries();$$('#singles:not([hidden]) [data-preview]').forEach(cv=>{const p=list.find(p=>p.id===cv.dataset.preview);if(p)drawPart(cv,p);});
  $$('#bundles:not([hidden]) [data-outfit-preview]').forEach(cv=>{const o=data.catalog.find(o=>o.id===cv.dataset.outfitPreview);if(o)api.draw(cv,api.makeDoll(outfitSelection(o),{hair:o.doll?.hair||0}));});
  $$('#bundles:not([hidden]) [data-dyed-preview]').forEach(cv=>{const s=data.dyed[cv.dataset.dyedPreview];if(s)api.draw(cv,api.makeDoll(api.normalizeSelection({...selection,front:s.front,back:s.back}),{savedId:cv.dataset.dyedPreview}));});
 }
 function setArea(next){area=next==='bag'?'bag':'store';bagSection='wear';category=area==='store'?'bundles':'hair';hairSection='original';page=0;selected=null;filter='all';mode='singles';render();}
 window.ttDyeShop=()=>{if(area!=='store'){init();setArea('store');syncOuter('store');}category='dye';render();};
 function swatches(){
  const preset=[0,2,3,4,5,6,7,1,9].filter(i=>data.colors[i]);
  $('#dyePanel').innerHTML='<div class="dye-head"><strong>主色</strong><span>'+(color.savedId?'已保存髮色':'即時試色')+'</span></div><div class="swatches">'+preset.map(i=>'<button data-color="'+i+'" aria-label="試穿髮色 '+(i+1)+'" style="--swatch:'+data.colors[i]+'" aria-pressed="'+(color.hair===i)+'" '+(color.savedId?'disabled':'')+'></button>').join('')+'</div>';
  $$('[data-color]').forEach(b=>b.onclick=()=>{color={hair:Number(b.dataset.color)};swatches();requestPaint();});
 }
 function render(){
  document.body.dataset.shopCategory=category;document.body.dataset.area=area;document.body.dataset.section=bagSection;
  bagNav.hidden=area!=='bag';bagNav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.archive===bagSection)));
  const collecting=area==='bag'&&bagSection==='collection';
  keepsakes.hidden=!collecting;$('#inventory').hidden=true;$('#catalog').hidden=collecting;document.querySelector('.preview').hidden=collecting;
  document.querySelector('.collection-mark span').textContent=area==='bag'?'只屬於你的收藏':'挑一件，換個心情。';
  document.querySelector('.collection-mark strong').textContent=area==='bag'?'OWNED & LOVED':'TRY SOMETHING NEW';
  document.querySelector('.paneltitle strong').textContent=area==='bag'?'今天的我':'試穿看看';
  document.querySelector('.stage-label').textContent=area==='bag'?'MY OUTFIT':'FITTING ROOM';
  $('#showWear').hidden=area!=='bag';$('#dyeTicket').hidden=false;
  if(collecting){renderCollection();return;}
  // 商城與背包由各自的大廳入口開啟，不交叉切換。
  $('#catalog .catalog-head h2').textContent=area==='store'?'本日選物':'我的衣櫥';
  $('#catalog .catalog-head small').textContent=area==='store'?'02 / SHOP COLLECTION':'02 / MY WARDROBE';
  areaNav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area===area)));
  const myHair=area==='bag'&&category==='hair'&&hairSection==='saved';
  mode=category==='bundles'||myHair?'bundles':'singles';
  $('#singles').classList.toggle('showing-my-hair',myHair);$('#singles').classList.toggle('has-hair-sections',area==='bag'&&category==='hair');
  const dyeShop=area==='store'&&category==='dye';
  $('#singles').hidden=dyeShop;$('#singles').classList.toggle('showing-bundles',mode==='bundles');$('#bundles').hidden=mode!=='bundles';$('#dyeShop').hidden=!dyeShop;$('#detail').hidden=dyeShop;
  const cats=[...(area==='store'?[['bundles','當季套組']]:[]),...categories,...(area==='store'?[['dye','染髮券']]:[])];
  $('#categories').innerHTML=cats.map(([id,name])=>'<button data-category="'+id+'" aria-pressed="'+(id===category)+'"'+(id==='dye'?' class="cat-dye"':'')+'><span>'+name+'</span></button>').join('');
  $$('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;page=0;selected=null;render();});
  if(dyeShop){renderDyeShop();dyeCta();swatches();paint();return;}
  $('#singles').classList.toggle('has-accessory-filter',category==='acc');
  $('#subtabs').innerHTML=category==='acc'?'<nav class="accessory-filter" aria-label="配件部位">'+[['all','全部'],...Object.entries(groupNames)].map(([id,n])=>'<button data-group="'+id+'" aria-pressed="'+(id===filter)+'">'+n+'</button>').join('')+'</nav>':category==='hair'?(area==='bag'?'瀏海與後髮可分別搭配':'完整髮型 · 整組試穿'):'點圖片，即時試穿';
  if(area==='bag'&&category==='hair'){
   $('#subtabs').innerHTML='<nav class="hair-sections" aria-label="頭髮分類"><button type="button" data-hair-section="original" aria-pressed="'+(hairSection==='original')+'">原有髮型</button><button type="button" data-hair-section="saved" aria-pressed="'+(hairSection==='saved')+'">我的染髮 <span>'+Object.keys(data.dyed).length+'</span></button></nav><p class="hair-section-hint">'+(myHair?'已保存的專屬髮色，點一下試穿；再次穿戴不扣券。':'瀏海與後髮可分別搭配。')+'</p>';
   $$('[data-hair-section]').forEach(b=>b.onclick=()=>{hairSection=b.dataset.hairSection;page=0;selected=null;render();});
  }
  $$('[data-group]').forEach(b=>b.onclick=()=>{filter=b.dataset.group;page=0;selected=null;render();});
  const list=entries(),per=innerWidth<601?2:6,pages=Math.max(1,Math.ceil(list.length/per));page=Math.min(page,pages-1);
  if(!list.some(p=>p.id===selected))selected=list.slice(page*per,(page+1)*per).find(isTrying)?.id||null;
  $('#grid').innerHTML=list.slice(page*per,(page+1)*per).map((p,i)=>'<button class="item" data-item="'+esc(p.id)+'" aria-label="'+(isTrying(p)&&['acc','pet','seat'].includes(p.category)?'卸下':'試穿')+esc(p.name)+'" aria-pressed="'+isTrying(p)+'"><span class="itemtop"><span class="item-number">'+String(page*per+i+1).padStart(2,'0')+'</span><span class="status">'+(p.product.owned?'已擁有':'')+'</span></span><span class="thumb"><canvas width="64" height="64" data-preview="'+esc(p.id)+'"></canvas></span><span class="item-caption"><strong>'+esc(p.name)+'</strong><small>'+esc(isTrying(p)?(['acc','pet','seat'].includes(p.category)?'已搭配 · 再點卸下':'已搭配'):area==='bag'?'已收藏 · 點選搭配':p.product.owned?'已收藏':'整組 '+p.product.price+' 金幣')+'</small>'+(p.requirement?'<small class="accessory-requirement">'+esc(p.requirement)+'</small>':'')+'</span></button>').join('')||'<p class="live-empty">'+(area==='bag'?'這個分類還沒有已取得的部件。':'目前沒有上架商品。')+'</p>';
  $$('[data-item]').forEach(b=>b.onclick=()=>tryItem(list.find(p=>p.id===b.dataset.item)));
  $('#pager').innerHTML='<button id="prevPage" '+(!page?'disabled':'')+'>←</button><span>'+String(page+1).padStart(2,'0')+' / '+String(pages).padStart(2,'0')+'</span><button id="nextPage" '+(page+1>=pages?'disabled':'')+'>→</button><small>'+list.length+' 款</small>';
  $('#prevPage').onclick=()=>{page--;selected=null;render();};$('#nextPage').onclick=()=>{page++;selected=null;render();};
  const p=list.find(p=>p.id===selected);
  $('#detail').innerHTML=p?'<div><small class="overline">'+(p.category==='acc'?'ACCESSORY / '+groupNames[p.group]:'YOUR STYLE')+'</small><h2>'+esc(p.name)+'</h2><p>'+esc(p.requirement||(p.product.owned?'已取得，可自由搭配。':'包含於「'+p.product.name+'」，購買整組後可拆件搭配。'))+'</p></div><div class="actions">'+(['acc','pet','seat'].includes(p.category)?'<span class="accessory-toggle-hint">點選配件搭配，再點一次卸下</span>':'')+'<button class="primary" id="itemAction">'+(area==='bag'?'穿上目前搭配 →':p.product.owned?'已擁有':'選購整組 →')+'</button></div>':'<p>挑選另一個分類，繼續找喜歡的造型。</p>';
  if(p){$('#itemAction').disabled=area==='store'&&p.product.owned;$('#itemAction').onclick=()=>area==='bag'?wear():!p.product.owned&&buy(p.product.id);}
  if(mode==='bundles')renderBundles();
  dyeCta();swatches();paint();clearTimeout(render.imageTimer);render.imageTimer=setTimeout(paint,450);
 }
 /* v258:試衣間旁的染髮入口改成會動的邀請卡:先免費試色,喜歡再買券 */
 function dyeCta(){
  const t=data.tickets|0,price=api.dyePrice?.()||299;
  $('#dyeTicket').className='dye-ticket dye-cta'+(t?' has':'');
  $('#dyeTicket').innerHTML='<span class="dye-cta-art" aria-hidden="true"><i></i><i></i><i></i></span><span class="dye-cta-text"><strong>'+(t?('染髮券 · 剩餘 '+t+' 張'):'漸層染髮 · 先免費試色')+'</strong><small>'+(t?'保存專屬漸層只扣 1 張':'喜歡再買券，一張 NT$'+price)+'</small></span><b>↗</b>';
 }
 function renderDyeShop(){
  const t=data.tickets|0,price=api.dyePrice?.()||299;
  const demos=[['#f5a3c7','#b7a6f2','蜜桃薰衣草'],['#8fd6c8','#7fb4ef','薄荷晴空'],['#f6cf6b','#f28d8d','蜂蜜夕陽']];
  $('#dyeShop').innerHTML='<div class="dye-shop-head"><small>HAIR COLOR TICKET</small><h2>染一款，只屬於你的髮色。</h2><p>先用你現在試穿的髮型免費試色，滿意再用一張券把整組保存起來。</p></div>'
   +'<div class="dye-demos">'+demos.map((d,i)=>'<button class="dye-demo" data-demo="'+i+'" style="--a:'+d[0]+';--b:'+d[1]+'"><canvas width="64" height="64" data-dye-demo="'+i+'"></canvas><span>'+d[2]+'</span></button>').join('')+'</div>'
   +'<div class="dye-offer"><div class="dye-price"><small>ONE TICKET</small><b>NT$'+price+'</b><span>'+(t?('你有 '+t+' 張'):'目前 0 張')+'</span></div><ul><li>主色＋髮尾漸層一張全包</li><li>保存的組合可重複穿戴，不再扣券</li><li>預覽永遠免費</li></ul><div class="dye-offer-btns"><button class="ghost" id="dyeTryFree">免費試色 →</button><button class="primary" id="dyeBuyBtn">買一張染髮券</button></div></div>';
  $$('[data-dye-demo]').forEach(cv=>{const d=demos[cv.dataset.dyeDemo];try{const doll=api.makeDoll(selection,{hair:data.doll.hair||0});doll.hairHex=d[0];doll.hairHex2=d[1];api.draw(cv,doll);}catch(e){}});
  $$('[data-demo]').forEach(b=>b.onclick=()=>{const d=demos[b.dataset.demo];openDye({main:d[0],tail:d[1]});});
  $('#dyeTryFree').onclick=()=>openDye();
  $('#dyeBuyBtn').onclick=()=>{try{api.buyDye();}catch(e){tell(e.message);}};
 }
 const dyeShopEl=document.createElement('section');dyeShopEl.id='dyeShop';dyeShopEl.className='dye-shop';dyeShopEl.hidden=true;$('#bundles').after(dyeShopEl);
 /* 分類列搬到「本日選物」標題下面,切到整套組合或染髮券時分類列還在 */
 $('#catalog .catalog-head').after($('#categories'));
 function renderBundles(){
  $('#bundlePager').innerHTML='';
  if(area==='bag'){
   const saved=Object.entries(data.dyed);
   $('#bundlegrid').innerHTML=saved.map(([id,s])=>'<article class="bundle saved-dye-bundle"><div class="bundlebody"><small>MY HAIR</small><h2>'+esc(s.name||'專屬染髮')+'</h2><canvas class="dyed-preview" width="64" height="64" data-dyed-preview="'+esc(id)+'"></canvas><p>已固定瀏海、後髮與髮色。再次穿戴不扣券。</p><button class="primary" data-saved="'+esc(id)+'">試穿這組</button></div></article>').join('')||'<div class="live-empty"><p>還沒有保存的染髮。</p><button class="primary" id="emptyDye">開始染髮</button><p>先選好瀏海與後髮，再調整專屬髮色。</p></div>';
   if($('#emptyDye'))$('#emptyDye').onclick=openDye;
   $$('[data-saved]').forEach(b=>b.onclick=()=>{const s=data.dyed[b.dataset.saved];selection=api.normalizeSelection({...selection,front:s.front,back:s.back});color={savedId:b.dataset.saved};swatches();paint();$('#detail').innerHTML='<p>已試穿完整染色組合。</p><button class="primary" id="wearSaved">穿上這組</button>';$('#wearSaved').onclick=wear;});
   $('#detail').innerHTML='<p>選一款我的染髮，即可試穿；再次穿戴不扣券。</p>';
  }else{
   const available=products().filter(o=>o.parts.length),featured=available.filter(o=>o.featured===283),show=featured.length?featured:available;
   $('#bundlegrid').innerHTML=show.map((o,i)=>'<article class="season-card" data-season="'+esc(o.id)+'"><div class="season-visual"><span class="season-kicker">TAVERN / SEASON COLLECTION</span><span class="season-number">0'+(i+1)+'</span>'+(o.img?'<img src="'+esc(o.img)+'" alt="'+esc(o.name)+'完整套裝展示" width="240" height="240">':'<canvas width="64" height="64" data-outfit-preview="'+esc(o.id)+'"></canvas>')+'</div><div class="season-info"><h2>'+esc(o.name)+'</h2><p>'+(o.id==='season283_devil'?'暖金與紫色交織，藏一點小惡魔的俏皮。':o.id==='season283_valentine'?'粉色漸入深紫，把心動穿成今天的模樣。':'收藏完整造型，也能自由搭配喜歡的部件。')+'</p><div class="season-price"><strong>'+esc(o.price)+'<small>金幣／整套</small></strong><span>'+(o.owned?'已收藏':'當季完整套組')+'</span></div><div class="season-actions"><button class="ghost" data-try-outfit="'+esc(o.id)+'">試穿整套</button><button class="primary" data-buy-outfit="'+esc(o.id)+'" '+(o.owned?'disabled':'')+'>'+(o.owned?'已擁有':'選購整套')+'</button></div></div></article>').join('')||'<p class="live-empty">目前沒有上架組合。</p>';
   $$('[data-try-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.tryOutfit);const next=outfitSelection(o),nextColor={hair:o.doll?.hair||0};try{api.makeDoll(next,nextColor);}catch(e){tell(e.message);return;}selection=next;color=nextColor;swatches();paint();tell('已試穿「'+o.name+'」');});
   $$('[data-buy-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.buyOutfit);if(!o.owned)buy(o.id);});
   $('#detail').innerHTML='<p>整套收藏，隨心搭配。購買後可在「我的背包」找到各部件；展示髮色可作為你的配色靈感。</p>';
  }
 }
 function buy(id){try{api.buy(id);}catch(e){tell(e.message);}}
 async function wear(){if(saving)return;saving=true;try{await api.wear(selection,color);data=api.state();tell('穿搭已保存，回到大廳也會穿著這一套。');}catch(e){tell(e.message);}finally{saving=false;}}
 /* v258:商城／背包做成同一個視窗裡的大分頁,不用關窗再開 */
 const areaNav=document.querySelector('.mode');areaNav.className='area-tabs';areaNav.setAttribute('aria-label','商城與背包');
 areaNav.innerHTML='<button data-area="store" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span><b>商城</b><small>SHOP</small></span></button><button data-area="bag" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2M9 13h6"/></svg><span><b>我的背包</b><small>BAG</small></span></button>';
 function syncOuter(a){try{const doc=parent.document;const w=doc.querySelector('#shopWindow');if(w)w.dataset.area=a;const t=doc.querySelector('#shopTitle');if(t){t.textContent=a==='bag'?'我的背包':'時裝間';t.dataset.text=t.textContent;}const sm=doc.querySelector('#shopWindow .window-head small');if(sm)sm.textContent=a==='bag'?'MY LITTLE ARCHIVE / 把喜歡的收藏好':'TAVERN BOUTIQUE / 選一份新的心情';const f=doc.querySelector('#shopFrame');if(f)f.dataset.liveArea=a;}catch(e){}}
 areaNav.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.area===area)return;init();setArea(b.dataset.area);syncOuter(b.dataset.area);});
 document.querySelector('.catalog-mode').hidden=true;
 $('#singlesMode').onclick=()=>{mode='singles';render();};$('#bundlesMode').onclick=()=>{mode='bundles';render();};
 $('#reset').onclick=()=>{init();render();tell('已還原目前穿搭');};
 $('#showWear').textContent='穿上搭配';$('#showWear').onclick=wear;

 $('#dyeDialog .dialog-card').innerHTML='<div class="dialog-head"><span class="eyebrow">YOUR HAIR COLOR</span><button id="closeDye" aria-label="關閉染髮">×</button></div><h2 id="dyeTitle">染一款，只屬於你的髮色。</h2><p>使用目前試穿的瀏海與後髮。預覽免費，保存組合才扣 1 張券。</p><div class="dye-workspace"><div class="dye-avatar"><canvas id="dyePreview" width="64" height="64" aria-label="染髮即時預覽"></canvas><span>即時預覽</span></div><div class="dye-controls"><label>組合名稱<input id="dyeName" maxlength="24" placeholder="專屬染髮"></label><label>主色<input id="dyeMain" type="color" aria-label="染髮主色"></label><label class="dye-gradient"><input id="dyeGradient" type="checkbox">加入髮尾漸層</label><label id="dyeTailLabel">髮尾色<input id="dyeTail" type="color" aria-label="染髮髮尾色"></label></div></div><div class="ticket-state" role="status"></div><p id="dyeError" role="alert" hidden></p><div class="dye-actions"><button id="cancelDye" class="ghost">取消</button><button id="buyDyeInDialog" class="primary buy" hidden>買一張染髮券</button><button id="saveDye" class="primary">使用 1 張並保存</button></div><p class="dye-note">保存後可在「染色組合」重複穿戴，不再扣券。</p>';
 function closeDye(){if(dyeSaving)return;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;dyeDraft=null;paint();$('#dyeTicket').focus();}
 function dyeStatus(){
  $('#dyeDialog .ticket-state').textContent='持有 '+data.tickets+' 張染髮券'+(data.tickets<1?' · 券不足，仍可免費預覽':' · 保存使用 1 張');
  $('#saveDye').disabled=dyeSaving||data.tickets<1;$('#saveDye').textContent=dyeSaving?'保存中…':'使用 1 張並保存';
  $('#saveDye').hidden=data.tickets<1;$('#buyDyeInDialog').hidden=data.tickets>=1;$('#buyDyeInDialog').textContent='買一張染髮券 NT$'+(api.dyePrice?.()||299)+' →';
  $$('#dyeDialog input, #closeDye, #cancelDye').forEach(el=>el.disabled=dyeSaving);
  $('#dyeTail').disabled=dyeSaving||!$('#dyeGradient').checked;
 }
 function updateDye(){
  const previous=dyeDraft;
  dyeDraft={name:$('#dyeName').value,main:$('#dyeMain').value,tail:$('#dyeGradient').checked?$('#dyeTail').value:$('#dyeMain').value};
  $('#dyeTailLabel').hidden=!$('#dyeGradient').checked;dyeStatus();if(!previous||previous.main!==dyeDraft.main||previous.tail!==dyeDraft.tail)requestPaint();
 }
 function openDye(preset){
  try{
   data=api.state();if(!data.loggedIn)throw Error('先登入自己的闆卡，再使用染髮');
   const d=api.makeDoll(selection,color,true);
   $('#dyeName').value='';$('#dyeMain').value=(preset&&preset.main)||d.hairHex||data.colors[d.hair||0];$('#dyeTail').value=(preset&&preset.tail)||d.hairHex2||'#f3b8d8';
   $('#dyeGradient').checked=preset?true:(!!d.hairHex2&&d.hairHex2!==d.hairHex);$('#dyeError').hidden=true;
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
   data=api.state();color={savedId:result.id};dyeDraft=null;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;area='bag';bagSection='wear';category='hair';hairSection='saved';page=0;syncOuter('bag');render();
   tell('染色組合已保存！按「穿上搭配」即可在大廳使用。');$('#showWear').focus();
  }catch(e){$('#dyeError').textContent=e.message||'保存未完成，請重試';$('#dyeError').hidden=false;data=api.state();}
  finally{dyeSaving=false;dyeStatus();}
 }
 $('#closeDye').onclick=closeDye;$('#cancelDye').onclick=closeDye;$('#saveDye').onclick=saveDye;
 $('#buyDyeInDialog').onclick=()=>{try{api.buyDye();}catch(e){tell(e.message);}};
 $$('#dyeDialog input').forEach(el=>el.oninput=updateDye);$('#dyeTicket').onclick=()=>openDye();
 document.querySelector('.paneltitle strong').textContent='我的試衣舞臺';document.querySelector('.collection-mark span').textContent='星光換裝間';document.querySelector('.collection-mark strong').textContent='DRESS UP & PLAY';
 window.ttDressArea=next=>{init();setArea(next);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!$('#dyeDialog').hidden)closeDye();else api.close();}});
 window.addEventListener('resize',()=>render());
 init();render();[200,600,1400,3000].forEach(t=>setTimeout(paint,t));
 setInterval(()=>{if(api.isActive()){const next=api.state();if(next.tickets!==data.tickets||JSON.stringify(next.catalog)!==JSON.stringify(data.catalog)||JSON.stringify(next.dyed)!==JSON.stringify(data.dyed)){data=next;render();if(!$('#dyeDialog').hidden)dyeStatus();}}},2000);
})();
