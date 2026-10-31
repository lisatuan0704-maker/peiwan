/* v478 冒險者介紹卡：大廳點兩下縭／蕪／桃的像素小人，跳出他們自己的介紹卡（與 Discord 酒館居民同一張圖）。
   圖片在 img/staff-cards-v478/<asset>.webp；換人或換卡時更新圖片與版本號即可。 */
(function(){
  'use strict';
  const NAMES={rira:'縭',kabuki:'蕪',momo:'桃'};
  let box=null,img=null,last=null;
  function build(){
    box=document.createElement('div');box.id='staffCardM';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    box.innerHTML='<div class="scm-card"><button type="button" class="scm-x" aria-label="關閉介紹卡">×</button><img alt=""><p class="scm-tip">想找他一起玩，到「我要點單」選冒險者就可以囉</p></div>';
    img=box.querySelector('img');
    box.addEventListener('pointerdown',e=>{if(e.target===box)close()});
    box.querySelector('.scm-x').addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box&&!box.hidden)close()});
    document.body.appendChild(box);
  }
  function open(asset){
    if(!NAMES[asset])return false;
    if(!box)build();
    last=document.activeElement;
    img.src='img/staff-cards-v478/'+asset+'.webp';img.alt=NAMES[asset]+'的介紹卡';
    box.querySelector('.scm-tip').textContent='想找'+NAMES[asset]+'一起玩，到「我要點單」選冒險者就可以囉 ✧';
    box.hidden=false;requestAnimationFrame(()=>box.classList.add('on'));
    box.querySelector('.scm-x').focus({preventScroll:true});
    return true;
  }
  function close(){if(!box||box.hidden)return;box.classList.remove('on');box.hidden=true;img.removeAttribute('src');try{last&&last.focus&&last.focus({preventScroll:true})}catch(e){}}
  window.TTStaffCard={open,close,isOpen:()=>!!box&&!box.hidden};
})();
