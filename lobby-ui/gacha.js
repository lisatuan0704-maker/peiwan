/* v504 家具扭蛋（D 2026/11/08「上酒館大廳」）：小屋右下多一顆「扭蛋」→ 整頁蓋上扭蛋視窗（gacha/3d/index.html，iframe）。
   卡池：人魚卡池（海底人魚屋）、森林卡池（森林精靈小屋）、通用（酒館日常＋萬用）；單抽 120、十連 1,200 貓貓幣。
   抽卡結果由付款主機決定（pay.tinytavern.tw/api/gacha，帶 Discord 登入憑證）：主機確認是闆卡主人 → 抽 → 扣貓貓幣 →
   放進小屋背包 houseInv/<闆卡>/<家具>/<抽卡編號>（src:'gacha'）→ 回傳抽到哪些，這頁只負責演出。網頁改不到機率、也不能自己加家具。
   這支只負責：開關視窗、把貓貓幣餘額與背包裡有的家具交給扭蛋頁（window.TTGachaHost）、帶憑證去主機抽。
   抽到的家具會出現在小屋的「我的家具」（house.js 本來就在看 houseInv），家具店不賣（catalog.json 標 gacha:true）。
   家具券（D 2026/11/21 拍板，11/23 中華卡池起所有卡池）：抽到重複的家具不再多一件，改成家具券；家具券可以買抽過的家具（原色再一件）與異色家具（<原key>~1..3）。
   餘額 houseTix/<闆卡>/balance 只有主機寫、本人讀；這支一直盯著（同貓貓幣），給扭蛋頁（HOST.tix／sub）與小屋（tt-house-tix 事件）用。
   用券買＝POST <PAY_API>/api/house-tix {myKey,k,c}（c＝0 原色、1～3 異色），帶 Discord 登入憑證，主機確認抽過、扣券、放進 houseInv（src:'tix'）。 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const R=()=>typeof ROOT!=='undefined'?ROOT:'peiwan';
const KEY=()=>typeof myKey!=='undefined'?myKey:null;
const DB=()=>typeof db!=='undefined'?db:null;
const BASE=()=>typeof PAY_API!=='undefined'?PAY_API:'https://pay.tinytavern.tw',API=()=>BASE()+'/api/gacha';
const VER='561';
const G={ov:null,fr:null,inv:{},off:null,subs:new Set(),busy:false,sched:null,tix:0,tixOk:false,tixSub:null,info:null,infoAt:0,tbusy:false};
const TIX_FROM0='2026-11-23T04:00:00+08:00';   // 讀不到主機時的備用；以主機 gacha-pools.json 的 tix.from 為準（主機一樣會擋）

// ---------- 給扭蛋頁的介面（gacha/3d/g3d.js 讀 parent.TTGachaHost） ----------
// state()：balance＝貓貓幣、owned＝背包裡有的家具 key（含異色 <key>~n）、counts＝每件幾個、tix＝家具券餘額、tixOk＝讀得到家具券（規則發布了、登入是本人）
const state=()=>{const inv=G.inv||{},counts={};for(const [k,v] of Object.entries(inv))counts[k]=v&&typeof v==='object'?Object.keys(v).length:0;
 return {balance:Number.isSafeInteger(window.__cat)?window.__cat:0,owned:Object.keys(inv),counts,tix:G.tix,tixOk:G.tixOk};};
const emit=()=>{const s=state();G.subs.forEach(f=>{try{f(s);}catch(_){}});};
async function pull(pool,n){
 const key=KEY();if(!key)return {ok:false,code:'LOGIN_REQUIRED'};
 let token='';try{const u=firebase.auth().currentUser;if(u)token=await u.getIdToken();}catch(_){}
 if(!token)return {ok:false,code:'LOGIN_REQUIRED'};
 if(G.busy)return {ok:false,code:'BUSY'};G.busy=true;
 try{
  const r=await fetch(API(),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({myKey:key,pool,n})});
  const j=await r.json().catch(()=>null);
  return j&&typeof j==='object'?j:{ok:false,code:r.status===429?'TOO_MANY':'NET'};
 }catch(e){return {ok:false,code:'NET'};}
 finally{G.busy=false;}}
// 限定卡池檔期（兩週一期、星期一 04:00 換期）以主機 gacha-pools.json 為準：開視窗前讀 /api/gacha-info 的 schedule，
// 扭蛋頁用 HOST.schedule() 拿去顯示剩幾天；讀不到（主機還沒更新、網路慢）回 null，扭蛋頁就用它自己內建的那份。主機抽的時候一樣會擋檔期外的卡池。
// 同一次也收下家具券設定 tix（from、dup、priceOrig、priceVar）與異色名稱 variants（系列 → 名稱），給 HOST.tixInfo()。
// force＝每次開扭蛋都重讀；小屋要顯示家具券時用不 force 的（10 分鐘內讀過就不再讀）。
let infoP=null;
const numTab=o=>{const q={};if(o&&typeof o==='object')for(const [r,n] of Object.entries(o))if(Number.isSafeInteger(n)&&n>=0)q[r]=n;return q;};
function loadInfo(force){
 if(infoP)return infoP;if(!force&&G.infoAt&&Date.now()-G.infoAt<600000)return Promise.resolve(G.info);
 infoP=(async()=>{const c=typeof AbortController!=='undefined'?new AbortController():null,t=setTimeout(()=>c&&c.abort(),2500);
  try{const r=await fetch(BASE()+'/api/gacha-info',{cache:'no-store',signal:c&&c.signal});const j=await r.json();
   if(j&&Array.isArray(j.schedule))G.sched=j.schedule.filter(x=>x&&typeof x.pool==='string'&&typeof x.start==='string');
   if(j&&typeof j==='object'){const t0=j.tix,v0=j.variants,variants={};let tix=null;
    if(t0&&typeof t0==='object'&&typeof t0.from==='string'&&!isNaN(Date.parse(t0.from)))tix={from:t0.from,dup:numTab(t0.dup),priceOrig:numTab(t0.priceOrig),priceVar:numTab(t0.priceVar)};
    if(v0&&typeof v0==='object')for(const [s,a] of Object.entries(v0))if(Array.isArray(a))variants[s]=a.filter(x=>typeof x==='string').slice(0,3);
    G.info={tix,variants};G.infoAt=Date.now();tixEmit();}   // 主機回了但沒有 tix＝主機還是舊版（重複照舊多一件）
  }catch(_){}
  finally{clearTimeout(t);}
  return G.info;})().finally(()=>{infoP=null;});
 return infoP;}
const loadSched=()=>loadInfo(true);
// 家具券設定：{tix:{from,dup,priceOrig,priceVar}|null, variants:{系列:[名稱…]}}；還沒讀到主機回 null
const tixInfo=()=>G.info?JSON.parse(JSON.stringify(G.info)):null;
// 新制度開始了沒（主機回的 tix.from；主機讀到了卻沒有 tix＝舊主機＝還沒開始；還沒讀到用 11/23 04:00 備用）
function tixOpen(){const t=G.info?G.info.tix:{from:TIX_FROM0};if(!t)return false;return Date.now()>=Date.parse(t.from);}
// 價格（張）：r＝稀有度 common／rare／limited，c＝0 原色、1～3 異色；不知道就回 0
function tixCost(r,c){const t=G.info&&G.info.tix;if(!t)return 0;const n=(+c>0?t.priceVar:t.priceOrig)[r];return Number.isSafeInteger(n)?n:0;}

// ---------- 家具券餘額：一直盯著 houseTix/<闆卡>/balance（同 cat-coin.js 的貓貓幣） ----------
// 讀不到（規則還沒發布、還沒登入）：tixOk false、tix 0；之後 15 秒起、每次加倍（最多 5 分鐘）再試一次，登入狀態變了馬上再試。
// 有變化：通知扭蛋頁（sub 收到新的 state）＋大廳發 tt-house-tix 事件（detail {balance,ok}，小屋「我的家具」用）。
function tixEmit(){emit();try{window.dispatchEvent(new CustomEvent('tt-house-tix',{detail:{balance:G.tix,ok:G.tixOk}}));}catch(_){}}
function tixWatch(){const db=DB(),key=KEY();if(!db)return;const s=G.tixSub;
 if(s&&s.key===key&&!(s.err&&Date.now()-s.err>=s.wait))return;
 if(s){try{s.ref.off('value',s.h);}catch(_){}}
 const same=!!(s&&s.key===key);G.tixSub=null;
 if(!same&&(G.tix||G.tixOk)){G.tix=0;G.tixOk=false;tixEmit();}
 if(!key)return;
 const sub={key,err:0,wait:same?Math.min(300000,Math.max(15000,(s.wait||0)*2)):15000,ref:db.ref(R()+'/houseTix/'+key+'/balance')};
 sub.h=v=>{if(G.tixSub!==sub)return;const x=v.val();sub.wait=15000;G.tix=Number.isSafeInteger(x)?Math.max(0,x):0;G.tixOk=true;tixEmit();};
 G.tixSub=sub;sub.ref.on('value',sub.h,()=>{if(G.tixSub!==sub)return;sub.err=Date.now();if(G.tixOk){G.tixOk=false;tixEmit();}});}
setInterval(tixWatch,3000);setTimeout(tixWatch,0);
try{firebase.auth().onAuthStateChanged(()=>{const s=G.tixSub;if(s&&s.err)s.wait=0;setTimeout(tixWatch,0);});}catch(_){}
const tix=()=>G.tix;

// ---------- 用家具券買家具：k＝原本的家具 key（不帶 ~），c＝0 原色（再一件）、1～3 異色 ----------
// 回傳主機的回應：成功 {ok:true,key,balance,cost,id}（key＝放進背包的 key，異色是 k~c）；
// 失敗 {ok:false,code,msg,…}（msg＝可以直接顯示給客人的話；NOT_ENOUGH 會帶 balance／cost）。登入憑證跟 pull 一樣。
const twDay=s=>{const d=new Date(Date.parse(s)+8*3600000);return (d.getUTCMonth()+1)+'/'+d.getUTCDate();};
function tixMsg(j){const c=j&&j.code;
 if(c==='NOT_ENOUGH')return Number.isSafeInteger(j.cost)&&Number.isSafeInteger(j.balance)?'家具券不夠喔，這件要 '+j.cost+' 張，你現在有 '+j.balance+' 張':'家具券不夠喔';
 if(c==='NOT_OWNED')return '要先抽到這件家具，才能用家具券買';
 if(c==='NOT_YET'){const t=G.info&&G.info.tix;return '家具券 '+twDay((t&&t.from)||TIX_FROM0)+' 開始才能用喔';}
 if(c==='NOT_READY')return '家具券還在準備中，晚一點再來看看';
 if(c==='LOGIN_REQUIRED')return '要先用 Discord 登入，才能用家具券';
 if(c==='BUSY')return '扭蛋機有點忙，等一下再試一次';
 if(c==='TOO_MANY')return '按太快了，休息一下再來';
 if(c==='NET')return '連不上扭蛋機。先看看家具券和背包有沒有變，再決定要不要重買';
 if(c==='BAD_REQUEST'||c==='NO_VARIANT'||c==='BAD_ITEM')return '這件家具不能用家具券買';
 return '沒有買成功，請再試一次';}
async function buyTix(k,c){c=Number(c);
 const fail=(code,x)=>{const j={ok:false,code,...(x||{})};j.msg=tixMsg(j);return j;};
 if(typeof k!=='string'||!/^[A-Za-z0-9_-]{1,60}$/.test(k)||!Number.isInteger(c)||c<0||c>3)return fail('BAD_REQUEST');
 const key=KEY();if(!key)return fail('LOGIN_REQUIRED');
 let token='';try{const u=firebase.auth().currentUser;if(u)token=await u.getIdToken();}catch(_){}
 if(!token)return fail('LOGIN_REQUIRED');
 if(G.tbusy)return fail('BUSY');G.tbusy=true;
 try{
  const r=await fetch(BASE()+'/api/house-tix',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({myKey:key,k,c})});
  const j=await r.json().catch(()=>null);
  if(!j||typeof j!=='object')return fail(r.status===429?'TOO_MANY':r.status===404?'NOT_READY':r.status>=500?'BUSY':'NET');   // 404＝主機還沒更新到有家具券的版本
  if(j.ok===true){
   if(Number.isSafeInteger(j.balance)&&G.tixSub&&G.tixSub.key===key){G.tix=Math.max(0,j.balance);tixEmit();}   // 先照主機回的更新，資料庫的通知馬上也會到
   if(typeof j.key==='string'&&typeof j.id==='string'&&G.off){G.inv={...G.inv,[j.key]:{...(G.inv[j.key]||{}),[j.id]:{ts:Date.now(),src:'tix'}}};emit();}
   return j;}
  if(j.code==='NOT_ENOUGH'&&Number.isSafeInteger(j.balance)&&G.tixSub&&G.tixSub.key===key){G.tix=Math.max(0,j.balance);tixEmit();}
  const out={...j,ok:false,code:typeof j.code==='string'?j.code:'BUSY'};out.msg=tixMsg(out);return out;
 }catch(e){return fail('NET');}
 finally{G.tbusy=false;}}
// v508 抽完按「去擺放」：跟 × 一樣關掉扭蛋視窗 → 交給小屋（house.js 的 TTHouse.placeNew：進佈置、拿起第一件、標 NEW）；keys 扭蛋頁已排好（限定→稀有→普通、不重複）
function place(keys){
 if(!G.ov)return;const ks=Array.isArray(keys)?Array.from(keys).filter(k=>typeof k==='string'&&k).slice(0,10):[];   // 換成大廳這邊的陣列（iframe 的陣列 instanceof Array 不成立）
 close();
 try{const H=window.TTHouse;if(H&&H.placeNew&&!H.placeNew(ks)&&H.enter&&!document.body.classList.contains('tt-house-on')){   // v546 手機大廳也能轉扭蛋：在大廳按「去擺放」先回小屋，房間好了再拿出來
   H.enter();let n=0;const t=setInterval(()=>{let ok=false;try{ok=H.placeNew(ks);}catch(_){}if(ok||++n>40)clearInterval(t);},500);}}catch(_){}}
// 家具券：tix() 餘額、tixInfo() 主機的設定、tixOpen() 開始了沒、tixCost(r,c) 價格、buyTix(k,c) 買；餘額或背包變了 sub 收到新的 state()
window.TTGachaHost={state,pull,close,place,schedule:()=>G.sched,sub(fn){G.subs.add(fn);return ()=>G.subs.delete(fn);},
 tix,tixInfo,tixOpen,tixCost,buyTix,loadInfo};
window.addEventListener('tt-cat',emit);

// ---------- 開關扭蛋視窗 ----------
function open(pool){
 if(G.ov)return;
 const key=KEY();if(!key||!DB()){try{toast('先做一張闆卡、用 Discord 登入，才能轉扭蛋');}catch(_){}return;}
 const ref=DB().ref(R()+'/houseInv/'+key),h=s=>{G.inv=s.val()||{};emit();};
 ref.on('value',h,()=>{});G.off=()=>ref.off('value',h);
 const ov=document.createElement('div');ov.id='ttGachaOv';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','家具扭蛋');
 const f=document.createElement('iframe');f.title='家具扭蛋';f.allow='autoplay';
 ov.append(f);document.body.append(ov);G.ov=ov;G.fr=f;
 loadSched().then(()=>{if(G.fr===f)f.src='gacha/3d/index.html?v='+VER+(pool?'&pool='+encodeURIComponent(pool):'');});   // 先蓋上視窗，讀完檔期才載扭蛋頁
 requestAnimationFrame(()=>ov.classList.add('on'));
 f.addEventListener('load',()=>{try{f.contentWindow.focus();}catch(_){}});}
function close(){
 if(!G.ov)return;const ov=G.ov;G.ov=G.fr=null;
 try{G.off&&G.off();}catch(_){}G.off=null;G.subs.clear();   // v508：關掉的扭蛋頁不再收通知（不然每開一次就多留一份 3D 場景在記憶體）
 ov.classList.remove('on');setTimeout(()=>ov.remove(),260);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&G.ov)close();});
window.TTGacha={open,close};

// ---------- 小屋右下的「扭蛋」鈕：放在「家具店」左邊，只有在小屋裡才看得到（house.css 的 .tt-house-only） ----------
const ICON='<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="11" r="7.5"/><path d="M6.5 11h15"/><circle cx="11" cy="7.6" r="1"/><path d="M8 18.5h12l-1.4 5.5H9.4z"/><path d="M12.5 21.2h3"/></svg>';
function addBtn(){
 const shop=$('ttHouseShop');if(!shop||$('ttHouseGacha'))return !!shop;
 const b=document.createElement('button');b.type='button';b.id='ttHouseGacha';b.className='tt-house-only';
 b.innerHTML=ICON+'<span>扭蛋</span>';b.onclick=()=>open();shop.before(b);return true;}
if(!addBtn()){const mo=new MutationObserver(()=>{if(addBtn())mo.disconnect();});mo.observe(document.body,{childList:true,subtree:true});}

// ---------- 樣式：整頁蓋上去的圓角卡片（深藍框＋淡紫光暈），背後模糊 ----------
const css=document.createElement('style');css.textContent=
 '#ttGachaOv{position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;'
+'background:radial-gradient(ellipse at 50% 40%,rgba(183,140,255,.35),rgba(43,23,65,.72) 70%);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .25s}'
+'#ttGachaOv.on{opacity:1}'
+'#ttGachaOv iframe{width:min(1280px,100%);height:min(820px,100%);border:3px solid var(--sk-ink,#1C2156);border-radius:22px;background:#1a1028;display:block;'
+'box-shadow:0 0 0 3px #fff,0 0 0 6px #CDB6FF,0 18px 60px rgba(43,23,65,.55),0 0 80px rgba(255,156,188,.35);transform:translateY(10px) scale(.985);transition:transform .25s}'
+'#ttGachaOv.on iframe{transform:none}'
+'html body:is(.tt214,:not(.tt214)) #ttMainDock #ttHouseGacha span{white-space:nowrap}'
+'body.tt-house-visit #ttHouseGacha{display:none!important}'
+'html.ttm-on #ttGachaOv{padding:0}html.ttm-on #ttGachaOv iframe{width:100%;height:100%;border:0;border-radius:0;box-shadow:none}';   // v549 手機：扭蛋頁整個螢幕，不要外框（扭蛋機才夠大）   // 去別人家參觀時不顯示
document.head.append(css);
})();
