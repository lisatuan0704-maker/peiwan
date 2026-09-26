/* 名簿位置調整工具：只使用本機儲存，不連接資料庫。 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),ids=['KABUKI','MOMO','RIRA'];
 const storageKey='tt-portrait-adjust-v1';
 let selected='KABUKI',state={},defaults={},rows={},images={},ready=false;
 const round=n=>Math.round(n*1000)/1000;
 function select(id){selected=id;document.querySelectorAll('[data-cast]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cast===id)));for(const key of ids)rows[key]?.classList.toggle('adjust-active',key===id);sync();}
 function sync(){if(!ready)return;for(const key of ['x','y','scale']){const value=state[selected][key];$(key+'Number').value=round(value);$(key+'Range').value=value;}}
 function render(){
  if(!ready)return;
  for(const id of ids){const s=state[id],im=images[id];im.style.left=s.x+'%';im.style.top=s.y+'%';im.style.height=(s.baseHeight*s.scale/100)+'%';}
  const result={format:'tiny-tavern-roster-portraits',version:1,sourceVersion:226,units:'percent-of-row',previewWidth:Number($('previewWidth').value),characters:Object.fromEntries(ids.map(id=>[id,{asset:`assets/${id}-artist-v1.png`,centerXPercent:round(state[id].x),centerYPercent:round(state[id].y),heightPercent:round(state[id].baseHeight*state[id].scale/100)}]))};
  $('output').value=JSON.stringify(result,null,2);
  try{localStorage.setItem(storageKey,JSON.stringify(state));$('saved').textContent='已暫存在這個瀏覽器；重開可繼續調整。';}catch{$('saved').textContent='瀏覽器無法暫存，請複製設定保存。';}
 }
 function valid(s){return ids.every(id=>s?.[id]&&Number.isFinite(s[id].x)&&s[id].x>=-100&&s[id].x<=200&&Number.isFinite(s[id].y)&&s[id].y>=-500&&s[id].y<=500&&Number.isFinite(s[id].scale)&&s[id].scale>=10&&s[id].scale<=300&&Number.isFinite(s[id].baseHeight)&&s[id].baseHeight>0&&s[id].baseHeight<2000);}
 $('preview').addEventListener('load',async()=>{
  const doc=$('preview').contentDocument;
  if(!doc?.querySelector('#roster')){$('status').textContent='預覽載入失敗，請重新整理頁面。';return;}
  doc.body.classList.add('live-site','motion-off');
  doc.querySelectorAll('.draft-label,.review-dock,.scene,.shade,#sceneOpen').forEach(el=>el.remove());
  doc.querySelector('.roster-tools .section-copy').textContent='點角色那一列，再拖曳調整位置';
  for(const id of ids){
   const row=doc.querySelector(`[data-cast="${id}"]`),wrap=doc.createElement('div');wrap.className='cast-entry';row.before(wrap);wrap.append(row);
   row.querySelector('.row-arrow')?.remove();row.querySelector('.row-number').textContent='可預約';
   const selectButton=doc.createElement('button');selectButton.className='cast-select';selectButton.textContent='＋選取';selectButton.tabIndex=-1;wrap.append(selectButton);
   rows[id]=row;
  }
  const style=doc.createElement('style');style.textContent='.cast-row{touch-action:none;cursor:grab!important}.cast-row:active{cursor:grabbing!important}.cast-entry:hover{transform:none!important}.adjust-active{outline:2px dashed #9b78b2!important;outline-offset:-3px}.adjust-image{position:absolute;max-width:none!important;max-height:none!important;width:auto!important;transform:translate(-50%,-50%);pointer-events:none;user-select:none;z-index:3}.identity,.row-number{pointer-events:none}.cast-select{pointer-events:none}';doc.head.append(style);
  // 列表使用正式 CSS，等待字體與排版穩定後換算原圖的實際位置。
  await doc.fonts.ready;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  for(const id of ids){
   const row=rows[id],svg=row.querySelector('.eyes'),vb=svg.viewBox.baseVal,rb=row.getBoundingClientRect(),sb=svg.getBoundingClientRect();
   const scale=Math.min(sb.width/vb.width,sb.height/vb.height),left=sb.left-rb.left+(sb.width-vb.width*scale)/2-vb.x*scale,top=sb.top-rb.top+(sb.height-vb.height*scale)/2-vb.y*scale;
   defaults[id]={x:round((left+1000*scale)/rb.width*100),y:round((top+1000*scale)/rb.height*100),baseHeight:round(2000*scale/rb.height*100),scale:100};
   const im=doc.createElement('img');im.className='adjust-image';im.src=`assets/${id}-artist-v1.png`;im.alt=id+' 調整預覽';im.draggable=false;svg.replaceWith(im);images[id]=im;
   row.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();select(id);row.setPointerCapture(e.pointerId);const r=row.getBoundingClientRect(),start={px:e.clientX,py:e.clientY,x:state[id].x,y:state[id].y};
    const move=ev=>{state[id].x=Math.max(-100,Math.min(200,start.x+(ev.clientX-start.px)/r.width*100));state[id].y=Math.max(-500,Math.min(500,start.y+(ev.clientY-start.py)/r.height*100));sync();render();};
    const end=()=>{row.removeEventListener('pointermove',move);row.removeEventListener('pointerup',end);row.removeEventListener('pointercancel',end);row.removeEventListener('lostpointercapture',end);};
    row.addEventListener('pointermove',move);row.addEventListener('pointerup',end);row.addEventListener('pointercancel',end);row.addEventListener('lostpointercapture',end);
   });
   row.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();select(id);const step=e.shiftKey?1:.1,key=e.key==='ArrowLeft'||e.key==='ArrowRight'?'x':'y',dir=e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1;state[id][key]=Math.max(key==='x'?-100:-500,Math.min(key==='x'?200:500,state[id][key]+step*dir));sync();render();});
  }
  // 預覽中的點擊只用來選擇角色，不開啟名簿導覽或點單流程。
  doc.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const row=e.target.closest('[data-cast]');if(row)select(row.dataset.cast);},true);
  state=structuredClone(defaults);
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(valid(saved))state=saved;}catch{}
  ready=true;$('fields').disabled=false;$('copy').disabled=false;$('download').disabled=false;select(selected);render();
 });
 document.querySelectorAll('[data-cast]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.cast)));
 for(const key of ['x','y','scale'])for(const suffix of ['Range','Number'])$(key+suffix).addEventListener('input',e=>{if(!ready||e.target.value==='')return;const n=Number(e.target.value);if(!Number.isFinite(n)||n<Number(e.target.min)||n>Number(e.target.max))return;state[selected][key]=n;sync();render();});
 $('resetOne').onclick=()=>{state[selected]=structuredClone(defaults[selected]);sync();render();$('status').textContent='已還原這位角色。';};
 $('resetAll').onclick=()=>{state=structuredClone(defaults);sync();render();$('status').textContent='三位角色都已還原。';};
 $('previewWidth').onchange=()=>{$('preview').style.width=$('previewWidth').value+'px';render();};
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('output').value);$('status').textContent='已複製三位設定，直接貼到對話裡即可。';}catch{$('output').focus();$('output').select();$('status').textContent='已選取設定文字，請按 Ctrl+C，或在手機上選擇複製。';}};
 $('download').onclick=()=>{const url=URL.createObjectURL(new Blob([$('output').value],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='tiny-tavern-portraits.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();

