/* 時裝間正式資料介面；商品價格、持有狀態與穿戴都由主站驗證。 */
(() => {
 'use strict';
 const api=parent.parent.TinyTavernUI;if(!api)return;
 const mobile=!!parent.parent.TTMobile;
 if(mobile){const style=document.createElement('style');style.textContent='.area-tabs,#dyeTicket{display:none!important}';document.head.append(style);}
 const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories=[['hair','頭髮'],['cloth','衣服'],['acc','配件'],['eye','臉'],['pet','寵物'],['seat','座椅'],['other','飲品'],['bubbles','聊天氣泡']];
 const groupNames={head:'頭飾',ear:'耳環',face:'面部配件',hand:'手持物',back:'背飾／尾巴'};
 const wearGroups={bottom:'下身',outer:'外套',glove:'手套'};   // v441 拆出的衣服部件：資料上是配件，商城列在「衣服」
 const tabOf=p=>p.category==='acc'&&wearGroups[p.group]?'cloth':p.category;let clothFilter='all';
 let data,selection={},color={},area='store',category='bundles',mode='singles',filter='all',selected=null,saving=false;
 let drinkQuantity=1,drinkBusy=false,drinkDialogOpen=false;
 let hairSection='front',colorTarget='main',faceSection='brow';
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

 document.querySelector('.workspace').id='wardrobeWorkspace';
 const lookPanel=document.createElement('aside');lookPanel.id='lookSummary';lookPanel.hidden=true;lookPanel.setAttribute('aria-label','目前搭配清單');document.querySelector('.workspace').append(lookPanel);
 const lookDialog=document.createElement('dialog');lookDialog.className='look-checkout-dialog';lookDialog.setAttribute('aria-label','確認選購清單');document.body.append(lookDialog);
 let lookExpanded=false,pendingLook=null;
 const lookSlots={front:'瀏海',back:'後髮',cloth:'衣服',eye:'眼型',brow:'眉毛',pet:'寵物',acc:'配件'};
 function lookItems(state=data){
  const seen=new Set();
  return Object.entries(selection).flatMap(([slot,r])=>{
   if(!r||slot==='seat')return [];
   if(r.base!==undefined){const native=slot==='eye'?'face':slot,p=state.baseParts?.[native]?.items?.find(p=>p.idx===r.base);if(p)return p.n!=='無'&&!(slot==='acc'&&r.base===0)?[{slot,ref:r,name:api.displayPartName?.(p.n)||p.n||lookSlots[slot],owned:true,base:true,removable:slot==='acc'||r.base!==baseRef(slot)?.base}]:[];
    // v421 未持有的工房部件：整個購買單位（頭髮前後髮／眼睛眉毛）一起計價
    const unit=state.catalog.find(o=>o.baseUnit&&o.parts.some(q=>q.slot===slot&&q.base===r.base)),part=unit?.parts.find(q=>q.slot===slot&&q.base===r.base);if(!unit)return [];
    const dup=seen.has(unit.id);seen.add(unit.id);return [{slot,ref:r,name:part.name,product:unit,part:{...part,saleId:null},dup,owned:!!unit.owned||!!part.owned,removable:true}];}
   const product=state.catalog.find(o=>o.id===r.source),part=product?.parts.find(p=>p.slot===r.slot);if(!part||product.drink)return [];
   const dup=!!part.saleId&&seen.has(part.saleId);if(part.saleId)seen.add(part.saleId);return [{slot,ref:r,name:part.name,product,part,dup,owned:product.owned||!!part.owned,removable:true}];
  });
 }
 function lookQuote(items){
  // v405：部件可單買；同套已選部件合計不低於整套價時改買整套。持有整套或該部件者不計價。
  const by=new Map();
  for(const it of items){if(!it.product||it.owned)continue;const o=it.product;if(!by.has(o.id))by.set(o.id,{o,units:new Map(),whole:false});const e=by.get(o.id);if(it.part?.saleId)e.units.set(it.part.saleId,it.part);else e.whole=true;}
  const ready=[],unavailable=[];
  for(const {o,units,whole} of by.values()){
   const setOk=o.sale&&!o.previewOnly&&Number.isSafeInteger(Number(o.price))&&Number(o.price)>=0,parts=[...units.values()],partsOk=!whole&&parts.length>0&&parts.every(p=>Number.isSafeInteger(p.salePrice)&&p.salePrice>0);
   const sum=partsOk?parts.reduce((n,p)=>n+p.salePrice,0):Infinity;
   if(partsOk&&(!setOk||sum<Number(o.price)))parts.forEach(p=>ready.push({id:p.saleId,name:o.name+'・'+p.saleLabel,price:p.salePrice,unit:'part'}));
   else if(setOk)ready.push({id:o.id,name:o.name,price:Number(o.price),unit:o.pet?'pet':'set'});
   else unavailable.push(o);
  }
  return {ready,unavailable,total:ready.reduce((n,x)=>n+x.price,0)};
 }
 function removeLook(slot){
  if(saving)return;
  const item=lookItems().find(p=>p.slot===slot);if(!item?.removable)return;
  let next={...selection,[slot]:['front','back','cloth','eye','brow'].includes(slot)?baseRef(slot):null};
  next=api.normalizeSelection?.(next)||next;
  const nextColor=['front','back'].includes(slot)&&color.savedId?{hair:data.doll.hair||0}:color;
  try{api.makeDoll(next,nextColor);}catch(e){tell(e.message);return;}
  selected=null;
  if(area==='bag')return saveBag(next,nextColor,'已卸下「'+item.name+'」。');
  selection=next;color=nextColor;render();
 }
 function paintLook(){
  const items=lookItems();lookPanel.querySelectorAll('[data-look-thumb]').forEach(cv=>{const p=items.find(p=>p.slot===cv.dataset.lookThumb);if(p)api.drawPart(cv,p.ref,color);});
 }
 function renderLook(){
  const visible=bagSection!=='collection'&&!['other','seat','dye','bubbles'].includes(category);
  lookPanel.hidden=!visible;document.body.classList.toggle('has-look-summary',visible);
  if(!visible)return;
  const items=lookItems(),q=lookQuote(items),scroll=lookPanel.querySelector('.look-items')?.scrollTop||0;
  lookPanel.classList.toggle('is-expanded',lookExpanded);
  lookPanel.innerHTML='<header><div><small>YOUR LOOK</small><h3>目前搭配 <span>'+items.length+'</span></h3></div><button class="look-expand" type="button" aria-expanded="'+lookExpanded+'" aria-label="展開或收合目前搭配">'+(lookExpanded?'收合':'展開')+'</button></header><div class="look-items">'+items.map(p=>'<article class="look-item"><canvas width="64" height="64" data-look-thumb="'+esc(p.slot)+'" aria-label="'+esc(p.name)+'"></canvas><div><strong>'+esc(p.name)+'</strong><small data-state="'+(p.base?'base':p.owned?'owned':q.unavailable.includes(p.product)?'soon':'price')+'">'+(p.base?'基本款':p.owned?'已擁有':q.unavailable.includes(p.product)?'尚未開賣':p.part?.salePrice?(p.dup?'與同組一起計價':'單買 '+esc(p.part.salePrice)+' 金幣'):p.product.baseUnit?(p.dup?'與同組一起計價':'單買 '+esc(p.product.price)+' 金幣'):(p.product.pet?'單隻 ':'整套 ')+esc(p.product.price)+' 金幣')+'</small></div><button type="button" class="look-remove" data-look-remove="'+esc(p.slot)+'" aria-label="移除'+esc(p.name)+'" '+(!p.removable||saving?'disabled':'')+' title="'+(p.removable?'移除此部件':'目前為基本款')+'">−</button></article>').join('')+'</div><footer><div class="look-total"><span>'+(area==='bag'?'需購買金額':q.unavailable.length?'可購買部分小計':'需購買金額')+'</span><strong>'+q.total.toLocaleString()+'<small> 金幣</small></strong></div><p class="look-pricing">'+(q.ready.length?'單買或整套自動選划算的 · 已擁有不計價':'目前搭配的已擁有部件不計價')+'</p>'+(q.unavailable.length?'<p class="look-unavailable">另有 '+q.unavailable.length+' 套尚未開賣，未計入金額</p>':'')+(area==='store'?'<button type="button" class="primary look-checkout" '+(!q.ready.length?'disabled':'')+'>'+(q.ready.length?'確認選購 · '+q.ready.length+' 項':q.unavailable.length?'等待開賣':'已全部擁有')+'</button>':'')+'</footer>';
  lookPanel.querySelector('.look-expand').onclick=()=>{lookExpanded=!lookExpanded;renderLook();};
  lookPanel.querySelectorAll('[data-look-remove]').forEach(b=>b.onclick=()=>removeLook(b.dataset.lookRemove));
  lookPanel.querySelector('.look-checkout')?.addEventListener('click',openLookCheckout);
  lookPanel.querySelector('.look-items').scrollTop=scroll;paintLook();
 }
 function openLookCheckout(){
  data=api.state();const q=lookQuote(lookItems());renderLook();
  lookDialog.innerHTML='<header><div><small>YOUR SELECTION</small><h2>確認選購</h2></div><button type="button" class="look-close" aria-label="關閉選購清單">×</button></header><p>部件可以單買；同一套選的部件合計比整套貴時，會自動改成買整套。每項會分別進入結帳確認。</p><div class="look-purchases">'+q.ready.map(o=>'<article><div><strong>'+esc(o.name)+'</strong><span>'+Number(o.price).toLocaleString()+' 金幣'+(o.unit==='pet'?'／隻':o.unit==='part'?'／單件':'／整套')+'</span></div><button class="primary" type="button" data-look-buy="'+esc(o.id)+'">前往結帳</button></article>').join('')+'</div>'+(q.unavailable.length?'<p class="look-unavailable">尚未開賣：'+q.unavailable.map(o=>esc(o.name)).join('、')+'</p>':'')+'<footer><span>需購買金額</span><strong>'+q.total.toLocaleString()+' 金幣</strong></footer>';
  lookDialog.querySelector('.look-close').onclick=()=>lookDialog.close();
  lookDialog.querySelectorAll('[data-look-buy]').forEach(b=>b.onclick=()=>{
   const id=b.dataset.lookBuy,fresh=api.state(),current=lookQuote(lookItems(fresh)).ready.find(o=>o.id===id),shown=q.ready.find(o=>o.id===id);
   if(!current||current.price!==shown.price){data=fresh;openLookCheckout();tell('商品資訊已更新，請重新確認。');return;}
   pendingLook=JSON.parse(JSON.stringify({selection,color}));
   try{api.buy(id);lookDialog.close();}catch(e){pendingLook=null;tell(e.message);}
  });
  if(!lookDialog.open)lookDialog.showModal();
 }
 const ref=p=>p.base!==undefined?{base:p.base,slot:p.slot}:{source:p.source,slot:p.slot};
 const key=p=>p.category==='acc'?(p.base!==undefined?'acc':(api.accessoryKey?.(p)||'accessory:'+p.group)):p.slot;
 function isTrying(p){
  if(p.product?.drink)return false;
  if(p.parts)return p.parts.every(isTrying);
  const r=selection[key(p)];
  if(r?.base===0&&p.source==='cloth0'&&['back','front','eye','cloth'].includes(p.slot)&&r.slot===p.slot)return true;
  return !!r&&r.slot===p.slot&&(p.base!==undefined?r.base===p.base:r.source===p.source);
 }
 function tell(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(tell.timer);tell.timer=setTimeout(()=>$('#toast').hidden=true,3500);}
 function baseRef(slot,index=0){const native=slot==='eye'?'face':slot,opts=data.baseParts?.[native]?.items;if(!opts)return {base:index,slot};const p=opts.find(p=>p.idx===index)||opts[0];return p?{base:p.idx,slot}:null;}
 function selectionFromDoll(d){
  const next={};
  for(const [sl,native] of [['front','front'],['back','back'],['cloth','cloth'],['eye','face'],['brow','brow'],['pet','pet'],['seat','seat']]){
   const source=d.uiBaseSlots?.includes(sl)?null:(d.ps?.[sl]||d.set);
   const custom=source&&data.catalog.some(o=>o.id===source&&!o.retired&&!o.drink&&o.parts.some(p=>p.slot===sl));
   next[sl]=custom?{source,slot:sl}:['pet','seat'].includes(sl)?null:baseRef(sl,d[native]||0);
  }
  const accessories=d.uiAccessories||data.catalog.find(o=>o.id===d.set)?.parts.filter(p=>p.category==='acc')||Object.entries(d.ps||{}).filter(([k])=>/^acc\d*$/.test(k)).map(([slot,source])=>({source,slot}));
  (api.expandAccessories?.(accessories,d)||accessories).forEach(r=>{const p=data.catalog.find(o=>o.id===r.source&&!o.retired)?.parts.find(p=>p.slot===r.slot);if(p)next[key(p)]=ref(p);});
  if(Number.isInteger(d.acc)&&d.acc>0&&(data.baseParts?.acc?.items||[]).some(x=>x.idx===d.acc))next.acc={base:d.acc,slot:'acc'};   // v421 工房配件（花箋蝴蝶結）
  return api.normalizeSelection?.(next)||next;
 }
 function init(){
  void api.refreshDrinks?.().then(()=>{data=api.state();render()}).catch(e=>tell(e.message));
  dyeDraft=null;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;
  data=api.state();const d=data.doll;selection=selectionFromDoll(d);
  const saved=d.dyedHairSet&&data.dyed[d.dyedHairSet];
  if(saved){selection.front={...saved.front};selection.back={...saved.back};}
  const highlight=data.colors.findIndex(c=>c.toLowerCase()===d.hairHighlight?.toLowerCase());
  color=saved?{savedId:d.dyedHairSet}:{hair:d.hair||0,keepOriginal:true,...(highlight>=0?{highlight}:{})};colorTarget='main';selected=null;
  if(pendingLook){const savedLook=pendingLook;pendingLook=null;try{api.makeDoll(savedLook.selection,savedLook.color);selection=savedLook.selection;color=savedLook.color;}catch{}}
 }
 function outfitSelection(o){const next=selectionFromDoll(o.doll||{});o.parts.filter(p=>p.defaultEquipped!==false).forEach(p=>next[key(p)]=ref(p));return next;}
 const entryOwned=p=>p.product?.drink?!!p.product.owned:p.parts?p.parts.every(q=>p.product.owned||q.owned):!!(p.product?.owned||p.owned);
 const entryPrice=p=>p.parts?p.parts[0]?.salePrice:p.salePrice;
 function products(){return data.catalog.filter(o=>!o.retired&&(area==='bag'?!o.baseUnit&&(o.owned||o.parts.some(p=>p.owned)):o.sale));}
 function entries(){
  const out=[];
  for(const o of products()){
   const parts=o.parts.filter(p=>tabOf(p)===category&&(category!=='eye'||p.slot===faceSection)&&(area!=='bag'||category!=='hair'||p.slot===hairSection)&&(area!=='bag'||o.owned||p.owned));
   if(category==='hair'&&area==='store'){
    if(parts.length)out.push({id:o.id+'::hair',name:o.name+'・髮型',category:'hair',parts,product:o});
   }else for(const p of parts)if((category!=='acc'||filter==='all'||filter===p.group)&&(category!=='cloth'||clothFilter==='all'||clothFilter===(wearGroups[p.group]?p.group:'main')))out.push({...p,product:o});
  }
  if(area==='bag')for(const [native,v] of Object.entries(data.baseParts)){
   const sl=({face:'eye'}[native]||native),cat=({front:'hair',back:'hair',cloth:'cloth',eye:'eye',brow:'eye',acc:'acc'}[sl]);if(cat!==category||(cat==='cloth'&&clothFilter!=='all'&&clothFilter!=='main')||(cat==='eye'&&sl!==faceSection)||(cat==='hair'&&sl!==hairSection)||(cat==='acc'&&filter!=='all'&&filter!=='head'))continue;
   for(const p of v.items||[]){
    // 露亞原有髮型、眼睛、衣服與露亞組合重複，保留組合中的命名；舊穿搭編號仍相容。
    if(p.idx===0&&['back','front','eye','cloth'].includes(sl)&&out.some(q=>q.source==='cloth0'&&q.slot===sl))continue;
    if(sl==='acc'&&p.idx===0)continue;
    out.push({id:'base::'+sl+'::'+p.idx,slot:sl,base:p.idx,name:api.displayPartName?.(p.n)||p.n,category:cat,group:sl==='acc'?'head':undefined,product:{owned:true,name:'原有部件'}});
   }
  }
  return out;
 }
 async function saveBag(next,nextColor,message){
  if(saving)return;const before=selection,beforeColor=color;saving=true;
  // v420：畫面重畫出錯也不能讓 saving 卡住（原本 render 在 try 外，丟錯後按鈕全部失效）
  try{selection=next;color=nextColor;try{render();}catch(e){console.warn(e);}
   await api.wear(next,nextColor);data=api.state();tell(message||'已保存穿搭。');}
  catch(e){selection=before;color=beforeColor;tell('未能保存：'+e.message);}
  finally{saving=false;try{render();}catch(e){console.warn(e);}}
 }
 function tryItem(p){
  if(!p||saving)return;
  if(p.product?.drink){selected=p.id;drinkQuantity=1;render();return;}
  let next={...selection};const nextColor=p.category==='hair'?{hair:color.hair??data.doll.hair??0,...(Number.isInteger(color.highlight)?{highlight:color.highlight}:{})}:color;
  const removing=(area==='bag'||['acc','pet','seat','other'].includes(p.category))&&isTrying(p);
  if(removing)next[key(p)]=['front','back','cloth','eye','brow'].includes(p.slot)?baseRef(p.slot):null;
  else if(p.parts)p.parts.forEach(q=>next[key(q)]=ref(q));else next[key(p)]=ref(p);
  if(!removing&&p.category==='acc'&&api.compatible?.(p,next)===false){tell(p.requirement||'請先穿戴對應部件');return;}
  const normalized=api.normalizeSelection?.(next)||next;
  const removedDependency=Object.keys(next).some(k=>next[k]&&normalized[k]===null);next=normalized;
  try{api.makeDoll(next,nextColor);}catch(e){tell(e.message);return;}
  if(area==='bag'){selected=p.id;if(p.category==='hair')dyeDraft=null;return saveBag(next,nextColor,removing?'已卸下「'+p.name+'」'+(['front','back','cloth','eye','brow'].includes(p.slot)?'，恢復原有部件。':'。'):'已穿上「'+p.name+'」。');}
  selection=next;color=nextColor;if(p.category==='hair')dyeDraft=null;
  selected=p.id;render();
  if(removing)tell('已卸下「'+p.name+'」；完成後按「穿上搭配」保存。');
  else if(removedDependency)tell('已卸下不適用於目前搭配的配件。');
 }
 function drawPart(cv,p){
  if(p.parts){const c=cv.getContext('2d');c.clearRect(0,0,64,64);for(const slot of ['back','front']){const q=p.parts.find(x=>x.slot===slot);if(!q)continue;const tmp=document.createElement('canvas');tmp.width=tmp.height=64;api.drawPart(tmp,ref(q),color);c.drawImage(tmp,0,0);}}
  else api.drawPart(cv,ref(p),color);
 }
 let paintFrame=0;
 function requestPaint(){if(paintFrame)return;paintFrame=requestAnimationFrame(()=>{paintFrame=0;paint();});}
 let previewPet=null;
 const previewStage=$('#avatar').parentElement;
 let previewSource=null,previewFoot=1;
 const previewTexture=document.createElement('canvas');
 $('#avatar').dataset.fixedPixelPreview='1';
 function fitPreviewParty(){
  const party=$('#wardrobeParty'),avatar=$('#avatar'),img=$('#wardrobePet'),pet=previewPet;
  if(!party||!pet||!previewSource||!img?.naturalWidth||!previewStage.clientWidth||!previewStage.clientHeight)return;
  const {reference,size,x,y}=pet.layout,unit=reference/previewSource.width;
  const pixels=previewSource.getContext('2d').getImageData(0,0,previewSource.width,previewSource.height).data;
  let left=previewSource.width,top=previewSource.height,right=0,bottom=0;
  for(let cy=0;cy<previewSource.height;cy++)for(let cx=0;cx<previewSource.width;cx++)if(pixels[(cy*previewSource.width+cx)*4+3]>0){left=Math.min(left,cx);top=Math.min(top,cy);right=Math.max(right,cx+1);bottom=Math.max(bottom,cy+1);}
  if(!bottom)return;
  const foot=previewFoot*reference,petHeight=size*112/96;
  // Keep the same 160px reference and foot-relative placement as the adjustment page.
  Object.assign(avatar.style,{left:-reference/2+'px',top:-foot+'px'});
  Object.assign(img.style,{width:size+'px',height:petHeight+'px',left:x-size/2+'px',top:y-petHeight+'px'});
  const imageScale=Math.min(size/img.naturalWidth,petHeight/img.naturalHeight);
  const imageX=x-img.naturalWidth*imageScale/2,imageY=y-petHeight+(petHeight-img.naturalHeight*imageScale)/2;
  const bounds=pet.bounds||[0,0,img.naturalWidth,img.naturalHeight];
  const minX=Math.min((left-previewSource.width/2)*unit,imageX+bounds[0]*imageScale),maxX=Math.max((right-previewSource.width/2)*unit,imageX+bounds[2]*imageScale);
  const minY=Math.min(top*unit-foot,imageY+bounds[1]*imageScale),maxY=Math.max(0,imageY+bounds[3]*imageScale);
  const width=previewStage.clientWidth,height=previewStage.clientHeight;
  const compact=height<190,footMargin=compact?16:36;
  const availableWidth=Math.max(1,width-28),availableHeight=Math.max(1,height-(compact?30:76));
  const scale=Math.min(1.25,availableWidth/(maxX-minX),availableHeight/(maxY-minY));
  const originX=(width-(maxX-minX)*scale)/2-minX*scale,originY=height-footMargin-maxY*scale;
  party.style.transform='translate('+originX+'px,'+originY+'px) scale('+scale+')';
 }
 function setPreviewPet(pet){
  const avatar=$('#avatar');let party=$('#wardrobeParty');previewPet=pet;
  previewStage.classList.toggle('has-following-pet',!!pet);
  if(!pet){if(party){party.before(avatar);party.remove();avatar.style.removeProperty('left');avatar.style.removeProperty('top');}return;}
  if(!party){party=document.createElement('div');party.id='wardrobeParty';avatar.before(party);party.append(avatar);const img=document.createElement('img');img.id='wardrobePet';img.onload=fitPreviewParty;party.append(img);}
  const img=$('#wardrobePet');if(img.dataset.pet!==pet.id){img.src='../'+pet.src;img.alt=pet.name;img.dataset.pet=pet.id;}
 }
 const previewFitObserver=new ResizeObserver(fitPreviewParty);previewFitObserver.observe(previewStage);
 function groundPreview(source){
  previewSource=source;previewFoot=api.previewFoot(source);const cv=$('#avatar');cv.style.setProperty('--preview-foot',(100*previewFoot)+'%');previewTexture.width=0;fitPreviewParty();drawPreviewIdle();
 }
 function drawPreviewIdle(){
  if(!previewSource)return;
  const cv=$('#avatar'),box=cv.getBoundingClientRect(),dpr=window.top.devicePixelRatio||1;
  // The outer desktop viewport also scales its iframe. Use physical screen pixels
  // for the fixed surface; nearest-neighbour expansion happens only once.
  let parentScale=1;for(let win=window;win!==win.parent;win=win.parent){const frame=win.frameElement;if(frame?.offsetWidth)parentScale*=frame.getBoundingClientRect().width/frame.offsetWidth;}
  const width=Math.max(1,Math.round(box.width*parentScale*dpr)),height=Math.max(1,Math.round(box.height*parentScale*dpr));
  if(cv.width!==width||cv.height!==height){cv.width=width;cv.height=height;}
  const textureScale=Math.max(8,Math.ceil(Math.max(width,height)*1.031/64)),textureSize=64*textureScale;
  if(previewTexture.width!==textureSize){previewTexture.width=previewTexture.height=textureSize;const t=previewTexture.getContext('2d');t.imageSmoothingEnabled=false;t.drawImage(previewSource,0,0,textureSize,textureSize);}
  const motionOff=document.body.classList.contains('motion-off')||parent.document.body.classList.contains('motion-off');
  const pose=motionOff?{sqx:1,sqy:1}:api.idlePose(),g=cv.getContext('2d'),foot=height*previewFoot;
  g.clearRect(0,0,width,height);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='low';
  g.drawImage(previewTexture,width*(1-pose.sqx)/2,foot*(1-pose.sqy),width*pose.sqx,height*pose.sqy);
  cv.dataset.idleScale=pose.sqx+' '+pose.sqy;
 }
 function animatePreviewIdle(){
  if(!document.hidden&&api.isActive())drawPreviewIdle();
  requestAnimationFrame(animatePreviewIdle);
 }
 requestAnimationFrame(animatePreviewIdle);
 function paint(){
  renderLook();
  const dyeVisible=!!dyeDraft&&!$('#dyeDialog').hidden;
  try{const d=api.makeDoll(selection,color);if(dyeVisible){d.hairHex=dyeDraft.main;d.hairHex2=dyeDraft.tail;if(dyeDraft.highlight)d.hairHighlight=dyeDraft.highlight;api.draw($('#dyePreview'),d);}setPreviewPet(api.followingPet?.(d));api.draw($('#avatar'),d,groundPreview);}catch(e){tell(e.message);}
  // 訂製試色同時更新固定試穿區，商品縮圖不需每次重畫。
  if(dyeVisible)return;
  const list=entries();$$('#singles:not([hidden]) [data-preview]').forEach(cv=>{const p=list.find(p=>p.id===cv.dataset.preview);if(p)drawPart(cv,p);});
  $$('#bundles:not([hidden]) [data-outfit-preview]').forEach(cv=>{const o=data.catalog.find(o=>o.id===cv.dataset.outfitPreview);if(o)api.draw(cv,seasonShowDoll(o,api.makeDoll(outfitSelection(o),{hair:o.doll?.hair||0})));});
  $$('#bundles:not([hidden]) [data-dyed-preview]').forEach(cv=>{const s=data.dyed[cv.dataset.dyedPreview];if(!s)return;try{api.draw(cv,api.makeDoll(api.normalizeSelection({...selection,front:s.front,back:s.back}),{savedId:cv.dataset.dyedPreview}));}catch(e){try{api.draw(cv,dyedFallbackDoll(s));}catch(_){}}});
 }
 const companionStyle=document.createElement('style');companionStyle.textContent='body[data-shop-category=other] #grid .item{min-height:220px;grid-template-rows:14px minmax(145px,1fr) 36px}body[data-shop-category=other] #grid{grid-auto-rows:minmax(220px,auto)} .thumb:has(.drink-product-image){position:relative;overflow:hidden}.thumb .drink-product-image{width:100%;height:100%;object-fit:contain;image-rendering:auto;position:absolute;inset:0;display:block} .drink-companions{display:flex;justify-content:center;align-items:end;gap:20px;margin:12px 0}.drink-companions figure{margin:0;text-align:center}.drink-companions img{display:block;object-fit:contain;image-rendering:pixelated;width:100px;height:114px}.drink-companions .drink-pet{width:80px;height:104px}.drink-companions figcaption{font-size:12px;margin-top:4px}#detail:has(.drink-companions){display:grid!important;grid-template-columns:minmax(0,1fr);height:auto!important;min-height:0;gap:8px}#detail>.drink-companions{grid-row:2;margin:0}#detail:has(.drink-companions)>.actions{display:flex!important;flex-wrap:wrap;justify-content:center;gap:10px;min-width:0;max-width:100%;grid-row:3}#detail:has(.drink-companions) .primary{max-width:100%;white-space:normal}';document.head.append(companionStyle);const carouselStyle=document.createElement('style');carouselStyle.textContent="\nbody[data-shop-category=other] .workspace{grid-template-columns:minmax(0,1fr)!important}body[data-shop-category=other] #catalog{grid-column:1/-1!important;width:100%} .drink-heading .drink-unit-price{display:block!important;text-align:center!important}body[data-shop-category=other] #grid,body[data-shop-category=other] #pager,body[data-shop-category=other] #bundlePager{display:none!important}\nbody[data-shop-category=other] #detail{display:flex!important;flex-direction:column;padding:0 0 24px;gap:14px;overflow:hidden;border-radius:24px;background:linear-gradient(145deg,#fffcf6,#f5e2e6);min-width:0}\nbody[data-shop-category=other] #detail>div:first-of-type{display:none}\nbody[data-shop-category=other] #detail>.actions{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:16px;padding:0 16px}\n.drink-carousel{width:100%;min-width:0}.drink-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;touch-action:pan-x pan-y}.drink-track::-webkit-scrollbar{display:none}\n.drink-slide{flex:0 0 100%;min-width:0;scroll-snap-align:center;scroll-snap-stop:always;text-align:center;padding:22px 16px 0;box-sizing:border-box}\n.drink-heading small{font-size:10px;letter-spacing:2px;color:#ae7d80}.drink-heading h2{font-size:26px;margin:8px 0}.drink-heading .drink-unit-price{font-size:13px;margin:0;color:#9d7373}\n.drink-scene{display:flex;align-items:center;justify-content:center;gap:14px;min-height:250px;position:relative}.drink-center{width:240px;height:240px;max-width:50%;position:relative;display:grid;place-items:center}.drink-center:before{content:\"\";position:absolute;inset:15%;border-radius:50%;background:#fff9f3;box-shadow:0 0 55px #fff9f3}.drink-center img{position:relative;width:100%;height:100%;object-fit:contain}\n.drink-friend{object-fit:contain;image-rendering:pixelated;width:72px;height:82px;flex-shrink:0;align-self:flex-end;margin-bottom:44px}.drink-friend.pet{width:58px;height:76px;transform:scaleX(-1)}\n.drink-navigation{display:flex;justify-content:center;align-items:center;gap:24px;padding:0 16px 8px}.drink-navigation>button{width:36px;height:36px;border-radius:50%;font-size:19px}.drink-dots{display:flex;gap:10px}.drink-dots button{width:9px;height:9px;padding:0;border-radius:50%;background:#dfc7c7;border:0}.drink-dots button[aria-current=true]{background:#9c606b;box-shadow:0 0 0 4px #9c606b15}\n@media(max-width:600px){.drink-slide{padding:20px 8px 0}.drink-scene{gap:4px;min-height:208px}.drink-center{width:190px;height:190px;max-width:60%}.drink-friend{width:48px;height:58px;margin-bottom:34px}.drink-friend.pet{width:42px;height:56px}.drink-heading h2{font-size:23px}}\n";document.head.append(carouselStyle);
 function companionArt(product){const info=product?.companion;if(!info||!['rira','kabuki','momo'].includes(info.asset))return document.createElement('span');const row=document.createElement('div');row.className='drink-companions';for(const role of ['staff','pet']){const figure=document.createElement('figure'),img=document.createElement('img'),label=document.createElement('figcaption');img.src='../img/companions-v352/'+info.asset+'-'+role+'.gif?v=356';img.alt=role==='staff'?info.name:info.name+'的寵物';if(role==='pet')img.className='drink-pet';label.textContent=role==='staff'?info.name:'寵物';figure.append(img,label);row.append(figure)}return row;}

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
  if(!orderDialog.open)orderDialog.showModal();orderDialog.querySelector('.dynamic-drink-card')?.classList.add('is-playing');window.TTDrinkCard.mount(orderDialog);
  if(focused&&orderDialog.querySelector('#'+focused))orderDialog.querySelector('#'+focused).focus({preventScroll:true});else orderDialog.querySelector('.order-close')?.focus({preventScroll:true});orderDialog.scrollTop=wasOpen?oldScroll:0;
 }

 // Preserve the approved design coordinates. Container units scale the card;
 // fitting the artwork bounds again would move and shrink the saved composition.
 function drinkCarousel(list,p){
  const wrap=document.createElement('section');wrap.className='drink-carousel';wrap.setAttribute('aria-label','選擇飲料');
  const index=Math.max(0,list.findIndex(x=>x.id===p.id));
  wrap.innerHTML='<div class="drink-track" tabindex="0" aria-label="左右滑動選擇飲料">'+list.map((entry,i)=>{const o=entry.product,a=o.companion,tone=a?.asset||'rira';return '<article class="drink-slide '+(i===index?'is-current':'')+'" data-tone="'+esc(tone)+'" aria-label="'+esc(entry.name)+'">'+window.TTDrinkCard.markup({tone,name:a?.name||entry.name.replace(/的飲料$/,''),drink:o.img,staff:'../img/companions-v352/'+tone+'-staff.gif',pet:'../img/companions-v352/'+tone+'-pet.gif?v=356',layout:window.TTDrinkLayout[tone]},i)+'</article>'}).join('')+'</div><nav class="drink-navigation" aria-label="切換飲料"><button type="button" class="drink-prev" aria-label="上一款飲料">←</button><div class="drink-dots">'+list.map((entry,i)=>'<button type="button" data-drink-index="'+i+'" aria-label="'+esc(entry.name)+'" aria-current="'+(i===index)+'"></button>').join('')+'</div><button type="button" class="drink-next" aria-label="下一款飲料">→</button></nav>';

  const track=wrap.querySelector('.drink-track');let ready=false,drag=null,touching=false;const slides=[...track.children];const offset=i=>slides[i].offsetLeft-track.offsetLeft-(track.clientWidth-slides[i].offsetWidth)/2;const nearest=()=>slides.reduce((best,el,i)=>Math.abs(offset(i)-track.scrollLeft)<Math.abs(offset(best)-track.scrollLeft)?i:best,0);
  const fits=()=>track.scrollWidth<=track.clientWidth+2;
  const choose=i=>{if(drinkBusy)return;i=(i+list.length)%list.length;if(list[i].id===selected)return;if(fits()){selected=list[i].id;drinkQuantity=1;render();return;}['drinkSubmit','drinkPlus','drinkMinus'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=true});track.scrollTo({left:offset(i),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  wrap.querySelector('.drink-prev').onclick=()=>choose(index-1);wrap.querySelector('.drink-next').onclick=()=>choose(index+1);
  wrap.querySelectorAll('[data-drink-index]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.drinkIndex)));
  wrap.querySelectorAll('button').forEach(b=>b.disabled=drinkBusy||list.length<2);
  track.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();choose(index+(e.key==='ArrowRight'?1:-1));}};
  track.onscroll=()=>{if(touching)track.suppressClick=true;if(!ready||drinkBusy||drag||touching||fits())return;const i=nearest();slides.forEach((el,n)=>el.classList.toggle('is-current',n===i));clearTimeout(track.timer);track.timer=setTimeout(()=>{if(!track.isConnected)return;const n=nearest();if(list[n].id!==selected){selected=list[n].id;drinkQuantity=1;render();}},180);};
  track.querySelectorAll('img').forEach(img=>img.draggable=false);
  track.onpointerdown=e=>{if(drinkBusy)return;track.suppressClick=false;if(fits())return;if(e.pointerType==='touch'){touching=true;clearTimeout(track.timer);return;}if(e.button!==0)return;clearTimeout(track.timer);drag={x:e.clientX,start:track.scrollLeft};track.classList.add('dragging');};
  track.onpointermove=e=>{if(!drag)return;if(Math.abs(e.clientX-drag.x)>8){track.suppressClick=true;track.setPointerCapture(e.pointerId);}track.scrollLeft=drag.start+drag.x-e.clientX;};
  const endDrag=()=>{if(touching){touching=false;track.onscroll();return;}if(!drag)return;drag=null;track.classList.remove('dragging');track.scrollTo({left:offset(nearest()),behavior:'smooth'});track.onscroll();};
  track.onpointerup=endDrag;track.onpointercancel=endDrag;
  slides.forEach((slide,i)=>{slide.tabIndex=0;slide.setAttribute('role','button');slide.setAttribute('aria-label',list[i].name+'，選擇杯數');const open=()=>{if(drinkBusy||track.suppressClick)return;selected=list[i].id;drinkQuantity=1;drinkDialogOpen=true;render()};slide.onclick=open;slide.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();open()}};});
  requestAnimationFrame(()=>{track.scrollLeft=offset(index);wrap.querySelector('.is-current .dynamic-drink-card')?.classList.add('is-playing');window.TTDrinkCard.mount(wrap);requestAnimationFrame(()=>ready=true);});return wrap;
 }
 const drinkDesign=document.createElement('link');drinkDesign.rel='stylesheet';drinkDesign.href='drink-cards.css?v=380';document.head.append(drinkDesign);for(const href of ['drink-art-card.css?v=404','drink-showcase-live.css?v=406']){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
 function showDrinkDialogue(result,product){
  let dialog=document.getElementById('drinkDialogue');if(!dialog){dialog=document.createElement('dialog');dialog.id='drinkDialogue';dialog.style.cssText='max-width:420px;width:calc(100% - 48px);border:2px solid #cab5d9;border-radius:18px;background:#fff8fb;color:#614461;padding:24px;box-shadow:0 12px 48px #55334c55';document.body.append(dialog);}
  dialog.replaceChildren();const msg=document.createElement('p');msg.style.cssText='font-size:18px;line-height:1.8;white-space:pre-wrap';msg.textContent=result.message;const done=document.createElement('button');done.className='primary';done.textContent='關閉';done.onclick=()=>dialog.close();dialog.append(companionArt(product),msg,done);dialog.showModal();
 }
 function setArea(next){drinkDialogOpen=false;orderDialog.close();drinkQuantity=1;area=mobile||next==='bag'?'bag':'store';bagSection='wear';category=area==='store'?'bundles':'hair';hairSection='front';selected=null;filter='all';mode='singles';render();}
 window.ttDyeShop=()=>{if(area!=='store'){init();setArea('store');syncOuter('store');}category='dye';render();};
 function swatches(){
  const preset=[0,2,3,4,5,6,7,1,9].filter(i=>data.colors[i]);
  const hasHighlight=[selection.front,selection.back].some(r=>data.catalog.find(o=>o.id===r?.source)?.highlightHair);
  if(!hasHighlight)colorTarget='main';
  const highlight=colorTarget==='highlight',label=highlight?'挑染':'主色',selectedColor=highlight?color.highlight:color.hair;
  const targets=hasHighlight?'<div class="hair-color-targets" role="group" aria-label="換色部位">'+[['main','主色'],['highlight','挑染']].map(([id,name])=>'<button type="button" data-color-target="'+id+'" aria-pressed="'+(colorTarget===id)+'">'+name+'</button>').join('')+'</div>':'<strong>主色</strong>';
  $('#dyePanel').innerHTML='<div class="dye-head">'+targets+'<span>'+(color.savedId?'已保存髮色':'即時試色')+'</span></div><div class="swatches">'+preset.map(i=>'<button data-color="'+i+'" aria-label="試穿'+label+' '+(i+1)+'" style="--swatch:'+data.colors[i]+'" aria-pressed="'+(selectedColor===i)+'" '+(color.savedId?'disabled':'')+'></button>').join('')+'</div>';
  /* v440: 背包可隨時換膚色（建卡後也能改），選了立即保存 */
  if(area==='bag'&&Array.isArray(data.skins)&&data.skins.length){const cur=Number.isInteger(color.skin)?color.skin:(data.doll?.skin||0);
   $('#dyePanel').insertAdjacentHTML('beforeend','<div class="dye-head" style="margin-top:10px"><strong>膚色</strong><span>選了就會保存</span></div><div class="swatches skin-swatches">'+data.skins.map((c,i)=>'<button data-skin="'+i+'" aria-label="膚色 '+(i+1)+'" style="--swatch:'+c+'" aria-pressed="'+(cur===i)+'"></button>').join('')+'</div>');
   $$('[data-skin]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.skin);if(i===cur)return;saveBag(selection,{...color,skin:i},'已保存膚色。');});}
  $$('[data-color-target]').forEach(b=>b.onclick=()=>{colorTarget=b.dataset.colorTarget;swatches();});
  $$('[data-color]').forEach(b=>b.onclick=()=>{const index=Number(b.dataset.color),nextColor=highlight?{...color,highlight:index}:{...color,hair:index,keepOriginal:false};if(area==='bag')return saveBag(selection,nextColor,highlight?'已保存挑染色。':'已保存主色。');color=nextColor;swatches();requestPaint();});
 }
 function renderSeats(){
  const list=products().filter(o=>o.seat),choice=api.seatChoice();
  if(!list.some(o=>o.id===selected))selected=list.find(o=>o.id===choice)?.id||list[0]?.id||null;
  const current=list.find(o=>o.id===selected);
  $('#catalog .catalog-head h2').textContent=area==='bag'?'我的座椅':'座椅';
  $('#subtabs').textContent='設為我的座椅後，回到大廳按 X 使用；移動即收起。';
  $('#pager').replaceChildren();$('#bundlePager').replaceChildren();
  $('#grid').innerHTML=list.map(o=>'<button class="item" data-seat-item="'+esc(o.id)+'" aria-pressed="'+(o.id===selected)+'"><span class="itemtop"><span class="status">'+(o.id===choice?'已選用':o.owned?'已擁有':'')+'</span></span><span class="thumb"><canvas width="160" height="160" data-seat-thumb="'+esc(o.id)+'"></canvas></span><span class="item-caption"><strong>'+esc(o.name)+'</strong><small>'+(o.owned?'已收藏':'NT$'+esc(o.price))+'</small></span></button>').join('')||'<p class="live-empty">'+(area==='bag'?'目前還沒有已取得的座椅。':'目前沒有上架座椅。')+'</p>';
  $$('[data-seat-item]').forEach(b=>b.onclick=()=>{selected=b.dataset.seatItem;render();});
  $$('[data-seat-thumb]').forEach(cv=>api.seatThumb(cv.dataset.seatThumb,cv));
  $('#detail').hidden=false;
  $('#detail').innerHTML=current?'<div><small class="overline">TAVERN SEATS</small><h2>'+esc(current.name)+'</h2><p>按 X 使用／收起，移動時自動收起。</p></div><div class="actions"><button class="primary" id="seatAction">'+(current.owned?(current.id===choice?'已設為我的座椅':'設為我的座椅'):'選購座椅 · NT$'+esc(current.price))+'</button></div>':'';
  if(current){$('#seatAction').disabled=current.owned&&current.id===choice;$('#seatAction').onclick=()=>{if(current.owned){if(api.selectSeat(current.id)){tell('已設為我的座椅，回到大廳按 X 使用。');render();}}else buy(current.id);};}
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
  renderLook();
  if(collecting){renderCollection();return;}
  // 商城與背包由各自的大廳入口開啟，不交叉切換。
  $('#catalog .catalog-head h2').textContent=area==='store'?'本日選物':'我的衣櫥';
  $('#catalog .catalog-head small').textContent=area==='store'?'02 / SHOP COLLECTION':'02 / MY WARDROBE';
  const myHair=area==='bag'&&category==='hair'&&hairSection==='saved';
  mode=category==='bundles'||myHair?'bundles':'singles';
  $('#singles').classList.toggle('showing-my-hair',myHair);$('#singles').classList.toggle('has-hair-sections',area==='bag'&&category==='hair');
  const dyeShop=area==='store'&&category==='dye';
  if(!dyeShop){$('#dyeDialog').hidden=true;dyeDraft=null;}
  $('#singles').hidden=dyeShop;$('#singles').classList.toggle('showing-bundles',mode==='bundles');$('#bundles').hidden=mode!=='bundles';$('#dyeShop').hidden=!dyeShop;$('#detail').hidden=dyeShop;
  const cats=[...(area==='store'?[['bundles','當季套組']]:[]),...categories,...(area==='store'?[['dye','染髮券']]:[])];
  $('#categories').innerHTML=cats.map(([id,name])=>'<button data-category="'+id+'" aria-pressed="'+(id===category)+'"'+(id==='dye'?' class="cat-dye"':'')+'><span>'+name+'</span></button>').join('');
  $$('[data-category]').forEach(b=>b.onclick=()=>{if(b.dataset.category==='bubbles'){api.openChatSkins();return;}category=b.dataset.category;selected=null;render();});
  if(category==='seat'){renderSeats();return;}
  if(dyeShop){$('#grid').replaceChildren();$('#subtabs').replaceChildren();$('#pager').replaceChildren();$('#bundlePager').replaceChildren();$('#detail').replaceChildren();renderDyeShop();dyeCta();swatches();paint();return;}
  $('#singles').classList.toggle('has-accessory-filter',category==='acc');
  $('#subtabs').innerHTML=category==='acc'?'<nav class="accessory-filter" aria-label="配件部位">'+[['all','全部'],...Object.entries(groupNames)].map(([id,n])=>'<button data-group="'+id+'" aria-pressed="'+(id===filter)+'">'+n+'</button>').join('')+'</nav>':category==='hair'?(area==='bag'?'瀏海與後髮可分別搭配':'完整髮型 · 整組試穿'):'點圖片，即時試穿';
  if(area==='bag'&&category==='hair'){
   $('#subtabs').innerHTML='<nav class="hair-sections" aria-label="頭髮分類"><button type="button" data-hair-section="front" aria-pressed="'+(hairSection==='front')+'">前髮</button><button type="button" data-hair-section="back" aria-pressed="'+(hairSection==='back')+'">後髮</button><button type="button" data-hair-section="saved" aria-pressed="'+(hairSection==='saved')+'">我的染髮 <span>'+Object.keys(data.dyed).length+'</span></button></nav><p class="hair-section-hint">'+(myHair?'已保存的專屬髮色，點一下試穿；再次穿戴不扣券。':(hairSection==='back'?'後髮可以和任何前髮分開搭配。':'前髮可以和任何後髮分開搭配。'))+'</p>';
   $$('[data-hair-section]').forEach(b=>b.onclick=()=>{hairSection=b.dataset.hairSection;selected=null;render();});
  }
  if(category==='cloth'&&data.catalog.some(o=>o.parts.some(p=>tabOf(p)==='cloth'&&p.category==='acc'))){
   $('#subtabs').innerHTML='<nav class="hair-sections cloth-sections" aria-label="衣服分類">'+[['all','全部'],['main','衣服'],...Object.entries(wearGroups)].map(([id,name])=>'<button type="button" data-cloth-section="'+id+'" aria-pressed="'+(clothFilter===id)+'">'+name+'</button>').join('')+'</nav>';
   $$('[data-cloth-section]').forEach(b=>b.onclick=()=>{clothFilter=b.dataset.clothSection;selected=null;render();$('#grid').scrollTop=0;});
  }
  if(category==='eye'){
   $('#subtabs').innerHTML='<nav class="hair-sections face-sections" aria-label="臉部分類">'+[['brow','眉毛'],['eye','眼型']].map(([id,name])=>'<button type="button" data-face-section="'+id+'" aria-pressed="'+(faceSection===id)+'">'+name+'</button>').join('')+'</nav>';
   $$('[data-face-section]').forEach(b=>b.onclick=()=>{faceSection=b.dataset.faceSection;selected=null;render();$('#grid').scrollTop=0;});
  }
  $$('[data-group]').forEach(b=>b.onclick=()=>{filter=b.dataset.group;selected=null;render();});
  const list=entries();
  if(!list.some(p=>p.id===selected))selected=list.find(isTrying)?.id||null;
  $('#grid').innerHTML=list.map((p,i)=>'<button class="item" data-item="'+esc(p.id)+'" aria-label="'+(p.product.drink?'查看':isTrying(p)&&(area==='bag'||['acc','pet','seat','other'].includes(p.category))?'卸下':area==='bag'?'穿戴':'試穿')+esc(p.name)+'" aria-pressed="'+isTrying(p)+'"><span class="itemtop"><span class="item-number">'+String(i+1).padStart(2,'0')+'</span><span class="status">'+(entryOwned(p)?'已擁有':'')+'</span></span><span class="thumb">'+(p.product.drink?'<img class="drink-product-image" src="'+esc(p.product.img)+'" alt="'+esc(p.name)+'" decoding="async">':'<canvas width="64" height="64" data-preview="'+esc(p.id)+'"></canvas>')+'</span><span class="item-caption"><strong>'+esc(p.name)+'</strong>'+(p.note?'<small class="accessory-note">'+esc(p.note)+'</small>':'')+'<small>'+esc(p.product.drink?(p.product.owned?'已擁有':'每杯 '+p.product.price+' 金幣'):isTrying(p)?(area==='bag'||['acc','pet','seat','other'].includes(p.category)?'已搭配 · 再點卸下':'已搭配'):area==='bag'?'已收藏 · 點選搭配':entryOwned(p)?'已收藏':p.product.previewOnly?'新品試穿 · 敬請期待':p.product.baseUnit?'單買 '+p.product.price+' 金幣'+(p.product.kind==='hair'?'・前後髮一組':p.product.kind==='face'&&p.product.parts.length>1?'・眼眉一組':''):entryPrice(p)?'單買 '+entryPrice(p)+' 金幣'+(/::face$/.test(p.saleId||'')?'・眼眉一組':/::hair$/.test(p.saleId||p.parts?.[0]?.saleId||'')?'・前後髮一組':''):(p.product.drink?'每杯 ':p.product.pet?'單隻 ':'整組 ')+p.product.price+' 金幣')+'</small>'+(p.requirement?'<small class="accessory-requirement">'+esc(p.requirement)+'</small>':'')+'</span></button>').join('')||'<p class="live-empty">'+(area==='bag'?'這個分類還沒有已取得的部件。':'目前沒有上架商品。')+'</p>';
  $$('[data-item]').forEach(b=>b.onclick=()=>tryItem(list.find(p=>p.id===b.dataset.item)));
  $('#pager').replaceChildren();
  if(category==='other'&&list.length&&!list.some(p=>p.id===selected))selected=list[0].id;
  const p=list.find(p=>p.id===selected);
  $('#detail').replaceChildren();
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
    $('#drinkSubmit').onclick=async()=>{if(drinkBusy)return;const action=area==='bag'?'feed':'buy',qty=drinkQuantity;drinkBusy=true;render();try{const result=await api.drinkAction(action,p.product.id,qty);data=api.state();drinkDialogOpen=false;orderDialog.close();if(action==='feed')showDrinkDialogue(result,p.product);else tell('已購買 '+qty+' 杯，可到背包 → 飲品餵食。');}catch(e){tell(e.message);orderDialog.dataset.error=e.message}finally{drinkBusy=false;render();if(orderDialog.open)orderDialog.querySelector('.order-feedback').textContent=orderDialog.dataset.error||''}};
    updateDrinkOrder(p);
   }
  }
  if(mode==='bundles')renderBundles();
  if(category!=='other'){$('#detail').replaceChildren();$('#detail').hidden=true;}else $('#detail').hidden=false;
  dyeCta();swatches();paint();clearTimeout(render.imageTimer);render.imageTimer=setTimeout(paint,450);
 }
 /* v258:試衣間旁的染髮入口改成會動的邀請卡:先免費試色,喜歡再買券 */
 function dyeCta(){
  const t=data.tickets|0,price=api.dyePrice?.()||299;
  $('#dyeTicket').className='dye-ticket dye-cta'+(t?' has':'');
  $('#dyeTicket').innerHTML='<span class="dye-cta-art" aria-hidden="true"><i></i><i></i><i></i></span><span class="dye-cta-text"><strong>'+(t?('染髮券 · 剩餘 '+t+' 張'):'漸層染髮 · 先免費試色')+'</strong><small>'+(t?'保存專屬漸層只扣 1 張':'喜歡再買券，一張 NT$'+price)+'</small></span><b>↗</b>';
 }
 function renderDyeShop(){
  const demos=[['#f5a3c7','#b7a6f2','蜜桃薰衣草','PEACH','柔霧粉紫'],['#8fd6c8','#7fb4ef','薄荷晴空','MINT','清透藍綠'],['#f6cf6b','#f28d8d','蜂蜜夕陽','HONEY','暖金珊瑚']];
  const editor=$('#dyeDialog');editor.remove();
  $('#dyeShop').innerHTML='<header class="dye-shop-head"><div><small>TAVERN / COLOR STUDIO</small><h2>今天的髮色<span class="studio-dot" aria-hidden="true"></span></h2></div><span class="studio-stamp">FREE<br><b>免費試色</b></span></header>'
   +'<div class="dye-demos" aria-label="三款預設髮色">'+demos.map((d,i)=>'<button class="dye-demo" data-demo="'+i+'" data-main="'+d[0]+'" data-tail="'+d[1]+'" aria-pressed="false" aria-label="試穿'+d[2]+'" style="--a:'+d[0]+';--b:'+d[1]+'"><span class="preset-index">0'+(i+1)+'</span><span class="preset-check" aria-hidden="true">✓</span><span class="preset-word" aria-hidden="true">'+d[3]+'</span><span class="preset-art"><canvas width="64" height="64" data-dye-demo="'+i+'"></canvas></span><span class="preset-caption"><strong>'+d[2]+'</strong><small>'+d[4]+'</small><i class="preset-colors" aria-hidden="true"><i></i><i></i></i><b aria-hidden="true">↗</b></span></button>').join('')+'</div>'
   +'<div class="dye-custom-host"></div>';
  $('#dyeShop .dye-custom-host').append(editor);editor.classList.add('dye-inline');editor.removeAttribute('aria-modal');editor.setAttribute('role','region');
  if(!dyeDraft)openDye();else{editor.hidden=false;dyeStatus();}syncDyeDesign();
  $$('[data-dye-demo]').forEach(cv=>{const d=demos[cv.dataset.dyeDemo];try{const doll=api.makeDoll(selection,{hair:data.doll.hair||0});doll.hairHex=d[0];doll.hairHex2=d[1];api.draw(cv,doll);}catch(e){}});
  $$('[data-demo]').forEach(b=>b.onclick=()=>{const d=demos[b.dataset.demo];openDye({main:d[0],tail:d[1]});});

 }
 const dyeShopEl=document.createElement('section');dyeShopEl.id='dyeShop';dyeShopEl.className='dye-shop';dyeShopEl.hidden=true;$('#bundles').after(dyeShopEl);
 /* 分類列搬到「本日選物」標題下面,切到整套組合或染髮券時分類列還在 */
 $('#catalog .catalog-head').after($('#categories'));
 // 保留空容器供舊版整合查找，商品清單不再建立分頁控制。
 $('#catalog .catalog-head').append($('#bundlePager'));
 const seasonStyle=document.createElement('style');seasonStyle.textContent='body[data-area=store][data-shop-category=bundles] #catalog #bundlePager{display:flex!important;gap:8px;align-items:center;margin:0;font-size:12px}#catalog .catalog-head{display:flex;justify-content:space-between;align-items:center}#bundlePager:empty{display:none!important}#dyeHighlightLabel{display:grid;grid-template-columns:1fr auto;gap:6px}#dyeHighlightLabel[hidden]{display:none!important}#dyeHighlightLabel small{grid-column:1/-1;display:block;font-size:12px;line-height:1.5}';document.head.append(seasonStyle);
 // v399：當季卡片展示配色（只影響展示，不影響試穿或保存）。
 const hexOk=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
 function seasonShow(o){const c=window.TTSeasonDisplay?.[o.id]||{},base=data.colors?.[o.doll?.hair||0]||'#E8A0C6';return {main:hexOk(c.main)?c.main:null,tail:hexOk(c.tail)?c.tail:null,highlight:hexOk(c.highlight)?c.highlight:null,base,bg:Array.isArray(c.bg)&&c.bg.length===3&&c.bg.every(hexOk)?c.bg:null};}
 function seasonShowDoll(o,d){const c=seasonShow(o);if(!c.main)return d;d.hairHex=c.main;if(c.tail)d.hairHex2=c.tail;else delete d.hairHex2;if(c.highlight)d.hairHighlight=c.highlight;return d;}
 function seasonVars(o){const c=seasonShow(o),a=c.main||c.base,b=c.tail||a,h=c.highlight||b,bg=c.bg||[a,b,h];return '--sv-a:'+bg[0]+';--sv-b:'+bg[1]+';--sv-c:'+bg[2];}
 window.__ttSeasonRepaint=()=>{try{renderBundles();paint();}catch(e){}};
 // 舊染髮組合的部件已無法穿戴時，只用原始資料畫預覽，不經穿搭驗證
 function dyedFallbackDoll(s){const d=JSON.parse(JSON.stringify(data.doll||{}));delete d.set;d.ps={...(d.ps||{})};let base=(d.uiBaseSlots||[]).slice();
  for(const k of ['front','back']){const r=s[k]||{};if(r.base!==undefined){d[k]=r.base;delete d.ps[k];if(!base.includes(k))base.push(k);}else if(r.source){d.ps[k]=r.source;base=base.filter(x=>x!==k);}}
  d.uiBaseSlots=base;d.hairHex=s.main;d.hairHex2=s.tail;if(s.highlight)d.hairHighlight=s.highlight;else delete d.hairHighlight;return d;}
 function dyedWearable(id){const s=data.dyed[id];if(!s)return false;try{api.makeDoll(api.normalizeSelection({...selectionFromDoll(data.doll),front:s.front,back:s.back}),{savedId:id},true);return true;}catch(e){return false;}}
 function renderBundles(){
  $('#bundlePager').innerHTML='';
  if(area==='bag'){
   const saved=Object.entries(data.dyed);
   $('#bundlegrid').innerHTML=saved.map(([id,s])=>'<article class="bundle saved-dye-bundle"><div class="bundlebody"><small>MY HAIR</small><h2>'+esc(s.name||'專屬染髮')+'</h2><canvas class="dyed-preview" width="64" height="64" data-dyed-preview="'+esc(id)+'"></canvas><p>已固定瀏海、後髮與髮色。再次穿戴不扣券。</p><button class="primary" data-saved="'+esc(id)+'">試穿這組</button></div></article>').join('')||'<div class="live-empty"><p>還沒有保存的染髮。</p><button class="primary" id="emptyDye">開始染髮</button><p>先選好瀏海與後髮，再調整專屬髮色。</p></div>';
   if($('#emptyDye'))$('#emptyDye').onclick=openDye;
   $$('[data-saved]').forEach(b=>{const id=b.dataset.saved,active=color.savedId===id;
    // 部件已下架或未持有的舊染髮組合：不能穿，按鈕停用並說明，不再讓整頁出錯
    if(!active&&!dyedWearable(id)){const s=data.dyed[id],need=s&&data.catalog.find(o=>o.baseUnit&&!o.owned&&o.parts.some(q=>['front','back'].some(k=>s[k]?.base===q.base&&s[k]?.slot===q.slot)));b.textContent=need?'先到商城買「'+need.name+'」髮型才能穿':'這組髮型已下架，無法穿戴';b.disabled=true;b.closest('.saved-dye-bundle')?.classList.add('is-unwearable');return;}
    b.textContent=active?'已穿戴 · 點一下卸下':'點一下穿戴';b.onclick=()=>{if(saving)return;const saved=data.dyed[id];const next=api.normalizeSelection({...selection,front:saved.front,back:saved.back});/* v420 卸下＝保留這組瀏海與後髮、改回原本髮色（舊版改成 base 0，已下架部件會穿不回去） */return saveBag(next,active?{hair:data.doll.hair||0}:{savedId:id},active?'已卸下染髮，髮型保留、恢復原本髮色。':'已穿上染髮組合。');}});
   $('#detail').replaceChildren();
  }else{
   const available=products().filter(o=>!o.baseUnit&&!['寵物','其他','座椅'].includes(o.type)&&o.parts.length),featured=available.filter(o=>o.featured),all=(featured.length?featured:available).sort((a,b)=>b.featured-a.featured);const show=all;
   $('#bundlegrid').innerHTML=show.map((o,i)=>'<article class="season-card" data-season="'+esc(o.id)+'" style="'+seasonVars(o)+'"><div class="season-visual"><span class="season-kicker">TAVERN / SEASON COLLECTION</span><span class="season-number">0'+(i+1)+'</span>'+(o.img&&!seasonShow(o).main?'<img src="'+esc(o.img)+'" alt="'+esc(o.name)+'完整套裝展示" width="240" height="240">':'<canvas width="64" height="64" data-outfit-preview="'+esc(o.id)+'"></canvas>')+'</div><div class="season-info"><h2>'+esc(o.name)+'</h2><p>'+(o.id==='season283_devil'?'暖金與紫色交織，藏一點小惡魔的俏皮。':o.id==='season283_valentine'?'粉色漸入深紫，把心動穿成今天的模樣。':'收藏完整造型，也能自由搭配喜歡的部件。')+'</p><div class="season-price"><strong>'+(o.previewOnly?'即將登場':esc(o.price))+(o.previewOnly?'':'<small>金幣／整套</small>')+'</strong><span>'+(o.owned?'已收藏':'當季完整套組')+'</span></div><div class="season-actions"><button class="ghost" data-try-outfit="'+esc(o.id)+'">試穿整套</button><button class="primary" data-buy-outfit="'+esc(o.id)+'" '+(o.owned||o.previewOnly?'disabled':'')+'>'+(o.owned?'已擁有':o.previewOnly?'敬請期待':'選購整套')+'</button></div></div></article>').join('')||'<p class="live-empty">目前沒有上架組合。</p>';
   $$('[data-try-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.tryOutfit);const next=outfitSelection(o),nextColor={hair:o.doll?.hair||0};try{api.makeDoll(next,nextColor);}catch(e){tell(e.message);return;}selection=next;color=nextColor;swatches();paint();tell('已試穿「'+o.name+'」');});
   $$('[data-buy-outfit]').forEach(b=>b.onclick=()=>{const o=data.catalog.find(o=>o.id===b.dataset.buyOutfit);if(!o.owned&&!o.previewOnly)buy(o.id);});
   $('#detail').replaceChildren();
  }
 }
 function buy(id){try{api.buy(id);}catch(e){tell(e.message);}}
 async function wear(){if(saving)return;saving=true;try{await api.wear(selection,color);data=api.state();tell('穿搭已保存，回到大廳也會穿著這一套。');}catch(e){tell(e.message);}finally{saving=false;}}
 /* 商城與背包沿用各自入口，不再顯示重複切換列。 */
 const areaNav=document.querySelector('.mode');areaNav.className='area-tabs';areaNav.setAttribute('aria-label','商城與背包');
 areaNav.replaceChildren();document.querySelector('.shophead').hidden=true;
 function syncOuter(a){try{const doc=parent.document;const w=doc.querySelector('#shopWindow');if(w)w.dataset.area=a;const t=doc.querySelector('#shopTitle');if(t){t.textContent=a==='bag'?'我的背包':'商城';t.dataset.text=t.textContent;}const sm=doc.querySelector('#shopWindow .window-head small');if(sm)sm.textContent=a==='bag'?'MY LITTLE ARCHIVE / 把喜歡的收藏好':'TAVERN BOUTIQUE / 選一份新的心情';const f=doc.querySelector('#shopFrame');if(f)f.dataset.liveArea=a;}catch(e){}}
 document.querySelector('.catalog-mode').hidden=true;
 $('#singlesMode').onclick=()=>{mode='singles';render();};$('#bundlesMode').onclick=()=>{mode='bundles';render();};
 $('#reset').onclick=()=>{init();render();tell('已還原目前穿搭');};
 $('#showWear').textContent='穿上搭配';$('#showWear').onclick=wear;

 $('#dyeDialog .dialog-card').innerHTML='<div class="studio-custom-heading"><div><span class="eyebrow">MAKE IT YOURS / 04</span><h2 id="dyeTitle">調一款，你的顏色。</h2></div><span class="studio-custom-symbol" aria-hidden="true">✳</span></div><div class="dye-workspace"><div class="dye-avatar"><span class="studio-live">LIVE PREVIEW</span><div class="studio-color-orbit" aria-hidden="true"></div><canvas id="dyePreview" width="64" height="64" aria-label="染髮即時預覽"></canvas></div><div class="dye-controls"><div class="studio-gradient-strip" aria-hidden="true"></div><div class="studio-pickers"><label class="studio-color-control"><span>01 主色</span><input id="dyeMain" type="color" aria-label="染髮主色"><output id="dyeMainCode"></output></label><label id="dyeTailLabel" class="studio-color-control"><span>02 髮尾</span><input id="dyeTail" type="color" aria-label="染髮髮尾色"><output id="dyeTailCode"></output></label><label id="dyeHighlightLabel" class="studio-color-control" hidden><span>03 挑染</span><input id="dyeHighlight" type="color" aria-label="獨立挑染色"><output id="dyeHighlightCode"></output></label></div><label class="dye-gradient"><input id="dyeGradient" type="checkbox"><span>髮尾漸層</span><i aria-hidden="true"></i></label><label class="studio-name">為髮色取個名字<input id="dyeName" maxlength="24" placeholder="我的專屬髮色"></label></div></div><footer class="studio-checkout"><div><div class="ticket-state" role="status"></div><span class="studio-save-note">保存 1 張券 · 之後可重複穿戴</span></div><div class="dye-actions"><button id="cancelDye" class="ghost">重設</button><button id="buyDyeInDialog" class="primary buy" hidden>買一張染髮券</button><button id="saveDye" class="primary">使用 1 張並保存</button></div></footer><p id="dyeError" role="alert" hidden></p>';

 const DYE_PENDING='tt_dye_pending_v408';
 function resetDye(){if(dyeSaving)return;dyeDraft=null;openDye();}

 function dyeStatus(){
  $('#dyeDialog .ticket-state').textContent='我的染髮券　'+data.tickets+' 張';
  $('#saveDye').disabled=dyeSaving||data.tickets<1;$('#saveDye').textContent=dyeSaving?'保存中…':'使用 1 張並保存';
  $('#saveDye').hidden=data.tickets<1;$('#buyDyeInDialog').hidden=data.tickets>=1;$('#buyDyeInDialog').textContent='買一張染髮券 NT$'+(api.dyePrice?.()||299)+' →';
  $$('#dyeDialog input, #cancelDye').forEach(el=>el.disabled=dyeSaving);
  $('#dyeTail').disabled=dyeSaving||!$('#dyeGradient').checked;
 }
 function updateDye(){
  const previous=dyeDraft;
  dyeDraft={name:$('#dyeName').value,main:$('#dyeMain').value,tail:$('#dyeGradient').checked?$('#dyeTail').value:$('#dyeMain').value,...(!$('#dyeHighlightLabel').hidden?{highlight:$('#dyeHighlight').value}:{})};
  $('#dyeTailLabel').hidden=!$('#dyeGradient').checked;syncDyeDesign();dyeStatus();if(!previous||previous.main!==dyeDraft.main||previous.tail!==dyeDraft.tail||previous.highlight!==dyeDraft.highlight)requestPaint();
 }
 function syncDyeDesign(){
  if(!dyeDraft)return;
  const card=$('#dyeDialog .dye-card');card.style.setProperty('--dye-main',dyeDraft.main);card.style.setProperty('--dye-tail',dyeDraft.tail);
  for(const name of ['Main','Tail','Highlight'])$('#dye'+name+'Code').textContent=$('#dye'+name).value.toUpperCase();
  $$('#dyeShop [data-demo]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.main===dyeDraft.main&&b.dataset.tail===dyeDraft.tail)));
 }
 function openDye(preset){
  try{
   if(area!=='store'||category!=='dye'){window.ttDyeShop();if(!preset)return;}
   data=api.state();if(!data.loggedIn)throw Error('先登入自己的闆卡，再使用染髮');
   const d=api.makeDoll(selection,color);
   $('#dyeHighlightLabel').hidden=![selection.front,selection.back].some(r=>data.catalog.find(o=>o.id===r?.source)?.highlightHair);$('#dyeHighlight').value=d.hairHighlight||'#e5edf5';
   $('#dyeName').value='';$('#dyeMain').value=(preset&&preset.main)||d.hairHex||data.colors[d.hair||0];$('#dyeTail').value=(preset&&preset.tail)||d.hairHex2||'#f3b8d8';
   $('#dyeGradient').checked=preset?true:(!!d.hairHex2&&d.hairHex2!==d.hairHex);$('#dyeError').hidden=true;
   $('#dyeDialog').hidden=false;dyeRequest=null;updateDye();
  }catch(e){tell(e.message);}
 }
 async function saveDye(){
  if(dyeSaving||!dyeDraft)return;
  const signature=JSON.stringify([selection.front,selection.back,dyeDraft]);
  if(!dyeRequest||dyeRequest.signature!==signature)dyeRequest={signature,id:'dye_'+crypto.randomUUID()};
  dyeSaving=true;dyeStatus();$('#dyeError').hidden=true;
  try{
   const result=await api.saveDye(selection,dyeDraft,dyeRequest.id);
   clearDyePending();data=api.state();dyeDraft=null;$('#dyeDialog').hidden=true;document.querySelector('.shop').inert=false;area='bag';bagSection='wear';category='hair';hairSection='saved';syncOuter('bag');
   // v420：染好直接穿上。以目前已保存的穿搭為底，只換成這組瀏海、後髮與髮色，不把試穿中的其他商品一起存進去。
   const s=data.dyed[result.id];let worn=false,why='';
   if(s){const next=api.normalizeSelection({...selectionFromDoll(data.doll),front:s.front,back:s.back});
    try{await api.wear(next,{savedId:result.id});data=api.state();selection=next;color={savedId:result.id};worn=true;}catch(e){why=e.message||'';}}
   try{render();}catch(e){console.warn(e);}
   tell(worn?'染好了，已經幫你穿上！回到大廳就是新髮色。':'染髮已保存在「我的染髮」，但沒能自動穿上'+(why?'（'+why+'）':'')+'，可以在這裡按「點一下穿戴」。');
  }catch(e){$('#dyeError').textContent=e.message||'保存未完成，請重試';$('#dyeError').hidden=false;data=api.state();}
  finally{dyeSaving=false;dyeStatus();}
 }
 $('#cancelDye').onclick=resetDye;$('#saveDye').onclick=saveDye;
 $('#buyDyeInDialog').onclick=()=>{try{if(dyeDraft)try{sessionStorage.setItem(DYE_PENDING,JSON.stringify({selection,color,draft:dyeDraft,tickets:data.tickets,at:Date.now()}));}catch{}api.buyDye();}catch(e){tell(e.message);}};
 /* v408 買完染髮券後回到染髮工作室，詢問是否直接用剛剛調好的顏色（使用 1 張券，沿用原本 saveDye 流程） */
 function readDyePending(){try{const p=JSON.parse(sessionStorage.getItem(DYE_PENDING)||'null');if(p&&p.draft&&Date.now()-p.at<1800000)return p;}catch{}return null;}
 function clearDyePending(){try{sessionStorage.removeItem(DYE_PENDING);}catch{}}
 function dyeResumePrompt(){
  let box=$('#dyeResume');if(!box){box=document.createElement('div');box.id='dyeResume';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','dyeResumeTitle');
   box.innerHTML='<div class="dye-resume-card"><span class="eyebrow">TICKET READY</span><h3 id="dyeResumeTitle">染髮券到手了！</h3><p>要直接用剛剛調好的顏色染上嗎？<br>會使用 1 張染髮券，之後可以重複穿戴。</p><div class="dye-resume-swatch" aria-hidden="true"></div><div class="dye-resume-actions"><button type="button" class="ghost" id="dyeResumeLater">先不要</button><button type="button" class="primary" id="dyeResumeGo">確認染髮</button></div></div>';
   $('#dyeDialog').append(box);
   $('#dyeResumeLater').onclick=()=>{clearDyePending();box.hidden=true;tell('顏色還留在這裡，想染的時候按「使用 1 張並保存」。');};
   $('#dyeResumeGo').onclick=async()=>{clearDyePending();box.hidden=true;await saveDye();};}
  box.querySelector('.dye-resume-swatch').style.background='linear-gradient(90deg,'+dyeDraft.main+','+dyeDraft.tail+(dyeDraft.highlight?','+dyeDraft.highlight:'')+')';
  box.hidden=false;$('#dyeResumeGo').focus();
 }
 window.ttResumeDye=()=>{
  const p=readDyePending();if(!p)return true;if(document.readyState!=='complete')return false;
  data=api.state();if(!data.loggedIn)return false;if(data.tickets<1||(Number.isInteger(p.tickets)&&data.tickets<=p.tickets))return false;
  setTimeout(()=>{
   try{api.makeDoll(p.selection,p.color);selection=p.selection;color=p.color;}catch{}
   window.ttDyeShop();openDye({main:p.draft.main,tail:p.draft.tail});if($('#dyeDialog').hidden)return;
   $('#dyeName').value=p.draft.name||'';$('#dyeMain').value=p.draft.main;$('#dyeTail').value=p.draft.tail;$('#dyeGradient').checked=p.draft.tail!==p.draft.main;
   if(p.draft.highlight&&!$('#dyeHighlightLabel').hidden)$('#dyeHighlight').value=p.draft.highlight;
   updateDye();requestPaint();dyeResumePrompt();
  },350);
  return true;
 };

 $$('#dyeDialog input').forEach(el=>el.oninput=updateDye);$('#dyeTicket').onclick=()=>{window.ttDyeShop();$('#dyeShop').scrollTop=0;$('#categories [data-category=dye]').focus({preventScroll:true});};
 document.querySelector('.paneltitle strong').textContent='我的試衣舞臺';document.querySelector('.collection-mark span').textContent='星光換裝間';document.querySelector('.collection-mark strong').textContent='DRESS UP & PLAY';
 window.ttDressArea=next=>{init();setArea(next);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(orderDialog.open){closeDrinkOrder();return;}api.close();}});
 let compactLayout=innerWidth<601;
 window.addEventListener('resize',()=>{const next=innerWidth<601;if(next!==compactLayout){compactLayout=next;render();}});
 init();render();[200,600,1400,3000].forEach(t=>setTimeout(paint,t));
 setInterval(()=>{if(!document.hidden&&api.isActive()&&parent.document.body.dataset.view==='shop'){const next=api.state();if(next.tickets!==data.tickets||JSON.stringify(next.catalog)!==JSON.stringify(data.catalog)||JSON.stringify(next.dyed)!==JSON.stringify(data.dyed)){data=next;render();if(!$('#dyeDialog').hidden)dyeStatus();}}},2000);
})();
