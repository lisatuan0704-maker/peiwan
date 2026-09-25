/* 大廳待機：只變換獨立髮層，原圖、五官與保存的造型資料不變。 */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function sample(seconds,seed=0){
    const phase=seconds*1.45+seed;
    return {back:Math.sin(phase)*.017,front:Math.sin(phase-.55)*.008};
  }
  function draw(actor,now,walking){
    if(!actor.cv||!actor.b?.doll||actor.slime)return;
    const off=walking||document.hidden||document.body.classList.contains('liteFX')||reduced.matches||
      (typeof fsOverlayOpen==='function'&&fsOverlayOpen());
    if(off){
      if(actor._ttIdleDrawn){
        drawDollTo(actor.cv,actor.b.doll,actor.frame||'idle');actor._ttIdleDrawn=false;
      }
      return;
    }
    // 每秒最多十次重繪；沿用主迴圈，不建立另一個計時器。
    if(now-(actor._ttIdleAt||0)<100)return;
    actor._ttIdleAt=now;
    drawDollTo(actor.cv,{...actor.b.doll,_idleHair:sample(now/1000,actor.seed||0)},'idle');
    actor._ttIdleDrawn=true;
  }
  window.TTIdleMotion={draw,sample};
})();
