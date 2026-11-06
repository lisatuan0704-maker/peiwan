/* v492 貓貓幣；v493 使用者更正：付費商品（時裝、寵物、座椅、染髮券、聊天氣泡、工房部件）一律金幣，
   貓貓幣只用在之後的小屋家具與店長送的免費時裝（商品標 cur:'cat' → forItem）。來源：每日任務（11/7 起）、活動、店長發放。
   兌換（EXCHANGE_ON）先關閉：目前沒有能用貓貓幣買的東西，金幣換過去也換不回來。
   資料 cat/<key>/{balance,lastTx}＋catTx/<key>/<tx>，資料庫規則見 tests/security-rules-v428/build/harden-phase9.cjs。
   金幣可單向換成貓貓幣：1 金幣＝10 貓貓幣，剛好 350 加送 200、剛好 1000 加送 1000（三個數字要跟規則一致）。
   商品價格仍以「金幣等值價」存在 shopConfig／basePricing，顯示與扣款時 ×10。 */
(function(root){
'use strict';
const RATE=10,DAILY=100,DAILY_FROM=1793980800000,ICON='img/cat-coin-px48.png',PACKS=[100,350,1000],MAX=100000;
const EXCHANGE_ON=false;   // v493：有貓貓幣商品上架後再打開
const forItem=p=>!!(p&&p.cur==='cat');   // 商品幣別：只有標 cur:'cat' 的才付貓貓幣
const bonus=c=>c===350?200:c===1000?1000:0;
const gain=c=>c*RATE+bonus(c);
const price=p=>Math.round(Number(p)||0)*RATE;
const fmt=n=>Number(n||0).toLocaleString('zh-TW');
const dailyOn=(t=Date.now())=>t>=DAILY_FROM;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* 大廳主程式的 let／const 不在 window 上，但同一個全域範圍內的 script 可以直接取用（呼叫時才讀） */
const G=n=>n==='db'?(typeof db!=='undefined'?db:null):n==='myKey'?(typeof myKey!=='undefined'?myKey:null):n==='ROOT'?(typeof ROOT!=='undefined'?ROOT:null):null;
const fns=new Set();let sub=null;
root.__cat=0;

function emit(){const v=root.__cat||0;fns.forEach(f=>{try{f(v);}catch(_){}});try{root.dispatchEvent(new CustomEvent('tt-cat',{detail:v}));}catch(_){}}
function watch(){
 const db=G('db'),key=G('myKey'),R=G('ROOT')||'peiwan';
 if(!db)return;if(sub&&sub.key===key)return;
 if(sub){try{sub.ref.off('value',sub.h);}catch(_){}}sub=null;root.__cat=0;emit();
 if(!key)return;
 const ref=db.ref(R+'/cat/'+key+'/balance'),h=s=>{if(G('myKey')!==key)return;const v=s.val();root.__cat=Number.isSafeInteger(v)?v:0;emit();};
 sub={key,ref,h};ref.on('value',h,()=>{});
}
function onChange(fn){fns.add(fn);try{fn(root.__cat||0);}catch(_){}return ()=>fns.delete(fn);}

/* 兌換：金幣 coin → 貓貓幣 gain(coin)。同一次寫入扣金幣、記兩邊交易（同一個編號）、加貓貓幣；
   用金幣那把交易鎖，跟點單付款互斥。結果不明時不重試（付款安全模組會保留紀錄擋下一筆）。 */
async function exchange(coin){
 const db=G('db'),key=G('myKey'),R=G('ROOT')||'peiwan';
 if(!db||!key)throw Error('先登入並使用闆卡，才能兌換');
 if(!Number.isSafeInteger(coin)||coin<1||coin>MAX)throw Error('請輸入 1～'+fmt(MAX)+' 之間的整數');
 if((root.__wallet||0)<coin)throw Error('金幣不足，目前只有 '+fmt(root.__wallet||0)+' 金幣');
 const SV=root.firebase.database.ServerValue,tx=db.ref(R+'/walletTx/'+key).push().key,got=gain(coin),ts=Date.now();
 const safety=root.TTPaymentSafety.create({storage:root.localStorage,locks:root.navigator.locks});
 await safety.execute({key,amount:coin,ids:[tx],lookup:root.walletLookup,commit:async()=>{
  const ch={};
  ch['walletTx/'+key+'/'+tx]={type:'exchange',amount:-coin,ref:tx,note:'換成 '+fmt(got)+' 貓貓幣',ts};
  ch['wallet/'+key+'/balance']=SV.increment(-coin);
  ch['wallet/'+key+'/lastTx']=tx;
  ch['catTx/'+key+'/'+tx]={type:'exchange',coin,amount:got,ref:tx,note:'用 '+fmt(coin)+' 金幣兌換'+(bonus(coin)?'（含加送 '+fmt(bonus(coin))+'）':''),ts};
  ch['cat/'+key+'/balance']=SV.increment(got);
  ch['cat/'+key+'/lastTx']=tx;
  await db.ref(R).update(ch);
 }});
 return {tx,coin,got};
}

const TX_LABEL={exchange:'金幣兌換',spend:'消費',daily:'每日任務',welcome:'見面禮',event:'活動獎勵',harvest:'小屋收成',adjust:'店長調整',refund:'退回',convert:'轉換'};
function txRows(rows){
 if(!rows.length)return '<p class="tt-cat-empty">還沒有貓貓幣紀錄</p>';
 return rows.map(t=>{const d=new Date(t.ts||0),pos=(t.amount||0)>0;
  return '<div class="tt-cat-txr"><span>'+(TX_LABEL[t.type]||'調整')+(t.note?'・'+esc(t.note):'')+'<small>'+(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+'</small></span><b class="'+(pos?'in':'out')+'">'+(pos?'+':'')+fmt(t.amount)+'</b></div>';}).join('');
}
function loadTx(box){
 const db=G('db'),key=G('myKey'),R=G('ROOT')||'peiwan';if(!box)return;
 if(!db||!key){box.innerHTML='';return;}
 box.innerHTML='<p class="tt-cat-empty">載入中…</p>';
 db.ref(R+'/catTx/'+key).limitToLast(20).once('value').then(s=>{const rows=[];s.forEach(c=>{rows.push(c.val()||{});});rows.reverse();box.innerHTML=txRows(rows);})
  .catch(()=>{box.innerHTML='<p class="tt-cat-empty">紀錄暫時讀不到，請稍後再試</p>';});
}

/* 錢包裡的「貓貓幣」區塊：餘額、三個兌換方案＋自訂數量、頁面內確認（不用瀏覽器對話框）、紀錄。 */
function mount(host,opt={}){
 if(!host)return;
 let pick=0,confirming=false,busy=false,txOpen=false;
 const say=(m,ok)=>{const n=host.querySelector('.tt-cat-msg');if(n){n.textContent=m||'';n.classList.toggle('ok',!!ok);}};
 function render(){
  const cat=root.__cat||0,wal=root.__wallet||0,c=pick,valid=Number.isSafeInteger(c)&&c>=1&&c<=MAX,enough=valid&&c<=wal;
  host.innerHTML='<div class="tt-cat-box">'
   +'<div class="tt-cat-head">'+coin(48,'s')+'<div><small>貓貓幣</small><strong>'+fmt(cat)+'</strong></div>'
   +'<p>酒館送你的小心意。<br>'+(dailyOn()?'每天在大廳說說話、待一會兒，就會收到貓貓幣。':'11/7 起，每天在大廳說說話、待一會兒，就會收到貓貓幣。')+'</p></div>'
   +(EXCHANGE_ON?'<div class="tt-cat-cap"><b>用金幣兌換</b><span>1 金幣 ＝ 10 貓貓幣</span></div>'
   +'<div class="tt-cat-packs">'+PACKS.map(p=>'<button type="button" data-pack="'+p+'" aria-pressed="'+(p===c)+'"'+(p>wal?' class="short"':'')+'><span>'+fmt(p)+' 金幣</span><strong>'+tag(gain(p),20)+'</strong><small>'+(bonus(p)?'含加送 '+fmt(bonus(p)):'&nbsp;')+'</small></button>').join('')+'</div>'
   +'<label class="tt-cat-own">自訂數量<input type="number" inputmode="numeric" min="1" max="'+MAX+'" step="1" placeholder="輸入金幣數" value="'+(c&&!PACKS.includes(c)?c:'')+'"><span>金幣</span></label>'
   +'<div class="tt-cat-sum">'+(valid?'用 <b>'+fmt(c)+'</b> 金幣 → 得到 <b class="g">'+tag(gain(c),18)+'</b>':'選一個方案，或輸入想換的金幣數')+'<small>持有 '+fmt(wal)+' 金幣'+(valid&&!enough?'・還差 '+fmt(c-wal)+' 金幣':'')+'</small></div>'
   +(confirming&&enough
     ?'<div class="tt-cat-confirm"><p>確定用 <b>'+fmt(c)+' 金幣</b>換 <b>'+fmt(gain(c))+' 貓貓幣</b>嗎？<br><small>貓貓幣不能換回金幣。</small></p><div><button type="button" class="tt-cat-go" data-act="yes"'+(busy?' disabled':'')+'>'+(busy?'兌換中…':'確定兌換')+'</button><button type="button" class="tt-cat-ghost" data-act="no"'+(busy?' disabled':'')+'>再想想</button></div></div>'
     :'<button type="button" class="tt-cat-go" data-act="ask"'+(enough?'':' disabled')+'>兌換貓貓幣</button>'):'')
   +'<p class="tt-cat-msg" role="status"></p>'
   +'<button type="button" class="tt-cat-link" data-act="tx">'+(txOpen?'收起貓貓幣紀錄':'查看貓貓幣紀錄 →')+'</button><div class="tt-cat-tx"'+(txOpen?'':' hidden')+'></div>'
   +'</div>';
  host.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>{pick=+b.dataset.pack;confirming=false;render();});
  const inp=host.querySelector('.tt-cat-own input');
  if(inp)inp.oninput=()=>{const v=inp.value.trim();pick=/^\d+$/.test(v)?Math.min(+v,MAX):0;confirming=false;const keep=inp.value;render();const n=host.querySelector('.tt-cat-own input');n.value=keep;n.focus();};
  host.querySelector('[data-act="ask"]')?.addEventListener('click',()=>{confirming=true;render();});
  host.querySelector('[data-act="no"]')?.addEventListener('click',()=>{confirming=false;render();});
  host.querySelector('[data-act="yes"]')?.addEventListener('click',go);
  host.querySelector('[data-act="tx"]').onclick=()=>{txOpen=!txOpen;render();};
  if(txOpen)loadTx(host.querySelector('.tt-cat-tx'));
 }
 async function go(){
  if(busy)return;busy=true;render();
  try{const r=await exchange(pick);busy=false;confirming=false;pick=0;render();say('兌換完成！收到 '+fmt(r.got)+' 貓貓幣',true);
   try{root.lobbyNotify?.({ok:true,icon:'coin',title:'兌換完成！',sub:'收到 '+fmt(r.got)+' 貓貓幣，已經存進錢包了',hold:6000});}catch(_){}
   opt.onDone?.(r);}
  catch(e){busy=false;confirming=false;render();say(e.message||'兌換沒有完成，請稍後再試');}
 }
 render();
 // 呼叫端請重複使用同一個 host（錢包重畫時把它搬回去），這裡只在畫面上時才重畫
 onChange(()=>{if(!busy&&host.isConnected&&!host.contains(root.document.activeElement))render();});
 return {render};
}

/* 貓貓幣（像素版）：照犬尤原圖（正面貓臉、背面星星）轉的 48×48 像素圖。
   img/cat-coin-px48.png＝斜放、看得到厚度；img/cat-coin-spin48.png＝轉一圈 12 格（正面→側邊→背面→側邊）。
   mode 'c'＝斜放不動（名牌、價格旁），收到貓貓幣時 pop() 播一次轉圈＋跳一下；mode 's'＝一直轉（錢包大圖）。
   48 的整數倍用 pixelated（格子銳利），比較小的尺寸整顆平滑縮小。class 前綴 nyan（避開大廳原本的 .ttc 確認視窗）。
   圖片用絕對網址，時裝間的 iframe 也能用（iframe 要先 injectCss(它的 document)）。 */
const IMG=(()=>{try{const s=root.document.currentScript;return new URL('../img/',s&&s.src||root.location.href).href;}catch(_){return 'img/';}})();
function coin(size,mode='c',attrs=''){
 return '<span class="nyan nyan-'+(mode==='s'?'s':'c')+(size%48===0?' nyan-px':'')+'" style="--s:'+size+'px"'+(attrs?' '+attrs:'')+' aria-hidden="true"></span>';
}
/* 價格標：小硬幣＋數字（螢幕報讀唸「N 貓貓幣」） */
function tag(n,size=16,cls=''){return '<span class="tt-cat-tag'+(cls?' '+cls:'')+'">'+coin(size,'c')+'<span>'+fmt(n)+'</span><span class="nyan-sr">貓貓幣</span></span>';}
/* 有貓貓幣進來：畫面上標了 data-cat-pop 的硬幣轉一圈 */
function pop(doc=root.document){doc.querySelectorAll('.nyan-c[data-cat-pop]').forEach(c=>{c.classList.remove('pop');void c.offsetWidth;c.classList.add('pop');clearTimeout(c._popT);c._popT=setTimeout(()=>c.classList.remove('pop'),800);});}   // 播完拿掉，回到斜放圖
let lastSeen=null;
fns.add(v=>{if(lastSeen!=null&&v>lastSeen)pop();lastSeen=sub?v:null;});

const css=`.tt-cat-box{display:grid;gap:12px;margin-top:6px}
.tt-cat-head{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:center;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,#fff6ea,#f6ecfb);box-shadow:inset 0 0 0 2px #f1d9c4}
.tt-cat-head>.nyan{grid-row:span 2;margin:0 4px}
.tt-cat-head small{display:block;font-size:12px;color:#9b6f58;letter-spacing:.08em}
.tt-cat-head strong{font-size:28px;color:#b5643c;line-height:1.1}
.tt-cat-head p{margin:0;font-size:12px;line-height:1.6;color:#8c6f86}
.tt-cat-cap{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #d9c8e6;padding-bottom:4px}
.tt-cat-cap b{color:#5d3f7a;font-size:15px}.tt-cat-cap span{font-size:12px;color:#9a84b0}
.tt-cat-packs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.tt-cat-packs button{border:0;border-radius:12px;padding:10px 6px;background:#fff;box-shadow:inset 0 0 0 2px #e6d6f0;font-family:inherit;cursor:pointer;display:grid;gap:2px;text-align:center;color:#6b5480}
.tt-cat-packs button>span{font-size:12px}.tt-cat-packs button strong{display:flex;justify-content:center}.tt-cat-packs button strong{font-size:19px;color:#b5643c}.tt-cat-packs button small{font-size:11px;color:#3e9e6b}
.tt-cat-packs button[aria-pressed="true"]{box-shadow:inset 0 0 0 3px #e27fa6;background:#fff4f8}
.tt-cat-packs button.short{opacity:.55}
.tt-cat-own{display:flex;align-items:center;gap:8px;font-size:13px;color:#6b5480}
.tt-cat-own input{flex:1;min-width:0;border:2px solid #e6d6f0;border-radius:10px;padding:7px 10px;font:inherit;font-size:15px;color:#4a3560;background:#fff}
.tt-cat-sum{font-size:14px;color:#5d3f7a;line-height:1.6}.tt-cat-sum b.g{color:#b5643c;font-size:17px}.tt-cat-sum small{display:block;font-size:12px;color:#9a84b0}
.tt-cat-go{border:0;border-radius:12px;padding:11px 14px;font:inherit;font-weight:800;font-size:15px;color:#fff;background:linear-gradient(180deg,#f7a6c4,#e27fa6);box-shadow:0 3px 0 #c5638a;cursor:pointer}
.tt-cat-go:disabled{opacity:.45;cursor:not-allowed}
.tt-cat-ghost{border:0;border-radius:12px;padding:11px 14px;font:inherit;font-size:14px;color:#7a5e8c;background:#f0e7fa;cursor:pointer}
.tt-cat-confirm{display:grid;gap:10px;padding:12px;border-radius:12px;background:#fff8e6;box-shadow:inset 0 0 0 2px #f0d98a}
.tt-cat-confirm p{margin:0;font-size:14px;color:#6b4a2a;line-height:1.6}.tt-cat-confirm small{color:#a5798d}
.tt-cat-confirm div{display:grid;grid-template-columns:1fr auto;gap:8px}
.tt-cat-msg{margin:0;min-height:1em;font-size:13px;color:#d0566f}.tt-cat-msg.ok{color:#3e9e6b}
.tt-cat-link{justify-self:start;border:0;background:none;padding:0;font:inherit;font-size:13px;color:#8e68c8;text-decoration:underline;cursor:pointer}
.tt-cat-tx{display:grid;gap:2px;border-top:1px dashed #e0d3f0;padding-top:6px}
.tt-cat-txr{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:#6a5a82;padding:4px 0}
.tt-cat-txr small{display:block;font-size:10.5px;color:#a5798d}.tt-cat-txr b.in{color:#3e9e6b}.tt-cat-txr b.out{color:#d96a8b}
.tt-cat-empty{margin:0;text-align:center;font-size:12px;color:#a5798d;padding:6px}
.tt-cat-tag{display:inline-flex!important;flex-direction:row!important;align-items:center!important;gap:.3em;width:auto!important;white-space:nowrap;vertical-align:middle}
.tt-cat-tag>span:not(.nyan):not(.nyan-sr){display:inline!important}
.nyan-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.nyan{--s:24px;display:inline-block!important;position:relative!important;margin-block:0;width:var(--s)!important;height:var(--s)!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;vertical-align:middle;flex:none;background:url(${IMG}cat-coin-px48.png) 0 0/100% 100% no-repeat!important;image-rendering:auto}
.nyan-px{image-rendering:pixelated}
.nyan-s,.nyan-c.pop{background-image:url(${IMG}cat-coin-spin48.png)!important;background-size:calc(var(--s)*12) var(--s)!important}
.nyan-s{animation:nyanSpin 1.6s steps(12) infinite}
.nyan-c.pop{animation:nyanSpin .7s steps(12) 1,nyanHop .7s ease-out 1}
@keyframes nyanSpin{from{background-position:0 0}to{background-position:calc(var(--s)*-12) 0}}
@keyframes nyanHop{0%,100%{translate:0 0}35%{translate:0 calc(var(--s)*-.3)}70%{translate:0 0}85%{translate:0 calc(var(--s)*-.06)}}
.nyan-c.pop::after{content:"";position:absolute;inset:-35%;pointer-events:none;background:radial-gradient(circle at 18% 22%,#fff 0 4%,transparent 5%),radial-gradient(circle at 84% 18%,#FFE38A 0 4%,transparent 5%),radial-gradient(circle at 88% 78%,#fff 0 3.5%,transparent 4.5%),radial-gradient(circle at 12% 80%,#FF8DB5 0 3.5%,transparent 4.5%);animation:nyanSpark .7s ease-out 1 forwards}
@keyframes nyanSpark{0%{opacity:0;scale:.6}35%{opacity:1;scale:1}100%{opacity:0;scale:1.25}}
@media (prefers-reduced-motion:reduce){.nyan-s,.nyan-c.pop,.nyan-c.pop::after{animation:none}}`;
function injectCss(doc=root.document){if(!doc||doc.getElementById('ttCatCss'))return;const s=doc.createElement('style');s.id='ttCatCss';s.textContent=css;(doc.head||doc.documentElement).append(s);}
if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>injectCss());else injectCss();

root.TTCat={RATE,DAILY,DAILY_FROM,ICON,PACKS,EXCHANGE_ON,forItem,bonus,gain,price,fmt,dailyOn,exchange,mount,onChange,loadTx,tag,coin,pop,injectCss,watch};
setInterval(watch,3000);setTimeout(watch,0);
})(window);
