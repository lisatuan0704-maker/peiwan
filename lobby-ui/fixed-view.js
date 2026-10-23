/* Desktop uses one logical viewport, so scene and UI resize together. */
(()=>{
 'use strict';
 window.ttNavigate=url=>{
  let framed=false;try{framed=window.parent!==window&&window.parent.location.pathname.endsWith('/lobby-view.html');}catch{}
  if(framed)window.parent.location.assign(url);else window.location.assign(url);
 };
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');if(!a||a.hasAttribute('download')||a.target==='_blank'||a.getAttribute('href').startsWith('#'))return;
  try{if(window.parent!==window&&window.parent.location.pathname.endsWith('/lobby-view.html'))a.target='_top';}catch{}
 },true);
 if(window.self!==window.top||new URLSearchParams(location.search).has('preview'))return;
 if(matchMedia('(hover: hover) and (pointer: fine)').matches)location.replace('lobby-view.html'+location.search+location.hash);
})();
