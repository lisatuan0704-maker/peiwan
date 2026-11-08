/* v508 隨機拜訪過場（D 11/08：隨機拜訪要跑過場動畫，過場時顯示要拜訪的人的頭像、頭像框和闆卡內容）。
   流程：open() → search(候選人) → show(這一間的資料) → 進得去：done(房間載好的 promise)／進不去：fail(原因) 再 search 下一間 → close()。
   八種樣式 A～H 共用同一張資料卡（頭像框＋全身小人＋名字、在家、VIP、房間大小、家具數、標籤、常玩、生日、一句話），
   各自換背景特效、出場與離場的動作。網址加 ?tripdemo=1 會出現試看面板（只有本機預覽用得到，不影響客人）。
   資料由 house.js 準備：{key,name,photo,doll,frm,vip,tags,games,bm,bd,quote,size,n,home}。 */
(function(){
'use strict';
const STYLES={A:'雜誌斜切',A1:'雜誌內頁',A2:'快門斜切',A3:'幾何動態',A4:'虹光毛玻璃',A5:'底片選角',A6:'雜誌全套',B:'抽牌翻面',C:'敲門開門',D:'小地圖',E:'星空傳送',F:'明信片',G:'拉霸轉盤',H:'雜誌封面'};
// A1～A6＝A 的加強版（D 11/08：喜歡 A，但可以更好；選定 A6），用功能組合：ax 共用加強、mz 雜誌卡、sh 快門色條、geo 幾何動態、gl 虹光毛玻璃、cs 底片選角
const VAR={A1:'ax mz',A2:'ax mz sh',A3:'ax mz geo',A4:'ax gl',A5:'ax mz cs',A6:'ax mz cs geo sh'};
// A 系列（底片版除外）只秀一個人：找的時候只有剪影＋問號，客滿的那間也不露臉，進得去的那一位才翻出資料卡
const ONE=()=>STYLE[0]==='A'&&!has('cs');
const has=f=>(' '+(VAR[STYLE]||'')+' ').includes(' '+f+' ');
let STYLE='A6';   // 正式使用的樣式（D 11/08 選 A6 雜誌全套）
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHOW_MIN=2600,EXIT_MS=760;   // 資料卡至少停 2.6 秒讓人看完；離場動畫時間
const FAIL_TEXT={full:['客滿','4 個位子都坐滿了，換一間'],kicked:['下次再來','主人請你先離開了，換一間'],denied:['沒開門','這間剛剛關起來了，換一間'],closed:['沒開門','這間現在沒有開放，換一間']};
const FAIL_EN={full:'FULL HOUSE',kicked:'SEE YOU',denied:'CLOSED',closed:'CLOSED'};
let R=null;   // 目前的過場

// ---------- 小頭像（候選人洗牌用）、資料卡 ----------
function mini(p){const d=document.createElement('div');d.className='tp-mini';
 if(p&&p.photo){const i=new Image();i.src=p.photo;i.alt='';i.onerror=()=>{i.remove();d.append(dollCv(p.doll));};d.append(i);}else d.append(dollCv(p&&p.doll));
 return d;}
function dollCv(doll){const c=document.createElement('canvas');c.width=c.height=64;try{window.drawDollTo&&drawDollTo(c,doll||{},'idle');}catch(_){}return c;}
function serial(p){return (String(p&&p.key||'').replace(/[^A-Za-z0-9]/g,'').slice(-4).toUpperCase()||'0001').padStart(4,'0');}   // 雜誌編號（闆卡鑰匙末四碼）
function vipChip(lv){const C=(window.__vipCfg||[])[lv-1];if(!lv||!C)return '';return '<span class="tp-b vip" style="--vc:'+esc(C.hex||'#C08CFF')+'">VIP '+lv+'・'+esc(C.nm||'')+'</span>';}
function fillCard(card,p){
 const tags=(Array.isArray(p.tags)?p.tags:[]).slice(0,5).map(t=>'<span class="tp-tag">'+esc(t)+'</span>').join('');
 const bday=p.bm&&p.bd?p.bm+' 月 '+p.bd+' 日':'—';
 card.innerHTML='<div class="tp-fr" aria-hidden="true"><i class="pg"></i><i class="ol"></i><i class="pp"></i></div>'
  +'<div class="tp-band" aria-hidden="true"><b>TINY HOME ✦ VISIT</b><i></i><span>No.'+esc(serial(p))+'</span></div>'
  +'<div class="tp-pic"><i class="tp-ring" aria-hidden="true"></i><div class="tp-frame"></div><canvas class="tp-doll" width="64" height="64" aria-hidden="true"></canvas><span class="tp-mark" aria-hidden="true"><b>TINY TAVERN</b><small>VISIT ✦ 隨機拜訪</small></span></div>'
  +'<div class="tp-info"><p class="tp-eye">RANDOM VISIT <i>／</i> 隨機拜訪</p>'
  +'<h2 class="tp-title"><b>'+esc(p.name||'旅人')+'</b><span>的小屋</span></h2>'
  +'<div class="tp-badges">'+(p.home?'<span class="tp-b home"><i></i>在家</span>':'<span class="tp-b away"><i></i>出門中</span>')+vipChip(+p.vip||0)
   +'<span class="tp-b">'+(+p.size||14)+'×'+(+p.size||14)+'</span><span class="tp-b">家具 '+(+p.n||0)+' 件</span></div>'
  +(tags?'<div class="tp-tags">'+tags+'</div>':'')
  +'<div class="tp-rows"><div><small>常玩</small><b>'+esc(p.games||'—')+'</b></div><div><small>生日</small><b>'+esc(bday)+'</b></div></div>'
  +'<p class="tp-quote">'+(p.quote?esc(p.quote):'<span>還沒有寫下什麼</span>')+'</p></div>';
 try{const host=card.querySelector('.tp-frame'),fid=window.ttFrameId?ttFrameId(p.frm):'wr1';let inner;
  if(fid==='wr1')inner=ttFrame(host,{anim:true,box:p.photo?(typeof TTF_CARDPIC!=='undefined'?TTF_CARDPIC:null):(typeof TTF_CARD!=='undefined'?TTF_CARD:null)});
  else inner=ttFrame(host,{art:fid,photo:!!p.photo});
  ttFill(inner,p.doll,p.photo||'');}catch(_){}
 try{drawDollTo(card.querySelector('.tp-doll'),p.doll||{},'idle');}catch(_){}}

// ---------- 各樣式的背景特效 ----------
const STAR='<svg viewBox="0 0 20 20"><path d="M10 0Q11 9 20 10Q11 11 10 20Q9 11 0 10Q9 9 10 0Z"/></svg>';
function stars(n,cls){let h='';for(let i=0;i<n;i++){const x=(i*37+13)%97,y=(i*53+29)%91,s=8+(i*7)%14,d=(i*0.37)%2.4;h+='<i class="'+(cls||'tp-star')+'" style="left:'+x+'%;top:'+y+'%;width:'+s+'px;height:'+s+'px;animation-delay:-'+d.toFixed(2)+'s">'+STAR+'</i>';}return h;}
const HOUSES=[[300,170,'#FFC6DD'],[620,470,'#D9C2FF'],[780,330,'#BDEBFF'],[420,250,'#FFE7A3'],[200,330,'#C9F0D2']].map(([x,y,c])=>'<g class="hut" transform="translate('+x+' '+y+')"><path d="M-22 0 L0 -20 L22 0 L22 22 L-22 22Z" fill="'+c+'"/><path d="M-6 22 V9 H6 V22" fill="#fff"/></g>').join('')
  +[[90,120],[930,420],[560,90],[700,560],[330,560]].map(([x,y])=>'<g class="tree" transform="translate('+x+' '+y+')"><circle r="16"/><rect x="-3" y="12" width="6" height="12"/></g>').join('');
const FX={
 A:()=>'<i class="band b1"></i><i class="band b2"></i><i class="band b3"></i><b class="word">VISIT</b><i class="line l1"></i><i class="line l2"></i>'+stars(5),
 B:()=>'<i class="glow"></i>'+stars(10)+'<i class="flash"></i>',
 C:()=>'<div class="door l"><i class="knob"></i><i class="plate">WELCOME</i></div><div class="door r"><i class="knob"></i></div><b class="knock">叩　叩</b>',
 D:()=>'<svg class="map" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"><path class="road" d="M140 500 C 260 380, 360 560, 480 420 S 700 200, 860 120"/><path class="trail" d="M140 500 C 260 380, 360 560, 480 420 S 700 200, 860 120"/>'
   +''+HOUSES+'<g class="pin me" transform="translate(140 500)"><circle r="20"/><text y="6">你</text></g><g class="pin to" transform="translate(860 120)"><circle r="24"/><text y="7">？</text></g>'
   +'<circle class="walker" r="11"><animateMotion dur="1.6s" fill="freeze" path="M140 500 C 260 380, 360 560, 480 420 S 700 200, 860 120"/></circle></svg>',
 E:()=>'<i class="sky"></i>'+stars(16,'tp-star w')+'<svg class="circle" viewBox="0 0 400 400"><circle cx="200" cy="200" r="190" class="c1"/><circle cx="200" cy="200" r="160" class="c2"/>'
   +'<path class="hex" d="M200 52 L328 126 L328 274 L200 348 L72 274 L72 126Z"/><path class="hex b" d="M200 52 L328 274 L72 274Z M200 348 L72 126 L328 126Z"/><circle cx="200" cy="200" r="60" class="c3"/></svg><i class="flash"></i>',
 F:()=>'<i class="desk"></i><i class="env"><i class="flap"></i></i>',
 G:()=>'<div class="machine"><i class="bulbs t"></i><i class="bulbs b"></i><b class="logo">LUCKY VISIT</b></div>',
 H:()=>'<b class="mast">TINY<br>HOME</b><span class="issue">VOL.11 ／ 隨機拜訪特輯</span><i class="block"></i><i class="bar"></i><b class="who">WHO\'S<br>NEXT?</b>'
};

// A 加強版的背景：色帶（或快門色條）＋細線＋幾何／星星
const GEO='<svg class="geo-l" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
 +'<path class="ln" d="M40 96 H250 L282 64 H330"/><path class="ln" d="M960 520 H760 L728 552 H690"/><path class="ln k" d="M70 560 V430"/><path class="ln k" d="M930 60 V170"/>'
 +'<g transform="translate(150 470)"><path class="dm" d="M0 -26 L26 0 L0 26 L-26 0Z"/></g><g transform="translate(870 130)"><path class="dm" d="M0 -20 L20 0 L0 20 L-20 0Z"/></g>'
 +'<g transform="translate(205 420)"><path class="dmf" d="M0 -9 L9 0 L0 9 L-9 0Z"/></g><g transform="translate(822 192)"><path class="dmf" d="M0 -7 L7 0 L0 7 L-7 0Z"/></g>'
 +'<g transform="translate(110 250)"><path class="tri" d="M0 -18 L16 12 L-16 12Z"/></g><g transform="translate(905 360)"><path class="tri b" d="M0 -14 L13 10 L-13 10Z"/></g>'
 +'<g transform="translate(840 480)"><circle class="cir" r="34"/></g><g transform="translate(270 140)"><circle class="cir" r="18"/></g>'
 +'<g class="plus" transform="translate(560 70)"><path d="M-7 0 H7 M0 -7 V7"/></g><g class="plus" transform="translate(430 545)"><path d="M-6 0 H6 M0 -6 V6"/></g></svg>'
 +'<i class="ht h1"></i><i class="ht h2"></i>';
function burst(){let h='';for(let i=0;i<12;i++)h+='<i class="s'+(i%3)+'" style="--a:'+(i*30+8)+'deg;--d:'+(430+(i*67)%240)+'px;animation-delay:'+(i%4)*40+'ms"></i>';return '<div class="burst">'+h+'</div>';}
function fxHtml(){if(!VAR[STYLE])return (FX[STYLE]||FX.A)();
 let h=has('sh')?'<div class="shut">'+'<i></i>'.repeat(9)+'</div>':'<i class="band b1"></i><i class="band b2"></i><i class="band b3"></i>';
 h+='<i class="line l1"></i><i class="line l2"></i>';
 return h+(has('geo')?GEO+stars(6)+burst():stars(has('gl')?10:6));}

// ---------- 主要流程 ----------
function build(){
 const root=document.createElement('div');root.id='ttTrip';root.className='v-'+STYLE+(VAR[STYLE]?' v-A '+VAR[STYLE]:'');root.dataset.st='search';root.setAttribute('role','status');root.setAttribute('aria-live','polite');
 root.innerHTML='<div class="tp-bg"></div><div class="tp-fx">'+fxHtml()+'</div>'
  +'<div class="tp-stage"><b class="tp-wmk" aria-hidden="true"></b><div class="tp-search"><div class="tp-slots"></div><div class="tp-sinfo"><b class="tp-sname"></b><small class="tp-scount"></small></div><p class="tp-msg">正在找開著門的小屋<i>.</i><i>.</i><i>.</i></p></div>'
  +'<article class="tp-card"></article><b class="tp-stamp"></b><p class="tp-go"><i></i><span>敲敲門中…</span></p></div>'
  +'<button type="button" class="tp-skip">略過 ›</button>';
 document.body.append(root);return root;}
function open(){close(true);R={root:build(),t0:0,skip:false,timer:0,closed:false};const r=R;
 r.root.querySelector('.tp-skip').onclick=()=>{r.skip=true;r.root.classList.add('skipped');};
 r.key=e=>{if(e.key==='Escape'){r.skip=true;r.root.classList.add('skipped');}};addEventListener('keydown',r.key,true);
 requestAnimationFrame(()=>requestAnimationFrame(()=>r.root.classList.add('on')));return r;}
const MSG='正在找開著門的小屋<i>.</i><i>.</i><i>.</i>';
function silhouette(){const c=document.createElement('canvas');c.width=c.height=64;   // 沒有臉的剪影（預設小人塗成深藍）
 try{window.drawDollTo&&drawDollTo(c,{},'idle');const x=c.getContext('2d');x.globalCompositeOperation='source-in';x.fillStyle='#1C2156';x.fillRect(0,0,64,64);}catch(_){}return c;}
// 找人：A6 底片版把候選人排成底片；其他 A 系列只有剪影＋問號、編號亂跳（不放其他老闆）；其他樣式把候選人的小頭像輪流換（拉霸是三排一起轉）
function search(cands){const r=R;if(!r)return Promise.resolve();r.root.dataset.st='search';clearInterval(r.timer);r.root.classList.remove('miss');r.pending=null;
 const box=r.root.querySelector('.tp-slots'),list=(cands||[]).filter(Boolean);box.innerHTML='';box.classList.remove('locked');r.root.querySelector('.tp-msg').innerHTML=MSG;
 if(has('cs')){   // 底片選角：候選人排成一條底片，取景框在格子間跳，選中時畫圈
  const shown=list.length?list.slice(0,5):[null];
  shown.forEach((p,i)=>{const s=document.createElement('div');s.className='tp-slot';s.dataset.k=p&&p.key?String(p.key):'';
   const no=document.createElement('small');no.className='tp-no';no.textContent=String(i+1).padStart(2,'0');
   const cap=document.createElement('b');cap.className='tp-cap';cap.textContent=p&&p.name?p.name:'？';s.append(no,mini(p),cap);box.append(s);});
  const mk=document.createElement('div');mk.className='tp-marker';mk.setAttribute('aria-hidden','true');
  mk.innerHTML='<i class="tp-finder"></i><svg viewBox="0 0 150 150"><path d="M78 14 C118 12 142 44 137 82 C132 120 98 141 64 137 C30 133 11 104 15 70 C19 38 46 17 86 19"/></svg>';box.append(mk);
  const slots=[...box.querySelectorAll('.tp-slot')];let at=-1;
  const hop=()=>{let j=Math.floor(Math.random()*slots.length);if(slots.length>1&&j===at)j=(j+1)%slots.length;at=j;aim(mk,slots[j]);};
  requestAnimationFrame(hop);if(!reduce()&&slots.length>1)r.timer=setInterval(hop,240);
  return sleep(reduce()?300:900);}
 if(ONE()){const s=document.createElement('div'),m=document.createElement('div'),q=document.createElement('b');s.className='tp-slot';m.className='tp-mini tp-who';q.textContent='?';
  m.append(silhouette(),q);s.append(m);box.append(s);
  const ct=r.root.querySelector('.tp-scount'),CH='0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';r.root.querySelector('.tp-sname').textContent="WHO'S NEXT?";
  const roll=()=>{let t='';for(let i=0;i<4;i++)t+=CH[Math.floor(Math.random()*CH.length)];ct.textContent='No.'+t;};
  roll();if(!reduce())r.timer=setInterval(roll,90);
  return sleep(reduce()?300:900);}
 const n=STYLE==='B'?5:STYLE==='G'?3:1,els=[];
 for(let i=0;i<n;i++){const s=document.createElement('div');s.className='tp-slot';box.append(s);els.push(s);}
 const pool=list.length?list.map(mini):[mini(null)];let k=0;
 const tick=()=>{els.forEach((s,i)=>{const m=pool[(k+i)%pool.length].cloneNode(true);const c0=pool[(k+i)%pool.length].querySelector('canvas'),c1=m.querySelector('canvas');if(c0&&c1)c1.getContext('2d').drawImage(c0,0,0);s.replaceChildren(m);});k++;};
 tick();if(!reduce())r.timer=setInterval(tick,STYLE==='G'?90:130);
 return sleep(reduce()?300:900);}
function aim(mk,s){const im=s.querySelector('.tp-mini')||s;mk.style.transform='translate('+(s.offsetLeft+im.offsetLeft+im.offsetWidth/2-75)+'px,'+(s.offsetTop+im.offsetTop+im.offsetHeight/2-75)+'px)';}
// 這一間：A 系列先不露臉（只寫敲門中），進得去才在 done() 翻出資料卡；底片版先把取景框停在這一位、畫圈；其他樣式直接秀
async function show(p){const r=R;if(!r)return;
 if(has('cs')&&r.root.dataset.st==='search'){clearInterval(r.timer);
  const box=r.root.querySelector('.tp-slots'),s=[...box.querySelectorAll('.tp-slot')].find(e=>e.dataset.k&&e.dataset.k===String(p&&p.key||''));
  if(s){aim(box.querySelector('.tp-marker'),s);s.classList.add('lock');box.classList.add('locked');await sleep(reduce()?120:760);if(R!==r)return;}}
 if(ONE()){r.pending=p;r.root.querySelector('.tp-msg').innerHTML='找到一間開著的，敲敲門中<i>.</i><i>.</i><i>.</i>';await sleep(reduce()?100:450);return;}
 reveal(r,p);r.skip=false;r.root.classList.remove('skipped');await sleep(reduce()?150:650);}
function reveal(r,p){clearInterval(r.timer);
 const card=r.root.querySelector('.tp-card');fillCard(card,p);r.root.querySelector('.tp-go span').textContent='敲敲門中…';
 const wm=r.root.querySelector('.tp-wmk');if(wm)wm.textContent='No.'+serial(p);
 if(STYLE==='D'){const t=r.root.querySelector('.pin.to text');if(t)t.textContent=String(p.name||'？').slice(0,1);}
 r.root.dataset.st='show';r.t0=performance.now();}
async function fail(reason){const r=R;if(!r)return;const [a,b]=FAIL_TEXT[reason]||FAIL_TEXT.closed;
 if(ONE()){r.pending=null;clearInterval(r.timer);const m=r.root.querySelector('.tp-who');if(m)m.dataset.miss=a;   // 不露臉：剪影上蓋「客滿」、換下一間
  r.root.querySelector('.tp-msg').textContent=b;r.root.classList.add('miss');await sleep(1300);return;}
 const st=r.root.querySelector('.tp-stamp');st.textContent=a;st.dataset.en=FAIL_EN[reason]||'CLOSED';r.root.querySelector('.tp-go span').textContent=b;r.root.dataset.st='fail';
 await sleep(1300);}
async function done(ready){const r=R;if(!r)return;
 if(r.pending){reveal(r,r.pending);r.pending=null;}   // 進得去了：這時才翻出資料卡
 try{await Promise.race([ready,sleep(9000)]);}catch(_){}
 while(R===r&&!r.skip&&performance.now()-r.t0<SHOW_MIN)await sleep(80);
 if(R!==r)return;r.root.querySelector('.tp-go span').textContent='門開了！';r.root.classList.add('ready');await sleep(r.skip?120:380);
 r.root.dataset.st='exit';await sleep(reduce()?200:EXIT_MS);close(true);}
function close(now,msg){const r=R;if(!r)return Promise.resolve();
 if(msg&&!now){r.root.querySelector('.tp-msg').textContent=msg;r.root.querySelector('.tp-slots').replaceChildren();r.root.dataset.st='search';clearInterval(r.timer);
   return sleep(1500).then(()=>close(true));}
 R=null;clearInterval(r.timer);removeEventListener('keydown',r.key,true);r.root.remove();return Promise.resolve();}

// ---------- 樣式 ----------
const css=document.createElement('style');css.id='ttTripCss';css.textContent=`
#ttTrip{--ink:#1C2156;--pink:#FF4F8B;--lav:#C08CFF;--sky:#7FD3F7;--paper:#FDFDFF;position:fixed;inset:0;z-index:390;display:grid;place-items:center;overflow:hidden;
 font-family:var(--sk-head,'LINE Seed TW'),'TT Huninn',sans-serif;color:var(--ink);perspective:1400px}
#ttTrip .tp-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(201,166,255,.35),transparent 60%),rgba(22,20,58,.6);backdrop-filter:blur(6px);opacity:0;transition:opacity .35s}
#ttTrip.on .tp-bg{opacity:1}#ttTrip[data-st=exit] .tp-bg{opacity:0;transition-duration:.6s}
#ttTrip .tp-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#ttTrip .tp-stage{position:relative;width:min(800px,92vw);height:380px;display:grid;place-items:center}
#ttTrip .tp-search{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;opacity:0;transition:opacity .25s}
#ttTrip[data-st=search] .tp-search{opacity:1}
#ttTrip .tp-slots{display:flex;gap:16px;align-items:center;justify-content:center}
#ttTrip .tp-slot{width:104px;height:104px}
#ttTrip .tp-mini{width:100%;height:100%;border-radius:50%;overflow:hidden;border:3px solid var(--ink);background:linear-gradient(160deg,#FFF3F8,#EEE6FF);box-shadow:0 0 0 4px #fff,0 6px 0 4px var(--ink)}
#ttTrip .tp-mini img,#ttTrip .tp-mini canvas{width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block}
#ttTrip .tp-msg{margin:0;padding:8px 18px;border-radius:999px;background:rgba(28,33,86,.78);box-shadow:0 0 0 2px rgba(255,255,255,.6);font-weight:900;font-size:16px;color:#fff;letter-spacing:2px}
#ttTrip .tp-msg i{font-style:normal;animation:tpDot 1.2s infinite}#ttTrip .tp-msg i:nth-child(2){animation-delay:.2s}#ttTrip .tp-msg i:nth-child(3){animation-delay:.4s}
@keyframes tpDot{0%,60%,100%{opacity:.2}30%{opacity:1}}
/* 資料卡 */
#ttTrip .tp-card{position:relative;display:grid;grid-template-columns:232px minmax(0,1fr);gap:24px;align-items:center;width:100%;box-sizing:border-box;padding:22px 28px 22px 22px;
 background:radial-gradient(circle,rgba(92,97,150,.14) 1.2px,transparent 1.7px) right 16px bottom 12px/11px 11px no-repeat,linear-gradient(165deg,#fff,#FBF8FF 60%,#F3EEFF);
 border:3px solid var(--ink);border-radius:8px 28px 8px 28px;box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 5px #DCD3FF,12px 12px 0 -1px #FFD6E6,12px 12px 0 2px var(--ink),0 30px 70px rgba(10,8,40,.45);
 opacity:0;visibility:hidden;transform-style:preserve-3d}
#ttTrip:is([data-st=show],[data-st=fail],[data-st=exit]) .tp-card{opacity:1;visibility:visible}
#ttTrip .tp-pic{position:relative;width:232px;height:232px}
#ttTrip .tp-frame{position:absolute;left:6px;top:6px;width:200px;height:200px}
#ttTrip .tp-ring{position:absolute;left:-6px;top:-6px;width:224px;height:224px;border-radius:50%;border:2px dashed rgba(192,140,255,.7);animation:tpSpin 14s linear infinite}
#ttTrip .tp-doll{position:absolute;right:-14px;bottom:-10px;width:112px;height:112px;image-rendering:pixelated;filter:drop-shadow(0 4px 0 rgba(28,33,86,.18))}
#ttTrip .tp-mark{display:none}
@keyframes tpSpin{to{transform:rotate(360deg)}}
#ttTrip .tp-info{min-width:0;display:flex;flex-direction:column;gap:9px}
#ttTrip .tp-eye{margin:0;display:flex;align-items:center;gap:8px;font:900 11px/1 var(--sk-head,sans-serif);letter-spacing:2.6px;color:var(--pink)}
#ttTrip .tp-eye i{font-style:normal;color:var(--lav)}#ttTrip .tp-eye::after{content:"";height:1.5px;width:70px;background:linear-gradient(90deg,var(--pink),var(--lav))}
#ttTrip .tp-title{margin:0;display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;line-height:1.15}
#ttTrip .tp-title b{font-size:34px;font-weight:900;letter-spacing:1px;background:linear-gradient(transparent 62%,#FFC6DD 62%);padding:0 4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ttTrip .tp-title span{font-size:18px;font-weight:900;color:#5C6196}
#ttTrip .tp-badges{display:flex;flex-wrap:wrap;gap:6px}
#ttTrip .tp-b{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:900;background:#fff;border:2px solid #C3CBEE;color:var(--ink)}
#ttTrip .tp-b i{width:8px;height:8px;border-radius:50%;background:#B8BCD6}
#ttTrip .tp-b.home{border-color:#7FD89A;background:#EFFFF3}#ttTrip .tp-b.home i{background:#33C46A;box-shadow:0 0 0 3px rgba(51,196,106,.2);animation:tpPing 1.6s infinite}
#ttTrip .tp-b.vip{color:#fff;border-color:var(--ink);background:linear-gradient(180deg,var(--vc),rgba(0,0,0,.18) 240%)}
@keyframes tpPing{50%{box-shadow:0 0 0 6px rgba(51,196,106,0)}}
#ttTrip .tp-tags{display:flex;flex-wrap:wrap;gap:6px}
#ttTrip .tp-tag{padding:2px 9px;border-radius:6px;font-size:12px;font-weight:700;color:#7A4FB8;background:#F1E9FF}
#ttTrip .tp-tag::before{content:"#";opacity:.6;margin-right:1px}
#ttTrip .tp-rows{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#ttTrip .tp-rows div{padding:7px 10px;border:2px solid #E3E6F7;border-radius:10px;background:#fff;min-width:0}
#ttTrip .tp-rows small{display:block;font-size:11px;color:#5C6196;font-weight:700}
#ttTrip .tp-rows b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ttTrip .tp-quote{position:relative;margin:2px 0 0;padding:9px 14px;border-radius:14px;background:#FFF0F6;font-size:14px;font-weight:700;line-height:1.55;color:var(--ink)}
#ttTrip .tp-quote::before{content:"“";position:absolute;left:8px;top:-14px;font-size:34px;color:var(--pink);font-family:Georgia,serif}
#ttTrip .tp-quote span{color:#A796C7}
/* 進度、蓋章、略過 */
#ttTrip .tp-go{position:absolute;left:50%;bottom:-58px;transform:translateX(-50%);margin:0;display:flex;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.92);border:2.5px solid var(--ink);
 font-size:14px;font-weight:900;white-space:nowrap;opacity:0;transition:opacity .3s}
#ttTrip:is([data-st=show],[data-st=fail]) .tp-go{opacity:1}
#ttTrip .tp-go i{width:80px;height:6px;border-radius:9px;background:#E7E2F7;overflow:hidden;position:relative}
#ttTrip .tp-go i::after{content:"";position:absolute;inset:0;width:40%;border-radius:9px;background:linear-gradient(90deg,var(--pink),var(--lav));animation:tpLoad 1.1s ease-in-out infinite}
#ttTrip.ready .tp-go i::after{width:100%;animation:none}
@keyframes tpLoad{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
#ttTrip .tp-stamp{position:absolute;left:50%;top:50%;z-index:5;padding:6px 20px;border:5px solid #E94B7A;border-radius:12px;color:#E94B7A;font-size:44px;font-weight:900;letter-spacing:8px;
 background:rgba(255,255,255,.75);transform:translate(-50%,-50%) rotate(-14deg) scale(2.4);opacity:0;pointer-events:none;box-shadow:inset 0 0 0 3px rgba(233,75,122,.25)}
#ttTrip[data-st=fail] .tp-stamp{animation:tpStamp .38s cubic-bezier(.2,.9,.3,1.3) forwards}
#ttTrip[data-st=fail] .tp-card{animation:tpShake .45s .25s}
@keyframes tpStamp{to{opacity:1;transform:translate(-50%,-50%) rotate(-14deg) scale(1)}}
@keyframes tpShake{20%{translate:-8px 0}40%{translate:7px 0}60%{translate:-4px 0}80%{translate:3px 0}}
#ttTrip .tp-skip{position:absolute;right:max(20px,env(safe-area-inset-right,0px));bottom:20px;padding:8px 16px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:rgba(28,33,86,.45);color:#fff;font:inherit;font-size:13px;font-weight:900;cursor:pointer}
#ttTrip .tp-skip:hover{background:rgba(28,33,86,.7)}
#ttTrip .tp-star{position:absolute;fill:#FFD1E3;animation:tpTw 2.4s ease-in-out infinite}#ttTrip .tp-star svg{width:100%;height:100%;display:block}
@keyframes tpTw{0%,100%{transform:scale(.5);opacity:.35}50%{transform:scale(1.1);opacity:1}}
/* cs 底片選角：候選人排成一條底片，取景框跳來跳去，選中的畫一個粉紅圈 */
#ttTrip.ax.cs .tp-slots{position:relative;gap:14px;padding:30px 20px;border-radius:4px;transform:rotate(-2deg);
 background:linear-gradient(90deg,rgba(255,255,255,.85) 0 11px,transparent 11px) 6px 9px/24px 10px repeat-x,linear-gradient(90deg,rgba(255,255,255,.85) 0 11px,transparent 11px) 6px calc(100% - 9px)/24px 10px repeat-x,#1E1A40;
 box-shadow:12px 12px 0 rgba(255,79,139,.75),0 24px 50px rgba(10,8,40,.45)}
#ttTrip.ax.cs .tp-slots::before{content:"TODAY'S CASTING";position:absolute;left:4px;top:-34px;padding:6px 16px;font:400 12px/1 'TT Title','Rammetto One',sans-serif;letter-spacing:3px;color:#fff;background:var(--pink);clip-path:polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%)}
#ttTrip.ax.cs .tp-slot{position:relative;width:118px;height:auto;display:flex;flex-direction:column;align-items:center;gap:7px;transition:opacity .3s,filter .3s,transform .3s}
#ttTrip.ax.cs .tp-slot::before{display:none}
#ttTrip.ax.cs .tp-slot .tp-mini{width:118px;height:118px;border:none;border-radius:2px;transform:none;box-shadow:none;background:linear-gradient(160deg,#FFF3F8,#EEE6FF)}
#ttTrip.ax.cs .tp-no{position:absolute;left:5px;top:4px;z-index:1;font:400 11px/1 'TT Title','Rammetto One',sans-serif;color:var(--ink);background:rgba(255,255,255,.85);padding:2px 4px;border-radius:2px}
#ttTrip.ax.cs .tp-cap{max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:900;color:#fff}
#ttTrip.ax.cs .tp-marker{position:absolute;left:0;top:0;width:150px;height:150px;pointer-events:none;transition:transform .2s cubic-bezier(.3,1.4,.5,1);z-index:2}
#ttTrip.ax.cs .tp-finder{position:absolute;inset:12px;background:linear-gradient(#FF4F8B,#FF4F8B) 0 0/24px 5px,linear-gradient(#FF4F8B,#FF4F8B) 0 0/5px 24px,linear-gradient(#FF4F8B,#FF4F8B) 100% 0/24px 5px,linear-gradient(#FF4F8B,#FF4F8B) 100% 0/5px 24px,
 linear-gradient(#FF4F8B,#FF4F8B) 0 100%/24px 5px,linear-gradient(#FF4F8B,#FF4F8B) 0 100%/5px 24px,linear-gradient(#FF4F8B,#FF4F8B) 100% 100%/24px 5px,linear-gradient(#FF4F8B,#FF4F8B) 100% 100%/5px 24px;background-repeat:no-repeat;transition:opacity .2s}
#ttTrip.ax.cs .tp-marker svg{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:#FF4F8B;stroke-width:6;stroke-linecap:round;stroke-dasharray:420;stroke-dashoffset:420;filter:drop-shadow(2px 2px 0 #fff)}
#ttTrip.ax.cs .tp-slots.locked .tp-finder{opacity:0}
#ttTrip.ax.cs .tp-slots.locked .tp-marker svg{animation:tpDash .45s ease-out forwards}
#ttTrip.ax.cs .tp-slots.locked .tp-slot:not(.lock){opacity:.4;filter:grayscale(.7)}
#ttTrip.ax.cs .tp-slot.lock{transform:translateY(-6px) scale(1.06)}
#ttTrip.ax.cs .tp-sinfo{display:none}
/* A 系列找人：沒有臉的剪影＋跳動的問號；進不去時剪影上蓋「客滿」、搖一下 */
#ttTrip .tp-who{position:relative;display:grid;place-items:center}
#ttTrip .tp-who canvas{opacity:.9}
#ttTrip .tp-who b{position:absolute;right:12%;top:8%;font:400 34px/1 'TT Title','Rammetto One',sans-serif;color:var(--pink);text-shadow:2px 2px 0 #fff,-2px -2px 0 #fff,2px -2px 0 #fff,-2px 2px 0 #fff;animation:tpQ 1.1s ease-in-out infinite}
@keyframes tpQ{50%{transform:translateY(-6px) rotate(12deg)}}
#ttTrip .tp-who::after{content:attr(data-miss);position:absolute;left:50%;top:52%;padding:4px 14px;background:var(--ink);color:#fff;font-size:20px;font-weight:900;letter-spacing:4px;white-space:nowrap;transform:translate(-50%,-50%) rotate(-10deg) scale(2);opacity:0}
#ttTrip.miss .tp-who::after{animation:tpMiss .35s cubic-bezier(.2,.9,.3,1.3) forwards}
#ttTrip.miss .tp-who b{display:none}
@keyframes tpMiss{to{opacity:1;transform:translate(-50%,-50%) rotate(-10deg) scale(1)}}
#ttTrip.miss .tp-slot{animation:tpShake .45s .2s}
/* 共用出場 */
#ttTrip[data-st=show] .tp-card{animation:tpPop .6s cubic-bezier(.2,.9,.3,1.15) both}
@keyframes tpPop{from{opacity:0;transform:translateY(24px) scale(.94)}to{opacity:1;transform:none}}
#ttTrip[data-st=show] .tp-info>*{animation:tpRise .5s both}
#ttTrip[data-st=show] .tp-info>*:nth-child(2){animation-delay:.08s}#ttTrip[data-st=show] .tp-info>*:nth-child(3){animation-delay:.16s}#ttTrip[data-st=show] .tp-info>*:nth-child(4){animation-delay:.24s}
#ttTrip[data-st=show] .tp-info>*:nth-child(5){animation-delay:.32s}#ttTrip[data-st=show] .tp-info>*:nth-child(6){animation-delay:.4s}
@keyframes tpRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
#ttTrip[data-st=exit] .tp-card{animation:tpOut .7s cubic-bezier(.6,0,.4,1) forwards}
@keyframes tpOut{to{opacity:0;transform:scale(1.08) translateY(-20px)}}

/* ===== A 雜誌斜切：三條斜色塊掃進來、鏤空大字、細線 ===== */
#ttTrip.v-A .band{position:absolute;top:-25%;bottom:-25%;width:36%;transform:skewX(-16deg) translateX(-190%);transition:transform .6s cubic-bezier(.7,0,.2,1)}
#ttTrip.v-A .b1{left:-4%;background:linear-gradient(180deg,#FFC2D8,#FF9DC0)}#ttTrip.v-A .b2{left:30%;background:linear-gradient(180deg,#E4D2FF,#C9AEFF);transition-delay:.07s}#ttTrip.v-A .b3{left:64%;background:linear-gradient(180deg,#D3F2FF,#A8E2FA);transition-delay:.14s}
#ttTrip.v-A.on .band{transform:skewX(-16deg) translateX(0)}
#ttTrip.v-A[data-st=exit] .band{transform:skewX(-16deg) translateX(320%);transition-duration:.7s}
#ttTrip.v-A .word{position:absolute;left:3%;bottom:-4%;font:400 220px/1 'TT Title','Rammetto One',sans-serif;color:transparent;-webkit-text-stroke:2.5px rgba(255,255,255,.75);letter-spacing:6px;transform:translateX(-40px);opacity:0;transition:.8s .2s}
#ttTrip.v-A.on .word{transform:none;opacity:1}
#ttTrip.v-A .line{position:absolute;height:2px;background:var(--ink);width:0;transition:width .9s .3s}
#ttTrip.v-A .l1{left:6%;top:12%}#ttTrip.v-A .l2{right:6%;bottom:16%}#ttTrip.v-A.on .line{width:28%}
#ttTrip.v-A[data-st=show] .tp-card{animation:tpSlideA .65s cubic-bezier(.2,.9,.3,1.1) both}
@keyframes tpSlideA{from{opacity:0;transform:translateX(90px) rotate(3deg)}to{opacity:1;transform:rotate(-1deg)}}
#ttTrip.v-A[data-st=fail] .tp-card{transform:rotate(-1deg)}
#ttTrip.v-A[data-st=exit] .tp-card{animation:tpOutA .6s cubic-bezier(.7,0,.3,1) forwards}
@keyframes tpOutA{to{opacity:0;transform:translateX(-140px) rotate(-4deg)}}

/* ===== A1～A6：A 的加強版 ===== */
#ttTrip .tp-wmk,#ttTrip .tp-sinfo,#ttTrip .tp-fr,#ttTrip .tp-band{display:none}
@keyframes tpSpinR{to{rotate:360deg}}
@keyframes tpFloat{50%{translate:0 -8px}}
@keyframes tpDash{to{stroke-dashoffset:0}}
@keyframes tpDots{to{background-position:20px 20px}}
/* ax 共用：中間深紫網點色帶、白細線＋菱形端點、每一間的編號大字、英文小標、蓋章改深紫斜切帶 */
#ttTrip.ax .b1{background:repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0 2px,transparent 2px 16px),linear-gradient(180deg,#FFC2D8,#FF94BA)}
#ttTrip.ax .b2{background:radial-gradient(circle,rgba(255,255,255,.18) 1.4px,transparent 1.9px) 0 0/12px 12px,linear-gradient(180deg,#3D2E7C,#221A52)}
#ttTrip.ax .b3{background:radial-gradient(circle,rgba(255,255,255,.55) 1.3px,transparent 1.8px) 0 0/14px 14px,linear-gradient(180deg,#D6F3FF,#9FDDF8)}
#ttTrip.ax .band::after{content:"";position:absolute;top:0;bottom:0;right:0;width:3px;background:rgba(255,255,255,.65)}
#ttTrip.ax .line{background:#fff;height:2px}
#ttTrip.ax .line::after{content:"";position:absolute;top:-4px;width:10px;height:10px;background:#fff;transform:rotate(45deg)}
#ttTrip.ax .l1::after{right:-5px}#ttTrip.ax .l2::after{left:-5px}
#ttTrip.ax .tp-star{fill:#fff}
#ttTrip.ax .tp-wmk{display:block;position:absolute;left:-7%;top:-31%;font:400 140px/1 'TT Title','Rammetto One',sans-serif;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,.82);letter-spacing:4px;white-space:nowrap;pointer-events:none;opacity:0}
#ttTrip.ax:is([data-st=show],[data-st=fail]) .tp-wmk{opacity:1;animation:tpWmk .9s cubic-bezier(.2,.9,.3,1) both}
@keyframes tpWmk{from{opacity:0;transform:translateX(-90px)}to{opacity:1;transform:none}}
#ttTrip.ax[data-st=exit] .tp-wmk{opacity:0;transform:translateX(160px);transition:.55s cubic-bezier(.7,0,.3,1)}
#ttTrip.ax .tp-msg{border-radius:0;padding:8px 26px;background:var(--ink);box-shadow:none;clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)}
#ttTrip.ax .tp-go{border:none;border-radius:0;padding:10px 28px;background:var(--ink);color:#fff;clip-path:polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)}
#ttTrip.ax .tp-go i{background:rgba(255,255,255,.22)}
#ttTrip.ax.ready .tp-go{background:var(--pink)}
#ttTrip.ax .tp-stamp{border:none;border-radius:0;background:var(--ink);color:#fff;font-size:38px;letter-spacing:6px;padding:10px 36px 12px 32px;text-align:center;box-shadow:none;
 clip-path:polygon(16px 0,100% 0,calc(100% - 16px) 100%,0 100%);transform:translate(-50%,-50%) rotate(-8deg) scale(2.2)}
#ttTrip.ax .tp-stamp::before{content:attr(data-en);display:block;margin-bottom:6px;font:400 12px/1 'TT Title','Rammetto One',sans-serif;letter-spacing:4px;color:#FF9DC0}
#ttTrip.ax[data-st=fail] .tp-stamp{animation:tpStampA .38s cubic-bezier(.2,.9,.3,1.3) forwards}
@keyframes tpStampA{to{opacity:1;transform:translate(-50%,-50%) rotate(-8deg) scale(1)}}
#ttTrip.ax[data-st=fail] .tp-card{filter:grayscale(.6)}
/* ax 找人：剪影方框斜放、後面轉動的虛線菱形、WHO'S NEXT? 與亂跳的編號 */
#ttTrip.ax .tp-slot{position:relative;width:150px;height:150px}
#ttTrip.ax .tp-slot::before{content:"";position:absolute;inset:-6px;border:2px dashed rgba(255,255,255,.9);transform:rotate(45deg);animation:tpSpinR 9s linear infinite}
#ttTrip.ax .tp-mini{position:relative;border-radius:6px;border:3px solid var(--ink);box-shadow:8px 8px 0 #FF9DC0,8px 8px 0 3px var(--ink);transform:rotate(-4deg)}
#ttTrip.ax .tp-sinfo{display:flex;flex-direction:column;align-items:center;gap:8px}
#ttTrip.ax .tp-sname{padding:2px 12px 0;font:400 30px/1.1 'TT Title','Rammetto One',sans-serif;letter-spacing:2px;color:var(--ink);background:linear-gradient(transparent 58%,#FFC6DD 58%);
 text-shadow:2px 0 #fff,-2px 0 #fff,0 2px #fff,0 -2px #fff,2px 2px #fff,-2px 2px #fff,2px -2px #fff,-2px -2px #fff}
#ttTrip.ax .tp-scount{min-width:104px;text-align:center;padding:5px 14px;font:400 11px/1 'TT Title','Rammetto One',sans-serif;letter-spacing:3px;color:#fff;background:var(--pink);clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}
#ttTrip.ax .tp-search{gap:14px}

/* mz 雜誌卡：切角外框＋錯位條紋紙、深紫英文小標帶、列編號、菱形轉框、引言線 */
#ttTrip.mz .tp-card{background:none;border:none;border-radius:0;box-shadow:none;padding:34px 34px 26px 28px;filter:drop-shadow(0 26px 40px rgba(10,8,40,.38))}
#ttTrip.mz .tp-fr{display:block;position:absolute;inset:0;pointer-events:none}
#ttTrip.mz .tp-fr i{position:absolute;inset:0;--c:28px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c))}
#ttTrip.mz .tp-fr .pg{transform:translate(13px,13px);background:repeating-linear-gradient(-45deg,#FF8DB5 0 7px,#FFC2D8 7px 14px)}
#ttTrip.mz .tp-fr .ol{background:var(--ink)}
#ttTrip.mz .tp-fr .pp{inset:3px;--c:26.2px;background:radial-gradient(circle,rgba(92,97,150,.16) 1.2px,transparent 1.7px) right 18px bottom 14px/11px 11px no-repeat,linear-gradient(165deg,#fff,#FBF8FF 60%,#F1ECFF)}
#ttTrip.mz .tp-pic,#ttTrip.mz .tp-info{position:relative;z-index:1}
#ttTrip.mz .tp-band{display:flex;align-items:center;gap:10px;position:absolute;left:-20px;top:-15px;z-index:3;padding:8px 30px 8px 22px;color:#fff;white-space:nowrap;
 background:linear-gradient(90deg,#2E2462,#5B44A8);clip-path:polygon(0 0,100% 0,calc(100% - 16px) 100%,0 100%);font:400 12px/1 'TT Title','Rammetto One',sans-serif;letter-spacing:3px}
#ttTrip.mz .tp-band i{width:1px;height:12px;background:rgba(255,255,255,.5)}#ttTrip.mz .tp-band span{color:#FFC6DD}
#ttTrip.mz.ready .tp-band{background:linear-gradient(90deg,#FF4F8B,#C08CFF)}
#ttTrip.mz[data-st=show] .tp-band{animation:tpBandIn .55s .2s cubic-bezier(.2,.9,.3,1) both}
@keyframes tpBandIn{from{clip-path:polygon(0 0,0 0,0 100%,0 100%)}to{clip-path:polygon(0 0,100% 0,calc(100% - 16px) 100%,0 100%)}}
#ttTrip.mz .tp-eye{display:none}
#ttTrip.mz .tp-title b{font-size:36px}
#ttTrip.mz .tp-ring{left:28px;top:28px;width:156px;height:156px;border-radius:0;border:2px dashed #C08CFF;transform:rotate(45deg);animation:tpSpinR 16s linear infinite}
#ttTrip.mz .tp-pic::before{content:"";position:absolute;left:-14px;bottom:2px;width:120px;height:90px;background:radial-gradient(circle,#FF9DC0 1.6px,transparent 2.1px) 0 0/9px 9px;-webkit-mask:linear-gradient(45deg,#000,transparent 75%);mask:linear-gradient(45deg,#000,transparent 75%)}
#ttTrip.mz .tp-pic::after{content:"";position:absolute;right:6px;top:-4px;width:22px;height:20px;background:#7FD3F7;clip-path:polygon(50% 0,100% 100%,0 100%);animation:tpFloat 3s ease-in-out infinite}
#ttTrip.mz .tp-rows{counter-reset:tpr}
#ttTrip.mz .tp-rows div{counter-increment:tpr;position:relative;padding-left:36px;border-radius:4px;border-color:#DCD3FF}
#ttTrip.mz .tp-rows div::before{content:"0" counter(tpr);position:absolute;left:9px;top:50%;transform:translateY(-50%);font:400 14px/1 'TT Title','Rammetto One',sans-serif;color:var(--pink)}
#ttTrip.mz .tp-quote{background:none;border-left:5px solid var(--pink);border-radius:0;padding:4px 0 4px 14px}
#ttTrip.mz .tp-quote::before{display:none}
#ttTrip.mz .tp-b{border-radius:4px}

/* sh 快門：九條斜色條上下交錯關上，離場時往反方向打開露出房間 */
#ttTrip.sh .shut{position:absolute;inset:-12% -14%;display:flex;transform:skewX(-14deg)}
#ttTrip.sh .shut i{flex:1;--s:-1;transform:translateY(calc(var(--s)*118%));transition:transform .5s cubic-bezier(.7,0,.2,1);transition-delay:calc(var(--n)*45ms)}
#ttTrip.sh .shut i:nth-child(even){--s:1}
#ttTrip.sh .shut i:nth-child(4n+1){background:linear-gradient(180deg,#FFC2D8,#FF94BA)}
#ttTrip.sh .shut i:nth-child(4n+2){background:radial-gradient(circle,rgba(255,255,255,.18) 1.4px,transparent 1.9px) 0 0/12px 12px,linear-gradient(180deg,#3D2E7C,#221A52)}
#ttTrip.sh .shut i:nth-child(4n+3){background:linear-gradient(180deg,#D6F3FF,#9FDDF8)}
#ttTrip.sh .shut i:nth-child(4n){background:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 2px,transparent 2px 12px),linear-gradient(180deg,#EADCFF,#C9AEFF)}
${[1,2,3,4,5,6,7,8,9].map(n=>'#ttTrip.sh .shut i:nth-child('+n+'){--n:'+(n%2?n:10-n)+'}').join('')}
#ttTrip.sh.on .shut i{transform:none}
#ttTrip.sh[data-st=exit] .shut i{transform:translateY(calc(var(--s)*-118%));transition-duration:.55s}
#ttTrip.sh[data-st=show] .shut i:nth-child(odd){animation:tpNudge .7s cubic-bezier(.2,.9,.3,1)}
@keyframes tpNudge{40%{translate:0 -14px}}
#ttTrip.ax.sh:not(.cs) .tp-slot{width:176px}
#ttTrip.ax.sh:not(.cs) .tp-slot::before{inset:0 -10px;border-radius:0;transform:skewX(-12deg);animation:tpFlick 1s steps(2) infinite}
@keyframes tpFlick{50%{border-color:rgba(255,157,192,.95)}}
#ttTrip.ax.sh:not(.cs) .tp-mini{border:none;border-radius:0;transform:none;box-shadow:none;clip-path:polygon(16% 0,100% 0,84% 100%,0 100%)}

/* geo 幾何：畫出來的細線、轉動菱形、漂浮三角、虛線圓、網點；資料卡出現時一圈小圖形往外噴 */
#ttTrip .geo-l{position:absolute;inset:0;width:100%;height:100%}
#ttTrip .geo-l .ln{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:420;stroke-dashoffset:420;animation:tpDash 1.3s .35s ease-out forwards}
#ttTrip .geo-l .ln.k{stroke:var(--ink);stroke-width:3}
#ttTrip .geo-l .dm{fill:none;stroke:#fff;stroke-width:3;transform-box:fill-box;transform-origin:center;animation:tpSpinR 9s linear infinite}
#ttTrip .geo-l .dmf{fill:#FFE7A3;stroke:var(--ink);stroke-width:2;transform-box:fill-box;transform-origin:center;animation:tpSpinR 12s linear infinite reverse}
#ttTrip .geo-l .tri{fill:none;stroke:var(--ink);stroke-width:3;stroke-linejoin:round;transform-box:fill-box;transform-origin:center;animation:tpFloat 3.6s ease-in-out infinite}
#ttTrip .geo-l .tri.b{stroke:#fff;animation-delay:-1.8s}
#ttTrip .geo-l .cir{fill:none;stroke:#fff;stroke-width:2.5;stroke-dasharray:5 8;transform-box:fill-box;transform-origin:center;animation:tpSpinR 16s linear infinite}
#ttTrip .geo-l .plus{stroke:#fff;stroke-width:3;stroke-linecap:round;animation:tpTw 2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
#ttTrip .ht{position:absolute;width:200px;height:130px;background:radial-gradient(circle,rgba(255,255,255,.8) 1.7px,transparent 2.2px) 0 0/10px 10px;animation:tpDots 4s linear infinite}
#ttTrip .ht.h1{left:4%;bottom:6%;-webkit-mask:linear-gradient(45deg,#000,transparent 70%);mask:linear-gradient(45deg,#000,transparent 70%)}
#ttTrip .ht.h2{right:5%;top:7%;-webkit-mask:linear-gradient(225deg,#000,transparent 70%);mask:linear-gradient(225deg,#000,transparent 70%)}
#ttTrip .burst{position:absolute;left:50%;top:50%;width:0;height:0}
#ttTrip .burst i{position:absolute;left:-9px;top:-9px;width:18px;height:18px;opacity:0;background:#fff;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
#ttTrip .burst i.s1{background:#FFE7A3;clip-path:polygon(50% 0,100% 100%,0 100%)}
#ttTrip .burst i.s2{background:#FF9DC0;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)}
#ttTrip.geo[data-st=show] .burst i{animation:tpBurst 1s cubic-bezier(.12,.8,.3,1) forwards}
@keyframes tpBurst{0%{opacity:1;transform:rotate(var(--a)) translateX(80px) scale(.5)}80%{opacity:1}100%{opacity:0;transform:rotate(var(--a)) translateX(var(--d)) rotate(220deg) scale(1.15)}}
#ttTrip.geo[data-st=exit] .geo-l,#ttTrip.geo[data-st=exit] .ht{opacity:0;transition:opacity .4s}

/* gl 虹光毛玻璃：粉嫩色帶加亮面、毛玻璃資料卡、流動虹光外框、亮面掃過、閃光 */
@property --tpha{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes tpHue{to{--tpha:360deg}}
@keyframes tpSheen{0%,55%{background-position:160% 0}100%{background-position:-60% 0}}
#ttTrip.gl .b1{background:linear-gradient(180deg,rgba(255,255,255,.45),transparent 30%),linear-gradient(180deg,#FFC9DE,#FFA4C6)}
#ttTrip.gl .b2{background:linear-gradient(180deg,rgba(255,255,255,.45),transparent 30%),linear-gradient(180deg,#E6D6FF,#BFA2FF)}
#ttTrip.gl .b3{background:linear-gradient(180deg,rgba(255,255,255,.45),transparent 30%),linear-gradient(180deg,#D8F4FF,#9ADBF7)}
#ttTrip.gl .tp-star{fill:#fff;filter:drop-shadow(0 0 6px rgba(255,255,255,.9))}
#ttTrip.gl .tp-wmk{-webkit-text-stroke-color:rgba(255,255,255,.9)}
#ttTrip.gl .tp-card{background:linear-gradient(165deg,rgba(255,255,255,.8),rgba(250,245,255,.6));backdrop-filter:blur(18px) saturate(1.6);border:none;border-radius:26px;
 box-shadow:0 24px 60px rgba(42,21,58,.38),inset 0 1px 0 #fff}
#ttTrip.gl .tp-card::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:3px;pointer-events:none;background:conic-gradient(from var(--tpha),#FFB3D1,#C9B3FF,#A8D8FF,#B8F0DC,#FFE0B8,#FFB3D1);animation:tpHue 5s linear infinite;
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
#ttTrip.gl .tp-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.6) 50%,transparent 60%) 0 0/250% 100% no-repeat;animation:tpSheen 4.2s ease-in-out infinite}
#ttTrip.gl .tp-ring{border-color:rgba(192,140,255,.55)}
#ttTrip.gl .tp-rows div{background:rgba(255,255,255,.7);border-color:rgba(201,179,255,.5)}
#ttTrip.gl .tp-quote{background:rgba(255,240,246,.75)}
#ttTrip.gl .tp-slot::before{inset:-12px;border-radius:50%;border-style:dotted;transform:none}
#ttTrip.gl .tp-mini{border-radius:50%;border:4px solid #fff;transform:none;box-shadow:0 0 0 4px rgba(201,179,255,.8),0 12px 30px rgba(42,21,58,.35)}
#ttTrip.gl .tp-msg,#ttTrip.gl .tp-go{clip-path:none;border-radius:999px;background:rgba(255,255,255,.85);color:var(--ink);box-shadow:0 6px 20px rgba(42,21,58,.25)}
#ttTrip.gl .tp-go i{background:#E7E2F7}#ttTrip.gl.ready .tp-go{background:linear-gradient(90deg,#FF9DC0,#C9AEFF);color:#fff}


/* ===== B 抽牌翻面：五張牌扇形洗牌，選中那張翻過來 ===== */
#ttTrip.v-B .glow{position:absolute;left:50%;top:50%;width:900px;height:900px;margin:-450px 0 0 -450px;background:radial-gradient(circle,rgba(255,214,234,.55),rgba(201,166,255,.25) 40%,transparent 66%);animation:tpBreath 3s ease-in-out infinite}
@keyframes tpBreath{50%{transform:scale(1.08)}}
#ttTrip.v-B .tp-slot{width:110px;height:150px;margin:0 -18px;border-radius:14px;border:3px solid var(--ink);background:repeating-linear-gradient(45deg,#FF9DC0 0 10px,#FFB8D2 10px 20px);box-shadow:0 6px 0 var(--ink);
 display:grid;place-items:center;transition:transform .2s}
#ttTrip.v-B .tp-slot .tp-mini{width:76px;height:76px;box-shadow:0 0 0 3px #fff}
#ttTrip.v-B .tp-slot:nth-child(1){transform:rotate(-22deg) translateY(26px)}#ttTrip.v-B .tp-slot:nth-child(2){transform:rotate(-11deg) translateY(8px)}#ttTrip.v-B .tp-slot:nth-child(3){transform:translateY(-6px) scale(1.08);z-index:2}
#ttTrip.v-B .tp-slot:nth-child(4){transform:rotate(11deg) translateY(8px)}#ttTrip.v-B .tp-slot:nth-child(5){transform:rotate(22deg) translateY(26px)}
#ttTrip.v-B[data-st=search] .tp-slots{animation:tpFan .26s ease-in-out infinite alternate}
@keyframes tpFan{to{transform:translateY(-6px)}}
#ttTrip.v-B[data-st=show] .tp-card{animation:tpFlip .8s cubic-bezier(.2,.8,.25,1.1) both}
@keyframes tpFlip{0%{opacity:1;transform:rotateY(-180deg) scale(.35);filter:brightness(2)}55%{filter:brightness(1.3)}100%{opacity:1;transform:none;filter:none}}
#ttTrip.v-B .tp-card{backface-visibility:visible}
#ttTrip.v-B .flash{position:absolute;inset:0;background:radial-gradient(circle,#fff,rgba(255,255,255,0) 60%);opacity:0}
#ttTrip.v-B[data-st=show] .flash{animation:tpFlash .7s .25s}
#ttTrip.v-B[data-st=exit] .flash{animation:tpFlash .7s}
@keyframes tpFlash{30%{opacity:.85}100%{opacity:0}}
#ttTrip.v-B[data-st=exit] .tp-card{animation:tpOutB .6s ease-in forwards}
@keyframes tpOutB{to{opacity:0;transform:scale(1.5)}}

/* ===== C 敲門開門：兩扇木門關上、叩叩，資料卡像門牌掛在門上，最後門往兩邊打開 ===== */
#ttTrip.v-C .tp-fx{perspective:1200px}
#ttTrip.v-C .door{position:absolute;top:0;bottom:0;width:50.5%;background:repeating-linear-gradient(90deg,#B07455 0 58px,#A2684B 58px 60px),linear-gradient(180deg,#C2866A,#8F5A41);
 box-shadow:inset 0 0 0 10px #7A4A36,inset 0 0 0 14px #5E3627;transition:transform .55s cubic-bezier(.5,0,.2,1)}
#ttTrip.v-C .door.l{left:0;transform:translateX(-102%);transform-origin:left center}#ttTrip.v-C .door.r{right:0;transform:translateX(102%);transform-origin:right center}
#ttTrip.v-C.on .door{transform:none}
#ttTrip.v-C .door::before,#ttTrip.v-C .door::after{content:"";position:absolute;left:16%;right:16%;border-radius:10px;box-shadow:inset 0 0 0 6px #8F5A41,inset 0 0 0 9px #C99A7C,inset 0 6px 14px rgba(0,0,0,.25)}
#ttTrip.v-C .door::before{top:22%;height:30%}#ttTrip.v-C .door::after{top:60%;height:28%}
#ttTrip.v-C .door.r::before{background:radial-gradient(circle at 50% 50%,#FFE7B0 0 26px,transparent 27px)}
#ttTrip.v-C .knob{position:absolute;top:52%;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#FFE9A8,#C9932E);box-shadow:0 3px 0 #5E3627}
#ttTrip.v-C .door.l .knob{right:34px}#ttTrip.v-C .door.r .knob{left:34px}
#ttTrip.v-C .plate{position:absolute;left:50%;top:9%;transform:translateX(-10%);font-style:normal;font:900 14px/1 var(--sk-head,sans-serif);letter-spacing:4px;color:#FFE9C9;padding:8px 14px;border-radius:8px;background:#5E3627;box-shadow:inset 0 0 0 2px #C9932E}
#ttTrip.v-C .knock{position:absolute;left:50%;top:18%;transform:translateX(-50%);font-size:34px;font-weight:900;color:#FFF3DA;text-shadow:0 3px 0 #5E3627;opacity:0}
#ttTrip.v-C[data-st=search] .knock{animation:tpKnock 1s infinite}
@keyframes tpKnock{0%,100%{opacity:0}20%,60%{opacity:1}40%{opacity:.3}}
#ttTrip.v-C[data-st=search] .door{animation:tpRattle 1s infinite}
@keyframes tpRattle{20%{translate:2px 0}30%{translate:-2px 0}60%{translate:2px 0}70%{translate:-2px 0}}
#ttTrip.v-C .tp-msg{background:rgba(94,54,39,.85)}
#ttTrip.v-C .tp-card{background:linear-gradient(165deg,#FFFBF2,#FFF1DC);border-color:#5E3627;box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 5px #F2D9B6,10px 10px 0 -1px #E9B98F,10px 10px 0 2px #5E3627,0 30px 70px rgba(30,10,0,.45)}
#ttTrip.v-C .tp-card::before,#ttTrip.v-C .tp-card::after{content:"";position:absolute;top:-70px;width:3px;height:74px;background:#5E3627}
#ttTrip.v-C .tp-card::before{left:22%;transform:rotate(14deg)}#ttTrip.v-C .tp-card::after{right:22%;transform:rotate(-14deg)}
#ttTrip.v-C[data-st=show] .tp-card{animation:tpSwing 1s cubic-bezier(.3,1.6,.4,1) both;transform-origin:50% -70px}
@keyframes tpSwing{0%{opacity:0;transform:translateY(-160px) rotate(-8deg)}60%{opacity:1;transform:translateY(0) rotate(3deg)}100%{transform:rotate(0)}}
#ttTrip.v-C[data-st=exit] .tp-card{animation:tpOutC .45s ease-in forwards}
@keyframes tpOutC{to{opacity:0;transform:translateY(-120px)}}
#ttTrip.v-C[data-st=exit] .door{transition:transform .75s .2s cubic-bezier(.6,0,.3,1)}
#ttTrip.v-C[data-st=exit] .door.l{transform:rotateY(-105deg)}#ttTrip.v-C[data-st=exit] .door.r{transform:rotateY(105deg)}
#ttTrip.v-C .tp-bg{background:rgba(40,20,10,.35)}

/* ===== D 小地圖：從「你」的小屋沿著小路走到對方家 ===== */
#ttTrip.v-D .tp-fx{background:radial-gradient(circle,rgba(28,33,86,.12) 1.4px,transparent 2px) 0 0/22px 22px,linear-gradient(160deg,#FFF6EA,#F3EEFF 55%,#E9F7FF);opacity:0;transition:opacity .35s}
#ttTrip.v-D.on .tp-fx{opacity:1}#ttTrip.v-D[data-st=exit] .tp-fx{opacity:0;transition:opacity .6s .15s}
#ttTrip.v-D .map{position:absolute;inset:0;width:100%;height:100%}
#ttTrip.v-D .road{fill:none;stroke:#fff;stroke-width:26;stroke-linecap:round}
#ttTrip.v-D .trail{fill:none;stroke:var(--pink);stroke-width:5;stroke-linecap:round;stroke-dasharray:4 14;stroke-dashoffset:1200;animation:tpTrail 1.6s linear forwards}
@keyframes tpTrail{to{stroke-dashoffset:0}}
#ttTrip.v-D .pin circle{fill:#fff;stroke:var(--ink);stroke-width:4}#ttTrip.v-D .pin text{font:900 20px var(--sk-head,sans-serif);fill:var(--ink);text-anchor:middle}
#ttTrip.v-D .pin.to circle{fill:#FFE1EC;stroke:var(--pink);animation:tpPinPulse 1.2s infinite}
@keyframes tpPinPulse{50%{stroke-width:9}}
#ttTrip.v-D .walker{fill:var(--pink);stroke:#fff;stroke-width:5;paint-order:stroke}
#ttTrip.v-D .hut path:first-child{stroke:var(--ink);stroke-width:3;stroke-linejoin:round}#ttTrip.v-D .hut path+path{stroke:var(--ink);stroke-width:2}
#ttTrip.v-D .tree circle{fill:#9ED9A8;stroke:var(--ink);stroke-width:3}#ttTrip.v-D .tree rect{fill:#B07455}

#ttTrip.v-D .tp-bg{display:none}
#ttTrip.v-D[data-st=show] .tp-card{animation:tpPinPop .6s cubic-bezier(.2,.9,.3,1.2) both;transform-origin:85% 0}
@keyframes tpPinPop{from{opacity:0;transform:translate(120px,-120px) scale(.2)}to{opacity:1;transform:none}}
#ttTrip.v-D[data-st=exit] .tp-card{animation:tpOutD .7s ease-in forwards}
@keyframes tpOutD{to{opacity:0;transform:scale(2.2);filter:blur(4px)}}

/* ===== E 星空傳送：夜空、魔法陣、毛玻璃虹光卡 ===== */
#ttTrip.v-E .sky{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%,#3A2E7A,#16133E 70%);opacity:0;transition:opacity .4s}
#ttTrip.v-E.on .sky{opacity:.92}#ttTrip.v-E[data-st=exit] .sky{opacity:0;transition-duration:.6s}
#ttTrip.v-E .tp-star.w{fill:#FFF6D8}
#ttTrip.v-E .circle{position:absolute;left:50%;top:50%;width:620px;height:620px;margin:-310px 0 0 -310px;fill:none;stroke:rgba(201,166,255,.75);stroke-width:2;animation:tpSpin 18s linear infinite;filter:drop-shadow(0 0 8px rgba(201,166,255,.8))}
#ttTrip.v-E .circle .c2{stroke-dasharray:6 10;stroke:rgba(127,211,247,.8)}#ttTrip.v-E .circle .hex{stroke:rgba(255,198,221,.7)}#ttTrip.v-E .circle .hex.b{stroke:rgba(255,198,221,.45)}#ttTrip.v-E .circle .c3{stroke:rgba(255,255,255,.6)}
#ttTrip.v-E[data-st=search] .circle{animation-duration:3s}
#ttTrip.v-E .tp-card{background:linear-gradient(160deg,rgba(255,255,255,.2),rgba(255,255,255,.07));backdrop-filter:blur(16px);color:#fff;border:2px solid rgba(255,255,255,.5);border-radius:26px;
 box-shadow:0 0 0 1px rgba(201,166,255,.5),0 0 40px rgba(201,166,255,.45),0 30px 70px rgba(5,3,30,.5)}
#ttTrip.v-E .tp-card::before{content:"";position:absolute;inset:-2px;border-radius:26px;padding:2px;background:linear-gradient(120deg,#FF9DC0,#C9AEFF,#A8E2FA,#FFE7A3,#FF9DC0);background-size:300% 100%;animation:tpIri 4s linear infinite;
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
@keyframes tpIri{to{background-position:300% 0}}
#ttTrip.v-E .tp-title span,#ttTrip.v-E .tp-rows small{color:#D9D2FF}#ttTrip.v-E .tp-title b{background:linear-gradient(transparent 62%,rgba(255,157,192,.55) 62%)}
#ttTrip.v-E .tp-rows div{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25)}#ttTrip.v-E .tp-quote{background:rgba(255,255,255,.14);color:#fff}
#ttTrip.v-E .tp-b{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.35);color:#fff}#ttTrip.v-E .tp-tag{background:rgba(201,166,255,.25);color:#F3ECFF}
#ttTrip.v-E .tp-ring{border-color:rgba(255,255,255,.55)}
#ttTrip.v-E[data-st=show] .tp-card{animation:tpRiseE .9s cubic-bezier(.2,.9,.3,1) both}
@keyframes tpRiseE{0%{opacity:0;transform:scale(.6);filter:blur(10px) brightness(2)}100%{opacity:1;transform:none;filter:none}}
#ttTrip.v-E .flash{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border-radius:50%;background:#fff;opacity:0}
#ttTrip.v-E[data-st=exit] .flash{animation:tpBoom .75s ease-out forwards}
@keyframes tpBoom{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(60)}}

/* ===== F 明信片：信封打開、明信片滑出、蓋郵戳 ===== */
#ttTrip.v-F .desk{position:absolute;inset:0;background:radial-gradient(circle,rgba(150,110,80,.12) 1px,transparent 1.5px) 0 0/16px 16px,linear-gradient(170deg,#FFF5E6,#FBE9D7);opacity:0;transition:opacity .35s}
#ttTrip.v-F.on .desk{opacity:1}#ttTrip.v-F[data-st=exit] .desk{opacity:0;transition:opacity .5s .3s}
#ttTrip.v-F .tp-bg{display:none}
#ttTrip.v-F .env{position:absolute;left:50%;top:56%;width:420px;height:250px;margin-left:-210px;background:#FFE1EC;border:3px solid var(--ink);border-radius:10px;opacity:0;transition:opacity .3s}
#ttTrip.v-F .env .flap{position:absolute;left:0;right:0;top:0;height:140px;background:#FFC6DD;clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top;transition:transform .4s}
#ttTrip.v-F[data-st=search] .env{opacity:1;animation:tpWob .8s ease-in-out infinite}
@keyframes tpWob{50%{transform:rotate(2deg)}}
#ttTrip.v-F .tp-msg{background:rgba(122,74,54,.85)}#ttTrip.v-F .tp-search{justify-content:flex-start;padding-top:20px}#ttTrip.v-F .tp-slots{display:none}
#ttTrip.v-F .tp-card{grid-template-columns:minmax(0,1fr) 220px;border-radius:6px;background:#FFFDF8;border:none;padding:26px 26px 26px 30px;
 box-shadow:0 0 0 10px #FFFDF8,0 0 0 14px transparent,0 22px 60px rgba(90,50,20,.3);outline:8px solid transparent;
 background-image:linear-gradient(#FFFDF8,#FFFDF8),repeating-linear-gradient(-45deg,#FF7AA8 0 14px,#FFFDF8 14px 22px,#7FC9F0 22px 36px,#FFFDF8 36px 44px);background-origin:border-box;background-clip:padding-box,border-box;border:8px solid transparent}
#ttTrip.v-F .tp-pic{order:2;width:210px;height:236px;box-sizing:border-box;background:#fff;border:3px dashed #F2B8CC;border-radius:6px;box-shadow:0 0 0 6px #fff,0 3px 10px 6px rgba(90,50,20,.12);transform:rotate(2deg)}
#ttTrip.v-F .tp-frame{left:8px;top:10px;width:188px;height:188px}#ttTrip.v-F .tp-ring{display:none}#ttTrip.v-F .tp-doll{right:-4px;bottom:-6px;width:96px;height:96px}
#ttTrip.v-F .tp-mark{display:grid;place-items:center;position:absolute;left:-60px;top:-22px;width:118px;height:118px;border-radius:50%;border:3px solid rgba(233,75,122,.75);color:rgba(233,75,122,.85);text-align:center;transform:rotate(-16deg) scale(1.6);opacity:0;z-index:3}
#ttTrip.v-F .tp-mark b{font-size:12px;letter-spacing:1px}#ttTrip.v-F .tp-mark small{font-size:10px;font-weight:900}
#ttTrip.v-F.ready .tp-mark{animation:tpPost .35s cubic-bezier(.2,.9,.3,1.3) forwards}
@keyframes tpPost{to{opacity:1;transform:rotate(-16deg) scale(1)}}
#ttTrip.v-F .tp-info{background:repeating-linear-gradient(transparent 0 29px,rgba(127,201,240,.35) 29px 30px);padding-right:14px;border-right:2px dashed #E7D7C6}
#ttTrip.v-F[data-st=show] .tp-card{animation:tpPostIn .8s cubic-bezier(.2,.9,.3,1.1) both}
@keyframes tpPostIn{from{opacity:0;transform:translateY(160px) rotate(8deg) scale(.8)}to{opacity:1;transform:rotate(-1.5deg)}}
#ttTrip.v-F[data-st=fail] .tp-card{transform:rotate(-1.5deg)}
#ttTrip.v-F[data-st=exit] .tp-card{animation:tpOutF .65s ease-in forwards}
@keyframes tpOutF{to{opacity:0;transform:translate(260px,-260px) rotate(18deg) scale(.6)}}

/* ===== G 拉霸轉盤：霓虹燈機台，三排頭像轉動，停下後吐出票券 ===== */
#ttTrip.v-G .machine{position:absolute;left:50%;top:50%;width:600px;height:330px;margin:-210px 0 0 -300px;border-radius:30px;border:4px solid var(--ink);background:linear-gradient(180deg,#FF8DB5,#C08CFF);box-shadow:0 10px 0 var(--ink),inset 0 0 0 8px rgba(255,255,255,.35);
 opacity:0;transform:translateY(40px);transition:.4s}
#ttTrip.v-G[data-st=search] .machine{opacity:1;transform:none}
#ttTrip.v-G .bulbs{position:absolute;left:24px;right:24px;height:14px;background:radial-gradient(circle,#FFF6C2 4px,transparent 5px) 0 0/28px 14px;animation:tpBulb .5s steps(2) infinite}
#ttTrip.v-G .bulbs.t{top:12px}#ttTrip.v-G .bulbs.b{bottom:12px;animation-delay:.25s}
@keyframes tpBulb{50%{filter:brightness(.55)}}
#ttTrip.v-G .logo{position:absolute;left:50%;top:-30px;transform:translateX(-50%);padding:8px 22px;border-radius:999px;background:var(--ink);color:#FFF3A8;font:900 18px/1 'TT Title','Rammetto One',sans-serif;letter-spacing:3px;white-space:nowrap}
#ttTrip.v-G .tp-search{z-index:1}#ttTrip.v-G .tp-slots{gap:10px;padding:14px;border-radius:18px;background:#fff;border:4px solid var(--ink);margin-top:-40px}
#ttTrip.v-G .tp-slot{width:120px;height:120px;border-radius:12px;overflow:hidden;background:#F6F2FF}
#ttTrip.v-G .tp-slot .tp-mini{border-radius:12px;border:none;box-shadow:none;animation:tpReel .09s linear infinite}
@keyframes tpReel{from{transform:translateY(-30%)}to{transform:translateY(30%)}}
#ttTrip.v-G .tp-msg{margin-top:6px}
#ttTrip.v-G .tp-card{border-radius:14px;background:radial-gradient(circle at 0 50%,transparent 14px,#FFFDF8 15px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,transparent 14px,#FFFDF8 15px) right/51% 100% no-repeat;
 border:none;box-shadow:0 20px 60px rgba(10,8,40,.45);outline:3px dashed rgba(28,33,86,.25);outline-offset:-12px}
#ttTrip.v-G .tp-card{padding-right:74px}
#ttTrip.v-G .tp-mark{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;position:absolute;right:0;top:0;bottom:0;width:56px;border-left:3px dashed rgba(28,33,86,.25);writing-mode:vertical-rl;font-weight:900;color:var(--pink);letter-spacing:3px}
#ttTrip.v-G .tp-mark b{font-size:13px}#ttTrip.v-G .tp-mark small{font-size:11px;color:#7A6BB0}
#ttTrip.v-G[data-st=show] .tp-card{animation:tpPrint .8s cubic-bezier(.3,.8,.3,1) both}
@keyframes tpPrint{from{clip-path:inset(0 0 100% 0);transform:translateY(-60px)}to{clip-path:inset(0 0 0 0);transform:none}}
#ttTrip.v-G[data-st=exit] .tp-card{animation:tpOutG .6s ease-in forwards}
@keyframes tpOutG{to{opacity:0;transform:translateY(160px) rotate(-6deg)}}

/* ===== H 雜誌封面：整頁封面版型，大標＋鏤空大字＋條碼，翻頁離場 ===== */
#ttTrip.v-H .tp-fx{background:linear-gradient(115deg,#FFF 0 54%,#FFE1EC 54% 72%,#E4D2FF 72%);opacity:0;transition:opacity .3s}
#ttTrip.v-H.on .tp-fx{opacity:1}#ttTrip.v-H .tp-bg{display:none}
#ttTrip.v-H .mast{position:absolute;left:4%;top:3%;font:400 120px/.9 'TT Title','Rammetto One',sans-serif;color:var(--ink);letter-spacing:2px;opacity:.95}
#ttTrip.v-H .issue{position:absolute;left:4.4%;top:calc(3% + 222px);font:900 13px/1 var(--sk-head,sans-serif);letter-spacing:3px;color:var(--pink)}
#ttTrip.v-H .block{position:absolute;right:-6%;top:-10%;width:34%;height:130%;background:var(--ink);transform:skewX(-14deg);opacity:.9}
#ttTrip.v-H .bar{position:absolute;right:4%;bottom:11%;width:110px;height:54px;background:repeating-linear-gradient(90deg,var(--ink) 0 2px,transparent 2px 4px,var(--ink) 4px 7px,transparent 7px 9px);border:6px solid #fff;box-sizing:content-box}
#ttTrip.v-H .who{position:absolute;right:6%;top:50%;transform:translateY(-50%);font:400 96px/.95 'TT Title','Rammetto One',sans-serif;color:transparent;-webkit-text-stroke:2px #fff;text-align:right;opacity:0}
#ttTrip.v-H[data-st=search] .who{animation:tpBlink .5s steps(2) infinite}
@keyframes tpBlink{50%{opacity:1}}

#ttTrip.v-H .tp-stage{width:min(940px,94vw);transform-origin:left center}
#ttTrip.v-H .tp-card{grid-template-columns:minmax(0,1fr) 300px;background:none;border:none;box-shadow:none;padding:110px 10px 0 10px}
#ttTrip.v-H .tp-pic{order:2;width:300px;height:300px}#ttTrip.v-H .tp-frame{left:10px;top:10px;width:270px;height:270px}#ttTrip.v-H .tp-ring{left:0;top:0;width:290px;height:290px;border-color:rgba(255,255,255,.6)}
#ttTrip.v-H .tp-doll{width:140px;height:140px;right:-30px;bottom:-30px}
#ttTrip.v-H .tp-title b{font-size:52px;background:linear-gradient(transparent 58%,#FFC6DD 58%)}#ttTrip.v-H .tp-title span{font-size:22px}
#ttTrip.v-H .tp-quote{font-size:18px;background:none;padding:6px 0 0 18px;border-left:5px solid var(--pink);border-radius:0}#ttTrip.v-H .tp-quote::before{display:none}
#ttTrip.v-H .tp-rows div{background:rgba(255,255,255,.75)}
#ttTrip.v-H[data-st=show] .tp-title b{animation:tpWipe .7s cubic-bezier(.2,.9,.3,1) both}
@keyframes tpWipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
#ttTrip.v-H[data-st=show] .tp-card{animation:tpPop .5s both}
#ttTrip.v-H[data-st=exit] .tp-stage{animation:tpTurn .75s cubic-bezier(.6,0,.4,1) forwards}#ttTrip.v-H[data-st=exit] .tp-fx{transition:opacity .4s .35s;opacity:0}
#ttTrip.v-H[data-st=exit] .tp-card{animation:none}
@keyframes tpTurn{to{transform:rotateY(-95deg);opacity:0}}
#ttTrip.v-H .tp-go{bottom:-70px}

@media (prefers-reduced-motion:reduce){#ttTrip *,#ttTrip *::before,#ttTrip *::after{animation:none!important;transition:none!important}}
`;
document.head.append(css);

// ---------- 試看面板（?tripdemo=1，本機預覽用）----------
function demoPanel(){if(!/[?&]tripdemo\b/.test(location.search)||document.getElementById('ttTripDemo'))return;
 const p=document.createElement('div');p.id='ttTripDemo';
 const btns=f=>Object.entries(STYLES).filter(([k])=>f(k)).map(([k,n])=>'<button type="button" data-s="'+k+'">'+k+' '+n+'</button>').join('');
 p.innerHTML='<b>隨機拜訪過場・試看</b><small>A 加強版</small><div class="row">'+btns(k=>k[0]==='A')+'</div>'
  +'<details><summary>其他樣式</summary><div class="row">'+btns(k=>k[0]!=='A')+'</div></details>'
  +'<label><input type="checkbox" class="f"> 先遇到一間客滿</label><label><input type="checkbox" class="h" checked> 主人在家</label>';
 const st=document.createElement('style');st.textContent='#ttTripDemo{position:fixed;left:12px;top:120px;z-index:400;width:230px;padding:10px;border-radius:14px;background:#fff;border:3px solid #1C2156;box-shadow:0 4px 0 #1C2156;font:13px var(--sk-head,sans-serif);color:#1C2156;display:flex;flex-direction:column;gap:6px}'
  +'#ttTripDemo small{font-weight:900;color:#FF4F8B}#ttTripDemo summary{cursor:pointer;font-weight:900;font-size:12px}#ttTripDemo details .row{margin-top:5px}'
  +'#ttTripDemo .row{display:grid;grid-template-columns:1fr 1fr;gap:5px}#ttTripDemo button{font:inherit;font-size:12px;font-weight:900;padding:6px 4px;border-radius:9px;border:2px solid #1C2156;background:#FFF0F6;cursor:pointer}#ttTripDemo button.on{background:#FF4F8B;color:#fff}';
 document.head.append(st);document.body.append(p);
 p.onclick=async e=>{const b=e.target.closest('button[data-s]');if(!b)return;p.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  const list=(await (window.TTHouse?.tripSample?.()||Promise.resolve([])))||[];const home=p.querySelector('.h').checked;
  const fake=[['栗子','k7f3a'],['阿橘','kq2m9'],['小雨','kz81c'],['布丁','kp4w6'],['星星','kx5d0']].map(([name,key],i)=>({name,key,tags:['夜貓子','慢慢玩'],games:'星露谷',bm:3+i,bd:14,quote:'歡迎來我家坐坐～',size:i%2?18:14,n:8+i*3,vip:i%4,doll:{hair:i%5}}));
  const cands=list.concat(fake).slice(0,5);   // 試看用：候選人不到 5 位時補幾位假的（底片才排得滿）
  cands.forEach(c=>c.home=home);demo(b.dataset.s,cands,p.querySelector('.f').checked);};}
async function demo(s,cands,withFail){const keep=STYLE;STYLE=s;   // 試看時暫時換樣式，跑完換回來
 try{open();await search(cands);
  if(withFail){await show(cands[cands.length>1?1:0]);await fail('full');await search(cands);}
  await show(cands[0]);await done(sleep(1200));}
 finally{STYLE=keep;}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',demoPanel);else demoPanel();

window.TTHouseTrip={open,search,show,fail,done,close,STYLES,get style(){return STYLE;},set style(v){if(STYLES[v])STYLE=v;}};
})();
