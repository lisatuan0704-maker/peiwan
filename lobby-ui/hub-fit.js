/* v555 電腦版「一個版面看完、不用一直往下滑」（D 11/19：「東西都做太大，都要慢慢往下滑才看得到」）。
   只在電腦版（html.tt-desk，fixed-view.js 加的）生效，手機照舊。只改擺法：資料、寫入、按鈕的處理器全部是原本的。
   ・通訊錄（我的酒館）：左邊一排可以滑的名單，點誰右邊就打開跟誰的私訊（把原本的 #dmM 搬進右欄，離開就搬回去）。
   ・訂單（我的酒館）：左邊一疊票根（點單用收據票卡），滑過讓開、點了飛到右邊看整張（原本的票卡，按鈕照舊）。
   ・店長布告欄：左邊標題，點了右邊顯示內容。
   樣式在 lobby-ui/hub-fit.css。 */
(()=>{'use strict';
const desk=()=>document.documentElement.classList.contains('tt-desk');
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};

/* ---------- 通訊錄：左名單、右對話 ---------- */
let chatWith=null,chatKind=null;
const hubOpen=()=>{const h=$('ttHub');return !!h&&!h.hidden;};
function splitHost(){const fr=$('frM'),body=$('frBody');if(!desk()||!fr||!body||!fr.classList.contains('hub-embedded')||!hubOpen())return null;return body;}
function ensurePane(body){
 body.classList.add('tt-split');
 let pane=body.querySelector(':scope>.tt-chat-pane');
 if(!pane){pane=make('section','tt-chat-pane');pane.setAttribute('aria-label','私訊');
  const empty=make('div','tt-chat-empty');empty.append(make('small','','TAVERN · 私訊'),make('b','','選一位好友，開始聊天'),make('p','','點左邊的名字，對話會在這裡打開。'));
  pane.append(empty);body.append(pane);}
 return pane;
}
function paneActs(dm){
 const head=dm.querySelector('.gtop');if(!head)return;
 let box=head.querySelector('.tt-pane-acts');if(!box){box=make('div','tt-pane-acts');head.querySelector('.gx')?.before(box);}
 box.replaceChildren();
 if(chatKind!=='friend'||!chatWith)return;
 const ui=$('frBody')?._contacts,id=chatWith;
 const btn=(label,fn,cls)=>{const b=make('button','tt-pane-btn'+(cls?' '+cls:''),label);b.type='button';b.onclick=fn;box.append(b);};
 if(window.TTHouse)btn('小屋',()=>{try{window.TTHouse.visit(id,'friend');}catch(e){}});
 if(ui?.actions?.remove)btn('移除好友',()=>ui.actions.remove(id),'is-quiet');
 /* 原本在對話下方那條的「檢舉／封鎖」小三角，搬到標頭（下方那條收掉，對話多一點空間） */
 if(window.dmWarnMenu){const w=make('button','tt-pane-btn is-warn');w.type='button';w.title='檢舉或封鎖';w.setAttribute('aria-label','檢舉或封鎖');w.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2 L23 21 H1 Z" fill="#E14E6B"/><rect x="10.9" y="8.6" width="2.4" height="6.6" rx="1.2" fill="#fff"/><circle cx="12.1" cy="17.9" r="1.5" fill="#fff"/></svg>';w.onclick=()=>{window.dmWarnMenu(w);const m=document.getElementById('dmWarnM');if(m){const r=w.getBoundingClientRect();m.style.top=(r.bottom+6)+'px';m.style.left=Math.max(8,r.right-160)+'px';}};box.append(w);}
}
function mountDm(){
 const body=splitHost(),dm=$('dmM');if(!body||!dm)return false;
 const pane=ensurePane(body);
 if(dm.parentElement!==pane)pane.append(dm);
 dm.classList.add('tt-in-pane');paneActs(dm);mark();
 return true;
}
function unmountDm(){
 const dm=$('dmM');if(!dm||!dm.classList.contains('tt-in-pane'))return;
 dm.classList.remove('tt-in-pane');
 if(dm.classList.contains('on')){try{window.dmClose(true);}catch(e){}dm.classList.remove('on');}
 document.body.append(dm);chatWith=chatKind=null;
}
function mark(){
 const list=$('frBody')?.querySelector('.contacts-list');if(!list)return;
 const dm=$('dmM'),open=!!dm&&dm.classList.contains('tt-in-pane')&&dm.classList.contains('on');
 for(const a of list.querySelectorAll('.contact-entry')){const on=open&&a.dataset.contact===chatWith;a.classList.toggle('tt-picked',on);if(on)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');}
}
function bindContacts(){
 const body=$('frBody');if(!body||body._ttSplit)return!!body;body._ttSplit=true;
 body.addEventListener('click',e=>{
  if(!body.classList.contains('tt-split'))return;
  const row=e.target.closest('.contact-entry');if(!row||e.target.closest('button'))return;
  const kind=row.dataset.kind,id=row.dataset.contact,ui=body._contacts;if(!ui)return;
  if(kind==='friend')ui.actions.message(id);
  else if(kind==='staff')ui.actions.staffMessage?.(id);
 });
 new MutationObserver(()=>{if(body.classList.contains('tt-split'))mark();}).observe(body,{childList:true,subtree:true});
 return true;
}
/* 我的酒館在通訊錄分頁時，私訊視窗改開在右欄（不關掉我的酒館） */
function wrapOpen(){
 const og=window.gOpen;if(!og||og._ttSplit)return;
 const w=function(id){if(id==='dmM'&&splitHost()&&mountDm()){$('dmM').classList.add('on');mark();return;}return og.apply(this,arguments);};
 w._ttSplit=true;window.gOpen=w;
 for(const name of ['dmOpen','staffDmOpen']){const f=window[name];if(!f||f._ttSplit)continue;
  const g=function(k){chatWith=name==='dmOpen'?k:'staff_'+k;chatKind=name==='dmOpen'?'friend':'staff';const r=f.apply(this,arguments);const dm=$('dmM');if(dm?.classList.contains('tt-in-pane'))paneActs(dm);mark();return r;};
  g._ttSplit=true;window[name]=g;}
 const oc=window.dmClose;if(oc&&!oc._ttSplit){const c=function(){const r=oc.apply(this,arguments);mark();return r;};c._ttSplit=true;window.dmClose=c;}
}
/* 進出通訊錄分頁：開版面／把私訊搬回原位 */
function syncSplit(){
 const body=$('frBody');if(!body)return;
 if(splitHost()){ensurePane(body);bindContacts();}
 else{body.classList.remove('tt-split');unmountDm();}
}

/* ---------- 訂單：左邊一疊票根，滑過讓開、點了抽到右邊 ---------- */
/* D 11/19 草圖：票根一張疊一張、只露上緣；滑鼠停在哪張，上面的往上、下面的往下讓開，那張往右抽出一點；
   點了整張飛到右邊看詳情，原本右邊那張插回票堆。
   點單（冒險者委託／併桌）用定案票卡（lobby-ui/order-ticket.js：戊＋碎鑽亮片＋貓臉郵戳）；儲值等其他訂單用一般白卡。
   票面只是顯示：按鈕、語音房、回報都還是原本票卡上的那幾顆。 */
const TK_W=560,TK_H=210;
const ROMAN={'縭':'RIRA','蕪':'KABUKI','桃':'MOMO'};
const ICON={topup:'coin',member:'crown',table:'mug',dye:'dress'};
const WD=['SUN','MON','TUE','WED','THU','FRI','SAT'],p2=n=>String(n).padStart(2,'0');
function orderOf(oid){try{return (typeof myOrdersCache!=='undefined'&&myOrdersCache||{})[oid]||null;}catch(e){return null;}}
function iconFor(c){
 const t=c.dataset.type||'play',it=c.dataset.item||'',name=c.querySelector('.order-top h2')?.textContent||'';
 if(ICON[t])return ICON[t];
 if(/^house:/.test(it))return /座椅|椅/.test(name)?'chair':'house';
 if(/氣泡/.test(name))return 'chat';if(/染髮/.test(name)||it==='dyeTicket')return 'dress';
 if(/座椅/.test(name))return 'chair';return t==='shop'?'gift':'receipt';
}
/* 訂單 → 票面要印的字（只讀訂單，不改任何東西） */
function ticketData(c,o){
 const oid=c.dataset.oid||'',type=c.dataset.type||'play',who=type==='table'?'':(c.dataset.staffName||''),st=o.status||c.dataset.status||'';
 const t=Number(o.reserveAt||o.createdAt),d=new Date(Number.isFinite(t)&&t>0?t:Date.now()),made=new Date(Number(o.createdAt)||d.getTime());
 let seed=7;for(const ch of oid)seed=(seed*31+ch.charCodeAt(0))%2147483646;
 const cat=o.paidBy==='cat',amt=Number(cat?o.catAmount:o.amount)||0,unit=cat?'貓貓幣':o.paidBy==='wallet'?'金幣':'';
 const no0=(c.querySelector('.ticket-number code')?.textContent||'').trim(),no=no0&&!/待建立/.test(no0)?no0:'TT-'+oid.slice(-8).toUpperCase();
 const rows=type==='table'?[['桌次',o.itemName||o.planName||'併桌']]:[['冒險者',who?who+(ROMAN[who]?' '+ROMAN[who]:''):'不指定']];
 if(st==='cancelled'&&o.refunded)rows.push(['退款',cat?'已退回貓貓幣':'已退回錢包']);
 else if(o.game)rows.push(['想玩',o.game]);
 else if(Number(o.groupSize)>1)rows.push(['同組',o.groupSize+' 位冒險者']);
 return {n:ROMAN[who]||null,z:who||'酒館',m:d.getMonth()+1,d:d.getDate(),wd:WD[d.getDay()],hm:p2(d.getHours())+':'+p2(d.getMinutes()),
  plan:o.planName||c.querySelector('.order-top h2')?.textContent||'委託',price:amt.toLocaleString(),rows,
  total:unit?amt.toLocaleString()+' '+unit:'NT$ '+amt.toLocaleString(),no,seed:seed||7,
  stamp:st==='cancelled'?'void':st==='confirmed'||st==='done'?'paid':null,sm:made.getMonth()+1,sd:made.getDate()};
}
/* 一般白卡（儲值等）：圖示＋日期＋名稱＋進度＋金額 */
function plainFace(c){
 const st=c.dataset.status||'',f=make('div','tt-pf');f.dataset.st=st;
 const ic=make('img','tt-pf-ic');ic.src='lobby-ui/assets/'+iconFor(c)+'.png';ic.alt='';ic.draggable=false;
 const date=(c.querySelector('.ticket-date b')?.textContent||'—').trim(),time=(c.querySelector('.ticket-date span')?.textContent||'').trim();
 const body=make('div','tt-pf-body');
 body.append(make('small','tt-pf-date',date+' '+time),make('h3','',c.querySelector('.order-top h2')?.textContent||'訂單'),make('p','tt-pf-status',c.querySelector('.order-status')?.textContent||''));
 const price=c.querySelector('.order-top strong')?.textContent||'';if(price)body.append(make('span','tt-pf-price',price));
 f.append(ic,body);return f;
}
function faceOf(c){
 const type=c.dataset.type||'play',box=make('div','tt-tk-box'),sc=make('div','tt-tk-sc');box.append(sc);
 if((type==='play'||type==='table')&&window.TTTicket){
  const stg=make('div','tkr-stage');stg.innerHTML=TTTicket.build(ticketData(c,orderOf(c.dataset.oid)||{}));sc.append(stg);box.classList.add('is-ticket');
 }else sc.append(plainFace(c));
 return box;
}
const fitBox=(box,z)=>{box.style.width=Math.round(TK_W*z)+'px';box.style.height=Math.round(TK_H*z)+'px';box.firstChild.style.transform='scale('+z+')';};
/* 右邊攤開的票：滑鼠在上面時整張輕輕傾斜、光跟著走（D：薄薄的跟滑鼠動就好，不用 3D 厚度、不自己擺）。
   一個畫面最多算一次，只改 transform 跟兩個變數，不重畫票面 */
function bindTilt(box){
 const cd=box.querySelector('.tkr');if(!cd||box._tilt)return;box._tilt=true;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 let raf=0,px=.5,py=.5;
 const paint=()=>{raf=0;const mx=px*2-1,my=py*2-1;
  cd.style.transform='perspective(1200px) rotateX('+(-my*4).toFixed(2)+'deg) rotateY('+(mx*6).toFixed(2)+'deg)';
  cd.style.setProperty('--mx',mx.toFixed(3));cd.style.setProperty('--my',my.toFixed(3));};
 box.addEventListener('pointermove',e=>{const r=box.getBoundingClientRect();px=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));py=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));
  cd.classList.add('is-hov','is-live');if(!raf)raf=requestAnimationFrame(paint);});
 box.addEventListener('pointerleave',()=>{if(raf){cancelAnimationFrame(raf);raf=0;}cd.classList.remove('is-hov');cd.style.transform='';cd.style.removeProperty('--mx');cd.style.removeProperty('--my');
  setTimeout(()=>{if(!cd.classList.contains('is-hov'))cd.classList.remove('is-live');},400);});
}

let ordPick=null,ordHov=null;
function ordRail(){
 const list=$('ordList'),m=$('shopM4');if(!list)return;
 const on=desk()&&!!m&&m.classList.contains('hub-embedded');
 list.classList.toggle('tt-rail-mode',on);
 const cards=[...list.querySelectorAll(':scope>article.order')];
 let rail=list.querySelector(':scope>.tt-ord-rail');
 if(!on||!cards.length){rail?.remove();return;}
 const sig=cards.map(c=>[c.dataset.oid,c.dataset.status,c.querySelector('.order-status')?.textContent,c.querySelector('.ticket-number code')?.textContent,c.querySelectorAll('[data-order-action]').length].join(':')).join('|');   // 不看 class（tt-pulled 會變）
 if(!rail||rail.dataset.sig!==sig){
  rail?.remove();rail=make('div','tt-ord-rail');rail.setAttribute('aria-label','訂單票根');rail.dataset.sig=sig;
  cards.forEach((c,i)=>{
   c.querySelector(':scope>.tt-tk-box')?.remove();const face=faceOf(c);c.prepend(face);bindTilt(face);
   const item=faceOf(c);item.classList.add('tt-stack-item');item.dataset.oid=c.dataset.oid||'';item.style.zIndex=String(i+1);item.tabIndex=0;item.setAttribute('role','button');
   item.setAttribute('aria-label',(c.querySelector('.order-top h2')?.textContent||'訂單')+'，'+(c.querySelector('.ticket-date b')?.textContent||'')+' '+(c.querySelector('.ticket-date span')?.textContent||''));
   const go=()=>pickOrder(item.dataset.oid);
   item.addEventListener('click',go);item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
   item.addEventListener('mouseenter',()=>hoverStack(item));item.addEventListener('focus',()=>hoverStack(item));item.addEventListener('blur',()=>hoverStack(null));
   rail.append(item);});
  rail.addEventListener('mouseleave',()=>hoverStack(null));
  rail.append(make('p','tt-rail-solo','只有這一張票根，已經抽到右邊了'));
  list.prepend(rail);
 }
 paintPick();
}
/* 票堆排法：每張只露出上緣（露多少看高度夠不夠），最下面那張整張看得到 */
function stackLayout(){
 const list=$('ordList'),rail=list?.querySelector(':scope>.tt-ord-rail');if(!rail)return;
 const items=[...rail.querySelectorAll(':scope>.tt-stack-item')].filter(x=>!x.classList.contains('is-on'));
 rail.classList.toggle('is-solo',!items.length);
 const colW=rail.clientWidth||300,z=Math.min(.86,Math.max(.4,(colW-8)/(TK_W*1.14))),w=TK_W*z,h=TK_H*z;
 const host=list.closest('.hub-mount')||$('shopM4'),bottom=host?host.getBoundingClientRect().bottom:innerHeight,top=rail.getBoundingClientRect().top;
 const PAD=18,push=Math.round(h*.5),avail=Math.max(h+push+PAD,bottom-top-16);
 const n=items.length,peek=n>1?Math.max(30,Math.min(h*.46,(avail-PAD-h-push)/(n-1))):0;
 rail._st={z,w,h,peek,push,slide:Math.round(w*.13)};
 items.forEach((it,i)=>{fitBox(it,z);it.style.top=Math.round(PAD+i*peek)+'px';it.dataset.i=String(i);});
 rail.style.height=Math.round(PAD+(n?(n-1)*peek+h:0)+push)+'px';
 hoverStack(ordHov&&ordHov.isConnected&&!ordHov.classList.contains('is-on')?ordHov:null);
}
function hoverStack(item){
 const rail=$('ordList')?.querySelector(':scope>.tt-ord-rail');if(!rail||!rail._st)return;
 ordHov=item;const st=rail._st,k=item?+item.dataset.i:-1;
 const down=Math.max(0,Math.min(st.push,Math.round(st.h*.9-st.peek)));   // 下面的讓開到幾乎整張看得到
 for(const it of rail.querySelectorAll(':scope>.tt-stack-item')){
  if(it.classList.contains('is-on'))continue;const i=+it.dataset.i;
  it.classList.toggle('is-hov',i===k);
  it.style.transform=k<0?'':i<k?'translateY(-14px)':i>k?'translateY('+down+'px)':'translateX('+st.slide+'px)';
 }
}
/* 點了：那張從票堆飛到右邊（先往右抽、再放大落位），票堆其他張補位，原本右邊那張插回去 */
function pickOrder(oid){
 const list=$('ordList');if(!list||ordPick===oid)return;const rail=list.querySelector(':scope>.tt-ord-rail');
 const before=new Map();rail?.querySelectorAll(':scope>.tt-stack-item').forEach(it=>{if(!it.classList.contains('is-on'))before.set(it.dataset.oid,it.getBoundingClientRect());});
 const oldBox=list.querySelector(':scope>article.order.tt-pulled>.tt-tk-box'),oldRect=oldBox?.getBoundingClientRect(),oldOid=ordPick;
 ordPick=oid;ordHov=null;paintPick();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const art=list.querySelector(':scope>article.order.tt-pulled');
 const nb=art?.querySelector(':scope>.tt-tk-box'),from=before.get(oid);
 if(nb&&from)fly(nb,from,true);
 art?.querySelectorAll(':scope>.ticket-body').forEach(b=>b.animate([{opacity:0,transform:'translateY(10px)'},{opacity:0,offset:.45,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:640,easing:'ease-out'}));
 rail?.querySelectorAll(':scope>.tt-stack-item').forEach(it=>{if(it.classList.contains('is-on'))return;
  if(it.dataset.oid===oldOid&&oldRect)fly(it,oldRect,false);else{const b=before.get(it.dataset.oid);if(b)fly(it,b,false);}});
}
function fly(el,from,pull){
 const to=el.getBoundingClientRect();if(!to.width||!from.width)return;
 const s=from.width/to.width,dx=from.left-to.left,dy=from.top-to.top;if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(s-1)<.01)return;
 const end=el.style.transform||'none',at=(x,y,sc,r)=>'translate('+x+'px,'+y+'px) scale('+sc+')'+(r?' rotate('+r+'deg)':'');
 el.animate(pull?[{transformOrigin:'0 0',transform:at(dx,dy,s)},{transformOrigin:'0 0',offset:.28,transform:at(dx+from.width*.22,dy-6,s*1.02,-2.5)},{transformOrigin:'0 0',transform:end}]
  :[{transformOrigin:'0 0',transform:at(dx,dy,s)},{transformOrigin:'0 0',transform:end}],{duration:pull?680:420,easing:'cubic-bezier(.22,.8,.25,1.04)'});
}
function paintPick(){
 const list=$('ordList');if(!list)return;const cards=[...list.querySelectorAll(':scope>article.order')];if(!cards.length)return;
 if(!cards.some(c=>c.dataset.oid===ordPick))ordPick=cards[0].dataset.oid||'';
 for(const c of cards)c.classList.toggle('tt-pulled',c.dataset.oid===ordPick);
 for(const it of list.querySelectorAll('.tt-stack-item')){const on=it.dataset.oid===ordPick;it.classList.toggle('is-on',on);it.setAttribute('aria-pressed',String(on));if(on)it.style.transform='';}
 list.classList.toggle('tt-solo',cards.length<2);   // 只有一張：不留空票堆、置中放大
 const pulled=list.querySelector(':scope>article.order.tt-pulled'),box=pulled?.querySelector(':scope>.tt-tk-box');
 if(box){const w=pulled.clientWidth||TK_W;fitBox(box,Math.min(1.16,Math.max(.6,(w-4)/TK_W)));}
 stackLayout();
}
addEventListener('resize',()=>{if($('ordList')?.classList.contains('tt-rail-mode'))paintPick();});

/* ---------- 店長布告欄：左標題、右內容 ---------- */
function bindBoard(){
 const body=$('boardBody');if(!body||body._ttSplit)return;body._ttSplit=true;
 const pick=a=>{for(const x of body.querySelectorAll(':scope>.acc'))x.classList.toggle('tt-sel',x===a);};
 body.addEventListener('click',e=>{if(!desk())return;const h=e.target.closest('.accH');if(!h||h.parentElement?.parentElement!==body)return;e.stopPropagation();pick(h.parentElement);},true);
 const first=()=>{if(!desk())return;if(!body.querySelector(':scope>.acc.tt-sel')){const f=body.querySelector(':scope>.acc');if(f)pick(f);}};
 new MutationObserver(first).observe(body,{childList:true});first();
}

function boot(){
 wrapOpen();bindContacts();bindBoard();
 const fr=$('frM'),hub=$('ttHub');
 if(fr&&!fr._ttObs){fr._ttObs=true;new MutationObserver(syncSplit).observe(fr,{attributes:true,attributeFilter:['class']});}
 if(hub&&!hub._ttObs){hub._ttObs=true;new MutationObserver(syncSplit).observe(hub,{attributes:true,attributeFilter:['hidden']});}
 const ol=$('ordList');if(ol&&!ol._ttObs){ol._ttObs=true;new MutationObserver(()=>ordRail()).observe(ol,{childList:true});}
 const m4=$('shopM4');if(m4&&!m4._ttObs){m4._ttObs=true;new MutationObserver(()=>ordRail()).observe(m4,{attributes:true,attributeFilter:['class']});}
 syncSplit();ordRail();
}
/* frM、dmM 第一次打開才建立 → 等它們出現 */
boot();let tries=0;const t=setInterval(()=>{boot();if(++tries>40||($('frM')&&$('dmM')&&$('boardBody')&&$('ordList')))clearInterval(t);},500);
document.addEventListener('click',()=>setTimeout(boot,0),true);
window.TTHubFit={sync:()=>{syncSplit();ordRail();}};
})();
