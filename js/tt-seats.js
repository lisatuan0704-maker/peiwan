/* =====================================================================
 * tt-seats.js — 小小酒館・座椅特效模組（v1，2026-10-23 定案設定）
 *
 * 座椅 = 楓之谷式「椅子」：玩家坐下時，座椅出現在小人旁邊並播放特效；
 * 站起來（移動）就收起來。
 *
 *   seat3 我生日推車   ：推車彈出、帽子掉到頭上、燭光忽明忽暗、星星換位置閃爍
 *   seat4 蘋果傳說的鏡子：倒影 → 消失 → 蘋果 → 消失 循環（依真實時間，所有人同步）
 *
 * 用法（細節見「給GPT的整合說明.md」）：
 *   await TTSeats.init('img/seats/');         // 預載素材
 *   TTSeats.use(a, 'seat3', startedAt);       // a = 大廳 actor（需有 a.el、a.cv、a.frames.idle）
 *   TTSeats.clear(a);                         // 收起（0.3 秒淡出）
 *   TTSeats.sync(a, size, sqy);               // 每一幀在 render 迴圈裡呼叫（設定完 a.cv 尺寸之後）
 *   TTSeats.thumb('seat4', canvas);           // 時裝間商品縮圖
 *
 * 所有座標單位 = 座椅素材的像素（繪師原圖 1px）。
 * 這支檔案不依賴大廳其他程式，可以整支替換更新。
 * ===================================================================== */
(function(){
'use strict';

/* ---------------- 定案設定（D 於 2026-10-23 調整確認，非必要勿改） ---------------- */
const CFG={
  dollK:1.7,                        // 闆卡 1px = 座椅 1.7px（闆卡 64px 規格對座椅原圖的比例）
  bday:{dx:4,dy:0,hatX:2,hatY:5,flicker:1.05,glowR:18,sparks:7},
  mirror:{dx:-12,mode:'color',flip:true,k:1.3,x:48,y:65,alpha:0.75,wash:0.45},
  cycle:{show:3,fade:0.6,gap:0.8}   // 秒：顯示 / 淡入淡出 / 空鏡
};

/* 座椅目錄：id 對應時裝間 shopConfig / owned 的 itemId */
const CATALOG={
  seat3:{name:'我生日推車',   kind:'bday'},
  seat4:{name:'蘋果傳說的鏡子', kind:'mirror'}
};

/* 素材檔名（放在 init(base) 指定的資料夾下） */
const FILES={
  cart:'bday/cart.png', spark:'bday/sparkles.png', hat:'bday/hat.png', flame:'bday/flame-glow.png',
  frame:'mirror/frame.png', apple:'mirror/apple.png', baseL:'mirror/glass-light.png', baseB:'mirror/glass-blue.png'
};

/* 版面：小人腳底 = (0,0)；box = 這張座椅要佔的畫布範圍 */
const CART_FOOT={x:92,y:111};       // 推車原圖中，小人腳底的位置（照繪師示意圖）
const HAT_ROOM=30;                  // 推車畫布上方多留給「帽子掉下來」的空間
const BOX={
  bday:  {x:-CART_FOOT.x+CFG.bday.dx, y:-CART_FOOT.y+CFG.bday.dy-HAT_ROOM, w:132, h:117+HAT_ROOM, front:true},
  mirror:{x:41+CFG.mirror.dx,         y:-111,                              w:71,  h:117,          front:false}
};

/* ---------------- 共用工具 ---------------- */
const IMG={}; let SPK=[], HL=null, READY=false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return [c,x];};
const easeOutBack=t=>{const c1=1.9,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);};
const easeOutBounce=t=>{const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d)return n*(t-=1.5/d)*t+.75;if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;return n*(t-=2.625/d)*t+.984375;};
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const nowS=()=>performance.now()/1000;
let clockOffset=0;                  // 伺服器時間差（ms），讓鏡子循環在每台電腦同一階段
const wallS=()=>(Date.now()+clockOffset)/1000;

function bboxOf(src){
  const w=src.width,h=src.height,[c,x]=mk(w,h);x.drawImage(src,0,0);
  const d=x.getImageData(0,0,w,h).data;let a=1e9,b=1e9,e=-1,f=-1;
  for(let y=0;y<h;y++)for(let i=0;i<w;i++)if(d[(y*w+i)*4+3]>8){if(i<a)a=i;if(y<b)b=y;if(i>e)e=i;if(y>f)f=y;}
  if(e<0)return {x0:0,y0:0,x1:w-1,y1:h-1};
  return {x0:a,y0:b,x1:e,y1:f};
}
/* 星星圖層拆成一顆一顆，之後隨機挑來閃 */
function splitSparkles(img){
  const [c,x]=mk(img.width,img.height);x.drawImage(img,0,0);
  const w=c.width,h=c.height,d=x.getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),out=[];
  for(let p=0;p<w*h;p++){
    if(seen[p]||d[p*4+3]<10)continue;const st=[p],px=[];seen[p]=1;
    while(st.length){const q=st.pop();px.push(q);const qx=q%w,qy=(q/w)|0;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const nx=qx+ox,ny=qy+oy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(!seen[n]&&d[n*4+3]>=10){seen[n]=1;st.push(n);}}}
    let a=1e9,b=1e9,e=-1,f=-1,br=-1,bc=[255,245,200];
    for(const q of px){const qx=q%w,qy=(q/w)|0;a=Math.min(a,qx);b=Math.min(b,qy);e=Math.max(e,qx);f=Math.max(f,qy);const L=d[q*4]+d[q*4+1]+d[q*4+2];if(L>br){br=L;bc=[d[q*4],d[q*4+1],d[q*4+2]];}}
    const [sc,sx]=mk(e-a+1,f-b+1);sx.drawImage(c,a,b,e-a+1,f-b+1,0,0,e-a+1,f-b+1);
    out.push({c:sc,w:e-a+1,h:f-b+1,col:'rgb('+bc.join(',')+')'});
  }
  return out.sort((p,q)=>q.w*q.h-p.w*p.h);
}
function dither(x,c,alpha){ // 像素溶解（淡入淡出用）
  if(alpha>=.999)return;
  const id=x.getImageData(0,0,c.width,c.height),d=id.data,w=c.width;
  for(let p=0;p<d.length;p+=4){if(!d[p+3])continue;const q=p>>2;if(alpha<(BAYER[(((q/w)|0)&3)*4+((q%w)&3)]+.5)/16)d[p+3]=0;}
  x.putImageData(id,0,0);
}
function flick(t){ // 燭光雜訊 0..1（偶爾被風吹暗一下）
  let f=.5+.22*Math.sin(t*9.7)+.16*Math.sin(t*15.3+1.3)+.12*Math.sin(t*27.1+.4);
  if(Math.sin(t*1.7)>.965)f*=.45;
  return clamp(f,0,1);
}

/* ---------------- 每個坐著的人一組狀態 ---------------- */
function makeInst(a,id,startedAt){
  const kind=CATALOG[id].kind, box=BOX[kind];
  const back=document.createElement('canvas'); back.width=box.w; back.height=box.h;
  back.className='tt-seat tt-seat-back';
  const front=document.createElement('canvas'); front.width=box.w; front.height=box.h;
  front.className='tt-seat tt-seat-front';
  for(const c of [back,front]){
    Object.assign(c.style,{position:'absolute',left:'0',top:'0',imageRendering:'pixelated',pointerEvents:'none',transformOrigin:'0 0'});
  }
  back.style.zIndex='-1';                 // 在小人後面（.npc canvas 沒有 z-index，同層靠 DOM 順序）
  front.style.zIndex='2';                 // 在小人前面、名牌下面
  a.el.insertBefore(back,a.el.firstChild);
  if(box.front) a.el.insertBefore(front,a.cv.nextSibling);
  /* 已經坐很久的人（例如剛進大廳才看到他）不重播彈出動畫 */
  const age=startedAt?Math.max(0,(Date.now()+clockOffset-startedAt)/1000):0;
  const inst={id,kind,box,back,front,bx:back.getContext('2d'),fx:front.getContext('2d'),
    t0:nowS()-age,tOff:null,sparks:[],doll:null,dollSrc:null,
    work:kind==='mirror'?{g:mk(71,117),r:mk(71,117),ap:mk(71,117),hl:mk(71,117)}:{glow:mk(132,117),fxs:mk(132,117)}};
  inst.bx.imageSmoothingEnabled=false; inst.fx.imageSmoothingEnabled=false;
  return inst;
}
function dollInfo(inst,a){
  const src=(a.frames&&a.frames.idle)||a.cv;
  if(inst.dollSrc!==src||!inst.doll){
    const bb=bboxOf(src);
    inst.dollSrc=src;
    inst.doll={src,w:src.width,fx:(bb.x0+bb.x1+1)/2,fy:bb.y1+1,h:bb.y1+1-bb.y0,hx:(bb.x0+bb.x1+1)/2,hy:bb.y0+(bb.y1-bb.y0)*.36};
  }
  return inst.doll;
}
function seatAlpha(inst,now){ return inst.tOff!=null?clamp(1-(now-inst.tOff)/.3,0,1):1; }
function popScale(age){ if(age>=.42)return {sx:1,sy:1}; const t=clamp(age/.42,0,1); return {sx:1+.25*(1-t),sy:.35+.65*easeOutBack(t)}; }
function drawPop(x,img,ox,oy,pop,alpha){
  x.save();x.globalAlpha=alpha;const bx=ox+img.width/2,by=oy+img.height;
  x.translate(bx,by);x.scale(pop.sx,pop.sy);x.drawImage(img,-img.width/2,-img.height);x.restore();
}

/* ---------------- 我生日推車 ---------------- */
function spawnSpark(inst,s,now,first){
  for(let k=0;k<14;k++){
    const x=4+Math.random()*124, y=6+Math.random()*98;
    if(x>72&&x<112&&y>34&&y<92)continue;               // 避開臉和身體
    if(x>22&&x<64&&y>20&&y<40)continue;                // 避開燭光
    if(inst.sparks.some(o=>o!==s&&Math.hypot(o.x-x,o.y-y)<16))continue;
    s.x=Math.round(x);s.y=Math.round(y);break;
  }
  s.life=1.3+Math.random()*1.3; s.t0=now+(first?Math.random()*1.6:Math.random()*.7);
  s.spr=SPK.length?SPK[Math.random()<.35?0:(1+Math.floor(Math.random()*Math.max(1,SPK.length-1)))%SPK.length]:null;
}
function drawBday(inst,now,sqy){
  const B=CFG.bday, al=seatAlpha(inst,now), age=now-inst.t0, OY=HAT_ROOM;
  const bx=inst.bx, fx=inst.fx, [glC,glX]=inst.work.glow, [spC,spX]=inst.work.fxs;
  bx.clearRect(0,0,inst.box.w,inst.box.h); fx.clearRect(0,0,inst.box.w,inst.box.h);
  /* 地面陰影 */
  bx.globalAlpha=.28*al;bx.fillStyle='#28141e';bx.beginPath();bx.ellipse(54,OY+112,46,5,0,0,Math.PI*2);bx.fill();bx.globalAlpha=1;
  /* 推車本體（彈出） */
  drawPop(bx,IMG.cart,0,OY,inst.tOff!=null?{sx:1,sy:1}:popScale(age),al);
  /* 燭光：像素光圈四階色帶，半徑與亮度忽明忽暗 */
  const fade=inst.tOff!=null?al:clamp((age-.35)/1.6,0,1);
  if(fade>0){
    const f=1-B.flicker*(1-flick(now)), cx=45+(Math.sin(now*3.1)>.6?1:0), cy=31, R=B.glowR*(.82+.3*f);
    const id=glX.createImageData(132,117),d=id.data;
    for(let y=Math.max(0,cy-24);y<Math.min(117,cy+24);y++)for(let x=Math.max(0,cx-24);x<Math.min(132,cx+24);x++){
      const dd=Math.hypot(x+.5-cx,(y+.5-cy)*1.08)/R; if(dd>=1)continue;
      const lv=dd<.38?.55:dd<.62?.34:dd<.84?.2:.1, i=(y*132+x)*4;
      d[i]=255;d[i+1]=dd<.38?214:186;d[i+2]=dd<.38?150:110;d[i+3]=Math.round(255*lv*fade*(.55+.45*f));
    }
    glX.putImageData(id,0,0);
    bx.save();bx.globalCompositeOperation='lighter';bx.drawImage(glC,0,OY);bx.restore();
    bx.save();bx.globalAlpha=fade*(.6+.4*f);bx.drawImage(IMG.flame,0,OY);bx.restore();
  }
  /* 帽子：掉到頭上彈一下，跟著呼吸下沉 */
  const ht=inst.tOff!=null?1:clamp((age-.15)/.55,0,1), drop=(1-easeOutBounce(ht))*-26;
  const headSink=(1-(sqy||1))*(inst.doll?inst.doll.h:45)*CFG.dollK;
  fx.save();fx.globalAlpha=al*clamp(ht*3,0,1);
  fx.drawImage(IMG.hat,Math.round(B.hatX),Math.round(OY+B.hatY+drop+headSink));fx.restore();
  /* 星星：點 → 十字 → 原圖(中間閃一下) → 十字 → 點，再換位置 */
  spX.clearRect(0,0,132,117);
  if(fade>0){
    const n=B.sparks|0;
    while(inst.sparks.length<n){const s={};spawnSpark(inst,s,now,true);inst.sparks.push(s);}
    for(const s of inst.sparks){
      const p=(now-s.t0)/s.life; if(p<0)continue; if(p>=1){spawnSpark(inst,s,now,false);continue;}
      const col=s.spr?s.spr.col:'#fff6c8';
      if(p<.14||p>.9){spX.fillStyle=col;spX.fillRect(s.x,s.y,1,1);}
      else if(p<.3||p>.74){spX.fillStyle=col;spX.fillRect(s.x-1,s.y,3,1);spX.fillRect(s.x,s.y-1,1,3);spX.fillStyle='#fff';spX.fillRect(s.x,s.y,1,1);}
      else if(s.spr){spX.drawImage(s.spr.c,s.x-(s.spr.w>>1),s.y-(s.spr.h>>1));
        if(p>.46&&p<.54){spX.fillStyle='rgba(255,255,255,.85)';spX.fillRect(s.x,s.y-((s.spr.h>>1)+1),1,s.spr.h+2);spX.fillRect(s.x-((s.spr.w>>1)+1),s.y,s.spr.w+2,1);}}
    }
    fx.globalAlpha=fade;fx.drawImage(spC,0,OY);fx.globalAlpha=1;
  }
}

/* ---------------- 蘋果傳說的鏡子 ---------------- */
function mirrorPhase(t){
  const {show:s,fade:f,gap:g}=CFG.cycle, half=s+2*f+g, T=2*half;
  const tt=(t%T+T)%T, inA=tt>=half, u=inA?tt-half:tt;
  let on,sweep=-1;
  if(u<f)on=u/f; else if(u<f+s)on=1; else if(u<2*f+s){on=1-(u-f-s)/f;sweep=(u-f-s)/f;} else on=0;
  const gapP=u>=2*f+s?(u-2*f-s)/g:0;
  const mix=inA?(u>=2*f+s?1-gapP:1):(u>=2*f+s?gapP:0);
  return {r:inA?0:on,a:inA?on:0,mix,sweep};
}
function drawMirror(inst,now,sqy,sqx){
  const M=CFG.mirror, al=seatAlpha(inst,now), age=now-inst.t0, ph=mirrorPhase(wallS()), D=inst.doll;
  const [gC,gX]=inst.work.g,[rC,rX]=inst.work.r,[aC,aX]=inst.work.ap,[hC,hX]=inst.work.hl, bx=inst.bx;
  /* 鏡底永遠不透明：淡色底先鋪滿，藍色底疊上去漸變 */
  gX.clearRect(0,0,71,117);gX.globalAlpha=1;gX.drawImage(IMG.baseL,0,0);
  if(ph.mix>0){gX.globalAlpha=ph.mix;gX.drawImage(IMG.baseB,0,0);gX.globalAlpha=1;}
  /* 倒影：使用這位玩家自己的闆卡，左右鏡像、淡彩泛白，跟著呼吸 */
  if(ph.r>0&&D){
    rX.clearRect(0,0,71,117);rX.save();rX.translate(M.x,M.y);
    rX.scale((M.flip?-1:1)*M.k*(sqx||1),M.k*(sqy||1));rX.drawImage(D.src,-D.hx,-D.hy);rX.restore();
    rX.globalCompositeOperation='source-atop';
    if(M.mode==='sil'){rX.fillStyle='#5d6f93';rX.fillRect(0,0,71,117);}
    else{rX.fillStyle='rgba(236,243,255,'+M.wash+')';rX.fillRect(0,0,71,117);}
    rX.globalCompositeOperation='destination-in';rX.drawImage(IMG.baseL,0,0);rX.globalCompositeOperation='source-over';
    dither(rX,rC,ph.r);
    gX.globalAlpha=M.alpha;gX.drawImage(rC,0,0);gX.globalAlpha=1;
    /* 倒影上補一層很淡的鏡面亮線（取自繪師鏡底），玻璃感不被吃掉 */
    hX.clearRect(0,0,71,117);hX.drawImage(rC,0,0);hX.globalCompositeOperation='source-in';hX.drawImage(HL,0,0);hX.globalCompositeOperation='source-over';
    gX.globalAlpha=.3*M.alpha;gX.drawImage(hC,0,0);gX.globalAlpha=1;
  }
  if(ph.a>0){aX.clearRect(0,0,71,117);aX.drawImage(IMG.apple,0,0);dither(aX,aC,ph.a);gX.drawImage(aC,0,0);}
  /* 消失時一道斜光掃過：斜率跟繪師畫的亮線相同（往上 1 格、往右 2 格），2px 一顆 */
  if(ph.sweep>=0){
    const pos=Math.round((86+ph.sweep*170)/2)*2;gX.globalCompositeOperation='source-atop';
    for(let y=0;y<117;y+=2){const x0=pos-2*y;gX.fillStyle='rgba(255,255,255,.6)';gX.fillRect(x0,y,6,2);gX.fillStyle='rgba(255,255,255,.35)';gX.fillRect(x0+10,y,2,2);}
    gX.globalCompositeOperation='source-over';
  }
  gX.drawImage(IMG.frame,0,0);
  bx.clearRect(0,0,inst.box.w,inst.box.h);
  bx.globalAlpha=.28*al;bx.fillStyle='#28141e';bx.beginPath();bx.ellipse(36,114,24,4,0,0,Math.PI*2);bx.fill();bx.globalAlpha=1;
  drawPop(bx,gC,0,0,inst.tOff!=null?{sx:1,sy:1}:popScale(age),al);
}

/* ---------------- 對外 API ---------------- */
const TTSeats={
  CATALOG, CFG,
  /** 預載素材。base 例如 'img/seats/'；回傳 Promise */
  init(base){
    base=base||'img/seats/';
    return Promise.all(Object.entries(FILES).map(([k,f])=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>{IMG[k]=i;res();};i.onerror=()=>rej(new Error('座椅素材載入失敗：'+base+f));i.src=base+f;})))
      .then(()=>{
        SPK=splitSparkles(IMG.spark);
        const [hc,hx]=mk(71,117);hx.drawImage(IMG.baseL,0,0);const id=hx.getImageData(0,0,71,117),d=id.data;
        for(let p=0;p<d.length;p+=4){if(!(d[p+3]&&d[p]+d[p+1]+d[p+2]>640))d[p+3]=0;}
        hx.putImageData(id,0,0);HL=hc;READY=true;
      });
  },
  /** 伺服器時間差（Firebase 的 .info/serverTimeOffset），鏡子循環就會每個人一致 */
  setClockOffset(ms){ clockOffset=+ms||0; },
  isSeat(id){ return !!CATALOG[id]; },
  /** 讓 actor 使用座椅；startedAt = 開始坐下的時間戳(ms)，給遠端玩家用，避免重播進場 */
  use(a,id,startedAt){
    if(!READY||!a||!a.el||!CATALOG[id])return;
    if(a._seat&&a._seat.id===id&&a._seat.tOff==null)return;
    if(a._seat)TTSeats.remove(a);
    a._seatAt=startedAt||Math.round(Date.now()+clockOffset);   // 給位置封包的 sa 欄位用
    a._seat=makeInst(a,id,a._seatAt);
  },
  /** 收起座椅（0.3 秒淡出後自動移除） */
  clear(a){ if(a&&a._seat&&a._seat.tOff==null)a._seat.tOff=nowS(); },
  /** 立刻移除（換地圖、離線時用） */
  remove(a){ if(!a||!a._seat)return; a._seat.back.remove(); a._seat.front.remove(); a._seat=null; },
  /** 目前坐著的座椅 id（淡出中也算 null） */
  current(a){ return a&&a._seat&&a._seat.tOff==null?a._seat.id:null; },
  /**
   * 每一幀呼叫：size = 小人畫面尺寸(px，也就是 a.cv.style.width 的數字)，
   * sqy/sqx = 待機呼吸的上下/左右縮放（沒有就給 1）
   */
  sync(a,size,sqy,sqx){
    const inst=a&&a._seat; if(!inst)return;
    const now=nowS();
    if(inst.tOff!=null&&now-inst.tOff>=.3){TTSeats.remove(a);return;}
    const D=dollInfo(inst,a);
    if(inst.kind==='bday')drawBday(inst,now,sqy);else drawMirror(inst,now,sqy,sqx);
    /* 位置：小人腳底在 a.el 裡的座標 + box 偏移；面向左時整組左右翻轉 */
    const dpx=size/D.w, s=dpx/CFG.dollK;            // 1 座椅px = s 螢幕px
    const flip=!!a.faceLeft, box=inst.box;
    const footX=(flip?D.w-D.fx:D.fx)*dpx, footY=D.fy*dpx;  // 小人面向左時 a.cv 被 scaleX(-1)，腳底位置也跟著鏡像
    for(const c of [inst.back,inst.front]){
      c.style.width=(box.w*s)+'px';c.style.height=(box.h*s)+'px';
      c.style.left=(footX+box.x*s)+'px';c.style.top=(footY+box.y*s)+'px';
      c.style.transformOrigin=(-box.x*s)+'px 0';
      c.style.transform=flip?'scaleX(-1)':'';
    }
  },
  /** 時裝間縮圖：把座椅靜態畫進 canvas（推車＝亮燈狀態，鏡子＝蘋果狀態） */
  thumb(id,cv){
    if(!READY||!CATALOG[id]||!cv)return;
    const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,cv.width,cv.height);
    const kind=CATALOG[id].kind;let src;
    if(kind==='bday'){const [c,cx]=mk(132,117);cx.drawImage(IMG.cart,0,0);cx.globalAlpha=.9;cx.drawImage(IMG.flame,0,0);cx.globalAlpha=1;cx.drawImage(IMG.spark,0,0);
      const bb=bboxOf(c);const [d,dx]=mk(bb.x1-bb.x0+1,bb.y1-bb.y0+1);dx.drawImage(c,-bb.x0,-bb.y0);src=d;}
    else{const [c,cx]=mk(71,117);cx.drawImage(IMG.baseB,0,0);cx.drawImage(IMG.apple,0,0);cx.drawImage(IMG.frame,0,0);
      const bb=bboxOf(c);const [d,dx]=mk(bb.x1-bb.x0+1,bb.y1-bb.y0+1);dx.drawImage(c,-bb.x0,-bb.y0);src=d;}
    const k=Math.max(1,Math.floor(Math.min(cv.width/src.width,cv.height/src.height)));
    x.drawImage(src,Math.round((cv.width-src.width*k)/2),Math.round((cv.height-src.height*k)/2),src.width*k,src.height*k);
  }
};
window.TTSeats=TTSeats;
})();
