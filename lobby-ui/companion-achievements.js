(function(root){
 'use strict';
 const catalog=[{id:'companion_rira',asset:'rira',name:'縭'},{id:'companion_kabuki',asset:'kabuki',name:'蕪'},{id:'companion_momo',asset:'momo',name:'桃'}];
 /* v554 進度條（D 11/18：老闆不知道還差多少、之前的單有沒有算進去）：主機 /v1/voice/rewards 本來就回傳每位冒險者累積的秒數（frames[].seconds）
    與門檻（requiredSeconds，36000＝10 小時），以前只拿來判斷有沒有解鎖。現在卡片與頭像框視窗都顯示「已累積 X／10 小時、還差 Y」。 */
 const REQ=36000;
 const fmtGot=s=>s<3600?Math.floor(s/60)+' 分鐘':(Math.floor(s/360)/10)+' 小時';
 const fmtLeft=s=>s<3600?Math.max(1,Math.ceil(s/60))+' 分鐘':(Math.ceil(s/360)/10)+' 小時';
 function states(rewards,key){
  const loaded=!!key&&rewards?.key===key&&Array.isArray(rewards.frames);
  const need=loaded&&Number.isFinite(+rewards.requiredSeconds)&&+rewards.requiredSeconds>0?+rewards.requiredSeconds:REQ;
  return catalog.map(c=>{
   const f=loaded?rewards.frames.find(x=>x.id===c.id):null;
   const unlocked=!!(f&&f.unlocked===true);
   const seconds=f&&Number.isFinite(+f.seconds)?Math.max(0,+f.seconds):0;
   return {...c,loaded,unlocked,seconds,need,pct:unlocked?100:Math.min(100,seconds/need*100),
    status:!key?'登入後查看解鎖狀態':!loaded?'等待同步解鎖狀態':unlocked?'已獲得頭像框':'尚未解鎖'};
  });
 }
 /* 給頭像框選擇視窗用：一行字＋細進度條 */
 function progress(id,rewards,key){
  const c=states(rewards,key).find(x=>x.id===id);if(!c)return null;
  const hrs=Math.round(c.need/3600);
  return {...c,text:!c.loaded?c.status:c.unlocked?'已達成 '+hrs+' 小時':(Math.floor(c.seconds/360)/10)+'／'+hrs+' 小時'};
 }
 function injectCss(){
  if(typeof document==='undefined'||document.getElementById('companionAchCss'))return;
  const st=document.createElement('style');st.id='companionAchCss';
  st.textContent='html body .companion-ach-prog{margin:8px auto 0;max-width:210px;text-align:left}'
   +'html body .companion-ach-prog .cap-row{display:flex;align-items:baseline;justify-content:space-between;gap:6px;font-size:11.5px;color:#6E68A8}'
   +'html body .companion-ach-prog .cap-row b{font-size:13px;color:#1C2156;font-weight:900}'
   +'html body .companion-ach-prog .cap-bar,html body .fpg2{position:relative;height:9px;margin-top:4px;border:2px solid #1C2156;border-radius:999px;background:#fff;overflow:hidden}'
   +'html body .companion-ach-prog .cap-bar i,html body .fpg2 i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#FF8DB5,#C08CFF 60%,#6FD0F5)}'
   +'html body .companion-ach-prog small{display:block;margin-top:4px;font-size:10.5px;color:#8E7AB0}'
   +'html body .companion-ach-card.is-unlocked .companion-ach-prog small{color:#547c58;font-weight:700}'
   +'html body .fpg2{height:6px;border-width:1.5px;margin:3px 10px 6px}';
  document.head.appendChild(st);
 }
 function progEl(c){
  const box=document.createElement('div');box.className='companion-ach-prog';
  const hrs=Math.round(c.need/3600);
  const row=document.createElement('div');row.className='cap-row';
  const got=document.createElement('b');got.textContent=c.loaded?(c.unlocked?hrs+' 小時':fmtGot(c.seconds)):'—';
  const of=document.createElement('span');of.textContent='／'+hrs+' 小時';row.append(got,of);
  const bar=document.createElement('div');bar.className='cap-bar';
  const fill=document.createElement('i');fill.style.width=(c.loaded?c.pct:0).toFixed(1)+'%';bar.append(fill);
  box.setAttribute('role','progressbar');box.setAttribute('aria-valuemin','0');box.setAttribute('aria-valuemax',String(c.need));
  box.setAttribute('aria-valuenow',String(c.unlocked?c.need:Math.min(c.seconds,c.need)));box.setAttribute('aria-label','與'+c.name+'一起玩的時數');
  const note=document.createElement('small');
  note.textContent=!c.loaded?c.status:c.unlocked?'已獲得頭像框 ✦':'還差 '+fmtLeft(c.need-c.seconds)+'解鎖';
  box.append(row,bar,note);return box;
 }
 function mount(parent,rewards,key){
  injectCss();
  parent.querySelector('.companion-achievements')?.remove();
  const section=document.createElement('section');section.className='companion-achievements';section.setAttribute('aria-label','冒險者十小時成就');
  const heading=document.createElement('div');heading.className='companion-ach-heading';heading.innerHTML='<small>TOGETHER / 陪伴收藏</small><h2>一起玩的十小時</h2><p>與同一位冒險者累積一起玩滿 10 小時，獲得他的專屬頭像框。</p>';
  const grid=document.createElement('div');grid.className='companion-ach-grid';
  for(const c of states(rewards,key)){
   const card=document.createElement('article');card.className='companion-ach-card'+(c.unlocked?' is-unlocked':'');card.dataset.reward=c.id;
   const art=document.createElement('div');art.className='companion-ach-art';
   const doll=document.createElement('img');doll.src='img/companions-v352/'+c.asset+'-staff.gif';doll.alt=c.name+'的小娃娃';doll.className='companion-ach-doll';
   const frame=document.createElement('img');frame.src='img/frames/companions/'+c.id+'.webp';frame.alt=c.name+'角色頭像框獎勵';frame.className='companion-ach-frame';art.append(doll,frame);
   const title=document.createElement('h3');title.textContent='與'+c.name+'的十小時';
   const description=document.createElement('p');description.textContent='專屬獎勵 · '+c.name+'角色頭像框';
   const button=document.createElement('button');button.type='button';button.textContent=c.unlocked?'前往使用頭像框 ↗':'查看獎勵頭像框 ↗';button.onclick=()=>root.__openFrames?.();
   card.append(art,title,description,progEl(c),button);grid.append(card);
  }
  const note=document.createElement('p');note.className='companion-ach-note';note.textContent='每次委託結束後，這次一起玩的時間會自動算進去（暫停的時間不算）；滿 10 小時自動解鎖，可以到頭像框頁換上。';
  section.append(heading,grid,note);parent.prepend(section);
 }
 const api={states,mount,progress,injectCss};root.TTCompanionAchievements=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
