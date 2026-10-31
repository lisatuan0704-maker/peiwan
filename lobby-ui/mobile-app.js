/* v432 手機版：以功能為主的介面（不顯示大廳場景與像素小人）。
   上方「我的闆卡」小卡（頭像、名字、金幣），下方分頁：訂單｜私訊｜儲值｜信箱。
   手機版不開放點單，只開放儲值金幣（銀行轉帳＋上傳截圖，店長核帳）、查看訂單、私訊與信箱。
   訂單、私訊、信箱直接使用既有視窗（shopM4、frM、mailBoxM），付款、取消、私訊等處理函式完全沿用；
   儲值頁是手機專用的一步一步畫面，最後仍交給原本的 submitTopup() 送出（同一套資料格式與資料庫規則）。 */
(()=>{'use strict';
if(!window.TTMobile)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('zh-TW');
const say=m=>{try{toast(m)}catch{}};
const ICON={
 orders:'<path d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
 chat:'<path d="M4 5h16v11H9l-4 4v-4H4z"/><path d="M8 10h8M8 13h5"/>',
 wallet:'<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2.4-5 1.2-5 3.8 0 1 1 1.6 2.5 1.6s2.5-.6 2.5-1.5"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'
};
const TABS=[
 {key:'orders',label:'訂單',node:'shopM4',badge:'ordBadge',open:()=>shopOpen(4),hide:()=>{const n=$('shopM4');if(n)n.style.display='none';}},
 {key:'chat',label:'私訊',node:'frM',badge:'frDockBadge',open:()=>frOpen(),hide:()=>gClose('frM')},
 {key:'wallet',label:'儲值',node:'ttmWallet',open:()=>{$('ttmWallet').classList.add('on');wallet.render();},hide:()=>$('ttmWallet').classList.remove('on')},
 {key:'mail',label:'信箱',node:'mailBoxM',badge:'mailBadge',open:()=>{renderMailBox();gOpen('mailBoxM');},hide:()=>gClose('mailBoxM')}
];
const root=document.documentElement;root.classList.add('ttm-on');
const app=document.createElement('div');app.id='ttM';
app.innerHTML='<header class="ttm-top" id="ttmTop">'
 +'<div class="ttm-card"><canvas id="ttmDoll" width="64" height="64" aria-hidden="true"></canvas>'
 +'<div class="ttm-who"><small>我的闆卡</small><b id="ttmName">小小酒館</b></div>'
 +'<button type="button" class="ttm-coins" id="ttmCoins" aria-label="金幣餘額，點一下儲值"><i aria-hidden="true"></i><b id="ttmCoinN">0</b><small>金幣</small></button></div>'
 +'<div class="ttm-actions" id="ttmActions"><button type="button" class="ttm-order" id="ttmTopup"><span aria-hidden="true">＋</span>儲值金幣</button>'
 +'<a class="ttm-help" href="lobby.html?contact=1" data-contact-support>聯絡客服</a></div>'
 +'<p class="ttm-note" id="ttmNote">手機版可儲值、查看訂單與私訊；點單請使用電腦版。</p>'
 +'</header><div class="ttm-empty" id="ttmEmpty">載入中…</div>'
 +'<section class="ttm-page" id="ttmWallet" aria-label="儲值金幣"></section>'
 +'<nav class="ttm-tabs" role="tablist" aria-label="手機版功能">'
 +TABS.map(t=>'<button type="button" role="tab" data-tab="'+t.key+'" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true">'+ICON[t.key]+'</svg><span>'+t.label+'</span><b class="ttm-dot" hidden></b></button>').join('')
 +'</nav>';
document.body.append(app);
const top=$('ttmTop'),tabBar=app.querySelector('.ttm-tabs');
let current=null,busy=false;
const tab=key=>TABS.find(t=>t.key===key);
const visible=n=>!!n&&(n.classList.contains('on')||n.style.display==='flex'||n.style.display==='block');
function layout(){
 root.style.setProperty('--ttm-top',Math.ceil(top.getBoundingClientRect().bottom)+'px');
 root.style.setProperty('--ttm-bot',Math.ceil(window.innerHeight-tabBar.getBoundingClientRect().top)+'px');
}
new ResizeObserver(layout).observe(top);new ResizeObserver(layout).observe(tabBar);addEventListener('resize',layout);
// 分頁視窗的背景點擊不會關掉自己（點空白處關窗是電腦版的行為）。
function guard(n){if(n.dataset.ttmGuard)return;n.dataset.ttmGuard='1';n.addEventListener('click',e=>{if(e.target===n&&n.classList.contains('ttm-tabview')){e.stopPropagation();e.preventDefault();}},true);}
function show(key,{remember=true}={}){
 const t=tab(key);if(!t||busy)return;busy=true;
 try{
  if(current&&current!==key){const old=tab(current),n=$(old.node);n?.classList.remove('ttm-tabview');try{old.hide();}catch{}}
  current=key;root.dataset.ttmTab=key;
  for(const b of tabBar.children){const on=b.dataset.tab===key;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
  const n=$(t.node);if(n){guard(n);n.classList.add('ttm-tabview');}
  try{t.open();}catch(e){console.warn('[mobile] open '+key,e);}
  if(remember)try{sessionStorage.setItem('ttm_tab',key);}catch{}
  layout();
 }finally{busy=false;}
}
tabBar.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)show(b.dataset.tab);});
$('ttmCoins').onclick=()=>show('wallet');
$('ttmTopup').onclick=()=>show('wallet');
// 手機版不開放點單：點單入口一律改成提示（訂單查詢 shopOpen(4)、取消、續單、回報問題照常）。
const NO_ORDER='手機版目前只開放儲值金幣，點單請使用電腦版 ✦';
function block(name,allow){const f=window[name];if(typeof f!=='function')return;window[name]=function(...a){if(allow&&allow(...a))return f.apply(this,a);say(NO_ORDER);};}
block('shopStep');block('shopOpen',n=>n===4);block('backFromPlans');block('openReserve');block('reorderPlay');block('pickPlan');
// 其他視窗（付款、取消確認、私訊對話、客服）關閉後，把目前分頁補回來。
function center(){const r=top.getBoundingClientRect(),b=tabBar.getBoundingClientRect();return [innerWidth/2,(r.bottom+b.top)/2];}
setInterval(()=>{
 if(!current||busy||document.hidden)return;
 const t=tab(current),n=$(t.node);
 if(n&&!n.classList.contains('ttm-tabview'))n.classList.add('ttm-tabview');
 if(visible(n))return;
 const [x,y]=center(),hit=document.elementFromPoint(x,y);
 if(!hit||hit===document.body||hit===root||hit.closest('#ttM,#mHome'))show(current,{remember:false});
},350);

/* ===== 儲值金幣（銀行轉帳＋上傳截圖） ===== */
const wallet=(()=>{
 const page=$('ttmWallet');
 let tier=-1,proof=null,proofBusy=false,sending=false,done=null,txOpen=false;
 const tiers=()=>(((window.__topupCfg||{}).tiers)||[]).filter(t=>t&&t.amt>0);
 function account(){
  const raw=String((typeof PAY_ACCOUNT!=='undefined'&&PAY_ACCOUNT)||'').trim();
  const m=/^[(（]\s*(\d{3})\s*[)）]\s*(.*?)\s*(\d[\d -]{6,}\d)\s*(.*)$/.exec(raw);
  return m?{raw,code:m[1],bank:m[2].trim(),number:m[3].trim(),digits:m[3].replace(/\D/g,''),holder:m[4].trim()}:{raw,code:'',bank:'',number:raw,digits:raw,holder:''};
 }
 function dcName(){try{const dc=JSON.parse(localStorage.getItem('tt_dc')||'null');return dc?'@'+(dc.global_name||dc.username||dc.name||''):'';}catch{return '';}}
 async function copy(text,btn,label){
  let ok=false;try{await navigator.clipboard.writeText(text);ok=true;}catch{}
  if(!ok){try{const t=document.createElement('textarea');t.value=text;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0;top:0';document.body.append(t);t.select();t.setSelectionRange(0,text.length);ok=document.execCommand('copy');t.remove();}catch{}}
  if(btn){btn.textContent=ok?'已複製 ✓':'請長按複製';btn.classList.toggle('ok',ok);setTimeout(()=>{btn.textContent=label;btn.classList.remove('ok');},1800);}
  if(ok)say('已複製：'+text);
 }
 function compress(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{try{const M=1000;let w=img.width,h=img.height;if(w>h){if(w>M){h=Math.round(h*M/w);w=M;}}else if(h>M){w=Math.round(w*M/h);h=M;}
   const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',0.72));}catch(e){rej(e);}};
  img.onerror=()=>{URL.revokeObjectURL(url);rej(Error('IMAGE'));};img.src=url;});}
 function ready(){const name=page.querySelector('#ttmTuName')?.value.trim(),last5=page.querySelector('#ttmTuLast5')?.value.trim();return tier>=0&&!!name&&/^\d{5}$/.test(last5||'')&&!!proof;}
 function sync(){const b=page.querySelector('#ttmTuSend');if(b){b.disabled=sending||!ready();b.textContent=sending?'送出中…':'送出儲值';}
  page.querySelectorAll('[data-step]').forEach(s=>{const n=+s.dataset.step;s.classList.toggle('done',n===1?tier>=0:n===3?!!page.querySelector('#ttmTuName')?.value.trim()&&/^\d{5}$/.test(page.querySelector('#ttmTuLast5')?.value.trim()||''):n===4?!!proof:false);});}
 function render(){
  const list=tiers(),acc=account(),bal=window.__wallet||0,note=(typeof PAY_NOTE!=='undefined'&&PAY_NOTE)||'';
  if(tier>=list.length)tier=-1;
  if(done){page.innerHTML='<div class="ttm-done"><b>儲值已送出 ✦</b><p>NT$ '+fmt(done.amt)+' → '+fmt(done.get)+' 金幣</p><p class="ttm-sub">店長核對入帳後，金幣會加進你的錢包並寄信通知你；通常幾分鐘內完成，深夜可能稍久。</p>'
   +'<button type="button" class="ttm-primary" data-act="orders">查看儲值進度</button><button type="button" class="ttm-ghost" data-act="again">再儲值一筆</button></div>';bind();return;}
  const keep={name:page.querySelector('#ttmTuName')?.value,last5:page.querySelector('#ttmTuLast5')?.value};
  const t=list[tier];
  page.innerHTML='<div class="ttm-balance"><small>目前金幣</small><b>'+fmt(bal)+'</b><span>1 金幣＝1 元，可用於點單與商城</span><button type="button" class="ttm-link" data-act="tx">'+(txOpen?'收起交易紀錄':'查看交易紀錄')+'</button></div>'
   +'<div id="ttmTx" class="ttm-tx"'+(txOpen?'':' hidden')+'></div>'
   +(list.length?(
   '<section class="ttm-step" data-step="1"><h3><i><u>1</u></i><span class="hl">選一個儲值方案</span></h3>'
   +'<p class="ttm-guide">儲值金額由酒館固定提供，不用自己輸入，點一下想要的方案就好。</p><div class="ttm-tiers" role="radiogroup" aria-label="儲值方案">'
   +list.map((x,i)=>'<button type="button" role="radio" data-tier="'+i+'" aria-pressed="'+(i===tier)+'" aria-checked="'+(i===tier)+'"><b>'+fmt(x.amt+(x.bonus||0))+' <small>金幣</small></b><span>轉帳 NT$ '+fmt(x.amt)+'</span>'+(x.bonus>0?'<em>含贈送 '+fmt(x.bonus)+'</em>':'')+'<span class="pick">'+(i===tier?'✓ 已選擇':'點我選這個')+'</span></button>').join('')+'</div></section>'
   +'<section class="ttm-step'+(tier<0?' locked':'')+'" data-step="2"><h3><i><u>2</u></i><span class="hl">轉帳到酒館帳戶</span></h3>'
   +'<div class="ttm-bank">'+(acc.code?'<div class="ttm-row"><span>銀行</span><b>('+esc(acc.code)+') '+esc(acc.bank)+'</b><button type="button" class="ttm-copy" data-copy="'+esc(acc.code)+'" data-label="複製代碼">複製代碼</button></div>':'')
   +'<div class="ttm-row ttm-acct"><span>帳號</span><b>'+esc(acc.number)+'</b><button type="button" class="ttm-copy main" data-copy="'+esc(acc.digits)+'" data-label="複製帳號">複製帳號</button></div>'
   +'<div class="ttm-row ttm-amt"><span>金額</span><b>'+(t?'NT$ '+fmt(t.amt):'請先在上面選一個方案')+'</b>'+(t?'<button type="button" class="ttm-copy" data-copy="'+t.amt+'" data-label="複製金額">複製金額</button>':'')+'</div></div>'
   +(note?'<p class="ttm-sub">'+esc(note)+'</p>':'')+'<p class="ttm-sub">請依照上面選的方案金額<b>剛好轉帳</b>這個數字；複製帳號後到銀行 App 轉帳，完成後回到這裡填寫資料。</p></section>'
   +'<section class="ttm-step'+(tier<0?' locked':'')+'" data-step="3"><h3><i><u>3</u></i><span class="hl">填寫對帳資料</span></h3>'
   +'<label for="ttmTuName">稱呼 / Discord 名</label><input id="ttmTuName" maxlength="30" autocomplete="nickname" placeholder="例：阿明 / @boss123">'
   +'<label for="ttmTuLast5">轉出帳號末五碼</label><input id="ttmTuLast5" maxlength="5" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="例：12345"></section>'
   +'<section class="ttm-step'+(tier<0?' locked':'')+'" data-step="4"><h3><i><u>4</u></i><span class="hl">上傳轉帳截圖</span></h3>'
   +'<label class="ttm-upload" for="ttmTuFile"><input type="file" id="ttmTuFile" accept="image/*"><span class="ttm-up-empty"'+(proof?' hidden':'')+'><b>選擇轉帳成功的截圖</b><small>從相簿選擇，或直接拍照</small></span>'
   +'<img id="ttmTuPrev" alt="轉帳截圖預覽"'+(proof?' src="'+proof+'"':' hidden')+'><span class="ttm-up-again"'+(proof?'':' hidden')+'>換一張</span></label>'
   +'<p class="ttm-sub">截圖需看得到轉帳金額與時間。</p></section>'
   +'<button type="button" class="ttm-primary" id="ttmTuSend" disabled>送出儲值</button>'
   +'<p class="ttm-sub ttm-center">送出後店長核帳，確認入帳就會把金幣加進你的錢包。<br>有問題可按上方「聯絡客服」。</p>'
  ):'<div class="ttm-done"><b>目前尚未開放儲值</b><p class="ttm-sub">敬請期待；有需要請按上方「聯絡客服」。</p></div>');
  const nameEl=page.querySelector('#ttmTuName');if(nameEl)nameEl.value=keep.name??dcName();
  const lastEl=page.querySelector('#ttmTuLast5');if(lastEl&&keep.last5)lastEl.value=keep.last5;
  bind();sync();if(txOpen)loadTx();
 }
 function bind(){
  page.querySelectorAll('[data-tier]').forEach(b=>b.onclick=()=>{const first=tier<0;tier=+b.dataset.tier;render();if(first){const s2=page.querySelector('[data-step="2"]');if(s2)setTimeout(()=>{try{s2.scrollIntoView({behavior:'smooth',block:'start'})}catch{}},60);}});
  page.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copy(b.dataset.copy,b,b.dataset.label));
  page.querySelectorAll('#ttmTuName,#ttmTuLast5').forEach(i=>i.oninput=()=>{if(i.id==='ttmTuLast5')i.value=i.value.replace(/\D/g,'').slice(0,5);sync();});
  const f=page.querySelector('#ttmTuFile');
  if(f)f.onchange=async()=>{const file=f.files&&f.files[0];if(!file||proofBusy)return;proofBusy=true;
   try{proof=await compress(file);const pv=page.querySelector('#ttmTuPrev');pv.src=proof;pv.hidden=false;page.querySelector('.ttm-up-empty').hidden=true;page.querySelector('.ttm-up-again').hidden=false;}
   catch{say('這張圖片讀不到，請換一張截圖');}finally{proofBusy=false;f.value='';sync();}};
  const s=page.querySelector('#ttmTuSend');if(s)s.onclick=send;
  page.querySelector('[data-act="tx"]')?.addEventListener('click',()=>{txOpen=!txOpen;render();});
  page.querySelector('[data-act="orders"]')?.addEventListener('click',()=>{done=null;show('orders');});
  page.querySelector('[data-act="again"]')?.addEventListener('click',()=>{done=null;render();});
 }
 function loadTx(){
  const box=page.querySelector('#ttmTx');if(!box||typeof db==='undefined'||!myKey)return;box.textContent='載入中…';
  db.ref(ROOT+'/walletTx/'+myKey).limitToLast(20).once('value').then(s=>{const rows=[];s.forEach(c=>{rows.push(c.val());});rows.reverse();
   const label=t=>({topup:'儲值',spend:'消費',bonus:'贈送',welcome:'開幕禮',daily:'每日任務',refund:'退款'}[t]||'調整');
   box.innerHTML=rows.length?rows.map(t=>{const d=new Date(t.ts||0),pos=(t.amount||0)>0;return '<div class="ttm-txr"><span>'+label(t.type)+(t.note?'・'+esc(t.note):'')+'<small>'+(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+'</small></span><b class="'+(pos?'in':'out')+'">'+(pos?'+':'')+fmt(t.amount)+'</b></div>';}).join(''):'<p class="ttm-sub ttm-center">還沒有交易紀錄</p>';
  }).catch(()=>{box.textContent='交易紀錄暫時讀不到，請稍後再試';});
 }
 function send(){
  if(sending||!ready())return;const list=tiers(),t=list[tier];if(!t){say('請先選擇儲值金額');return;}
  if(typeof submitTopup!=='function'||typeof curTier==='undefined'){say('儲值功能暫時無法使用，請聯絡客服');return;}
  // 交給原本的儲值送出（同一筆 clientOrders＋clientOrderProofs，同一套驗證與通知）。
  $('tuName').value=page.querySelector('#ttmTuName').value.trim();$('tuLast5').value=page.querySelector('#ttmTuLast5').value.trim();
  curTier=t;tuProofData=proof;sending=true;sync();
  const before=myOrderIds().length;submitTopup();
  let n=0;const wait=setInterval(()=>{n++;
   if(myOrderIds().length>before){clearInterval(wait);sending=false;done={amt:t.amt,get:t.amt+(t.bonus||0)};proof=null;tier=-1;render();return;}
   if(!_submitting&&n>2||n>80){clearInterval(wait);sending=false;sync();}
  },250);
 }
 return {render};
})();

// 頭像、名字、金幣、未讀
function paintCard(){
 try{const a=typeof me==='function'?me():null;const b=a&&a.b;
  if(b?.name)$('ttmName').textContent=b.name;
  if(b?.doll&&typeof drawDollTo==='function')drawDollTo($('ttmDoll'),b.doll,'idle');}catch{}
 const c=fmt(window.__wallet);if($('ttmCoinN').textContent!==c){$('ttmCoinN').textContent=c;if(current==='wallet'&&!document.activeElement?.closest?.('#ttmWallet'))wallet.render();}
}
function paintBadges(){
 for(const t of TABS){if(!t.badge)continue;const src=$(t.badge),dot=tabBar.querySelector('[data-tab="'+t.key+'"] .ttm-dot');if(!dot)continue;
  const txt=(src?.textContent||'').trim(),on=!!src&&src.style.display!=='none'&&getComputedStyle(src).display!=='none'&&txt!==''&&txt!=='0';
  dot.hidden=!on;dot.textContent=on&&/^\d+$/.test(txt)?(+txt>99?'99+':txt):'';}
}
[200,700,1500,3000].forEach(ms=>setTimeout(paintCard,ms));setInterval(()=>{paintCard();paintBadges();},1500);
// 第一次進來：上次停留的分頁，預設「訂單」。
function start(){
 $('ttmEmpty').textContent='';
 let first='orders';try{first=sessionStorage.getItem('ttm_tab')||first;}catch{}
 const q=new URLSearchParams(location.search);if(q.has('mail'))first='mail';if(q.has('topup'))first='wallet';
 show(tab(first)?first:'orders');paintCard();paintBadges();
}
if(document.readyState==='complete')setTimeout(start,0);else addEventListener('load',()=>setTimeout(start,0),{once:true});
window.TTMobileApp={show,get current(){return current;}};
})();
