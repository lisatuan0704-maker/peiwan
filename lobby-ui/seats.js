/* Integration only. Artist-approved effects live unchanged in js/tt-seats.js. */
(()=>{'use strict';
let loaded=false;const ready=TTSeats.init('img/seats/').then(()=>{loaded=true;paint();}).catch(e=>{console.warn(e);});
const valid=id=>Object.prototype.hasOwnProperty.call(TTSeats.CATALOG,id);
const owned=id=>valid(id)&&!!window.__owned?.[id];
const owner=()=>typeof myKey==='undefined'?'':myKey||'';
const message=text=>{if(typeof toast==='function')toast(text);};
function choice(){let id;try{id=localStorage.getItem('tt-seat-choice:'+owner());}catch{}return owned(id)?id:Object.keys(TTSeats.CATALOG).find(owned)||null;}
function select(id){if(!owner()||!owned(id)){message('尚未擁有這張座椅');return false;}try{localStorage.setItem('tt-seat-choice:'+owner(),id);}catch{}message('已選擇「'+TTSeats.CATALOG[id].name+'」，回到大廳按 X 使用');window.__dressRefresh?.();return true;}
function toggle(){const a=typeof me==='function'?me():null;if(!a){message('請先登入自己的角色');return;}if(TTSeats.current(a)){TTSeats.clear(a);return;}const id=choice();if(!id){message('先到時裝間選購座椅，擁有後就能按 X 使用');return;}if(!loaded){message('座椅素材仍在載入，請稍後再試');return;}a.state='idle';a.sitting=false;a.tx=a.x;a.ty=a.y;a.player=true;a.goDoor=false;a.goSit=false;a.bopTarget=null;a._sceneGoal=null;a._scenePath=null;a._sceneTransit=false;TTSeats.use(a,id);}
function paint(){if(!loaded)return;document.querySelectorAll('canvas[data-tt-seat]').forEach(cv=>{const id=cv.dataset.ttSeat;if(valid(id)&&cv.dataset.seatPainted!==id){cv.width=160;cv.height=160;TTSeats.thumb(id,cv);cv.dataset.seatPainted=id;}});}
function thumb(id,cv){if(!valid(id))return;cv.dataset.ttSeat=id;cv.style.imageRendering='pixelated';ready.then(()=>{cv.width=160;cv.height=160;TTSeats.thumb(id,cv);cv.dataset.seatPainted=id;});}
function markup(id){return valid(id)?'<canvas width="160" height="160" data-tt-seat="'+id+'" aria-label="'+TTSeats.CATALOG[id].name+'" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated"></canvas>':'';}
function state(id){const c=window.__shopCfg?.[id]||{},price=c.price,now=Date.now();return {owned:owned(id),price,onSale:valid(id)&&c.active===true&&Number.isInteger(price)&&price>=0&&(!c.start||now>=c.start)&&(!c.end||now<=c.end),end:c.end};}
window.TTSeatUI={ready,owned,choice,select,toggle,thumb,markup,state};
document.addEventListener('keydown',e=>{if(e.code!=='KeyX'||e.repeat||e.isComposing||e.ctrlKey||e.altKey||e.metaKey)return;if(e.target?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;if(window.TTMobile||typeof cardOpen!=='undefined'&&cardOpen||typeof fsOverlayOpen==='function'&&fsOverlayOpen()||document.getElementById('dcGate')?.offsetParent)return;e.preventDefault();toggle();});
const observer=new MutationObserver(paint);observer.observe(document.documentElement,{childList:true,subtree:true});
})();
