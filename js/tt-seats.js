/* =====================================================================
 * tt-seats.js — 小小酒館・座椅特效模組 v2（2026-10-24 定案）
 *
 * 座椅 = 楓之谷式「椅子」：玩家坐下時座椅出現在小人旁邊並播放特效，一移動就收起來。
 *
 *   seat3 我生日推車：
 *     推車彈出、派對帽掉到頭上、燭光（在推車圖層下面）忽明忽暗、星星在人和蛋糕周圍換位置閃爍
 *   seat4 蘋果傳說的鏡子：
 *     鏡子上下漂浮；鏡中循環「自己的倒影 → 消失 → 蘋果 → 消失」（依真實時間，所有人同步）；
 *     鏡面反光往右下掃過；鏡子周圍小星星換位置閃爍（避開小人）；旁邊一支蠟燭（站在地上不漂浮）
 *
 * 用法（細節見「給GPT的整合說明.md」）：
 *   await TTSeats.init('img/seats/');         // 預載素材
 *   TTSeats.use(a, 'seat3', startedAt);       // a = 大廳 actor（需有 a.el、a.cv、a.frames.idle）
 *   TTSeats.clear(a);                         // 收起（0.3 秒淡出）
 *   TTSeats.sync(a, size, sqy, sqx);          // 每一幀在 render 迴圈裡呼叫
 *   TTSeats.thumb('seat4', canvas);           // 時裝間商品縮圖
 *
 * 所有座標單位 = 座椅素材的像素（繪師原圖 1px）。不依賴大廳其他程式，可整支替換更新。
 * ===================================================================== */
(function(){
'use strict';

/* ---------------- 定案設定（D 於 2026-10-24 逐項調整確認，勿改） ---------------- */
const CFG={
  dollK:1.7,                         // 闆卡 1px = 座椅 1.7px
  bday:{dx:4,dy:0,hatX:2,hatY:5,flicker:0.45,glowR:20,sparks:7},
  light:{glow:0.4,mR:17,stepped:true},
  mirror:{dx:-18,dy:-5,mode:'color',flip:true,k:1.3,x:64,y:64,alpha:0.75,wash:0.45,
          floatA:8,floatP:4,sparks:6,shineDur:1.3,shineEvery:2.3},
  candles:[{x:61,y:3,lx:0,ly:0}], candleFloat:false,
  cycle:{show:3,fade:0.6,gap:0.8}    // 秒：顯示 / 淡入淡出 / 空鏡
};

const CATALOG={
  seat3:{name:'我生日推車',     kind:'bday'},
  seat4:{name:'蘋果傳說的鏡子', kind:'mirror'}
};
const FILES={
  cart:'bday/cart.png', spark:'bday/sparkles.png', hat:'bday/hat.png', flame:'bday/flame-glow.png',
  bow:'mirror/bow.png', frame:'mirror/frame.png', baseP:'mirror/glass-person.png', baseA:'mirror/glass-apple.png',
  apple:'mirror/apple.png', shine:'mirror/shine.png', msp:'mirror/sparkles.png',
  cholder:'mirror/candle-holder.png', cflame:'mirror/candle-flame.png', clight:'mirror/candle-light.png'
};

/* ---------------- 版面（小人腳底 = (0,0)） ---------------- */
const CART_FOOT={x:92,y:111}, HAT_ROOM=30;
const MW=104, MH=126;                                   // 鏡子分層原圖尺寸
const MIR={x:31+CFG.mirror.dx, y:-108+CFG.mirror.dy};    // 鏡子圖左上角相對腳底
const PAD=24, FA=CFG.mirror.floatA;                      // 鏡子畫布四周留邊（星星）＋漂浮範圍
const CANDLE_C={x:19,y:83};
const BOX={
  bday:  {x:-CART_FOOT.x+CFG.bday.dx, y:-CART_FOOT.y+CFG.bday.dy-HAT_ROOM, w:132, h:117+HAT_ROOM},
  mirror:{x:MIR.x-PAD, y:MIR.y-PAD-FA, w:MW+PAD*2, h:MH+PAD*2+FA*2}
};

/* ---------------- 工具 ---------------- */
const IMG={}; let SPK=[], MSP=[], SMALL=[], HL=null, SHINE=null, READY=false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return [c,x];};
const easeOutBack=t=>{const c1=1.9,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);};
const easeOutBounce=t=>{const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d)return n*(t-=1.5/d)*t+.75;if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;return n*(t-=2.625/d)*t+.984375;};
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const nowS=()=>performance.now()/1000;
let clockOffset=0; const wallS=()=>(Date.now()+clockOffset)/1000;

function bboxOf(src){
  const w=src.width,h=src.height,[c,x]=mk(w,h);x.drawImage(src,0,0);
  const d=x.getImageData(0,0,w,h).data;let a=1e9,b=1e9,e=-1,f=-1;
  for(let y=0;y<h;y++)for(let i=0;i<w;i++)if(d[(y*w+i)*4+3]>8){if(i<a)a=i;if(y<b)b=y;if(i>e)e=i;if(y>f)f=y;}
  return e<0?{x0:0,y0:0,x1:w-1,y1:h-1}:{x0:a,y0:b,x1:e,y1:f};
}
function split(img){ // 把星星圖層拆成一顆一顆
  const [c,x]=mk(img.width,img.height);x.drawImage(img,0,0);
  const w=c.width,h=c.height,d=x.getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),out=[];
  for(let p=0;p<w*h;p++){
    if(seen[p]||d[p*4+3]<10)continue;const st=[p],px=[];seen[p]=1;
    while(st.length){const q=st.pop();px.push(q);const qx=q%w,qy=(q/w)|0;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const nx=qx+ox,ny=qy+oy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(!seen[n]&&d[n*4+3]>=10){seen[n]=1;st.push(n);}}}
    let a=1e9,b=1e9,e=-1,f=-1,br=-1,bc=[255,245,200];
    for(const q of px){const qx=q%w,qy=(q/w)|0;a=Math.min(a,qx);b=Math.min(b,qy);e=Math.max(e,qx);f=Math.max(f,qy);const L=d[q*4]+d[q*4+1]+d[q*4+2];if(L>br){br=L;bc=[d[q*4],d[q*4+1],d[q*4+2]];}}
    const [sc,sx]=mk(e-a+1,f-b+1);sx.drawImage(c,a,b,e-a+1,f-b+1,0,0,e-a+1,f-b+1);
    out.push({c:sc,x:a,y:b,w:e-a+1,h:f-b+1,col:'rgb('+bc.join(',')+')'});
  }
  return out.sort((p,q)=>q.w*q.h-p.w*p.h);
}
function dither(x,c,alpha){ // 像素溶解
  if(alpha>=.999)return;
  const id=x.getImageData(0,0,c.width,c.height),d=id.data,w=c.width;
  for(let p=0;p<d.length;p+=4){if(!d[p+3])continue;const q=p>>2;if(alpha<(BAYER[(((q/w)|0)&3)*4+((q%w)&3)]+.5)/16)d[p+3]=0;}
  x.putImageData(id,0,0);
}
function flick(t,seed){
  let f=.5+.22*Math.sin(t*9.7+seed)+.16*Math.sin(t*15.3+1.3+seed*2)+.12*Math.sin(t*27.1+.4+seed*3);
  if(Math.sin(t*1.7+seed)>.965)f*=.45; return clamp(f,0,1);
}
const fl=(t,seed)=>1-CFG.bday.flicker*(1-flick(t,seed));
/* 像素光圈（四階色帶），畫進 x 的 (cx,cy) */
function halo(x,cx,cy,r,k,fade){
  const q=v=>CFG.light.stepped?Math.round(v*5)/5:v, R=Math.ceil(r)+1;
  const id=x.createImageData(R*2,R*2),d=id.data;
  for(let y=0;y<R*2;y++)for(let i=0;i<R*2;i++){
    const dd=Math.hypot(i+.5-R,(y+.5-R)*1.1); if(dd>=r)continue;
    const t=dd/r, warm=(t<.38?1:t<.62?.62:t<.84?.36:.18)*k, a=q(warm)*.5*CFG.light.glow*fade, p=(y*R*2+i)*4;
    d[p]=255;d[p+1]=warm>.9?214:188;d[p+2]=warm>.9?150:112;d[p+3]=Math.round(255*clamp(a,0,1));
  }
  const [hc,hx]=mk(R*2,R*2);hx.putImageData(id,0,0);
  x.save();x.globalCompositeOperation='lighter';x.drawImage(hc,Math.round(cx-R),Math.round(cy-R));x.restore();
}
/* 星星生命週期：點 → 十字 → 原圖(中間閃一下) → 十字 → 點 */
function drawTwinkle(x,s,p){
  const col=s.spr?s.spr.col:'#fff6c8';
  if(p<.14||p>.9){x.fillStyle=col;x.fillRect(s.x,s.y,1,1);}
  else if(p<.3||p>.74){x.fillStyle=col;x.fillRect(s.x-1,s.y,3,1);x.fillRect(s.x,s.y-1,1,3);x.fillStyle='#fff';x.fillRect(s.x,s.y,1,1);}
  else if(s.spr){x.drawImage(s.spr.c,s.x-(s.spr.w>>1),s.y-(s.spr.h>>1));
    if(p>.46&&p<.54){x.fillStyle='rgba(255,250,220,.88)';x.fillRect(s.x,s.y-((s.spr.h>>1)+1),1,s.spr.h+2);x.fillRect(s.x-((s.spr.w>>1)+1),s.y,s.spr.w+2,1);}}
}

/* ---------------- 實例 ---------------- */
function makeInst(a,id,startedAt){
  const kind=CATALOG[id].kind, box=BOX[kind];
  const mkLayer=(cls,z)=>{const c=document.createElement('canvas');c.width=box.w;c.height=box.h;c.className='tt-seat '+cls;
    Object.assign(c.style,{position:'absolute',left:'0',top:'0',imageRendering:'pixelated',pointerEvents:'none',transformOrigin:'0 0',zIndex:z});
    const x=c.getContext('2d');x.imageSmoothingEnabled=false;return [c,x];};
  const [back,bx]=mkLayer('tt-seat-back','-1'), [front,fx]=mkLayer('tt-seat-front','2');
  a.el.insertBefore(back,a.el.firstChild);              // 小人後面
  a.el.insertBefore(front,a.cv.nextSibling);            // 小人前面、名牌下面
  const age=startedAt?Math.max(0,(Date.now()+clockOffset-startedAt)/1000):0;
  return {id,kind,box,back,front,bx,fx,t0:nowS()-age,tOff:null,sparks:[],doll:null,dollSrc:null,
    w:kind==='mirror'?{g:mk(MW,MH),r:mk(MW,MH),ap:mk(MW,MH),hl:mk(MW,MH),sh:mk(MW,MH),m:mk(MW,MH)}:{fxs:mk(132,117)}};
}
function dollInfo(inst,a){
  const src=(a.frames&&a.frames.idle)||a.cv;
  if(inst.dollSrc!==src||!inst.doll){
    const bb=bboxOf(src);inst.dollSrc=src;
    inst.doll={src,w:src.width,x0:bb.x0,x1:bb.x1,fx:(bb.x0+bb.x1+1)/2,fy:bb.y1+1,h:bb.y1+1-bb.y0,hx:(bb.x0+bb.x1+1)/2,hy:bb.y0+(bb.y1-bb.y0)*.36};
  }
  return inst.doll;
}
const seatAlpha=(inst,now)=>inst.tOff!=null?clamp(1-(now-inst.tOff)/.3,0,1):1;
function popScale(age){ if(age>=.42)return {sx:1,sy:1}; const t=clamp(age/.42,0,1); return {sx:1+.25*(1-t),sy:.35+.65*easeOutBack(t)}; }
function drawPop(x,img,ox,oy,pop,alpha){
  x.save();x.globalAlpha=alpha;const bx=ox+img.width/2,by=oy+img.height;
  x.translate(bx,by);x.scale(pop.sx,pop.sy);x.drawImage(img,-img.width/2,-img.height);x.restore();
}
function shadow(x,cx,cy,rw,a){x.save();x.globalAlpha=a;x.fillStyle='#28141e';x.beginPath();x.ellipse(cx,cy,rw,Math.max(2,rw*.13),0,0,Math.PI*2);x.fill();x.restore();}

/* ---------------- 我生日推車 ---------------- */
function spawnCake(inst,s,now,first){
  for(let k=0;k<14;k++){
    const x=4+Math.random()*124, y=6+Math.random()*98;
    if(x>72&&x<112&&y>34&&y<92)continue;              // 避開臉和身體
    if(x>22&&x<64&&y>20&&y<40)continue;               // 避開燭光
    if(inst.sparks.some(o=>o!==s&&Math.hypot(o.x-x,o.y-y)<16))continue;
    s.x=Math.round(x);s.y=Math.round(y);break;
  }
  s.life=1.3+Math.random()*1.3; s.t0=now+(first?Math.random()*1.6:Math.random()*.7);
  s.spr=SPK.length?SPK[Math.random()<.35?0:(1+Math.floor(Math.random()*Math.max(1,SPK.length-1)))%SPK.length]:null;
}
function drawBday(inst,now,sqy){
  const B=CFG.bday, al=seatAlpha(inst,now), age=now-inst.t0, OY=HAT_ROOM, bx=inst.bx, fx=inst.fx, [spC,spX]=inst.w.fxs;
  bx.clearRect(0,0,inst.box.w,inst.box.h); fx.clearRect(0,0,inst.box.w,inst.box.h);
  shadow(bx,54,OY+112,46,.28*al);
  const fade=inst.tOff!=null?al:clamp((age-.35)/1.6,0,1), f=fl(now,0);
  /* 燭光在推車「下面」：先光圈＋繪師火光圖，再蓋推車本體 */
  if(fade>0){
    halo(bx,45+(Math.sin(now*3.1)>.6?1:0),OY+31,B.glowR*(.82+.3*f),.55+.45*f,fade);
    bx.save();bx.globalAlpha=fade*(.6+.4*f);bx.drawImage(IMG.flame,0,OY);bx.restore();
  }
  drawPop(bx,IMG.cart,0,OY,inst.tOff!=null?{sx:1,sy:1}:popScale(age),al);
  /* 帽子 */
  const ht=inst.tOff!=null?1:clamp((age-.15)/.55,0,1), drop=(1-easeOutBounce(ht))*-26;
  const headSink=(1-(sqy||1))*(inst.doll?inst.doll.h:45)*CFG.dollK;
  fx.save();fx.globalAlpha=al*clamp(ht*3,0,1);fx.drawImage(IMG.hat,Math.round(B.hatX),Math.round(OY+B.hatY+drop+headSink));fx.restore();
  /* 星星 */
  spX.clearRect(0,0,132,117);
  if(fade>0){
    while(inst.sparks.length<(B.sparks|0)){const s={};spawnCake(inst,s,now,true);inst.sparks.push(s);}
    for(const s of inst.sparks){const p=(now-s.t0)/s.life;if(p<0)continue;if(p>=1){spawnCake(inst,s,now,false);continue;}drawTwinkle(spX,s,p);}
    fx.globalAlpha=fade;fx.drawImage(spC,0,OY);fx.globalAlpha=1;
  }
}

/* ---------------- 蘋果傳說的鏡子 ---------------- */
function mirrorPhase(t){
  const {show:s,fade:f,gap:g}=CFG.cycle, half=s+2*f+g, T=2*half;
  const tt=(t%T+T)%T, inA=tt>=half, u=inA?tt-half:tt; let on;
  if(u<f)on=u/f; else if(u<f+s)on=1; else if(u<2*f+s)on=1-(u-f-s)/f; else on=0;
  const gapP=u>=2*f+s?(u-2*f-s)/g:0, mix=inA?(u>=2*f+s?1-gapP:1):(u>=2*f+s?gapP:0);
  return {r:inA?0:on,a:inA?on:0,mix};
}
/* 反光：繪師光條只畫在左上，往右下移會露出斷頭 → 取中段 12 行沿階梯斜率 (20,-12) 接長成整條光帶 */
function buildShine(){
  const img=IMG.shine,[c,x]=mk(img.width,img.height);x.drawImage(img,0,0);
  const id=x.getImageData(0,0,c.width,c.height),d=id.data;for(let p=0;p<d.length;p+=4)if(d[p+3]<255)d[p+3]=0;x.putImageData(id,0,0);
  const R0=48,R1=60,P=160,[L,lx]=mk(img.width+P*2,img.height+P*2);
  for(let k=-8;k<=8;k++)lx.drawImage(c,0,R0,img.width,R1-R0,P+k*20,P+R0-k*12,img.width,R1-R0);
  SHINE={c:L,pad:P};
}
const PERP=(()=>{const n=Math.hypot(12,20);return {x:12/n,y:20/n};})();
function drawShine(sx,now){
  const M=CFG.mirror, D=M.shineDur, per=D*2+M.shineEvery, u=now%per; let p;
  if(u<M.shineEvery)p=0; else if(u<M.shineEvery+D){const k=(u-M.shineEvery)/D;p=k*k*78;} else {const k=(u-M.shineEvery-D)/D;p=-60*(1-k)*(1-k);}
  sx.clearRect(0,0,MW,MH);sx.drawImage(SHINE.c,Math.round(PERP.x*p/2)*2-SHINE.pad,Math.round(PERP.y*p/2)*2-SHINE.pad);
  sx.globalCompositeOperation='destination-in';sx.drawImage(IMG.baseP,0,0);sx.globalCompositeOperation='source-over';
}
/* 鏡子周圍星星：避開鏡面與小人（含漂浮範圍）；平常小星星，大星星約 6% */
function spawnMir(inst,s,now,first){
  const D=inst.doll, k=CFG.dollK, dx0=(D.x0-D.fx)*k-4, dx1=(D.x1+1-D.fx)*k+4, dy0=-D.h*k-4-FA, dy1=FA; s.x=null;
  for(let t=0;t<24;t++){
    const x=Math.round(2+Math.random()*100), y=Math.round(2+Math.random()*120);
    if(x>28&&x<72&&y>34&&y<92)continue;
    const wx=MIR.x+x, wy=MIR.y+y; if(wx>dx0&&wx<dx1&&wy>dy0&&wy<dy1)continue;
    if(inst.sparks.some(o=>o!==s&&o.x!=null&&Math.hypot(o.x-x,o.y-y)<16))continue;
    s.x=x;s.y=y;break;
  }
  s.life=1.2+Math.random()*1.4; s.t0=now+(first?Math.random()*1.8:.1+Math.random()*.8);
  s.spr=Math.random()<.06?MSP[0]:SMALL[Math.floor(Math.random()*SMALL.length)];
}
function drawCandle(x,c,ox,oy,now,i,part){
  const f=fl(now,i*1.7+.5), X=ox+c.x, Y=oy+c.y;
  if(part==='holder'){x.drawImage(IMG.cholder,X,Y);return;}
  halo(x,X+CANDLE_C.x+c.lx,Y+CANDLE_C.y+c.ly,CFG.light.mR*(.82+.3*f),.55+.45*f,1);
  x.save();x.globalAlpha=(.55+.45*f)*Math.min(1,CFG.light.glow+.2);x.globalCompositeOperation='lighter';x.drawImage(IMG.clight,X+c.lx,Y+c.ly);x.restore();
  x.save();x.globalAlpha=.8+.2*f;x.drawImage(IMG.cflame,X+(Math.sin(now*3.7+i)>.55?1:0),Y-(f>.85?1:0));x.restore();
}
function drawMirror(inst,now,sqy,sqx){
  const M=CFG.mirror, al=seatAlpha(inst,now), age=now-inst.t0, ph=mirrorPhase(wallS()), D=inst.doll, W=inst.w;
  const [gC,gX]=W.g,[rC,rX]=W.r,[aC,aX]=W.ap,[hC,hX]=W.hl,[sC,sX]=W.sh,[mC,mX]=W.m, bx=inst.bx, fx=inst.fx;
  /* 玻璃：淡色底永遠不透明，藍色底疊上去漸變 */
  gX.clearRect(0,0,MW,MH);gX.drawImage(IMG.baseP,0,0);
  if(ph.mix>0){gX.globalAlpha=ph.mix;gX.drawImage(IMG.baseA,0,0);gX.globalAlpha=1;}
  if(ph.r>0&&D){ /* 倒影：這位玩家自己的闆卡，鏡像、淡彩泛白 */
    rX.clearRect(0,0,MW,MH);rX.save();rX.translate(M.x,M.y);rX.scale((M.flip?-1:1)*M.k*(sqx||1),M.k*(sqy||1));rX.drawImage(D.src,-D.hx,-D.hy);rX.restore();
    rX.globalCompositeOperation='source-atop';
    if(M.mode==='sil'){rX.fillStyle='#5d6f93';rX.fillRect(0,0,MW,MH);}else{rX.fillStyle='rgba(236,243,255,'+M.wash+')';rX.fillRect(0,0,MW,MH);}
    rX.globalCompositeOperation='destination-in';rX.drawImage(IMG.baseP,0,0);rX.globalCompositeOperation='source-over';
    dither(rX,rC,ph.r);gX.globalAlpha=M.alpha;gX.drawImage(rC,0,0);gX.globalAlpha=1;
    hX.clearRect(0,0,MW,MH);hX.drawImage(rC,0,0);hX.globalCompositeOperation='source-in';hX.drawImage(HL,0,0);hX.globalCompositeOperation='source-over';
    gX.globalAlpha=.3*M.alpha;gX.drawImage(hC,0,0);gX.globalAlpha=1;
  }
  if(ph.a>0){aX.clearRect(0,0,MW,MH);aX.drawImage(IMG.apple,0,0);dither(aX,aC,ph.a);gX.drawImage(aC,0,0);}
  drawShine(sX,now);gX.globalAlpha=.72;gX.drawImage(sC,0,0);gX.globalAlpha=1;
  mX.clearRect(0,0,MW,MH);mX.drawImage(IMG.bow,0,0);mX.drawImage(gC,0,0);mX.drawImage(IMG.frame,0,0);
  /* 漂浮（整數像素）＋影子 */
  const fy=Math.round(FA*Math.sin(now*2*Math.PI/M.floatP)), ox=PAD, oy=PAD+FA;   // 鏡子圖左上角在畫布中的位置（未漂浮）
  bx.clearRect(0,0,inst.box.w,inst.box.h); fx.clearRect(0,0,inst.box.w,inst.box.h);
  shadow(bx,ox+50,oy+111+3,(56-Math.abs(fy)*1.5-(fy<0?2:0))/2,.32*al);
  drawPop(bx,mC,ox,oy+fy,inst.tOff!=null?{sx:1,sy:1}:popScale(age),al);
  /* 蠟燭：站在地上（腳底以下的畫在小人前面） */
  const coy=oy+(CFG.candleFloat?fy:0);
  CFG.candles.forEach((c,i)=>{const front=MIR.y+c.y+114>0;const x=front?fx:bx;x.globalAlpha=al;drawCandle(x,c,ox,coy,now,i,'holder');x.globalAlpha=1;});
  fx.globalAlpha=al;CFG.candles.forEach((c,i)=>drawCandle(fx,c,ox,coy,now,i,'flame'));fx.globalAlpha=1;
  /* 周圍星星 */
  if(D){
    while(inst.sparks.length<(M.sparks|0)){const s={};inst.sparks.push(s);spawnMir(inst,s,now,true);}
    fx.save();fx.globalAlpha=al;fx.translate(ox,oy+fy);
    for(const s of inst.sparks){const p=(now-s.t0)/s.life;if(p<0)continue;if(p>=1||s.x==null){spawnMir(inst,s,now,false);continue;}drawTwinkle(fx,s,p);}
    fx.restore();
  }
}

/* ---------------- 對外 API ---------------- */
const TTSeats={
  CATALOG, CFG,
  init(base){
    base=base||'img/seats/';
    return Promise.all(Object.entries(FILES).map(([k,f])=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>{IMG[k]=i;res();};i.onerror=()=>rej(new Error('座椅素材載入失敗：'+base+f));i.src=base+f;})))
      .then(()=>{
        SPK=split(IMG.spark).filter(s=>s.w>=3&&s.h>=3);
        { const all=split(IMG.msp), big=all[0], cx=big.x+big.w/2, cy=big.y+big.h/2;   // 大星星的尖端是分開的小點，合回本體
          const tips=all.filter(s=>s!==big&&s.w<3&&s.h<3&&(Math.abs(s.x+s.w/2-cx)<=2||Math.abs(s.y+s.h/2-cy)<=2));
          const parts=[big,...tips],x0=Math.min(...parts.map(p=>p.x)),y0=Math.min(...parts.map(p=>p.y)),x1=Math.max(...parts.map(p=>p.x+p.w)),y1=Math.max(...parts.map(p=>p.y+p.h));
          const [c,x]=mk(x1-x0,y1-y0);parts.forEach(p=>x.drawImage(p.c,p.x-x0,p.y-y0));
          MSP=[{c,x:x0,y:y0,w:x1-x0,h:y1-y0,col:big.col},...all.filter(s=>s!==big&&s.w>=3&&s.h>=3)]; }
        SMALL=[...SPK,...MSP.slice(1)];
        { const [hc,hx]=mk(MW,MH);hx.drawImage(IMG.baseP,0,0);const id=hx.getImageData(0,0,MW,MH),d=id.data;
          for(let p=0;p<d.length;p+=4){if(!(d[p+3]&&d[p]+d[p+1]+d[p+2]>640))d[p+3]=0;}hx.putImageData(id,0,0);HL=hc; }
        buildShine(); READY=true;
      });
  },
  setClockOffset(ms){ clockOffset=+ms||0; },
  isSeat(id){ return !!CATALOG[id]; },
  use(a,id,startedAt){
    if(!READY||!a||!a.el||!CATALOG[id])return;
    if(a._seat&&a._seat.id===id&&a._seat.tOff==null)return;
    if(a._seat)TTSeats.remove(a);
    a._seatAt=startedAt||Math.round(Date.now()+clockOffset);
    a._seat=makeInst(a,id,a._seatAt);
  },
  clear(a){ if(a&&a._seat&&a._seat.tOff==null)a._seat.tOff=nowS(); },
  remove(a){ if(!a||!a._seat)return; a._seat.back.remove(); a._seat.front.remove(); a._seat=null; },
  current(a){ return a&&a._seat&&a._seat.tOff==null?a._seat.id:null; },
  sync(a,size,sqy,sqx){
    const inst=a&&a._seat; if(!inst)return;
    const now=nowS();
    if(inst.tOff!=null&&now-inst.tOff>=.3){TTSeats.remove(a);return;}
    const D=dollInfo(inst,a);
    if(inst.kind==='bday')drawBday(inst,now,sqy);else drawMirror(inst,now,sqy,sqx);
    const dpx=size/D.w, s=dpx/CFG.dollK, flip=!!a.faceLeft, box=inst.box;
    const footX=(flip?D.w-D.fx:D.fx)*dpx, footY=D.fy*dpx;   // 面向左時 a.cv 被 scaleX(-1)，腳底跟著鏡像
    for(const c of [inst.back,inst.front]){
      c.style.width=(box.w*s)+'px';c.style.height=(box.h*s)+'px';
      c.style.left=(footX+box.x*s)+'px';c.style.top=(footY+box.y*s)+'px';
      c.style.transformOrigin=(-box.x*s)+'px 0';c.style.transform=flip?'scaleX(-1)':'';
    }
  },
  thumb(id,cv){
    if(!READY||!CATALOG[id]||!cv)return;
    const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,cv.width,cv.height);
    let c,cx;
    if(CATALOG[id].kind==='bday'){[c,cx]=mk(132,117);cx.globalAlpha=.9;cx.drawImage(IMG.flame,0,0);cx.globalAlpha=1;cx.drawImage(IMG.cart,0,0);cx.drawImage(IMG.spark,0,0);}
    else{[c,cx]=mk(MW,MH);cx.drawImage(IMG.bow,0,0);cx.drawImage(IMG.baseA,0,0);cx.drawImage(IMG.apple,0,0);cx.drawImage(IMG.shine,0,0);cx.drawImage(IMG.frame,0,0);
      CFG.candles.forEach(cd=>{cx.drawImage(IMG.cholder,cd.x,cd.y);cx.drawImage(IMG.cflame,cd.x,cd.y);});cx.drawImage(IMG.msp,0,0);}
    const bb=bboxOf(c),[d,dx]=mk(bb.x1-bb.x0+1,bb.y1-bb.y0+1);dx.drawImage(c,-bb.x0,-bb.y0);
    const k=Math.max(1,Math.floor(Math.min(cv.width/d.width,cv.height/d.height)));
    x.drawImage(d,Math.round((cv.width-d.width*k)/2),Math.round((cv.height-d.height*k)/2),d.width*k,d.height*k);
  }
};
window.TTSeats=TTSeats;
})();
