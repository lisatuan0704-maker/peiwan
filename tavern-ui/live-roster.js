/* 正式名簿：原畫面樣式，店員與排班皆讀取主站資料。 */
(() => {
 'use strict';
 const api=parent.TinyTavernUI;if(!api)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const selected=new Set();let rosterMode='now',people=[],current=null,lastSignature='';
 const baseProfile=profile;
 document.querySelector('#profileWindow').dataset.momoTone='refined';
 document.querySelectorAll('.draft-label,.review-dock,.scene,.shade,#sceneOpen').forEach(x=>x.style.display='none');
 document.querySelectorAll('.portrait-label').forEach(x=>x.remove());
 document.body.classList.add('live-site');
 document.querySelector('.roster-tools .section-copy').textContent='點名牌看介紹，也可以先收藏想約的陪玩';
 const foot=document.querySelector('#rosterWindow .window-foot');
 foot.innerHTML='<div class="multi-selection-summary"><strong id="liveCount">已選 0 位</strong><span id="liveNames">挑選想一起玩的店員</span></div><button id="liveNext" class="primary" disabled>下一步 →</button>';
 document.querySelector('#anyBtn').textContent='不指定，幫我找玩伴 ↗';
 document.querySelector('#anyBtn').onclick=()=>attempt(()=>api.choose(null,rosterMode));
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=api.close);
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{rosterMode=b.dataset.mode;refresh(true);});
 document.querySelector('#backToRoster').onclick=()=>{current=null;show('roster',false);refresh(true);};
 document.querySelector('#pickCast').onclick=()=>{if(current)toggle(current.cid);};
 document.querySelector('#liveNext').onclick=()=>{
   const chosen=people.filter(p=>selected.has(p.cid));
   if(chosen.length===1){attempt(()=>api.choose(chosen[0].cid,rosterMode));return;}
   const panel=document.createElement('div');panel.className='live-choose-backdrop';panel.innerHTML='<section class="live-choose-card"><h2>想一起玩的陪玩</h2><p>每位陪玩分別選方案與時段。</p>'+chosen.map(p=>'<button class="primary" data-order="'+esc(p.cid)+'">'+esc(p.name)+'・選方案 →</button>').join('')+'<button class="back" data-dismiss>← 返回名簿</button></section>';
   panel.querySelector('[data-dismiss]').onclick=()=>panel.remove();panel.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>attempt(()=>{api.choose(b.dataset.order,rosterMode);panel.remove();}));document.body.append(panel);
 };
 function attempt(fn){try{fn();}catch(e){toast(e.message);}}
 function available(p){return rosterMode==='now'?p.on&&!p.busy:!p.card.noBooking;}
 function toggle(cid){const p=people.find(p=>p.cid===cid);if(!p||!available(p)){toast('這位店員目前無法接受此類預約');return;}selected.has(cid)?selected.delete(cid):selected.add(cid);syncSelection();}
 function syncSelection(){
  document.querySelector('#liveCount').textContent='已選 '+selected.size+' 位';document.querySelector('#liveNames').textContent=people.filter(p=>selected.has(p.cid)).map(p=>p.name).join('、')||'挑選想一起玩的店員';document.querySelector('#liveNext').disabled=!selected.size;
  document.querySelectorAll('[data-select-cid]').forEach(b=>{const on=selected.has(b.dataset.selectCid);b.textContent=on?'✓ 已選':'＋選取';b.setAttribute('aria-pressed',String(on));b.closest('.cast-entry').classList.toggle('is-selected',on);});
  if(current){const btn=document.querySelector('#pickCast');btn.textContent=selected.has(current.cid)?'從名單移出':'加入陪玩名單';btn.disabled=!available(current);}
 }
 function refresh(force=false){
  const order=['KABUKI','MOMO','RIRA'];people=api.staff().filter(p=>order.includes(p.theme)).sort((a,b)=>order.indexOf(a.theme)-order.indexOf(b.theme));const sig=JSON.stringify([rosterMode,people]);if(!force&&sig===lastSignature)return;lastSignature=sig;
  for(const cid of selected){if(!people.some(p=>p.cid===cid&&available(p)))selected.delete(cid);}
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===rosterMode)));
  const list=rosterMode==='now'?people.filter(p=>p.on&&!p.busy):people;
  document.querySelector('#roster').innerHTML=list.map((p,i)=>{
    const c=CAST.find(c=>c.id===p.theme),color=c?.color||'#9a8bab',pale=c?.pale||'#eee8f3';
    return '<div class="cast-entry" data-member="'+esc(p.theme||p.cid)+'" style="--accent:'+color+';--pale:'+pale+'"><button class="cast-row" data-cid="'+esc(p.cid)+'" aria-label="認識 '+esc(p.name)+'"><span class="cast-watermark" aria-hidden="true">'+esc(p.theme||'TAVERN')+'</span><div class="identity"><div class="cast-name"><b>'+esc(c?.name||p.name)+'</b><span>'+esc(p.theme||p.name)+'</span></div><div class="mood-line">'+esc(p.card.mood||'便箋等待更新')+'</div></div>'+(c?artwork(c,true):'<span class="live-generic-art"><canvas width="64" height="64"></canvas></span>')+'<span class="row-number">'+(p.card.noBooking?'暫停預約':p.on?(p.busy?'接單中':'可即時'):'可預約')+'</span></button><button class="cast-select" data-select-cid="'+esc(p.cid)+'" '+(!available(p)?'disabled':'')+'>＋選取</button></div>';
  }).join('')||'<p class="live-empty">'+(rosterMode==='now'?'目前沒有空閒的陪玩，可以切換「預約」看看。':'店員資料載入中，請稍候。')+'</p>';
  document.querySelectorAll('[data-cid]').forEach(b=>b.onclick=()=>openInfo(b.dataset.cid));
  document.querySelectorAll('[data-select-cid]').forEach(b=>b.onclick=()=>toggle(b.dataset.selectCid));
  document.querySelectorAll('.live-generic-art canvas').forEach(cv=>api.draw(cv,{back:0,front:0,cloth:0,face:0,hair:0,acc:0}));
  document.querySelector('.roster-foot>span').textContent='店員名簿 · '+list.length+' 位';syncSelection();
  if(current&&document.body.dataset.view==='profile'){const updated=people.find(p=>p.cid===current.cid);if(updated)updateInfo(updated);}
 }
 function updateInfo(p){
  current=p;document.querySelector('.portrait-label')?.remove();
  document.querySelector('.status').textContent=p.card.noBooking?'暫停接受預約':p.on?(p.busy?'接單中':'可即時接單'):'目前下班，可預約';
  document.querySelector('.profile-tagline').textContent='Tiny Tavern・'+p.name;
  document.querySelector('#introLead').textContent='關於'+p.name+'，想讓你知道的事。';
  document.querySelector('#panel-intro .intro-note').textContent=p.card.intro||'自我介紹更新中。';
  const dd=document.querySelectorAll('#panel-intro .facts dd');if(dd[0])dd[0].textContent=p.card.games||'店員更新中';if(dd[1])dd[1].textContent=p.card.specialty||'歡迎一起玩';
  document.querySelector('#panel-mood').innerHTML='<div class="note-sheet"><h3>'+esc(p.name)+'的心情便箋</h3><p>'+esc(p.card.mood||'今天的便箋還沒寫下，晚點再來看看。')+'</p></div>';
  syncSelection();
 }
 function openInfo(cid){
  const p=people.find(p=>p.cid===cid);if(!p)return;if(!p.theme){api.originalInfo(cid);return;}
  baseProfile(p.theme);updateInfo(p);
  document.querySelector('#panel-time').innerHTML='<div class="live-calendar">'+api.calendar(cid)+'</div><div id="liveBooked">預約時段查詢中…</div>';
  api.booked(cid).then(times=>{if(current?.cid!==cid)return;document.querySelector('#liveBooked').textContent=times.length?'已預約：'+times.slice(0,20).map(t=>new Date(t).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})).join('、'):'目前沒有已登記的預約時段。';});
 }
 window.ttLiveOpen=({view,cid}={})=>{document.querySelectorAll('.live-choose-backdrop').forEach(x=>x.remove());refresh(true);if(view==='profile')openInfo(cid);else if(view==='shop'||view==='bag'){show('shop',false);const f=document.querySelector('#shopFrame');f.dataset.liveArea=view;f.contentWindow.ttDressArea?.(view==='bag'?'bag':'store');}else show('roster',false);};
 document.querySelector('#shopFrame').addEventListener('load',()=>{const f=document.querySelector('#shopFrame');f.contentWindow.ttDressArea?.(f.dataset.liveArea==='bag'?'bag':'store');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();api.close();}});
 setInterval(()=>{if(api.isActive())refresh();},1500);refresh(true);
})();
