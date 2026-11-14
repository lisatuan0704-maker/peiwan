/* v532 拍照模式（電腦版大廳）：設定裡「拍照模式・開始」→ 收起選單、聊天框、名牌、招牌、掛機卡等介面，只留大廳和大家的小人（名字與泡泡照常），
   方便截圖分享。Esc 或右上「離開拍照模式」回來；滑鼠不動 2.5 秒那顆鈕也會淡掉，截圖不會拍到。只改畫面，不寫任何資料。 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const css=document.createElement('style');
css.textContent=`
body.tt-photo :is(#gearBtn,#chatbox,#sign,#verTag,#hud2,.dktip,.lobby-geometry,#ttMainDock,#ttIdleHud,#ttHouseKeys,#ttDailyBar,.tt-quest,#playCard){opacity:0!important;pointer-events:none!important;transition:opacity .25s}
#ttPhotoExit{position:fixed;top:14px;right:14px;z-index:9999;display:none;align-items:center;gap:6px;padding:7px 14px;font:700 13px/1 inherit;color:#1C2156;background:#ffffffe6;border:2px solid #1C2156;border-radius:99px;box-shadow:0 2px 0 #1C2156;cursor:pointer;transition:opacity .4s}
body.tt-photo #ttPhotoExit{display:flex}
body.tt-photo.tt-photo-idle #ttPhotoExit{opacity:0}
#ttPhotoTip{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:9999;display:none;padding:6px 14px;font-size:13px;color:#fff;background:#1C2156d9;border-radius:99px;pointer-events:none;transition:opacity .5s}
body.tt-photo #ttPhotoTip{display:block}
body.tt-photo.tt-photo-idle #ttPhotoTip{opacity:0}`;
document.head.append(css);
const exitB=document.createElement('button');exitB.type='button';exitB.id='ttPhotoExit';exitB.textContent='離開拍照模式 ✕';
const tip=document.createElement('div');tip.id='ttPhotoTip';tip.textContent='拍照模式：介面先收起來囉，按 Esc 回來 ✦';
let idleT=0;
const wake=()=>{document.body.classList.remove('tt-photo-idle');clearTimeout(idleT);idleT=setTimeout(()=>document.body.classList.add('tt-photo-idle'),2500);};
function on(){if(document.body.classList.contains('tt-photo'))return;
 try{window.TTHub?.close?.();}catch(_){}try{gClose('setM');}catch(_){}
 if(!exitB.isConnected)document.body.append(exitB,tip);
 document.body.classList.add('tt-photo');wake();addEventListener('mousemove',wake);}
function off(){document.body.classList.remove('tt-photo','tt-photo-idle');clearTimeout(idleT);removeEventListener('mousemove',wake);}
exitB.onclick=off;
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('tt-photo')){e.preventDefault();e.stopPropagation();off();}},true);
function bind(){const b=$('setPhoto');if(!b)return;const row=$('setPhotoRow');if(row)row.hidden=!!window.TTMobile;b.onclick=()=>setTimeout(on,200);}
window.TTPhoto={on,off};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
