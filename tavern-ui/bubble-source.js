/* 從大廳 v241 擷取的唯讀對話框合成器；不含登入、聊天或資料庫連線。 */
(()=>{
const TTBUB={"10": {"d": "bubble-assets/10.png", "t": "b", "g": {"mode": "3s", "gap": "-10px"}, "g9": {"W": 720, "H": 360, "L": 255, "R": 320, "T": 120, "B": 83, "tl": 107, "tr": 109, "tt": 112, "tb": 75, "r0": 0.24, "kmin": 0.6, "maxW": 260, "maxWm": 200, "fs": 10, "lh": 13}, "name": "花框"}, "11": {"d": "bubble-assets/11.png", "t": "b", "g": {"mode": "3s", "gap": "-6px"}, "g9": {"W": 118, "H": 77, "L": 52, "R": 42, "T": 36, "B": 31, "tl": 15, "tr": 12, "tt": 11, "tb": 11, "r0": 1, "kmin": 0.7, "vq": 0.72, "maxW": 250, "maxWm": 195, "fs": 10, "lh": 13}, "name": "泡泡框"}, "12": {"d": "bubble-assets/12.png", "t": "b", "g": {"mode": "3s", "gap": "-6px"}, "g9": {"mode": "h3", "W": 126, "H": 82, "L": 45, "R": 36, "tileX": 45, "tileW": 9, "tl": 43, "tr": 36, "tt": 15, "tb": 19, "r0": 0.8, "kmin": 0.7, "maxW": 240, "maxWm": 190, "fs": 10, "lh": 13}, "name": "餅乾框"}, "13": {"d": "bubble-assets/13.png", "t": "b", "g": {"mode": "3s", "gap": "-6px"}, "g9": {"W": 127, "H": 73, "L": 52, "R": 43, "T": 50, "B": 13, "tl": 42, "tr": 36, "tt": 20, "tb": 11, "r0": 1, "kmin": 0.7, "vq": 0.75, "maxW": 250, "maxWm": 195, "fs": 10, "lh": 13}, "name": "俏皮花貓框"}, "14": {"d": "bubble-assets/14.png", "t": "b", "g": {"mode": "3s", "gap": "-6px"}, "g9": {"W": 125, "H": 75, "L": 44, "R": 34, "T": 18, "B": 9, "tl": 28, "tr": 30, "tt": 24, "tb": 13, "r0": 1, "kmin": 0.7, "vq": 0.75, "maxW": 250, "maxWm": 195, "fs": 10, "lh": 13}, "name": "夢落星間"}};
const BUB_FORCE=null;let active="10";const BUB_IMGS={};function bubKeyFor(){return active;}function bubImg(k){return BUB_IMGS[k];}
function showBubble(a, text){
  if(!a || !a.el) return;
  if(a.bubEl) a.bubEl.remove();
  const b=document.createElement('div'); b.className='bub';
  { const _t=document.createElement('i'); _t.className='bubT'; _t.textContent=text; b.appendChild(_t); }
  /* v182:10 號新框文字區較小(寬68%、高19%),依字數挑一個裝得下的寬度,長訊息才不會被裁 */
  if(typeof BUB_FORCE!=='undefined' && BUB_FORCE==='10' && !document.body.classList.contains('bub3s')){
    try{
      const n=String(text||'').length, fs=10, lh=13;
      let w=210;
      for(let t=100;t<=210;t+=5){
        const lines=Math.ceil(n*fs*1.08/(t*0.68));
        if(lines*lh<=t*0.19){ w=t; break; }
      }
      b.style.width=w+'px';
    }catch(e){}
  }
  /* v186-v188:九宮格在單一 canvas 內合成(3 倍過採樣)—— 鏡頭是連續小數縮放,
     多元素拼片必出接縫線;單一 canvas 圖層怎麼縮放都無縫。
     v188 起幾何參數放在各框的 g9(每款框可有自己的切線/文字區/縮放),短句整框縮小、長句放大 */
  if(document.body.classList.contains('bub3s')){
    try{
      const bk=bubKeyFor(a), S=TTBUB[bk]&&TTBUB[bk].g9;
      try{ const gg=TTBUB[bk].g&&TTBUB[bk].g.gap; if(gg) b.style.setProperty('--bubGap',gg); }catch(e){}
      if(S&&S.mode==='h3'){
        /* v192:橫向三段 + 中段磁磚重複(斜紋邊框不能拉伸,只能整片重複);
           高度不拉伸:整體隨 k 縮放,需要更多行時提高 r(整框變大),條紋永遠是正的 */
        const str=String(text||'');
        const k=Math.max(S.kmin, Math.min(1, S.kmin+0.025*(str.length-2)));
        const lh=S.lh||13, fs=S.fs||10;
        let tp=0; for(const ch of str){ const c=ch.charCodeAt(0); tp+=(c<256?(c===32?0.35:0.62):1.05)*fs; }
        tp=Math.ceil(tp)+2;
        const mob=(window.matchMedia&&matchMedia('(max-width:680px)').matches);
        const maxW=mob?(S.maxWm||190):(S.maxW||240);
        const panelH=S.H-S.tt-S.tb;
        let r=S.r0*k, W2=0, lines=1;
        for(let L=1;L<=6;L++){
          const rr=Math.max(S.r0*k, (L*lh+8)/panelH);
          const inLr=Math.round(S.tl*rr), inRr=Math.round(S.tr*rr);
          const avail=maxW-inLr-inRr;
          if(Math.ceil(tp/avail)<=L){
            lines=L; r=rr;
            W2=Math.min(maxW, Math.max(Math.round((S.L+S.R)*r)+6, Math.ceil(tp/L)+inLr+inRr));
            break;
          }
          lines=L; r=rr; W2=maxW;
        }
        const Lw=Math.round(S.L*r), Rw=Math.round(S.R*r), H2=Math.round(S.H*r);
        const inL=Math.round(S.tl*r), inR=Math.round(S.tr*r), inT=Math.round(S.tt*r), inB=Math.round(S.tb*r);
        b.style.width=W2+'px'; b.style.height=H2+'px';
        const mw=W2-Lw-Rw;
        const OS=3, cv=document.createElement('canvas');
        cv.width=W2*OS; cv.height=H2*OS;
        cv.style.cssText='position:absolute;left:0;top:0;width:'+W2+'px;height:'+H2+'px;z-index:0;pointer-events:none';
        b.appendChild(cv);
        const IMG=bubImg(bk);
        const draw=function(){ try{
          const g=cv.getContext('2d');
          g.imageSmoothingEnabled=true; try{g.imageSmoothingQuality='high';}catch(e){}
          const u=Math.round;
          /* 中段:一次一格條紋週期,整片重複到滿 */
          const n=Math.max(1, Math.round(mw/(S.tileW*r)));
          for(let i=0;i<n;i++){
            const x0=u((Lw-1+ mw*i/n)*OS), x1=u((Lw-1+ mw*(i+1)/n)*OS)+ (i===n-1?2*OS:0);
            g.drawImage(IMG, S.tileX,0,S.tileW,S.H, x0,0, Math.max(1,x1-x0), H2*OS);
          }
          g.drawImage(IMG, 0,0,S.L,S.H, 0,0, Lw*OS, H2*OS);                       /* 左蓋 */
          g.drawImage(IMG, S.W-S.R,0,S.R,S.H, u((W2-Rw)*OS),0, Rw*OS, H2*OS);    /* 右蓋 */
        }catch(e){} };
        if(IMG&&IMG.complete&&IMG.naturalWidth) draw();
        else if(IMG) IMG.addEventListener('load',draw,{once:true});
        const t9=b.querySelector('.bubT');
        if(t9) t9.style.cssText='position:absolute;left:'+inL+'px;right:'+inR+'px;top:'+inT+'px;bottom:'+inB+'px;height:auto;display:flex;align-items:center;justify-content:center;margin:0;padding:0;z-index:3';
      }
      else if(S){
        const str=String(text||'');
        const k=Math.max(S.kmin, Math.min(1, S.kmin+0.025*(str.length-2)));
        const r=S.r0*k, lh=S.lh||13, fs=S.fs||10;
        const Lw=Math.round(S.L*r), Rw=Math.round(S.R*r);
        let Th=Math.round(S.T*r), Bh=Math.round(S.B*r);
        const MW=S.W-S.L-S.R, MH=S.H-S.T-S.B;
        const inL=Math.round(S.tl*r), inR=Math.round(S.tr*r);
        let inT=Math.round(S.tt*r), inB=Math.round(S.tb*r);
        let tp=0; for(const ch of str){ const c=ch.charCodeAt(0); tp+=(c<256?(c===32?0.35:0.62):1.05)*fs; }
        tp=Math.ceil(tp)+2;
        const mob=(window.matchMedia&&matchMedia('(max-width:680px)').matches);
        const maxW=mob?(S.maxWm||200):(S.maxW||260);
        const W2=Math.min(maxW, Math.max(Lw+Rw+6, tp+inL+inR));
        const lines=Math.max(1, Math.ceil(tp/(W2-inL-inR)));
        /* v189:字少時整顆泡泡垂直壓扁(最低壓到 g9.vq,預設 0.75),上下才不會留大片空 */
        const Htxt=inT+inB+lines*lh+8;
        if(Htxt<Th+Bh+2){
          const vq=Math.max(S.vq||0.75,(Htxt-2)/(Th+Bh));
          Th=Math.round(Th*vq); Bh=Math.round(Bh*vq);
          inT=Math.round(inT*vq); inB=Math.round(inB*vq);
        }
        const H2=Math.max(Th+Bh+2, inT+inB+lines*lh+8);
        b.style.width=W2+'px'; b.style.height=H2+'px';
        const mw=W2-Lw-Rw, mh=H2-Th-Bh;
        const OS=3, cv=document.createElement('canvas');
        cv.width=W2*OS; cv.height=H2*OS;
        cv.style.cssText='position:absolute;left:0;top:0;width:'+W2+'px;height:'+H2+'px;z-index:0;pointer-events:none';
        b.appendChild(cv);
        const IMG=bubImg(bk);
        const draw=function(){ try{
          const g=cv.getContext('2d');
          g.imageSmoothingEnabled=true; try{g.imageSmoothingQuality='high';}catch(e){}
          const RX=S.W-S.R, BY=S.H-S.B, u=Math.round;
          const dr=(sx,sy,sw,sh,dx,dy,dw,dh)=>{ if(dw>0&&dh>0) g.drawImage(IMG,sx,sy,sw,sh,u(dx*OS),u(dy*OS),Math.max(1,u(dw*OS)),Math.max(1,u(dh*OS))); };
          dr(S.L,S.T,MW,MH, Lw-1,Th-1, mw+2, mh+2);
          dr(S.L,0,MW,S.T,  Lw-1,0,    mw+2, Th);
          dr(S.L,BY,MW,S.B, Lw-1,H2-Bh,mw+2, Bh);
          dr(0,S.T,S.L,MH,  0,Th-1,   Lw, mh+2);
          dr(RX,S.T,S.R,MH, W2-Rw,Th-1, Rw, mh+2);
          dr(0,0,S.L,S.T,   0,0, Lw,Th);
          dr(RX,0,S.R,S.T,  W2-Rw,0, Rw,Th);
          dr(0,BY,S.L,S.B,  0,H2-Bh, Lw,Bh);
          dr(RX,BY,S.R,S.B, W2-Rw,H2-Bh, Rw,Bh);
        }catch(e){} };
        if(IMG&&IMG.complete&&IMG.naturalWidth) draw();
        else if(IMG) IMG.addEventListener('load',draw,{once:true});
        const t9=b.querySelector('.bubT');
        if(t9) t9.style.cssText='position:absolute;left:'+inL+'px;right:'+inR+'px;top:'+inT+'px;bottom:'+inB+'px;height:auto;display:flex;align-items:center;justify-content:center;margin:0;padding:0;z-index:3';
      }
    }catch(e){}
  }
  a.el.appendChild(b); a.bubEl=b;
  clearTimeout(a.bubT);

}

window.TTBubbleSource={data:TTBUB,ready:Promise.all(Object.entries(TTBUB).map(([k,v])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=reject;im.src=v.d;BUB_IMGS[k]=im;}))),render(host,key,text){active=key;showBubble({el:host},text);return host.lastElementChild;}};
})();