/* v539 手機遊戲式直立畫面（試做，fixed-view.js 的 window.TTGame）：
   大廳場景滿版、鏡頭跟著自己的小人，介面浮在上面（上方名牌與金幣、下排功能列＋選單、聊天）。
   浮空搖桿（TTJoy）：手指在場景任一處按住滑動就出現搖桿，滑動方向＝走路方向，放開就消失；只點一下（沒滑動）照常＝點小人、點地板、點家具。
   大廳：lobby.html tick 讀 TTJoy.vec()（跟方向鍵同一條路，位置回報照方向鍵的規則）；小屋：搖桿綁在房間 iframe 上，交給 TTRoom.joy()。
   功能頁（訂單／私訊／儲值／信箱）沿用手機功能首頁 mobile-app.js：按「選單」蓋上來，「回到酒館」收起來（TTMobileApp.open／close）。 */
(()=>{'use strict';
if(!window.TTGame)return;
const $=id=>document.getElementById(id);
const root=document.documentElement;
const fmt=n=>Number(n||0).toLocaleString('zh-TW');
window.TTGameLow=(navigator.deviceMemory>0&&navigator.deviceMemory<=3)||(navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4);   // 低階手機：lobby.html tick 改約 30 幀

/* ---------- 浮空搖桿 ---------- */
const R=58,START=12;   // 搖桿半徑、滑多遠才算搖桿（之內＝點一下）
let J=null;            // {id,ox,oy,x,y,on,win,off:[dx,dy]}
const vec={x:0,y:0,m:0,on:false};
const ui=document.createElement('div');ui.id='ttJoy';ui.setAttribute('aria-hidden','true');ui.innerHTML='<i class="tt-joy-ring"></i><i class="tt-joy-knob"></i>';
const knob=ui.querySelector('.tt-joy-knob');
function paint(){if(!J||!J.on){ui.classList.remove('on');return;}
 ui.classList.add('on');ui.style.left=(J.ox+J.off[0])+'px';ui.style.top=(J.oy+J.off[1])+'px';
 let dx=J.x-J.ox,dy=J.y-J.oy;const L=Math.hypot(dx,dy);if(L>R){dx*=R/L;dy*=R/L;}knob.style.transform='translate('+dx+'px,'+dy+'px)';}
function update(){if(!J||!J.on){vec.x=vec.y=vec.m=0;vec.on=false;return;}
 const dx=J.x-J.ox,dy=J.y-J.oy,L=Math.hypot(dx,dy);if(L<8){vec.x=vec.y=vec.m=0;vec.on=false;return;}
 let x=dx/L,y=dy/L;if(Math.abs(x)<.2)x=0;if(Math.abs(y)<.2)y=0;   // 幾乎正上下／正左右就當正的，免得斜向來回抖、一直送位置
 const n=Math.hypot(x,y)||1;vec.x=x/n;vec.y=y/n;vec.m=Math.min(1,L/R);vec.on=true;}
let swallowUntil=0;   // 搖桿放開後吞掉接著來的 click（不然會變成點地板／點小人）
/* bind：在某個文件（大廳或房間 iframe）的某塊區域上綁搖桿；ok() 回傳現在能不能用搖桿；off() 回傳這個文件左上角在大廳畫面上的位置 */
function bind(win,area,{ok,off}){
 const doc=win.document;
 const down=e=>{if(J||!e.isPrimary||e.button>0)return;if(!ok(e))return;const t=e.target;
   if(t.closest&&t.closest('button,a,input,textarea,select,[role=button],.agent-hit'))return;
   if(!area().contains(t))return;
   J={id:e.pointerId,ox:e.clientX,oy:e.clientY,x:e.clientX,y:e.clientY,on:false,win,off:off(),tgt:t};};
 const move=e=>{if(!J||J.win!==win||e.pointerId!==J.id)return;J.x=e.clientX;J.y=e.clientY;
   if(!J.on&&Math.hypot(J.x-J.ox,J.y-J.oy)>START){J.on=true;try{J.tgt.setPointerCapture?.(J.id);}catch(_){}}
   if(J.on){e.stopImmediatePropagation();e.preventDefault();update();paint();}};
 const up=e=>{if(!J||J.win!==win||e.pointerId!==J.id)return;const was=J.on;J=null;update();paint();
   if(was){e.stopImmediatePropagation();e.preventDefault();swallowUntil=performance.now()+450;}};
 win.addEventListener('pointerdown',down,true);win.addEventListener('pointermove',move,{capture:true,passive:false});
 win.addEventListener('pointerup',up,true);win.addEventListener('pointercancel',up,true);
 win.addEventListener('click',e=>{if(performance.now()<swallowUntil){e.stopImmediatePropagation();e.preventDefault();swallowUntil=0;}},true);
 win.addEventListener('blur',()=>{if(J&&J.win===win){J=null;update();paint();}});
 try{(doc.documentElement).style.touchAction='none';}catch(_){}}
window.TTJoy={vec:()=>vec.on&&!root.classList.contains('ttg-panel')?vec:null,bind,active:()=>vec.on};

/* ---------- 介面（v560 D 定案「A1 店內視窗風」：照電腦版商城視窗——白紙深藍框、粉白藍航空信條紋邊、英文小標、店裡的像素圖示；
   下排中間的扭蛋用 A2 的粉色菱形＋PICK UP! 緞帶）。上方名牌＋金幣（＋＝儲值）、右側活動鈕（每日任務／掛機收益／信箱／私訊）、左下聊天、下排五顆。 ---------- */
const ICON={chat:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-4 4v-4H4z"/></svg>'};
const SIDE=[['daily','每日任務'],['idle','掛機收益'],['mail','信箱'],['chat','私訊']];
const hud=document.createElement('div');hud.id='ttG';
hud.innerHTML='<div class="ttg-top">'
 +'<button type="button" class="ttg-me" id="ttgMe" aria-label="我的闆卡"><span class="ttg-ava"><canvas id="ttgDoll" width="64" height="64"></canvas></span>'
 +'<span class="ttg-who"><small>MY TINY TAVERN</small><b id="ttgName">酒館客人</b><em id="ttgVip" hidden></em></span></button>'
 +'<div class="ttg-coins" id="ttgCoins">'
 +'<button type="button" class="ttg-c" data-wallet aria-label="金幣，點一下去儲值"><i class="ttg-gold"></i><b id="ttgGold">0</b><span class="ttg-plus" aria-hidden="true"></span></button>'
 +'<button type="button" class="ttg-c" data-wallet aria-label="貓貓幣，點一下打開錢包"><i class="ttg-cat"></i><b id="ttgCat">0</b><span class="ttg-plus" aria-hidden="true"></span></button></div>'
 +'</div>'
 +'<nav class="ttg-side" id="ttgSide" aria-label="活動">'+SIDE.map(([k,l])=>'<button type="button" data-side="'+k+'"><i class="ttg-ic" data-ic="'+k+'" aria-hidden="true"></i><span>'+l+'</span>'
   +(k==='idle'?'<i class="ttg-mini" aria-hidden="true"><i></i></i>':'')+'<b class="ttg-dot" hidden></b></button>').join('')+'</nav>'
 +'<div class="ttg-bar" id="ttgBar" aria-hidden="true"><img class="ttg-peek" src="lobby-ui/assets/theme/peek-line.png" alt=""></div>'
 +'<button type="button" class="ttg-chatbtn" id="ttgChat" aria-label="說點什麼"><span>說點什麼…</span>'+ICON.chat+'</button>';
document.body.append(hud,ui);
try{if(window.TTCat){$('ttgCoins').querySelector('.ttg-gold').outerHTML=TTCat.gold(18,'c');$('ttgCoins').querySelector('.ttg-cat').outerHTML=TTCat.coin(18,'c','data-cat-pop');
 hud.querySelector('[data-ic=idle]').innerHTML=TTCat.coin(30,'c');}}catch(_){}
// 下排：沿用大廳的 #ttMainDock（小屋、商城、背包、扭蛋；小屋裡換成光效、佈置、商城、扭蛋、擴建），最右邊放「選單」
const menuBtn=document.createElement('button');menuBtn.type='button';menuBtn.id='ttgMenu';menuBtn.className='ttg-menu';menuBtn.setAttribute('aria-label','選單：訂單、私訊、儲值、信箱');
menuBtn.innerHTML='<span class="tt-dock-label">選單</span><b class="ttg-dot" hidden></b>';
function dockKit(){const d=$('ttMainDock');if(!d)return;if(menuBtn.parentNode!==d)d.append(menuBtn);
 const g=$('ttHouseGacha');if(g&&!g.querySelector('.ttg-gem'))g.insertAdjacentHTML('afterbegin','<i class="ttg-gem" aria-hidden="true"></i><i class="ttg-pick" aria-hidden="true">PICK UP!</i>');}
dockKit();setTimeout(dockKit,400);setTimeout(dockKit,1500);
// 名牌：用手機首頁畫好的小人與數字（每 0.7 秒看一次，有變才改畫面）
let lastVip=-1,lastIdle='',lastFrame='';
/* v560 第三輪：名牌頭像套上現在戴的頭像框（跟電腦版左上角同一套 ttFrame：花圈框會動、VIP／冒險者框是繪師圖；有頭貼放頭貼） */
function paintFrame(){
 const host=hud.querySelector('.ttg-ava');if(!host||typeof window.ttFrame!=='function')return;
 let cf='wr1',art=null,ph='';
 try{cf=window.__curFrame?.()||'wr1';if(cf!=='wr1'&&window.__frameUsable?.()&&window.TTF_ART?.[cf])art=cf;}catch(_){}
 try{ph=typeof window.ttMyPhoto==='function'?window.ttMyPhoto()||'':'';}catch(_){}
 const sig=(art||'wr1')+'|'+ph;if(sig===lastFrame)return;lastFrame=sig;
 let still=!!window.TTGameLow;try{still=still||matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){}
 const inner=window.ttFrame(host,art?{art,photo:!!ph}:{anim:!still});
 const c=document.createElement('canvas');c.id='ttgDoll';c.width=c.height=64;inner.append(c);
 if(ph){const im=document.createElement('img');im.alt='';im.src=ph;im.onerror=()=>im.remove();inner.append(im);}}
function paintMe(){
 dockKit();paintFrame();
 const src=$('ttmDoll'),dst=$('ttgDoll');if(src&&dst&&!root.classList.contains('ttg-panel')){const g=dst.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,64,64);try{g.drawImage(src,0,0,64,64);}catch(_){}}
 const n=$('ttmName')?.textContent;if(n&&$('ttgName').textContent!==n)$('ttgName').textContent=n;
 const g1=fmt(window.__wallet),c1=fmt(window.__cat);if($('ttgGold').textContent!==g1)$('ttgGold').textContent=g1;if($('ttgCat').textContent!==c1)$('ttgCat').textContent=c1;
 let lv=0;try{lv=window.__vipInfo?.()?.lv||0;}catch(_){}
 if(lv!==lastVip){lastVip=lv;const v=$('ttgVip');v.hidden=!lv;v.textContent='VIP '+lv;}
 const bs=window.TTMobileApp?.badges?.()||[],on=k=>!!bs.find(b=>b.key===k&&b.on);
 menuBtn.querySelector('.ttg-dot').hidden=!bs.some(b=>b.on);
 hud.querySelector('[data-side=mail] .ttg-dot').hidden=!on('mail');
 hud.querySelector('[data-side=chat] .ttg-dot').hidden=!on('chat');
 const dl=$('ttmDaily');hud.querySelector('[data-side=daily] .ttg-dot').hidden=!(dl&&!dl.hidden&&!dl.classList.contains('done'));
 let c=null;try{c=window.TTIdle?.calc?.();}catch(_){}
 const sig=c?Math.round(c.pct)+'|'+(c.full?1:0):'';if(sig!==lastIdle){lastIdle=sig;const t=hud.querySelector('[data-side=idle]');t.querySelector('.ttg-mini>i').style.width=(c?Math.round(c.pct):0)+'%';t.querySelector('.ttg-dot').hidden=!(c&&c.full);t.classList.toggle('full',!!(c&&c.full));}
 const inHouse=document.body.classList.contains('tt-house-on');root.classList.toggle('ttg-house',inHouse);
 root.classList.toggle('ttg-edit',inHouse&&document.body.classList.contains('tt-house-edit'));
 root.classList.toggle('ttg-visit',inHouse&&document.body.classList.contains('tt-house-visit'));}
setInterval(paintMe,700);setTimeout(paintMe,300);
const app=()=>window.TTMobileApp;
hud.querySelectorAll('[data-wallet]').forEach(b=>b.onclick=()=>app()?.open('wallet'));
hud.querySelector('#ttgSide').addEventListener('click',e=>{const b=e.target.closest('[data-side]');if(!b)return;const k=b.dataset.side;
 if(k==='mail'||k==='chat')app()?.open(k);else app()?.open(null,k==='daily'?'ttmDaily':'ttmIdle');});
// 選單：沒開＝打開「我的酒館」；開著在某一頁＝回「我的酒館」；已經在「我的酒館」＝收起來
menuBtn.onclick=()=>{const a=app();if(!a)return;if(!root.classList.contains('ttg-panel'))a.open();else if(a.current)a.home();else a.close();};
// 功能頁開著時按下排其他鈕（小屋、商城、扭蛋…）：先收起功能頁再照常動作
document.addEventListener('click',e=>{const b=e.target.closest?.('#ttMainDock>button');if(!b||b===menuBtn)return;if(root.classList.contains('ttg-panel'))app()?.close();},true);
// 闆卡（一頁看完的直立排版）：名字長的時候字縮小到整個放得下，不切成「…」
{const pc=$('pcard');if(pc)new MutationObserver(()=>requestAnimationFrame(()=>{const n=pc.querySelector('.pcName');if(!n)return;n.style.removeProperty('font-size');
 for(let f=19;f>=13&&n.scrollWidth>n.clientWidth+1;f--)n.style.setProperty('font-size',f+'px','important');})).observe(pc,{childList:true});}
$('ttgMe').onclick=()=>{const a=typeof me==='function'?me():null;if(a&&typeof openCard==='function')openCard(a);};
// v560 第三輪：聊天氣泡小視窗（首頁 08）——清單、換上、購買都用大廳原本的（bkBubbleRender／bkBubbleTap：50 金幣購買照舊走原本的付款與確認框）
const bubM=document.createElement('div');bubM.className='gwin';bubM.id='ttgBubM';bubM.setAttribute('role','dialog');bubM.setAttribute('aria-label','聊天氣泡');
bubM.innerHTML='<div class="gcard"><div class="gtop"><span class="gt">聊天氣泡</span><button type="button" class="gx" aria-label="關閉">✕</button></div><div class="gin">'
 +'<div class="ghint">點一下已經有的氣泡就會換上，大家在大廳看到你頭上的就是這一款。</div><div class="ttg-bublist"></div>'
 +'<div class="ttg-bubhow">白色基本框免費；六款漸層氣泡各 50 金幣，買一次永久持有。<br>奶霜小貓 VIP 1、花茶小兔 VIP 2、蜜桃小鳥 VIP 3 解鎖。</div></div></div>';
document.body.append(bubM);
const bubList=bubM.querySelector('.ttg-bublist');
// 原本的清單畫在 id＝bkBubList 的地方 → 視窗開著才借用這個 id，關掉就還回去（不跟手帳那一頁搶）
new MutationObserver(()=>{if(!bubM.classList.contains('on')&&bubList.id)bubList.removeAttribute('id');}).observe(bubM,{attributes:true,attributeFilter:['class']});
bubM.addEventListener('click',e=>{if(e.target===bubM||e.target.closest('.gx'))bubM.classList.remove('on');});
window.TTGameUI={openBubbles(){if(!document.getElementById('bkBubList'))bubList.id='bkBubList';try{window.bkBubbleRender?.();}catch(_){}bubM.classList.add('on');}};
// 聊天：點「說點什麼」打開輸入列（大廳＝原本的 #chatbox，小屋＝小屋聊天）
$('ttgChat').onclick=()=>{
 if(document.body.classList.contains('tt-house-on')){root.classList.add('ttg-hchat');setTimeout(()=>$('ttHouseSay')?.focus(),30);return;}
 root.classList.add('ttg-chat');setTimeout(()=>$('chatin')?.focus(),30);};
const closeChat=()=>root.classList.remove('ttg-chat','ttg-hchat');
document.addEventListener('pointerdown',e=>{if(!root.matches('.ttg-chat,.ttg-hchat'))return;if(e.target.closest('#chatbox,#ttHouseChat,#ttgChat,.ttc'))return;closeChat();},true);
addEventListener('keydown',e=>{if(e.key==='Escape')closeChat();});

/* ---------- 大廳搖桿 ---------- */
function lobbyOk(){return !document.body.classList.contains('tt-house-on')&&!root.classList.contains('ttg-panel')&&!(typeof cardOpen!=='undefined'&&cardOpen)&&!(window.TinyTavernUI?.isActive?.());}
function start(){const hall=$('hall');if(!hall)return setTimeout(start,200);
 bind(window,()=>hall,{ok:lobbyOk,off:()=>[0,0]});
 hall.style.touchAction='none';}
start();

/* ---------- 小屋：房間 iframe 一打開就綁搖桿 ---------- */
let boundFrame=null;
setInterval(()=>{const f=$('ttHouseFrame');if(!f||f===boundFrame)return;
 const w=f.contentWindow;if(!w||!w.TTRoom||!w.document.body)return;boundFrame=f;
 const room=()=>w.TTRoom;
 bind(w,()=>w.document.body,{ok:()=>room().mode()==='walk'&&!root.classList.contains('ttg-panel'),off:()=>{const r=f.getBoundingClientRect();return [r.left,r.top];}});
 try{room().follow?.(true);}catch(_){}
 (function loop(){if(boundFrame!==f||!f.isConnected)return;try{const v=vec.on?vec:null;room().joy?.(v?v.x:0,v?v.y:0,v?v.m:0);}catch(_){}requestAnimationFrame(loop);})();
},400);

/* ---------- 小屋佈置：拿著家具時（電腦是 R／Delete／Esc）
   v560 D：「選中家具後下方家具列表先暫時消失，家具上方三格小圓形圖示對應三個功能，選完後列表再上拉回原來位置」
   → 拿著家具時 html.ttg-holding（#ttHouseBag 往下滑走），三顆小圓鈕跟著家具走；放好／收回／取消後列表滑回來。
   第三輪 D：「應該是三個小小的按鈕跟著家具底下」→ 28px、貼在家具下緣。 ---------- */
const TI={r:'<svg viewBox="0 0 24 24"><path d="M19.5 12.5A7.5 7.5 0 1 1 17 6.4"/><path d="M19.6 3.6v4.6H15"/></svg>',
 delete:'<svg viewBox="0 0 24 24"><path d="M4.5 9.5h15l-1.4 10h-12.2z"/><path d="M12 3.5v8.5"/><path d="m8.6 8.8 3.4 3.4 3.4-3.4"/></svg>',
 escape:'<svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>'};
const tools=document.createElement('div');tools.id='ttgTools';tools.hidden=true;tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','拿著的家具');
tools.innerHTML='<button type="button" data-k="r" aria-label="轉向" title="轉向">'+TI.r+'</button><button type="button" data-k="delete" aria-label="收回背包" title="收回">'+TI.delete+'</button><button type="button" data-k="escape" aria-label="取消" title="取消">'+TI.escape+'</button>';
const holdTip=document.createElement('div');holdTip.id='ttgHoldTip';holdTip.hidden=true;holdTip.textContent='拖到想放的地方，放開就放好';
document.body.append(tools,holdTip);
tools.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;const w=$('ttHouseFrame')?.contentWindow;try{w?.TTRoom?.key(b.dataset.k);window.TTHouse?.changed?.();}catch(_){}holdLoop();});
let holdRaf=0;
function holdLoop(){holdRaf=0;const f=$('ttHouseFrame');let box=null;
 try{if(document.body.classList.contains('tt-house-edit'))box=f?.contentWindow?.TTRoom?.heldBox?.()||null;}catch(_){}
 const on=!!box;if(root.classList.contains('ttg-holding')!==on)root.classList.toggle('ttg-holding',on);tools.hidden=!on;holdTip.hidden=!on;
 if(!on)return;
 const r=f.getBoundingClientRect(),w=tools.offsetWidth||102,h=tools.offsetHeight||28;
 let x=r.left+box.x,y=r.top+box.b+h/2+6;if(y+h/2>Math.min(r.bottom,innerHeight)-10)y=r.top+box.y-h/2-6;   // 貼在家具底下（D 第三輪）；太靠畫面下緣才改放家具上面
 x=Math.max(w/2+8,Math.min(innerWidth-w/2-8,x));y=Math.max(h/2+60,Math.min(innerHeight-h/2-12,y));
 tools.style.transform='translate('+Math.round(x-w/2)+'px,'+Math.round(y-h/2)+'px)';
 const rot=tools.querySelector('[data-k=r]');if(rot.disabled!==box.wall)rot.disabled=box.wall;
 holdRaf=requestAnimationFrame(holdLoop);}
setInterval(()=>{if(!holdRaf)holdLoop();},250);
})();
