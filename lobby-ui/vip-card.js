/* v513 VIP 升級動圖（D 11/10 定稿：去背 GIF＝雜誌字卡〔名字頁籤＋VIP＋菱形數字＋等級名〕＋小人呼吸壓扁／頭髮擺動／眨眼＋兩顆星）。
   主機的 TT 發現老闆升上 VIP，寫 peiwan/vipCardReq/<闆卡> {lv,no,at}；老闆自己的大廳（這支）照他「現在」的闆卡穿搭與闆卡名字畫好，
   交到 peiwan/vipCard/<闆卡>/<等級>（規則第二十一批：只能交請畫的那一級、交過不能覆蓋）；TT 拿去在「酒館名人牆」發公告，發完刪掉。
   畫面上不出現任何東西（背景作業）。GIF 用 gifenc 1.0.3（jsdelivr）編碼：1 位元透明，Discord 深色淺色主題都沒有毛邊。
   試做檔在 C:\tinytavern\VIP升級動圖試做\v4雜誌字卡；改樣子時兩邊一起看。 */
(function(root){
'use strict';
const W=480,H=500,P=5,N=36,DELAY=70,TAU=Math.PI*2;
const VIP={1:['迎賓','#7E9FDC'],2:['熟客','#61B98A'],3:['常客','#E67FA6'],4:['摯友','#A183DE'],5:['貴賓','#E9B028']};
const INK='#2A1F52',CREAM='#FFF7EA',WHITE='#FFFFFF';
const F_TITLE='"TT Title","Tavern Numerals",sans-serif',F_NUM='"Tavern Numerals","TT Latin",sans-serif',F_ZH='"TT Huninn","Tavern Numerals",sans-serif',F_EN='"Tavern Numerals","TT Latin",sans-serif';
const GIFENC='https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js';
const G=n=>n==='db'?(typeof db!=='undefined'?db:null):n==='myKey'?(typeof myKey!=='undefined'?myKey:null):n==='ROOT'?(typeof ROOT!=='undefined'?ROOT:'peiwan'):null;

function shade(hex,k){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k)));return 'rgb('+f(r)+','+f(g)+','+f(b)+')';}
function poly(g,pts){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))g.lineTo(p[0],p[1]);g.closePath();}
function star4(g,x,y,r){const k=.3;g.beginPath();g.moveTo(x,y-r);g.quadraticCurveTo(x+r*k,y-r*k,x+r,y);g.quadraticCurveTo(x+r*k,y+r*k,x,y+r);g.quadraticCurveTo(x-r*k,y+r*k,x-r,y);g.quadraticCurveTo(x-r*k,y-r*k,x,y-r);g.closePath();}
function sparkle(g,x,y,r,col){
  const k=.32;star4(g,x,y,r);g.lineJoin='round';g.lineWidth=4;g.strokeStyle=INK;g.stroke();g.fillStyle=col;g.fill();
  const s=r*.42;g.beginPath();g.moveTo(x,y-s);g.quadraticCurveTo(x+s*k,y-s*k,x+s,y);g.quadraticCurveTo(x+s*k,y+s*k,x,y+s);g.quadraticCurveTo(x-s*k,y+s*k,x-s,y);g.quadraticCurveTo(x-s*k,y-s*k,x,y-s);g.fillStyle=WHITE;g.fill();
}
// 小人外面加一圈白邊（1 格），深色主題也看得清楚
function outline(src){
  const c=document.createElement('canvas');c.width=src.width+2;c.height=src.height+2;const g=c.getContext('2d');
  const w=document.createElement('canvas');w.width=src.width;w.height=src.height;const wg=w.getContext('2d');wg.drawImage(src,0,0);wg.globalCompositeOperation='source-in';wg.fillStyle=WHITE;wg.fillRect(0,0,w.width,w.height);
  for(const [x,y] of [[0,1],[2,1],[1,0],[1,2],[0,0],[2,2],[0,2],[2,0]])g.drawImage(w,x,y);
  g.drawImage(src,1,1);return c;
}

/* ── 雜誌字卡 ── */
function plate(g,cx,top,t,o){
  const V=o.color,VD=shade(V,-.3),VL=shade(V,.6);
  const w=344,h=84,sk=18,x=cx-w/2+8,y=top+26;
  g.save();g.translate(9,9);poly(g,[[x+sk,y],[x+w,y],[x+w-sk,y+h],[x,y+h]]);g.fillStyle=V;g.fill();g.lineWidth=3;g.strokeStyle=INK;g.stroke();g.restore();
  const band=[[x+sk,y],[x+w,y],[x+w-sk,y+h],[x,y+h]];
  poly(g,band);g.fillStyle=INK;g.fill();
  g.save();poly(g,band);g.clip();
  g.fillStyle='rgba(255,255,255,.22)';for(let yy=y+4;yy<y+h;yy+=8)for(let xx=x+w-110+((yy/8)%2?4:0);xx<x+w;xx+=8){const k=Math.max(0,1-Math.hypot(xx-(x+w),yy-(y+h))/120);if(k>.08){g.beginPath();g.arc(xx,yy,2*k,0,TAU);g.fill();}}
  const sx=x-80+(t%1)*(w+220);g.fillStyle='rgba(255,255,255,.16)';poly(g,[[sx,y],[sx+34,y],[sx+34-h*.45,y+h],[sx-h*.45,y+h]]);g.fill();
  g.restore();
  // 名字頁籤（色帶上方）：闆卡名字＋小字 NEW VIP
  const who=o.name||'';g.font='700 24px '+F_ZH;let ns=24;while(g.measureText(who).width>200&&ns>13){ns--;g.font='700 '+ns+'px '+F_ZH;}
  const whoW=g.measureText(who).width,tabW=whoW+112,lx=x+sk+6,ly=top-10,th=36;
  poly(g,[[lx,ly],[lx+tabW,ly],[lx+tabW-8,ly+th],[lx-8,ly+th]]);g.fillStyle=CREAM;g.fill();g.lineWidth=3;g.strokeStyle=INK;g.stroke();
  g.fillStyle=V;g.fillRect(lx+2,ly+3,5,th-6);
  g.fillStyle=INK;g.font='700 '+ns+'px '+F_ZH;g.textBaseline='middle';g.fillText(who,lx+16,ly+th/2+1);
  g.fillStyle=VD;g.font='700 12px '+F_EN;g.fillText('✦ NEW VIP',lx+26+whoW,ly+th/2+1);g.textBaseline='alphabetic';
  // 大字 VIP＋菱形數字
  g.font='400 50px '+F_TITLE;g.fillStyle=WHITE;g.fillText('VIP',x+34,y+62);
  const vw=g.measureText('VIP').width,dcx=x+34+vw+48,dcy=y+42;
  g.save();g.translate(dcx,dcy);g.rotate(t*Math.PI/2);g.strokeStyle=VL;g.lineWidth=2;g.strokeRect(-34,-34,68,68);g.restore();
  g.save();g.translate(dcx,dcy);g.rotate(Math.PI/4);g.fillStyle=V;g.fillRect(-25,-25,50,50);g.lineWidth=3;g.strokeStyle=WHITE;g.strokeRect(-25,-25,50,50);g.restore();
  g.textAlign='center';g.font='400 44px '+F_NUM;g.lineJoin='round';g.lineWidth=6;g.strokeStyle=INK;g.strokeText(String(o.lv),dcx,dcy+16);g.fillStyle=WHITE;g.fillText(String(o.lv),dcx,dcy+16);g.textAlign='left';
  // 等級名
  const rx=x+w-78,ry=y+16;g.fillStyle=WHITE;g.font='700 22px '+F_ZH;g.fillText(o.nm,rx,ry+24);g.font='700 10px '+F_EN;g.fillStyle=VL;g.fillText('RANK '+o.lv,rx+2,ry+42);
  g.fillStyle=VL;g.fillRect(rx-10,ry+4,2,44);
  // 細線（畫出來再收）、小三角、四芒星
  const lp=.5+.5*Math.sin(t*TAU);g.fillStyle=V;g.fillRect(x-40*lp-8,y+h+8,40*lp,3);g.fillRect(x+w+8,y-10,40*lp,3);
  g.save();g.translate(x+w+20,y+h-6);g.rotate(t*TAU/3);g.strokeStyle=V;g.lineWidth=3;poly(g,[[0,-8],[7,5],[-7,5]]);g.stroke();g.restore();
  const tw=.6+.4*Math.max(0,Math.sin(t*TAU*2));star4(g,x+4,y-6,13*tw);g.fillStyle=WHITE;g.fill();g.lineWidth=3;g.strokeStyle=INK;g.stroke();
  // 右下小字註記
  g.textAlign='right';g.fillStyle=V;g.font='700 12px '+F_EN;const cr='HALL OF FAME  ✦  No.'+o.no;g.fillText(cr,x+w-sk+4,y+h+28);const crw=g.measureText(cr).width;g.textAlign='left';
  g.fillRect(x+w-sk+4-crw-30,y+h+23,22,3);
}

/* ── 一格畫面：小人（呼吸壓扁＋頭髮＋眨眼，同大廳）＋字卡＋星星 ── */
function frame(g,t,o){
  g.clearRect(0,0,W,H);
  const VL=shade(o.color,.55),cx=240,footY=488;
  const pulse=Math.max(0,Math.sin(t*TAU*3)),sqx=1+pulse*.031,sqy=1-pulse*.044;
  const phase=Math.floor(t*12)%4,blink=(t>.62&&t<.68);
  const fr=(blink?o.blinkFrames:o.frames)[phase];
  const dw=fr.width*P*sqx,dh=fr.height*P*sqy,dx=cx-dw/2,dy=footY-((o.foot+2)/fr.height)*dh;
  g.imageSmoothingEnabled=false;g.drawImage(fr,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));
  const bob=Math.round(Math.sin(t*TAU)*5),tw=ph=>.55+.45*Math.max(0,Math.sin((t*2+ph)*TAU));
  plate(g,cx,40+bob,t,o);
  sparkle(g,402,300,12*tw(.25),VL);sparkle(g,80,250,10*tw(.75),WHITE);
}

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function fonts(name){
  if(!document.fonts||!document.fonts.load)return;
  const zh='✦迎賓熟客常客摯友貴賓'+(name||'');
  try{await Promise.all([document.fonts.load('700 24px "TT Huninn"',zh),document.fonts.load('400 44px "Tavern Numerals"','0123456789'),
    document.fonts.load('700 12px "Tavern Numerals"','HALL OF FAME No.0123456789 RANK NEW VIP'),document.fonts.load('400 50px "TT Title"','VIP')]);}catch(_){}
}
// 畫 64×64 小人（4 張頭髮擺動影格＋4 張閉眼）。部件圖（含閉眼圖）第一次用到才開始載，
// 沒載好就畫會少一層（D 11/10：眨眼那格臉上沒眼睛）→ 重畫到前後兩次一模一樣才算數（最多約 6 秒）。
async function dollFrames(doll){
  const mk=(blink,phase)=>{const c=document.createElement('canvas');c.width=c.height=64;drawDollTo(c,{...doll,_blink:blink},'idle',{mode:'idle',phase});return c;};
  const sig=cs=>cs.map(c=>{const d=c.getContext('2d').getImageData(0,0,64,64).data;let h=0;for(let i=0;i<d.length;i+=3)h=(h*31+d[i])>>>0;return h;}).join(',');
  let raw,rawB,last='';
  for(let tries=0;tries<12;tries++){
    raw=[0,1,2,3].map(p=>mk(false,p));rawB=[0,1,2,3].map(p=>mk(true,p));
    const s=sig(raw.concat(rawB));if(s===last)break;last=s;await wait(tries?500:900);
  }
  const px=raw[0].getContext('2d').getImageData(0,0,64,64).data;let foot=0;
  for(let y=63;y>=0&&!foot;y--)for(let x=0;x<64;x++)if(px[(y*64+x)*4+3]>80){foot=y+1;break;}
  if(!foot)throw Error('EMPTY_DOLL');
  return {frames:raw.map(outline),blinkFrames:rawB.map(outline),foot};
}
// 畫好整輪 → GIF Blob
async function render({doll,name,lv,no}){
  lv=Math.max(1,Math.min(5,Number(lv)||1));
  const [nm,color]=VIP[lv];
  await fonts(name);
  const d=await dollFrames(doll||{});
  const enc=await import(GIFENC);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});
  const o={...d,lv,nm,color,name:String(name||'').slice(0,20),no:String(no||1).padStart(3,'0')};
  const rgba=[];
  for(let i=0;i<N;i++){frame(g,i/N,o);rgba.push(g.getImageData(0,0,W,H).data);if(i%6===5)await wait(0);}
  // 共用色盤：只拿不透明的像素去量化（每 3 格取 1 格）；第 0 號留給透明
  let cnt=0;for(let i=0;i<N;i+=3){const a=rgba[i];for(let j=3;j<a.length;j+=4)if(a[j]>=128)cnt++;}
  const sample=new Uint8Array(cnt*4);let k=0;
  for(let i=0;i<N;i+=3){const a=rgba[i];for(let j=0;j<a.length;j+=4)if(a[j+3]>=128){sample[k++]=a[j];sample[k++]=a[j+1];sample[k++]=a[j+2];sample[k++]=255;}}
  const pal=enc.quantize(sample,255,{format:'rgb565'});
  const palette=[[0,0,0],...pal];
  const gif=enc.GIFEncoder();
  for(let i=0;i<N;i++){
    const a=rgba[i],idx=enc.applyPalette(a,pal,'rgb565'),out=new Uint8Array(W*H);
    for(let p=0;p<out.length;p++)out[p]=a[p*4+3]>=128?idx[p]+1:0;
    gif.writeFrame(out,W,H,i===0?{palette,delay:DELAY,repeat:0,transparent:true,transparentIndex:0,dispose:2}:{delay:DELAY,transparent:true,transparentIndex:0,dispose:2});
    if(i%6===5)await wait(0);
  }
  gif.finish();
  return new Blob([gif.bytes()],{type:'image/gif'});
}
const toDataURL=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});

/* ── 接「請畫圖」單 ── */
let key=null,ref=null,cb=null,busy=false;const done=new Set();
function me_(){try{return typeof me==='function'?me():null;}catch(_){return null;}}
async function handle(k,req){
  if(!req||!(req.lv>=1&&req.lv<=5))return;
  const tag=k+'_'+req.lv+'_'+(req.no||0)+'_'+(req.at||0);
  if(busy||done.has(tag))return;
  try{if(localStorage.getItem('tt_vipcard_'+tag))return;}catch(_){}
  const a=me_();if(!a||!a.b||!a.b.doll||a.myKey&&a.myKey!==k)return;   // 小人資料還沒載到：下一輪再試
  busy=true;
  try{
    await wait(1500);
    if(key!==k)return;
    const blob=await render({doll:a.b.doll,name:a.b.name||'',lv:req.lv,no:req.no||1});
    const url=await toDataURL(blob);
    if(key!==k)return;
    await G('db').ref(G('ROOT')+'/vipCard/'+k+'/'+req.lv).set(url);
    done.add(tag);try{localStorage.setItem('tt_vipcard_'+tag,'1');}catch(_){}
  }catch(e){
    const code=e&&(e.code||e.message)||String(e);console.warn('[vip-card] 動圖沒交出去',code);
    if(/permission|PERMISSION/.test(code)){done.add(tag);}   // 已經交過（不能覆蓋）或單子已撤：不再重畫
  }finally{busy=false;}
}
function watch(){
  const d=G('db'),fb=root.firebase;if(!d||!fb)return;
  let u=null;try{u=fb.auth().currentUser;}catch(_){}
  const k=(u&&G('myKey'))||null;
  if(k===key&&(ref||!k)){if(k&&cb&&watch.last)handle(k,watch.last);return;}
  if(ref&&cb){try{ref.off('value',cb);}catch(_){}}
  ref=null;cb=null;key=k;watch.last=null;
  if(!k)return;
  ref=d.ref(G('ROOT')+'/vipCardReq/'+k);
  cb=s=>{if(key!==k)return;watch.last=s.val();handle(k,watch.last);};
  ref.on('value',cb,()=>{});   // 規則還沒發布：讀不到就不做事
}
root.TTVipCardGif={render,frame,state:()=>({key,busy,last:watch.last,done:[...done]})};
setInterval(watch,3000);watch();
})(window);
