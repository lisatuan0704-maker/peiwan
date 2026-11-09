/* v492 貓貓幣；v493 使用者更正：付費商品（時裝、寵物、座椅、染髮券、聊天氣泡、工房部件）一律金幣，
   貓貓幣只用在之後的小屋家具與店長送的免費時裝（商品標 cur:'cat' → forItem）。來源：每日任務（11/7 起）、活動、店長發放。
   兌換（EXCHANGE_ON）v493 先關閉（當時沒有能用貓貓幣買的東西）；v510 打開：扭蛋家具、小屋擴建、日常時裝都收貓貓幣，D 要兌換放在錢包裡、自己輸入數量一鍵兌換。
   資料 cat/<key>/{balance,lastTx}＋catTx/<key>/<tx>，資料庫規則見 tests/security-rules-v428/build/harden-phase9.cjs。
   金幣可單向換成貓貓幣：v510 D 11/09 改成 1 金幣＝5 貓貓幣（EX），剛好 350 加送 150、剛好 1000 加送 500（三個數字要跟規則第二十批一致）。
   商品價格仍以「金幣等值價」存在 shopConfig／basePricing，顯示與扣款時 ×10。 */
(function(root){
'use strict';
const RATE=10,EX=5,DAILY=100,DAILY_FROM=1793980800000,ICON='img/cat-coin-px48.png',PACKS=[100,350,1000],MAX=100000;
const EXCHANGE_ON=true;   // v510 打開（v493 關過）；改 false 錢包就不顯示兌換，其他地方的「去兌換」提示也會一起收起來
const forItem=p=>!!(p&&p.cur==='cat');   // 商品幣別：只有標 cur:'cat' 的才付貓貓幣
const bonus=c=>c===350?150:c===1000?500:0;
const gain=c=>c*EX+bonus(c);   // 兌換用 EX；商品標價 price() 照舊 ×RATE
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

const TX_LABEL={exchange:'金幣兌換',spend:'消費',daily:'每日任務',idle:'掛機收益',welcome:'見面禮',event:'活動獎勵',harvest:'小屋收成',adjust:'店長調整',refund:'退回',convert:'轉換'};
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

/* v510 想要的貓貓幣 → 最少要幾金幣。加送只有「剛好 350／1000 金幣」（規則寫死：amount＝coin×5＋加送，少一枚多一枚都拒絕），
   所以想要 3,510～3,700 時用 350 金幣（拿 3,700）比 351～370 金幣划算，10,010～11,000 同理用 1,000。 */
const CAT_MAX=MAX*EX,BONUS_AT=PACKS.filter(p=>bonus(p)>0);
function planFor(want){
 let c=Math.ceil(want/EX);
 for(const p of BONUS_AT)if(p<c&&gain(p)>=want){c=p;break;}
 return {coin:c,got:gain(c),bonus:bonus(c)};
}
/* 輸入框的字 → 想要的貓貓幣（無條件進位到 5 的倍數、最多 CAT_MAX） */
function parseWant(raw){
 const s=String(raw??'').trim(),v=Number(s);
 if(!s||!Number.isFinite(v)||v<=0)return null;
 const up=Math.ceil(v/EX)*EX,want=Math.min(up,CAT_MAX);
 return {want,rounded:want===up&&up!==v,capped:up>CAT_MAX};
}
const EX_ERR={REJECTED:'兌換沒有成功，金幣沒有被扣；請確認金幣餘額後再試一次',UNCONFIRMED:'兌換結果還沒確認，請先看看下面的貓貓幣紀錄，不要重複兌換'};

/* 錢包裡的「貓貓幣」區塊：餘額、掛機收益、金幣兌換、紀錄。
   v510 兌換：輸入「想要多少貓貓幣」→ 即時顯示需要幾金幣、加送、兌換後餘額；按「兌換」→ 大廳的確認視窗（ttConfirm）→ exchange()。
   整塊只在 mount 畫一次（輸入中的數字不會被重畫洗掉），之後餘額變動只更新 paint() 裡的那幾格。 */
function mount(host,opt={}){
 if(!host)return;
 let raw='',busy=false,txOpen=false,inline=0,idleOn=false,sig='';
 const $=s=>host.querySelector(s);
 const say=(m,ok)=>{const n=$('.tt-cat-msg');if(n){n.textContent=m||'';n.classList.toggle('ok',!!ok);}};
 function state(){
  const wal=root.__wallet||0,cat=root.__cat||0,p=parseWant(raw),pl=p?planFor(p.want):null;
  return {wal,cat,p,pl,short:pl?Math.max(0,pl.coin-wal):0};
 }
 function render(){
  host.innerHTML='<div class="tt-cat-box">'
   +'<div class="tt-cat-head">'+coin(48,'s')+'<div><small>貓貓幣</small><strong class="tt-cat-bal">'+fmt(root.__cat||0)+'</strong></div>'
   +'<p>酒館送你的小心意，可以轉扭蛋拿小屋家具、買小屋的壁紙地板、擴建小屋、買日常時裝。<br>'+(dailyOn()?'每天在大廳說說話、待一會兒，就會收到貓貓幣。':'11/7 起，每天在大廳說說話、待一會兒，就會收到貓貓幣。')+'<br>掛機也會慢慢存，最多存 8 小時，記得回來領。</p></div>'
   +'<div class="tt-idle-slot" hidden></div>'   // v502 掛機收益（lobby-ui/idle-income.js）
   +(EXCHANGE_ON?'<div class="tt-cat-ex"><div class="tt-cat-cap"><b>用金幣兌換</b><span>1 金幣 ＝ 5 貓貓幣</span></div>'
    +'<div class="tt-cat-packs" role="group" aria-label="快速選擇">'+PACKS.map(p=>'<button type="button" data-want="'+gain(p)+'" data-coin="'+p+'" aria-pressed="false"><strong>'+tag(gain(p),20)+'</strong><span>'+fmt(p)+' 金幣</span><small>'+(bonus(p)?'加送 '+fmt(bonus(p)):'&nbsp;')+'</small></button>').join('')+'</div>'
    +'<label class="tt-cat-want"><span>想要多少貓貓幣</span><span class="tt-cat-own"><input type="number" inputmode="numeric" min="'+EX+'" max="'+CAT_MAX+'" step="'+EX+'" placeholder="例：1000" autocomplete="off"><em>貓貓幣</em></span></label>'
    +'<div class="tt-cat-sum" aria-live="polite"></div>'
    +'<div class="tt-cat-act"></div>'
    +'<p class="tt-cat-note">金幣換成貓貓幣後不能換回來。剛好 350 金幣加送 150、剛好 1,000 金幣加送 500。</p></div>':'')
   +'<p class="tt-cat-msg" role="status"></p>'
   +'<button type="button" class="tt-cat-link" data-act="tx">查看貓貓幣紀錄 →</button><div class="tt-cat-tx" hidden></div>'
   +'</div>';
  const inp=$('.tt-cat-own input');
  if(inp){
   inp.oninput=()=>{raw=inp.value;inline=0;say('');paint();};
   inp.onchange=()=>{const p=parseWant(inp.value);if(p&&String(p.want)!==inp.value.trim()){inp.value=p.want;raw=inp.value;paint();}};   // 離開欄位時把數字改成實際計算的 5 的倍數
   inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();inp.onchange();ask();}};
  }
  host.onclick=e=>{
   const b=e.target.closest('button');if(!b||!host.contains(b))return;
   if(b.dataset.want){if(busy)return;raw=b.dataset.want;inline=0;if(inp)inp.value=raw;say('');paint();return;}
   const a=b.dataset.act;
   if(a==='ask')ask();
   else if(a==='yes')go(inline);
   else if(a==='no'){inline=0;paint();}
   else if(a==='topup')toTopup();
   else if(a==='tx'){txOpen=!txOpen;b.textContent=txOpen?'收起貓貓幣紀錄':'查看貓貓幣紀錄 →';const box=$('.tt-cat-tx');box.hidden=!txOpen;if(txOpen)loadTx(box);}
  };
  sig='';paint();
 }
 /* 只更新會變的地方（餘額、試算、按鈕），不動輸入框 */
 function paint(){
  if(!idleOn&&root.TTIdle){idleOn=true;root.TTIdle.mount($('.tt-idle-slot'),'w');}
  const s=state(),bal=$('.tt-cat-bal');
  if(bal)bal.textContent=fmt(s.cat);
  if(!EXCHANGE_ON)return;
  const now=[s.wal,s.cat,raw,busy,inline].join('|');if(now===sig)return;sig=now;
  host.querySelectorAll('[data-coin]').forEach(b=>{b.setAttribute('aria-pressed',String(!!s.pl&&s.pl.coin===+b.dataset.coin&&s.pl.got===+b.dataset.want));b.classList.toggle('short',+b.dataset.coin>s.wal);b.disabled=busy;});
  const inp=$('.tt-cat-own input');if(inp)inp.disabled=busy;
  const sum=$('.tt-cat-sum'),act=$('.tt-cat-act');
  if(!s.pl){
   sum.innerHTML='<span class="tt-cat-hint">輸入想要的貓貓幣（5 的倍數），或點上面的快速選擇</span><small>持有 '+fmt(s.wal)+' 金幣</small>';
  }else{
   const {coin:c,got,bonus:b}=s.pl;
   sum.innerHTML='<div class="tt-cat-need">需要 '+gold(18,'c')+'<b>'+fmt(c)+'</b> 金幣</div>'
    +(s.p.capped?'<small class="tt-cat-warn">一次最多換 '+fmt(CAT_MAX)+' 貓貓幣</small>':s.p.rounded?'<small class="tt-cat-warn">貓貓幣以 5 為單位，用 '+fmt(s.p.want)+' 計算</small>':'')
    +(b?'<div class="tt-cat-bonus">✦ 加送 '+fmt(b)+' 貓貓幣<small>一共拿到 '+fmt(got)+' 貓貓幣'+(Math.ceil(s.p.want/EX)>c?'（剛好 '+fmt(c)+' 金幣才有加送，比換 '+fmt(Math.ceil(s.p.want/EX))+' 金幣划算）':'')+'</small></div>':'')
    +(s.short?'<div class="tt-cat-short">金幣不夠，還差 '+fmt(s.short)+'<button type="button" data-act="topup">去儲值 →</button></div>'
     :'<div class="tt-cat-after">兌換後：金幣 <b>'+fmt(s.wal-c)+'</b>／貓貓幣 <b>'+fmt(s.cat+got)+'</b></div>');
  }
  const ok=!!s.pl&&!s.short;
  if(inline&&ok&&s.pl.coin===inline){
   act.innerHTML='<div class="tt-cat-confirm"><p>確定用 <b>'+fmt(s.pl.coin)+' 金幣</b>換 <b>'+fmt(s.pl.got)+' 貓貓幣</b>嗎？<br><small>金幣換成貓貓幣後不能換回來。</small></p><div><button type="button" class="tt-cat-go" data-act="yes"'+(busy?' disabled':'')+'>'+(busy?'兌換中…':'確定兌換')+'</button><button type="button" class="tt-cat-ghost" data-act="no"'+(busy?' disabled':'')+'>再想想</button></div></div>';
  }else act.innerHTML='<button type="button" class="tt-cat-go" data-act="ask"'+(ok&&!busy?'':' disabled')+'>'+(busy?'兌換中…':'兌換')+'</button>';
 }
 function ask(){
  if(busy)return;const s=state();if(!s.pl||s.short)return;
  const {coin:c,got,bonus:b}=s.pl;
  if(typeof root.ttConfirm!=='function'){inline=c;paint();return;}   // 大廳以外（沒有確認視窗）改用區塊內確認
  root.ttConfirm('用 '+fmt(c)+' 金幣兌換 '+fmt(got)+' 貓貓幣？',(b?'含加送 '+fmt(b)+' 貓貓幣。\n':'')+'兌換後：金幣 '+fmt(s.wal-c)+'／貓貓幣 '+fmt(s.cat+got)+'\n金幣換成貓貓幣後不能換回來。',()=>go(c),'確定兌換','再想想');
 }
 async function go(c){
  if(busy||!c)return;
  const s=state();if(!s.pl||s.pl.coin!==c){inline=0;paint();say('數量有變動，請再按一次兌換');return;}
  busy=true;say('');paint();
  try{const r=await exchange(c);busy=false;inline=0;raw='';const inp=$('.tt-cat-own input');if(inp)inp.value='';paint();say('兌換完成！收到 '+fmt(r.got)+' 貓貓幣',true);
   try{root.lobbyNotify?.({ok:true,icon:'coin',title:'兌換完成！',sub:'收到 '+fmt(r.got)+' 貓貓幣，已經存進錢包了',hold:6000});}catch(_){}
   opt.onDone?.(r);}
  catch(e){busy=false;inline=0;paint();const m=EX_ERR[e&&e.code]||(e&&e.message)||'兌換沒有完成，請稍後再試';say(m);try{root.toast?.(m);}catch(_){}}
 }
 /* 去儲值：錢包裡下面就是儲值方案（電腦 .packages、手機第 1 步），捲過去閃一下；找不到才開錢包 */
 function toTopup(){
  const box=host.closest('#topupBody,#ttmWallet')||root.document,t=box.querySelector('.packages,#ttmWallet [data-step="1"],#ttmWallet .ttm-done');
  if(t&&t.getClientRects().length){try{t.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){t.scrollIntoView();}t.classList.remove('tt-cat-flash');void t.offsetWidth;t.classList.add('tt-cat-flash');setTimeout(()=>t.classList.remove('tt-cat-flash'),1700);return;}
  try{root.openTopup?.();}catch(_){}
 }
 render();
 // 呼叫端請重複使用同一個 host（錢包重畫時把它搬回去）；餘額變動只更新數字與試算（金幣沒有事件，用輪詢看）
 onChange(()=>{if(host.isConnected)paint();});
 setInterval(()=>{if(host.isConnected)paint();},500);
 return {render,paint};
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
/* v496 金幣：同一套像素硬幣（犬尤原圖反面四芒星、金黃色票；coin3d/goldtrace.py），img/gold-coin-px48.png／gold-coin-spin48.png */
function gold(size,mode='c',attrs=''){return coin(size,mode,attrs).replace('class="nyan ','class="nyan nyan-g ');}
function gtag(n,size=16,cls=''){return '<span class="tt-cat-tag tt-gold-tag'+(cls?' '+cls:'')+'">'+gold(size,'c')+'<span>'+fmt(n)+'</span><span class="nyan-sr">金幣</span></span>';}
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
.tt-cat-ex{display:grid;gap:10px}
.tt-cat-want{display:grid;gap:6px;margin:0;font-size:13px;color:#6b5480}
.tt-cat-own em{flex:none;font-style:normal;font-size:13px;color:#6b5480}
.tt-cat-own input:disabled{opacity:.6}
.tt-cat-sum{display:grid;gap:4px;padding:10px 12px;border-radius:12px;background:#fbf7fe;box-shadow:inset 0 0 0 2px #ece0f5;font-size:13px;color:#5d3f7a;line-height:1.6}
.tt-cat-sum small{display:block;font-size:12px;color:#9a84b0}
.tt-cat-hint{color:#7a5e8c}
.tt-cat-need{display:flex;align-items:center;flex-wrap:wrap;gap:4px;font-size:14px}.tt-cat-need b{font-size:22px;line-height:1.1;color:#b8860b}
.tt-cat-sum small.tt-cat-warn{color:#c0832a}
.tt-cat-bonus{font-size:14px;font-weight:800;color:#3e9e6b}.tt-cat-bonus small{font-weight:400}
.tt-cat-after b{color:#4a3560}
.tt-cat-short{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:14px;font-weight:800;color:#d0566f}
.tt-cat-short button{border:0;background:none;padding:0;font:inherit;font-size:13px;color:#e27fa6;text-decoration:underline;cursor:pointer}
.tt-cat-act{display:grid}
.tt-cat-note{margin:0;font-size:12px;line-height:1.6;color:#9a84b0}
.tt-cat-flash{outline:3px solid transparent;outline-offset:4px;animation:ttCatFlash 1.7s ease}
@keyframes ttCatFlash{0%,65%{outline-color:#ff8db5}100%{outline-color:transparent}}
.tt-cat-box .tt-cat-go{border:0;border-radius:12px;padding:11px 14px;font:inherit;font-weight:800;font-size:15px;color:#fff;background:linear-gradient(180deg,#f7a6c4,#e27fa6);box-shadow:0 3px 0 #c5638a;cursor:pointer;letter-spacing:.1em}   /* v510 .tt-cat-box 前綴：大廳 .tt-live-ui button{color:inherit} 會把白字蓋掉 */
.tt-cat-box .tt-cat-go:disabled{opacity:.45;cursor:not-allowed}
.tt-cat-box .tt-cat-ghost{border:0;border-radius:12px;padding:11px 14px;font:inherit;font-size:14px;color:#7a5e8c;background:#f0e7fa;cursor:pointer}
.tt-cat-confirm{display:grid;gap:10px;padding:12px;border-radius:12px;background:#fff8e6;box-shadow:inset 0 0 0 2px #f0d98a}
.tt-cat-confirm p{margin:0;font-size:14px;color:#6b4a2a;line-height:1.6}.tt-cat-confirm small{color:#a5798d}
.tt-cat-confirm div{display:grid;grid-template-columns:1fr auto;gap:8px}
.tt-cat-msg{margin:0;min-height:1em;font-size:13px;color:#d0566f}.tt-cat-msg.ok{color:#3e9e6b}
.tt-cat-box .tt-cat-link{justify-self:start;border:0;background:none;padding:0;font:inherit;font-size:13px;color:#8e68c8;text-decoration:underline;cursor:pointer}
.tt-cat-tx{display:grid;gap:2px;border-top:1px dashed #e0d3f0;padding-top:6px}
.tt-cat-txr{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:#6a5a82;padding:4px 0}
.tt-cat-txr small{display:block;font-size:10.5px;color:#a5798d}.tt-cat-txr b.in{color:#3e9e6b}.tt-cat-txr b.out{color:#d96a8b}
.tt-cat-empty{margin:0;text-align:center;font-size:12px;color:#a5798d;padding:6px}
.tt-cat-tag{display:inline-flex!important;flex-direction:row!important;align-items:center!important;gap:.3em;width:auto!important;white-space:nowrap;vertical-align:middle}
.tt-cat-tag>span:not(.nyan):not(.nyan-sr){display:inline!important}
.nyan-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.nyan{--s:24px;display:inline-block!important;position:relative!important;margin-block:0;width:var(--s)!important;height:var(--s)!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;vertical-align:middle;flex:none;background:url(${IMG}cat-coin-px48.png) 0 0/100% 100% no-repeat!important;image-rendering:auto}
.nyan-px{image-rendering:pixelated}
.nyan.nyan-g{background-image:url(${IMG}gold-coin-px48.png)!important}
.nyan-g.nyan-s,.nyan-g.nyan-c.pop{background-image:url(${IMG}gold-coin-spin48.png)!important}
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

root.TTCat={RATE,EX,DAILY,DAILY_FROM,ICON,PACKS,EXCHANGE_ON,forItem,bonus,gain,price,fmt,dailyOn,exchange,planFor,parseWant,mount,onChange,loadTx,tag,coin,gold,gtag,pop,injectCss,watch};
setInterval(watch,3000);setTimeout(watch,0);
})(window);
