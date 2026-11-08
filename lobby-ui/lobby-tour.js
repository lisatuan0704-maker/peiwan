/* v506 大廳新手教學（D 11/08：第一次進大廳也要像小屋一樣有教學，讓客人知道這裡可以找冒險者）。
   用小屋同一套 TTCoach（整片變灰、虛線圈、白紙說明卡）。只在電腦版大廳跑（手機是功能首頁，沒有大廳場景）。
   第一次：闆卡做好、登入完、畫面上沒有開著的視窗時自動跑一次（記 localStorage tt_lobby_tour_v1）；
   看過舊版入店小卡（tt_seen_intro）的老客人不自動跳。設定視窗「大廳教學」可以再看一次。 */
(function(){
'use strict';
const KEY='tt_lobby_tour_v1';
const $=id=>document.getElementById(id);
function shown(e){if(!e||!e.isConnected)return false;const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden';}
// 大廳鏡頭會裁掉場景邊緣：小人／冒險者中心不在畫面裡就不圈（說明卡改置中），避免圈到畫面外
function inView(e){if(!shown(e))return false;const b=e.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;return x>20&&y>20&&x<innerWidth-20&&y<innerHeight-20;}
function union(list){const bs=list.filter(shown).map(e=>e.getBoundingClientRect());if(!bs.length)return null;
 const l=Math.min(...bs.map(b=>b.left)),t=Math.min(...bs.map(b=>b.top)),r=Math.max(...bs.map(b=>b.right)),btm=Math.max(...bs.map(b=>b.bottom));
 return {left:l,top:t,width:r-l,height:btm-t};}
function lobbyOn(){const h=document.documentElement,b=document.body;
 return !h.classList.contains('ttm-on')&&!window.TTMobile&&!b.classList.contains('mhome-on')&&!b.classList.contains('tt-house-on');}
function myDoll(){try{const a=typeof me==='function'?me():null;return a&&a.el;}catch(_){return null;}}
function myDollInView(){const e=myDoll();return inView(e)?e:null;}
function busy(){
 const g=$('dcGate');if(g&&getComputedStyle(g).display!=='none')return true;   // 還在入店卡（沒闆卡／要登入）
 if($('loadscr'))return true;
 if(window.TinyTavernUI?.isActive?.())return true;
 return !!document.querySelector('.gwin.on,#bookM.on,#cardOverlay.on,#intro.on,#ttcModal.on,#ttGachaOv,#ttCoach,.shopModal[style*="flex"]');
}
// 冒險者：先挑「待接單」（綠燈）的那位，沒有就挑畫面上第一位
function staff(){const all=[...document.querySelectorAll('.npc.staff')].filter(inView);
 return all.find(e=>e.querySelector('.led.g'))||all[0]||null;}
// v508 掛機收益吊卡（#ttIdleHud）：規則還沒發布、讀不到紀錄時整條不顯示 → 這一步也跳過（不留置中的空說明）
function idleStep(){const e=$('ttIdleHud');return shown(e)&&!e.classList.contains('off')
 ?[{target:()=>$('ttIdleHud'),pad:8,title:'掛機收益',text:'就算不在酒館，貓貓幣也會慢慢存起來，最多存 8 小時。\n存滿就不會再增加，記得回來按「領取」。'}]:[];}
function steps(){
 const daily=(window.TTCat&&TTCat.DAILY)||100;
 return [
  {target:myDollInView,pad:14,title:'這是你的小人',text:'用 WASD 或方向鍵走動。\n走到店貓、布告欄旁邊按空白鍵，可以跟它們互動；點其他老闆的小人，可以看他的闆卡、加好友。'},
  {target:staff,pad:14,title:'酒館的冒險者',text:'站在店裡的這幾位是酒館的冒險者，可以找他們一起打遊戲、語音聊聊天。\n頭上寫「待接單」的就是現在有空；點兩下冒險者，可以看他的介紹卡。'},
  {target:()=>$('shopBtn'),pad:8,round:true,title:'找冒險者一起玩',text:'按「我要點單」挑一種玩法、選一位冒險者，用金幣付好就完成了，也可以預約之後的時間。\n點好的單，在「我的酒館」的訂單裡看得到進度。'},
  {target:()=>document.querySelector('.tt-funds'),pad:8,title:'錢包',text:'金幣用來點冒險者、買時裝，按這裡可以儲值。\n貓貓幣是酒館送你的（每日任務、掛機收益），可以買小屋家具。'},
  ...idleStep(),
  {target:()=>$('chatbox'),pad:6,title:'聊天室',text:'跟大家打聲招呼吧！說的話會冒在小人頭上。\n每天在大廳說說話、待滿 10 分鐘，完成每日任務就送 '+daily+' 貓貓幣。'},
  {target:()=>union([$('dressBtn'),$('wardBtn')]),pad:8,title:'商城與背包',text:'商城的衣服可以先試穿再買；背包裡是你已經有的衣服、寵物和座椅，隨時換裝。'},
  {target:()=>$('ttHouseBtn'),pad:8,title:'小屋',text:'你專屬的小房間：用貓貓幣抽扭蛋拿家具來佈置，也能邀請好友進來一起聊天。'},
  {target:()=>$('ttHubButton'),pad:8,title:'我的酒館',text:'好友、私訊、信箱、訂單和成就都在這裡。\n想再看一次這個教學，右上角「設定」裡有「大廳教學」。'}
 ];}
function run(){
 if(!window.TTCoach||!lobbyOn())return Promise.resolve('skip');
 const h=$('hint2');if(h){h.classList.remove('is-visible');h.hidden=true;}   // 底部操作提示跟教學重複，收起來
 return TTCoach.run(steps(),{doneKey:KEY,last:'開始逛吧'});
}
function auto(){
 if(!window.TTCoach||TTCoach.seen(KEY))return;
 try{if(localStorage.getItem('tt_seen_intro'))return;}catch(_){}
 let n=0;
 const t=setInterval(()=>{
  if(++n>600){clearInterval(t);return;}                       // 最多等 10 分鐘（例如一直停在入店卡）
  if(!lobbyOn()||busy()||!myDoll())return;
  clearInterval(t);
  setTimeout(()=>{if(lobbyOn()&&!busy()&&myDoll())run();else auto();},900);   // 畫面穩定一下再開始
 },1000);
}
function bindSettings(){const b=$('setTour');if(!b)return;
 const row=$('setTourRow');if(row)row.hidden=!lobbyOn();   // 手機功能首頁沒有大廳場景，不顯示
 b.onclick=()=>{try{window.TTHub?.close?.();}catch(_){}try{gClose('setM');}catch(_){}setTimeout(run,260);};}   // 設定也可能嵌在「我的酒館」裡，一起關掉
window.TTLobbyTour={run,auto,KEY};
function init(){bindSettings();auto();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
