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

/* ---------- 介面 ---------- */
const ICON={
 menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
 send:'<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-5 16-3-7z"/><path d="m12 13 8-9"/></svg>',
 chat:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-4 4v-4H4z"/></svg>'};
const hud=document.createElement('div');hud.id='ttG';
hud.innerHTML='<div class="ttg-top">'
 +'<button type="button" class="ttg-me" id="ttgMe" aria-label="我的闆卡"><canvas id="ttgDoll" width="64" height="64"></canvas><b id="ttgName">酒館客人</b></button>'
 +'<button type="button" class="ttg-coins" id="ttgCoins" aria-label="金幣與貓貓幣，點一下打開錢包"><span class="ttg-c"><i class="ttg-gold"></i><b id="ttgGold">0</b></span><span class="ttg-c"><i class="ttg-cat"></i><b id="ttgCat">0</b></span></button>'
 +'</div>'
 +'<div class="ttg-bar" id="ttgBar"><button type="button" class="ttg-menu" id="ttgMenu" aria-label="選單：訂單、私訊、儲值、信箱">'+ICON.menu+'<span>選單</span><b class="ttg-dot" hidden></b></button></div>'
 +'<div class="ttg-where" id="ttgWhere"></div>'
 +'<button type="button" class="ttg-chatbtn" id="ttgChat" aria-label="說點什麼">'+ICON.chat+'<span>說點什麼…</span></button>';
document.body.append(hud,ui);
try{if(window.TTCat){$('ttgCoins').querySelector('.ttg-gold').outerHTML=TTCat.gold(18,'c');$('ttgCoins').querySelector('.ttg-cat').outerHTML=TTCat.coin(18,'c','data-cat-pop');}}catch(_){}
// 名牌：用手機首頁畫好的小人與數字
function paintMe(){
 const src=$('ttmDoll'),dst=$('ttgDoll');if(src&&dst){const g=dst.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,64,64);try{g.drawImage(src,0,0,64,64);}catch(_){}}
 const n=$('ttmName')?.textContent;if(n&&$('ttgName').textContent!==n)$('ttgName').textContent=n;
 const g1=fmt(window.__wallet),c1=fmt(window.__cat);if($('ttgGold').textContent!==g1)$('ttgGold').textContent=g1;if($('ttgCat').textContent!==c1)$('ttgCat').textContent=c1;
 const dot=!!window.TTMobileApp?.badges?.().some(b=>b.on);hud.querySelector('.ttg-menu .ttg-dot').hidden=!dot;
 const inHouse=document.body.classList.contains('tt-house-on');root.classList.toggle('ttg-house',inHouse);
 root.classList.toggle('ttg-edit',inHouse&&document.body.classList.contains('tt-house-edit'));
 root.classList.toggle('ttg-visit',inHouse&&document.body.classList.contains('tt-house-visit'));}
setInterval(paintMe,700);setTimeout(paintMe,300);
$('ttgCoins').onclick=()=>window.TTMobileApp?.open('wallet');
$('ttgMenu').onclick=()=>window.TTMobileApp?.open();
$('ttgMe').onclick=()=>{const a=typeof me==='function'?me():null;if(a&&typeof openCard==='function')openCard(a);};
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

/* ---------- 小屋佈置：拿著家具時的觸控按鈕（電腦是 R／Delete／Esc） ---------- */
const tools=document.createElement('div');tools.id='ttgTools';tools.hidden=true;
tools.innerHTML='<button type="button" data-k="r">轉向</button><button type="button" data-k="delete">收回</button><button type="button" data-k="escape">取消</button><small>手指拖到想放的地方，放開就放好</small>';
document.body.append(tools);
tools.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;const w=$('ttHouseFrame')?.contentWindow;try{w?.TTRoom?.key(b.dataset.k);window.TTHouse?.changed?.();}catch(_){}});
setInterval(()=>{let hold=false;try{hold=!!$('ttHouseFrame')?.contentWindow?.TTRoom?.holding();}catch(_){}tools.hidden=!(hold&&document.body.classList.contains('tt-house-edit'));},250);
})();
