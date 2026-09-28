/* 校正器只讀取素材，設定僅存本機；不連接帳號、聊天或付款服務。 */
(() => {
'use strict';
const $=id=>document.getElementById(id), source=window.TTBubbleSource;
const storageKey='tt-bubble-calibration-v1';
const spec={
 offsetX:['左右位置',-160,160,.5,'0 對齊小人中心；負數往左、正數往右。'],
 offsetY:['上下位置',-140,100,.5,'負數往上，正數往下；以小人畫布上緣為基準。'],
 widthPercent:['短句框寬（%）',40,300,1,'短句的基本寬度；長句最多增加到最大寬度。'],
 heightPercent:['基本框高（%）',40,300,1,'設定最小高度；換行時會自動向上增高。'],
 fontSize:['文字大小',6,30,.5,'文字大小獨立於框的拉伸比例。'],
 lineHeight:['文字行距',1,2,.05,'每行高度是文字大小的倍數。'],
 maxWidth:['最大寬度',100,320,1,'到這個寬度就換行，只往上增加高度。'],
 maxChars:['訊息字數上限',1,18,1,'每則最多 18 字，超過上限不再輸入。'],
 textOffsetX:['框內文字左右',-60,60,.5,'負數往左，正數往右。'],
 textOffsetY:['框內文字上下',-60,60,.5,'負數往上，正數往下。'],
 textWidthPercent:['文字範圍寬度（%）',30,180,1,'以原有文字區為 100%，虛線表示範圍。'],
 textHeightPercent:['文字範圍高度（%）',30,180,1,'文字範圍可以獨立加高。']
};
let settings={},defaults={},selected='10',ready=false,base=null,drag=null,saveTimer,composing=false;
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh-Hant',{granularity:'grapheme'}):null;
const characters=text=>segmenter?[...segmenter.segment(text)].map(x=>x.segment):Array.from(text);
const textMeasure=document.createElement('span');textMeasure.id='textMeasure';document.body.append(textMeasure);
function round(n){return Math.round(n*100)/100;}
function clamp(key,value){const s=spec[key];return round(Math.max(s[1],Math.min(s[2],value)));}
function measure(key,text){
 $('measure').replaceChildren();const node=source.render($('measure'),key,text);
 const t=node.querySelector('.bubT'),cv=node.querySelector('canvas');
 if(!cv)throw new Error('對話框合成失敗');
 return {width:parseFloat(node.style.width),height:parseFloat(node.style.height),left:parseFloat(t.style.left),right:parseFloat(t.style.right),top:parseFloat(t.style.top),bottom:parseFloat(t.style.bottom),canvas:cv};
}
function buildControls(){
 Object.entries(spec).forEach(([key,[title,min,max,step,hint]],index)=>{
 const label=document.createElement('div');label.className='control';
 label.innerHTML='<label class="control-head" for="'+key+'Number">'+title+'<input id="'+key+'Number" aria-label="'+title+'數值" type="number" min="'+min+'" max="'+max+'" step="'+step+'"></label><input id="'+key+'Range" aria-label="'+title+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'"><small>'+hint+'</small>';
 $(index<8?'mainControls':'advancedControls').append(label);
 for(const suffix of ['Number','Range'])$(key+suffix).addEventListener('input',event=>{
  if(!ready||event.target.value==='')return;const value=Number(event.target.value);if(!Number.isFinite(value))return;
  settings[selected][key]=clamp(key,value);syncControls(event.target);draw();save();
 });
 });
}
function syncControls(except){for(const key of Object.keys(spec))for(const suffix of ['Number','Range']){const el=$(key+suffix);if(el!==except)el.value=settings[selected][key];}}
function layout(){
 const fit=$('viewport').clientWidth/700,zoom=Number($('zoom').value);
 $('scene').style.transform='translate(-50%,-62.5%) scale('+fit*zoom+')';
}
// 只延展框的中間與邊線，四角使用短句原框的固定裝飾區。
function drawGrowingFrame(canvas,w,h,s){
 const S=source.data[selected].g9,r=S.r0*S.kmin;
 let l=Math.round(S.L*r),rr=Math.round(S.R*r),t,bb;
 if(S.mode==='h3'){t=base.top;bb=base.bottom;}else{
  t=Math.round(S.T*r);bb=Math.round(S.B*r);
  const ht=base.top+base.bottom+(S.lh||13)+8;
  if(ht<t+bb+2){const q=Math.max(S.vq||.75,(ht-2)/(t+bb));t=Math.round(t*q);bb=Math.round(bb*q);}
 }
 const sx=[0,l,base.width-rr,base.width],sy=[0,t,base.height-bb,base.height];
 let dx=l*s.widthPercent/100,dr=rr*s.widthPercent/100,dt=t*s.heightPercent/100,db=bb*s.heightPercent/100;
 const qx=Math.min(1,(w-2)/(dx+dr)),qy=Math.min(1,(h-2)/(dt+db));dx*=qx;dr*=qx;dt*=qy;db*=qy;
 const xx=[0,dx,w-dr,w],yy=[0,dt,h-db,h];
 canvas.width=Math.ceil(w*3);canvas.height=Math.ceil(h*3);const g=canvas.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  const x0=Math.round(xx[x]*3),x1=Math.round(xx[x+1]*3),y0=Math.round(yy[y]*3),y1=Math.round(yy[y+1]*3);
  g.drawImage(base.canvas,sx[x]*3,sy[y]*3,(sx[x+1]-sx[x])*3,(sy[y+1]-sy[y])*3,x0,y0,x1-x0,y1-y0);
 }
}
function draw(){
 if(!ready)return;const s=settings[selected],raw=characters($('sampleText').value);
 const text=raw.slice(0,s.maxChars).join('')||' ';base=measure(selected,'安安');
 const paddingLeft=base.left*s.widthPercent/100,paddingRight=base.right*s.widthPercent/100;
 const paddingTop=base.top*s.heightPercent/100,paddingBottom=base.bottom*s.heightPercent/100;
 Object.assign(textMeasure.style,{fontSize:s.fontSize+'px',lineHeight:String(s.lineHeight),width:'max-content'});textMeasure.textContent=text;
 const natural=textMeasure.offsetWidth;
 const w=Math.min(s.maxWidth,Math.max(base.width*s.widthPercent/100,natural*100/s.textWidthPercent+paddingLeft+paddingRight+2));
 const tw=Math.max(12,Math.min(w-8,(w-paddingLeft-paddingRight)*s.textWidthPercent/100));
 textMeasure.style.width=tw+'px';
 const needed=textMeasure.offsetHeight;
 const h=Math.max(base.height*s.heightPercent/100,paddingTop+paddingBottom+(needed+4)*100/s.textHeightPercent+Math.abs(s.textOffsetY)*2);
 const th=Math.max(needed,(h-paddingTop-paddingBottom)*s.textHeightPercent/100);
 const tx=(paddingLeft+w-paddingRight)/2,ty=(paddingTop+h-paddingBottom)/2;
 const bubble=$('bubble');bubble.style.left=(350+s.offsetX-w/2)+'px';bubble.style.top=(255+s.offsetY-h)+'px';bubble.style.width=w+'px';bubble.style.height=h+'px';
 drawGrowingFrame($('frameCanvas'),w,h,s);
 Object.assign($('textBox').style,{left:(tx-tw/2+s.textOffsetX)+'px',top:(ty-th/2+s.textOffsetY)+'px',width:tw+'px',height:th+'px'});
 const span=$('bubbleText');span.textContent=text;span.style.fontSize=s.fontSize+'px';span.style.lineHeight=String(s.lineHeight);span.style.maxHeight='none';
 $('frameName').textContent=source.data[selected].name;
 $('charCount').textContent=raw.length+' / '+s.maxChars+' 字'+(raw.length>=s.maxChars?'・已達上限':'');
 const messages=[];if(raw.length>s.maxChars)messages.push('預覽只顯示前 '+s.maxChars+' 字；原本的測試文字仍保留。');
 if(tx-tw/2+s.textOffsetX<0||tx+tw/2+s.textOffsetX>w)messages.push('文字位置已超出框邊，請調整框內文字左右位置。');
 $('overflow').textContent=messages.join(' ');
 $('sizeInfo').textContent='目前框寬 '+round(w)+' / 上限 '+s.maxWidth+'，框高 '+round(h)+'；底部固定，換行向上長高。';
 // 近距離鏡頭若放不下長框，只縮小觀看倍率，校正數值保持不變。
 const fit=$('viewport').clientWidth/700,zoom=Number($('zoom').value),sceneHeight=Math.max(240,383-(255+s.offsetY-h)+36);
 const scale=Math.min(fit*zoom,($('viewport').clientHeight-24)/sceneHeight);
 const centerY=((255+s.offsetY-h)+383)/2;
 $('scene').style.transformOrigin='350px '+centerY+'px';
 $('scene').style.transform='translate(-350px,-'+centerY+'px) scale('+scale+')';
 $('output').value=JSON.stringify(exportData(),null,2);
}
function exportData(){return {format:'tiny-tavern-bubble-calibration',version:2,sourceVersion:241,units:'lobby-css-px',reference:{characterCanvasSize:128,positionAnchor:'character-canvas-top-center',bubbleAnchor:'bottom-center',positiveX:'right',positiveY:'down',sizing:'capped-width-wrap-grow-up-nine-slice',characterCounting:'grapheme',heightLimit:'message-character-limit',textSizing:'independent-font-size'},preview:{text:$('sampleText').value,zoom:Number($('zoom').value),viewportWidth:innerWidth},frames:Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,{name:source.data[key].name,...value}]))};}
function save(){
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(exportData()));$('saved').textContent='已暫存於此瀏覽器；重新開啟仍會保留。';}catch(e){$('saved').textContent='瀏覽器未允許暫存，請複製或下載設定保存。';}},150);
}
function parseConfig(text){
 const value=JSON.parse(text);if(value.format!=='tiny-tavern-bubble-calibration'||![1,2].includes(value.version)||value.sourceVersion!==241||!value.frames)throw new Error('設定格式或版本不符');
 const next={};for(const key of Object.keys(defaults)){
  const frame=value.frames[key];if(!frame)throw new Error('設定缺少 '+source.data[key].name);
  next[key]={};for(const name of Object.keys(spec)){
   const n=value.version===1&&['maxWidth','maxChars'].includes(name)?defaults[key][name]:frame[name];if(typeof n!=='number'||!Number.isFinite(n)||n<spec[name][1]||n>spec[name][2]||(name==='maxChars'&&!Number.isInteger(n)))throw new Error('數值無效：'+name);
   next[key][name]=n;
  }
 }return {settings:next,preview:value.preview};
}
function startDrag(event,kind){
 if(!ready||event.button!==0)return;event.preventDefault();const s=settings[selected];
 const scale=$('scene').getBoundingClientRect().width/700;
 drag={kind,x:event.clientX,y:event.clientY,scale,initial:{...s},w:parseFloat($('bubble').style.width),h:parseFloat($('bubble').style.height)};
 event.currentTarget.setPointerCapture(event.pointerId);$('bubble').focus({preventScroll:true});
}
$('bubble').addEventListener('pointerdown',event=>{if(event.target!==$('resize'))startDrag(event,'move');});
$('resize').addEventListener('pointerdown',event=>{event.stopPropagation();startDrag(event,'resize');});
$('bubble').addEventListener('pointermove',event=>{
 if(!drag)return;const dx=(event.clientX-drag.x)/drag.scale,dy=(event.clientY-drag.y)/drag.scale,s=settings[selected];
 if(drag.kind==='move'){s.offsetX=clamp('offsetX',drag.initial.offsetX+dx);s.offsetY=clamp('offsetY',drag.initial.offsetY+dy);}
 else{
  let nw=drag.w+dx,nh=drag.h+dy;if($('lockRatio').checked){const ratio=Math.abs(dx/drag.w)>=Math.abs(dy/drag.h)?nw/drag.w:nh/drag.h;nw=drag.w*ratio;nh=drag.h*ratio;}
  s.widthPercent=clamp('widthPercent',nw/base.width*100);s.heightPercent=clamp('heightPercent',nh/base.height*100);
  s.maxWidth=clamp('maxWidth',nw);
  // 拉伸也維持框底部位置，避免框往下壓住小人。
 }
 syncControls();draw();save();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('bubble').addEventListener(type,()=>{drag=null;});
$('bubble').addEventListener('keydown',event=>{
 if(!ready||event.target!==$('bubble'))return;const step=event.shiftKey?5:1,map={ArrowLeft:['offsetX',-step],ArrowRight:['offsetX',step],ArrowUp:['offsetY',-step],ArrowDown:['offsetY',step]};
 if(map[event.key]){event.preventDefault();const [key,delta]=map[event.key];settings[selected][key]=clamp(key,settings[selected][key]+delta);syncControls();draw();save();}
});
$('frame').onchange=()=>{selected=$('frame').value;syncControls();draw();};
function updateText(){if(!ready||composing)return;const chars=characters($('sampleText').value),limit=settings[selected].maxChars;if(chars.length>limit)$('sampleText').value=chars.slice(0,limit).join('');draw();save();}
$('sampleText').addEventListener('compositionstart',()=>{composing=true;});
$('sampleText').addEventListener('compositionend',()=>{composing=false;updateText();});
$('sampleText').oninput=updateText;
$('zoom').onchange=()=>{layout();draw();save();};
$('guides').onchange=()=>$('scene').classList.toggle('no-guides',!$('guides').checked);
for(const button of document.querySelectorAll('[data-sample]'))button.onclick=()=>{$('sampleText').value=button.dataset.sample;updateText();};
$('reset').onclick=()=>{settings[selected]={...defaults[selected]};syncControls();draw();save();$('status').textContent='已還原這款。';};
$('resetAll').onclick=()=>{settings=structuredClone(defaults);syncControls();draw();save();$('status').textContent='已還原五款。';};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('output').value);$('status').textContent='已複製五款設定，直接貼到對話裡給我就好。';}catch(e){$('output').focus();$('output').select();$('status').textContent='請複製已選取的設定文字。';}};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([$('output').value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tiny-tavern-bubble-calibration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='設定已下載。';};
$('import').onclick=()=>{try{const parsed=parseConfig($('importText').value);settings=parsed.settings;syncControls();draw();save();$('status').textContent='已載入五款設定。';}catch(e){$('status').textContent='無法載入：'+e.message+'，原本設定未變更。';}};
buildControls();layout();new ResizeObserver(()=>{layout();draw();}).observe($('viewport'));
source.ready.then(async()=>{
 await document.fonts.ready;
 for(const key of Object.keys(source.data)){const m=measure(key,'安安');defaults[key]={offsetX:round(-.178*m.width),offsetY:-parseFloat(source.data[key].g.gap),widthPercent:100,heightPercent:100,fontSize:11,lineHeight:1.3,textOffsetX:0,textOffsetY:0,textWidthPercent:100,textHeightPercent:100,maxWidth:180,maxChars:18};}
 settings=structuredClone(defaults);
 try{const saved=localStorage.getItem(storageKey);if(saved){const parsed=parseConfig(saved);settings=parsed.settings;if(typeof parsed.preview?.text==='string')$('sampleText').value=parsed.preview.text.slice(0,180);}}catch(e){$('status').textContent='舊暫存無法讀取，已載入原始設定。';}
 ready=true;$('fields').disabled=false;$('copy').disabled=false;$('download').disabled=false;syncControls();draw();$('saved').textContent='可直接拖曳框，或使用右側數字微調。';
}).catch(()=>{$('status').textContent='素材未能載入，請重新整理後再試。';});
})();
