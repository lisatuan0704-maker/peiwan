/* v502 掛機收益（使用者 11/08）：離線也累積——從上次領取（或第一次開始計時）算起，每小時 22 貓貓幣，最多存 8 小時（176），
   存滿就停，領取後從那一刻重新開始存。每天領一次，七天 1,232（使用者：每天只領一次，七天要夠抽一次十連）。
   資料 idle/<key> {at,tx,amount}；領取＝同一次寫入 idle（at＝伺服器時間）＋catTx idle＋cat lastTx＋餘額加 amount。
   金額由資料庫規則用伺服器時間把關（tests/security-rules-v428/build/harden-phase12.cjs），網頁算的只是顯示與送出的數字；
   RATE／CAP_H 改了要同步規則。需要 Discord 登入並綁定闆卡（同每日任務）；規則還沒發布時讀不到 idle，整條都不顯示。
   畫面：電腦＝左上角名牌下方的吊卡（#ttIdleHud）、手機＝上方個人卡下方（#ttmIdle）、錢包貓貓幣區（TTIdle.mount）。 */
(function(root){
'use strict';
const RATE=22,CAP_H=8,CAP=RATE*CAP_H,HOUR=3600000,FULL=CAP_H*HOUR,SAFE=5000;   // SAFE：網頁時鐘可能比伺服器快一點，少算 5 秒再送
const doc=root.document;
const G=n=>n==='db'?(typeof db!=='undefined'?db:null):n==='myKey'?(typeof myKey!=='undefined'?myKey:null):n==='ROOT'?(typeof ROOT!=='undefined'?ROOT:'peiwan'):null;
const fmt=n=>Number(n||0).toLocaleString('zh-TW');
const coin=(s,m,a)=>root.TTCat?TTCat.coin(s,m||'c',a||''):'';
let key=null,ref=null,cb=null,at=null,ok=false,busy=false,starting=false,offset=0,offOn=false,fullNoted=null,note='',noteOk=false,noteT=0;
const views=new Set();

function snow(){return Date.now()+offset;}
function calc(){
 if(at==null)return null;
 const el=Math.max(0,snow()-at),full=el-SAFE>=FULL;   // v505 存滿也留 5 秒安全差（原本剛滿 8 小時就給 176，網頁時鐘偏快會被資料庫拒絕）
 return {el,full,h:Math.min(CAP_H,el/HOUR),pct:Math.min(100,el/FULL*100),left:Math.max(0,FULL+SAFE-el),
  amt:Math.max(0,Math.min(CAP,Math.floor((el-SAFE)*RATE/HOUR)))};
}
function leftText(ms){
 let h=Math.floor(ms/HOUR),m=Math.ceil(ms%HOUR/60000);if(m===60){h++;m=0;}
 return h?(h+' 小時'+(m?' '+m+' 分':'')):(m||1)+' 分';
}

/* ── 資料 ── */
function watchOffset(){
 const d=G('db');if(!d||offOn)return;offOn=true;
 try{d.ref('.info/serverTimeOffset').on('value',s=>{offset=Number(s.val())||0;});}catch(_){}
}
function watch(){
 const d=G('db'),fb=root.firebase;if(!d||!fb)return;
 watchOffset();
 let u=null;try{u=fb.auth().currentUser;}catch(_){}
 const k=(u&&G('myKey'))||null;
 if(k===key&&(ref||!k))return;
 if(ref&&cb){try{ref.off('value',cb);}catch(_){}}
 ref=null;cb=null;key=k;at=null;ok=false;starting=false;fullNoted=null;
 paint();
 if(!k)return;
 ref=d.ref(G('ROOT')+'/idle/'+k);
 cb=s=>{if(key!==k)return;const v=s.val();
  if(v&&typeof v.at==='number'){at=v.at;ok=true;}
  else{at=null;ok=false;start(k);}
  paint();};
 ref.on('value',cb,()=>{if(key===k){ok=false;at=null;paint();}});   // 規則還沒發布或不是本人：不顯示
}
async function start(k){   // 第一次：開始計時（只能寫伺服器現在時間）
 if(starting)return;starting=true;
 try{await G('db').ref(G('ROOT')+'/idle/'+k).set({at:root.firebase.database.ServerValue.TIMESTAMP});}
 catch(e){console.warn('[idle] 開始計時',e&&e.code||e);}
 finally{starting=false;}   // v505 寫完（或失敗）就放開：紀錄被後台刪掉、第一次沒寫成功時，下次讀到空的還能重新開始計時
}
async function claim(btn){
 const k=key,c=calc();
 if(!k||!ok||busy||!c||c.amt<1)return;
 busy=true;paint();
 const d=G('db'),SV=root.firebase.database.ServerValue,R=G('ROOT');
 const tx=d.ref(R+'/catTx/'+k).push().key,amt=c.amt,ch={},lastAt=at;
 ch['idle/'+k]={at:SV.TIMESTAMP,tx,amount:amt};
 ch['catTx/'+k+'/'+tx]={type:'idle',amount:amt,ref:tx,note:'掛機收益',ts:SV.TIMESTAMP};
 ch['cat/'+k+'/balance']=SV.increment(amt);
 ch['cat/'+k+'/lastTx']=tx;
 const from=btn&&btn.isConnected?btn.getBoundingClientRect():null;
 try{
  await d.ref(R).update(ch);
  if(key===k){
   say('收到 '+fmt(amt)+' 貓貓幣，下一輪開始存囉',true);fly(from,amt);
   try{root.lobbyNotify?.({ok:true,icon:'coin',title:'掛機收益：收到 '+fmt(amt)+' 貓貓幣',sub:'已經存進錢包，下一輪從現在開始存 ✦',hold:5000});}catch(_){}
  }
 }catch(e){
  console.warn('[idle] 領取',e&&e.code||e);
  // 另一台裝置剛領過（時間已經變了）或時鐘差一點：重新讀一次，請他稍等再按
  if(key===k)say(at!==lastAt?'剛剛已經領過了，進度重新開始存':'這次沒有領到，稍等一下再試一次',false);
 }finally{busy=false;paint();}
}
function say(t,good){note=t;noteOk=!!good;clearTimeout(noteT);noteT=setTimeout(()=>{note='';paint();},4500);paint();}

/* ── 畫面 ── */
const TIP='每小時存 '+RATE+' 貓貓幣，最多存 '+CAP_H+' 小時（'+CAP+'）。關掉網頁也會繼續存，存滿就停，領取後重新開始。';
function html(kind){
 return '<div class="tt-idle tt-idle-'+kind+'" role="group" aria-label="掛機收益" title="'+TIP+'">'
  +'<span class="tt-idle-ic" aria-hidden="true"><i class="tt-idle-dia"></i>'+coin(kind==='hud'?28:32,'c')+'<i class="tt-idle-spark">✦</i></span>'
  +'<div class="tt-idle-main">'
   +'<div class="tt-idle-top"><b>掛機收益</b><em>IDLE'+(kind==='hud'?'':'<span class="tt-idle-em2"> BONUS</span>')+'</em><span class="tt-idle-h"></span></div>'
   +'<div class="tt-idle-bar" role="progressbar" aria-label="掛機收益累積時數" aria-valuemin="0" aria-valuemax="'+CAP_H+'"><i class="tt-idle-fill"></i><span class="tt-idle-ticks" aria-hidden="true"></span></div>'
   +'<p class="tt-idle-sub" aria-live="polite"></p>'
  +'</div>'
  +'<button type="button" class="tt-idle-go"><small>領取</small><span class="tt-idle-amt"></span></button>'
 +'</div>';
}
/* 掛到 host 裡（錢包每次重畫都會給新的 host，舊的自動丟掉） */
function mount(host,kind='w'){
 if(!host)return null;
 host.innerHTML=html(kind);
 const v={host,kind,box:host.firstChild,last:''};
 v.h=host.querySelector('.tt-idle-h');v.fill=host.querySelector('.tt-idle-fill');v.bar=host.querySelector('.tt-idle-bar');
 v.sub=host.querySelector('.tt-idle-sub');v.go=host.querySelector('.tt-idle-go');v.amt=host.querySelector('.tt-idle-amt');
 v.go.addEventListener('click',e=>{e.stopPropagation();claim(v.go);});
 views.add(v);paintOne(v);
 return v;
}
function paintOne(v){
 const c=ok?calc():null,show=!!c;
 if(v.host.hidden===show)v.host.hidden=!show;
 if(!show)return;
 const amt=c.amt,ready=amt>=1&&!busy;
 const hTxt=c.full?'存滿了':(Math.floor(c.h*10)/10).toFixed(1);
 const sub=note||(c.full?'最多存 '+CAP_H+' 小時，領取後才會重新開始存':'每小時 '+RATE+'・再 '+leftText(c.left)+'存滿');
 const sig=[hTxt,Math.floor(c.pct*4),amt,ready,busy,sub,c.full].join('|');
 if(sig===v.last)return;v.last=sig;
 v.box.classList.toggle('is-full',c.full);v.box.classList.toggle('is-ready',ready);v.box.classList.toggle('is-busy',busy);
 v.h.innerHTML=c.full?'存滿了':hTxt+'<i>／'+CAP_H+' 小時</i>';
 v.fill.style.width=c.pct.toFixed(2)+'%';
 v.bar.setAttribute('aria-valuenow',(Math.floor(c.h*10)/10).toFixed(1));
 v.bar.setAttribute('aria-valuetext','已存 '+(Math.floor(c.h*10)/10)+' 小時，可領 '+amt+' 貓貓幣');
 v.sub.textContent=sub;v.sub.classList.toggle('ok',!!note&&noteOk);
 v.amt.innerHTML=coin(16,'c')+'<b>'+fmt(amt)+'</b>';
 v.go.disabled=!ready;
 v.go.setAttribute('aria-label',busy?'領取中':amt>=1?'領取 '+amt+' 貓貓幣':'累積中，還不能領取');
 v.go.querySelector('small').textContent=busy?'領取中':amt>=1?'領取':'累積中';
}
function paint(){
 for(const v of views){if(!v.host.isConnected&&!v.keep){views.delete(v);continue;}paintOne(v);}
 const c=ok?calc():null;
 if(c&&c.full&&fullNoted!==at){   // 存滿提醒：每一輪一次
  fullNoted=at;
  try{root.lobbyNotify?.({icon:'coin',title:'掛機收益存滿了',sub:'按掛機收益的「領取」收下 '+CAP+' 貓貓幣 ✦',hold:6000});}catch(_){}
 }
 placeHud();
}

/* 領到時：小硬幣從按鈕飛到名牌（手機：上方卡片）的貓貓幣上 */
function fly(from,amt){
 if(!from||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const t=doc.querySelector('#hud2 .tt-fund-cat .nyan,#ttmCoins .nyan[data-cat-pop]');
 const tr=t&&t.getClientRects().length?t.getBoundingClientRect():null;
 const x0=from.left+from.width/2,y0=from.top+from.height/2,n=Math.min(8,3+Math.ceil(amt/40));
 for(let i=0;i<n;i++){
  const s=doc.createElement('span');s.className='tt-idle-fly';s.innerHTML=coin(20,'c');
  s.style.left=x0-10+'px';s.style.top=y0-10+'px';doc.body.append(s);
  const ang=(i/n)*Math.PI*2,dx=Math.cos(ang)*28,dy=Math.sin(ang)*18-14;
  const tx=tr?tr.left+tr.width/2-x0:dx*2,ty=tr?tr.top+tr.height/2-y0:-90;
  const a=s.animate([{transform:'translate(0,0) scale(.6)',opacity:0},{transform:'translate('+dx+'px,'+dy+'px) scale(1.15)',opacity:1,offset:.28},{transform:'translate('+tx+'px,'+ty+'px) scale(.7)',opacity:.9}],{duration:760+i*45,delay:i*55,easing:'cubic-bezier(.5,0,.3,1)',fill:'backwards'});
  a.onfinish=()=>s.remove();setTimeout(()=>s.remove(),2000);
 }
}

/* 電腦：掛在左上角名牌白卡下方（跟著名牌縮放）；手機功能首頁不顯示這條 */
let hudHost=null,mHost=null;
function placeHud(){
 if(!hudHost)return;
 const hud=doc.getElementById('hud2'),html=doc.documentElement;
 const vis=!hudHost.hidden&&hud&&getComputedStyle(hud).display!=='none'&&!html.classList.contains('ttm-on')&&!doc.body.classList.contains('mhome-on')&&hud.getClientRects().length>0;
 hudHost.classList.toggle('off',!vis);
 if(!vis)return;
 const r=hud.getBoundingClientRect(),cs=getComputedStyle(hud),sc=parseFloat(cs.scale)||1;
 const af=getComputedStyle(hud,'::after'),who=hud.querySelector('.h2who');
 const cardL=af.content&&af.content!=='none'?r.left+parseFloat(af.left)*sc:r.left;
 const cardB=af.content&&af.content!=='none'?r.bottom-parseFloat(af.bottom)*sc:r.bottom;
 const left=Math.max(cardL,(who?who.getBoundingClientRect().left:cardL)-10*sc),right=r.right-12*sc;
 hudHost.style.left=Math.round(left)+'px';hudHost.style.top=Math.round(cardB+11*sc)+'px';
 hudHost.style.width=Math.round((right-left)/sc)+'px';hudHost.style.scale=String(sc);
 nudgePlay();
}
/* 遊玩中吊卡原本貼在名牌正下方：有掛機收益時往下讓開 */
function nudgePlay(){
 const host=doc.getElementById('playCardHost');
 if(!host||!host.firstChild||!hudHost||hudHost.hidden||hudHost.classList.contains('off'))return;
 const b=hudHost.getBoundingClientRect(),t=Math.round(b.bottom+10);
 if((parseFloat(host.style.top)||0)<t)host.style.top=t+'px';
}
function setup(){
 injectCss();
 if(!hudHost){
  hudHost=doc.createElement('div');hudHost.id='ttIdleHud';doc.body.append(hudHost);
  const v=mount(hudHost,'hud');v.keep=true;
  const h=doc.getElementById('hud2');
  if(h&&root.ResizeObserver)new ResizeObserver(placeHud).observe(h);
  new MutationObserver(placeHud).observe(doc.body,{attributes:true,attributeFilter:['class']});
  root.addEventListener('resize',placeHud);
  const pp=root.positionPlayCard;
  if(typeof pp==='function')root.positionPlayCard=function(){const r=pp.apply(this,arguments);try{nudgePlay();}catch(_){}return r;};
 }
 const top=doc.getElementById('ttmTop');
 if(top&&!mHost){
  mHost=doc.createElement('div');mHost.id='ttmIdle';
  const card=top.querySelector('.ttm-card');card?card.after(mHost):top.prepend(mHost);
  const v=mount(mHost,'m');v.keep=true;
 }
}

const css=`html.ttm-on .tt-idle-slot{display:none!important}   /* v505 手機：上方個人卡下面已經有一張，錢包頁不要再出現第二張 */
#ttIdleHud{position:fixed;z-index:71;transform-origin:top left;pointer-events:auto}
#ttIdleHud.off{display:none}
#ttIdleHud[hidden],#ttmIdle[hidden],.tt-idle-slot[hidden]{display:none!important}
#ttIdleHud::before,#ttIdleHud::after{content:"";position:absolute;top:-21px;width:7px;height:27px;border:2.5px solid #1C2156;border-radius:6px;background:linear-gradient(#fff 40%,#FFE3EF);box-shadow:2px 2px 0 rgba(28,33,86,.25);z-index:-1}
#ttIdleHud::before{left:26px}#ttIdleHud::after{right:30px}
#ttIdleHud.off::before,#ttIdleHud.off::after{display:none}
.tt-idle{--ink:#1C2156;container-type:inline-size;position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px 8px 7px 10px;color:var(--ink);font-family:inherit;
 background:linear-gradient(118deg,rgba(140,215,248,.28) 0 7%,transparent 7% 92%,rgba(255,175,212,.3) 92%),linear-gradient(160deg,#fff,#F6FAFF 60%,#FBF4FF);
 border:3px solid var(--ink);border-radius:14px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px #CFEFFF,5px 6px 0 -3px #FFE3EF,5px 6px 0 0 var(--ink),rgba(18,14,48,.22) 0 8px 16px;overflow:hidden}
.tt-idle-ic{position:relative;display:grid;place-items:center;width:36px;height:36px}
.tt-idle-ic>.nyan{position:relative;z-index:1;animation:ttIdleBob 2.4s ease-in-out infinite}
.tt-idle-dia{position:absolute;inset:4px;border:2px solid #FF4F8B;border-radius:4px;transform:rotate(45deg);opacity:.55;animation:ttIdleSpin 7s linear infinite}
.tt-idle-spark{position:absolute;right:-3px;top:-4px;z-index:2;font-style:normal;font-size:12px;color:#FFB300;opacity:0;text-shadow:0 0 4px #fff}
.tt-idle-main{min-width:0;display:grid;gap:4px}
.tt-idle-top{display:flex;align-items:baseline;gap:6px;min-width:0;white-space:nowrap}
.tt-idle-top b{font-size:13px;letter-spacing:.06em}
.tt-idle-top em{font-style:normal;font-size:8px;letter-spacing:.16em;color:#fff;background:var(--ink);padding:1px 6px 1px 5px;clip-path:polygon(0 0,100% 0,calc(100% - 5px) 100%,0 100%)}
.tt-idle-h{margin-left:auto;font-size:14px;font-weight:800;font-family:'Tavern Numerals','TT Huninn',inherit;color:#C2366F}
.tt-idle-h i{font-style:normal;font-size:10px;font-weight:700;color:#8a7aa3;margin-left:1px}
.tt-idle-bar{position:relative;height:11px;border:2px solid var(--ink);border-radius:999px;background:#EEF2FF;overflow:hidden}
.tt-idle-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:999px;transition:width .6s ease;
 background:repeating-linear-gradient(-45deg,rgba(255,255,255,.38) 0 5px,transparent 5px 10px),linear-gradient(90deg,#FF8DB6,#FF4F8B 55%,#FFB547);background-size:14px 14px,100% 100%;animation:ttIdleFlow 1.1s linear infinite}
.tt-idle-ticks{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(12.5% - 1px),rgba(28,33,86,.28) calc(12.5% - 1px) 12.5%);pointer-events:none}
.tt-idle-sub{margin:0;font-size:10.5px;line-height:1.3;color:#7d6b93;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tt-idle-sub.ok{color:#2f8f5b;font-weight:700}
.tt-idle-go{display:grid;justify-items:center;gap:1px;min-width:58px;padding:5px 9px 6px;border:2.5px solid var(--ink);border-radius:11px;font-family:inherit;cursor:pointer;color:#fff;
 background:linear-gradient(180deg,#FF8DB6,#FF4F8B);box-shadow:0 3px 0 var(--ink);transition:transform .12s,box-shadow .12s}
.tt-idle-go small{font-size:10.5px;font-weight:800;letter-spacing:.12em}
.tt-idle-amt{display:flex;align-items:center;gap:3px}.tt-idle-amt b{font-size:15px;font-family:'Tavern Numerals','TT Huninn',inherit;line-height:1}
.tt-idle-go:hover:not(:disabled){transform:translateY(-1px)}
.tt-idle-go:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.tt-idle-go:disabled{cursor:default;color:#7d6b93;background:linear-gradient(180deg,#fff,#F1ECF8);box-shadow:0 2px 0 #b8aecb;border-color:#9d92b8}
.tt-idle-go:focus-visible{outline:3px solid #8CD7F8;outline-offset:2px}
.tt-idle.is-full .tt-idle-fill{background:repeating-linear-gradient(-45deg,rgba(255,255,255,.5) 0 5px,transparent 5px 10px),linear-gradient(90deg,#FFB547,#FF4F8B,#FFB547);background-size:14px 14px,200% 100%;animation:ttIdleFlow 1.1s linear infinite,ttIdleShine 2.2s ease-in-out infinite}
.tt-idle.is-full .tt-idle-spark{animation:ttIdleTwinkle 1.6s ease-in-out infinite}
.tt-idle.is-full .tt-idle-dia{border-color:#FFB547;opacity:.9;animation-duration:3s}
.tt-idle.is-full .tt-idle-go:not(:disabled){animation:ttIdlePulse 1.4s ease-in-out infinite}
.tt-idle.is-busy .tt-idle-go{opacity:.7}
.tt-idle-hud{width:100%;box-sizing:border-box}
.tt-idle-hud .tt-idle-sub{display:none}
.tt-idle-hud .tt-idle-ic{width:30px;height:30px}
.tt-idle-m{margin:8px 0 2px;padding:8px 9px 8px 10px}
.tt-idle-w{margin:0}
.tt-idle-fly{position:fixed;z-index:12000;pointer-events:none;width:20px;height:20px}
@keyframes ttIdleFlow{from{background-position:0 0,0 0}to{background-position:14px 0,0 0}}
@keyframes ttIdleShine{0%,100%{background-position:0 0,0 0}50%{background-position:14px 0,100% 0}}
@keyframes ttIdleSpin{to{transform:rotate(405deg)}}
@keyframes ttIdleBob{0%,100%{translate:0 0}50%{translate:0 -2px}}
@keyframes ttIdleTwinkle{0%,100%{opacity:0;scale:.5}45%{opacity:1;scale:1.15}}
@keyframes ttIdlePulse{0%,100%{box-shadow:0 3px 0 var(--ink),0 0 0 0 rgba(255,79,139,.55)}50%{box-shadow:0 3px 0 var(--ink),0 0 0 7px rgba(255,79,139,0)}}
@container (max-width:380px){.tt-idle-em2{display:none}.tt-idle-top{gap:5px}}
@media (prefers-reduced-motion:reduce){.tt-idle *{animation:none!important}}`;
function injectCss(){if(doc.getElementById('ttIdleCss'))return;const s=doc.createElement('style');s.id='ttIdleCss';s.textContent=css;doc.head.append(s);}

root.TTIdle={RATE,CAP_H,CAP,mount,claim:()=>claim(null),calc,state:()=>({key,ok,at,offset,busy})};
setup();
try{root.firebase.auth().onAuthStateChanged(()=>setTimeout(watch,0));}catch(_){}
setInterval(()=>{watch();},3000);
setInterval(paint,1000);
watch();
})(window);
