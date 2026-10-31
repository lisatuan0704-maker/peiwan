/* v477 冒險者手札夜間模式：深色底上的深色字（v412 之後新加的卡片、按鈕說明、私訊等寫死深藍字）自動改成淺紫色。
   只在 body.dark 時處理；切回白天模式就還原。不改任何資料與按鈕功能。 */
(function(){
  'use strict';
  const LIGHT='#DCD0FF', MARK='data-tt-dk';
  const rgb=s=>{const m=String(s||'').match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
  const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
  function bgOf(el){
    for(let e=el;e&&e.nodeType===1;e=e.parentElement){
      const cs=getComputedStyle(e);
      if(cs.backgroundImage&&cs.backgroundImage!=='none'&&/gradient|url/.test(cs.backgroundImage)){
        const c=rgb((cs.backgroundImage.match(/rgba?\([^)]+\)/)||[])[0]);if(c&&c.a>0.4)return c;
      }
      const c=rgb(cs.backgroundColor);if(c&&c.a>0.4)return c;
    }
    return rgb(getComputedStyle(document.body).backgroundColor)||{r:20,g:18,b:40,a:1};
  }
  function fix(){
    const dark=document.body.classList.contains('dark');
    if(!dark){ document.querySelectorAll('['+MARK+']').forEach(e=>{const o=e.getAttribute(MARK);if(o)e.style.setProperty('color',o.split('|')[0],o.split('|')[1]||'');else e.style.removeProperty('color');e.removeAttribute(MARK);}); return; }
    const all=document.body.querySelectorAll('*');
    for(const el of all){
      if(el.hasAttribute(MARK)||/^(SCRIPT|STYLE|CANVAS|IMG|SVG|PATH|INPUT|TEXTAREA|SELECT|OPTION)$/i.test(el.tagName))continue;
      let hasText=false;for(const n of el.childNodes)if(n.nodeType===3&&n.textContent.trim()){hasText=true;break;}
      if(!hasText||!el.offsetParent&&getComputedStyle(el).position!=='fixed')continue;
      const c=rgb(getComputedStyle(el).color);if(!c)continue;
      const bg=bgOf(el);
      if(lum(bg)<0.22&&lum(c)<0.2){ const ov=el.style.getPropertyValue('color'); el.setAttribute(MARK,ov?ov+'|'+el.style.getPropertyPriority('color'):''); el.style.setProperty('color',LIGHT,'important'); }
    }
  }
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(fix,120);};
  const start=()=>{fix();new MutationObserver(later).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
