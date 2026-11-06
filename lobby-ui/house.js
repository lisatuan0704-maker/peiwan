/* v494 小屋（第一批家具試做）：大廳的「小屋」鈕 → 場景換成自己的房間（house/room.html，iframe 鋪在大廳場景的位置），
   名牌、設定照舊；右下改成「佈置／家具店」，右上多「回大廳」與縮放鈕。家具店用大廳同一套視窗（live.js 的 houseShopM）。
   資料：house/<key>{layout,at}＝擺設；houseInv/<key>/<家具>/<訂單編號>{ts}＝買到的每一件；入住禮（catalog.json starter）不用買、每人一件。
   價格：shopConfig/house:<家具>{name,price,cur:'cat',type:'小屋家具',active}（v493 規則：貓貓幣只能買 shopConfig 標 cur:'cat' 的商品），
   price 是「金幣等值價」，顯示與扣款 ×10（TTCat.price）。type 不是「時裝」、也沒有 custom，所以不會出現在時裝間。
   購買＝同一次寫入 clientOrders（type shop、paidBy cat、itemId house:<家具>）＋cat 扣款＋catTx spend＋houseInv（catSafety 鎖）。
   手機功能首頁（html.ttm-on）沒有大廳場景，先不開小屋鈕。 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const R=()=>typeof ROOT!=='undefined'?ROOT:'peiwan';
const KEY=()=>typeof myKey!=='undefined'?myKey:null;
const DB=()=>typeof db!=='undefined'?db:null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>{try{toast(m);}catch(_){}};
const VER='496';
const SIZE_NAME={S:'小件',M:'中件',L:'大件'},TIER_NAME={1:'簡單',2:'標準',3:'精緻'};
const S={on:false,frame:null,cat:null,byKey:{},inv:{},layout:null,subs:[],mode:'walk',saveT:0,buying:false,shopSet:'酒館日常',shopKind:'all',bagKind:'all',thumbs:{},sign:null,key:null};

// ---------- 資料 ----------
async function loadCatalog(){if(S.cat)return S.cat;const r=await fetch('house/catalog.json?v='+VER,{cache:'no-store'});const a=await r.json();S.cat=a;a.forEach(c=>S.byKey[c.k]=c);return a;}
function unsub(){S.subs.forEach(f=>{try{f();}catch(_){}});S.subs=[];}
function watch(path,fn){const ref=DB().ref(R()+'/'+path),h=s=>fn(s.val());ref.on('value',h,()=>fn(null));S.subs.push(()=>ref.off('value',h));}
const priceOf=k=>{const p=(window.__shopCfg||{})['house:'+k];return p&&p.cur==='cat'&&p.active!==false&&Number.isSafeInteger(p.price)&&p.price>0?p.price:0;};   // 金幣等值價（只賣標 cur:'cat' 的）
const owned=k=>(S.byKey[k]?.starter?1:0)+Object.keys(S.inv[k]||{}).length;
function placed(){try{return S.frame?.contentWindow?.TTRoom?.placed()||{};}catch(_){return {};}}
const left=k=>owned(k)-(placed()[k]||0);

// ---------- 進出小屋 ----------
function myDollCanvas(){const c=document.createElement('canvas');c.width=c.height=64;try{const a=typeof me==='function'?me():null;window.drawDollTo(c,(a&&a.b&&a.b.doll)||{},'idle');}catch(_){}return c;}
async function enter(){
 if(S.on)return;
 if(document.documentElement.classList.contains('ttm-on')){say('小屋請用電腦開，手機版之後再開放');return;}
 const key=KEY();if(!key||!DB()){say('先做一張闆卡、用 Discord 登入，才能回小屋');return;}
 S.key=key;S.on=true;document.body.classList.add('tt-house-on');
 try{window.TinyTavernUI?.close?.();}catch(_){}
 const sg=$('sign');if(sg){const p=sg.querySelector('.plate'),u=sg.querySelector('.sub');S.sign=[p?.innerHTML,u?.innerHTML];
   if(p)p.textContent='Tiny Tavern・我的小屋';if(u){const nm=(typeof me==='function'&&me()?.b?.name)||'你';u.textContent=nm+' 的小屋';}}
 try{
  await loadCatalog();
  const lay=await DB().ref(R()+'/house/'+key+'/layout').once('value');S.layout=Array.isArray(lay.val())?lay.val():null;
 }catch(e){S.layout=null;}
 if(!S.on||S.key!==key)return;
 watch('houseInv/'+key,v=>{S.inv=v||{};renderBag();renderShop();});
 const f=document.createElement('iframe');f.id='ttHouseFrame';f.title='我的小屋';f.src='house/room.html?v='+VER;S.frame=f;
 document.body.append(f);
 f.addEventListener('load',async()=>{try{await f.contentWindow.TTRoom.ready;}catch(_){}
   renderBag();if(window.TTCoach&&!TTCoach.seen(TOUR_KEY))setTimeout(()=>{if(S.on)houseTour();},400);else if(!S.layout)say('歡迎回家！入住禮已經幫你擺好了');});
 setMode('walk');
}
function exit(){
 if(!S.on)return;flushSave();S.on=false;unsub();
 document.body.classList.remove('tt-house-on','tt-house-edit');
 S.frame?.remove();S.frame=null;
 const sg=$('sign');if(sg&&S.sign){const p=sg.querySelector('.plate'),u=sg.querySelector('.sub');if(p&&S.sign[0]!=null)p.innerHTML=S.sign[0];if(u&&S.sign[1]!=null)u.innerHTML=S.sign[1];}
 try{gClose('houseShopM');}catch(_){}
}

// ---------- 新手教學（v495）：第一次進小屋，整片變灰、虛線圈起要點的地方；右上「教學」可以再看一次 ----------
const TOUR_KEY='tt_house_tour_v1';
function houseTour(){if(!window.TTCoach||!S.on)return;if(S.mode!=='walk')setMode('walk');try{gClose('houseShopM');}catch(_){}
 const room=()=>{try{return S.frame.contentWindow.TTRoom.roomRect();}catch(_){return null;}},cat=()=>$('ttCatCount')?.closest('[data-cat-pop],.tt-funds-row,div')||$('ttCatCount');
 const daily=TTCat.dailyOn()?'每天在大廳說說話、待滿 10 分鐘，完成每日任務就送 '+TTCat.DAILY+' 貓貓幣。':'11/7 起，每天在大廳說說話、待滿 10 分鐘，完成每日任務就送 '+TTCat.DAILY+' 貓貓幣。';
 TTCoach.run([
  {target:room,pad:4,title:'歡迎來到你的小屋！',text:'這間房間是你專屬的，入住禮的四件家具已經幫你擺好了。\n點地板，小人就會走過去；按住拖曳可以移動視角，滾輪可以放大縮小。'},
  {target:()=>$('ttHouseShop'),title:'家具店',text:'用貓貓幣買家具。越大、越精緻的家具越貴，買了會先收進「我的家具」。'},
  {target:cat,title:'貓貓幣',text:daily+'\n名牌上這個硬幣就是你現在有的貓貓幣。'},
  {target:()=>$('ttHouseEdit'),title:'佈置',text:'按這裡，右邊會打開「我的家具」：點一件拿出來，移到想放的地方再點一下就擺好。\n點房間裡的家具，可以拿起來重新擺。'},
  {target:()=>$('ttHouseBack'),title:'回大廳',text:'想回酒館大廳就按這裡，擺好的家具都會自動存起來。'}
 ],{doneKey:TOUR_KEY,last:'開始佈置吧'});}

// ---------- 擺設存檔：房間每次放好／收回就交過來，0.6 秒合併一次寫入 ----------
let pending=null;
function save(layout){pending=layout;clearTimeout(S.saveT);S.saveT=setTimeout(flushSave,600);}
function flushSave(){clearTimeout(S.saveT);if(!pending||!S.key)return;const lay=JSON.parse(JSON.stringify(pending));pending=null;
 DB().ref(R()+'/house/'+S.key).set({layout:lay,at:firebase.database.ServerValue.TIMESTAMP}).catch(()=>say('擺設沒存到，請檢查網路後再動一下家具'));}

// ---------- 佈置模式 ----------
function setMode(m){S.mode=m;document.body.classList.toggle('tt-house-edit',m==='edit');renderKeys();
 try{const T=S.frame?.contentWindow?.TTRoom;if(T&&T.mode()!==m)T.setMode(m);}catch(_){}
 renderBag();requestAnimationFrame(()=>{try{S.frame?.contentWindow?.TTRoom?.frame();}catch(_){}});}
function renderBag(){const box=$('ttHouseBag');if(!box||!S.cat)return;
 const kinds=[['all','全部'],['floor','地板'],['wall','牆面']];
 const list=S.cat.filter(c=>owned(c.k)>0&&(S.bagKind==='all'||c.kind===S.bagKind));
 const tabs=kinds.map(([k,n])=>'<button type="button" data-bk="'+k+'" aria-pressed="'+(S.bagKind===k)+'">'+n+'</button>').join('');
 box.querySelector('.tt-hb-tabs').innerHTML=tabs;
 const grid=box.querySelector('.tt-hb-grid');
 grid.innerHTML=list.length?list.map(c=>{const n=left(c.k);return '<button type="button" class="tt-hb-item'+(n>0?'':' none')+'" data-k="'+c.k+'" title="'+esc(c.name)+'">'
   +'<span class="tt-hb-pic"><img alt="" data-thumb="'+c.k+'"></span><b>'+esc(c.name)+'</b><small>'+(n>0?'剩 '+n+' 件':'都擺出來了')+'</small></button>';}).join('')
  :'<p class="tt-hb-empty">背包裡還沒有家具，去家具店帶幾件回家吧</p>';
 fillThumbs(grid,136);}   // 家具店、佈置清單同一個比例（1 倍）
async function fillThumbs(root,size){const R=S.frame?.contentWindow?.TTRoom;if(!R)return;
 for(const im of root.querySelectorAll('img[data-thumb]')){const k=im.dataset.thumb,ck=k+'@'+size;
  if(S.thumbs[ck]){im.src=S.thumbs[ck];continue;}
  try{const u=await R.thumbAsync(k,size);if(u){S.thumbs[ck]=u;im.src=u;}}catch(_){}}}

// ---------- 家具店（大廳的 houseShopM 視窗）----------
function openShop(){if(!S.on)return;renderShop();try{gOpen('houseShopM');}catch(_){}}
function renderShop(){const host=document.querySelector('#houseShopM .tt-house-shop');if(!host||!S.cat)return;
 const sets=['酒館日常','萬用系列'],kinds=[['all','全部'],['floor','地板'],['wall','牆面']];
 const list=S.cat.filter(c=>c.set===S.shopSet&&(S.shopKind==='all'||c.kind===S.shopKind));
 const sale=list.filter(c=>priceOf(c.k)||c.starter);
 host.innerHTML='<div class="tt-hs-bar"><div class="tt-hs-sets" role="tablist">'+sets.map(s=>'<button type="button" role="tab" data-set="'+s+'" aria-selected="'+(S.shopSet===s)+'">'+s+'</button>').join('')+'</div>'
  +'<div class="tt-hs-kinds">'+kinds.map(([k,n])=>'<button type="button" data-kind="'+k+'" aria-pressed="'+(S.shopKind===k)+'">'+n+'</button>').join('')+'</div>'
  +'<div class="tt-hs-wallet">'+TTCat.coin(22,'c')+'<b data-cat-pop>'+TTCat.fmt(window.__cat||0)+'</b>'+(TTCat.EXCHANGE_ON?'<button type="button" class="tt-hs-ex">用金幣兌換</button>':'<small>每日任務每天送 '+TTCat.DAILY+'</small>')+'</div></div>'
  +'<p class="tt-hs-note">大件家具比較大、做得越精緻越貴。買了會放進背包，按「佈置」就能擺進房間。</p>'
  +'<div class="tt-hs-grid">'+(sale.length?sale.map((c,i)=>{const p=priceOf(c.k),own=owned(c.k);
   return '<article class="tt-hs-card"><span class="tt-hs-no">'+String(i+1).padStart(2,'0')+'</span>'
    +'<div class="tt-hs-pic"><img alt="" data-thumb="'+c.k+'"></div>'
    +'<h3>'+esc(c.name)+'</h3><p class="tt-hs-tag">'+SIZE_NAME[c.size]+'・'+TIER_NAME[c.tier]+(own?'<span class="own">已有 '+own+' 件</span>':'')+'</p>'
    +(c.starter&&!p?'<p class="tt-hs-gift">入住禮・已送你一件</p>'
      :'<button type="button" class="tt-hs-buy" data-buy="'+c.k+'">'+TTCat.tag(TTCat.price(p),16)+'<span class="lbl">購買</span></button>')
    +'</article>';}).join(''):'<p class="tt-hs-empty">這一區的家具還在準備中</p>')+'</div>';
 fillThumbs(host,136);}
document.addEventListener('click',e=>{
 const t=e.target.closest('#houseShopM [data-set],#houseShopM [data-kind],#houseShopM [data-buy],#houseShopM .tt-hs-ex');if(t){
  if(t.dataset.set){S.shopSet=t.dataset.set;renderShop();}
  else if(t.dataset.kind){S.shopKind=t.dataset.kind;renderShop();}
  else if(t.dataset.buy)askBuy(t.dataset.buy);
  else if(t.classList.contains('tt-hs-ex')){try{gClose('houseShopM');}catch(_){}try{openTopup();}catch(_){}}
  return;}
 const b=e.target.closest('#ttHouseBag [data-bk],#ttHouseBag [data-k]');if(b){
  if(b.dataset.bk){S.bagKind=b.dataset.bk;renderBag();return;}
  const k=b.dataset.k;if(left(k)<=0){say('這件都擺出來了，點房間裡的它就能移動');return;}
  try{S.frame.contentWindow.TTRoom.grabNew(k);}catch(_){}}});
window.addEventListener('tt-cat',()=>{const b=document.querySelector('#houseShopM .tt-hs-wallet b');if(b)b.textContent=TTCat.fmt(window.__cat||0);});

function askBuy(k){const c=S.byKey[k],p=priceOf(k);if(!c||!p)return;const cat=TTCat.price(p);
 ttConfirm('購買「'+c.name+'」？','使用 '+TTCat.fmt(cat)+' 貓貓幣。買了會放進背包，按「佈置」就能擺進房間。',()=>buy(k),'確定購買');}
async function buy(k){const c=S.byKey[k],p=priceOf(k),key=S.key;if(S.buying||!c||!p||!key||key!==KEY())return;
 const CAT=TTCat.price(p);S.buying=true;
 try{const bal=await DB().ref(R()+'/cat/'+key+'/balance').once('value');
  if(!Number.isSafeInteger(bal.val())||bal.val()<CAT){say('貓貓幣不夠，還差 '+TTCat.fmt(CAT-(Number(bal.val())||0))+(TTCat.EXCHANGE_ON?'，可以先到錢包用金幣兌換':'（每日任務每天送 '+TTCat.DAILY+'）'));return;}
  const ref=DB().ref(R()+'/clientOrders').push(),ts=Date.now(),name=(typeof me==='function'&&me()?.b?.name)||'酒館客人';
  const o={type:'shop',plan:'house:'+k,planName:'小屋家具・'+c.name,amount:p,origAmount:p,couponUsed:false,couponDisc:0,itemId:'house:'+k,itemName:c.name,name,paidBy:'cat',catAmount:CAT,status:'done',createdAt:ts,myKey:key};
  await catSafety().execute({key,amount:CAT,ids:[ref.key],lookup:walletLookup,commit:async()=>{const ch={};
   ch['clientOrders/'+ref.key]=o;ch['cat/'+key+'/balance']=firebase.database.ServerValue.increment(-CAT);
   ch['catTx/'+key+'/'+ref.key]={type:'spend',amount:-CAT,ref:ref.key,note:o.planName,ts};ch['cat/'+key+'/lastTx']=ref.key;
   ch['houseInv/'+key+'/'+k+'/'+ref.key]={ts};await DB().ref(R()).update(ch);}});
  try{rememberPaymentIds([ref.key]);}catch(_){}
  if(S.on&&S.key===key){S.inv[k]={...(S.inv[k]||{}),[ref.key]:{ts}};renderShop();renderBag();
   ttConfirm('「'+c.name+'」帶回家了！','要現在擺進房間嗎？',()=>{try{gClose('houseShopM');}catch(_){}setMode('edit');setTimeout(()=>{try{S.frame.contentWindow.TTRoom.grabNew(k);}catch(_){}},60);},'現在擺');}
 }catch(e){if(e&&e.ids)try{rememberPaymentIds(e.ids);}catch(_){}say(e&&e.message||'購買沒有完成，請到訂單看看');}
 finally{S.buying=false;}}

// ---------- 介面：右下（佈置、家具店）、右上（回大廳、縮放）、佈置清單 ----------
const ICON={
 house:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 13 14 4.5 24 13"/><path d="M7 11v12h14V11"/><path d="M12 23v-6h4v6"/></svg>',
 brush:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M6 22c3 0 5-2 5-5l9-11 3 3-11 9c0 3-2 5-6 4z"/><path d="M15 9l4 4"/></svg>',
 shop:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 11h18l-1.5 11h-15z"/><path d="M9 11V8a5 5 0 0 1 10 0v3"/><path d="M11 16h6"/></svg>',
 back:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M11 7 5 13l6 6"/><path d="M5 13h12a6 6 0 0 1 0 12h-3"/></svg>',
 plus:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 7v14M7 14h14"/></svg>',
 help:'<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="10"/><path d="M10.8 11a3.3 3.3 0 1 1 4.6 3c-1 .5-1.4 1.1-1.4 2.2"/><path d="M14 19.6v.4"/></svg>',
 minus:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 14h14"/></svg>',
 fit:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 10V5h5M18 5h5v5M23 18v5h-5M10 23H5v-5"/></svg>'};
function btn(id,cls,icon,label,fn){const b=document.createElement('button');b.type='button';b.id=id;b.className=cls;b.innerHTML=ICON[icon]+'<span>'+label+'</span>';b.onclick=fn;return b;}
function build(){
 const dock=$('ttMainDock');if(!dock||$('ttHouseBtn'))return;
 const entry=btn('ttHouseBtn','tt-house-entry','house','小屋',enter);
 const hub=$('ttHubButton');if(hub)hub.after(entry);else dock.prepend(entry);
 dock.append(btn('ttHouseEdit','tt-house-only','brush','佈置',()=>setMode('edit')));
 dock.append(btn('ttHouseShop','tt-house-only tt-house-main','shop','家具店',openShop));
 const top=document.createElement('div');top.id='ttHouseTop';
 top.append(btn('ttHouseHelp','tt-house-btn','help','教學',houseTour),btn('ttHouseBack','tt-house-btn','back','回大廳',exit));
// v495 D：右邊的放大／縮小／整間拿掉（滾輪縮放、按住拖曳照樣能用），「我的家具」改成右側整欄
 const bag=document.createElement('section');bag.id='ttHouseBag';bag.setAttribute('aria-label','我的家具');
 bag.innerHTML='<header><span class="tt-hb-title"><b>我的家具</b><small>MY FURNITURE</small></span><div class="tt-hb-acts"><button type="button" class="tt-hb-shop">去家具店</button><button type="button" class="tt-hb-done">完成</button></div><div class="tt-hb-tabs"></div></header>'
  +'<p class="tt-hb-tip">點家具拿出來，移到房間裡再點一下放好；點房間裡的家具可以移動。</p><div class="tt-hb-grid"></div>';
 bag.querySelector('.tt-hb-shop').onclick=openShop;bag.querySelector('.tt-hb-done').onclick=()=>setMode('walk');
 const keys=document.createElement('p');keys.id='ttHouseKeys';keys.setAttribute('aria-live','polite');
 document.body.append(top,bag,keys);renderKeys();
 // 家具店視窗：live.js 已經把 #houseShopM 包成大廳同一套外框，這裡換掉頁尾字、放內容
 const m=$('houseShopM');if(m){const c=m.querySelector('.panel-content')||m.querySelector('.gin');if(c&&!c.querySelector('.tt-house-shop')){c.innerHTML='<div class="tt-house-shop"></div>';}
   const back=m.querySelector('.back-menu');if(back)back.textContent='← 回小屋';}
}
function room(fn,...a){try{return S.frame?.contentWindow?.TTRoom?.[fn](...a);}catch(_){}}
// v495 D：畫面最下面常駐一行白字的玩法說明（跟著現在在做什麼換：散步／佈置／拿著家具）
const K=k=>'<kbd>'+k+'</kbd>';
function renderKeys(){const el=$('ttHouseKeys');if(!el)return;const hold=S.mode==='edit'&&!!room('holding');
 el.classList.toggle('edit',S.mode==='edit');
 el.innerHTML=S.mode!=='edit'?'點地板＝走過去　'+K('按住拖曳')+' 移動視角　'+K('滾輪')+' 放大縮小　按「佈置」開始擺家具'
  :hold?'移動滑鼠＝搬家具　'+K('點一下')+' 放好　'+K('R')+' 轉向　'+K('Delete')+' 收回背包　'+K('Esc')+' 取消'
  :'點右邊的家具＝拿出來　點房間裡的家具＝拿起來移動　'+K('按住拖曳')+' 移動視角　'+K('滾輪')+' 放大縮小';}

// ---------- 給房間（iframe）用的介面 ----------
window.TTHouse={
 initialLayout:()=>S.layout,
 save,
 changed:()=>{renderBag();renderKeys();},
 modeChanged:m=>{if(S.mode!==m){S.mode=m;document.body.classList.toggle('tt-house-edit',m==='edit');renderBag();}renderKeys();},
 dollCanvas:myDollCanvas,
 insets(){const vh=innerHeight,vw=innerWidth;let t=20,b=20,l=20,r=20;
  const sg=$('sign')?.getBoundingClientRect();if(sg&&sg.height)t=Math.max(t,sg.bottom+12);
  const hud=$('hud2')?.getBoundingClientRect();if(hud&&hud.height&&hud.right>vw*.3)t=Math.max(t,hud.bottom+8);
  const dk=$('ttMainDock')?.getBoundingClientRect();if(dk&&dk.height&&!document.body.classList.contains('tt-house-edit'))b=Math.max(b,vh-dk.top+10);
  const bag=$('ttHouseBag');if(bag&&document.body.classList.contains('tt-house-edit')){const q=bag.getBoundingClientRect();if(q.width)r=Math.max(r,vw-q.left+12);}   // 佈置：右側整欄
  return {t,b,l,r};},
 enter,exit,openShop,
 state:()=>({on:S.on,mode:S.mode,inv:S.inv})};
addEventListener('keydown',e=>{const t=e.target;if(!S.on||(t&&typeof t.closest==='function'&&t.closest('input,textarea')))return;
 if(S.mode==='edit'&&room('key',e.key)){e.preventDefault();renderKeys();return;}   // 焦點在大廳時，R／Delete／Esc 轉給房間
 if(e.key==='Escape'&&S.mode==='edit'&&!room('holding'))setMode('walk');});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
