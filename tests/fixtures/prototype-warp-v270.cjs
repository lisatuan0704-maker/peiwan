/* 原始試做頁的形變取樣基準。 */
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

module.exports=warp;
