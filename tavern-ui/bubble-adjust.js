/* 校正器只讀取素材，設定僅存本機；不連接帳號、聊天或付款服務。 */
(() => {
'use strict';
const $=id=>document.getElementById(id), source=window.TTBubbleSource;
const storageKey='tt-bubble-calibration-v1';
const spec={
 offsetX:['左右位置',-160,160,.5,'0 對齊小人中心；負數往左、正數往右。'],
 offsetY:['上下位置',-140,100,.5,'負數往上，正數往下；以小人畫布上緣為基準。'],
 widthPercent:['框的寬度（%）',40,300,1,'只橫向拉伸框，不放大文字。'],
 heightPercent:['框的高度（%）',40,300,1,'只縱向拉伸框，不放大文字。'],
 fontSize:['文字大小',6,30,.5,'文字大小獨立於框的拉伸比例。'],
 lineHeight:['文字行距',1,2,.05,'每行高度是文字大小的倍數。'],
 textOffsetX:['框內文字左右',-60,60,.5,'負數往左，正數往右。'],
 textOffsetY:['框內文字上下',-60,60,.5,'負數往上，正數往下。'],
 textWidthPercent:['文字範圍寬度（%）',30,180,1,'以原有文字區為 100%，虛線表示範圍。'],
 textHeightPercent:['文字範圍高度（%）',30,180,1,'文字範圍可以獨立加高。'],
 maxLines:['最多顯示行數',1,8,1,'超出可用範圍會提示；不自動縮字。']
};
let settings={},defaults={},selected='10',ready=false,base=null,drag=null,saveTimer;
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
 $(index<6?'mainControls':'advancedControls').append(label);
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
function draw(){
 if(!ready)return;const text=$('sampleText').value||' ';base=measure(selected,text);const s=settings[selected];
 const w=base.width*s.widthPercent/100,h=base.height*s.heightPercent/100;
 const bubble=$('bubble');bubble.style.left=(350+s.offsetX-w/2)+'px';bubble.style.top=(255+s.offsetY-h)+'px';bubble.style.width=w+'px';bubble.style.height=h+'px';
 const canvas=$('frameCanvas');canvas.width=Math.ceil(w*3);canvas.height=Math.ceil(h*3);const g=canvas.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(base.canvas,0,0,canvas.width,canvas.height);
 const tw=(base.width-base.left-base.right)*s.widthPercent/100*s.textWidthPercent/100;
 const th=(base.height-base.top-base.bottom)*s.heightPercent/100*s.textHeightPercent/100;
 const tx=(base.left+(base.width-base.left-base.right)/2)*s.widthPercent/100;
 const ty=(base.top+(base.height-base.top-base.bottom)/2)*s.heightPercent/100;
 const box=$('textBox');Object.assign(box.style,{left:(tx-tw/2+s.textOffsetX)+'px',top:(ty-th/2+s.textOffsetY)+'px',width:tw+'px',height:th+'px'});
 const span=$('bubbleText');span.textContent=text;span.style.fontSize=s.fontSize+'px';span.style.lineHeight=String(s.lineHeight);span.style.maxHeight=Math.min(th,s.fontSize*s.lineHeight*s.maxLines+4)+'px';
 $('frameName').textContent=source.data[selected].name;
 $('overflow').textContent=span.scrollHeight>Math.min(th,s.fontSize*s.lineHeight*s.maxLines+4)+1?'文字超出可用範圍：可加大框／文字範圍、縮小字體，或增加行數。':'';
 $('output').value=JSON.stringify(exportData(),null,2);
}
function exportData(){return {format:'tiny-tavern-bubble-calibration',version:1,sourceVersion:241,units:'lobby-css-px',reference:{characterCanvasSize:128,positionAnchor:'character-canvas-top-center',bubbleAnchor:'bottom-center',positiveX:'right',positiveY:'down',sizing:'source-v241-adaptive-frame-then-independent-xy-stretch',textSizing:'independent-font-size'},preview:{text:$('sampleText').value,zoom:Number($('zoom').value),viewportWidth:innerWidth},frames:Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,{name:source.data[key].name,...value}]))};}
function save(){
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(exportData()));$('saved').textContent='已暫存於此瀏覽器；重新開啟仍會保留。';}catch(e){$('saved').textContent='瀏覽器未允許暫存，請複製或下載設定保存。';}},150);
}
function parseConfig(text){
 const value=JSON.parse(text);if(value.format!=='tiny-tavern-bubble-calibration'||value.version!==1||value.sourceVersion!==241||!value.frames)throw new Error('設定格式或版本不符');
 const next={};for(const key of Object.keys(defaults)){
  const frame=value.frames[key];if(!frame)throw new Error('設定缺少 '+source.data[key].name);
  next[key]={};for(const name of Object.keys(spec)){
   const n=frame[name];if(typeof n!=='number'||!Number.isFinite(n)||n<spec[name][1]||n>spec[name][2]||(name==='maxLines'&&!Number.isInteger(n)))throw new Error('數值無效：'+name);
   next[key][name]=n;
  }
 }return {settings:next,preview:value.preview};
}
function startDrag(event,kind){
 if(!ready||event.button!==0)return;event.preventDefault();const s=settings[selected];
 const scale=$('scene').getBoundingClientRect().width/700;
 drag={kind,x:event.clientX,y:event.clientY,scale,initial:{...s},w:base.width*s.widthPercent/100,h:base.height*s.heightPercent/100};
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
  const newW=base.width*s.widthPercent/100,newH=base.height*s.heightPercent/100;
  s.offsetX=clamp('offsetX',drag.initial.offsetX+(newW-drag.w)/2);s.offsetY=clamp('offsetY',drag.initial.offsetY+newH-drag.h);
 }
 syncControls();draw();save();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('bubble').addEventListener(type,()=>{drag=null;});
$('bubble').addEventListener('keydown',event=>{
 if(!ready||event.target!==$('bubble'))return;const step=event.shiftKey?5:1,map={ArrowLeft:['offsetX',-step],ArrowRight:['offsetX',step],ArrowUp:['offsetY',-step],ArrowDown:['offsetY',step]};
 if(map[event.key]){event.preventDefault();const [key,delta]=map[event.key];settings[selected][key]=clamp(key,settings[selected][key]+delta);syncControls();draw();save();}
});
$('frame').onchange=()=>{selected=$('frame').value;syncControls();draw();};
$('sampleText').oninput=()=>{draw();save();};
$('zoom').onchange=()=>{layout();draw();save();};
$('guides').onchange=()=>$('scene').classList.toggle('no-guides',!$('guides').checked);
for(const button of document.querySelectorAll('[data-sample]'))button.onclick=()=>{$('sampleText').value=button.dataset.sample;draw();save();};
$('reset').onclick=()=>{settings[selected]={...defaults[selected]};syncControls();draw();save();$('status').textContent='已還原這款。';};
$('resetAll').onclick=()=>{settings=structuredClone(defaults);syncControls();draw();save();$('status').textContent='已還原五款。';};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('output').value);$('status').textContent='已複製五款設定，直接貼到對話裡給我就好。';}catch(e){$('output').focus();$('output').select();$('status').textContent='請複製已選取的設定文字。';}};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([$('output').value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tiny-tavern-bubble-calibration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='設定已下載。';};
$('import').onclick=()=>{try{const parsed=parseConfig($('importText').value);settings=parsed.settings;syncControls();draw();save();$('status').textContent='已載入五款設定。';}catch(e){$('status').textContent='無法載入：'+e.message+'，原本設定未變更。';}};
buildControls();layout();new ResizeObserver(layout).observe($('viewport'));
source.ready.then(async()=>{
 await document.fonts.ready;
 for(const key of Object.keys(source.data)){const m=measure(key,'安安');defaults[key]={offsetX:round(-.178*m.width),offsetY:-parseFloat(source.data[key].g.gap),widthPercent:100,heightPercent:100,fontSize:11,lineHeight:1.3,textOffsetX:0,textOffsetY:0,textWidthPercent:100,textHeightPercent:100,maxLines:3};}
 settings=structuredClone(defaults);
 try{const saved=localStorage.getItem(storageKey);if(saved){const parsed=parseConfig(saved);settings=parsed.settings;if(typeof parsed.preview?.text==='string')$('sampleText').value=parsed.preview.text.slice(0,180);}}catch(e){$('status').textContent='舊暫存無法讀取，已載入原始設定。';}
 ready=true;$('fields').disabled=false;$('copy').disabled=false;$('download').disabled=false;syncControls();draw();$('saved').textContent='可直接拖曳框，或使用右側數字微調。';
}).catch(()=>{$('status').textContent='素材未能載入，請重新整理後再試。';});
})();
