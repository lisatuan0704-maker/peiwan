/* 聊天貼圖沿用現有訊息通道，只辨識固定目錄內的貼圖代碼。 */
(() => {
'use strict';
const catalog=window.TTStickerCatalog,approved=window.TTStickerApproved;
const byId=new Map(catalog.map(item=>[item.id,item]));
const asset=item=>'tavern-ui/'+item.asset;
function encode(id){return byId.has(id)?'[貼圖:'+id+']':null;}
function decode(text){if(typeof text!=='string')return null;const match=/^\[貼圖:(sticker-\d{2})\]$/.exec(text);return match?byId.get(match[1])||null:null;}
function picture(item,className){const img=document.createElement('img');img.src=asset(item);img.alt=item.name+'貼圖';img.className=className;img.draggable=false;return img;}
function render(item){
 const b=document.createElement('div');b.className='bub tt-chat-sticker';b.setAttribute('role','img');b.setAttribute('aria-label',item.name+'貼圖');
 b.style.setProperty('--sticker-width',approved.width+'px');b.style.setProperty('--sticker-x',approved.offsetX+'px');b.style.setProperty('--sticker-top',(approved.offsetY-approved.width)+'px');
 b.style.setProperty('--sticker-padding',approved.width*approved.paddingPercent/100+'px');b.style.setProperty('--sticker-radius',approved.width*approved.cornerRadiusPercent/100+'px');b.style.setProperty('--sticker-tail',approved.width*approved.tailPercent/100+'px');
 b.style.setProperty('--sticker-entry',approved.entryDurationMs+'ms');
 const visual=document.createElement('div');visual.className='tt-sticker-visual';const plate=document.createElement('div');plate.className='tt-sticker-plate';plate.setAttribute('aria-hidden','true');visual.append(plate,picture(item,'tt-sticker-art'));b.append(visual);return b;
}
function logImage(item){return picture(item,'tt-sticker-log');}
function mount(send){
 const row=document.getElementById('chatrow');if(!row||document.getElementById('ttStickerButton'))return;
 const trigger=document.createElement('button');trigger.id='ttStickerButton';trigger.type='button';trigger.title='聊天貼圖';trigger.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8l-7 7Z"/><path d="M14 21v-4a3 3 0 0 1 3-3h4M8 9h.01M15 9h.01M8 13q3 4 6 0"/></svg>';trigger.setAttribute('aria-label','發送聊天貼圖');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','ttStickerPicker');
 const panel=document.createElement('section');panel.id='ttStickerPicker';panel.hidden=true;panel.setAttribute('aria-label','聊天貼圖選單');
 const header=document.createElement('div');header.className='tt-sticker-heading';const title=document.createElement('b');title.textContent='聊天貼圖';const hint=document.createElement('span');hint.textContent='點一下發送';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','關閉貼圖選單');header.append(title,hint,close);
 const grid=document.createElement('div');grid.className='tt-sticker-grid';
 const status=document.createElement('p');status.className='tt-sticker-status';status.setAttribute('role','status');
 function hide(focus){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus({preventScroll:true});}
 for(const item of catalog){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','發送'+item.name+'貼圖');button.append(picture(item,'tt-sticker-thumb'));const label=document.createElement('span');label.textContent=item.name;button.append(label);button.onclick=()=>{const result=send(encode(item.id));if(result!==false){hide(false);trigger.focus({preventScroll:true});}else status.textContent='未能送出，請先查看聊天提示。';};grid.append(button);}
 panel.append(header,grid,status);row.prepend(trigger);row.append(panel);
 trigger.onclick=()=>{const open=panel.hidden;panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));status.textContent='';if(open)grid.querySelector('button').focus({preventScroll:true});};close.onclick=()=>hide(true);
 for(const name of ['keydown','keyup'])row.addEventListener(name,event=>{event.stopPropagation();if(name==='keydown'&&event.key==='Escape'){event.preventDefault();hide(true);}});
 document.addEventListener('pointerdown',event=>{if(!row.contains(event.target))hide(false);});
}
window.TTChatStickers={encode,decode,render,logImage,mount,durationMs:approved.durationSeconds*1000};
})();
