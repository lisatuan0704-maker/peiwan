/* v504 家具扭蛋（D 2026/11/08「上酒館大廳」）：小屋右下多一顆「扭蛋」→ 整頁蓋上扭蛋視窗（gacha/3d/index.html，iframe）。
   卡池：人魚卡池（海底人魚屋）、森林卡池（森林精靈小屋）、通用（酒館日常＋萬用）；單抽 120、十連 1,200 貓貓幣。
   抽卡結果由付款主機決定（pay.tinytavern.tw/api/gacha，帶 Discord 登入憑證）：主機確認是闆卡主人 → 抽 → 扣貓貓幣 →
   放進小屋背包 houseInv/<闆卡>/<家具>/<抽卡編號>（src:'gacha'）→ 回傳抽到哪些，這頁只負責演出。網頁改不到機率、也不能自己加家具。
   這支只負責：開關視窗、把貓貓幣餘額與背包裡有的家具交給扭蛋頁（window.TTGachaHost）、帶憑證去主機抽。
   抽到的家具會出現在小屋的「我的家具」（house.js 本來就在看 houseInv），家具店不賣（catalog.json 標 gacha:true）。 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const R=()=>typeof ROOT!=='undefined'?ROOT:'peiwan';
const KEY=()=>typeof myKey!=='undefined'?myKey:null;
const DB=()=>typeof db!=='undefined'?db:null;
const BASE=()=>typeof PAY_API!=='undefined'?PAY_API:'https://pay.tinytavern.tw',API=()=>BASE()+'/api/gacha';
const VER='508';
const G={ov:null,fr:null,inv:{},off:null,subs:new Set(),busy:false,sched:null};

// ---------- 給扭蛋頁的介面（gacha/3d/g3d.js 讀 parent.TTGachaHost） ----------
const state=()=>({balance:Number.isSafeInteger(window.__cat)?window.__cat:0,owned:Object.keys(G.inv||{})});
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
async function loadSched(){
 const c=typeof AbortController!=='undefined'?new AbortController():null,t=setTimeout(()=>c&&c.abort(),2500);
 try{const r=await fetch(BASE()+'/api/gacha-info',{cache:'no-store',signal:c&&c.signal});const j=await r.json();
  if(j&&Array.isArray(j.schedule))G.sched=j.schedule.filter(x=>x&&typeof x.pool==='string'&&typeof x.start==='string');}catch(_){}
 finally{clearTimeout(t);}}
// v508 抽完按「去擺放」：跟 × 一樣關掉扭蛋視窗 → 交給小屋（house.js 的 TTHouse.placeNew：進佈置、拿起第一件、標 NEW）；keys 扭蛋頁已排好（限定→稀有→普通、不重複）
function place(keys){
 if(!G.ov)return;const ks=Array.isArray(keys)?Array.from(keys).filter(k=>typeof k==='string'&&k).slice(0,10):[];   // 換成大廳這邊的陣列（iframe 的陣列 instanceof Array 不成立）
 close();
 try{window.TTHouse&&window.TTHouse.placeNew&&window.TTHouse.placeNew(ks);}catch(_){}}
window.TTGachaHost={state,pull,close,place,schedule:()=>G.sched,sub(fn){G.subs.add(fn);return ()=>G.subs.delete(fn);}};
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
+'body.tt-house-visit #ttHouseGacha{display:none!important}';   // 去別人家參觀時不顯示
document.head.append(css);
})();
