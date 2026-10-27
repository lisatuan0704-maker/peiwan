/* v443 時裝特效：穿上指定部件就觸發（目前喵頻連線）。在 64px 角色畫布上逐像素繪製，商城試穿區使用。
   綁定：幻彩視界→護目鏡掃光、浮游訊號盒→訊號盒光點、喵訊連接線→電線資料流、喵訊接收耳→故障閃爍、環音耳機→數字飄字。
   特效外觀與 meow-fx-preview.html 使用者選定的版本相同。 */
window.TTOutfitFx=(()=>{'use strict';
const S=64;
const BIND={season292_meow:{acc3:'sweep',acc7:'spark',acc2:'flow',acc4:'glitch',acc6:'bits'},
  // v447 疾風喵行：冰藍風鏡→風鏡反光、藍軌滑板→滑板殘影、晴空小翼→翅膀氣流、墨影貓尾→貓尾星光、逐風機能外套→風痕線條
  season293_wind:{acc7:'glint',acc8:'board',acc1:'puff',acc2:'tailstar',acc3:'gust',acc6:'snow'}};   // v447 夜行貓耳帽→風雪
const MASK={sweep:'acc3',spark:'acc7',flow:'acc2',glint:'acc7',board:'acc8',puff:'acc1',tailstar:'acc2'};
const masks={};   // `${source}:${slot}` → {data, path, box} 或 'loading'
function partOf(source,slot){return window.TTSeasonDrafts?.[source]?.parts?.[slot]||null;}
function mask(source,slot){
  const k=source+':'+slot,m=masks[k];if(m&&m!=='loading')return m;if(m)return null;
  const p=partOf(source,slot);if(!p?.d)return null;masks[k]='loading';
  const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(img,0,0,S,S);const data=g.getImageData(0,0,S,S).data;masks[k]={data,cv:c,box:bbox(data),path:MASK.flow===slot&&source==='season292_meow'?cablePath(data):null};};
  img.onerror=()=>{delete masks[k];};img.src=p.d;return null;
}
function bbox(m){let b=null;for(let i=0;i<S*S;i++)if(m[i*4+3]>40){const x=i%S,y=(i/S)|0;if(!b)b={x0:x,x1:x,y0:y,y1:y};b.x0=Math.min(b.x0,x);b.x1=Math.max(b.x1,x);b.y0=Math.min(b.y0,y);b.y1=Math.max(b.y1,y);}return b;}
function cablePath(cm){
  const seen=new Int32Array(S*S).fill(-1),pts=[];let off=0;
  for(let i=0;i<S*S;i++)if(cm[i*4+3]>40)pts.push(i);
  pts.sort((a,b)=>(b%S)-(a%S)||(b-a));
  for(const s of pts){if(seen[s]>=0)continue;seen[s]=off;const q=[s];for(let h=0;h<q.length;h++){const i=q[h],x=i%S,y=(i/S)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=S||ny>=S)continue;const n=ny*S+nx;if(seen[n]>=0||cm[n*4+3]<=40)continue;seen[n]=seen[i]+1;q.push(n);}}let mx=0;for(const i of q)mx=Math.max(mx,seen[i]);off=mx+3;}
  const path=pts.map(i=>({x:i%S,y:(i/S)|0,d:seen[i]}));return {pts:path,max:Math.max(1,...path.map(p=>p.d))};
}
// 目前穿戴中、會觸發特效的部件
function active(d){
  if(!d)return [];const out=[];
  const refs=Array.isArray(d.uiAccessories)?d.uiAccessories:(d.set&&BIND[d.set]?Object.keys(BIND[d.set]).map(slot=>({source:d.set,slot})):[]);
  for(const r of refs){const fx=BIND[r?.source]?.[r.slot];if(fx&&!out.some(o=>o.fx===fx))out.push({fx,source:r.source,slot:r.slot});}
  return out;
}
const rnd=s=>{s=Math.sin(s*12.9898)*43758.5453;return s-Math.floor(s);};
const P=(g,x,y,c,a=1)=>{if(a<=0)return;g.globalAlpha=Math.min(1,a);g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),1,1);g.globalAlpha=1;};
function charBounds(src){const d=src.getContext('2d',{willReadFrequently:true}).getImageData(0,0,S,S).data;const b={x0:S,x1:0,y0:S,y1:0};for(let i=0;i<S*S;i++)if(d[i*4+3]>80){const x=i%S,y=(i/S)|0;b.x0=Math.min(b.x0,x);b.x1=Math.max(b.x1,x);b.y0=Math.min(b.y0,y);b.y1=Math.max(b.y1,y);}return {b,d};}
function sweep(g,t,m){const u=(t%2600)/900;if(u>1)return;const pos=-6+u*30;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){if(m.data[(y*S+x)*4+3]<60)continue;const v=Math.abs((x-22+(y-28)*0.8)-pos);if(v<1.2)P(g,x,y,'#ffffff',.9);else if(v<2.6)P(g,x,y,'#dffbff',.38);}}
function spark(g,t,m){const box=m.box;if(!box)return;
  for(let k=0;k<14;k++){const per=1500,ph=(t+k*per/14)%per/per,seed=Math.floor((t+k*per/14)/per)*31+k;const x=box.x0+rnd(seed)*(box.x1-box.x0+4)-2,y=box.y0+3-ph*14-rnd(seed+7)*3;
    const a=Math.sin(ph*Math.PI)*(0.55+0.45*Math.sin(t/70+k)),c=rnd(seed+3)>.7?'#ffffff':'#5ff3ff';
    if(rnd(seed+5)>.82&&ph>.2&&ph<.7){P(g,x,y-1,c,a);P(g,x-1,y,c,a);P(g,x+1,y,c,a);P(g,x,y+1,c,a);P(g,x,y,'#fff',a);}else P(g,x,y,c,a);}}
function flow(g,t,m){const {pts,max}=m.path,sp=max+18,heads=[(t/22)%sp,((t/22)+sp/2)%sp];
  for(const p of pts)for(const h of heads){const k=h-p.d;if(k>=0&&k<5)P(g,p.x,p.y,k<1.5?'#ffffff':'#7ff6ff',k<1.5?.95:.65-(k/5)*.4);}}
const FONT={0:['111','101','101','101','111'],1:['010','110','010','010','111']};
function bits(g,t,b){for(let k=0;k<5;k++){const per=2200,ph=((t+k*440)%per)/per,seed=Math.floor((t+k*440)/per)*13+k;if(rnd(seed)<.35)continue;
  const x=Math.round(b.x0-6+rnd(seed+1)*(b.x1-b.x0+10)),y=Math.round(b.y0+8+rnd(seed+2)*24-ph*10),a=Math.sin(ph*Math.PI)*.8,f=FONT[rnd(seed+3)>.5?1:0];
  f.forEach((row,ry)=>[...row].forEach((v,rx)=>{if(v==='1')P(g,x+rx,y+ry,'#7ff6ff',a);}));}}
// ---- v447 疾風喵行 ----
function gust(g,t,b){for(let k=0;k<7;k++){const per=900+rnd(k)*700,ph=((t+k*313)%per)/per,seed=Math.floor((t+k*313)/per)*17+k;
  const y=Math.round(b.y0+6+rnd(seed)*(b.y1-b.y0-4)),len=3+Math.round(rnd(seed+1)*6),x=S+4-ph*(S+20),a=Math.sin(ph*Math.PI)*.75;
  for(let i=0;i<len;i++)P(g,x+i,y,i<2?'#ffffff':'#bfe3ff',a*(1-i/len*.7));}}
function board(g,t,m){const b=m.box;if(!b)return;const u=(t%1200)/1200;
  for(const [dx,a] of [[2+u*1.5,.35],[4+u*2.5,.18]]){g.globalAlpha=a;g.drawImage(m.cv,-Math.round(dx),0);g.globalAlpha=1;}
  if(Math.floor(t/120)%5===0)P(g,b.x0-1,b.y1-1,'#ffffff',.8);}
function glint(g,t,m){const u=(t%2800)/900;if(u>1)return;const b=m.box;if(!b)return;const pos=b.x0-6+u*(b.x1-b.x0+14);
  for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++){if(m.data[(y*S+x)*4+3]<60)continue;const v=Math.abs((x-pos)+(y-b.y0)*0.7);if(v<1.2)P(g,x,y,'#ffffff',.9);else if(v<2.5)P(g,x,y,'#e6f6ff',.4);}}
function puff(g,t,m){const b=m.box;if(!b)return;for(const side of [0,1]){const ph=((t+side*700)%1500)/1500,x0=side?b.x1+1:b.x0-1,y0=b.y0+3,dir=side?1:-1,a=(1-ph)*.7,r=ph*4;
  for(const [dx,dy] of [[0,0],[1,-1],[1,1],[2,0]])P(g,x0+dir*(dx+r*1.5),y0+dy+ph*2,'#eaf6ff',a);}}
function tailstar(g,t,m){const b=m.box;if(!b)return;if(!m.tip){let tip=null;for(let i=0;i<S*S;i++){const j=i*4;if(m.data[j+3]>60&&m.data[j+2]>m.data[j]+40){const x=i%S,y=(i/S)|0;if(!tip||x<tip.x)tip={x,y};}}m.tip=tip||{x:b.x0,y:b.y1};}
  const tip=m.tip,u=(t%1800)/1800;if(u>.45)return;const a=Math.sin(u/.45*Math.PI);
  P(g,tip.x,tip.y-1,'#ffffff',a);P(g,tip.x-1,tip.y-1,'#9fd0ff',a*.7);P(g,tip.x+1,tip.y-1,'#9fd0ff',a*.7);P(g,tip.x,tip.y-2,'#9fd0ff',a*.7);P(g,tip.x,tip.y,'#9fd0ff',a*.7);
  for(let k=1;k<4;k++)P(g,tip.x-k*2,tip.y-1+k%2,'#8ec5ff',a*(.5-k*.12));}
function snow(g,t){for(let k=0;k<12;k++){const per=2600+rnd(k)*1400,ph=((t+k*517)%per)/per,seed=Math.floor((t+k*517)/per)*29+k;
  const x0=rnd(seed)*(S+24),x=x0-ph*22+Math.sin(ph*7+k)*1.6,y=-3+ph*(S+6),a=Math.min(1,ph*6,(1-ph)*5)*.85,big=rnd(seed+4)>.78;
  if(big){P(g,x,y,'#ffffff',a);P(g,x-1,y,'#dff1ff',a*.6);P(g,x+1,y,'#dff1ff',a*.6);P(g,x,y-1,'#dff1ff',a*.6);P(g,x,y+1,'#dff1ff',a*.6);}else P(g,x,y,rnd(seed+2)>.4?'#ffffff':'#cfe8ff',a);}}
const work=document.createElement('canvas');work.width=work.height=S;const wg=work.getContext('2d',{willReadFrequently:true});wg.imageSmoothingEnabled=false;
const tint=document.createElement('canvas');tint.width=tint.height=S;const tg=tint.getContext('2d',{willReadFrequently:true});
function tinted(d,r,gg,b){const im=tg.createImageData(S,S);for(let i=0;i<d.length;i+=4)if(d[i+3]>80){im.data[i]=r;im.data[i+1]=gg;im.data[i+2]=b;im.data[i+3]=170;}tg.putImageData(im,0,0);return tint;}
// src：64px 角色畫布；回傳加上特效的 64px 畫布（同一張，下一次呼叫會覆寫）
function render(src,t,list){
  wg.clearRect(0,0,S,S);const on=Object.fromEntries(list.map(o=>[o.fx,o]));let cb=null;const need=()=>cb||(cb=charBounds(src));
  if(on.glitch&&t%3800<240){const f=Math.floor(t/60),{d}=need();wg.globalCompositeOperation='lighter';wg.drawImage(tinted(d,255,40,90),-1-(f%2),0);wg.drawImage(tinted(d,40,230,255),1+(f%2),0);wg.globalCompositeOperation='source-over';
    for(let y=0;y<S;y+=3){const sh=rnd(f*7+y)>.72?Math.round((rnd(f+y)-.5)*6):0;wg.drawImage(src,0,y,S,3,sh,y,S,3);}}
  else{if(on.board){const m=mask(on.board.source,MASK.board);if(m)board(wg,t,m);}wg.drawImage(src,0,0);}
  for(const id of ['flow','sweep','spark']){const o=on[id];if(!o)continue;const m=mask(o.source,MASK[id]);if(!m)continue;if(id==='flow'&&m.path)flow(wg,t,m);if(id==='sweep')sweep(wg,t,m);if(id==='spark')spark(wg,t,m);}
  if(on.bits)bits(wg,t,need().b);
  for(const id of ['glint','puff','tailstar']){const o=on[id];if(!o)continue;const m=mask(o.source,MASK[id]);if(!m)continue;({glint,puff,tailstar})[id](wg,t,m);}
  if(on.gust)gust(wg,t,need().b);
  if(on.snow)snow(wg,t);
  return work;
}
return {active,render,bindings:BIND};
})();
