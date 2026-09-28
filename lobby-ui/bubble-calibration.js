/* v244：花框採用使用者的 2／8／18 字校正值，原始繪師圖案保持不變。 */
(() => {
'use strict';
const common={maxChars:18,textOffsetX:0,textOffsetY:0,textWidthPercent:100,textHeightPercent:100};
const anchors=[
 {count:2,offsetX:.5,offsetY:24.5,widthPercent:97,heightPercent:108,fontSize:13.5,lineHeight:1.15,maxWidth:109},
 {count:8,offsetX:.5,offsetY:24.5,widthPercent:129,heightPercent:154.05,fontSize:13,lineHeight:1.15,maxWidth:167.12},
 {count:18,offsetX:4.01,offsetY:26.05,widthPercent:158.71,heightPercent:132.49,fontSize:10,lineHeight:1.3,maxWidth:141.26}
];
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh-Hant',{granularity:'grapheme'}):null;
const characters=text=>segmenter?[...segmenter.segment(String(text||''))].map(x=>x.segment):Array.from(String(text||''));
const clip=text=>characters(text).slice(0,18).join('');
function settings(text){
 const count=characters(clip(text)).length;
 let a=anchors[0],b=a;
 if(count>2){a=count<=8?anchors[0]:anchors[1];b=count<=8?anchors[1]:anchors[2];}
 const t=a===b?0:Math.max(0,Math.min(1,(count-a.count)/(b.count-a.count))),s={...common};
 for(const key of Object.keys(a))if(key!=='count')s[key]=a[key]+(b[key]-a[key])*t;
 return s;
}
let textMeasure;
function getMeasure(){
 if(!textMeasure){textMeasure=document.createElement('span');textMeasure.className='tt-bubble-measure';textMeasure.setAttribute('aria-hidden','true');document.body.append(textMeasure);}
 return textMeasure;
}
function drawGrowingFrame(canvas,w,h,s,base,S){
 const r=S.r0*S.kmin;
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
function render(original,text,S,image){
 const originalText=original.querySelector('.bubT');
 const base={width:parseFloat(original.style.width),height:parseFloat(original.style.height),left:parseFloat(originalText.style.left),right:parseFloat(originalText.style.right),top:parseFloat(originalText.style.top),bottom:parseFloat(originalText.style.bottom),canvas:original.querySelector('canvas')};
 if(!base.canvas)throw new Error('花框原始素材未就緒');
 const s=settings(text),bubble=document.createElement('div'),canvas=document.createElement('canvas'),box=document.createElement('i'),span=document.createElement('span');
 bubble.className='bub tt-calibrated-bubble';canvas.className='tt-bubble-frame';box.className='bubT';box.append(span);bubble.append(canvas,box);
 function paint(){
  const measure=getMeasure(),value=clip(text)||' ';
  const paddingLeft=base.left*s.widthPercent/100,paddingRight=base.right*s.widthPercent/100,paddingTop=base.top*s.heightPercent/100,paddingBottom=base.bottom*s.heightPercent/100;
  Object.assign(measure.style,{fontSize:s.fontSize+'px',lineHeight:String(s.lineHeight),width:'max-content'});measure.textContent=value;
  const natural=measure.offsetWidth;
  const w=Math.min(s.maxWidth,Math.max(base.width*s.widthPercent/100,natural*100/s.textWidthPercent+paddingLeft+paddingRight+2));
  const tw=Math.max(12,Math.min(w-8,(w-paddingLeft-paddingRight)*s.textWidthPercent/100));measure.style.width=tw+'px';
  const needed=measure.offsetHeight,h=Math.max(base.height*s.heightPercent/100,paddingTop+paddingBottom+(needed+4)*100/s.textHeightPercent+Math.abs(s.textOffsetY)*2);
  const th=Math.max(needed,(h-paddingTop-paddingBottom)*s.textHeightPercent/100),tx=(paddingLeft+w-paddingRight)/2,ty=(paddingTop+h-paddingBottom)/2;
  bubble.style.setProperty('--tt-bubble-x',s.offsetX+'px');bubble.style.setProperty('--tt-bubble-top',(s.offsetY-h)+'px');
  bubble.style.width=w+'px';bubble.style.height=h+'px';
  drawGrowingFrame(canvas,w,h,s,base,S);
  Object.assign(box.style,{left:(tx-tw/2+s.textOffsetX)+'px',top:(ty-th/2+s.textOffsetY)+'px',width:tw+'px',height:th+'px'});
  span.textContent=value;span.style.fontSize=s.fontSize+'px';span.style.lineHeight=String(s.lineHeight);
 }
 paint();
 if(image&&!image.complete)image.addEventListener('load',()=>{if(bubble.isConnected)paint();},{once:true});
 if(document.fonts.status!=='loaded')document.fonts.ready.then(()=>{if(bubble.isConnected)paint();});
 return bubble;
}
function bindInput(input){
 let composing=false;
 const update=()=>{if(!composing)input.value=clip(input.value);};
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;update();});
 input.addEventListener('input',update);
}
window.TTBubbleCalibration={clip,characters,settings,render,bindInput};
})();
