(function(root){
 'use strict';
 const catalog=[{id:'companion_rira',asset:'rira',name:'縭'},{id:'companion_kabuki',asset:'kabuki',name:'蕪'},{id:'companion_momo',asset:'momo',name:'桃'}];
 function states(rewards,key){
  const loaded=!!key&&rewards?.key===key&&Array.isArray(rewards.frames);
  return catalog.map(c=>({...c,loaded,unlocked:loaded&&rewards.frames.some(f=>f.id===c.id&&f.unlocked===true),status:!key?'登入後查看解鎖狀態':!loaded?'等待同步解鎖狀態':rewards.frames.some(f=>f.id===c.id&&f.unlocked===true)?'已獲得頭像框':'尚未解鎖'}));
 }
 function mount(parent,rewards,key){
  parent.querySelector('.companion-achievements')?.remove();
  const section=document.createElement('section');section.className='companion-achievements';section.setAttribute('aria-label','陪玩十小時成就');
  const heading=document.createElement('div');heading.className='companion-ach-heading';heading.innerHTML='<small>TOGETHER / 陪伴收藏</small><h2>一起玩的十小時</h2><p>與同一位陪玩累積完成 10 小時服務，獲得他的專屬頭像框。</p>';
  const grid=document.createElement('div');grid.className='companion-ach-grid';
  for(const c of states(rewards,key)){
   const card=document.createElement('article');card.className='companion-ach-card'+(c.unlocked?' is-unlocked':'');card.dataset.reward=c.id;
   const art=document.createElement('div');art.className='companion-ach-art';
   const doll=document.createElement('img');doll.src='img/companions-v315/'+c.asset+'-staff.gif';doll.alt=c.name+'的小娃娃';doll.className='companion-ach-doll';
   const frame=document.createElement('img');frame.src='img/frames/companions/'+c.id+'.png';frame.alt=c.name+'角色頭像框獎勵';frame.className='companion-ach-frame';art.append(doll,frame);
   const title=document.createElement('h3');title.textContent='與'+c.name+'的十小時';
   const description=document.createElement('p');description.textContent='專屬獎勵 · '+c.name+'角色頭像框';
   const status=document.createElement('span');status.className='companion-ach-status';status.textContent=c.status;
   const button=document.createElement('button');button.type='button';button.textContent=c.unlocked?'前往使用頭像框 ↗':'查看獎勵頭像框 ↗';button.onclick=()=>root.__openFrames?.();
   card.append(art,title,description,status,button);grid.append(card);
  }
  const note=document.createElement('p');note.className='companion-ach-note';note.textContent='依已結束服務的有效時數累積，暫停時間不計入；達成後自動解鎖，可至頭像框頁換上。';
  section.append(heading,grid,note);parent.prepend(section);
 }
 const api={states,mount};root.TTCompanionAchievements=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
