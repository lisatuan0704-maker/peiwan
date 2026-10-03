/* v270：完整沿用試做頁的逐格形變與大幅度 1.5 倍，補色只取相連髮絲。 */
(function(root){
'use strict';
function warp(src,vy,dx,mirror){
  const out={data:new Uint8ClampedArray(64*64*4),width:64,height:64}, s=src.data, o=out.data, SX=new Int16Array(4096).fill(-1), SY=new Int16Array(4096);
  for(let y=0;y<64;y++){
    for(let x=0;x<64;x++){
      const sy=y-vy(y,x); if(sy<0||sy>63)continue;
      const d=dx?dx(sy):0;
      let sx = mirror ? (x<32? x+d : x-d) : x-d;
      if(sx<0||sx>63)continue;
      const si=(sy*64+sx)*4, di=(y*64+x)*4;
      if(!s[si+3])continue;
      o[di]=s[si];o[di+1]=s[si+1];o[di+2]=s[si+2];o[di+3]=s[si+3]; SX[y*64+x]=sx; SY[y*64+x]=sy;
    }
  }
  /* 自動補線:原圖上下相連的像素,被挪動後只剩斜角相接 → 補一格,輪廓就不會斷 */
  const op=(x,y)=>x>=0&&x<64&&y>=0&&y<64&&o[(y*64+x)*4+3]>0;
  for(let y=0;y<63;y++)for(let x=0;x<64;x++){
    const k=y*64+x; if(SX[k]<0)continue;
    for(const dd of [-1,1]){
      const x2=x+dd; if(x2<0||x2>63)continue; const k2=(y+1)*64+x2;
      if(SX[k2]<0||op(x2,y)||op(x,y+1))continue;
      const nearV=Math.abs(SX[k2]-SX[k])<=0&&SY[k2]-SY[k]===1, nearH=Math.abs(SX[k2]-SX[k])===1&&SY[k2]===SY[k];
      if(!nearV&&!nearH&&!(SY[k2]-SY[k]===1&&Math.abs(SX[k2]-SX[k])===1&&false))continue;
      if(!(nearV||nearH))continue;
      /* 補在上排延伸處,顏色取較暗的那一格(通常是描邊) */
      const a=k*4,b=k2*4, la=o[a]+o[a+1]+o[a+2], lb=o[b]+o[b+1]+o[b+2], c=la<=lb?a:b, t=(y*64+x2)*4;
      o[t]=o[c];o[t+1]=o[c+1];o[t+2]=o[c+2];o[t+3]=255; SX[y*64+x2]=SX[k]; SY[y*64+x2]=SY[k];
    }
  }
  return out;
}

const MODES={idle:{b:[0,-1,-1,0],spread:[1.5,.5,0,.5]},walk:{b:[0,-1,0,-1,0,-1,0,-1],lean:[1,0,-1,0,1,0,-1,0],arm:[1,0,-1,0,1,0,-1,0]}};
function deform(src,mode,phase,kind='hair'){
 const M=MODES[mode],n=M.b.length,i=((phase%n)+n)%n,prev=(i+n-1)%n,b=M.b[i],bp=M.b[prev],L=M.lean?M.lean[i]:0,Lp=M.lean?M.lean[prev]:0,arm=M.arm?M.arm[i]:0;
 const weight=y=>{const t=(y-(kind==='tail'?40:22))/(kind==='tail'?16:34);return t<=0?0:t>=1?1:Math.pow(t,1.15)};
 const arms=(y,x)=>arm&&x>=40&&y>=38&&y<=47?arm:arm&&x<=27&&y>=42&&y<=50?-arm:0;
 let vy,dx,mirror=false;
 if(kind==='hair'||kind==='tail'){
  vy=y=>Math.round(b*(1-weight(y))+bp*weight(y));
  dx=y=>{const w=weight(y);let v=Math.round(L*(1-w)+Lp*w);if(M.spread)v+=Math.round(w*M.spread[i]*1.5);else{const z=w*1.5;v+=Math.round(z*(-.7+1.8*Math.sin(Math.PI*2*i/8-2.4*z)))}return v};mirror=!!M.spread;
 }else if(kind==='body'||kind==='cloth'){
  vy=(y,x)=>(y<=46?b:0)+arms(y,x);dx=y=>y<=46?L:(kind==='cloth'&&y<=49?Lp:0);
 }else{vy=()=>b;dx=()=>L;}
 const out=warp(src,vy,dx,mirror);
 if(kind==='hair'||kind==='tail'){
  // 前向定位原本相連的髮絲，補回反向取樣跳列留下的空格；保留透明背景。
  const s=src.data,o=out.data,W=64;
  const point=(x,y)=>[x+(mirror?(x<32?-dx(y):dx(y)):dx(y)),y+vy(y,x)];
  const fill=(x,y,k)=>{if(x<0||y<0||x>=64||y>=64)return;const d=(y*64+x)*4;if(o[d+3])return;o[d]=s[k];o[d+1]=s[k+1];o[d+2]=s[k+2];o[d+3]=s[k+3]};
  for(let y=0;y<63;y++)for(let x=0;x<64;x++){
   const k=(y*64+x)*4,q=k+256;if(!s[k+3]||!s[q+3])continue;
   const [ax,ay]=point(x,y),[bx,by]=point(x,y+1),steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));
   for(let z=1;z<steps;z++)fill(Math.round(ax+(bx-ax)*z/steps),Math.round(ay+(by-ay)*z/steps),z/steps<.5?k:q);
   if(ax!==bx&&ay!==by)fill(bx,ay,q);
  }
 }
 return out;
}
function paint(ctx,layer,motion,kind='hair'){
 if(!motion){ctx.drawImage(layer,0,0);return;}
 const g=layer.getContext('2d'),out=deform(g.getImageData(0,0,64,64),motion.mode,motion.phase,kind),dd=g.createImageData(64,64);dd.data.set(out.data);g.putImageData(dd,0,0);ctx.drawImage(layer,0,0);
}
root.TTHairMotion={deform,paint,amplitude:1.5,MODES};if(typeof module==='object')module.exports=root.TTHairMotion;
})(typeof window==='undefined'?globalThis:window);
