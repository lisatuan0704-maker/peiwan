/* Desktop uses one logical viewport, so scene and UI resize together. */
(()=>{
 'use strict';
 const query=new URLSearchParams(location.search);
 window.TTMobile=!(matchMedia('(hover: hover) and (pointer: fine)').matches);
 if(query.has('preview')&&query.get('mobile')==='1')window.TTMobile=true;
 // v546 手機遊戲式直立畫面：手機也有大廳場景、浮空搖桿、小屋、扭蛋。手機預設開；?game=0 換回舊的功能首頁（記在這台），?game=1 再打開。
 try{if(query.has('game'))localStorage.setItem('tt_mgame',query.get('game')==='1'?'1':'0');}catch(e){}
 let mg=true;try{mg=localStorage.getItem('tt_mgame')!=='0';}catch(e){}
 window.TTGame=!!(window.TTMobile&&mg);
 if(window.TTGame)document.documentElement.classList.add('ttm-game');   // 遊戲畫面不加 tt-mobile（mobile-home.css 用它把大廳場景藏起來）
 else if(window.TTMobile)document.documentElement.classList.add('tt-mobile');
 window.ttNavigate=url=>{
  let framed=false;try{framed=window.parent!==window&&window.parent.location.pathname.endsWith('/lobby-view.html');}catch{}
  if(framed)window.parent.location.assign(url);else window.location.assign(url);
 };
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');if(!a||a.hasAttribute('download')||a.target==='_blank'||a.getAttribute('href').startsWith('#'))return;
  try{if(window.parent!==window&&window.parent.location.pathname.endsWith('/lobby-view.html'))a.target='_top';}catch{}
 },true);
 if(window.self!==window.top||new URLSearchParams(location.search).has('preview'))return;
 if(matchMedia('(hover: hover) and (pointer: fine)').matches){query.set('v','555');location.replace('lobby-view.html?'+query.toString()+location.hash);
  // v532：跳轉要等一下才生效，這段時間瀏覽器會把整份 1.5MB 大廳的圖片、程式、資料庫連線全部跑一遍，外框再載一次＝兩倍下載 → 後面的內容當純文字吞掉不處理
  try{document.write('<plaintext style="display:none">');}catch(e){}}
})();
