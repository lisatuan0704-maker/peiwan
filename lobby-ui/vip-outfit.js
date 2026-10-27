/* v445 VIP 3 專屬時裝・二選一（喵頻連線／疾風喵行）
   達到 VIP 3 時跳出選擇視窗；選一套由後端（/v1/voice/vip-outfit，伺服器重新計算累積支持金額）免費放進背包，選了不能更換。
   另一套只有 VIP 3 在商城看得到，整套 500 金幣、不拆賣。預覽人物帶時裝特效（tavern-ui/outfit-fx.js）。 */
window.TTVipOutfit=(()=>{'use strict';
const IDS=['season292_meow','season293_wind'];
const BLURB={season292_meow:'青藍電子風・護目鏡掃光、訊號光點、資料流',season293_wind:'夜藍機能風・穿上就能乘風出發'};
const lv=()=>{try{return window.__vipInfo?.().lv||0}catch(e){return 0}};
const own=()=>window.__owned||{};
const chosen=()=>{const c=own().vip3Outfit?.id;return IDS.includes(c)?c:null;};
const nameOf=id=>window.TTSeasonDrafts?.[id]?.name||id;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function doll(id){
  const d=window.TTSeasonDrafts?.[id];if(!d)return null;const disp=window.TTSeasonDisplay?.[id]||{};
  const accs=Object.entries(d.parts).filter(([k,p])=>/^acc\d+$/.test(k)&&p.defaultEquipped!==false).map(([slot])=>({source:id,slot}));
  const out={back:0,front:0,cloth:0,face:0,acc:0,hair:d.doll?.hair||0,skin:0,ps:{front:id,back:id,cloth:id,eye:id,brow:id},uiBaseSlots:[],uiAccessoryVersion:441,uiAccessories:accs};
  if(disp.main){out.hairHex=disp.main;if(disp.tail)out.hairHex2=disp.tail;}
  return out;
}
// ---- 動態預覽（人物＋特效），同一個 rAF 迴圈 ----
const mounts=new Set();let loop=0;
function mountCanvas(cv,id){
  const d=doll(id);if(!d||typeof drawDollTo!=='function')return;
  const base=document.createElement('canvas');base.width=base.height=64;
  const draw=()=>{try{drawDollTo(base,{...d,_blink:false},'idle');}catch(e){}};draw();setTimeout(draw,700);setTimeout(draw,2000);
  const fx=window.TTOutfitFx?window.TTOutfitFx.active(d):[];
  mounts.add({cv,base,fx,seed:id.length*977});if(!loop)loop=requestAnimationFrame(tick);
}
function tick(now){
  loop=0;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const m of mounts){
    if(!m.cv.isConnected){mounts.delete(m);continue;}
    const g=m.cv.getContext('2d'),W=m.cv.width,H=m.cv.height;g.imageSmoothingEnabled=false;g.clearRect(0,0,W,H);
    let src=m.base;if(!reduce&&m.fx.length&&window.TTOutfitFx){try{src=window.TTOutfitFx.render(m.base,now+m.seed,m.fx);}catch(e){src=m.base;}}
    const pose=!reduce&&typeof ttIdlePose==='function'?ttIdlePose(now,m.seed):{sqx:1,sqy:1};
    g.drawImage(src,W*(1-pose.sqx)/2,H*(1-pose.sqy),W*pose.sqx,H*pose.sqy);
  }
  if(mounts.size)loop=requestAnimationFrame(tick);
}
function mountAll(root){root.querySelectorAll('canvas[data-vip-outfit]').forEach(cv=>{if(!cv.dataset.mounted){cv.dataset.mounted='1';mountCanvas(cv,cv.dataset.vipOutfit);}});}
// ---- VIP 頁「VIP 3」卡片裡的獎勵 ----
function chipHtml(){
  const c=chosen(),ok=lv()>=3;
  return '<div class="vipRw vip-outfit-rw"><div class="vip-outfit-mini">'+IDS.map(id=>'<figure><canvas width="128" height="128" data-vip-outfit="'+id+'"></canvas><figcaption>'+esc(nameOf(id))+(c===id?'・已選':'')+'</figcaption></figure>').join('')+'</div>'
    +'<span>VIP 專屬時裝・二選一'+(c?'（已選「'+esc(nameOf(c))+'」）':'')+'</span>'
    +(ok&&!c?'<button type="button" class="vip-outfit-go" onclick="TTVipOutfit.open()">選擇我的 VIP 時裝</button>':(!ok?'<small>達到 VIP 3 可免費選一套，另一套可在商城以 500 金幣購買</small>':'<small>另一套可在商城以 500 金幣整套購買</small>'))+'</div>';
}
// ---- 選擇視窗 ----
let modal=null,confirmId=null,buyId=null,buyReq=null,busy=false,prompted=false;   // v450 另一套 500 由伺服器扣款
function ensure(){
  if(modal)return modal;
  modal=document.createElement('div');modal.id='vipOutfitM';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','VIP 3 專屬時裝二選一');
  document.body.append(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  return modal;
}
function render(){
  const m=ensure(),c=chosen(),ok=lv()>=3;
  m.innerHTML='<div class="vo-card"><button class="vo-x" type="button" aria-label="關閉">×</button>'
   +'<span class="vo-tag">VIP 3 常客獎勵</span><h2>選一套你的專屬時裝</h2>'
   +'<p class="vo-sub">'+(c?'你已經選了「'+esc(nameOf(c))+'」，已收進背包。另一套可以用 500 金幣整套購買。':'免費收進背包，<b>選了就不能更換</b>。另一套之後可以在商城用 500 金幣整套購買。')+'</p>'
   +'<div class="vo-grid">'+IDS.map(id=>{
      const mine=c===id,other=c&&!mine,asking=confirmId===id;
      return '<article class="vo-item'+(mine?' is-mine':'')+(asking?' is-asking':'')+'"><canvas width="256" height="256" data-vip-outfit="'+id+'"></canvas><h3>'+esc(nameOf(id))+'</h3><p>'+esc(BLURB[id]||'')+'</p>'
       +(mine?'<button type="button" disabled>已收進背包</button>':other&&own()[id]?'<button type="button" disabled>已購買</button>':other&&buyId===id?'<div class="vo-confirm"><b>花 500 金幣購買「'+esc(nameOf(id))+'」？</b><span>整套購買，不拆賣</span><div><button type="button" class="vo-yes" data-vo-buyyes="'+id+'">購買</button><button type="button" class="vo-no" data-vo-no>再想想</button></div></div>':other?'<button type="button" class="vo-pick" data-vo-buy="'+id+'">用 500 金幣購買</button>':!ok?'<button type="button" disabled>VIP 3 解鎖</button>':asking?'<div class="vo-confirm"><b>確定選「'+esc(nameOf(id))+'」？</b><span>選了就不能更換</span><div><button type="button" class="vo-yes" data-vo-yes="'+id+'">確定</button><button type="button" class="vo-no" data-vo-no>再想想</button></div></div>':'<button type="button" class="vo-pick" data-vo-pick="'+id+'">選這套</button>')
       +'</article>';}).join('')+'</div><p class="vo-status" role="status"></p></div>';
  m.querySelector('.vo-x').onclick=close;
  m.querySelectorAll('[data-vo-pick]').forEach(b=>b.onclick=()=>{confirmId=b.dataset.voPick;render();});
  m.querySelectorAll('[data-vo-no]').forEach(b=>b.onclick=()=>{confirmId=null;buyId=null;render();});
  m.querySelectorAll('[data-vo-buy]').forEach(b=>b.onclick=()=>{buyId=b.dataset.voBuy;buyReq=null;render();});
  m.querySelectorAll('[data-vo-buyyes]').forEach(b=>b.onclick=()=>buy(b.dataset.voBuyyes));
  m.querySelectorAll('[data-vo-yes]').forEach(b=>b.onclick=()=>claim(b.dataset.voYes));
  m.querySelectorAll('[data-vo-shop]').forEach(b=>b.onclick=()=>{close();try{window.TinyTavernUI?.open('shop');}catch(e){}});
  mountAll(m);
}
async function claim(id){
  if(busy)return;busy=true;const st=modal.querySelector('.vo-status');modal.querySelectorAll('button').forEach(b=>b.disabled=true);st.textContent='領取中…';
  try{
    if(!window.TTVoiceOrders)throw Error('請先登入 Discord。');
    const r=await window.TTVoiceOrders.vipOutfit({outfitId:id});
    confirmId=null;st.textContent=r.already?'你之前已經選過「'+nameOf(r.outfitId)+'」了。':'已領取「'+nameOf(r.outfitId)+'」！到背包就能穿上。';
    setTimeout(()=>{busy=false;if(modal&&!modal.hidden)render();},1800);return;
  }catch(e){st.textContent='沒有領取成功：'+(e.message||'請稍後再試');modal.querySelectorAll('button').forEach(b=>b.disabled=false);}
  busy=false;
}
async function buy(id){
  if(busy)return;busy=true;const st=modal.querySelector('.vo-status');modal.querySelectorAll('button').forEach(b=>b.disabled=true);st.textContent='購買中…';
  try{
    if(!window.TTVoiceOrders)throw Error('請先登入 Discord。');
    buyReq=buyReq||(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):String(Date.now())+Math.random().toString(36).slice(2,10));   // 同一次購買重試沿用同一編號，不會重複扣款
    const r=await window.TTVoiceOrders.vipOutfit({buyId:id,requestId:buyReq});
    buyId=null;buyReq=null;st.textContent='已購買「'+nameOf(r.outfitId)+'」！到背包就能穿上。';
    setTimeout(()=>{busy=false;if(modal&&!modal.hidden)render();},1800);return;
  }catch(e){st.textContent='沒有購買成功：'+(e.message||'請稍後再試');modal.querySelectorAll('button').forEach(b=>b.disabled=false);}
  busy=false;
}
function open(){if(!window.TTSeasonDrafts?.season292_meow)return;confirmId=null;buyId=null;render();modal.hidden=false;document.body.classList.add('vo-open');}
function close(){if(!modal)return;modal.hidden=true;confirmId=null;document.body.classList.remove('vo-open');}
function maybePrompt(force){
  if(lv()<3||chosen()||!window.__ownedLoaded||busy)return;
  if(!window.TTVoiceOrders?.userId?.()?.startsWith?.('discord_'))return;
  let seen=false;try{seen=sessionStorage.getItem('tt_vip3_outfit_prompt')===window.__ownedLoaded;}catch(e){}
  if(!force&&(prompted||seen))return;
  prompted=true;try{sessionStorage.setItem('tt_vip3_outfit_prompt',window.__ownedLoaded);}catch(e){}
  open();
}
function refresh(){if(modal&&!modal.hidden&&!busy)render();maybePrompt(false);}
// 樣式（整站主題：白紙深藍框、粉色主按鈕）
const css=document.createElement('style');css.textContent=`
#vipOutfitM{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(28,33,86,.42);padding:16px}
#vipOutfitM[hidden]{display:none}
#vipOutfitM .vo-card{position:relative;width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border:3px solid #1C2156;border-radius:18px;box-shadow:6px 6px 0 #F7B6CC;padding:18px 18px 14px;color:#1C2156;text-align:center}
#vipOutfitM .vo-x{position:absolute;right:10px;top:8px;width:34px;height:34px;border:2px solid #1C2156;border-radius:10px;background:#fff;font-size:20px;font-weight:900;cursor:pointer;color:#1C2156}
#vipOutfitM .vo-tag{display:inline-block;background:#E67FA6;color:#fff;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:900}
#vipOutfitM h2{margin:8px 0 4px;font-size:21px}
#vipOutfitM .vo-sub{margin:0 0 12px;font-size:13.5px;color:#5C6196;line-height:1.6}
#vipOutfitM .vo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:520px){#vipOutfitM .vo-grid{grid-template-columns:1fr}}
#vipOutfitM .vo-item{border:2px solid #D3D8F2;border-radius:14px;padding:10px;background:linear-gradient(#F4F6FF,#fff)}
#vipOutfitM .vo-item.is-mine{border-color:#E67FA6;box-shadow:0 0 0 3px #FBE3EC}
#vipOutfitM .vo-item canvas{width:100%;max-width:220px;aspect-ratio:1;image-rendering:pixelated;border-radius:12px;background:radial-gradient(circle at 50% 62%,#2d2a5a,#120f2b 78%)}
#vipOutfitM .vo-item h3{margin:6px 0 2px;font-size:16px}
#vipOutfitM .vo-item p{margin:0 0 8px;font-size:12px;color:#5C6196;line-height:1.5;min-height:36px}
#vipOutfitM .vo-item button{width:100%;min-height:40px;border:2px solid #1C2156;border-radius:10px;background:#fff;color:#1C2156;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit}
#vipOutfitM .vo-item .vo-pick,#vipOutfitM .vo-item .vo-yes{background:#FF4F8B;border-color:#FF4F8B;color:#fff}
#vipOutfitM .vo-item button:disabled{opacity:.55;cursor:default}
#vipOutfitM .vo-confirm{display:grid;gap:4px;font-size:13px}
#vipOutfitM .vo-confirm span{color:#C2456F;font-size:12px}
#vipOutfitM .vo-confirm div{display:flex;gap:8px}
#vipOutfitM .vo-status{min-height:18px;margin:10px 0 0;font-size:13px;font-weight:700;color:#5A4880}
.vip-outfit-rw{flex-direction:column;align-items:stretch!important;text-align:center}
.vip-outfit-mini{display:flex;justify-content:center;gap:10px}
.vip-outfit-mini figure{margin:0;display:grid;justify-items:center;gap:2px;font-size:11.5px}
.vip-outfit-mini canvas{width:96px;height:96px;image-rendering:pixelated;border-radius:10px;background:radial-gradient(circle at 50% 62%,#2d2a5a,#120f2b 78%)}
.vip-outfit-rw small{font-size:11px;color:#8E7AB0;font-weight:600}
.vip-outfit-go{margin-top:2px;border:0;border-radius:10px;background:#FF4F8B;color:#fff;font-weight:900;padding:8px 12px;cursor:pointer;font-family:inherit}`;
document.head.append(css);
return {open,close,maybePrompt,refresh,chipHtml,mountAll,ids:IDS};
})();
