/* 獨立貼圖校正頁：只使用原始素材與本機暫存，不連接正式聊天或帳號。 */
(() => {
'use strict';
const $=id=>document.getElementById(id),catalog=window.TTStickerCatalog,storageKey='tt-sticker-calibration-v1';
const spec={offsetX:['左右位置',-240,240,.5,'0 對齊小人中心；負數往左，正數往右。'],offsetY:['上下位置',-240,180,.5,'貼圖底部相對小人畫布頂部；負數往上，正數往下。'],width:['貼圖大小',24,280,1,'等比例縮放，寬度與高度相同，原圖不裁切。'],durationSeconds:['停留秒數',1,15,.5,'按「試播一次」查看這張貼圖的顯示時間。']};
const defaults=()=>Object.fromEntries(catalog.map(c=>[c.id,{offsetX:0,offsetY:-8,width:96,durationSeconds:6}]));
let surface='white-bubble',settings=defaults(),selected=catalog[0].id,drag=null,playFrame=0,playStart=0,saveTimer;
const round=n=>Math.round(n*100)/100;
const clamp=(key,n)=>round(Math.max(spec[key][1],Math.min(spec[key][2],n)));
function exportData(){return {format:'tiny-tavern-sticker-calibration',version:2,sourceVersion:244,units:'lobby-css-px',reference:{characterCanvasSize:128,positionAnchor:'character-canvas-top-center',stickerAnchor:'bottom-center',positiveX:'right',positiveY:'down',preserveAspectRatio:true},appearance:{surface,animation:'pop',paddingPercent:8,cornerRadiusPercent:16,tailPercent:8,entryDurationMs:320},preview:{selected,zoom:Number($('zoom').value)},stickers:Object.fromEntries(catalog.map(c=>[c.id,{...c,...settings[c.id]}]))};}
function parseConfig(text){
 const value=JSON.parse(text.replace(/&#x20;/g,' '));
 if(value.format!=='tiny-tavern-sticker-calibration'||![1,2].includes(value.version)||!value.stickers)throw new Error('這不是貼圖校正設定');
 const nextSurface=value.version===1?'white-bubble':value.appearance?.surface;if(!['white-bubble','transparent'].includes(nextSurface))throw new Error('貼圖底板設定無效');
 const next={};for(const item of catalog){const frame=value.stickers[item.id];if(!frame)throw new Error('缺少 '+item.name);next[item.id]={};for(const key of Object.keys(spec)){const n=frame[key];if(typeof n!=='number'||!Number.isFinite(n)||n<spec[key][1]||n>spec[key][2])throw new Error(item.name+'的'+spec[key][0]+'超出範圍');next[item.id][key]=n;}}
 return {surface:nextSurface,settings:next,selected:catalog.some(c=>c.id===value.preview?.selected)?value.preview.selected:catalog[0].id};
}
function sync(except){$('surface').value=surface;for(const key of Object.keys(spec))for(const suffix of ['Number','Range']){const el=$(key+suffix);if(el!==except)el.value=settings[selected][key];}}
function layout(){
 if(drag)return;const s=settings[selected],left=350+s.offsetX-s.width/2,top=255+s.offsetY-s.width;
 const pad=surface==='white-bubble'?s.width*.08:0;
 const x0=Math.min(270,left-pad-20),x1=Math.max(430,left+s.width+pad+20),y0=Math.min(210,top-pad-20),y1=Math.max(420,255+s.offsetY+pad*2+20);
 const fit=$('viewport').clientWidth/700,scale=Math.min(fit*Number($('zoom').value),($('viewport').clientWidth-28)/(x1-x0),($('viewport').clientHeight-28)/(y1-y0)),cx=(x0+x1)/2,cy=(y0+y1)/2;
 $('scene').style.transformOrigin=cx+'px '+cy+'px';$('scene').style.transform='translate(-'+cx+'px,-'+cy+'px) scale('+scale+')';
}
function draw(){
 const s=settings[selected],item=catalog.find(c=>c.id===selected),index=catalog.indexOf(item);
 if($('stickerImage').getAttribute('src')!==item.asset)$('stickerImage').src=item.asset;
 $('stickerImage').alt=item.name+'貼圖';
 $('sticker').dataset.surface=surface;$('sticker').style.setProperty('--plate-padding',s.width*.08+'px');$('sticker').style.setProperty('--plate-radius',s.width*.16+'px');$('sticker').style.setProperty('--plate-tail',s.width*.08+'px');
 Object.assign($('sticker').style,{width:s.width+'px',height:s.width+'px',left:(350+s.offsetX-s.width/2)+'px',top:(255+s.offsetY-s.width)+'px'});
 $('stickerName').textContent=String(index+1).padStart(2,'0')+' '+item.name;$('sourceFile').textContent=item.sourceFile;
 for(const b of $('gallery').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.id===selected));
 $('sizeInfo').textContent='貼圖 '+s.width+' × '+s.width+'｜小人畫布 128 × 128｜停留 '+s.durationSeconds+' 秒';
 $('output').value=JSON.stringify(exportData(),null,2);layout();
}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(exportData()));$('saved').textContent='已暫存 10 張設定，重新開啟仍會保留。';}catch(e){$('saved').textContent='無法暫存，請複製或下載設定保存。';}},120);}
function pop(){const visual=$('stickerVisual');visual.classList.remove('pop');void visual.offsetWidth;visual.classList.add('pop');}
function stop(){ $('stickerVisual').classList.remove('pop');cancelAnimationFrame(playFrame);playFrame=0;$('sticker').style.opacity='1';$('scene').classList.remove('playing');$('previewState').textContent='調整模式・持續顯示';$('timer').textContent='調整時貼圖會一直顯示。';}
function play(){
 stop();pop();$('scene').classList.add('playing');$('previewState').textContent='模擬發送・僅本頁';playStart=performance.now();const duration=settings[selected].durationSeconds*1000;
 function tick(now){const elapsed=now-playStart,remaining=Math.max(0,(duration-elapsed)/1000);$('timer').textContent='剩餘 '+remaining.toFixed(1)+' 秒';$('sticker').style.opacity=String(Math.min(1,Math.max(0,(duration-elapsed)/180)));if(elapsed<duration)playFrame=requestAnimationFrame(tick);else{playFrame=0;$('timer').textContent='已播完，按「回到調整」繼續。';$('previewState').textContent='試播結束';}}
 playFrame=requestAnimationFrame(tick);
}
for(const [index,item] of catalog.entries()){
 const button=document.createElement('button');button.type='button';button.className='tile';button.dataset.id=item.id;button.setAttribute('aria-label',String(index+1).padStart(2,'0')+' '+item.name);button.setAttribute('aria-pressed','false');
 const img=document.createElement('img');img.src=item.asset;img.alt='';img.draggable=false;const label=document.createElement('span');label.textContent=String(index+1).padStart(2,'0')+' '+item.name;button.append(img,label);$('gallery').append(button);
 button.onclick=()=>{stop();selected=item.id;sync();draw();pop();save();};
}
for(const [key,[title,min,max,step,hint]] of Object.entries(spec)){
 const div=document.createElement('div');div.className='control';div.innerHTML='<label for="'+key+'Number">'+title+'<input id="'+key+'Number" type="number" aria-label="'+title+'數值" min="'+min+'" max="'+max+'" step="'+step+'"></label><input id="'+key+'Range" aria-label="'+title+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'"><small>'+hint+'</small>';$('fields').append(div);
 for(const suffix of ['Number','Range']){const input=$(key+suffix);input.addEventListener('input',()=>{if(input.value==='')return;const n=Number(input.value);if(!Number.isFinite(n))return;stop();settings[selected][key]=clamp(key,n);sync(input);draw();save();});input.addEventListener('change',()=>sync());}
}
function startDrag(event,kind){
 if(event.button!==0)return;event.preventDefault();stop();const s=settings[selected],scale=$('scene').getBoundingClientRect().width/700;drag={kind,x:event.clientX,y:event.clientY,scale,initial:{...s}};event.currentTarget.setPointerCapture(event.pointerId);$('sticker').focus({preventScroll:true});
}
$('sticker').addEventListener('pointerdown',event=>{if(event.target!==$('resize'))startDrag(event,'move');});
$('resize').addEventListener('pointerdown',event=>{event.stopPropagation();startDrag(event,'resize');});
$('sticker').addEventListener('pointermove',event=>{
 if(!drag)return;const dx=(event.clientX-drag.x)/drag.scale,dy=(event.clientY-drag.y)/drag.scale,s=settings[selected],initial=drag.initial;
 if(drag.kind==='move'){s.offsetX=clamp('offsetX',initial.offsetX+dx);s.offsetY=clamp('offsetY',initial.offsetY+dy);}else{const w=clamp('width',initial.width+(dx+dy)/2),delta=w-initial.width;s.width=w;s.offsetX=clamp('offsetX',initial.offsetX+delta/2);s.offsetY=clamp('offsetY',initial.offsetY+delta);}
 sync();draw();save();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('sticker').addEventListener(type,()=>{drag=null;layout();});
$('sticker').addEventListener('keydown',event=>{if(event.target!==$('sticker'))return;const step=event.shiftKey?5:1,map={ArrowLeft:['offsetX',-step],ArrowRight:['offsetX',step],ArrowUp:['offsetY',-step],ArrowDown:['offsetY',step]};if(map[event.key]){event.preventDefault();stop();const [key,delta]=map[event.key];settings[selected][key]=clamp(key,settings[selected][key]+delta);sync();draw();save();}});
$('play').onclick=play;$('stop').onclick=stop;
$('applyAll').onclick=()=>{const s=settings[selected];for(const item of catalog)Object.assign(settings[item.id],{offsetX:s.offsetX,offsetY:s.offsetY,width:s.width});draw();save();$('status').textContent='已將這張的位置與大小套用全部；各張停留秒數保留。';};
$('reset').onclick=()=>{stop();settings[selected]=defaults()[selected];sync();draw();save();$('status').textContent='已還原這張貼圖。';};
$('surface').onchange=()=>{stop();surface=$('surface').value;draw();pop();save();};
$('zoom').onchange=()=>{layout();draw();save();};$('guides').onchange=()=>$('scene').classList.toggle('no-guides',!$('guides').checked);
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('output').value);$('status').textContent='已複製 10 張貼圖設定，貼給我就好。';}catch(e){$('output').focus();$('output').select();$('status').textContent='請複製已選取的設定文字。';}};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([$('output').value],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='tiny-tavern-sticker-calibration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='設定已下載。';};
$('import').onclick=()=>{try{const parsed=parseConfig($('importText').value);stop();settings=parsed.settings;selected=parsed.selected;surface=parsed.surface;sync();draw();save();$('status').textContent='已載入 10 張貼圖設定。';}catch(e){$('status').textContent='無法載入：'+e.message+'，原本設定保留。';}};
$('stickerImage').addEventListener('error',()=>{$('status').textContent='這張原圖尚未載入，請重新整理再試。';});
try{const saved=localStorage.getItem(storageKey);if(saved){const parsed=parseConfig(saved);settings=parsed.settings;selected=parsed.selected;surface=parsed.surface;}}catch(e){$('status').textContent='暫存無法讀取，請匯入之前下載的設定。';}
sync();draw();new ResizeObserver(layout).observe($('viewport'));
})();
