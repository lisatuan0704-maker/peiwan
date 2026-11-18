/* 冒險者頭像框解鎖慶祝（D 11/19：不發 Discord；達成時在老闆自己的大廳跳出成就，動畫循環播放，點任何地方關閉；
   「都網頁了，特效炫技一點，讓人有成就感」）。
   畫面：左＝那位冒險者的像素小人（img/companions-v352/*-staff-sheet.png，16 格、每格 0.2 秒）＋左上角像素對話框＋像素愛心；
        右＝老闆「當下」的闆卡小人（drawDollTo，呼吸壓扁／頭髮擺動／眨眼，同 vip-card.js）站在那位冒險者的頭像框裡；
        上＝雜誌字卡（名字頁籤＋深紫斜切色帶＋菱形 10 小時＋「已獲得與 縭 的羈絆」）。
   開場約 1.8 秒：斜切光帶掃過 → 字卡滑入、10 小時數字跳上來 → 頭像框從畫面外砸下（震動、白閃、菱形衝擊波、幾何碎片）
   → 小人跳出來 → 蓋 UNLOCKED 章 → 冒險者滑進來、小跳一下、對話框冒愛心。之後循環：光束慢慢轉、框上掃光、冒險者每輪小跳。
   開場時點一下＝直接跳到完成畫面，之後再點才關。音效用 Web Audio 現場合成（跟大廳「音效」開關走）。
   像素圖（冒險者、對話框、老闆小人）一律整數倍放大、對齊螢幕像素，不會糊也不會忽胖忽瘦。
   新解鎖偵測：order-voice.mjs 每分鐘拿一次 /v1/voice/rewards（tt-companion-rewards 事件）；同一台裝置每個框只跳一次。 */
(function(root){
'use strict';
// D 11/19「整個太大了」「獲得的東西才是主體，應該要比陪玩小人大」：頭像框＋老闆小人是主角（框 291、小人每格 3 點），
// 冒險者是配角（每格 1.5 點），整個畫面不放大（最多 1 倍）
const TAU=Math.PI*2,CP=2,BP=3,FS=291,DS=192,LOOP=3.2,LAND=.92;
const COMP={
  '-OxY7C4vDkgsr1zcyWbk':{id:'companion_rira',asset:'rira',nm:'縭',c:'#8E6BE0',a:'#F2A97F'},
  '-OxY46ezlpnRt64hUIw9':{id:'companion_kabuki',asset:'kabuki',nm:'蕪',c:'#4C7BE0',a:'#AFC0DA'},
  '-OzbfbQcF6J6fIR6YYGh':{id:'companion_momo',asset:'momo',nm:'桃',c:'#E879AC',a:'#F2C977'}
};
const INK='#2A1F52',CREAM='#FFF7EA',WHITE='#FFFFFF',HEART='#FF5C93',HEART_D='#C93A70';
const F_TITLE='"TT Title","Tavern Numerals",sans-serif',F_NUM='"Tavern Numerals","TT Latin",sans-serif',F_ZH='"TT Huninn","Tavern Numerals",sans-serif',F_EN='"Tavern Numerals","TT Latin",sans-serif';

/* ── 小工具 ── */
const clamp=v=>v<0?0:v>1?1:v,seg=(t,a,b)=>clamp((t-a)/(b-a));
const eOut=x=>1-Math.pow(1-x,3),eIn=x=>x*x*x,eExpo=x=>x>=1?1:1-Math.pow(2,-10*x);
const eBack=(x,k=1.7)=>x<=0?0:1+(k+1)*Math.pow(x-1,3)+k*Math.pow(x-1,2);
function rng(seed){return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function rgb(h){const n=parseInt(h.slice(1),16);return [n>>16,n>>8&255,n&255];}
function rgba(h,a){const [r,g,b]=rgb(h);return 'rgba('+r+','+g+','+b+','+a+')';}
function shade(hex,k){const [r,g,b]=rgb(hex);const f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k)));return '#'+((1<<24)+(f(r)<<16)+(f(g)<<8)+f(b)).toString(16).slice(1);}
function poly(g,pts){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))g.lineTo(p[0],p[1]);g.closePath();}
function star4(g,x,y,r){const k=.3;g.beginPath();g.moveTo(x,y-r);g.quadraticCurveTo(x+r*k,y-r*k,x+r,y);g.quadraticCurveTo(x+r*k,y+r*k,x,y+r);g.quadraticCurveTo(x-r*k,y+r*k,x-r,y);g.quadraticCurveTo(x-r*k,y-r*k,x,y-r);g.closePath();}
function sparkle(g,x,y,r,col){if(r<2)return;star4(g,x,y,r);g.lineJoin='round';g.lineWidth=3;g.strokeStyle=INK;g.stroke();g.fillStyle=col;g.fill();star4(g,x,y,r*.42);g.fillStyle=WHITE;g.fill();}
function fitFont(g,txt,weight,size,family,maxW,min){let s=size;g.font=weight+' '+s+'px '+family;while(g.measureText(txt).width>maxW&&s>min){s--;g.font=weight+' '+s+'px '+family;}return s;}
// 像素圖外面加一圈白邊（1 格），深色底也看得清楚
function outline(src){
  const c=document.createElement('canvas');c.width=src.width+2;c.height=src.height+2;const g=c.getContext('2d');
  const w=document.createElement('canvas');w.width=src.width;w.height=src.height;const wg=w.getContext('2d');wg.drawImage(src,0,0);wg.globalCompositeOperation='source-in';wg.fillStyle=WHITE;wg.fillRect(0,0,w.width,w.height);
  for(const [x,y] of [[0,1],[2,1],[1,0],[1,2],[0,0],[2,2],[0,2],[2,0]])g.drawImage(w,x,y);
  g.drawImage(src,1,1);return c;
}

// 像素圖照整數倍、對齊螢幕像素畫：(x,y)＝左上角、k＝舞台上的放大倍數；水平置中、底邊對齊（站著的小人腳不會飄）。
// 有旋轉時（開場動畫中）照一般方式畫。
function crisp(g,im,x,y,k){
  const m=g.getTransform();g.imageSmoothingEnabled=false;
  if(Math.abs(m.b)>1e-4||Math.abs(m.c)>1e-4){g.drawImage(im,x,y,im.width*k,im.height*k);return null;}
  const want=k*m.a,n=Math.max(1,Math.round(want)),w=im.width,h=im.height;
  const X=Math.round(m.a*x+m.e+(want-n)*w/2),Y=Math.round(m.d*y+m.f+(want-n)*h);
  g.save();g.setTransform(1,0,0,1,0,0);g.imageSmoothingEnabled=false;g.drawImage(im,X,Y,n*w,n*h);g.restore();
  return {X,Y,n};   // 實際畫在螢幕上的位置（對話框要跟著）
}
// 直接在螢幕座標畫（n 倍）
function dev(g,im,X,Y,n){g.save();g.setTransform(1,0,0,1,0,0);g.imageSmoothingEnabled=false;g.drawImage(im,Math.round(X),Math.round(Y),im.width*n,im.height*n);g.restore();}

/* ── 像素對話框＋愛心（格子畫，BP 倍；尾巴尖端在格子 (13.5,13)） ── */
const BUB=['..############....','.#............#...','#..............#..','#..............#..','#..............#..','#..............#..','#..............#..','#..............#..','#..............#..','.#............#...','..#########..#....','...........#.#....','............##....'];
const HEART_S=['.##.##.','#######','#######','.#####.','..###..','...#...'];
const HEART_B=['.###.###.','#########','#########','#########','.#######.','..#####..','...###...','....#....'];
function pixelBubble(g,x,y,beat,s){
  for(let r=0;r<BUB.length;r++){const row=BUB[r],L=row.indexOf('#'),R=row.lastIndexOf('#');
    if(r>0&&r<10){g.fillStyle=WHITE;g.fillRect(x+(L+1)*s,y+r*s,(R-L-1)*s,s);}
    for(let c=0;c<row.length;c++)if(row[c]==='#'){g.fillStyle=INK;g.fillRect(x+c*s,y+r*s,s,s);}}
  g.fillStyle=WHITE;g.fillRect(x+12*s,y+10*s,s,s);g.fillRect(x+12*s,y+11*s,s,s);
  const hp=beat?HEART_B:HEART_S,hw=hp[0].length,hh=hp.length,hx=x+Math.floor((16-hw)/2)*s+s,hy=y+Math.floor((10-hh)/2)*s+s;
  for(let r=0;r<hh;r++)for(let c=0;c<hw;c++)if(hp[r][c]==='#'){g.fillStyle=(r>=hh-3&&c>=hw/2)?HEART_D:HEART;g.fillRect(hx+c*s,hy+r*s,s,s);}
  g.fillStyle=WHITE;g.fillRect(hx+s,hy+s,s,s);if(beat)g.fillRect(hx+2*s,hy+s,s,s);
}
function bubbleImg(beat){const c=document.createElement('canvas');c.width=18;c.height=13;pixelBubble(c.getContext('2d'),0,0,beat,1);return c;}

/* ── 版面（舞台座標）：橫的 660×500、直的（手機）380×650 ── */
function layout(vw,vh){
  const portrait=vw/vh<.85,LW=portrait?380:660,LH=portrait?650:500;
  const s=Math.min(vw/LW,(vh-40)/LH,1),ox=(vw-LW*s)/2,oy=Math.max(0,(vh-40-LH*s)/2);
  return portrait
    ?{s,ox,oy,plate:{x:190,y:72,k:.7},frame:{cx:200,cy:306},comp:{x:8,y:470,cp:1.25},ribbon:{x:262,y:472,k:.8},wm:{x:190,y:262,z:112}}
    :{s,ox,oy,plate:{x:330,y:74,k:.88},frame:{cx:448,cy:310},comp:{x:40,y:300,cp:1.5},ribbon:{x:552,y:458,k:.88},wm:{x:330,y:492,z:178}};
}

/* ── 背景特效（螢幕座標） ── */
function background(g,o,T,vw,vh,fx,fy,s){
  const V=o.cc.c,VL=shade(V,.55);
  // 光束：頭像框落地後亮起，慢慢轉
  const ra=seg(T,LAND-.05,LAND+.6);
  if(ra>0){
    const R=Math.max(vw,vh)*.75;g.save();g.translate(fx,fy);g.globalCompositeOperation='lighter';
    const glow=g.createRadialGradient(0,0,0,0,0,FS*s*1.05);glow.addColorStop(0,rgba(VL,.5*ra));glow.addColorStop(1,rgba(VL,0));g.fillStyle=glow;g.fillRect(-R,-R,R*2,R*2);
    g.rotate(T*.13);g.globalAlpha=ra;g.drawImage(o.rays,-R,-R,R*2,R*2);
    g.restore();
  }
  // 漂浮的小幾何（少量）
  const ma=seg(T,1.3,2.2);
  if(ma>0){for(const m of o.motes){
    const y=((m.y*(vh+60)-T*m.v*s)%(vh+60)+vh+60)%(vh+60)-30,x=m.x*vw+Math.sin(T*.7+m.ph)*14*s,tw=.3+.7*Math.max(0,Math.sin(T*2.1+m.ph));
    g.save();g.globalAlpha=ma*tw*.85;g.translate(x,y);g.rotate(m.ph+T*.4);const z=m.z*s;
    if(m.k===0){star4(g,0,0,z*1.3);g.fillStyle=WHITE;g.fill();}
    else if(m.k===1){g.rotate(Math.PI/4);g.strokeStyle=m.c;g.lineWidth=2*s;g.strokeRect(-z/2,-z/2,z,z);}
    else{g.fillStyle=m.c;g.fillRect(-z*.7,-s,z*1.4,2*s);g.fillRect(-s,-z*.7,2*s,z*1.4);}
    g.restore();}}
  // 衝擊波：落地時三圈菱形往外擴；之後每輪一圈淡淡的
  const ring=(p,rot,lw,col,al)=>{const r=(FS*.52+400*eOut(p))*s;g.save();g.translate(fx,fy);g.rotate(Math.PI/4+rot);g.lineWidth=lw*s*(1-p*.7);g.strokeStyle=rgba(col,al*(1-p));g.strokeRect(-r/1.42,-r/1.42,r*1.41,r*1.41);g.restore();};
  for(let k=0;k<3;k++){const p=seg(T,LAND+k*.09,LAND+k*.09+.8);if(p>0&&p<1)ring(p,k*.25+p*.4,k?3:6,k===1?V:WHITE,1);}
  if(T>2.2){const L=(T-2.2)%LOOP,p=seg(L,0,1.4);if(p>0&&p<1)ring(p,p*.3,3,WHITE,.4);}
}
// 開場斜切光帶＋兩條細線
function opening(g,o,T,vw,vh,fy){
  if(T>.75)return;
  const V=o.cc.c;
  const l1=eExpo(seg(T,0,.35)),fade=1-seg(T,.4,.75);
  g.save();g.globalAlpha=fade;g.fillStyle=WHITE;g.fillRect(0,fy-70,vw*l1,2);g.fillRect(vw*(1-l1),fy+70,vw*l1,2);g.restore();
  const p=seg(T,.08,.5);if(p<=0||p>=1)return;
  const x=-vw*.4+eOut(p)*vw*1.8,w=Math.max(160,vw*.16);
  g.save();g.globalAlpha=.9*(1-seg(p,.7,1));poly(g,[[x,0],[x+w,0],[x+w-vh*.45,vh],[x-vh*.45,vh]]);g.fillStyle=V;g.fill();
  poly(g,[[x+w+18,0],[x+w+30,0],[x+w+30-vh*.45,vh],[x+w+18-vh*.45,vh]]);g.fillStyle=WHITE;g.fill();g.restore();
}
// 落地碎片（螢幕座標，舞台上面）
function shards(g,o,T,fx,fy,s){
  const age=T-LAND;if(age<0||age>1.6)return;
  for(const d of o.shards){
    if(age>d.life)continue;const dist=(d.d0+d.v*(1-Math.exp(-3.4*age))/3.4)*s,x=fx+Math.cos(d.a)*dist,y=fy+Math.sin(d.a)*dist+age*age*40*s;
    g.save();g.globalAlpha=1-seg(age,d.life*.5,d.life);g.translate(x,y);g.rotate(d.r+d.spin*age);const z=d.z*s;
    g.fillStyle=d.c;g.strokeStyle=INK;g.lineWidth=2*s;
    if(d.k===0){poly(g,[[-z*1.6,-z*.32],[z*1.6,0],[-z*1.6,z*.32]]);g.fill();g.stroke();}
    else if(d.k===1){g.rotate(Math.PI/4);g.fillRect(-z/2,-z/2,z,z);g.strokeRect(-z/2,-z/2,z,z);}
    else if(d.k===2){star4(g,0,0,z*1.1);g.fill();g.stroke();}
    else{g.fillRect(-z*1.8,-1.5*s,z*3.6,3*s);}
    g.restore();
  }
}

/* ── 字卡（舞台座標；原點＝色帶上緣中間） ── */
function plate(g,o,T,P){
  const V=o.cc.c,VL=shade(V,.6),VD=shade(V,-.35),w=520,h=92,sk=22,x=-w/2,y=0,L=T%LOOP;
  g.save();g.translate(P.x,P.y);g.scale(P.k,P.k);
  const sIn=eExpo(seg(T,.16,.6)),sIn2=eExpo(seg(T,.24,.68));if(sIn2<=0&&sIn<=0){g.restore();return;}
  const band=dx=>[[x+sk+dx,y],[x+w+dx,y],[x+w-sk+dx,y+h],[x+dx,y+h]];
  g.save();g.translate(10-(1-sIn2)*1100,10);poly(g,band(0));g.fillStyle=V;g.fill();g.lineWidth=3;g.strokeStyle=INK;g.stroke();g.restore();
  g.save();g.translate(-(1-sIn)*1100,0);
  poly(g,band(0));g.fillStyle=INK;g.fill();
  g.save();poly(g,band(0));g.clip();
  g.fillStyle='rgba(255,255,255,.18)';for(let yy=y+4;yy<y+h;yy+=8)for(let xx=x+w-130+((yy/8)%2?4:0);xx<x+w;xx+=8){const k=Math.max(0,1-Math.hypot(xx-(x+w),yy-(y+h))/140);if(k>.08){g.beginPath();g.arc(xx,yy,2*k,0,TAU);g.fill();}}
  const sp=T<1.6?seg(T,.6,1.4):seg(L,.2,1.2);const sx=x-120+sp*(w+260);g.fillStyle='rgba(255,255,255,.16)';poly(g,[[sx,y],[sx+40,y],[sx+40-h*.45,y+h],[sx-h*.45,y+h]]);g.fill();
  g.restore();
  // 菱形 10 小時（數字從 0 跳到 10）
  const dcx=x+sk+76,dcy=y+h/2,dp=eBack(seg(T,.5,.78),2.2);
  if(dp>0){
    g.save();g.translate(dcx,dcy);g.scale(dp,dp);
    g.save();g.rotate(T*.9);g.strokeStyle=VL;g.lineWidth=2;g.strokeRect(-37,-37,74,74);g.restore();
    g.save();g.rotate(Math.PI/4);g.fillStyle=V;g.fillRect(-28,-28,56,56);g.lineWidth=3;g.strokeStyle=WHITE;g.strokeRect(-28,-28,56,56);g.restore();
    const n=Math.round(10*eOut(seg(T,.6,1.3)));g.textAlign='center';g.font='400 34px '+F_NUM;g.lineJoin='round';g.lineWidth=6;g.strokeStyle=INK;g.strokeText(String(n),0,12);g.fillStyle=WHITE;g.fillText(String(n),0,12);g.textAlign='left';
    const fp=seg(T,1.3,1.75);if(fp>0&&fp<1){g.save();g.rotate(Math.PI/4);const r=30+34*eOut(fp);g.strokeStyle=rgba(WHITE,1-fp);g.lineWidth=4*(1-fp)+1;g.strokeRect(-r,-r,r*2,r*2);g.restore();}
    g.restore();
    if(T>1.3&&T<2){const k=seg(T,1.3,2),tw=Math.sin(k*Math.PI);for(const [a,b] of [[-46,-34],[44,-30],[-40,36],[46,32]])sparkle(g,dcx+a*(1+k*.3),dcy+b*(1+k*.3),7*tw,VL);}
  }
  // 右邊文字：一個字一個字跳上來
  const tx=x+sk+150;g.fillStyle=VL;g.fillRect(tx-20,y+20,2,h-40);
  const title='已獲得與 '+o.cc.nm+' 的羈絆',ts=fitFont(g,title,'700',28,F_ZH,w-(tx-x)-36,16);g.font='700 '+ts+'px '+F_ZH;
  let cx=tx;[...title].forEach((ch,i)=>{const p=eBack(seg(T,.62+i*.045,.8+i*.045),2);const cw=g.measureText(ch).width;
    if(p>0){g.save();g.globalAlpha=clamp(p);g.translate(cx+cw/2,y+50+(1-p)*14);g.scale(1,.6+.4*p);g.fillStyle=WHITE;g.textAlign='center';g.fillText(ch,0,0);g.restore();}cx+=cw;});
  const l2=seg(T,1.05,1.4);if(l2>0){g.save();g.globalAlpha=l2;g.fillStyle=VL;g.font='700 12px '+F_ZH;g.fillText(o.cc.nm+'角色框 已解鎖  ✦  TOGETHER 10 HOURS',tx+(1-eOut(l2))*20,y+72);g.restore();}
  g.restore();
  // 名字頁籤（從上面掉下來）
  const tp=eBack(seg(T,.48,.74),1.6);
  if(tp>0){
    const who=o.name,ns=fitFont(g,who,'700',22,F_ZH,200,13),whoW=g.measureText(who).width;g.font='700 11px '+F_EN;const enW=g.measureText('✦ ACHIEVEMENT UNLOCKED').width;
    const lx=x+sk+10,ly=y-38-(1-tp)*50,th=34,tabW=whoW+enW+48;
    g.save();g.globalAlpha=clamp(tp);poly(g,[[lx,ly],[lx+tabW,ly],[lx+tabW-8,ly+th],[lx-8,ly+th]]);g.fillStyle=CREAM;g.fill();g.lineWidth=3;g.strokeStyle=INK;g.stroke();
    g.fillStyle=V;g.fillRect(lx+2,ly+3,5,th-6);g.textBaseline='middle';g.fillStyle=INK;g.font='700 '+ns+'px '+F_ZH;g.fillText(who,lx+16,ly+th/2+1);
    g.fillStyle=VD;g.font='700 11px '+F_EN;g.fillText('✦ ACHIEVEMENT UNLOCKED',lx+28+whoW,ly+th/2+1);g.textBaseline='alphabetic';g.restore();
  }
  // 細線、小三角、四芒星
  const lp=seg(T,.7,1.1)*(.6+.4*Math.sin(T*2));if(lp>0){g.fillStyle=V;g.fillRect(x-64*lp-8,y+h+10,64*lp,3);g.fillRect(x+w+10,y-12,64*lp,3);
    g.save();g.translate(x+w+24,y+h-4);g.rotate(T*1.4);g.strokeStyle=V;g.lineWidth=3;poly(g,[[0,-9],[8,6],[-8,6]]);g.stroke();g.restore();
    const tw=.6+.4*Math.max(0,Math.sin(T*3.4));star4(g,x+8,y-4,14*tw);g.fillStyle=WHITE;g.fill();g.lineWidth=3;g.strokeStyle=INK;g.stroke();}
  g.restore();
}

// 大字鏤空浮水印 BOND：壓在兩個角色後面，慢慢左右飄
function watermark(g,o,T,M){
  const wa=seg(T,.3,1);if(wa<=0)return;
  g.save();g.globalAlpha=wa*.42;g.font='400 '+M.z+'px '+F_TITLE;g.lineWidth=3;g.lineJoin='round';g.strokeStyle=shade(o.cc.c,.6);g.textAlign='center';
  g.strokeText('BOND',M.x+(1-eOut(wa))*120+Math.sin(T*.5)*10,M.y);g.restore();
}

/* ── 頭像框＋老闆小人（舞台座標） ── */
// 小人原圖面向右；冒險者站定、愛心冒出來時老闆轉身看她（同大廳轉向：橫向壓扁翻面），之後一直面向左
const TURN=1.4;
function doll(g,o,T,cx,cy){
  const pulse=Math.max(0,Math.sin(T*TAU/1.6)),sqx=1+pulse*.031,sqy=1-pulse*.044,L=T%LOOP;
  const tp=seg(T,TURN,TURN+.18),face=1-2*(tp<.5?2*tp*tp:1-2*(1-tp)*(1-tp)),lift=Math.sin(tp*Math.PI)*4;
  const fr=((L>2.0&&L<2.14)?o.blinkFrames:o.frames)[Math.floor(T*5)%4];
  const k=DS/64,footY=cy-DS/2+(o.foot+1)*k-lift,m=g.getTransform();g.imageSmoothingEnabled=false;
  if(Math.abs(m.b)>1e-4||Math.abs(m.c)>1e-4){const dw=fr.width*k*sqx,dh=fr.height*k*sqy;g.save();g.translate(cx,0);g.scale(face,1);g.drawImage(fr,-dw/2,footY-((o.foot+2)/fr.height)*dh,dw,dh);g.restore();return;}
  // 底圖整數倍（靜止時每格像素一樣大），呼吸時整張壓扁（D：小人動作要整張縮放）
  const n=Math.max(1,Math.round(k*m.a)),dw=Math.round(fr.width*n*sqx*Math.abs(face)),dh=Math.round(fr.height*n*sqy),X=m.a*cx+m.e,Y=m.d*footY+m.f;
  if(dw<1)return;const x0=Math.round(X-dw/2),y0=Math.round(Y-((o.foot+2)/fr.height)*dh);
  g.save();g.imageSmoothingEnabled=false;
  if(face<0){g.setTransform(-1,0,0,1,0,0);g.drawImage(fr,-(x0+dw),y0,dw,dh);}else{g.setTransform(1,0,0,1,0,0);g.drawImage(fr,x0,y0,dw,dh);}
  g.restore();
}
function innerPanel(g,o,T,x,y,s){
  const V=o.cc.c;g.drawImage(o.dots,x,y,s,s);
  const off=(T*14)%24;g.strokeStyle=shade(V,.74);g.lineWidth=5;
  for(let k=-s;k<s*2;k+=24){g.beginPath();g.moveTo(x+k+off,y);g.lineTo(x+k+off-s*.6,y+s);g.stroke();}
}
// 框圖上掃過一道斜光（只亮在框的圖案上）
function sheen(g,o,p,alpha){
  if(p<=0||p>=1)return;const s=Math.round(FS*o.res),c=o.sheenCv,cg=c.getContext('2d');if(c.width!==s){c.width=s;c.height=s;}
  cg.globalCompositeOperation='source-over';cg.clearRect(0,0,s,s);cg.drawImage(o.frameImg,0,0,s,s);cg.globalCompositeOperation='source-in';
  const sx=-s*.5+p*s*1.9,gr=cg.createLinearGradient(sx,0,sx+s*.34,s*.34);
  gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,'+alpha+')');gr.addColorStop(1,'rgba(255,255,255,0)');
  cg.fillStyle=gr;cg.fillRect(0,0,s,s);cg.globalCompositeOperation='source-over';g.drawImage(c,-FS/2,-FS/2,FS,FS);
}
function frameStage(g,o,T,F){
  const V=o.cc.c,L=T%LOOP,ent=seg(T,.5,LAND);if(ent<=0)return;
  const land=seg(T,LAND,LAND+.32),bounce=1+.06*Math.sin(land*TAU)*(1-land);
  const sc=(T<LAND?1+1.5*(1-eIn(ent)):1)*bounce,rot=T<LAND?-.4*(1-eIn(ent)):0,bob=Math.sin(T*1.7)*3*seg(T,1.6,2.4);
  g.save();g.translate(F.cx,F.cy+bob);
  // 後面兩層細框（反方向慢慢轉）
  const ba=seg(T,LAND,LAND+.4);
  if(ba>0){g.save();g.globalAlpha=ba;g.save();g.rotate(T*.14);g.strokeStyle=INK;g.lineWidth=2.5;g.strokeRect(-FS*.5,-FS*.5,FS,FS);g.restore();
    g.save();g.rotate(-T*.2+.3);g.strokeStyle=V;g.lineWidth=4;g.strokeRect(-FS*.56,-FS*.56,FS*1.12,FS*1.12);g.restore();g.restore();}
  g.rotate(rot);g.scale(sc,sc);g.globalAlpha=seg(T,.5,.62);
  g.save();g.beginPath();g.rect(-DS/2,-DS/2,DS,DS);g.clip();innerPanel(g,o,T,-DS/2,-DS/2,DS);
  const dp=eBack(seg(T,LAND+.05,LAND+.38),2.4);
  if(dp>0){const footY=DS/2-6;g.save();g.translate(0,footY);g.scale(dp,dp);g.translate(0,-footY);doll(g,o,T,0,4);g.restore();}
  g.restore();
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(o.frameImg,-FS/2,-FS/2,FS,FS);
  // 掃光：落地一次強的；之後每輪掃一次
  if(T<2)sheen(g,o,seg(T,LAND+.05,LAND+.65),.95);else sheen(g,o,seg(L,1.15,1.95),.8);
  // 落地白閃
  const fl=1-seg(T,LAND,LAND+.28);
  if(T>=LAND&&fl>0){g.save();g.globalCompositeOperation='lighter';const gr=g.createRadialGradient(0,0,0,0,0,FS*.75);gr.addColorStop(0,'rgba(255,255,255,'+(.95*fl)+')');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(-FS,-FS,FS*2,FS*2);g.restore();}
  g.restore();
  // 框角兩顆四芒星
  const tw=ph=>(.55+.45*Math.max(0,Math.sin(T*3+ph)))*seg(T,1.2,1.6);
  sparkle(g,F.cx+FS/2-6,F.cy-FS/2+26+bob,12*tw(0),shade(V,.55));sparkle(g,F.cx-FS/2+10,F.cy+FS/2-46+bob,9*tw(2),WHITE);
}
function ribbon(g,o,T,R){
  const st=seg(T,1.32,1.52);if(st<=0)return;
  const V=o.cc.c,sc=1+.9*(1-eIn(st)),wob=T<1.9?Math.sin(seg(T,1.52,1.9)*Math.PI*3)*.05*(1-seg(T,1.52,1.9)):0;
  g.save();g.translate(R.x,R.y);g.rotate(-.16+wob);g.scale(sc*R.k,sc*R.k);g.globalAlpha=seg(T,1.32,1.4);
  const B=[[-96,-21],[100,-21],[88,21],[-108,21]];
  g.save();g.translate(6,6);poly(g,B);g.fillStyle=V;g.fill();g.lineWidth=3;g.strokeStyle=INK;g.stroke();g.restore();
  poly(g,B);g.fillStyle=INK;g.fill();g.lineWidth=3;g.strokeStyle=WHITE;g.stroke();
  g.save();poly(g,B);g.clip();const sx=-160+seg(T%LOOP,.4,1.1)*340;g.fillStyle='rgba(255,255,255,.22)';poly(g,[[sx,-21],[sx+24,-21],[sx+12,21],[sx-12,21]]);g.fill();g.restore();
  g.fillStyle=WHITE;g.font='400 25px '+F_TITLE;g.textAlign='center';g.textBaseline='middle';g.fillText('UNLOCKED',-4,2);
  const lab=o.cc.nm+'角色框';g.font='700 13px '+F_ZH;const lw=g.measureText(lab).width+28;
  poly(g,[[-92,25],[-92+lw,25],[-98+lw,49],[-98,49]]);g.fillStyle=CREAM;g.fill();g.lineWidth=2.5;g.strokeStyle=INK;g.stroke();
  g.fillStyle=INK;g.textAlign='left';g.fillText(lab,-82,38);g.textBaseline='alphabetic';
  g.restore();
}
// 冒險者（滑進來）＋對話框（彈出）；對話框冒出來時小跳一次，之後每輪跳一次
function companion(g,o,T,C){
  const ent=seg(T,1.08,1.45);if(ent<=0)return;
  const dx=(1-eBack(ent,1.3))*-280,fr=o.compFrames[Math.floor(T*5)%16],cp=C.cp;   // 手機版冒險者小一點（每格 1.5 點，手機螢幕上仍是整數像素）
  const hp=T<2.6?seg(T,1.5,1.86):seg((T-2.6)%LOOP,0,.36),hop=Math.round(Math.sin(hp*Math.PI)*10/cp)*cp,sh=1-hop/48;
  g.save();g.globalAlpha=seg(T,1.08,1.2);g.translate(dx,0);
  g.fillStyle='rgba(20,12,40,.28)';g.beginPath();g.ellipse(C.x+fr.width*cp/2,C.y+(o.foot0+1)*cp,70*sh*cp/CP,9*sh*cp/CP,0,0,TAU);g.fill();
  const at=crisp(g,fr,C.x,C.y-hop,cp),bp=eBack(seg(T,1.45,1.66),2.4);
  // 對話框：尾巴尖端貼在實際畫出來的冒險者頭頂左上角；格子比冒險者大一半，彈出時一格一格長大
  if(bp>0&&at){const beat=T>1.7&&((T-1.7)%.8)<.13,nb=Math.max(1,Math.round(at.n*BP/CP*bp)),tx=at.X+o.tip.x*at.n,ty=at.Y+o.tip.y*at.n;
    dev(g,beat?o.bubB:o.bubN,tx-13.5*nb,ty-13*nb-(beat?nb:0),nb);}
  g.restore();
}

/* ── 整個畫面一格 ── */
function draw(g,o,T,vw,vh){
  g.clearRect(0,0,vw,vh);
  const Lo=layout(vw,vh),s=Lo.s,shake=T>=LAND?7*(1-seg(T,LAND,LAND+.35)):0;
  const sxo=Lo.ox+(shake?Math.sin(T*97)*shake:0),syo=Lo.oy+(shake?Math.cos(T*83)*shake:0);
  const fx=sxo+Lo.frame.cx*s,fy=syo+Lo.frame.cy*s;
  background(g,o,T,vw,vh,fx,fy,s);
  g.save();g.translate(sxo,syo);g.scale(s,s);
  watermark(g,o,T,Lo.wm);frameStage(g,o,T,Lo.frame);companion(g,o,T,Lo.comp);ribbon(g,o,T,Lo.ribbon);plate(g,o,T,Lo.plate);
  g.restore();
  shards(g,o,T,fx,fy,s);
  opening(g,o,T,vw,vh,fy);
}

/* ── 素材 ── */
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const img=src=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(Error('IMG '+src));im.src=src;});
async function fonts(name,nm){
  if(!document.fonts||!document.fonts.load)return;
  const zh='已獲得與的羈絆角色框解鎖點一下任何地方關閉'+nm+(name||'');
  try{await Promise.all([document.fonts.load('700 24px "TT Huninn"',zh),document.fonts.load('400 34px "Tavern Numerals"','0123456789'),
    document.fonts.load('700 12px "Tavern Numerals"','ACHIEVEMENT UNLOCKED TOGETHER 10 HOURS'),document.fonts.load('400 50px "TT Title"','BOND UNLOCKED')]);}catch(_){}
}
// 老闆小人（同 vip-card.js：4 張頭髮擺動＋4 張閉眼；重畫到前後兩次一樣才算，部件圖才載齊）
async function dollFrames(d){
  const mk=(blink,phase)=>{const c=document.createElement('canvas');c.width=c.height=64;drawDollTo(c,{...d,_blink:blink},'idle',{mode:'idle',phase});return c;};
  const sig=cs=>cs.map(c=>{const x=c.getContext('2d').getImageData(0,0,64,64).data;let h=0;for(let i=0;i<x.length;i+=3)h=(h*31+x[i])>>>0;return h;}).join(',');
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
// 冒險者 16 格（每格加白邊）；對話框尾巴尖端＝頭頂左上角；foot0＝腳底那一排
async function compFrames(asset){
  const sh=await img('img/companions-v352/'+asset+'-staff-sheet.png');const fw=sh.width/16,fh=sh.height,out=[];
  for(let k=0;k<16;k++){const c=document.createElement('canvas');c.width=fw;c.height=fh;c.getContext('2d').drawImage(sh,-k*fw,0);out.push(outline(c));}
  const c0=out[0],W0=c0.width,H0=c0.height,d=c0.getContext('2d').getImageData(0,0,W0,H0).data,A=(x,y)=>d[(y*W0+x)*4+3]>80,row=y=>{for(let x=0;x<W0;x++)if(A(x,y))return true;return false;};
  let top=0;while(top<H0-1&&!row(top))top++;let bot=H0-1;while(bot>0&&!row(bot))bot--;
  let left=W0;for(let y=top;y<Math.min(H0,top+30);y++)for(let x=0;x<left;x++)if(A(x,y)){left=x;break;}
  return {compFrames:out,tip:{x:left+5,y:top+9},foot0:bot};
}
function prerender(cc){
  const VL=shade(cc.c,.55),rays=document.createElement('canvas');rays.width=rays.height=512;
  const rg=rays.getContext('2d');rg.translate(256,256);const gr=rg.createRadialGradient(0,0,256*.12,0,0,256);
  gr.addColorStop(0,rgba(VL,.26));gr.addColorStop(.55,rgba(VL,.08));gr.addColorStop(1,rgba(VL,0));rg.fillStyle=gr;
  for(let k=0;k<14;k++){const a=k/14*TAU,w=k%2?.07:.12;rg.beginPath();rg.moveTo(0,0);rg.arc(0,0,256,a-w,a+w);rg.closePath();rg.fill();}
  const dots=document.createElement('canvas'),D=DS*2;dots.width=dots.height=D;const dg=dots.getContext('2d');dg.scale(2,2);
  dg.fillStyle=shade(cc.c,.86);dg.fillRect(0,0,DS,DS);dg.fillStyle=shade(cc.c,.62);
  for(let yy=4;yy<DS;yy+=9)for(let xx=(yy/9%2?4:0);xx<DS;xx+=9){const k=Math.max(0,1-Math.hypot(xx-DS,yy-DS)/(DS*1.1));if(k>.12){dg.beginPath();dg.arc(xx,yy,1.8*k+.4,0,TAU);dg.fill();}}
  return {rays,dots,bubN:bubbleImg(false),bubB:bubbleImg(true)};
}
function particles(cc){
  const r=rng(cc.nm.charCodeAt(0)*7919),cols=[cc.c,cc.a,WHITE,shade(cc.c,.5),INK],sh=[],mo=[];
  for(let k=0;k<26;k++)sh.push({a:k/26*TAU+r()*.2,d0:FS*.38,v:420+r()*480,life:.85+r()*.6,r:r()*TAU,spin:(r()-.5)*14,z:4+r()*5,k:k%4,c:cols[k%5===4?4:k%4]});
  for(let k=0;k<16;k++)mo.push({x:r(),y:r(),v:10+r()*18,ph:r()*TAU,z:4+r()*5,k:k%3,c:k%2?shade(cc.c,.55):cc.a});
  return {shards:sh,motes:mo};
}

/* ── 音效（Web Audio 現場合成；跟大廳「音效」開關走；瀏覽器還不讓出聲時就安靜，不補放） ── */
let ac=null,noiseBuf=null;
function audioCtx(){
  if(window.__sfxOn===false)return null;
  try{if(!ac){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ac=new AC();}if(ac.state==='suspended')ac.resume().catch(()=>{});}catch(_){return null;}
  return ac.state==='running'?ac:null;
}
function sounds(intro){
  const c=audioCtx();if(!c)return null;
  const out=c.createGain();out.gain.value=.8;out.connect(c.destination);const t0=c.currentTime+.03;
  if(!noiseBuf){noiseBuf=c.createBuffer(1,c.sampleRate*.6,c.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const env=(gn,t,v,a,d)=>{gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(v,t+a);gn.gain.exponentialRampToValueAtTime(.0001,t+a+d);};
  const tone=(t,f0,f1,type,v,d,a=.005)=>{const o=c.createOscillator(),gn=c.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+d*.9);env(gn,t,v,a,d);o.connect(gn).connect(out);o.start(t);o.stop(t+a+d+.05);};
  const noise=(t,ft,f0,f1,q,v,d,a=.01)=>{const n=c.createBufferSource(),f=c.createBiquadFilter(),gn=c.createGain();n.buffer=noiseBuf;f.type=ft;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+a+d);env(gn,t,v,a,d);n.connect(f).connect(gn).connect(out);n.start(t);n.stop(t+a+d+.05);};
  if(intro){
    noise(t0+.06,'bandpass',500,3200,1.2,.10,.36,.08);                                   // 斜切光帶「咻」
    noise(t0+.52,'lowpass',300,2400,.8,.12,.36,.3);tone(t0+.55,180,520,'sine',.05,.36,.3);  // 頭像框掉下來
    tone(t0+LAND,130,42,'sine',.55,.42,.004);noise(t0+LAND,'lowpass',1400,300,.7,.32,.22,.004);   // 砸下「咚」
    tone(t0+LAND+.01,1760,1760,'triangle',.08,.5);tone(t0+LAND+.02,2637,2637,'sine',.05,.6);     // 白閃「鏘」
    for(let k=1;k<=10;k++){const x=1-Math.cbrt(1-(k-.5)/10);tone(t0+.6+x*.7,820+k*70,820+k*70,'square',.022,.045,.002);}   // 數字跳
    [1047,1319,1568,2093].forEach((f,i)=>tone(t0+1.3+i*.075,f,f,'triangle',.09,.55-i*.05,.006));  // 數到 10 的上揚和弦
    tone(t0+1.52,220,70,'sine',.32,.16,.003);noise(t0+1.52,'highpass',1800,900,.6,.18,.09,.002);   // 蓋章「啪」
    tone(t0+1.47,620,1240,'sine',.07,.09,.004);                                                    // 對話框「啵」
  }
  return {stop(){try{out.gain.cancelScheduledValues(c.currentTime);out.gain.setValueAtTime(out.gain.value,c.currentTime);out.gain.linearRampToValueAtTime(0,c.currentTime+.08);setTimeout(()=>out.disconnect(),300);}catch(_){}}};
}

/* ── 彈窗：模糊遮罩＋全螢幕畫布，點任何地方關閉 ── */
function css(){
  if(document.getElementById('fcCeleCss'))return;const st=document.createElement('style');st.id='fcCeleCss';
  st.textContent='.fcCele{position:fixed;inset:0;z-index:99990;cursor:pointer;opacity:0;transition:opacity .25s ease;touch-action:none;user-select:none;-webkit-user-select:none;'
   +'background:radial-gradient(circle at 50% 50%,rgba(70,48,140,.5),rgba(12,8,28,.84) 72%);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}'
   +'.fcCele.on{opacity:1}.fcCele.off{opacity:0;transition-duration:.22s}'
   +'.fcCele canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
   +'.fcCele .fcHint{position:absolute;left:0;right:0;bottom:max(12px,env(safe-area-inset-bottom));text-align:center;color:#fff;font:700 13px "TT Huninn","Huninn",sans-serif;letter-spacing:2px;line-height:1.7;text-shadow:0 1px 4px rgba(0,0,0,.6);opacity:0;animation:fcHint .6s ease 2s forwards}'
   +'.fcCele .fcHint b{display:block;font-size:14px;letter-spacing:1px}.fcCele .fcHint span{opacity:.75}.fcCele.ff .fcHint{animation-delay:.1s}'
   +'@keyframes fcHint{to{opacity:.8}}';
  document.head.appendChild(st);
}
let open=null;
async function show({cid,id,doll:dl,name,freeze}={}){   // freeze＝固定在第幾秒（測試截圖用）
  const cc=cid?COMP[cid]:Object.values(COMP).find(c=>c.id===id);if(!cc)throw Error('UNKNOWN_COMPANION');
  if(open)open.close(true);
  await fonts(name,cc.nm);
  const [d,c,frameImg]=await Promise.all([dollFrames(dl||{}),compFrames(cc.asset),img('img/frames/companions/'+cc.id+'.png')]);
  css();
  const box=document.createElement('div');box.className='fcCele';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  box.setAttribute('aria-label',(name||'老闆')+' 已獲得與 '+cc.nm+' 的羈絆，解鎖'+cc.nm+'角色框。點一下任何地方關閉');
  const cv=document.createElement('canvas'),hint=document.createElement('div');hint.className='fcHint';
  const h1=document.createElement('b');h1.textContent='到「闆卡手帳 → 頭像框」就能換上 '+cc.nm+'角色框';const h2=document.createElement('span');h2.textContent='點一下任何地方關閉';hint.append(h1,h2);
  box.append(cv,hint);document.body.appendChild(box);
  const g=cv.getContext('2d'),o={...d,...c,...particles(cc),...prerender(cc),cc,frameImg,res:1,sheenCv:document.createElement('canvas'),name:String(name||'').slice(0,20)||'老闆'};
  let vw=0,vh=0,dpr=1;
  const fit=()=>{vw=box.clientWidth||innerWidth;vh=box.clientHeight||innerHeight;dpr=Math.min(2,Math.max(1,devicePixelRatio||1),3200/Math.max(1,vw));
    cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);o.res=layout(vw,vh).s*dpr;};
  fit();addEventListener('resize',fit);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,INTRO=1.9;let t0=performance.now()-(reduce?2600:0);
  const snd=freeze>=0?null:sounds(!reduce);
  let raf=0;const tick=now=>{raf=requestAnimationFrame(tick);const T=freeze>=0?freeze:(now-t0)/1000;g.setTransform(dpr,0,0,dpr,0,0);g.save();draw(g,o,T,vw,vh);g.restore();};
  raf=requestAnimationFrame(tick);requestAnimationFrame(()=>box.classList.add('on'));
  const born=performance.now();
  return new Promise(res=>{
    const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();tap();}};
    // 開場還沒播完：點一下直接跳到完成畫面（音效收掉）；播完之後再點才關
    const tap=()=>{if(!(freeze>=0)&&(performance.now()-t0)/1000<INTRO){t0=performance.now()-INTRO*1000;box.classList.add('ff');snd&&snd.stop();return;}close();};
    const close=quick=>{if(open!==api)return;open=null;snd&&snd.stop();removeEventListener('keydown',key,true);removeEventListener('resize',fit);
      const end=()=>{cancelAnimationFrame(raf);box.remove();res();};if(quick)return end();box.classList.add('off');setTimeout(end,230);};
    const api={close};open=api;
    box.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(performance.now()-born>250)tap();});
    box.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
    addEventListener('keydown',key,true);
  });
}

/* ── 解鎖偵測 ── */
const G=n=>{try{return n==='myKey'?(typeof myKey!=='undefined'?myKey:null):n==='me'?(typeof me==='function'?me():null):null;}catch(_){return null;}};
const seenKey=k=>'tt_fc_seen_'+k;
function seen(k){try{const v=JSON.parse(localStorage.getItem(seenKey(k))||'[]');return Array.isArray(v)?v:[];}catch(_){return [];}}
function markSeen(k,id){try{const s=seen(k);if(!s.includes(id)){s.push(id);localStorage.setItem(seenKey(k),JSON.stringify(s));}}catch(_){}}
let busy=false;
function blocked(){return document.hidden||!!document.getElementById('ttCoach')?.offsetParent||!!open;}
async function check(){
  if(busy)return;const r=window.TTCompanionRewards,k=G('myKey');
  if(!r||!k||r.key!==k||!Array.isArray(r.frames))return;
  const todo=r.frames.filter(f=>f&&f.unlocked===true&&Object.values(COMP).some(c=>c.id===f.id)&&!seen(k).includes(f.id));
  if(!todo.length)return;
  const a=G('me');if(!a||!a.b||!a.b.doll||blocked())return;   // 小人還沒載好、教學或別的慶祝在跑：下一輪再試
  busy=true;
  try{const f=todo[0];markSeen(k,f.id);await show({id:f.id,doll:a.b.doll,name:a.b.name||''});}
  catch(e){console.warn('[companion-celebrate]',e&&e.message||e);}
  finally{busy=false;}
  if(todo.length>1)setTimeout(check,700);
}
addEventListener('tt-companion-rewards',()=>setTimeout(check,1200));
setInterval(check,5000);
root.TTCompanionCelebrate={show,check,COMP};
})(window);
