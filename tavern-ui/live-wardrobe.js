/* 時裝間正式資料介面；商品價格、持有狀態與穿戴都由主站驗證。 */
(() => {
 'use strict';
 const api=parent.parent.TinyTavernUI;if(!api)return;
 const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories=[['hair','頭髮'],['cloth','衣服'],['acc','配件'],['eye','臉'],['pet','寵物'],['seat','座椅'],['other','其他']];
 const groupNames={head:'頭飾',ear:'耳環',face:'面部配件',hand:'手持物',back:'背飾／尾巴'};
 let data,selection={},color={},area='store',category='bundles',mode='singles',filter='all',page=0,selected=null,saving=false;
 let drinkQuantity=1,drinkBusy=false,drinkDialogOpen=false;
 let hairSection='original',seasonPage=0;
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
  if(p.product?.drink)return false;
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
   const custom=source&&data.catalog.some(o=>o.id===source&&!o.drink&&o.parts.some(p=>p.slot===sl));
   next[sl]=custom?{source,slot:sl}:['pet','seat'].includes(sl)?null:{base:d[native]||0,slot:sl};
  }
  const accessories=d.uiAccessories||data.catalog.find(o=>o.id===d.set)?.parts.filter(p=>p.category==='acc')||Object.entries(d.ps||{}).filter(([k])=>/^acc\d*$/.test(k)).map(([slot,source])=>({source,slot}));
  (api.expandAccessories?.(accessories,d)||accessories).forEach(r=>{const p=data.catalog.find(o=>o.id===r.source)?.parts.find(p=>p.slot===r.slot);if(p)next[key(p)]=ref(p);});
  return api.normalizeSelection?.(next)||next;
 }
 function init(){
  void api.refreshDrinks?.().then(()=>{data=api.state();render()}).catch(e=>tell(e.message));
  dyeDraft=null;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;
  data=api.state();const d=data.doll;selection=selectionFromDoll(d);
  const saved=d.dyedHairSet&&data.dyed[d.dyedHairSet];
  if(saved){selection.front={...saved.front};selection.back={...saved.back};}
  color=saved?{savedId:d.dyedHairSet}:{hair:d.hair||0,keepOriginal:true};selected=null;page=0;
 }
 function outfitSelection(o){const next=selectionFromDoll(o.doll||{});o.parts.filter(p=>p.defaultEquipped!==false).forEach(p=>next[key(p)]=ref(p));return next;}
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
 async function saveBag(next,nextColor,message){
  if(saving)return;const before=selection,beforeColor=color;saving=true;selection=next;color=nextColor;render();
  try{await api.wear(next,nextColor);data=api.state();tell(message||'已保存穿搭。');}
  catch(e){selection=before;color=beforeColor;tell('未能保存：'+e.message);}
  finally{saving=false;render();}
 }
 function tryItem(p){
  if(!p||saving)return;
  if(p.product?.drink){selected=p.id;drinkQuantity=1;render();return;}
  let next={...selection};const nextColor=p.category==='hair'?{hair:data.doll.hair||0}:color;
  const removing=(area==='bag'||['acc','pet','seat','other'].includes(p.category))&&isTrying(p);
  if(removing)next[key(p)]=['front','back','cloth','eye','brow'].includes(p.slot)?{base:0,slot:p.slot}:null;
  else if(p.parts)p.parts.forEach(q=>next[key(q)]=ref(q));else next[key(p)]=ref(p);
  const normalized=p.category==='hair'?(api.normalizeSelection?.(next)||next):next;
  const removedDependency=Object.keys(next).some(k=>next[k]&&normalized[k]===null);next=normalized;
  try{api.makeDoll(next,nextColor);}catch(e){tell(e.message);return;}
  if(area==='bag'){selected=p.id;if(p.category==='hair')dyeDraft=null;return saveBag(next,nextColor,removing?'已卸下「'+p.name+'」'+(['front','back','cloth','eye','brow'].includes(p.slot)?'，恢復原有部件。':'。'):'已穿上「'+p.name+'」。');}
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
  try{const d=api.makeDoll(selection,color);if(dyeVisible){d.hairHex=dyeDraft.main;d.hairHex2=dyeDraft.tail;if(dyeDraft.highlight)d.hairHighlight=dyeDraft.highlight;}api.draw($(dyeVisible?'#dyePreview':'#avatar'),d);const pet=api.followingPet?.(d),holder=$('#avatar').parentElement;let img=document.getElementById('wardrobePet');holder.classList.toggle('has-following-pet',!!pet);if(!pet){img?.remove();}else{if(!img){img=document.createElement('img');img.id='wardrobePet';holder.append(img);}if(img.dataset.pet!==pet.id){img.src='../'+pet.src;img.alt=pet.name;img.dataset.pet=pet.id;}}}catch(e){tell(e.message);}
  // 染髮彈窗遮住的商品與主舞臺不跟著每一次色票事件重畫。
  if(dyeVisible)return;
  const list=entries();$$('#singles:not([hidden]) [data-preview]').forEach(cv=>{const p=list.find(p=>p.id===cv.dataset.preview);if(p)drawPart(cv,p);});
  $$('#bundles:not([hidden]) [data-outfit-preview]').forEach(cv=>{const o=data.catalog.find(o=>o.id===cv.dataset.outfitPreview);if(o)api.draw(cv,api.makeDoll(outfitSelection(o),{hair:o.doll?.hair||0}));});
  $$('#bundles:not([hidden]) [data-dyed-preview]').forEach(cv=>{const s=data.dyed[cv.dataset.dyedPreview];if(s)api.draw(cv,api.makeDoll(api.normalizeSelection({...selection,front:s.front,back:s.back}),{savedId:cv.dataset.dyedPreview}));});
 }
 const companionStyle=document.createElement('style');companionStyle.textContent='body[data-shop-category=other] #grid .item{min-height:220px;grid-template-rows:14px minmax(145px,1fr) 36px}body[data-shop-category=other] #grid{grid-auto-rows:minmax(220px,auto)} .thumb:has(.drink-product-image){position:relative;overflow:hidden}.thumb .drink-product-image{width:100%;height:100%;object-fit:contain;image-rendering:auto;position:absolute;inset:0;display:block} .drink-companions{display:flex;justify-content:center;align-items:end;gap:20px;margin:12px 0}.drink-companions figure{margin:0;text-align:center}.drink-companions img{display:block;object-fit:contain;image-rendering:pixelated;width:100px;height:114px}.drink-companions .drink-pet{width:80px;height:104px}.drink-companions figcaption{font-size:12px;margin-top:4px}#detail:has(.drink-companions){display:grid!important;grid-template-columns:minmax(0,1fr);height:auto!important;min-height:0;gap:8px}#detail>.drink-companions{grid-row:2;margin:0}#detail:has(.drink-companions)>.actions{display:flex!important;flex-wrap:wrap;justify-content:center;gap:10px;min-width:0;max-width:100%;grid-row:3}#detail:has(.drink-companions) .primary{max-width:100%;white-space:normal}';document.head.append(companionStyle);const carouselStyle=document.createElement('style');carouselStyle.textContent="\nbody[data-shop-category=other] .workspace{grid-template-columns:minmax(0,1fr)!important}body[data-shop-category=other] #catalog{grid-column:1/-1!important;width:100%} .drink-heading .drink-unit-price{display:block!important;text-align:center!important}body[data-shop-category=other] #grid,body[data-shop-category=other] #pager,body[data-shop-category=other] #bundlePager{display:none!important}\nbody[data-shop-category=other] #detail{display:flex!important;flex-direction:column;padding:0 0 24px;gap:14px;overflow:hidden;border-radius:24px;background:linear-gradient(145deg,#fffcf6,#f5e2e6);min-width:0}\nbody[data-shop-category=other] #detail>div:first-of-type{display:none}\nbody[data-shop-category=other] #detail>.actions{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:16px;padding:0 16px}\n.drink-carousel{width:100%;min-width:0}.drink-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;touch-action:pan-x pan-y}.drink-track::-webkit-scrollbar{display:none}\n.drink-slide{flex:0 0 100%;min-width:0;scroll-snap-align:center;scroll-snap-stop:always;text-align:center;padding:22px 16px 0;box-sizing:border-box}\n.drink-heading small{font-size:10px;letter-spacing:2px;color:#ae7d80}.drink-heading h2{font-size:26px;margin:8px 0}.drink-heading .drink-unit-price{font-size:13px;margin:0;color:#9d7373}\n.drink-scene{display:flex;align-items:center;justify-content:center;gap:14px;min-height:250px;position:relative}.drink-center{width:240px;height:240px;max-width:50%;position:relative;display:grid;place-items:center}.drink-center:before{content:\"\";position:absolute;inset:15%;border-radius:50%;background:#fff9f3;box-shadow:0 0 55px #fff9f3}.drink-center img{position:relative;width:100%;height:100%;object-fit:contain}\n.drink-friend{object-fit:contain;image-rendering:pixelated;width:72px;height:82px;flex-shrink:0;align-self:flex-end;margin-bottom:44px}.drink-friend.pet{width:58px;height:76px;transform:scaleX(-1)}\n.drink-navigation{display:flex;justify-content:center;align-items:center;gap:24px;padding:0 16px 8px}.drink-navigation>button{width:36px;height:36px;border-radius:50%;font-size:19px}.drink-dots{display:flex;gap:10px}.drink-dots button{width:9px;height:9px;padding:0;border-radius:50%;background:#dfc7c7;border:0}.drink-dots button[aria-current=true]{background:#9c606b;box-shadow:0 0 0 4px #9c606b15}\n@media(max-width:600px){.drink-slide{padding:20px 8px 0}.drink-scene{gap:4px;min-height:208px}.drink-center{width:190px;height:190px;max-width:60%}.drink-friend{width:48px;height:58px;margin-bottom:34px}.drink-friend.pet{width:42px;height:56px}.drink-heading h2{font-size:23px}}\n";document.head.append(carouselStyle);
 function companionArt(product){const info=product?.companion;if(!info||!['rira','kabuki','momo'].includes(info.asset))return document.createElement('span');const row=document.createElement('div');row.className='drink-companions';for(const role of ['staff','pet']){const figure=document.createElement('figure'),img=document.createElement('img'),label=document.createElement('figcaption');img.src='../img/companions-v315/'+info.asset+'-'+role+'.gif';img.alt=role==='staff'?info.name:info.name+'的寵物';if(role==='pet')img.className='drink-pet';label.textContent=role==='staff'?info.name:'寵物';figure.append(img,label);row.append(figure)}return row;}

 const orderStyle=document.createElement('link');orderStyle.rel='stylesheet';orderStyle.href='drink-order.css?v=339';document.head.append(orderStyle);
 const orderDialog=document.createElement('dialog');orderDialog.id='drinkOrderDialog';orderDialog.setAttribute('aria-labelledby','drinkOrderTitle');document.body.append(orderDialog);
 function closeDrinkOrder(){if(drinkBusy)return;drinkDialogOpen=false;orderDialog.close();document.querySelector('.drink-slide.is-current')?.focus();}
 orderDialog.addEventListener('cancel',e=>{e.preventDefault();closeDrinkOrder()});
 orderDialog.addEventListener('click',e=>{if(e.target===orderDialog)closeDrinkOrder()});
 function updateDrinkOrder(p){
  const actions=$('#detail>.actions');if(!drinkDialogOpen){actions?.remove();if(orderDialog.open)orderDialog.close();return;}
  const oldScroll=orderDialog.scrollTop,wasOpen=orderDialog.open,focused=document.activeElement?.id,card=$('#detail .drink-slide.is-current').cloneNode(true);card.removeAttribute('tabindex');card.removeAttribute('role');card.classList.add('order-card');
  orderDialog.dataset.tone=p.product.companion?.asset||'rira';
  orderDialog.innerHTML='<div class="drink-order-shell"><i class="order-flow flow-one" aria-hidden="true"></i><i class="order-flow flow-two" aria-hidden="true"></i><button class="order-close" aria-label="關閉飲料選購">×</button><div class="order-art"></div><section class="order-copy"><small>TINY TAVERN · FOR YOU</small><h2 id="drinkOrderTitle">老闆今天<br>需要幾杯呢？</h2><p class="order-product"></p><p class="order-note"></p><div class="order-controls"></div><button class="order-return">再看看其他飲料</button><p class="order-feedback" role="status"></p></section></div>';
  orderDialog.querySelector('.order-art').append(card);orderDialog.querySelector('.order-product').textContent=p.name;
  orderDialog.querySelector('.order-note').textContent=area==='bag'?'選好杯數，把心意送給夥伴。':'每杯 99 金幣 · 購買後收進背包';
  if(actions)orderDialog.querySelector('.order-controls').append(actions);
  orderDialog.querySelector('.order-close').onclick=closeDrinkOrder;orderDialog.querySelector('.order-return').onclick=closeDrinkOrder;
  if(!orderDialog.open)orderDialog.showModal();
  if(focused&&orderDialog.querySelector('#'+focused))orderDialog.querySelector('#'+focused).focus({preventScroll:true});else orderDialog.querySelector('.order-close')?.focus({preventScroll:true});orderDialog.scrollTop=wasOpen?oldScroll:0;requestAnimationFrame(()=>fitDrinkArt(orderDialog));
 }

 function fitDrinkArt(root){
  root.querySelectorAll('.drink-scene').forEach(scene=>{
   scene.style.transform='none';const box=scene.getBoundingClientRect();if(!box.width||!box.height)return;
   const rects=[...scene.querySelectorAll('.drink-watermark,.drink-center,.drink-friend')].map(e=>e.getBoundingClientRect());
   const left=Math.min(...rects.map(r=>r.left)),right=Math.max(...rects.map(r=>r.right)),top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));
   const scale=Math.min(1,(box.width-12)/(right-left),(box.height-12)/(bottom-top)),ratio=box.width/scene.offsetWidth;
   const x=((box.left+box.right-left-right)/2)*scale/ratio,y=((box.top+box.bottom-top-bottom)/2)*scale/ratio;
   scene.style.transformOrigin='50% 50%';scene.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';
  });
 }
 const drinkFitObserver=new ResizeObserver(()=>requestAnimationFrame(()=>fitDrinkArt(document)));
 document.fonts?.ready.then(()=>requestAnimationFrame(()=>fitDrinkArt(document)));
 function drinkCarousel(list,p){
  const wrap=document.createElement('section');wrap.className='drink-carousel';wrap.setAttribute('aria-label','選擇飲料');
  const index=Math.max(0,list.findIndex(x=>x.id===p.id));
  wrap.innerHTML='<div class="drink-track" tabindex="0" aria-label="左右滑動選擇飲料">'+list.map((entry,i)=>{const o=entry.product,a=o.companion;return '<article class="drink-slide '+(i===index?'is-current':'')+'" data-tone="'+esc(a?.asset||'rira')+'" aria-label="'+esc(entry.name)+'"><div class="drink-heading"><small>FOR YOU · 一杯小小心意</small><h2>'+esc(entry.name)+'</h2><div class="drink-unit-price">每杯 99 金幣</div></div><div class="drink-scene" style="'+window.ttDrinkLayoutStyle(window.TTDrinkLayout[a?.asset]||window.TTDrinkLayout.rira)+'">'+window.ttDrinkGeometry(a?.asset||'rira')+'<span class="drink-watermark" aria-hidden="true">'+esc(window.TTDrinkLayout[a?.asset]?.watermark.text||({kabuki:'KABUKI',rira:'RIRA',momo:'MOMO'})[a?.asset]||'')+'</span>'+(a?'<img class="drink-friend staff" src="../img/companions-v315/'+esc(a.asset)+'-staff.gif" alt="'+esc(a.name)+'">':'')+'<div class="drink-center"><img src="'+esc(o.img)+'" alt="'+esc(entry.name)+'"></div>'+(a?'<img class="drink-friend pet" src="../img/companions-v315/'+esc(a.asset)+'-pet.gif" alt="'+esc(a.name)+'的寵物">':'')+'</div></article>'}).join('')+'</div><nav class="drink-navigation" aria-label="切換飲料"><button type="button" class="drink-prev" aria-label="上一款飲料">←</button><div class="drink-dots">'+list.map((entry,i)=>'<button type="button" data-drink-index="'+i+'" aria-label="'+esc(entry.name)+'" aria-current="'+(i===index)+'"></button>').join('')+'</div><button type="button" class="drink-next" aria-label="下一款飲料">→</button></nav>';
  const track=wrap.querySelector('.drink-track');let ready=false,drag=null,touching=false;const slides=[...track.children];const offset=i=>slides[i].offsetLeft-track.offsetLeft-(track.clientWidth-slides[i].offsetWidth)/2;const nearest=()=>slides.reduce((best,el,i)=>Math.abs(offset(i)-track.scrollLeft)<Math.abs(offset(best)-track.scrollLeft)?i:best,0);
  const choose=i=>{if(drinkBusy)return;i=(i+list.length)%list.length;if(list[i].id===selected)return;['drinkSubmit','drinkPlus','drinkMinus'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=true});track.scrollTo({left:offset(i),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  wrap.querySelector('.drink-prev').onclick=()=>choose(index-1);wrap.querySelector('.drink-next').onclick=()=>choose(index+1);
  wrap.querySelectorAll('[data-drink-index]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.drinkIndex)));
  wrap.querySelectorAll('button').forEach(b=>b.disabled=drinkBusy||list.length<2);
  track.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();choose(index+(e.key==='ArrowRight'?1:-1));}};
  track.onscroll=()=>{if(touching)track.suppressClick=true;if(!ready||drinkBusy||drag||touching)return;const i=nearest();slides.forEach((el,n)=>el.classList.toggle('is-current',n===i));clearTimeout(track.timer);track.timer=setTimeout(()=>{if(!track.isConnected)return;const n=nearest();if(list[n].id!==selected){selected=list[n].id;drinkQuantity=1;render();}},180);};
  track.querySelectorAll('img').forEach(img=>img.draggable=false);
  track.onpointerdown=e=>{if(drinkBusy)return;track.suppressClick=false;if(e.pointerType==='touch'){touching=true;clearTimeout(track.timer);return;}if(e.button!==0)return;clearTimeout(track.timer);drag={x:e.clientX,start:track.scrollLeft};track.classList.add('dragging');};
  track.onpointermove=e=>{if(!drag)return;if(Math.abs(e.clientX-drag.x)>8){track.suppressClick=true;track.setPointerCapture(e.pointerId);}track.scrollLeft=drag.start+drag.x-e.clientX;};
  const endDrag=()=>{if(touching){touching=false;track.onscroll();return;}if(!drag)return;drag=null;track.classList.remove('dragging');track.scrollTo({left:offset(nearest()),behavior:'smooth'});track.onscroll();};
  track.onpointerup=endDrag;track.onpointercancel=endDrag;
  slides.forEach((slide,i)=>{slide.tabIndex=0;slide.setAttribute('role','button');slide.setAttribute('aria-label',list[i].name+'，選擇杯數');const open=()=>{if(drinkBusy||track.suppressClick)return;selected=list[i].id;drinkQuantity=1;drinkDialogOpen=true;render()};slide.onclick=open;slide.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();open()}};});
  drinkFitObserver.disconnect();requestAnimationFrame(()=>{drinkFitObserver.observe(track);fitDrinkArt(wrap);track.scrollLeft=offset(index);requestAnimationFrame(()=>ready=true);});return wrap;
 }
 const drinkDesign=document.createElement('link');drinkDesign.rel='stylesheet';drinkDesign.href='drink-cards.css?v=339';document.head.append(drinkDesign);
 function showDrinkDialogue(result,product){
  let dialog=document.getElementById('drinkDialogue');if(!dialog){dialog=document.createElement('dialog');dialog.id='drinkDialogue';dialog.style.cssText='max-width:420px;width:calc(100% - 48px);border:2px solid #cab5d9;border-radius:18px;background:#fff8fb;color:#614461;padding:24px;box-shadow:0 12px 48px #55334c55';document.body.append(dialog);}
  dialog.replaceChildren();const msg=document.createElement('p');msg.style.cssText='font-size:18px;line-height:1.8;white-space:pre-wrap';msg.textContent=result.message;const done=document.createElement('button');done.className='primary';done.textContent='關閉';done.onclick=()=>dialog.close();dialog.append(companionArt(product),msg,done);dialog.showModal();
 }
 function setArea(next){drinkDialogOpen=false;orderDialog.close();drinkQuantity=1;area=next==='bag'?'bag':'store';bagSection='wear';category=area==='store'?'bundles':'hair';hairSection='original';page=0;selected=null;filter='all';mode='singles';render();}
 window.ttDyeShop=()=>{if(area!=='store'){init();setArea('store');syncOuter('store');}category='dye';render();};
 function swatches(){
  const preset=[0,2,3,4,5,6,7,1,9].filter(i=>data.colors[i]);
  $('#dyePanel').innerHTML='<div class="dye-head"><strong>主色</strong><span>'+(color.savedId?'已保存髮色':'即時試色')+'</span></div><div class="swatches">'+preset.map(i=>'<button data-color="'+i+'" aria-label="試穿髮色 '+(i+1)+'" style="--swatch:'+data.colors[i]+'" aria-pressed="'+(color.hair===i)+'" '+(color.savedId?'disabled':'')+'></button>').join('')+'</div>';
  $$('[data-color]').forEach(b=>b.onclick=()=>{const nextColor={hair:Number(b.dataset.color)};if(area==='bag')return saveBag(selection,nextColor,'已保存髮色。');color=nextColor;swatches();requestPaint();});
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
  $('#showWear').hidden=area!=='bag'||category==='other';$('#dyeTicket').hidden=false;
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
  if(dyeShop){$('#grid').replaceChildren();$('#subtabs').replaceChildren();$('#pager').replaceChildren();$('#bundlePager').replaceChildren();$('#detail').replaceChildren();renderDyeShop();dyeCta();swatches();paint();return;}
  $('#singles').classList.toggle('has-accessory-filter',category==='acc');
  $('#subtabs').innerHTML=category==='acc'?'<nav class="accessory-filter" aria-label="配件部位">'+[['all','全部'],...Object.entries(groupNames)].map(([id,n])=>'<button data-group="'+id+'" aria-pressed="'+(id===filter)+'">'+n+'</button>').join('')+'</nav>':category==='hair'?(area==='bag'?'瀏海與後髮可分別搭配':'完整髮型 · 整組試穿'):'點圖片，即時試穿';
  if(area==='bag'&&category==='hair'){
   $('#subtabs').innerHTML='<nav class="hair-sections" aria-label="頭髮分類"><button type="button" data-hair-section="original" aria-pressed="'+(hairSection==='original')+'">原有髮型</button><button type="button" data-hair-section="saved" aria-pressed="'+(hairSection==='saved')+'">我的染髮 <span>'+Object.keys(data.dyed).length+'</span></button></nav><p class="hair-section-hint">'+(myHair?'已保存的專屬髮色，點一下試穿；再次穿戴不扣券。':'瀏海與後髮可分別搭配。')+'</p>';
   $$('[data-hair-section]').forEach(b=>b.onclick=()=>{hairSection=b.dataset.hairSection;page=0;selected=null;render();});
  }
  $$('[data-group]').forEach(b=>b.onclick=()=>{filter=b.dataset.group;page=0;selected=null;render();});
  const list=entries(),per=innerWidth<601?2:6,pages=Math.max(1,Math.ceil(list.length/per));page=Math.min(page,pages-1);
  if(!list.some(p=>p.id===selected))selected=list.slice(page*per,(page+1)*per).find(isTrying)?.id||null;
  $('#grid').innerHTML=list.slice(page*per,(page+1)*per).map((p,i)=>'<button class="item" data-item="'+esc(p.id)+'" aria-label="'+(p.product.drink?'查看':isTrying(p)&&(area==='bag'||['acc','pet','seat','other'].includes(p.category))?'卸下':area==='bag'?'穿戴':'試穿')+esc(p.name)+'" aria-pressed="'+isTrying(p)+'"><span class="itemtop"><span class="item-number">'+String(page*per+i+1).padStart(2,'0')+'</span><span class="status">'+(p.product.owned?'已擁有':'')+'</span></span><span class="thumb">'+((p.product.drink||p.product.pet)?'<img class="drink-product-image" src="'+esc(p.product.img)+'" alt="'+esc(p.name)+'" decoding="async">':'<canvas width="64" height="64" data-preview="'+esc(p.id)+'"></canvas>')+'</span><span class="item-caption"><strong>'+esc(p.name)+'</strong><small>'+esc(p.product.drink?(p.product.owned?'已擁有':'每杯 '+p.product.price+' 金幣'):isTrying(p)?(area==='bag'||['acc','pet','seat','other'].includes(p.category)?'已搭配 · 再點卸下':'已搭配'):area==='bag'?'已收藏 · 點選搭配':p.product.owned?'已收藏':p.product.previewOnly?'新品試穿 · 敬請期待':(p.product.drink?'每杯 ':p.product.pet?'單隻 ':'整組 ')+p.product.price+' 金幣')+'</small>'+(p.requirement?'<small class="accessory-requirement">'+esc(p.requirement)+'</small>':'')+'</span></button>').join('')||'<p class="live-empty">'+(area==='bag'?'這個分類還沒有已取得的部件。':'目前沒有上架商品。')+'</p>';
  $$('[data-item]').forEach(b=>b.onclick=()=>tryItem(list.find(p=>p.id===b.dataset.item)));
  $('#pager').innerHTML='<button id="prevPage" '+(!page?'disabled':'')+'>←</button><span>'+String(page+1).padStart(2,'0')+' / '+String(pages).padStart(2,'0')+'</span><button id="nextPage" '+(page+1>=pages?'disabled':'')+'>→</button><small>'+list.length+' 款</small>';
  $('#prevPage').onclick=()=>{page--;selected=null;render();};$('#nextPage').onclick=()=>{page++;selected=null;render();};
  if(category==='other'&&list.length&&!list.some(p=>p.id===selected))selected=list[0].id;
  const p=list.find(p=>p.id===selected);
  $('#detail').innerHTML=p?'<div><small class="overline">'+(p.category==='acc'?'ACCESSORY / '+groupNames[p.group]:'YOUR STYLE')+'</small><h2>'+esc(p.name)+'</h2><p>'+esc(p.requirement||(p.product.owned?'已取得，可自由搭配。':p.product.pet?'購買後可從背包裝備，跟隨在你身邊。':p.product.drink?'給寵物的飲料。':'包含於「'+p.product.name+'」，購買整組後可拆件搭配。'))+'</p></div><div class="actions">'+(['acc','pet','seat','other'].includes(p.category)?'<span class="accessory-toggle-hint">點選配件搭配，再點一次卸下</span>':'')+'<button class="primary" id="itemAction">'+(area==='bag'?'穿上目前搭配 →':p.product.owned?'已擁有':p.product.previewOnly?'敬請期待':p.product.pet?'選購寵物 →':p.product.drink?'選購飲料 →':'選購整組 →')+'</button></div>':'<p>挑選另一個分類，繼續找喜歡的造型。</p>';
  if(p){$('#itemAction').disabled=area==='store'&&(p.product.owned||p.product.previewOnly);$('#itemAction').onclick=()=>area==='bag'?wear():!p.product.owned&&buy(p.product.id);}
  if(category==='other'){
   $('#catalog .catalog-head h2').textContent=area==='bag'?'我的飲料':'飲料';if(!list.length)$('#grid').innerHTML='<p class="live-empty">'+(area==='bag'?'目前沒有持有的飲料。':'目前沒有上架飲料。')+'</p>';if(!p)$('#detail').textContent='選擇飲料與杯數';
   $('#subtabs').textContent='左右滑動，挑一杯送給喜歡的夥伴';document.querySelector('.preview').hidden=true;
   if(p?.product.drink){const max=area==='bag'?Math.min(99,p.product.quantity):99;drinkQuantity=Math.min(max,Math.max(1,drinkQuantity));
    $('#detail').innerHTML='<div><h2>'+esc(p.name)+'</h2><p>'+(area==='bag'?'持有 '+p.product.quantity+' 杯':'每杯 99 金幣')+'</p></div><div class="actions"><div role="group" aria-label="飲料杯數" style="display:flex;align-items:center;gap:12px"><button id="drinkMinus" aria-label="減少一杯">−</button><label class="drink-quantity-label"><input id="drinkQuantity" type="text" inputmode="numeric" pattern="[0-9]*" aria-label="飲料杯數" value="'+drinkQuantity+'" autocomplete="off"><span>杯</span></label><button id="drinkPlus" aria-label="增加一杯">＋</button></div><button id="drinkSubmit" class="primary">'+(area==='bag'?'餵食 '+drinkQuantity+' 杯':'購買 '+drinkQuantity+' 杯 · '+(99*drinkQuantity)+' 金幣')+'</button></div>';
    $('#detail').prepend(drinkCarousel(list,p));
    $('#drinkMinus').disabled=drinkBusy||drinkQuantity<=1;$('#drinkPlus').disabled=drinkBusy||drinkQuantity>=max;$('#drinkSubmit').disabled=drinkBusy||max<1;
    const quantityInput=$('#drinkQuantity');quantityInput.disabled=drinkBusy||max<1;
    const syncQuantity=()=>{const submit=$('#drinkSubmit');submit.textContent=area==='bag'?'餵食 '+drinkQuantity+' 杯':'購買 '+drinkQuantity+' 杯 · '+(99*drinkQuantity)+' 金幣';submit.disabled=drinkBusy||max<1;$('#drinkMinus').disabled=drinkBusy||drinkQuantity<=1;$('#drinkPlus').disabled=drinkBusy||drinkQuantity>=max;};
    const normalizeQuantity=()=>{const n=Number(quantityInput.value);drinkQuantity=max<1?0:Math.max(1,Math.min(max,Number.isFinite(n)?Math.floor(n):1));quantityInput.value=String(drinkQuantity);syncQuantity();};
    quantityInput.onfocus=()=>quantityInput.select();
    quantityInput.oninput=()=>{if(!/^\d+$/.test(quantityInput.value)||Number(quantityInput.value)<1){$('#drinkSubmit').disabled=true;return;}drinkQuantity=Math.min(max,Number(quantityInput.value));if(Number(quantityInput.value)>max)quantityInput.value=String(max);syncQuantity();};
    quantityInput.onblur=normalizeQuantity;
    quantityInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();normalizeQuantity();$('#drinkSubmit').focus();}};
    $('#drinkMinus').onclick=()=>{drinkQuantity--;render()};$('#drinkPlus').onclick=()=>{drinkQuantity++;render()};
    $('#drinkSubmit').onclick=async()=>{if(drinkBusy)return;const action=area==='bag'?'feed':'buy',qty=drinkQuantity;drinkBusy=true;render();try{const result=await api.drinkAction(action,p.product.id,qty);data=api.state();drinkDialogOpen=false;orderDialog.close();if(action==='feed')showDrinkDialogue(result,p.product);else tell('已購買 '+qty+' 杯，可到背包 → 其他餵食。');}catch(e){tell(e.message);orderDialog.dataset.error=e.message}finally{drinkBusy=false;render();if(orderDialog.open)orderDialog.querySelector('.order-feedback').textContent=orderDialog.dataset.error||''}};
    updateDrinkOrder(p);
   }
  }
  if(mode==='bundles')renderBundles();
  if(area==='bag'&&category!=='other'){$('#detail').replaceChildren();$('#detail').hidden=true;}else $('#detail').hidden=false;
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
 // 分頁放在標題旁，兩套商品仍完整留在首屏。
 $('#catalog .catalog-head').append($('#bundlePager'));
 const seasonStyle=document.createElement('style');seasonStyle.textContent='body[data-area=store][data-shop-category=bundles] #catalog #bundlePager{display:flex!important;gap:8px;align-items:center;margin:0;font-size:12px}#catalog .catalog-head{display:flex;justify-content:space-between;align-items:center}#bundlePager:empty{display:none!important}#dyeHighlightLabel{display:grid;grid-template-columns:1fr auto;gap:6px}#dyeHighlightLabel[hidden]{display:none!important}#dyeHighlightLabel small{grid-column:1/-1;display:block;font-size:12px;line-height:1.5}';document.head.append(seasonStyle);
 function renderBundles(){
  $('#bundlePager').innerHTML='';
  if(area==='bag'){
   const saved=Object.entries(data.dyed);
   $('#bundlegrid').innerHTML=saved.map(([id,s])=>'<article class="bundle saved-dye-bundle"><div class="bundlebody"><small>MY HAIR</small><h2>'+esc(s.name||'專屬染髮')+'</h2><canvas class="dyed-preview" width="64" height="64" data-dyed-preview="'+esc(id)+'"></canvas><p>已固定瀏海、後髮與髮色。再次穿戴不扣券。</p><button class="primary" data-saved="'+esc(id)+'">試穿這組</button></div></article>').join('')||'<div class="live-empty"><p>還沒有保存的染髮。</p><button class="primary" id="emptyDye">開始染髮</button><p>先選好瀏海與後髮，再調整專屬髮色。</p></div>';
   if($('#emptyDye'))$('#emptyDye').onclick=openDye;
   $$('[data-saved]').forEach(b=>{const id=b.dataset.saved,active=color.savedId===id;b.textContent=active?'已穿戴 · 點一下卸下':'點一下穿戴';b.onclick=()=>{if(saving)return;const saved=data.dyed[id];const next=api.normalizeSelection({...selection,front:active?{base:0,slot:'front'}:saved.front,back:active?{base:0,slot:'back'}:saved.back});return saveBag(next,active?{hair:data.doll.hair||0}:{savedId:id},active?'已卸下染髮組合，恢復原有髮型。':'已穿上染髮組合。');}});
   $('#detail').innerHTML='<p>選一款我的染髮，即可試穿；再次穿戴不扣券。</p>';
  }else{
   const available=products().filter(o=>!['寵物','其他'].includes(o.type)&&o.parts.length),featured=available.filter(o=>o.featured),all=(featured.length?featured:available).sort((a,b)=>b.featured-a.featured);const pages=Math.max(1,Math.ceil(all.length/2));seasonPage=Math.min(seasonPage,pages-1);const show=all.slice(seasonPage*2,seasonPage*2+2);
   if(pages>1){$('#bundlePager').innerHTML='<button id=seasonPrev '+(!seasonPage?'disabled':'')+'>←</button><span>'+(seasonPage+1)+' / '+pages+'</span><button id=seasonNext '+(seasonPage+1>=pages?'disabled':'')+'>→</button>';$('#seasonPrev').onclick=()=>{seasonPage--;renderBundles();paint();};$('#seasonNext').onclick=()=>{seasonPage++;renderBundles();paint();};}
   $('#bundlegrid').innerHTML=show.map((o,i)=>'<article class="season-card" data-season="'+esc(o.id)+'"><div class="season-visual"><span class="season-kicker">TAVERN / SEASON COLLECTION</span><span class="season-number">0'+(i+1)+'</span>'+(o.img?'<img src="'+esc(o.img)+'" alt="'+esc(o.name)+'完整套裝展示" width="240" height="240">':'<canvas width="64" height="64" data-outfit-preview="'+esc(o.id)+'"></canvas>')+'</div><div class="season-info"><h2>'+esc(o.name)+'</h2><p>'+(o.id==='season283_devil'?'暖金與紫色交織，藏一點小惡魔的俏皮。':o.id==='season283_valentine'?'粉色漸入深紫，把心動穿成今天的模樣。':'收藏完整造型，也能自由搭配喜歡的部件。')+'</p><div class="season-price"><strong>'+(o.previewOnly?'即將登場':esc(o.price))+(o.previewOnly?'':'<small>金幣／整套</small>')+'</strong><span>'+(o.owned?'已收藏':'當季完整套組')+'</span></div><div class="season-actions"><button class="ghost" data-try-outfit="'+esc(o.id)+'">試穿整套</button><button class="primary" data-buy-outfit="'+esc(o.id)+'" '+(o.owned||o.previewOnly?'disabled':'')+'>'+(o.owned?'已擁有':o.previewOnly?'敬請期待':'選購整套')+'</button></div></div></article>').join('')||'<p class="live-empty">目前沒有上架組合。</p>';
   $$('[data-try-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.tryOutfit);const next=outfitSelection(o),nextColor={hair:o.doll?.hair||0};try{api.makeDoll(next,nextColor);}catch(e){tell(e.message);return;}selection=next;color=nextColor;swatches();paint();tell('已試穿「'+o.name+'」');});
   $$('[data-buy-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.buyOutfit);if(!o.owned&&!o.previewOnly)buy(o.id);});
   $('#detail').innerHTML='<p>整套收藏，隨心搭配。購買後可在「我的背包」找到各部件；展示髮色可作為你的配色靈感。</p>';
  }
 }
 function buy(id){try{api.buy(id);}catch(e){tell(e.message);}}
 async function wear(){if(saving)return;saving=true;try{await api.wear(selection,color);data=api.state();tell('穿搭已保存，回到大廳也會穿著這一套。');}catch(e){tell(e.message);}finally{saving=false;}}
 /* v258:商城／背包做成同一個視窗裡的大分頁,不用關窗再開 */
 const areaNav=document.querySelector('.mode');areaNav.className='area-tabs';areaNav.setAttribute('aria-label','商城與背包');
 areaNav.innerHTML='<button data-area="store" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span><b>商城</b><small>SHOP</small></span></button><button data-area="bag" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2M9 13h6"/></svg><span><b>我的背包</b><small>BAG</small></span></button>';
 function syncOuter(a){try{const doc=parent.document;const w=doc.querySelector('#shopWindow');if(w)w.dataset.area=a;const t=doc.querySelector('#shopTitle');if(t){t.textContent=a==='bag'?'我的背包':'商城';t.dataset.text=t.textContent;}const sm=doc.querySelector('#shopWindow .window-head small');if(sm)sm.textContent=a==='bag'?'MY LITTLE ARCHIVE / 把喜歡的收藏好':'TAVERN BOUTIQUE / 選一份新的心情';const f=doc.querySelector('#shopFrame');if(f)f.dataset.liveArea=a;}catch(e){}}
 areaNav.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.area===area)return;init();setArea(b.dataset.area);syncOuter(b.dataset.area);});
 document.querySelector('.catalog-mode').hidden=true;
 $('#singlesMode').onclick=()=>{mode='singles';render();};$('#bundlesMode').onclick=()=>{mode='bundles';render();};
 $('#reset').onclick=()=>{init();render();tell('已還原目前穿搭');};
 $('#showWear').textContent='穿上搭配';$('#showWear').onclick=wear;

 $('#dyeDialog .dialog-card').innerHTML='<div class="dialog-head"><span class="eyebrow">YOUR HAIR COLOR</span><button id="closeDye" aria-label="關閉染髮">×</button></div><h2 id="dyeTitle">染一款，只屬於你的髮色。</h2><p>使用目前試穿的瀏海與後髮。預覽免費，保存組合才扣 1 張券。</p><div class="dye-workspace"><div class="dye-avatar"><canvas id="dyePreview" width="64" height="64" aria-label="染髮即時預覽"></canvas><span>即時預覽</span></div><div class="dye-controls"><label>組合名稱<input id="dyeName" maxlength="24" placeholder="專屬染髮"></label><label>主色<input id="dyeMain" type="color" aria-label="染髮主色"></label><label class="dye-gradient"><input id="dyeGradient" type="checkbox">加入髮尾漸層</label><label id="dyeTailLabel">髮尾色<input id="dyeTail" type="color" aria-label="染髮髮尾色"></label><label id="dyeHighlightLabel" hidden>挑染色<input id="dyeHighlight" type="color" aria-label="獨立挑染色"><small>只調整挑染髮絲，與主色、髮尾漸層分開。</small></label></div></div><div class="ticket-state" role="status"></div><p id="dyeError" role="alert" hidden></p><div class="dye-actions"><button id="cancelDye" class="ghost">取消</button><button id="buyDyeInDialog" class="primary buy" hidden>買一張染髮券</button><button id="saveDye" class="primary">使用 1 張並保存</button></div><p class="dye-note">主色、髮尾漸層與挑染一起保存只扣 1 張券。保存後可在「頭髮 → 我的染髮」重複穿戴，不再扣券。</p>';
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
  dyeDraft={name:$('#dyeName').value,main:$('#dyeMain').value,tail:$('#dyeGradient').checked?$('#dyeTail').value:$('#dyeMain').value,...(!$('#dyeHighlightLabel').hidden?{highlight:$('#dyeHighlight').value}:{})};
  $('#dyeTailLabel').hidden=!$('#dyeGradient').checked;dyeStatus();if(!previous||previous.main!==dyeDraft.main||previous.tail!==dyeDraft.tail||previous.highlight!==dyeDraft.highlight)requestPaint();
 }
 function openDye(preset){
  try{
   data=api.state();if(!data.loggedIn)throw Error('先登入自己的闆卡，再使用染髮');
   const d=api.makeDoll(selection,color);
   $('#dyeHighlightLabel').hidden=![selection.front,selection.back].some(r=>data.catalog.find(o=>o.id===r?.source)?.highlightHair);$('#dyeHighlight').value=d.hairHighlight||'#e5edf5';
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
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(orderDialog.open){closeDrinkOrder();return;}if(!$('#dyeDialog').hidden)closeDye();else api.close();}});
 let compactLayout=innerWidth<601;
 window.addEventListener('resize',()=>{const next=innerWidth<601;if(next!==compactLayout){compactLayout=next;render();}});
 init();render();[200,600,1400,3000].forEach(t=>setTimeout(paint,t));
 setInterval(()=>{if(!document.hidden&&api.isActive()&&parent.document.body.dataset.view==='shop'){const next=api.state();if(next.tickets!==data.tickets||JSON.stringify(next.catalog)!==JSON.stringify(data.catalog)||JSON.stringify(next.dyed)!==JSON.stringify(data.dyed)){data=next;render();if(!$('#dyeDialog').hidden)dyeStatus();}}},2000);
})();
