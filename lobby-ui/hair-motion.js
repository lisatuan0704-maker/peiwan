/* v267：採用試做頁「大」1.5 倍；只補原本相連髮絲形變後的縫。 */
(function(root){
  'use strict';
  function deform(src,mode,phase){
    const W=64,s=src.data,o=new Uint8ClampedArray(s.length),points=new Int16Array(W*W*2).fill(-1);
    const walking=mode==='walk',n=walking?8:4,i=((phase%n)+n)%n,prev=(i+n-1)%n;
    const b=walking?[0,-1,0,-1,0,-1,0,-1]:[0,-1,-1,0];
    const lean=[1,0,-1,0,1,0,-1,0],spread=[1.5,.5,-1.5,-.5];
    let tip=23;for(let y=22;y<W;y++)for(let x=0;x<W;x++)if(s[(y*W+x)*4+3])tip=Math.max(tip,y);
    function point(x,y){
      const t=Math.min(1,Math.max(0,(y-22)/Math.max(1,tip-22))),w=Math.pow(t,1.15);
      const dx=walking?Math.round(w*lean[prev])+Math.round(w*1.5*(-.7+1.8*Math.sin(Math.PI*2*i/8-2.4*w))):Math.round(w*spread[i]*1.5)*(x<32?-1:1);
      return [x+dx,y+Math.round((b[prev]-b[i])*w)];
    }
    function put(x,y,k,onlyEmpty){
      if(x<0||y<0||x>=W||y>=W)return;
      const d=(y*W+x)*4;if(onlyEmpty&&o[d+3])return;
      o[d]=s[k];o[d+1]=s[k+1];o[d+2]=s[k+2];o[d+3]=s[k+3];
    }
    for(let y=0;y<W;y++)for(let x=0;x<W;x++){
      const k=y*W+x;if(!s[k*4+3])continue;
      const [px,py]=point(x,y);points[k*2]=px;points[k*2+1]=py;put(px,py,k*4,false);
    }
    // 只連接原圖的上下／左右相鄰實色像素；不填原本透明的洞或髮絲間隙。
    for(let y=0;y<W;y++)for(let x=0;x<W;x++){
      const k=y*W+x;if(!s[k*4+3])continue;
      for(const q of [x<63?k+1:-1,y<63?k+W:-1]){
        if(q<0||!s[q*4+3])continue;
        const ax=points[k*2],ay=points[k*2+1],bx=points[q*2],by=points[q*2+1];
        const steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));
        for(let z=1;z<steps;z++)put(Math.round(ax+(bx-ax)*z/steps),Math.round(ay+(by-ay)*z/steps),(z/steps<.5?k:q)*4,true);
        // 一格斜接也補成連續像素，顏色取相鄰髮絲，保留原本漸層。
        if(ax!==bx&&ay!==by)put(bx,ay,q*4,true);
      }
    }
    return {data:o,width:W,height:W};
  }
  function paint(ctx,layer,motion){
    if(!motion){ctx.drawImage(layer,0,0);return;}
    const source=layer.getContext('2d').getImageData(0,0,64,64),out=deform(source,motion.mode,motion.phase);
    const g=layer.getContext('2d'),dd=g.createImageData(64,64);dd.data.set(out.data);g.putImageData(dd,0,0);ctx.drawImage(layer,0,0);
  }
  root.TTHairMotion={deform,paint,amplitude:1.5};
  if(typeof module==='object')module.exports=root.TTHairMotion;
})(typeof window==='undefined'?globalThis:window);
