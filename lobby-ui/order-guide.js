/* v514 D 11/10：「老闆點完單後，在等待的時間不知道現在可以幹嘛、後續要去哪，都沒有引導」
   1. 送出委託後跳「接下來會這樣進行」說明卡：付款 → 冒險者接單 → Discord 會合 → 一起玩，標出現在走到哪一步，附上等待時可以做的事。
   2. 左上角吊卡（renewCardHtml）在「還沒開始玩」的每一個階段都掛著：現在在等什麼、下一步去哪；語音房開好直接放進房按鈕。
      正在玩（冒險者按了開始，servingSince）照舊用原本的倒數／續單吊卡。
   只讀訂單與語音房狀態，不寫任何資料。 */
(() => {
 'use strict';
 if(typeof renewCardHtml!=='function'||typeof paintPlayCard!=='function')return;
 const $=id=>document.getElementById(id),H=v=>esc(String(v??''));
 const HOUR=3600000,STEPS=['付款','接單','會合','一起玩'],DISCORD='https://discord.com/channels/@me',OFF='tt_guide_off';
 const original=renewCardHtml;
 const cache=()=>(typeof myOrdersCache!=='undefined'&&myOrdersCache)||{};
 const staffOf=o=>{try{return ttOrderStaffDisplayName(o);}catch(_){return o.staffName||'冒險者';}};
 const phone=()=>document.documentElement.classList.contains('ttm-on')||document.body.classList.contains('mhome-on')||matchMedia('(max-width:640px)').matches;
 const spot=()=>document.documentElement.classList.contains('ttm-on')?'訂單頁最上面':'左上角';   // 手機版沒有大廳，進度卡放在「訂單・進行中」最上面
 const norm=html=>{const t=document.createElement('template');t.innerHTML=html;return t.innerHTML;};   // 跟 host.innerHTML 比對用，避免每次重畫都重播進場動畫

 /* 一筆委託現在在哪一步：0 付款確認中／1 等接單／2 已接單等會合／-1 冒險者接不上；null＝不用掛（不是玩的單、已結束、正在玩、太舊） */
 function stageOf(o,now){
   if(!o||(o.type&&o.type!=='play')||o.refunded)return null;
   if(o.status!=='pending'&&o.status!=='confirmed')return null;
   if(o.servingSince)return null;
   const at=+o.createdAt||0;
   if(o.status==='pending')return now-at<24*HOUR?0:null;
   if(o.staffDeclined)return now-at<24*HOUR?-1:null;
   if(!o.accepted)return (o.booking?+o.reserveAt>now-HOUR:now-at<12*HOUR)?1:null;
   return now-(o.booking?+o.reserveAt:(+o.acceptedAt||at))<6*HOUR?2:null;
 }
 /* 掛哪一筆：即時單優先，其次最快到的預約；同一組（groupId）一起看，以「最慢的那位」為準 */
 function quest(){
   const now=Date.now(),all=Object.entries(cache());let best=null;
   for(const [id,o] of all){
     if(stageOf(o,now)===null)continue;
     const when=o.booking?(+o.reserveAt||now):0;
     if(!best||when<best.when)best={id,o,when};
   }
   if(!best)return null;
   const group=best.o.groupId?all.filter(([,o])=>o&&o.groupId===best.o.groupId&&stageOf(o,now)!==null):[[best.id,best.o]];
   const stages=group.map(([,o])=>stageOf(o,now));
   return {id:best.id,o:best.o,group,ids:group.map(([id])=>id),stage:stages.includes(-1)?-1:Math.min(...stages),accepted:group.filter(([,o])=>o.accepted).length};
 }
 const namesOf=q=>[...new Set(q.group.map(([,o])=>staffOf(o)))].join('、')||'冒險者';
 /* 語音房開好、而且到了可以進房的時間（開始前 10 分鐘起）才給連結；判斷跟訂單頁的進房鈕一樣 */
 function voiceUrl(ids){
   const items=window.TTVoiceOrders?.items?.()||[];
   const it=items.find(x=>(x.sourceOrderIds||[]).some(i=>ids.includes(i)));
   if(!it||!/^https:\/\/discord\.com\//.test(it.url||''))return null;
   if(it.status!=='confirmed'||['closed','deleted'].includes(it.state))return null;
   if(Number.isFinite(it.startAt)&&Date.now()<it.startAt-600000)return null;
   return it.url;
 }

 // ---------- 左上角委託進度卡 ----------
 function questCard(q){
   const o=q.o,names=namesOf(q),total=q.group.length,now=Date.now(),t=o.booking&&o.reserveAt?fmtRes(+o.reserveAt):'';
   let cls='',title,sub,act='';
   if(q.stage===-1){cls=' is-alert';title='冒險者這次接不上';sub='店長正在幫你處理退款或改期，結果會寄到信箱。';act='<button type="button" class="qc-btn" onclick="shopOpen(4)">看訂單</button>';}
   else if(q.stage===0){title='店長確認付款中';sub='確認好就會通知 '+names+'，不用一直盯著這裡。';}
   else if(q.stage===1){
     title=o.booking?'等 '+names+' 確認時段':'等 '+names+' 接單';
     sub=(total>1&&q.accepted?q.accepted+'／'+total+' 位已接單・':'')+(o.booking?'約在 '+t+'，確認後這裡會更新。':'已經通知冒險者了，通常幾分鐘內就會回覆。');
     if(!o.booking&&total===1&&now-(+o.createdAt||now)>15*60000&&typeof canSelfCancel==='function'&&canSelfCancel(o))sub='等比較久了。想換人的話，可以在訂單裡取消，金幣會退回。';
   }else{
     const url=voiceUrl(q.ids),far=o.booking&&+o.reserveAt>now+30*60000;
     if(url){cls=' is-ready';title='語音房開好了！';sub=names+' 在等你，點下面直接進去。';act='<a class="qc-btn qc-go" href="'+H(url)+'" target="_blank" rel="noopener noreferrer">進入語音房 ↗</a>';}
     else if(far){title='約好了，'+t+' 見';sub='開始前 10 分鐘左右，TT 會在 Discord 私訊你，照著按就能進去。';}
     else{title=names+' 接下你的委託囉';sub='TT 會在 Discord 私訊你，照著按就能進專屬聊天室和語音房。';act='<a class="qc-btn" href="'+DISCORD+'" target="_blank" rel="noopener noreferrer">打開 Discord ↗</a>';}
   }
   const cur=Math.max(0,q.stage);
   const steps=STEPS.map((s,i)=>'<li class="'+(q.stage<0?'':i<cur?'done':i===cur?'now':'')+'"><i></i>'+s+'</li>').join('');
   return '<div id="playCard" class="tt-quest s'+(q.stage<0?'x':q.stage)+cls+'"><div class="qc-kick"><span>YOUR QUEST</span><em>#'+H(q.id.slice(-5).toUpperCase())+'</em></div>'
     +'<div class="pcHead"><span class="pcDot"></span><b>'+H(title)+'</b></div><div class="qc-sub">'+H(sub)+'</div>'
     +'<ol class="qc-steps" aria-label="委託進度">'+steps+'</ol>'
     +'<div class="qc-acts">'+act+'<button type="button" class="qc-btn qc-more" onclick="TTOrderGuide.open()">接下來？</button></div></div>';
 }
 renewCardHtml=function(){
   const a=typeof activeOrder==='function'?activeOrder():null;
   if(a&&!a.waiting)return original();          // 正在玩：倒數＋續單
   const q=quest();
   return q?norm(questCard(q)):original();
 };
 const repaint=()=>{clearTimeout(repaint.t);repaint.t=setTimeout(()=>{try{paintPlayCard();}catch(_){}try{mobileQuest();}catch(_){}},150);};
 if(typeof updateOrdBadge==='function'){const badge=updateOrdBadge;updateOrdBadge=function(){const r=badge.apply(this,arguments);repaint();return r;};}
 addEventListener('tt-voice-items',repaint);
 function mobileQuest(){
   const list=$('ordList');if(!list)return;
   const old=list.querySelector(':scope > .tt-quest-m');
   const q=document.documentElement.classList.contains('ttm-on')&&(typeof _ordTab==='undefined'||_ordTab==='active')?quest():null;
   if(!q){old?.remove();return;}
   const html=norm(questCard(q).replace('id="playCard" ',''));
   if(old&&old.innerHTML===html)return;   // 沒變就不動，免得一直重播動畫
   const box=old||document.createElement('div');box.className='tt-quest-m';box.innerHTML=html;
   list.querySelector(':scope > .tt-empty')?.remove();if(!old)list.prepend(box);
 }
 if(typeof renderMyOrders==='function'){const base=renderMyOrders;renderMyOrders=function(){const r=base.apply(this,arguments);try{mobileQuest();}catch(_){}return r;};}
 setInterval(repaint,30000);   // 預約倒數到「開始前 10 分鐘」時換成進房鈕
 repaint();

 // ---------- 「接下來會這樣進行」說明卡 ----------
 function detail(q,fresh){
   const o=q.o,names=namesOf(q),bk=!!(o.booking&&o.reserveAt),t=bk?fmtRes(+o.reserveAt):'',cur=Math.max(0,q.stage);
   const rows=[
     ['付款',q.stage===0?'店長正在確認你的轉帳，確認好就會通知冒險者。':(o.paidBy==='wallet'?'金幣付款完成。':'付款已確認。')],
     ['冒險者接單',bk?names+' 會確認 '+t+' 這個時段，確認後'+spot()+'的進度卡會更新。':'已經通知 '+names+'，通常幾分鐘內就會接單；接了之後'+spot()+'會顯示「接下你的委託囉」。'],
     ['Discord 會合','冒險者接單後'+(bk?'、約好的時間前 10 分鐘左右':'')+'，TT 會在 Discord 私訊你，照著按就能進專屬聊天室和語音房；語音房開好時，'+spot()+'也會出現「進入語音房」。'],
     ['一起玩','冒險者按下開始才會計時；快結束的時候，'+spot()+'可以直接續單。']
   ];
   const game=o.game?'<p class="tg-game"><span>這次想玩</span><b>'+H(o.game)+'</b></p>':'';
   const alert=q.stage===-1?'<p class="tg-alert">冒險者這次接不上，店長正在幫你處理退款或改期，結果會寄到信箱。</p>':'';
   const list=rows.map(([h,p],i)=>'<li class="'+(q.stage<0?'':i<cur?'done':i===cur?'now':'')+'" style="--i:'+i+'"><b>'+String(i+1).padStart(2,'0')+'</b><div><strong>'+h+(q.stage>=0&&i===cur?'<em>現在在這裡</em>':'')+'</strong><span>'+H(p)+'</span></div></li>').join('');
   const tiles=[
     ['discord','打開 Discord','先確認收得到 TT 的私訊'],
     $('wardBtn')?['ward','換套衣服','見面前打扮一下']:null,
     (!phone()&&window.TTHouse?.enter)?['house','回小屋等','佈置一下自己的房間']:null,
     $('chatin')&&$('chatin').getClientRects().length?['chat','在大廳聊聊','說句話，每日任務也會算']:null
   ].filter(Boolean).map(([k,h,p])=>k==='discord'
     ?'<a class="tg-tile" href="'+DISCORD+'" target="_blank" rel="noopener noreferrer"><b>'+h+' ↗</b><small>'+p+'</small></a>'
     :'<button type="button" class="tg-tile" data-go="'+k+'"><b>'+h+'</b><small>'+p+'</small></button>').join('');
   return '<div class="tg-card" role="dialog" aria-modal="true" aria-labelledby="ttGuideT">'
     +'<button type="button" class="tg-x" aria-label="關閉">×</button>'
     +'<header class="tg-head"><small>WHAT\'S NEXT / 接下來</small><h2 id="ttGuideT">'+(fresh?'委託送出了！':'現在的進度')+'</h2><span class="tg-ghost" aria-hidden="true">NEXT</span></header>'
     +'<div class="tg-body">'+alert+game+'<ol class="tg-steps">'+list+'</ol>'
     +'<section class="tg-wait"><h3><small>WHILE YOU WAIT</small>等待的時候，可以…</h3><div class="tg-tiles">'+tiles+'</div></section>'
     +'<p class="tg-note">關掉也沒關係，進度會一直掛在'+spot()+'。</p></div>'
     +'<footer class="tg-foot">'+(fresh?'<label class="tg-off"><input type="checkbox"'+(off()?' checked':'')+'> 下次送出後不用再跳出來</label>':'')+'<button type="button" class="tg-ok">知道了</button></footer></div>';
 }
 const off=()=>{try{return localStorage.getItem(OFF)==='1';}catch(_){return false;}};
 let lastFocus=null;
 function close(){const m=$('ttGuideM');if(!m)return;m.classList.remove('on');setTimeout(()=>{if(!m.classList.contains('on'))m.hidden=true;},220);try{lastFocus?.focus?.();}catch(_){}}
 function show(q,fresh){
   let m=$('ttGuideM');
   if(!m){m=document.createElement('div');m.id='ttGuideM';m.className='tt-guide';m.hidden=true;document.body.append(m);
     m.addEventListener('click',e=>{if(e.target===m)close();});
     m.addEventListener('keydown',e=>{if(e.key==='Escape')close();});}
   lastFocus=document.activeElement;
   m.innerHTML=detail(q,fresh);m.hidden=false;requestAnimationFrame(()=>m.classList.add('on'));
   m.querySelector('.tg-x').onclick=close;m.querySelector('.tg-ok').onclick=close;
   const box=m.querySelector('.tg-off input');if(box)box.onchange=()=>{try{box.checked?localStorage.setItem(OFF,'1'):localStorage.removeItem(OFF);}catch(_){}};
   m.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const k=b.dataset.go;close();
     try{if(k==='ward')$('wardBtn')?.click();else if(k==='house')window.TTHouse?.enter?.();else if(k==='chat')$('chatin')?.focus();}catch(_){}});
   m.querySelector('a.tg-tile')?.addEventListener('click',close);
   setTimeout(()=>m.querySelector('.tg-ok')?.focus(),80);
 }
 window.TTOrderGuide={
   /* 送出成功時呼叫：訂單監聽可能還沒拿到資料，先用剛送出的那筆當底 */
   after(ids,o,all){
     repaint();
     if(!o||off())return;
     const group=(ids||[]).map((id,i)=>[id,cache()[id]||(all||[])[i]||o]);
     setTimeout(()=>show({id:ids[0],o,group,ids,stage:o.status==='pending'?0:1,accepted:0},true),420);
   },
   open(){const q=quest();if(!q){toast('目前沒有等待中的委託');return;}show(q,false);},
   quest
 };
})();
