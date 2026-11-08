/* v494 小屋（第一批家具試做）：大廳的「小屋」鈕 → 場景換成自己的房間（house/room.html，iframe 鋪在大廳場景的位置），
   名牌、設定照舊；右下改成「佈置／家具店」，右上多「回大廳」與縮放鈕。家具店用大廳同一套視窗（live.js 的 houseShopM）。
   資料：house/<key>{layout,at,vis}＝擺設；houseInv/<key>/<家具>/<訂單編號>{ts}＝買到的每一件；入住禮（catalog.json starter）不用買、每人一件。
   價格：shopConfig/house:<家具>{name,price,cur:'cat',type:'小屋家具',active}（v493 規則：貓貓幣只能買 shopConfig 標 cur:'cat' 的商品），
   price 是「金幣等值價」，顯示與扣款 ×10（TTCat.price）。type 不是「時裝」、也沒有 custom，所以不會出現在時裝間。
   購買＝同一次寫入 clientOrders（type shop、paidBy cat、itemId house:<家具>）＋cat 扣款＋catTx spend＋houseInv（catSafety 鎖）。
   手機功能首頁（html.ttm-on）沒有大廳場景，先不開小屋鈕。
   v504 小屋串門子（規則第 14 批；D 11/08：要能跟朋友一起在自己的小屋聊天，一間最多 4 人）：
   - 開放設定 house/<key>/vis：公開（預設）／只限好友／不公開。
   - 擺設快照 houseView/<key>{layout,vis,at,name,n}：存擺設時一起寫，客人用它畫房間（讀不到 house/<key> 本身）；不公開就刪掉。
   - 座位 houseRoom/<主人>/<0～3>{k,name,i,j,f,at}：進小屋（自己的或別人的）就坐一個，最多 4 人；位置移動時回報、每 15 秒報平安，斷線自動起身。
   - 小屋聊天 houseChat/<主人>/<訊息>{f,n,x,s,at}：說話頭上冒泡泡，左下有聊天紀錄。
   - 隨機拜訪名單 houseDir/<key>{at,n,on}（公開、擺 DIR_MIN 件以上；on＝主人最近在家的時間，隨機拜訪先挑有人在的）。
   - 來玩紀錄 houseVisit/<主人>/<客人>{name,at,like}；請人離開 houseKick/<主人>/<客人>（10 分鐘內不能再進）。
   - 邀請好友＝私訊一則帶 house:<自己的 key> 的訊息（dm-log.js 畫成邀請卡，點了就進來）。
   客人在別人家（S.visit）：不能佈置、不存檔，其他都一樣（走動、聊天、按讚）。 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const R=()=>typeof ROOT!=='undefined'?ROOT:'peiwan';
const KEY=()=>typeof myKey!=='undefined'?myKey:null;
const DB=()=>typeof db!=='undefined'?db:null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>{try{toast(m);}catch(_){}};
const VER='505';
const SIZE_NAME={S:'小件',M:'中件',L:'大件'},TIER_NAME={1:'簡單',2:'標準',3:'精緻'};
const S={on:false,frame:null,cat:null,byKey:{},inv:{},layout:null,subs:[],mode:'walk',saveT:0,buying:false,shopSet:'酒館日常',shopKind:'all',bagKind:'all',thumbs:{},sign:null,key:null,
  vis:'public',visit:null,joining:false,seen:new Set(),panel:false,visitors:{},friends:null,
  hk:null,seat:null,seatRef:null,room:{},dolls:{},dollWait:{},chatSeen:new Set(),chatLog:[],joinedAt:0,pubT:0,beatT:0,last:null,lastPub:0,leaving:false};
const VIS_NAME={public:'公開',friends:'只限好友',private:'不公開'};
const VIS_TIP={public:'好友和隨機拜訪的老闆都能進來一起聊天（擺 5 件以上才會出現在隨機拜訪）',friends:'只有好友能進來，不會出現在隨機拜訪',private:'只有你自己，誰都不能進來'};
const DIR_MIN=5;          // 入住禮 4 件＋至少再擺 1 件，才放進隨機拜訪名單
const SEATS=['0','1','2','3'],STALE=45000,CHAT_MAX=120;
const TS=()=>firebase.database.ServerValue.TIMESTAMP;
const myName=()=>((typeof me==='function'&&me()?.b?.name)||'酒館客人').slice(0,40);
const isPhone=()=>document.documentElement.classList.contains('ttm-on');
const r2=v=>Math.round(v*100)/100;

// ---------- 資料 ----------
async function loadCatalog(){if(S.cat)return S.cat;const r=await fetch('house/catalog.json?v='+VER,{cache:'no-store'});const a=await r.json();S.cat=a;a.forEach(c=>S.byKey[c.k]=c);return a;}
function unsub(){S.subs.forEach(f=>{try{f();}catch(_){}});S.subs=[];}
function watch(path,fn,q){let ref=DB().ref(R()+'/'+path);if(q)ref=q(ref);const h=s=>fn(s.val());ref.on('value',h,()=>fn(null));S.subs.push(()=>ref.off('value',h));}
const priceOf=k=>{const p=(window.__shopCfg||{})['house:'+k];return p&&p.cur==='cat'&&p.active!==false&&Number.isSafeInteger(p.price)&&p.price>0?p.price:0;};   // 金幣等值價（只賣標 cur:'cat' 的）
const owned=k=>(S.byKey[k]?.starter?1:0)+Object.keys(S.inv[k]||{}).length;
function placed(){try{return S.frame?.contentWindow?.TTRoom?.placed()||{};}catch(_){return {};}}
const left=k=>owned(k)-(placed()[k]||0);

// ---------- 進出小屋 ----------
function dollCanvasOf(doll){const c=document.createElement('canvas');c.width=c.height=64;try{window.drawDollTo(c,doll||{},'idle');}catch(_){}return c;}
function myDollCanvas(){try{const a=typeof me==='function'?me():null;return dollCanvasOf((a&&a.b&&a.b.doll)||{});}catch(_){return dollCanvasOf({});}}
// 名牌：第一次進小屋（自己的或別人的）記下大廳原本的字，回大廳再換回來
// v504：名牌第二行裡有大廳人數 #cnt（大廳背景照樣在更新它），換字前先把它收進隱藏的盒子，不然大廳會找不到而報錯
function setSign(plate,sub){const sg=$('sign');if(!sg)return;const p=sg.querySelector('.plate'),u=sg.querySelector('.sub');
 if(!S.sign){S.sign=[p?.innerHTML,u?.innerHTML];const c=$('cnt');if(c&&u&&u.contains(c)){let h=$('ttCntHold');if(!h){h=document.createElement('div');h.id='ttCntHold';h.hidden=true;document.body.append(h);}h.append(c);}}
 if(p)p.textContent=plate;if(u)u.textContent=sub;}
function restoreSign(){const sg=$('sign');if(sg&&S.sign){const p=sg.querySelector('.plate'),u=sg.querySelector('.sub');if(p&&S.sign[0]!=null)p.innerHTML=S.sign[0];
  const held=$('ttCntHold')?.querySelector('#cnt');if(u&&S.sign[1]!=null){u.innerHTML=S.sign[1];const fresh=u.querySelector('#cnt');if(held&&fresh){fresh.replaceWith(held);}}}
 S.sign=null;}
function openFrame(title,onReady){const f=document.createElement('iframe');f.id='ttHouseFrame';f.title=title;f.src='house/room.html?v='+VER;S.frame=f;
 document.body.append(f);f.addEventListener('load',async()=>{try{await f.contentWindow.TTRoom.ready;}catch(_){}if(S.frame===f)onReady();});}
async function enter(){
 if(S.on&&!S.visit)return;
 if(isPhone()){say('小屋請用電腦開，手機版之後再開放');return;}
 const key=KEY();if(!key||!DB()){say('先做一張闆卡、用 Discord 登入，才能回小屋');return;}
 if(S.joining)return;S.joining=true;
 try{
  if(S.on)await teardown();
  S.key=key;S.hk=key;S.on=true;document.body.classList.add('tt-house-on');
  try{window.TinyTavernUI?.close?.();}catch(_){}
  setSign('Tiny Tavern・我的小屋',myName()+' 的小屋');
  try{
   await loadCatalog();
   const h=(await DB().ref(R()+'/house/'+key).once('value')).val()||{};
   S.layout=Array.isArray(h.layout)?h.layout:(h.at?[]:null);S.vis=VIS_NAME[h.vis]?h.vis:'public';   // v505：有存檔時間但沒擺設＝家具全收回背包了（不是新小屋，不再擺入住禮）
  }catch(e){S.layout=null;}
  if(!S.on||S.hk!==key||S.visit)return;
  watch('houseInv/'+key,v=>{S.inv=v||{};renderBag();renderShop();});
  watch('houseVisit/'+key,v=>{S.visitors=v||{};renderPanel();renderTop();});
  const st=await sit(key);
  if(!S.on||S.hk!==key||S.visit){if(st.r==='ok')st.ref.remove().catch(()=>{});return;}   // v505：坐下的途中按了回大廳，不要再把小屋開起來
  if(st.r==='ok')useSeat(st);
  startRoom(key);
  pruneChat(key);
  openFrame('我的小屋',()=>{
    renderBag();publish(room('layout'));room('spawn',+S.seat||0);S.last=null;pubPos();pushPeers();   // 快照跟著目前的擺設（第一次進來、入住禮剛擺好也要有）
    if(window.TTCoach&&!TTCoach.seen(TOUR_KEY))setTimeout(()=>{if(S.on&&!S.visit)houseTour();},400);else if(!S.layout)say('歡迎回家！入住禮已經幫你擺好了');});
  setMode('walk');renderTop();renderChat();
 }finally{S.joining=false;}
}
// 關掉目前的房間（自己的或別人的）：起身、停掉同步，不換回大廳的名牌；回大廳用 exit()
async function teardown(){flushSave();const seatRef=S.seatRef;S.leaving=true;
 S.on=false;unsub();closePanel();clearInterval(S.pubT);clearInterval(S.beatT);S.pubT=S.beatT=0;
 document.body.classList.remove('tt-house-on','tt-house-edit','tt-house-visit');
 S.frame?.remove();S.frame=null;S.visit=null;S.hk=null;S.seat=null;S.seatRef=null;S.room={};S.whoSig=null;S.chatLog=[];S.chatSeen=new Set();renderChat();
 try{gClose('houseShopM');}catch(_){}
 if(seatRef){try{seatRef.onDisconnect().cancel();}catch(_){}try{await seatRef.remove();}catch(_){}}
 S.leaving=false;}
async function exit(){if(!S.on)return;await teardown();restoreSign();}

// ---------- v504 座位：進小屋就坐一個（最多 4 個），斷線自動起身 ----------
// 回傳 {r:'ok'／'full'／'denied'／'kicked', s, ref}；坐好就設好斷線自動起身
async function sit(hk){const mk=KEY(),ref=DB().ref(R()+'/houseRoom/'+hk);let cur;
 try{cur=(await ref.once('value')).val()||{};}catch(_){return {r:'denied'};}
 const now=Date.now(),own=hk===mk;
 let order=SEATS.filter(s=>cur[s]&&cur[s].k===mk);   // 另一個分頁已經坐著：沿用那個座位
 if(!order.length)order=SEATS.filter(s=>!cur[s]).concat(SEATS.filter(s=>cur[s]&&!(cur[s].at>now-STALE)));   // v505：空位優先，沒有空位才接手斷線的座位
 if(!order.length&&own){const g=SEATS.filter(s=>cur[s]&&cur[s].k!==mk).sort((a,b)=>(cur[a].at||0)-(cur[b].at||0))[0];   // 主人回家客滿：請最久沒動的那位起身
   if(g){try{await ref.child(g).remove();order=[g];}catch(_){}}}
 if(!order.length)return {r:'full'};
 const p=(S.hk===hk&&room('me'))||{i:8.5+(Math.random()-.5),j:10.5,f:1};
 for(const s of order){try{await ref.child(s).set({k:mk,name:myName(),i:r2(p.i),j:r2(p.j),f:p.f<0?-1:1,at:TS()});
   ref.child(s).onDisconnect().remove();return {r:'ok',s,ref:ref.child(s)};}catch(_){}}
 if(!own){try{const k=(await DB().ref(R()+'/houseKick/'+hk+'/'+mk).once('value')).val();if(k&&k>Date.now()-600000)return {r:'kicked'};}catch(_){}}
 return {r:'denied'};}
function useSeat(st){S.seat=st.s;S.seatRef=st.ref;S.joinedAt=Date.now();}
// 同步：看座位（其他人畫進房間）、聽聊天、回報自己的位置
function startRoom(hk){
 watch('houseRoom/'+hk,v=>{if(S.hk!==hk)return;S.room=v||{};const mine=S.seat&&S.room[S.seat];
  if(S.seat&&!S.leaving&&(!mine||mine.k!==KEY())){   // 我的座位不見了：被主人請出去、網路閃斷被清掉、或分頁在背景心跳變慢被接走
   // v505：先試著坐回去，坐不下才離開，並照原因說明（原本一律說「主人請你離開」）
   S.seat=null;S.seatRef=null;
   sit(hk).then(st=>{if(!S.on||S.hk!==hk||S.seat)return;
    if(st.r==='ok'){useSeat(st);S.last=null;pubPos();return;}
    if(S.visit){const nm=S.visit.name;exit().then(()=>say(st.r==='kicked'?nm+' 請你先離開小屋了':st.r==='full'?nm+' 的小屋客滿了，先回大廳囉':st.r==='denied'?nm+' 的小屋現在沒有開放了':'連線不穩，先回大廳囉'));}
    else say('連線不穩，等一下再試');});}
  pushPeers();
  /* v505：座位資料每 0.2 秒就會因為有人走動而更新；面板和聊天只在「有人進出」時重畫
     （原本每次都重畫：面板的按鈕按下去的瞬間被換掉、點不到；往上捲的聊天紀錄一直被拉回最底） */
  const who=SEATS.map(s=>{const v=S.room[s];return v&&v.at>Date.now()-STALE*2?v.k+':'+(v.name||''):'';}).join('|');
  if(who!==S.whoSig){S.whoSig=who;renderPanel();renderChat();}});
 watch('houseChat/'+hk,v=>{if(S.hk!==hk)return;onChat(v||{});},ref=>ref.limitToLast(30));
 // v505：網路重連後重新設好「斷線自動起身」（舊連線的設定會跟著舊連線消失，關分頁後座位會卡著）
 const cref=DB().ref('.info/connected'),onConn=s=>{if(s.val()&&S.seatRef&&S.hk===hk){try{S.seatRef.onDisconnect().remove();}catch(_){}S.seatRef.update({at:TS()}).catch(()=>{});}};
 cref.on('value',onConn);S.subs.push(()=>cref.off('value',onConn));
 clearInterval(S.pubT);clearInterval(S.beatT);S.last=null;
 S.pubT=setInterval(pubPos,200);
 S.beatT=setInterval(()=>{if(!S.seatRef)return;S.seatRef.update({at:TS()}).catch(()=>{});
   if(!S.visit&&S.vis==='public'&&S.listed)DB().ref(R()+'/houseDir/'+S.key).update({on:TS()}).catch(()=>{});},15000);   // v505：有在隨機名單上才報「在家」（不在名單上寫不進去）
 if(!S.visit&&S.vis==='public'&&S.listed)DB().ref(R()+'/houseDir/'+S.key).update({on:TS()}).catch(()=>{});}
// 自己的位置：走動時最多每 0.2 秒回報一次，停下來再補最後一次
function pubPos(){if(!S.seatRef)return;const p=room('me');if(!p)return;const L=S.last;
 if(L&&Math.abs(L.i-p.i)<.05&&Math.abs(L.j-p.j)<.05&&L.f===p.f)return;
 S.last={i:p.i,j:p.j,f:p.f};S.seatRef.update({i:r2(Math.max(-2,Math.min(30,p.i))),j:r2(Math.max(-2,Math.min(30,p.j))),f:p.f<0?-1:1,at:TS()}).catch(()=>{});}
// 其他人：座位上的人（不含自己、不含斷線的），小人圖從大廳資料讀一次存起來
function pushPeers(){if(!S.frame)return;const mk=KEY(),now=Date.now(),list=[];
 for(const s of SEATS){const v=S.room[s];if(!v||v.k===mk||!(v.at>now-STALE*2))continue;
  const d=S.dolls[v.k];if(d===undefined)loadDoll(v.k);
  list.push({id:v.k,name:v.name||'旅人',i:+v.i||0,j:+v.j||0,f:v.f<0?-1:1,doll:d||null});}
 room('setPeers',list);}
function loadDoll(k){if(S.dollWait[k])return;S.dollWait[k]=1;
 DB().ref(R()+'/lobby/'+k+'/doll').once('value').then(s=>{S.dolls[k]=dollCanvasOf(s.val()||{});}).catch(()=>{S.dolls[k]=dollCanvasOf({});}).finally(()=>{S.dollWait[k]=0;pushPeers();});}

// ---------- v504 小屋聊天 ----------
function onChat(v){const fresh=[];
 for(const [id,m] of Object.entries(v).sort((a,b)=>(a[1]?.at||0)-(b[1]?.at||0))){if(!m||S.chatSeen.has(id))continue;S.chatSeen.add(id);
  S.chatLog.push({id,f:m.f,n:m.n||'旅人',x:String(m.x||''),at:m.at});if(m.at>S.joinedAt-3000)fresh.push(m);}
 S.chatLog=S.chatLog.slice(-30);
 for(const m of fresh)room('say',m.f===KEY()?'me':m.f,m.x);
 renderChat();}
async function sendChat(){const inp=$('ttHouseSay');if(!inp)return;const x=inp.value.trim().slice(0,CHAT_MAX);if(!x)return;
 if(window.ttIsMuted?window.ttIsMuted():!!window.__mute){say('你目前被禁言中，暫時不能說話');return;}
 if(!S.seat||!S.hk){say('還沒進到小屋裡，等一下再說');return;}
 inp.value='';
 try{await DB().ref(R()+'/houseChat/'+S.hk).push({f:KEY(),n:myName(),x,s:S.seat,at:TS()});}
 catch(_){inp.value=x;say('訊息沒有送出，請再試一次');}}
// 主人每次回家順手清掉一天以前的聊天
function pruneChat(hk){DB().ref(R()+'/houseChat/'+hk).limitToFirst(60).once('value').then(s=>{const v=s.val()||{},old=Date.now()-86400000,ch={};
  for(const [id,m] of Object.entries(v))if(!m||!(m.at>old))ch[id]=null;if(Object.keys(ch).length)DB().ref(R()+'/houseChat/'+hk).update(ch).catch(()=>{});}).catch(()=>{});}
function renderChat(){const box=$('ttHouseChat');if(!box)return;const log=box.querySelector('.tt-hc-log');
 const people=SEATS.map(s=>S.room[s]).filter(v=>v&&v.at>Date.now()-STALE*2).length;
 box.querySelector('.tt-hc-who').textContent=S.on?'小屋裡 '+Math.max(1,people)+' / 4 人':'';
 log.innerHTML=S.chatLog.length?S.chatLog.slice(-8).map(m=>'<p'+(m.f===KEY()?' class="mine"':'')+'><b>'+esc(m.n)+'</b>'+esc(m.x)+'</p>').join('')
  :'<p class="tt-hc-empty">'+(S.visit?'跟大家打聲招呼吧':'邀請好友進來一起聊天吧（右上「拜訪」）')+'</p>';
 log.scrollTop=log.scrollHeight;}

// ---------- 新手教學（v495）：第一次進小屋，整片變灰、虛線圈起要點的地方；右上「教學」可以再看一次 ----------
const TOUR_KEY='tt_house_tour_v1';
function houseTour(){if(!window.TTCoach||!S.on||S.visit)return;if(S.mode!=='walk')setMode('walk');try{gClose('houseShopM');}catch(_){}
 const room=()=>{try{return S.frame.contentWindow.TTRoom.roomRect();}catch(_){return null;}},cat=()=>$('ttCatCount')?.closest('[data-cat-pop],.tt-funds-row,div')||$('ttCatCount');
 const daily=TTCat.dailyOn()?'每天在大廳說說話、待滿 10 分鐘，完成每日任務就送 '+TTCat.DAILY+' 貓貓幣。':'11/7 起，每天在大廳說說話、待滿 10 分鐘，完成每日任務就送 '+TTCat.DAILY+' 貓貓幣。';
 TTCoach.run([
  {target:room,pad:4,title:'歡迎來到你的小屋！',text:'這間房間是你專屬的，入住禮的四件家具已經幫你擺好了。\n點地板，小人就會走過去；按住拖曳可以移動視角，滾輪可以放大縮小。'},
  {target:()=>$('ttHouseShop'),title:'家具店',text:'用貓貓幣買家具。越大、越精緻的家具越貴，買了會先收進「我的家具」。'},
  {target:cat,title:'貓貓幣',text:daily+'\n名牌上這個硬幣就是你現在有的貓貓幣。'},
  {target:()=>$('ttHouseEdit'),title:'佈置',text:'按這裡，右邊會打開「我的家具」：點一件拿出來，移到想放的地方再點一下就擺好。\n點房間裡的家具，可以拿起來重新擺。'},
  {target:()=>$('ttHouseVisit'),title:'拜訪',text:'邀請在線上的好友進你的小屋一起聊天（最多 4 人），或隨機去別人的小屋坐坐。\n也可以在這裡決定誰能進來。'},
  {target:()=>$('ttHouseChat'),title:'小屋聊天',text:'在這裡打字，說的話會出現在小人頭上，小屋裡的人都看得到。'},
  {target:()=>$('ttHouseBack'),title:'回大廳',text:'想回酒館大廳就按這裡，擺好的家具都會自動存起來。'}
 ],{doneKey:TOUR_KEY,last:'開始佈置吧'});}

// ---------- 擺設存檔：房間每次放好／收回就交過來，0.6 秒合併一次寫入 ----------
let pending=null;
function save(layout){if(S.visit)return;pending=layout;clearTimeout(S.saveT);S.saveT=setTimeout(flushSave,600);}
function flushSave(){clearTimeout(S.saveT);if(!pending||!S.key||S.visit)return;const lay=JSON.parse(JSON.stringify(pending));pending=null;
 DB().ref(R()+'/house/'+S.key).update({layout:lay,at:TS()}).catch(()=>say('擺設沒存到，請檢查網路後再動一下家具'));   // update：不蓋掉開放設定 vis
 publish(lay);}
// v504 給客人看的擺設快照＋隨機拜訪名單（同一次寫入；不公開就兩個都刪）
function publish(layout){const key=S.key;if(!key||!DB()||S.visit||!Array.isArray(layout))return Promise.resolve();
 const lay=JSON.parse(JSON.stringify(layout)),n=Math.min(999,lay.length),ch={};
 if(S.vis==='private'){ch['houseView/'+key]=null;ch['houseDir/'+key]=null;}
 else{ch['houseView/'+key]={layout:lay,vis:S.vis,at:TS(),name:myName(),n};ch['houseDir/'+key]=S.vis==='public'&&n>=DIR_MIN?{at:TS(),n,on:TS()}:null;}
 return DB().ref(R()).update(ch).then(()=>{S.listed=!!ch['houseDir/'+key];}).catch(()=>{});}

// ---------- 佈置模式 ----------
function setMode(m){if(S.visit)m='walk';S.mode=m;document.body.classList.toggle('tt-house-edit',m==='edit');if(m==='edit')closePanel();renderKeys();
 try{const T=S.frame?.contentWindow?.TTRoom;if(T&&T.mode()!==m)T.setMode(m);}catch(_){}
 renderBag();requestAnimationFrame(()=>{try{S.frame?.contentWindow?.TTRoom?.frame();}catch(_){}});}
function renderBag(){const box=$('ttHouseBag');if(!box||!S.cat)return;
 const kinds=[['all','全部'],['floor','地板'],['wall','牆面']];
 const list=S.cat.filter(c=>owned(c.k)>0&&(S.bagKind==='all'||c.kind===S.bagKind));
 const tabs=kinds.map(([k,n])=>'<button type="button" data-bk="'+k+'" aria-pressed="'+(S.bagKind===k)+'">'+n+'</button>').join('');
 box.querySelector('.tt-hb-tabs').innerHTML=tabs;
 const grid=box.querySelector('.tt-hb-grid');
 grid.innerHTML=list.length?list.map(c=>{const n=left(c.k);return '<button type="button" class="tt-hb-item'+(n>0?'':' none')+'" data-k="'+c.k+'" title="'+esc(c.name)+'">'
   +'<span class="tt-hb-pic"><img alt="" data-thumb="'+c.k+'"></span><b>'+esc(c.name)+'</b><small>'+(n>0?'剩 '+n+' 件':'都擺出來了')+'</small></button>';}).join('')
  :'<p class="tt-hb-empty">背包裡還沒有家具，去家具店帶幾件回家吧</p>';
 fillThumbs(grid,136);}   // 家具店、佈置清單同一個比例（1 倍）
async function fillThumbs(root,size){const R=S.frame?.contentWindow?.TTRoom;if(!R)return;
 for(const im of root.querySelectorAll('img[data-thumb]')){const k=im.dataset.thumb,ck=k+'@'+size;
  if(S.thumbs[ck]){im.src=S.thumbs[ck];continue;}
  try{const u=await R.thumbAsync(k,size);if(u){S.thumbs[ck]=u;im.src=u;}}catch(_){}}}

// ---------- 家具店（大廳的 houseShopM 視窗）----------
function openShop(){if(!S.on||S.visit)return;closePanel();renderShop();try{gOpen('houseShopM');}catch(_){}}
function renderShop(){const host=document.querySelector('#houseShopM .tt-house-shop');if(!host||!S.cat)return;
 const sets=['酒館日常','萬用系列'],kinds=[['all','全部'],['floor','地板'],['wall','牆面']];
 const list=S.cat.filter(c=>c.set===S.shopSet&&(S.shopKind==='all'||c.kind===S.shopKind));
 const sale=list.filter(c=>priceOf(c.k)||c.starter);
 host.innerHTML='<div class="tt-hs-bar"><div class="tt-hs-sets" role="tablist">'+sets.map(s=>'<button type="button" role="tab" data-set="'+s+'" aria-selected="'+(S.shopSet===s)+'">'+s+'</button>').join('')+'</div>'
  +'<div class="tt-hs-kinds">'+kinds.map(([k,n])=>'<button type="button" data-kind="'+k+'" aria-pressed="'+(S.shopKind===k)+'">'+n+'</button>').join('')+'</div>'
  +'<div class="tt-hs-wallet">'+TTCat.coin(22,'c')+'<b data-cat-pop>'+TTCat.fmt(window.__cat||0)+'</b>'+(TTCat.EXCHANGE_ON?'<button type="button" class="tt-hs-ex">用金幣兌換</button>':'<small>每日任務每天送 '+TTCat.DAILY+'</small>')+'</div></div>'
  +'<p class="tt-hs-note">大件家具比較大、做得越精緻越貴。買了會放進背包，按「佈置」就能擺進房間。</p>'
  +'<div class="tt-hs-grid">'+(sale.length?sale.map((c,i)=>{const p=priceOf(c.k),own=owned(c.k);
   return '<article class="tt-hs-card"><span class="tt-hs-no">'+String(i+1).padStart(2,'0')+'</span>'
    +'<div class="tt-hs-pic"><img alt="" data-thumb="'+c.k+'"></div>'
    +'<h3>'+esc(c.name)+'</h3><p class="tt-hs-tag">'+SIZE_NAME[c.size]+'・'+TIER_NAME[c.tier]+(own?'<span class="own">已有 '+own+' 件</span>':'')+'</p>'
    +(c.starter&&!p?'<p class="tt-hs-gift">入住禮・已送你一件</p>'
      :'<button type="button" class="tt-hs-buy" data-buy="'+c.k+'">'+TTCat.tag(TTCat.price(p),16)+'<span class="lbl">購買</span></button>')
    +'</article>';}).join(''):'<p class="tt-hs-empty">這一區的家具還在準備中</p>')+'</div>';
 fillThumbs(host,136);}
document.addEventListener('click',e=>{
 const t=e.target.closest('#houseShopM [data-set],#houseShopM [data-kind],#houseShopM [data-buy],#houseShopM .tt-hs-ex');if(t){
  if(t.dataset.set){S.shopSet=t.dataset.set;renderShop();}
  else if(t.dataset.kind){S.shopKind=t.dataset.kind;renderShop();}
  else if(t.dataset.buy)askBuy(t.dataset.buy);
  else if(t.classList.contains('tt-hs-ex')){try{gClose('houseShopM');}catch(_){}try{openTopup();}catch(_){}}
  return;}
 const b=e.target.closest('#ttHouseBag [data-bk],#ttHouseBag [data-k]');if(b){
  if(b.dataset.bk){S.bagKind=b.dataset.bk;renderBag();return;}
  const k=b.dataset.k;if(left(k)<=0){say('這件都擺出來了，點房間裡的它就能移動');return;}
  try{S.frame.contentWindow.TTRoom.grabNew(k);}catch(_){}
  return;}
 const v=e.target.closest('#ttVisitPanel [data-vis],#ttVisitPanel [data-go],#ttVisitPanel [data-invite],#ttVisitPanel [data-kick],#ttVisitPanel .tt-vp-random,#ttVisitPanel .tt-vp-close');if(v){
  if(v.dataset.vis)setVis(v.dataset.vis);
  else if(v.dataset.go)visit(v.dataset.go,'friend');
  else if(v.dataset.invite)invite(v.dataset.invite,v);
  else if(v.dataset.kick)kick(v.dataset.kick);
  else if(v.classList.contains('tt-vp-random'))randomVisit();
  else closePanel();}});
window.addEventListener('tt-cat',()=>{const b=document.querySelector('#houseShopM .tt-hs-wallet b');if(b)b.textContent=TTCat.fmt(window.__cat||0);});

function askBuy(k){const c=S.byKey[k],p=priceOf(k);if(!c||!p)return;const cat=TTCat.price(p);
 ttConfirm('購買「'+c.name+'」？','使用 '+TTCat.fmt(cat)+' 貓貓幣。買了會放進背包，按「佈置」就能擺進房間。',()=>buy(k),'確定購買');}
async function buy(k){const c=S.byKey[k],p=priceOf(k),key=S.key;if(S.buying||!c||!p||!key||key!==KEY())return;
 const CAT=TTCat.price(p);S.buying=true;
 try{const bal=await DB().ref(R()+'/cat/'+key+'/balance').once('value');
  if(!Number.isSafeInteger(bal.val())||bal.val()<CAT){say('貓貓幣不夠，還差 '+TTCat.fmt(CAT-(Number(bal.val())||0))+(TTCat.EXCHANGE_ON?'，可以先到錢包用金幣兌換':'（每日任務每天送 '+TTCat.DAILY+'）'));return;}
  const ref=DB().ref(R()+'/clientOrders').push(),ts=Date.now(),name=(typeof me==='function'&&me()?.b?.name)||'酒館客人';
  const o={type:'shop',plan:'house:'+k,planName:'小屋家具・'+c.name,amount:p,origAmount:p,couponUsed:false,couponDisc:0,itemId:'house:'+k,itemName:c.name,name,paidBy:'cat',catAmount:CAT,status:'done',createdAt:ts,myKey:key};
  await catSafety().execute({key,amount:CAT,ids:[ref.key],lookup:walletLookup,commit:async()=>{const ch={};
   ch['clientOrders/'+ref.key]=o;ch['cat/'+key+'/balance']=firebase.database.ServerValue.increment(-CAT);
   ch['catTx/'+key+'/'+ref.key]={type:'spend',amount:-CAT,ref:ref.key,note:o.planName,ts};ch['cat/'+key+'/lastTx']=ref.key;
   ch['houseInv/'+key+'/'+k+'/'+ref.key]={ts};await DB().ref(R()).update(ch);}});
  try{rememberPaymentIds([ref.key]);}catch(_){}
  if(S.on&&S.key===key&&!S.visit){S.inv[k]={...(S.inv[k]||{}),[ref.key]:{ts}};renderShop();renderBag();
   ttConfirm('「'+c.name+'」帶回家了！','要現在擺進房間嗎？',()=>{try{gClose('houseShopM');}catch(_){}setMode('edit');setTimeout(()=>{try{S.frame.contentWindow.TTRoom.grabNew(k);}catch(_){}},60);},'現在擺');}
 }catch(e){if(e&&e.ids)try{rememberPaymentIds(e.ids);}catch(_){}say(e&&e.message||'購買沒有完成，請到訂單看看');}
 finally{S.buying=false;}}

// ---------- v504 串門子 ----------
// 開放設定：存在自己的小屋紀錄（換裝置也記得），快照、隨機名單跟著改；改得更嚴時，現在不該在的人請他們先離開
async function setVis(v){if(!VIS_NAME[v]||!S.key||S.visit||v===S.vis)return;const old=S.vis;S.vis=v;renderPanel();
 try{const lay=room('layout'),upd={vis:v,at:TS()};if(Array.isArray(lay)&&lay.length)upd.layout=JSON.parse(JSON.stringify(lay));
  await DB().ref(R()+'/house/'+S.key).update(upd);await publish(lay);   // v505：原本只寫 vis，新小屋（還沒動過家具、沒有紀錄）會被規則擋
  if(v!=='public'){const fr=S.friends||(S.friends=(await DB().ref(R()+'/friends/'+S.key).once('value')).val()||{}),ch={};
   for(const s of SEATS){const g=S.room[s];if(g&&g.k!==S.key&&(v==='private'||!fr[g.k]))ch['houseRoom/'+S.key+'/'+s]=null;}
   if(Object.keys(ch).length)await DB().ref(R()).update(ch);}
  say('小屋改成「'+VIS_NAME[v]+'」了');}
 catch(_){S.vis=old;renderPanel();say('沒有改成功，請檢查網路後再試一次');}}
// 去別人的小屋：讀得到快照、坐得下才進去
async function visit(key,via){
 if(isPhone()){say('小屋請用電腦開，手機版之後再開放');return false;}
 const mk=KEY();if(!mk||!DB()){say('先做一張闆卡、用 Discord 登入，才能去別人的小屋玩');return false;}
 if(!key)return false;
 if(key===mk){enter();return true;}
 if(S.visit&&S.visit.key===key)return true;
 if(S.joining)return false;S.joining=true;
 try{
  let view=null,owner=null;
  try{const [v,o]=await Promise.all([DB().ref(R()+'/houseView/'+key).once('value'),DB().ref(R()+'/lobby/'+key).once('value').catch(()=>null)]);view=v.val();owner=o?o.val():null;await loadCatalog();}
  catch(_){view=null;}
  if(!view||!(Array.isArray(view.layout)||view.at)){if(via!=='random')say('這間小屋現在沒有開放');return false;}
  if(!Array.isArray(view.layout))view.layout=[];   // v505：主人把家具全收起來了，空房間照樣可以進
  const name=String((owner&&owner.name)||view.name||'旅人').slice(0,40);
  const st=await sit(key);   // 先在對方家坐好，坐不下就留在原地
  if(st.r!=='ok'){if(via!=='random')say(st.r==='full'?name+' 的小屋客滿了（最多 4 人），等一下再來':st.r==='kicked'?name+' 請你先離開了，過一陣子再來吧':'這間小屋現在沒有開放');return false;}
  if(S.on)await teardown();
  useSeat(st);
  try{window.TinyTavernUI?.close?.();window.TTHub?.close?.();window.dmClose?.();}catch(_){}
  S.visit={key,name,layout:view.layout,via,likes:0,liked:false};S.key=mk;S.hk=key;S.on=true;S.mode='walk';
  if(owner&&owner.doll)S.dolls[key]=dollCanvasOf(owner.doll);
  document.body.classList.add('tt-house-on','tt-house-visit');document.body.classList.remove('tt-house-edit');
  setSign('Tiny Tavern・拜訪小屋',name+' 的小屋');
  if(via==='random')S.seen.add(key);
  DB().ref(R()+'/houseVisit/'+key+'/'+mk).update({name:myName(),at:TS()}).catch(()=>{});
  watch('houseVisit/'+key,v=>{const vs=v||{},m=vs[mk];if(!S.visit||S.visit.key!==key)return;S.visit.likes=Object.values(vs).filter(x=>x&&x.like===true).length;S.visit.liked=!!(m&&m.like===true);renderTop();});
  startRoom(key);
  openFrame(name+' 的小屋',()=>{room('spawn',+S.seat);S.last=null;pubPos();pushPeers();const host=SEATS.some(s=>S.room[s]&&S.room[s].k===key&&S.room[s].at>Date.now()-STALE);
    room('hint',host?'來到 '+name+' 的小屋了，打聲招呼吧':name+' 現在不在家，可以到處看看');});
  renderTop();renderKeys();renderChat();return true;
 }finally{S.joining=false;}}
// 隨機拜訪：公開名單裡挑一間，主人兩分鐘內在家的先挑；這次逛過的先跳過
async function randomVisit(){const mk=KEY();if(!mk||!DB()){say('先做一張闆卡、用 Discord 登入，才能去別人的小屋玩');return;}
 let all={};try{all=(await DB().ref(R()+'/houseDir').orderByChild('at').limitToLast(200).once('value')).val()||{};}catch(_){}
 const cur=S.visit?.key,now=Date.now(),mix=a=>a.map(k=>[Math.random(),k]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
 let keys=Object.keys(all).filter(k=>k!==mk&&k!==cur);if(keys.every(k=>S.seen.has(k)))S.seen.clear();keys=keys.filter(k=>!S.seen.has(k));
 const home=keys.filter(k=>all[k]&&all[k].on>now-120000),away=keys.filter(k=>!home.includes(k));
 const pool=[...mix(home),...mix(away)];
 if(!pool.length){say('現在還沒有其他開放的小屋，過幾天再來看看');return;}
 for(const k of pool.slice(0,6)){if(await visit(k,'random'))return;S.seen.add(k);}
 say('剛剛那幾間都客滿或沒開放，再按一次試試');}
async function toggleLike(){const v=S.visit,mk=KEY();if(!v||!mk)return;const next=!v.liked;v.liked=next;v.likes+=next?1:-1;renderTop();
 try{await DB().ref(R()+'/houseVisit/'+v.key+'/'+mk).update({name:myName(),at:TS(),like:next});if(next)say('幫 '+v.name+' 的小屋按了讚');}
 catch(_){v.liked=!next;v.likes+=next?-1:1;renderTop();say('沒有按成功，請再試一次');}}
// 請客人離開：起身＋10 分鐘內不能再進來
async function kick(k){if(S.visit||!S.key)return;const s=SEATS.find(x=>S.room[x]&&S.room[x].k===k);if(!s)return;
 const nm=S.room[s].name||'這位客人';
 ttConfirm('請 '+nm+' 先離開小屋？','10 分鐘內對方不能再進來。要完全擋住，可以到通訊錄封鎖對方。',async()=>{
  try{await DB().ref(R()).update({['houseRoom/'+S.key+'/'+s]:null,['houseKick/'+S.key+'/'+k]:TS()});say('已經請 '+nm+' 先離開了');}
  catch(_){say('沒有成功，請再試一次');}},'請他離開');}
// 邀請好友：私訊一張邀請卡（跟一般私訊一樣只限互為好友、封鎖的人收不到）
async function invite(fk,btn){const mk=KEY();if(!mk||!DB()||!fk)return;
 const fr=S.friends||{};if(!fr[fk]){say('只能邀請好友喔');return;}
 if(!isOn(fk)){say((fr[fk].name||'對方')+' 現在不在線上，等他上線再邀請吧');renderPanel();return;}
 if(window.ttIsMuted?window.ttIsMuted():!!window.__mute){say('你目前被禁言中，暫時無法傳私訊');return;}
 if(S.vis==='private'){say('你的小屋現在是「不公開」，先改成公開或只限好友再邀請');return;}
 if(btn)btn.disabled=true;
 try{const b=await DB().ref(R()+'/blocks/'+fk+'/'+mk).once('value');if(b.val()){say('對方目前無法接收你的私訊');if(btn)btn.disabled=false;return;}
  const at=Date.now(),to=fr[fk].name||'',x='來我的小屋一起聊天吧！',last='［小屋邀請］'+x;
  await DB().ref(R()+'/dm/'+[mk,fk].sort().join('~')).push({f:mk,x,at,house:mk});
  await Promise.allSettled([DB().ref(R()+'/dmMeta/'+mk+'/'+fk).update({last,lastAt:at,name:to}),DB().ref(R()+'/dmMeta/'+fk+'/'+mk).update({last,lastAt:at,name:myName()}),DB().ref(R()+'/dmMeta/'+fk+'/'+mk+'/unread').transaction(c=>(c||0)+1)]);
  say('已經邀請 '+(to||'好友')+' 來你的小屋');if(btn)btn.textContent='已邀請';
 }catch(_){say('邀請沒有送出，請稍後再試');if(btn)btn.disabled=false;}}

// 「串門子」側欄（自己的小屋才有）：誰可以進來、現在在小屋裡的人、隨機拜訪、好友、最近來玩的人
function openPanel(){if(!S.on||S.visit)return;if(S.mode==='edit')setMode('walk');S.panel=true;document.body.classList.add('tt-house-panel');renderPanel();renderTop();loadFriends();
 clearInterval(S.onT);S.onT=setInterval(()=>{if(S.panel&&onSig()!==S.onSig)renderPanel();},3000);   // 好友上線／下線時才重畫（不然按鈕會被換掉、點不到）
 requestAnimationFrame(()=>room('frame'));}
function closePanel(){clearInterval(S.onT);S.onT=0;if(!S.panel)return;S.panel=false;document.body.classList.remove('tt-house-panel');requestAnimationFrame(()=>room('frame'));}
// v506 D：「邀請好友應該是邀請在線上的」→ 在線＝大廳有他的位置心跳（posMap，跟通訊錄同一套；在自己小屋裡的人大廳也照常回報）
const isOn=k=>{try{return !!posMap[k];}catch(_){return false;}};
const onSig=()=>Object.keys(S.friends||{}).filter(isOn).sort().join('|');
async function loadFriends(){const mk=KEY();if(!mk||!DB())return;try{S.friends=(await DB().ref(R()+'/friends/'+mk).once('value')).val()||{};}catch(_){S.friends={};}renderPanel();}
const ago=t=>{const m=Math.max(0,Math.round((Date.now()-(Number(t)||0))/60000));return m<1?'剛剛':m<60?m+' 分鐘前':m<1440?Math.round(m/60)+' 小時前':Math.round(m/1440)+' 天前';};
function renderPanel(){const box=$('ttVisitPanel');if(!box||!S.panel)return;
 const vs=Object.entries(S.visitors||{}).filter(([,v])=>v&&typeof v==='object'),likes=vs.filter(([,v])=>v.like===true).length;
 const recent=vs.sort((a,b)=>(b[1].at||0)-(a[1].at||0)).slice(0,8);
 const here=SEATS.map(s=>S.room[s]).filter(v=>v&&v.k!==S.key&&v.at>Date.now()-STALE*2);
 const fr=S.friends;const frs=fr?Object.entries(fr).filter(([,v])=>v&&typeof v==='object').sort((a,b)=>String(a[1].name||'').localeCompare(String(b[1].name||''),'zh-Hant')):null;
 S.onSig=onSig();const fOn=frs?frs.filter(([k])=>isOn(k)):[],fOff=frs?frs.filter(([k])=>!isOn(k)):[];
 const goBtn=k=>'<button type="button" class="tt-vp-go" data-go="'+esc(k)+'">去他家</button>';
 box.querySelector('.tt-vp-body').innerHTML=
  '<section class="tt-vp-sec"><h4>誰可以進來</h4><div class="tt-vp-vis" role="radiogroup" aria-label="小屋開放設定">'
   +Object.entries(VIS_NAME).map(([k,n])=>'<button type="button" role="radio" data-vis="'+k+'" aria-checked="'+(S.vis===k)+'">'+n+'</button>').join('')+'</div>'
   +'<p class="tt-vp-tip">'+VIS_TIP[S.vis]+'</p></section>'
  +'<section class="tt-vp-sec"><h4>現在在小屋裡<span class="tt-vp-cnt">'+(here.length+1)+' / 4 人</span></h4>'+(here.length?'<ul class="tt-vp-list">'+here.map(v=>'<li><b>'+esc(v.name||'旅人')+'</b><span><button type="button" class="tt-vp-kick" data-kick="'+esc(v.k)+'">請離開</button></span></li>').join('')+'</ul>'
   :'<p class="tt-vp-empty">只有你一個人。邀請好友進來一起聊天吧</p>')+'</section>'
  +'<section class="tt-vp-sec"><h4>邀請好友'+(frs&&frs.length?'<span class="tt-vp-cnt">在線上 '+fOn.length+' 位</span>':'')+'</h4>'
   +(frs===null?'<p class="tt-vp-empty">讀取中…</p>':!frs.length?'<p class="tt-vp-empty">還沒有好友。在大廳點開別人的闆卡，就能送出好友邀請。</p>'
    :(fOn.length?'<ul class="tt-vp-list">'+fOn.map(([k,v])=>'<li><b class="tt-vp-on">'+esc(v.name||'旅人')+'</b><span>'
       +'<button type="button" class="tt-vp-inv" data-invite="'+esc(k)+'">邀請</button>'+goBtn(k)+'</span></li>').join('')+'</ul>'
      :'<p class="tt-vp-empty">現在沒有好友在線上，等大家上線再邀請吧。</p>')
    +(fOff.length?'<h5 class="tt-vp-sub">不在線上的好友（可以去他家看看）</h5><ul class="tt-vp-list tt-vp-off">'+fOff.map(([k,v])=>'<li><b>'+esc(v.name||'旅人')+'</b><span>'+goBtn(k)+'</span></li>').join('')+'</ul>':''))+'</section>'
  +'<section class="tt-vp-sec"><button type="button" class="tt-vp-random">隨機拜訪一間小屋</button></section>'
  +'<section class="tt-vp-sec"><h4>最近來玩的人<span class="tt-vp-likes">♥ '+likes+'</span></h4>'+(recent.length?'<ul class="tt-vp-list tt-vp-guests">'+recent.map(([,v])=>'<li><b>'+esc(v.name||'旅人')+'</b><small>'+ago(v.at)+(v.like===true?'・<i>♥</i>':'')+'</small></li>').join('')+'</ul>'
   :'<p class="tt-vp-empty">還沒有人來過</p>')+'</section>';}

// ---------- 介面：右下（佈置、家具店）、右上（回大廳、縮放）、佈置清單 ----------
const ICON={
 houseImg:'<img src="lobby-ui/assets/house.png" alt="">',   // v497 大廳 dock 的小屋鈕：像素小屋圖示（跟我的酒館／商城／背包同一套畫風）
 house:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 13 14 4.5 24 13"/><path d="M7 11v12h14V11"/><path d="M12 23v-6h4v6"/></svg>',
 brush:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M6 22c3 0 5-2 5-5l9-11 3 3-11 9c0 3-2 5-6 4z"/><path d="M15 9l4 4"/></svg>',
 shop:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 11h18l-1.5 11h-15z"/><path d="M9 11V8a5 5 0 0 1 10 0v3"/><path d="M11 16h6"/></svg>',
 back:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M11 7 5 13l6 6"/><path d="M5 13h12a6 6 0 0 1 0 12h-3"/></svg>',
 plus:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 7v14M7 14h14"/></svg>',
 help:'<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="10"/><path d="M10.8 11a3.3 3.3 0 1 1 4.6 3c-1 .5-1.4 1.1-1.4 2.2"/><path d="M14 19.6v.4"/></svg>',
 minus:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 14h14"/></svg>',
 fit:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 10V5h5M18 5h5v5M23 18v5h-5M10 23H5v-5"/></svg>',
 visit:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 14 9 9l6 5"/><path d="M5 12.5V21h8v-8.5"/><path d="M15 11l5-4 5 4"/><path d="M17 9.5V21h6V9.5"/></svg>',
 heart:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 23s-9-5.4-9-11.5A4.8 4.8 0 0 1 14 9a4.8 4.8 0 0 1 9 2.5C23 17.6 14 23 14 23z"/></svg>',
 dice:'<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="5" y="5" width="18" height="18" rx="4"/><path d="M10 10h.01M18 10h.01M14 14h.01M10 18h.01M18 18h.01"/></svg>'};
function btn(id,cls,icon,label,fn){const b=document.createElement('button');b.type='button';b.id=id;b.className=cls;b.innerHTML=ICON[icon]+'<span>'+label+'</span>';b.onclick=fn;return b;}
function build(){
 const dock=$('ttMainDock');if(!dock||$('ttHouseBtn'))return;
 const entry=btn('ttHouseBtn','tt-house-entry','houseImg','小屋',enter);
 const hub=$('ttHubButton');if(hub)hub.after(entry);else dock.prepend(entry);
 dock.append(btn('ttHouseEdit','tt-house-only','brush','佈置',()=>setMode('edit')));
 dock.append(btn('ttHouseShop','tt-house-only tt-house-main','shop','家具店',openShop));
 const top=document.createElement('div');top.id='ttHouseTop';
 top.append(btn('ttVisitLike','tt-house-btn tt-visit-only','heart','讚',toggleLike),btn('ttVisitNext','tt-house-btn tt-visit-only','dice','下一間',randomVisit),
  btn('ttVisitHome','tt-house-btn tt-visit-only','house','我的小屋',enter),
  btn('ttHouseVisit','tt-house-btn tt-own-only','visit','拜訪',()=>S.panel?closePanel():openPanel()),btn('ttHouseHelp','tt-house-btn tt-own-only','help','教學',houseTour),btn('ttHouseBack','tt-house-btn','back','回大廳',exit));
// v495 D：右邊的放大／縮小／整間拿掉（滾輪縮放、按住拖曳照樣能用），「我的家具」改成右側整欄
 const bag=document.createElement('section');bag.id='ttHouseBag';bag.setAttribute('aria-label','我的家具');
 bag.innerHTML='<header><span class="tt-hb-title"><b>我的家具</b><small>MY FURNITURE</small></span><div class="tt-hb-acts"><button type="button" class="tt-hb-shop">去家具店</button><button type="button" class="tt-hb-done">完成</button></div><div class="tt-hb-tabs"></div></header>'
  +'<p class="tt-hb-tip">點家具拿出來，移到房間裡再點一下放好；點房間裡的家具可以移動。</p><div class="tt-hb-grid"></div>';
 bag.querySelector('.tt-hb-shop').onclick=openShop;bag.querySelector('.tt-hb-done').onclick=()=>setMode('walk');
 // v504 串門子側欄（跟「我的家具」同一個位置、同一套外觀）
 const vp=document.createElement('section');vp.id='ttVisitPanel';vp.setAttribute('aria-label','拜訪');   // v506 D：「串門子」聽起來像中國用語 → 拜訪
 vp.innerHTML='<header><span class="tt-hb-title"><b>拜訪</b><small>VISIT</small></span><button type="button" class="tt-vp-close">關閉</button></header><div class="tt-vp-body"></div>';
 // v504 小屋聊天（左下）：最近幾句＋輸入框；說的話也會冒在小人頭上
 const chat=document.createElement('section');chat.id='ttHouseChat';chat.setAttribute('aria-label','小屋聊天');
 chat.innerHTML='<header><b>小屋聊天</b><small class="tt-hc-who"></small></header><div class="tt-hc-log" aria-live="polite"></div>'
  +'<form class="tt-hc-form"><input id="ttHouseSay" maxlength="'+CHAT_MAX+'" autocomplete="off" placeholder="說點什麼…（Enter 送出）" aria-label="在小屋裡說話"><button type="submit">送出</button></form>';
 chat.querySelector('form').addEventListener('submit',e=>{e.preventDefault();sendChat();});
 const keys=document.createElement('p');keys.id='ttHouseKeys';keys.setAttribute('aria-live','polite');
 document.body.append(top,bag,vp,chat,keys);renderKeys();renderChat();
 // 家具店視窗：live.js 已經把 #houseShopM 包成大廳同一套外框，這裡換掉頁尾字、放內容
 const m=$('houseShopM');if(m){const c=m.querySelector('.panel-content')||m.querySelector('.gin');if(c&&!c.querySelector('.tt-house-shop')){c.innerHTML='<div class="tt-house-shop"></div>';}
   const back=m.querySelector('.back-menu');if(back)back.textContent='← 回小屋';}
}
// 右上按鈕：在別人家顯示讚數；隨機來的才有「下一間」；自己家的「串門子」有新客人來過會亮小紅點
function renderTop(){const v=S.visit,like=$('ttVisitLike'),next=$('ttVisitNext'),vb=$('ttHouseVisit');
 if(like){like.classList.toggle('on',!!(v&&v.liked));like.setAttribute('aria-pressed',String(!!(v&&v.liked)));const sp=like.querySelector('span');if(sp)sp.textContent=v?'讚 '+v.likes:'讚';}
 if(next)next.hidden=!(v&&v.via==='random');
 if(vb){let seen=0;try{seen=Number(localStorage.getItem('tt_house_seen_visit')||0);}catch(_){}
   const n=Object.values(S.visitors||{}).filter(x=>x&&x.at>seen).length;vb.classList.toggle('dot',!v&&n>0&&!S.panel);
   if(S.panel)try{localStorage.setItem('tt_house_seen_visit',String(Date.now()));}catch(_){}}}
function room(fn,...a){try{return S.frame?.contentWindow?.TTRoom?.[fn](...a);}catch(_){}}
// v495 D：畫面最下面常駐一行白字的玩法說明（跟著現在在做什麼換：散步／佈置／拿著家具）
const K=k=>'<kbd>'+k+'</kbd>';
function renderKeys(){const el=$('ttHouseKeys');if(!el)return;const hold=S.mode==='edit'&&!!room('holding');
 el.classList.toggle('edit',S.mode==='edit');
 el.innerHTML=S.visit?esc(S.visit.name)+' 的小屋　點地板＝走過去　'+K('按住拖曳')+' 移動視角　'+K('滾輪')+' 放大縮小'
  :S.mode!=='edit'?'點地板＝走過去　'+K('按住拖曳')+' 移動視角　'+K('滾輪')+' 放大縮小　按「佈置」開始擺家具'
  :hold?'移動滑鼠＝搬家具　'+K('點一下')+' 放好　'+K('R')+' 轉向　'+K('Delete')+' 收回背包　'+K('Esc')+' 取消'
  :'點右邊的家具＝拿出來　點房間裡的家具＝拿起來移動　'+K('按住拖曳')+' 移動視角　'+K('滾輪')+' 放大縮小';}

// ---------- 給房間（iframe）用的介面 ----------
window.TTHouse={
 initialLayout:()=>S.visit?S.visit.layout:S.layout,
 visiting:()=>S.visit?{key:S.visit.key,name:S.visit.name}:null,
 save,
 changed:()=>{renderBag();renderKeys();},
 modeChanged:m=>{if(S.mode!==m){S.mode=m;document.body.classList.toggle('tt-house-edit',m==='edit');renderBag();}renderKeys();},
 dollCanvas:myDollCanvas,
 insets(){const vh=innerHeight,vw=innerWidth;let t=20,b=20,l=20,r=20;
  const sg=$('sign')?.getBoundingClientRect();if(sg&&sg.height)t=Math.max(t,sg.bottom+12);
  const hud=$('hud2')?.getBoundingClientRect();if(hud&&hud.height&&hud.right>vw*.3)t=Math.max(t,hud.bottom+8);
  const dk=$('ttMainDock')?.getBoundingClientRect();if(dk&&dk.height&&!document.body.classList.contains('tt-house-edit'))b=Math.max(b,vh-dk.top+10);
  const side=document.body.classList.contains('tt-house-edit')?$('ttHouseBag'):S.panel?$('ttVisitPanel'):null;
  if(side){const q=side.getBoundingClientRect();if(q.width)r=Math.max(r,vw-q.left+12);}   // 佈置、串門子：右側整欄
  const ch=$('ttHouseChat')?.getBoundingClientRect();if(ch&&ch.width&&ch.right<vw*.4)l=Math.max(l,ch.right+12);   // 左下的小屋聊天
  return {t,b,l,r};},
 enter,exit,openShop,visit,randomVisit,
 state:()=>({on:S.on,mode:S.mode,inv:S.inv,visit:S.visit?{key:S.visit.key,name:S.visit.name,via:S.visit.via}:null,vis:S.vis,seat:S.seat,room:S.room,chat:S.chatLog.slice(-5)})};
addEventListener('keydown',e=>{const t=e.target;if(!S.on||(t&&typeof t.closest==='function'&&t.closest('input,textarea')))return;
 if(S.mode==='edit'&&room('key',e.key)){e.preventDefault();renderKeys();return;}   // 焦點在大廳時，R／Delete／Esc 轉給房間
 if(e.key==='Escape'&&S.panel){closePanel();return;}
 if(e.key==='Escape'&&S.mode==='edit'&&!room('holding'))setMode('walk');
 if(e.key==='Enter'&&S.mode!=='edit'){const i=$('ttHouseSay');if(i){e.preventDefault();i.focus();}}});
addEventListener('pagehide',()=>{if(S.seatRef)try{S.seatRef.remove();}catch(_){}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
