/* v495 新手教學（使用者 11/06：第一次進來畫面灰灰的隔一層，用虛線圈起來說明要點哪裡）。
   TTCoach.run(steps,{doneKey}) → Promise<'done'|'skip'>
   steps：[{target:()=>Element|{left,top,width,height}|null, title, text, pad, round}]；target 找不到就只顯示說明卡（置中、整片變灰）。
   doneKey：localStorage 記號，看過就不再自動跳（TTCoach.seen(key)）；「？」鈕可以再看一次。
   外觀照大廳：白紙、深藍框、粉色錯位紙頁、粉色主按鈕；虛線圈會輕輕呼吸，減少動態設定時不動。 */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cur=null;
function seen(key){try{return !!localStorage.getItem(key);}catch(_){return false;}}
function mark(key){try{localStorage.setItem(key,String(Date.now()));}catch(_){}}
function rectOf(t){let r=null;try{r=typeof t==='function'?t():t;}catch(_){r=null;}
 if(r&&typeof r.getBoundingClientRect==='function'){if(!r.isConnected)return null;const b=r.getBoundingClientRect();if(!b.width&&!b.height)return null;return b;}
 return r&&Number.isFinite(r.left)?r:null;}
function run(steps,opt={}){
 if(cur)cur.end('skip');
 return new Promise(resolve=>{
  const root=document.createElement('div');root.id='ttCoach';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  root.innerHTML='<div class="tc-dim"></div><div class="tc-ring" aria-hidden="true"></div><div class="tc-card"><span class="tc-step"></span><h3></h3><p></p><div class="tc-btns"><button type="button" class="tc-skip">略過教學</button><button type="button" class="tc-next">下一步</button></div></div>';
  document.body.append(root);
  const ring=root.querySelector('.tc-ring'),dim=root.querySelector('.tc-dim'),card=root.querySelector('.tc-card'),next=root.querySelector('.tc-next'),skip=root.querySelector('.tc-skip');
  let i=0,raf=0;
  function place(){const s=steps[i],r=rectOf(s.target),pad=s.pad??10,W=innerWidth,H=innerHeight;
   if(r){const x=Math.max(6,r.left-pad),y=Math.max(6,r.top-pad),w=Math.min(W-12,r.width+pad*2),h=Math.min(H-12,r.height+pad*2);
    ring.hidden=false;dim.hidden=true;Object.assign(ring.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px',borderRadius:(s.round?Math.min(w,h)/2:18)+'px'});
    const cw=card.offsetWidth||320,ch=card.offsetHeight||160,gap=16;
    let cy=y+h+gap;if(cy+ch>H-8)cy=y-gap-ch;if(cy<8)cy=Math.min(H-ch-8,Math.max(8,y+h/2-ch/2));
    let cx=x+w/2-cw/2;if(r.left>W*.6)cx=Math.min(cx,x+w-cw);if(cy>y-ch&&cy<y+h&&x+w+gap+cw<W-8)cx=x+w+gap;if(cy>y-ch&&cy<y+h&&x-gap-cw>8)cx=x-gap-cw;
    cx=Math.max(8,Math.min(W-cw-8,cx));card.style.left=cx+'px';card.style.top=cy+'px';}
   else{ring.hidden=true;dim.hidden=false;card.style.left=Math.max(8,(W-(card.offsetWidth||320))/2)+'px';card.style.top=Math.max(8,(H-(card.offsetHeight||160))/2)+'px';}}
  function show(){const s=steps[i];root.querySelector('.tc-step').textContent=(i+1)+'／'+steps.length;root.querySelector('h3').textContent=s.title||'';
   root.querySelector('p').innerHTML=esc(s.text||'').replace(/\n/g,'<br>');next.textContent=i===steps.length-1?(opt.last||'開始玩吧'):'下一步';skip.hidden=i===steps.length-1;
   card.classList.remove('tc-pop');void card.offsetWidth;card.classList.add('tc-pop');place();requestAnimationFrame(place);next.focus({preventScroll:true});}
  function end(how){if(!root.isConnected)return;cancelAnimationFrame(raf);removeEventListener('resize',place);removeEventListener('keydown',key,true);root.remove();cur=null;if(opt.doneKey)mark(opt.doneKey);resolve(how);}
  function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();end('skip');}else if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();next.click();}}
  next.onclick=()=>{if(i<steps.length-1){i++;show();}else end('done');};
  skip.onclick=()=>end('skip');
  addEventListener('resize',place);addEventListener('keydown',key,true);
  const follow=()=>{place();raf=requestAnimationFrame(follow);};   // 目標會動（鏡頭、版面），圈圈跟著
  cur={end};show();raf=requestAnimationFrame(follow);
 });}
window.TTCoach={run,seen,mark,close:()=>cur&&cur.end('skip')};
})();
