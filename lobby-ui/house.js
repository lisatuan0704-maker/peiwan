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
const VER='567';
const SIZE_NAME={S:'小件',M:'中件',L:'大件'},TIER_NAME={1:'簡單',2:'標準',3:'精緻'};
const S={fx:null,fxHost:{},fxOpen:false,fxTry:null,fxT:0,fxRemote:false,on:false,frame:null,cat:null,byKey:{},inv:{},layout:null,subs:[],mode:'walk',saveT:0,buying:false,shopSet:'酒館日常',shopKind:'all',bagKind:'all',bagQ:'',bagOpen:false,newShown:new Map(),thumbs:{},sign:null,key:null,
  vis:'public',visit:null,joining:false,seen:new Set(),panel:false,visitors:{},friends:null,
  hk:null,seat:null,seatRef:null,room:{},dolls:{},dollWait:{},dollW:{},chatSeen:new Set(),chatLog:[],joinedAt:0,pubT:0,beatT:0,last:null,lastPub:0,leaving:false};
const VIS_NAME={public:'公開',friends:'只限好友',private:'不公開'};
const VIS_TIP={public:'好友和隨機拜訪的老闆都能進來一起聊天（擺 5 件以上才會出現在隨機拜訪）',friends:'只有好友能進來，不會出現在隨機拜訪',private:'只有你自己，誰都不能進來'};
const DIR_MIN=5;          // 入住禮 4 件＋至少再擺 1 件，才放進隨機拜訪名單
const SEATS=['0','1','2','3'],STALE=45000,CHAT_MAX=120;
// v507 小屋擴建（D：花比較多貓貓幣可以擴建）：14→18→22 格，一次擴一級；價格是店長頁 shopConfig/house:size18、house:size22（金幣等值價，扣 ×10 貓貓幣）
const SIZES=[14,18,22],sizeOk=n=>SIZES.includes(+n)?+n:14,nextSize=()=>SIZES[SIZES.indexOf(sizeOk(S.size))+1]||0;
const STK_ICON='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8l-7 7Z"/><path d="M14 21v-4a3 3 0 0 1 3-3h4M8 9h.01M15 9h.01M8 13q3 4 6 0"/></svg>';
const TS=()=>firebase.database.ServerValue.TIMESTAMP;
const myName=()=>((typeof me==='function'&&me()?.b?.name)||'酒館客人').slice(0,40);
const isPhone=()=>document.documentElement.classList.contains('ttm-on')&&!window.TTGame;   // v539 手機遊戲式畫面（TTGame）可以進小屋
const r2=v=>Math.round(v*100)/100;

// ---------- 資料 ----------
// v510 壁紙／地板（D 11/08：小屋右下多一個「商城」，專門賣之後每個系列的壁紙跟地板；買了可以選要貼哪幾面牆、哪幾格地板，不用全換）
// 商品：shopConfig house:wall_<系列>／house:floor_<系列>（貓貓幣，跟家具同一條購買路、進 houseInv）；擺法存 house/<key>/paint {f:{'i_j':系列},w:{'L3':系列}}，拜訪快照 houseView 也帶著
const PAINTS=[{t:'forest',name:'森林精靈小屋'},{t:'mermaid',name:'海底人魚屋'},{t:'cn',name:'中華小惡魔'}],PAINT_BY={};
for(const p of PAINTS){PAINT_BY['wall_'+p.t]={k:'wall_'+p.t,name:p.name+'・壁紙',label:'小屋壁紙',paint:{kind:'w',theme:p.t}};PAINT_BY['floor_'+p.t]={k:'floor_'+p.t,name:p.name+'・地板',label:'小屋地板',paint:{kind:'f',theme:p.t}};}
const hasPaint=p=>!!p&&(Object.keys(p.f||{}).length>0||Object.keys(p.w||{}).length>0);
const itemOf=k=>S.byKey[k]||PAINT_BY[k];
// 家具券（11/23 中華卡池起）：異色家具的 key＝<原key>~<1～3>（catalog.json 的 base／var）。背包、擺設、存檔、拜訪快照都照一般家具的 key 處理；
// 異色只能用家具券換（gacha:true、price 0），家具店不賣。用券買的那筆 houseInv 是 {ts,src:'tix'}，跟其他來源一樣算一件。
const isVar=c=>!!(c&&(c.base||/~\d$/.test(c.k)));
async function loadCatalog(){if(S.cat)return S.cat;const r=await fetch('house/catalog.json?v='+VER,{cache:'no-store'});const a=await r.json();S.cat=a;a.forEach(c=>S.byKey[c.k]=c);return a;}
function unsub(){S.subs.forEach(f=>{try{f();}catch(_){}});S.subs=[];}
function watch(path,fn,q){let ref=DB().ref(R()+'/'+path);if(q)ref=q(ref);const h=s=>fn(s.val());ref.on('value',h,()=>fn(null));S.subs.push(()=>ref.off('value',h));}
const priceOf=k=>{const p=(window.__shopCfg||{})['house:'+k];return p&&p.cur==='cat'&&p.active!==false&&Number.isSafeInteger(p.price)&&p.price>0?p.price:0;};   // 金幣等值價（只賣標 cur:'cat' 的）
const owned=k=>(S.byKey[k]?.starter?1:0)+Object.keys(S.inv[k]||{}).length;
function placed(){try{return S.frame?.contentWindow?.TTRoom?.placed()||{};}catch(_){return {};}}
const left=k=>owned(k)-(placed()[k]||0);
// v509「我的家具」NEW：新拿到（主要是扭蛋）還沒從背包拿出來的家具。每位老闆一份存本機 tt_house_new_<key>：
// {b:第一次記錄的時間（之前就有的家具不算新）,k:{扭蛋結果交過來的家具:1},c:{家具:拿出來時看過的最新時間}}；houseInv 的 ts 比 b、c 都新＝NEW
function newGet(force){const mk=S.key||KEY();if(!mk)return null;if(S.nw&&S.nw.mk===mk)return S.nw;let v=null;
 try{v=JSON.parse(localStorage.getItem('tt_house_new_'+mk)||'null');}catch(_){}
 if(!v||typeof v!=='object'||!(v.b>0)){if(!force&&S.invOk!==mk)return null;   // 背包資料還沒到：先不記起點
  let b=SNOW();for(const g of Object.values(S.inv||{}))for(const x of Object.values(g||{}))b=Math.max(b,Number(x&&x.ts)||0);v={b};}
 S.nw={mk,b:+v.b,k:v.k&&typeof v.k==='object'?v.k:{},c:v.c&&typeof v.c==='object'?v.c:{}};newPut();return S.nw;}
function newPut(){const n=S.nw;if(!n)return;try{localStorage.setItem('tt_house_new_'+n.mk,JSON.stringify({b:n.b,k:n.k,c:n.c}));}catch(_){}}
const invTop=k=>{let t=0;for(const x of Object.values(S.inv[k]||{}))t=Math.max(t,Number(x&&x.ts)||0);return t;};
function isNew(k){const n=newGet();return !!n&&(!!n.k[k]||invTop(k)>Math.max(n.b,Number(n.c[k])||0));}
function newAdd(keys){const n=newGet(true);if(!n)return;for(const k of keys)if(S.byKey[k]||!S.cat)n.k[k]=1;
 const ks=Object.keys(n.k);if(ks.length>60)for(const k of ks.slice(0,ks.length-60))delete n.k[k];newPut();}
function newClear(k){const n=newGet(true);if(!n||(!n.k[k]&&!isNew(k)))return;delete n.k[k];n.c[k]=Math.max(SNOW(),invTop(k));newPut();}
// v572 D 11/26：NEW 只在「這一次」打開佈置時顯示——收起佈置（完成／Esc／離開小屋）就把「這次清單上列出來過的 NEW」當成看過，下次打開不用一件一件點掉。
// 只算真的列出來超過 NEW_SEEN_MS 的（S.newShown：家具 → 第一次列出來的時間）；停在別的分類沒列到的、程式自己切回散步（進門、開場教學）的都不算，留到下次。
const NEW_SEEN_MS=700;
function newSeenShown(){const mk=S.key||KEY(),sh=S.newShown;if(!mk||S.visit||!sh.size)return;const n=newGet(true);if(!n)return;const now=performance.now();let ch=false;
 for(const [k,t] of sh)if(now-t>=NEW_SEEN_MS&&(n.k[k]||isNew(k))){delete n.k[k];n.c[k]=Math.max(SNOW(),invTop(k));ch=true;}
 if(ch)newPut();}
// v572「我的家具」分類＋搜尋（D 11/26：家具種類越來越多，很難找到想要的）。牆上的一律「壁掛」；落地的照下面這張表（一件可以放兩類，例如吊床＝椅子＋床）。
// 之後新增的家具沒列進表：catalog.json 有 cat 欄就用它，沒有就照名字猜（BAG_RULES，由上往下第一個符合的），都猜不到放「擺飾」。
const BAG_CATS=[['table','桌子'],['seat','椅子'],['store','櫃子'],['bed','床'],['screen','屏風'],['plant','植物'],['wall','壁掛'],['light','燈具'],['rug','地毯'],['kitchen','廚房衛浴'],['scene','造景'],['decor','擺飾']];
const BAG_OF={},BAG_MEMO=new Map();
for(const [cat,keys] of Object.entries({
 table:'vf_desk vf_coffeetable vf_counter vr_desk vr_sidetable vr_dining vr_s_a_sidetable vr_s_g_desk vr_s_i_teatable vl_turtletable vl_fishbowl vp_stumptable vp_diningtable vp_potting vs_mahjong vanity teatable sidetable vs_roundtable vs_baxian vs_shuan vs_chatai vs_stonetable',
 seat:'vf_chair vf_heartchair vf_sofa vf_stepstool vr_chair vr_sofa vr_armchair vr_sofa2b vr_s_e_hammock vl_clamchair vl_starpouf vl_sofa vl_shellsofa vp_stumpstool vp_mosssofa vp_flowerchair vp_logbench vp_branchchair vp_armchair vs_luohan vs_meirenta vs_quanyi vs_taishi vs_bench2',
 store:'vf_wardrobe vf_bookshelf vf_nightstand vf_dresser vf_chest vf_coatrack vf_cupboard vf_sideboard vf_aquarium vf_toychest vr_wardrobe vr_dresser vr_bookshelf vr_rack vr_cubeshelf vr_s_b_bookshelf vr_s_d_wardrobe vr_s_g_rack vl_coralshelf vl_treasure vl_wardrobe vl_crates vl_sideboard vl_curio vp_vineshelf wardrobe vs_duobao vs_dingxiang cabinet vs_chest vs_yaogui vs_bookcase',
 bed:'vf_bed vr_bed vr_dblbedb vr_s_g_bed vr_s_e_hammock vl_shellbed vp_leafbed bed vs_luohan vs_meirenta',
 screen:'vs_screen vs_moongate vs_fanscreen vs_bamboo vp_vinearch',
 plant:'vf_plant vf_flowerstand vf_tallplant vr_s_g_plant vr_s_h_cauldron vl_kelp vl_coraltree vp_acornpot vp_fern vp_sunflower vp_plantladder vs_huajia vs_penjing vs_plum vs_jar',
 light:'vl_corallamp vl_jellylamp vp_mushlamp vp_jarshelf vp_branchlamp vs_palacelamp vs_pagoda vs_lanternpost',
 rug:'vf_rug vf_rug2 vf_runner vr_rug vl_rug vl_rug2 vp_rug vp_runner vp_rug2 vs_rug3 vs_paving vs_rug2 vs_rug4',
 kitchen:'vf_teacart vf_kitchen vf_cupboard vr_sink vr_fridge vr_stove vr_bathtub vr_basin vr_s_a_dessertcart vs_dimsumcart',
 scene:'vl_reef vp_mushhouse vp_well vp_mossrock vp_pond vs_bridge vs_pavilion vs_river vs_well',
 decor:'vf_catbed vf_fireplace vf_aquarium vf_barrels vr_s_a_plushpile vr_s_b_fireplace vr_s_g_mirror vl_aquarium vl_wheel vl_anchor vl_barrel vl_helmet vl_pearlstand vl_bubbletube vl_fishbowl vp_berrybasket vp_wagon vp_hedgehog vp_easel vp_beehive vs_sedan vs_bianzhong vs_drum vs_birdcage vs_yijia vs_guzheng vs_ding vs_pipa vs_umbrella vs_winejars vs_crane vs_huagang'}))for(const k of keys.split(' '))BAG_OF[k]=BAG_OF[k]?BAG_OF[k]+' '+cat:cat;
const BAG_RULES=[['rug',/毯|地坪|地墊/],['screen',/屏風|插屏|門罩|拱門/],['store',/櫃|書架|書格|層架|箱|多寶格/],['bed',/床/],['seat',/椅|沙發|凳|坐墊|榻/],['table',/桌|几|書案|吧台|工作台|梳妝台|茶台/],['light',/燈/],['plant',/盆|花架|植物/],['kitchen',/爐台|流理|冰箱|浴缸|洗手|廚/]];
function bagCats(c){const b=(c.base&&S.byKey[c.base])||c;let v=BAG_MEMO.get(b.k);if(v)return v;
 if(b.kind==='wall')v=['wall'];else{const t=b.cat||BAG_OF[b.k];if(t)v=String(t).split(' ');else{const r=BAG_RULES.find(x=>x[1].test(b.name||''));v=[r?r[0]:'decor'];}}
 BAG_MEMO.set(b.k,v);return v;}
// 搜尋：名字裡有這幾個字＝1（排前面）；打的是分類名（椅子、衛浴…）或系列名（森林、人魚…）＝2；都不是＝0。空白、「・」不算字
const BAG_SETS={'酒館日常':['日常'],'萬用系列':['萬用'],'海底人魚屋':['海底','人魚'],'森林精靈小屋':['森林','精靈'],'中華小惡魔':['中華','小惡魔','惡魔']};
const bagNorm=s=>String(s||'').toLowerCase().replace(/[\s　・]+/g,'');
function bagMatch(c,q){if(bagNorm(c.name).includes(q))return 1;if(q.length<2)return 0;
 const cs=bagCats(c);if(BAG_CATS.some(([k,n])=>n.includes(q)&&cs.includes(k)))return 2;
 const st=c.set||'';return st.startsWith(q)||(BAG_SETS[st]||[]).some(a=>a.startsWith(q))?2:0;}
function bagFind(v){S.bagQ=v;const i=$('ttHouseFind');if(i&&i.value!==v)i.value=v;}
// 收起佈置：NEW 全部當成看過、搜尋清掉（下次打開從頭開始）
function bagLeave(silent){if(!S.bagOpen)return;S.bagOpen=false;if(!silent)newSeenShown();S.newShown=new Map();if(S.bagQ)bagFind('');}
// 打開佈置：有新家具就回到「全部」（NEW 排在最前面，才不會藏在別的分類裡）；正在貼壁紙／鋪地板不動
function bagEnter(){if(S.bagOpen)return;S.bagOpen=true;S.newShown=new Map();if(S.bagKind==='pw'||S.bagKind==='pf'||S.bagKind==='all'||!S.cat)return;
 const pl=placed();if(S.cat.some(c=>owned(c.k)-(pl[c.k]||0)>0&&isNew(c.k)))S.bagKind='all';}
// 佈置清單的縮圖大小：電腦跟著下排格子（--tt-hb-pic），手機照舊 136
const bagPic=()=>{if(window.TTGame)return 136;let v=0;try{v=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tt-hb-pic'),10);}catch(_){}return v>40?v:104;};

// ---------- 進出小屋 ----------
function dollCanvasOf(doll){const c=document.createElement('canvas');c.width=c.height=64;try{window.drawDollTo(c,doll||{},'idle');}catch(_){}return c;}
// v520：別人的時裝部件圖第一次用到才開始載，剛拿到資料就畫會少圖層 → 1.2 秒、3.5 秒後各重畫一次
function redrawDoll(k,doll){[1200,3500].forEach(ms=>setTimeout(()=>{if(S.dolls[k]===undefined||!S.frame)return;S.dolls[k]=dollCanvasOf(doll);pushPeers();},ms));}
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
 document.body.append(f);f.addEventListener('load',async()=>{try{await f.contentWindow.TTRoom.ready;}catch(_){}if(S.frame===f){f._ok=1;onReady();}});}   // _ok：房間畫好了（placeNew 等它）
async function enter(){
 if(S.on&&!S.visit)return;
 if(isPhone()){say('小屋請用電腦開，手機版之後再開放');return;}
 const key=KEY();if(!key||!DB()){say('先做一張闆卡、用 Discord 登入，才能回小屋');return;}
 if(S.joining)return;S.joining=true;
 const CT=!S.tripping&&window.TTHouseTrip?.curtain?TTHouseTrip.curtain('回小屋囉','TINY HOME'):null;let shown=false;   // v510 進小屋轉場：色條關上→換成房間→畫好再拉開
 const reveal=()=>{if(!shown){shown=true;CT&&CT.open();}};if(CT)setTimeout(reveal,8000);
 try{
  if(CT)await CT.covered;
  if(S.on)await teardown();
  S.key=key;S.hk=key;S.on=true;document.body.classList.add('tt-house-on');watchMyDoll();
  try{window.TinyTavernUI?.close?.();}catch(_){}
  setSign('Tiny Tavern・我的小屋',myName()+' 的小屋');
  let h=null;
  try{h=(await DB().ref(R()+'/house/'+key).once('value')).val()||{};}
  catch(e){await teardown();restoreSign();say('小屋讀不到，檢查一下網路再按一次「小屋」');return;}   // v508：讀不到≠新小屋
  S.layout=Array.isArray(h.layout)?h.layout:(h.at?[]:null);S.paint={f:{...(h.paint&&h.paint.f||{})},w:{...(h.paint&&h.paint.w||{})}};S.paintTouched=false;S.ptool=null;S.vis=VIS_NAME[h.vis]?h.vis:'public';S.size=sizeOk(h.size);   // v505：有存檔時間但沒擺設＝家具全收回背包了（不是新小屋，不再擺入住禮）
  const fxP=fxLoad(key);   // v526 光效設定（跟家具清單一起讀，不擋進門）
  try{window.TTGachaHost?.loadInfo?.(false)?.then(()=>{if(S.on)renderTix();});}catch(_){}   // 家具券開始了沒（主機的 tix.from，10 分鐘內讀過就不再讀）
  try{await loadCatalog();}catch(e){}   // 家具清單讀不到只影響背包／家具店，不能拿來當成新小屋
  if(!S.on||S.hk!==key||S.visit)return;
  watch('houseInv/'+key,v=>{S.inv=v||{};S.invOk=key;renderBag();renderShop();fxInvChanged();fxApply();});   // invOk：背包讀到了（NEW 的起點要等它）
  watch('houseVisit/'+key,v=>{S.visitors=v||{};renderPanel();renderTop();});
  const st=await sit(key);
  if(!S.on||S.hk!==key||S.visit){if(st.r==='ok'){try{st.ref.onDisconnect().cancel();}catch(_){}st.ref.remove().catch(()=>{});}return;}   // v505：坐下的途中按了回大廳，不要再把小屋開起來
  if(st.r==='ok')useSeat(st);
  startRoom(key);
  pruneChat(key);
  openFrame('我的小屋',()=>{
    fxP.then(v=>{if(S.on&&S.hk===key&&!S.visit){S.fx=v;fxInvChanged();fxApply();}});
    reveal();renderBag();publish(room('layout'));room('spawn',+S.seat||0);S.last=null;pubPos();pushPeers();   // 快照跟著目前的擺設（第一次進來、入住禮剛擺好也要有）
    if(window.TTCoach&&!TTCoach.seen(TOUR_KEY))setTimeout(()=>{if(S.on&&!S.visit)houseTour(true);},400);else if(!S.layout)say('歡迎回家！入住禮已經幫你擺好了');});
  setMode('walk',true);renderTop();renderChat();renderExpand();setTimeout(renderExpand,2000);
 }finally{S.joining=false;if(!S.frame||!S.on)reveal();}
}
// 關掉目前的房間（自己的或別人的）：起身、停掉同步，不換回大廳的名牌；回大廳用 exit()
async function teardown(){flushSave();xpEnd();const seatRef=S.seatRef;S.leaving=true;S.tok=(S.tok||0)+1;
 S.on=false;unsub();closePanel();fxClose();S.fxHost={};clearInterval(S.pubT);clearInterval(S.beatT);S.pubT=S.beatT=0;
 bagLeave();document.body.classList.remove('tt-house-on','tt-house-edit','tt-house-visit');
 S.dollW={};S.frame?.remove();S.frame=null;S.visit=null;S.hk=null;S.seat=null;S.seatRef=null;S.room={};S.whoSig=null;S.chatLog=[];S.chatSeen=new Set();renderChat();
 try{gClose('houseShopM');}catch(_){}
 if(seatRef){try{seatRef.onDisconnect().cancel();}catch(_){}try{await seatRef.remove();}catch(_){}}
 S.leaving=false;}
async function exit(){if(!S.on||S.exiting)return;S.exiting=true;   // v510 回大廳也有轉場
 try{const CT=window.TTHouseTrip?.curtain?TTHouseTrip.curtain('回大廳囉','TINY TAVERN'):null;if(CT)await CT.covered;await teardown();restoreSign();if(CT)CT.open();}finally{S.exiting=false;}}

// ---------- v504 座位：進小屋就坐一個（最多 4 個），斷線自動起身 ----------
// 回傳 {r:'ok'／'full'／'denied'／'kicked', s, ref}；坐好就設好斷線自動起身
async function sit(hk){const mk=KEY(),ref=DB().ref(R()+'/houseRoom/'+hk);let cur;
 try{cur=(await ref.once('value')).val()||{};}catch(_){return {r:'denied'};}
 const now=SNOW(),own=hk===mk;
 let order=SEATS.filter(s=>cur[s]&&cur[s].k===mk);   // 另一個分頁已經坐著：沿用那個座位
 if(!order.length)order=SEATS.filter(s=>!cur[s]).concat(SEATS.filter(s=>cur[s]&&!(cur[s].at>now-STALE)));   // v505：空位優先，沒有空位才接手斷線的座位
 if(!order.length&&own){const g=SEATS.filter(s=>cur[s]&&cur[s].k!==mk).sort((a,b)=>(cur[a].at||0)-(cur[b].at||0))[0];   // 主人回家客滿：請最久沒動的那位起身
   if(g){try{await ref.child(g).remove();order=[g];}catch(_){}}}
 if(!order.length)return {r:'full'};
 const p=(S.hk===hk&&room('me'))||{i:8.5+(Math.random()-.5),j:10.5,f:1};
 for(const s of order){try{await ref.child(s).set({k:mk,name:myName(),i:r2(p.i),j:r2(p.j),f:p.f<0?-1:1,at:TS()});
   ref.child(s).onDisconnect().remove();return {r:'ok',s,ref:ref.child(s)};}catch(_){}}
 if(!own){try{const k=(await DB().ref(R()+'/houseKick/'+hk+'/'+mk).once('value')).val();if(k&&k>SNOW()-600000)return {r:'kicked'};}catch(_){}}
 return {r:'denied'};}
// v508 伺服器時間（客人電腦時鐘快一兩分鐘，別人的小人就全部被當成斷線、看不到）
let OFF=0,offOn=false,offOK=false;const SNOW=()=>Date.now()+OFF;
function watchOffset(){if(offOn||!DB())return;offOn=true;try{DB().ref('.info/serverTimeOffset').on('value',s=>{OFF=Number(s.val())||0;offOK=true;});}catch(_){offOn=false;}}
function useSeat(st){S.seat=st.s;S.seatRef=st.ref;S.joinedAt=SNOW();}
// 同步：看座位（其他人畫進房間）、聽聊天、回報自己的位置
function startRoom(hk){watchOffset();
 watch('houseRoom/'+hk,v=>{if(S.hk!==hk)return;S.room=v||{};const mine=S.seat&&S.room[S.seat];
  if(S.seat&&!S.leaving&&(!mine||mine.k!==KEY())){   // 我的座位不見了：被主人請出去、網路閃斷被清掉、或分頁在背景心跳變慢被接走
   // v505：先試著坐回去，坐不下才離開，並照原因說明（原本一律說「主人請你離開」）
   try{S.seatRef&&S.seatRef.onDisconnect().cancel();}catch(_){}S.seat=null;S.seatRef=null;
   sit(hk).then(st=>{if(!S.on||S.hk!==hk||S.seat){if(st.r==='ok'&&(!S.on||S.hk!==hk||st.s!==S.seat)){try{st.ref.onDisconnect().cancel();}catch(_){}st.ref.remove().catch(()=>{});}return;}
    if(st.r==='ok'){useSeat(st);S.last=null;pubPos();return;}
    if(S.visit){const nm=S.visit.name;exit().then(()=>say(st.r==='kicked'?nm+' 請你先離開小屋了':st.r==='full'?nm+' 的小屋客滿了，先回大廳囉':st.r==='denied'?nm+' 的小屋現在沒有開放了':'連線不穩，先回大廳囉'));}
    else say('連線不穩，等一下再試');});}
  pushPeers();
  /* v505：座位資料每 0.2 秒就會因為有人走動而更新；面板和聊天只在「有人進出」時重畫
     （原本每次都重畫：面板的按鈕按下去的瞬間被換掉、點不到；往上捲的聊天紀錄一直被拉回最底） */
  const who=SEATS.map(s=>{const v=S.room[s];return v&&v.at>SNOW()-STALE*2?v.k+':'+(v.name||''):'';}).join('|');
  if(who!==S.whoSig){S.whoSig=who;renderPanel();renderChat();}});
 watch('houseChat/'+hk,v=>{if(S.hk!==hk)return;onChat(v||{});},ref=>ref.limitToLast(30));
 // v505：網路重連後重新設好「斷線自動起身」（舊連線的設定會跟著舊連線消失，關分頁後座位會卡著）
 const cref=DB().ref('.info/connected'),onConn=s=>{if(s.val()&&S.seatRef&&S.hk===hk){try{S.seatRef.onDisconnect().remove();}catch(_){}S.seatRef.update({at:TS()}).catch(()=>{});}};
 cref.on('value',onConn);S.subs.push(()=>cref.off('value',onConn));
 clearInterval(S.pubT);clearInterval(S.beatT);S.last=null;S.noDest=false;
 S.pubT=setInterval(pubPos,100);   // v521：0.2 → 0.1 秒（小屋最多 4 人，流量很小），朋友看到的你更即時
 S.beatT=setInterval(()=>{renderExpand();if(!S.seatRef)return;S.seatRef.update({at:TS()}).catch(()=>{});
   if(!S.visit&&S.vis==='public'&&S.listed)DB().ref(R()+'/houseDir/'+S.key).update({on:TS()}).catch(()=>{});},15000);   // v505：有在隨機名單上才報「在家」（不在名單上寫不進去）
 if(!S.visit&&S.vis==='public'&&S.listed)DB().ref(R()+'/houseDir/'+S.key).update({on:TS()}).catch(()=>{});}
// 自己的位置：走動時最多每 0.1 秒回報一次，停下來再補最後一次
// v522：走路中多帶 r＝剩下要轉的彎（"9,4;12,4"），朋友照著推算現在走到哪；換目的地下一次（0.1 秒內）就送。停下時刪掉 r（舊規則也允許刪）。
//   規則還沒發布時帶 r 會整筆被拒 → 這次進房間改送不帶 r 的（S.noDest），朋友那邊照舊用時間線。
function routeOf(p){const P=Array.isArray(p.path)?p.path:[];if(!p.moving||!P.length)return '';
 const out=[],sg=v=>Math.abs(v)<.01?0:v>0?1:-1;let x=p.i,y=p.j;
 for(let k=0;k<P.length&&out.length<12;k++){const a=P[k][0]+.5,b=P[k][1]+.5,n=P[k+1];   // 只留轉彎的格子（直走的中間格朋友自己會走過）
  if(!n||sg(a-x)!==sg(n[0]+.5-a)||sg(b-y)!==sg(n[1]+.5-b))out.push(P[k][0]+','+P[k][1]);x=a;y=b;}
 let s=out.join(';');while(s.length>80)s=s.replace(/;[^;]*$/,'');return /^[0-9,;]{3,80}$/.test(s)?s:'';}
function pubPos(){if(!S.seatRef)return;const p=room('me');if(!p)return;const L=S.last,r=S.noDest?'':routeOf(p);
 if(L&&Math.abs(L.i-p.i)<.05&&Math.abs(L.j-p.j)<.05&&L.f===p.f&&L.r===r&&(p.moving||(L.i===p.i&&L.j===p.j)))return;   // v521：停下時最後那一小段也要送（原本差不到 0.05 格就不送，朋友那邊停的位置會差一點）
 S.last={i:p.i,j:p.j,f:p.f,r};const ref=S.seatRef,u={i:r2(Math.max(-2,Math.min(30,p.i))),j:r2(Math.max(-2,Math.min(30,p.j))),f:p.f<0?-1:1,at:TS(),r:r||null};
 ref.update(u).catch(e=>{if(u.r&&!S.noDest&&S.seatRef===ref&&/permission/i.test(String(e&&(e.code||e.message)))){S.noDest=true;S.last=null;}});}
// v522 朋友的路線：字串 → 格子中心；格式不對就當沒帶
function routeIn(s){if(typeof s!=='string'||!s)return null;const out=[];
 for(const t of s.split(';').slice(0,12)){const [a,b]=t.split(',').map(Number);if(!(a>=0&&a<=30&&b>=0&&b<=30))return null;out.push([a+.5,b+.5]);}
 return out.length?out:null;}
// 其他人：座位上的人（不含自己、不含斷線的），小人圖從大廳資料讀一次存起來
function pushPeers(){if(!S.frame)return;const mk=KEY(),now=SNOW(),list=[];
 for(const s of SEATS){const v=S.room[s];if(!v||v.k===mk||!(v.at>now-STALE*2))continue;
  const d=S.dolls[v.k];loadDoll(v.k);
  list.push({id:v.k,name:v.name||'旅人',i:+v.i||0,j:+v.j||0,f:v.f<0?-1:1,doll:d||null,r:routeIn(v.r),age0:offOK&&Number.isFinite(v.at)?Math.max(0,Math.min(250,now-v.at)):60});}   // v522 age0：這筆位置在路上走了多久（伺服器時間）
 room('setPeers',list);}
// 11/24 D「小屋裡（自己家、朋友家）可以隨時換裝」：同一間的人換了衣服，大家畫面上的小人跟著換 → 一直聽著每位的 lobby/<key>/doll（離開房間 unsub 一起關）
function loadDoll(k){if(S.dollW[k])return;S.dollW[k]=1;watch('lobby/'+k+'/doll',d=>{d=d||{};S.dolls[k]=dollCanvasOf(d);redrawDoll(k,d);pushPeers();});}
function watchMyDoll(){const mk=KEY();if(!mk)return;let first=true;
 watch('lobby/'+mk+'/doll',d=>{if(first){first=false;return;}if(!d||!S.frame)return;const set=()=>{if(S.frame)room('setMyDoll',dollCanvasOf(d));};set();setTimeout(set,1200);setTimeout(set,3500);});}   // 部件圖第一次用到才載，晚一點再畫兩次
function openDress(){if(!S.on)return;if(S.mode==='edit')setMode('walk');closePanel();if(S.fxOpen)fxClose();try{gClose('houseShopM');}catch(_){}if(window.openWardrobe)window.openWardrobe();}

// ---------- v504 小屋聊天 ----------
function onChat(v){const fresh=[];
 for(const [id,m] of Object.entries(v).sort((a,b)=>(a[1]?.at||0)-(b[1]?.at||0))){if(!m||S.chatSeen.has(id))continue;S.chatSeen.add(id);
  S.chatLog.push({id,f:m.f,n:m.n||'旅人',x:String(m.x||''),at:m.at});if(m.at>S.joinedAt-3000)fresh.push(m);}
 S.chatLog=S.chatLog.slice(-30);
 for(const m of fresh){const it=stkOf(m.x);room('say',m.f===KEY()?'me':m.f,it?{img:stkUrl(it),name:it.name}:m.x);}
 renderChat();}
async function sendChat(preset){const inp=$('ttHouseSay');if(!inp)return;const x=(preset||inp.value.trim()).slice(0,CHAT_MAX);if(!x)return;
 if(window.ttIsMuted?window.ttIsMuted():!!window.__mute){say('你目前被禁言中，暫時不能說話');return;}
 if(!S.seat||!S.hk){say('還沒進到小屋裡，等一下再說');return;}
 if(Date.now()-(S.lastSay||0)<1200){say('說慢一點點唷');return;}
 S.lastSay=Date.now();if(!preset)inp.value='';
 try{await DB().ref(R()+'/houseChat/'+S.hk).push({f:KEY(),n:myName(),x,s:S.seat,at:TS()});}
 catch(_){if(!preset)inp.value=x;say(preset?'貼圖沒有送出，請再試一次':'訊息沒有送出，請再試一次');}}
// v507 小屋聊天貼圖（D：小屋聊天也要能發貼圖）：跟大廳同一套貼圖代碼「[貼圖:sticker-NN]」（TTChatStickers），走同一條聊天，不用改資料庫規則
const stkOf=x=>{try{return window.TTChatStickers?.decode(x)||null;}catch(_){return null;}};
const stkUrl=it=>new URL('tavern-ui/'+it.asset,location.href).href;   // 房間在 house/ 底下的 iframe，給完整網址
function sendSticker(id){const code=window.TTChatStickers?.encode(id);if(code)sendChat(code);}
// 主人每次回家順手清掉一天以前的聊天
function pruneChat(hk){DB().ref(R()+'/houseChat/'+hk).limitToFirst(60).once('value').then(s=>{const v=s.val()||{},old=SNOW()-86400000,ch={};
  for(const [id,m] of Object.entries(v))if(!m||!(m.at>old))ch[id]=null;if(Object.keys(ch).length)DB().ref(R()+'/houseChat/'+hk).update(ch).catch(()=>{});}).catch(()=>{});}
function renderChat(){const box=$('ttHouseChat');if(!box)return;const log=box.querySelector('.tt-hc-log');
 const people=SEATS.map(s=>S.room[s]).filter(v=>v&&v.at>SNOW()-STALE*2).length;
 box.querySelector('.tt-hc-who').textContent=S.on?'小屋裡 '+Math.max(1,people)+' / 4 人':'';
 log.innerHTML=S.chatLog.length?S.chatLog.slice(-8).map(m=>'<p'+(m.f===KEY()?' class="mine"':'')+'><b>'+esc(m.n)+'</b>'+((it=>it?'<img class="tt-hc-stkimg" src="'+esc(stkUrl(it))+'" alt="'+esc(it.name)+'貼圖">':esc(m.x))(stkOf(m.x)))+'</p>').join('')
  :'<p class="tt-hc-empty">'+(S.visit?'跟大家打聲招呼吧':'邀請好友進來一起聊天吧（右上「拜訪」）')+'</p>';
 log.scrollTop=log.scrollHeight;}

// ---------- 新手教學（v495）：第一次進小屋，整片變灰、虛線圈起要點的地方；右上「教學」可以再看一次 ----------
const TOUR_KEY='tt_house_tour_v1';
function houseTour(auto){if(!window.TTCoach||!S.on||S.visit)return;if(S.mode!=='walk')setMode('walk',auto===true);try{gClose('houseShopM');}catch(_){}
 const room=()=>{try{return S.frame.contentWindow.TTRoom.roomRect();}catch(_){return null;}},cat=()=>$('ttCatCount')?.closest('[data-cat-pop],.tt-funds-row,div')||$('ttCatCount');
 const daily=TTCat.dailyOn()?'每天在大廳說說話、待滿 10 分鐘，完成每日任務就送 '+TTCat.DAILY+' 貓貓幣。':'11/7 起，每天在大廳說說話、待滿 10 分鐘，完成每日任務就送 '+TTCat.DAILY+' 貓貓幣。';
 TTCoach.run([
  {target:room,pad:4,title:'歡迎來到你的小屋！',text:'這間房間是你專屬的，入住禮的四件家具已經幫你擺好了。\n點地板，小人就會走過去；按住拖曳可以移動視角，滾輪可以放大縮小。'},
  {target:()=>$('ttHouseGacha'),title:'扭蛋',text:'用貓貓幣抽家具：單抽 120、十連 1,200。抽到的家具會先收進「我的家具」。'+(tixOn()?'\n抽到重複的家具會變成家具券，可以在扭蛋圖鑑換「再一件」或異色家具。':'')},
  {target:cat,title:'貓貓幣',text:daily+'\n名牌上這個硬幣就是你現在有的貓貓幣。'},
  {target:()=>$('ttHouseEdit'),title:'佈置',text:'按這裡，下面會打開「我的家具」：可以用分類或搜尋找想要的家具，點一件拿出來，移到想放的地方再點一下就擺好。\n點房間裡的家具，可以拿起來重新擺。'},
  ...($('ttHouseExpand')&&!$('ttHouseExpand').classList.contains('off')?[{target:()=>$('ttHouseExpand'),title:'擴建',text:'房間不夠擺？花貓貓幣可以把房間擴大（14→18→22 格），原本的家具都留在原位。'}]:[]),
  {target:()=>$('ttHouseVisit'),title:'拜訪',text:'邀請在線上的好友進你的小屋一起聊天（最多 4 人），或隨機去別人的小屋坐坐。\n也可以在這裡決定誰能進來。'},
  {target:()=>$('ttHouseChat'),title:'小屋聊天',text:'在這裡打字，說的話會出現在小人頭上，小屋裡的人都看得到。'},
  {target:()=>$('ttHouseBack'),title:'回大廳',text:'想回酒館大廳就按這裡，擺好的家具都會自動存起來。'}
 ],{doneKey:TOUR_KEY,last:'開始佈置吧'});}

// ---------- 擺設存檔：房間每次放好／收回就交過來，0.6 秒合併一次寫入 ----------
let pending=null;
function save(layout){if(S.visit)return;pending=layout;clearTimeout(S.saveT);S.saveT=setTimeout(flushSave,600);}
function flushSave(){clearTimeout(S.saveT);if(!pending||!S.key||S.visit)return;const lay=JSON.parse(JSON.stringify(pending));pending=null;
 DB().ref(R()+'/house/'+S.key).update({layout:lay,at:TS(),...(S.paintTouched?{paint:hasPaint(S.paint)?S.paint:null}:{})}).catch(()=>say('擺設沒存到，請檢查網路後再動一下家具'));   // update：不蓋掉開放設定 vis
 publish(lay);}
// v504 給客人看的擺設快照＋隨機拜訪名單（同一次寫入；不公開就兩個都刪）
function publish(layout){const key=S.key;if(!key||!DB()||S.visit||!Array.isArray(layout))return Promise.resolve();
 const lay=JSON.parse(JSON.stringify(layout)),n=Math.min(999,lay.length),ch={};
 if(S.vis==='private'){ch['houseView/'+key]=null;ch['houseDir/'+key]=null;}
 else{ch['houseView/'+key]={layout:lay,vis:S.vis,at:TS(),name:myName(),n,...(sizeOk(S.size)>14?{size:sizeOk(S.size)}:{}),...(hasPaint(S.paint)?{paint:S.paint}:{})};   /* v507：14 格不寫 size（規則還沒發布時照樣寫得進去） */ch['houseDir/'+key]=S.vis==='public'&&n>=DIR_MIN?{at:TS(),n,on:TS()}:null;}
 return DB().ref(R()).update(ch).then(()=>{S.listed=!!ch['houseDir/'+key];}).catch(()=>{});}

// ---------- 佈置模式 ----------
function setMode(m,silent){if(S.visit)m='walk';if(m!=='edit'&&S.ptool){S.ptool=null;room('paintTool',null);}S.mode=m;document.body.classList.toggle('tt-house-edit',m==='edit');if(m==='edit'){bagEnter();closePanel();fxClose();}else bagLeave(silent);renderKeys();   // silent＝程式自己切回散步（進門、開場教學），不算客人看過 NEW
 try{const T=S.frame?.contentWindow?.TTRoom;if(T&&T.mode()!==m)T.setMode(m);}catch(_){}
 renderBag();requestAnimationFrame(frameFit);}
// v572 佈置時家具在畫面下排：18、22 格的大房間放不進上面那一塊時，讓房間往上躲到名牌後面（insets 的 t 少讓一點），不要被家具列擋住
function frameFit(){S.editUp=0;room('frame');if(S.mode!=='edit'||window.TTGame)return;
 const bag=$('ttHouseBag')?.getBoundingClientRect(),rr=room('roomRect');if(!bag||!bag.height||!rr||!(rr.height>0))return;
 const over=Math.round(rr.top+rr.height-(bag.top-30));if(over>2){S.editUp=over*2;room('frame');}}
// 分類列排不下時可以左右捲：哪一邊還有沒露出來的就把那一邊淡出；目前選的分類捲進看得到的範圍
function bagEdge(show){const tb=document.querySelector('#ttHouseBag .tt-hb-tabs');if(!tb||!tb.clientWidth)return;
 if(show){const on=tb.querySelector('[aria-pressed="true"]');if(on){const a=on.offsetLeft-tb.offsetLeft,z=a+on.offsetWidth;if(a<tb.scrollLeft+24)tb.scrollLeft=Math.max(0,a-24);else if(z>tb.scrollLeft+tb.clientWidth-24)tb.scrollLeft=z-tb.clientWidth+24;}}
 const max=tb.scrollWidth-tb.clientWidth;tb.classList.toggle('more-l',tb.scrollLeft>4);tb.classList.toggle('more-r',max-tb.scrollLeft>4);}
function renderBag(){const box=$('ttHouseBag');if(!box||!S.cat)return;
 const q=bagNorm(S.bagQ),paint=!q&&(S.bagKind==='pw'||S.bagKind==='pf');
 const pl=placed(),lf=k=>owned(k)-(pl[k]||0);   // 房間裡擺了幾件只問一次（原本每件家具問一次）
 const mine=S.cat.filter(c=>owned(c.k)>0),has={},hasNew={},nws=new Set();
 for(const c of mine){const nw=lf(c.k)>0&&isNew(c.k);if(nw)nws.add(c.k);for(const t of bagCats(c)){has[t]=1;if(nw)hasNew[t]=1;}}
 const tab=(k,n,cls)=>'<button type="button" data-bk="'+k+'" aria-pressed="'+(!q&&S.bagKind===k)+'"'+(cls?' class="'+cls+'"':'')+'>'+n+'</button>';
 const tabs=tab('all','全部',nws.size?'dot':'')+BAG_CATS.map(([k,n])=>tab(k,n,has[k]?(hasNew[k]?'dot':''):'zero')).join('')+'<i class="tt-hb-sep" aria-hidden="true"></i>'+tab('pw','貼壁紙','tool')+tab('pf','鋪地板','tool');
 const tb=box.querySelector('.tt-hb-tabs'),tbNew=tb._h!==tabs;if(tbNew){const x=tb.scrollLeft;tb.innerHTML=tabs;tb._h=tabs;tb.scrollLeft=x;}bagEdge(tbNew);   // 內容沒變就不重畫（重畫會把捲到一半的位置、按到一半的按鈕換掉）
 const clr=box.querySelector('.tt-hb-clear');if(clr)clr.hidden=!S.bagQ;
 renderExpand();renderTix();
 const grid=box.querySelector('.tt-hb-grid');
 box.classList.toggle('paint',paint);
 if(paint){grid._h=null;renderPaintBag(box,grid);return;}
 const tip=box.querySelector('.tt-hb-tip');if(tip)tip.textContent='點家具拿出來，移到房間裡再點一下放好；點房間裡的家具可以移動。';
 const list=q?mine.map(c=>({c,m:bagMatch(c,q)})).filter(x=>x.m):mine.filter(c=>S.bagKind==='all'||bagCats(c).includes(S.bagKind)).map(c=>({c,m:1}));
 const ix=new Map(S.cat.map((c,i)=>[c.k,i])),rk=c=>(ix.get(c.base)??ix.get(c.k))*4+(isVar(c)?(+c.var||+String(c.k).split('~')[1]||3):0);   // 異色排在原色後面（玄墨、翡翠、桃花）
 const rows=list.map(({c,m})=>({c,n:lf(c.k),nw:nws.has(c.k),m,o:rk(c)})).sort((a,b)=>b.nw-a.nw||a.m-b.m||a.o-b.o);   // v509 NEW 的排最前面；搜尋時名字對到的排在分類／系列對到的前面
 // 異色家具（<本名>・玄墨／翡翠／桃花）：格子窄，整個名字會被切成「…」看不出是哪一色 → 名字只留本名，顏色做成圖左下角的小標；數量只在還有兩件以上時標
 const html=rows.length?rows.map(({c,n,nw})=>{const vn=isVar(c)&&c.name.includes('・')?c.name.split('・'):null;
   return '<button type="button" class="tt-hb-item'+(n>0?'':' none')+(nw?' new':'')+'" data-k="'+c.k+'" title="'+esc(c.name)+(n>0?'（剩 '+n+' 件）':'（都擺出來了）')+'">'
   +(nw?'<i class="tt-hb-new">NEW</i>':'')+'<em class="tt-hb-n">'+(n>1?'×'+n:n>0?'':'已擺')+'</em><span class="tt-hb-pic"><img alt="" data-thumb="'+c.k+'">'
   +(vn?'<i class="tt-hb-var v'+(+c.var||0)+'">'+esc(vn.slice(1).join('・'))+'</i>':'')+'</span><b>'+esc(vn?vn[0]:c.name)+'</b><small>'+(n>0?'剩 '+n+' 件':'都擺出來了')+'</small></button>';}).join('')
  :'<p class="tt-hb-empty">'+(q?'找不到「'+esc(S.bagQ.trim())+'」，換個關鍵字試試':S.bagKind==='all'?'背包裡還沒有家具，去扭蛋抽幾件回家吧':'這一類還沒有家具，去扭蛋抽抽看')+'</p>';
 if(grid._h!==html){const x=grid.scrollLeft,y=grid.scrollTop;grid.innerHTML=html;grid._h=html;grid.scrollLeft=x;grid.scrollTop=y;}
 if(S.bagOpen&&S.mode==='edit'){const t=performance.now();for(const r of rows)if(r.nw&&!S.newShown.has(r.c.k))S.newShown.set(r.c.k,t);}   // 這次列出來過的 NEW（收起佈置時當成看過）
 fillThumbs(grid,bagPic());}   // 家具店、佈置清單同一個比例（1 倍）
// 家具券餘額（「我的家具」上面一條）：餘額由 lobby-ui/gacha.js 盯著（TTGachaHost.tix、tt-house-tix 事件）；新制度開始前、沒有券時不顯示。點了打開扭蛋（圖鑑裡換家具）
const tixOn=()=>{try{return !!window.TTGachaHost?.tixOpen?.();}catch(_){return false;}};
function renderTix(){const el=document.querySelector('#ttHouseBag .tt-hb-tix');if(!el)return;const H=window.TTGachaHost;let n=0,open=false;
 try{n=H&&H.tix?+H.tix()||0:0;open=!!(H&&H.tixOpen&&H.tixOpen());}catch(_){}
 const show=!!H&&!S.visit&&(n>0||open);el.hidden=!show;if(!show)return;
 const b=el.querySelector('b');if(b)b.textContent=n.toLocaleString();el.setAttribute('aria-label','家具券 '+n+' 張，打開扭蛋用家具券換家具');}
window.addEventListener('tt-house-tix',()=>{if(S.on)renderTix();});
// v510 背包的「貼壁紙／鋪地板」：點一個系列拿在手上（房間裡點一格貼一格、按住拖曳連續貼），「原本的」＝還原；整間貼上／整間還原
function renderPaintBag(box,grid){const kind=S.bagKind==='pw'?'w':'f',pre=kind==='w'?'wall_':'floor_',word=kind==='w'?'壁紙':'地板';
 const tip=box.querySelector('.tt-hb-tip');if(tip)tip.textContent='選一個'+word+'，在房間裡點'+(kind==='w'?'牆':'地板')+'一格貼一格，按住拖曳可以連續貼。';
 const mine=PAINTS.filter(p=>owned(pre+p.t)>0),cur=S.ptool&&S.ptool.kind===kind?S.ptool.theme:null;
 const card=(t,name,img)=>'<button type="button" class="tt-hb-item tt-hb-paint'+(cur===t?' on':'')+'" data-pt="'+t+'" aria-pressed="'+(cur===t)+'">'
   +'<span class="tt-hb-pic">'+(img?'<img alt="" src="'+img+'">':'<i class="tt-hb-orig"></i>')+'</span><b>'+esc(name)+'</b><small>'+(cur===t?'拿在手上':'點一下拿起來')+'</small></button>';
 grid.innerHTML=(mine.length?card('','原本的','')+mine.map(p=>card(p.t,p.name,'house/paint/'+p.t+(kind==='w'?'_wall':'_floor')+'.png')).join('')
   +'<div class="tt-hb-pacts"><button type="button" data-pfill="1"'+(cur?'':' disabled')+'>整間貼上</button><button type="button" data-pclear="1">整間還原</button></div>'
  :'<p class="tt-hb-empty">還沒有'+word+'，到右下的「商城」看看各系列的'+word+'</p><div class="tt-hb-pacts"><button type="button" data-pmall="1">去商城</button><button type="button" data-pclear="1">整間還原</button></div>');}
function paintSelect(kind,theme){S.ptool=kind?{kind,theme:theme||''}:null;room('paintTool',S.ptool);renderBag();renderKeys();}
function paintStart(kind,theme){try{gClose('houseShopM');}catch(_){}S.bagKind=kind==='w'?'pw':'pf';bagFind('');setMode('edit');setTimeout(()=>paintSelect(kind,theme),60);}
// 從背包拿一件出來（點背包的格子、買完「現在擺」、扭蛋完 placeNew 都走這裡）；拿出來就不算 NEW 了
function bagPick(k){if(left(k)<=0){say('這件都擺出來了，點房間裡的它就能移動');return false;}
 let ok=false;try{ok=S.frame.contentWindow.TTRoom.grabNew(k)!==false;}catch(_){}
 if(ok&&isNew(k)){newClear(k);renderBag();}return ok;}
// v509 扭蛋結果畫面關掉後叫這個（keys：這次抽到的家具，最稀有的在前）：標成 NEW、打開佈置和「我的家具」，把第一件拿在手上準備擺。
// 不在自己的小屋（例如在別人家）就什麼都不做、回 false；背包資料還沒到就等最多 3 秒，等不到就只打開背包
function placeNew(keys){const list=(Array.isArray(keys)?keys:[keys]).filter(k=>typeof k==='string'&&k);
 if(!S.on||S.joining||S.visit||!S.key||S.key!==KEY())return false;   // v572：進門還沒跑完（S.joining）先回 false，扭蛋那邊每 0.5 秒會再試——不然進門結尾切回散步，佈置又被收起來
 newAdd(list);try{gClose('houseShopM');}catch(_){}
 S.bagKind='all';bagFind('');setMode('edit');const g=document.querySelector('#ttHouseBag .tt-hb-grid');if(g){g.scrollTop=0;g.scrollLeft=0;}   // 跟按「佈置」一樣；NEW 排在最上面
 const k=list[0],tok=S.pnTok=(S.pnTok||0)+1,t0=Date.now();if(!k)return true;
 const step=first=>{if(S.pnTok!==tok||!S.on||S.visit||S.mode!=='edit'||(!first&&room('holding')))return;   // 等的途中離開、收起佈置、自己拿了別的就不搶
  if(S.frame&&S.frame._ok&&left(k)>0){bagPick(k);return;}
  if(Date.now()-t0<3000)setTimeout(step,150);};
 step(true);return true;}
async function fillThumbs(root,size){const R=S.frame?.contentWindow?.TTRoom;if(!R)return;
 for(const im of root.querySelectorAll('img[data-thumb]')){const k=im.dataset.thumb,ck=k+'@'+size;if(im._tk===ck)continue;   // 已經放好的不重放
  if(S.thumbs[ck]){im.src=S.thumbs[ck];im._tk=ck;continue;}
  try{const u=await R.thumbAsync(k,size);if(u){S.thumbs[ck]=u;im.src=u;im._tk=ck;}}catch(_){}}}

// ---------- 家具店（大廳的 houseShopM 視窗）----------
function shopHead(mall){const m=$('houseShopM');if(!m)return;const set=(q,t)=>{const e=m.querySelector(q);if(e)e.textContent=t;};
 set('.panel-head .eyebrow',mall?'HOME DECOR':'TAVERN FURNITURE');set('.panel-head .outline-word',mall?'DECOR':'HOME');set('.panel-head h1',mall?'小屋商城':'家具店');
 set('.panel-head > p',mall?'各系列的壁紙和地板，買了想貼哪格就貼哪格。':'挑幾件喜歡的家具，帶回小屋。');}
function openShop(){if(!S.on||S.visit)return;closePanel();S.shopMode='furn';shopHead(false);renderShop();try{gOpen('houseShopM');}catch(_){}}
function openMall(){if(!S.on||S.visit)return;closePanel();S.shopMode='mall';shopHead(true);renderShop();try{gOpen('houseShopM');}catch(_){}}
function renderMall(host){
 host.innerHTML='<div class="tt-hs-bar"><p class="tt-hs-note">壁紙、地板買一次就能貼在任何一格（不限次數）；在「佈置」→「貼壁紙／鋪地板」裡貼。</p>'
  +'<div class="tt-hs-wallet">'+TTCat.coin(22,'c')+'<b data-cat-pop>'+TTCat.fmt(window.__cat||0)+'</b>'+(TTCat.EXCHANGE_ON?'<button type="button" class="tt-hs-ex">用金幣兌換</button>':'<small>每日任務每天送 '+TTCat.DAILY+'</small>')+'</div></div>'
  +PAINTS.map((p,si)=>'<section class="tt-pm-set"><h3><span>'+String(si+1).padStart(2,'0')+'</span>'+esc(p.name)+'</h3><div class="tt-pm-row">'
   +[['wall_','壁紙','_wall'],['floor_','地板','_floor']].map(([pre,word,img])=>{const k=pre+p.t,pr=priceOf(k),own=owned(k)>0;
    return '<article class="tt-hs-card tt-pm-card"><div class="tt-pm-pic"><img alt="" src="house/paint/'+p.t+img+'.png"></div><h4>'+esc(p.name)+'・'+word+'</h4>'
     +(own?'<button type="button" class="tt-hs-buy own" data-puse="'+k+'"><span class="lbl">已擁有・去貼</span></button>'
      :pr?'<button type="button" class="tt-hs-buy" data-pbuy="'+k+'">'+TTCat.tag(TTCat.price(pr),16)+'<span class="lbl">購買</span></button>'
      :'<p class="tt-hs-gift">準備中</p>')+'</article>';}).join('')+'</div></section>').join('');}
function renderShop(){const host=document.querySelector('#houseShopM .tt-house-shop');if(!host||!S.cat)return;
 if(S.shopMode==='mall'){renderMall(host);return;}
 const sets=['酒館日常','萬用系列'],kinds=[['all','全部'],['floor','地板'],['wall','牆面']];
 const list=S.cat.filter(c=>c.set===S.shopSet&&!isVar(c)&&(S.shopKind==='all'||c.kind===S.shopKind));   // 異色（家具券換）不在家具店賣
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
 const pb=e.target.closest('#ttHouseBag [data-pt],#ttHouseBag [data-pfill],#ttHouseBag [data-pclear],#ttHouseBag [data-pmall],#houseShopM [data-pbuy],#houseShopM [data-puse]');if(pb){
  const kind=S.bagKind==='pw'?'w':'f';
  if(pb.dataset.pbuy)askBuy(pb.dataset.pbuy);
  else if(pb.dataset.puse){const c=PAINT_BY[pb.dataset.puse];if(c)paintStart(c.paint.kind,c.paint.theme);}
  else if(pb.dataset.pmall)openMall();
  else if(pb.dataset.pfill){if(S.ptool&&S.ptool.kind===kind)room('paintFill',kind,S.ptool.theme);}
  else if(pb.dataset.pclear)ttConfirm('整間還原'+(kind==='w'?'壁紙':'地板')+'？','房間裡貼的'+(kind==='w'?'壁紙':'地板')+'會全部換回原本的樣子（買過的不會不見，之後還能再貼）。',()=>room('paintFill',kind,''),'還原');
  else{const t=pb.dataset.pt;paintSelect(S.ptool&&S.ptool.kind===kind&&S.ptool.theme===t?null:kind,t);}
  return;}
 const b=e.target.closest('#ttHouseBag [data-bk],#ttHouseBag [data-k]');if(b){
  if(b.dataset.bk){const same=S.bagKind===b.dataset.bk&&!S.bagQ;S.bagKind=b.dataset.bk;bagFind('');const pk=S.bagKind==='pw'?'w':S.bagKind==='pf'?'f':null;if(S.ptool&&S.ptool.kind!==pk)paintSelect(null);renderBag();
   if(!same){const g=document.querySelector('#ttHouseBag .tt-hb-grid');if(g){g.scrollLeft=0;g.scrollTop=0;}}return;}   // 換分類：搜尋清掉、清單捲回最前面
  bagPick(b.dataset.k);
  return;}
 const v=e.target.closest('#ttVisitPanel [data-vis],#ttVisitPanel [data-go],#ttVisitPanel [data-invite],#ttVisitPanel [data-kick],#ttVisitPanel .tt-vp-random,#ttVisitPanel .tt-vp-close');if(v){
  if(v.dataset.vis)setVis(v.dataset.vis);
  else if(v.dataset.go)visit(v.dataset.go,'friend');
  else if(v.dataset.invite)invite(v.dataset.invite,v);
  else if(v.dataset.kick)kick(v.dataset.kick);
  else if(v.classList.contains('tt-vp-random'))randomVisit();
  else closePanel();}});
window.addEventListener('tt-cat',()=>{const b=document.querySelector('#houseShopM .tt-hs-wallet b');if(b)b.textContent=TTCat.fmt(window.__cat||0);});

function askBuy(k){const c=itemOf(k),p=priceOf(k);if(!c||!p||isVar(c))return;const cat=TTCat.price(p);
 ttConfirm('購買「'+c.name+'」？','使用 '+TTCat.fmt(cat)+' 貓貓幣。'+(c.paint?'買一次就能貼在任何一格，不限次數。':'買了會放進背包，按「佈置」就能擺進房間。'),()=>buy(k),'確定購買');}
async function buy(k){const c=itemOf(k),p=priceOf(k),key=S.key;if(S.buying||!c||!p||!key||key!==KEY())return;
 const CAT=TTCat.price(p);S.buying=true;
 try{const bal=await DB().ref(R()+'/cat/'+key+'/balance').once('value');
  if(!Number.isSafeInteger(bal.val())||bal.val()<CAT){say('貓貓幣不夠，還差 '+TTCat.fmt(CAT-(Number(bal.val())||0))+(TTCat.EXCHANGE_ON?'，可以先到錢包用金幣兌換':'（每日任務每天送 '+TTCat.DAILY+'）'));return;}
  const ref=DB().ref(R()+'/clientOrders').push(),ts=Date.now(),name=(typeof me==='function'&&me()?.b?.name)||'酒館客人';
  const o={type:'shop',plan:'house:'+k,planName:(c.label||'小屋家具')+'・'+c.name,amount:p,origAmount:p,couponUsed:false,couponDisc:0,itemId:'house:'+k,itemName:c.name,name,paidBy:'cat',catAmount:CAT,status:'done',createdAt:ts,myKey:key};
  await catSafety().execute({key,amount:CAT,ids:[ref.key],lookup:walletLookup,commit:async()=>{const ch={};
   ch['clientOrders/'+ref.key]=o;ch['cat/'+key+'/balance']=firebase.database.ServerValue.increment(-CAT);
   ch['catTx/'+key+'/'+ref.key]={type:'spend',amount:-CAT,ref:ref.key,note:o.planName,ts};ch['cat/'+key+'/lastTx']=ref.key;
   ch['houseInv/'+key+'/'+k+'/'+ref.key]={ts};await DB().ref(R()).update(ch);}});
  try{rememberPaymentIds([ref.key]);}catch(_){}
  if(S.on&&S.key===key&&!S.visit){S.inv[k]={...(S.inv[k]||{}),[ref.key]:{ts}};renderShop();renderBag();
   if(c.paint)ttConfirm('「'+c.name+'」帶回家了！','要現在貼上嗎？在房間裡點一格貼一格，按住拖曳可以連續貼。',()=>paintStart(c.paint.kind,c.paint.theme),'現在貼');
   else ttConfirm('「'+c.name+'」帶回家了！','要現在擺進房間嗎？',()=>{try{gClose('houseShopM');}catch(_){}setMode('edit');setTimeout(()=>bagPick(k),60);},'現在擺');}
 }catch(e){if(e&&e.ids)try{rememberPaymentIds(e.ids);}catch(_){}say(e&&e.message||'購買沒有完成，請到訂單看看');}
 finally{S.buying=false;}}

// ---------- v507 小屋擴建 ----------
// 跟買家具同一條路：clientOrders（itemId house:size18／22、paidBy cat）＋扣貓貓幣＋catTx＋cat lastTx，
// 同一次寫入把 house/<key>/size 改成新大小、sizeRef 指向這張訂單（規則第十七批照這張訂單收錢才給擴建）；擺設一起存，新小屋也不會變空房。
function renderExpand(){const b=$('ttHouseExpand');if(!b)return;const nx=nextSize(),p=nx?priceOf('size'+nx):0;
 b.classList.toggle('off',!p||!!S.visit||!S.on);b.title=p?'擴建到 '+nx+'×'+nx+'（'+TTCat.fmt(TTCat.price(p))+' 貓貓幣）':'';b.setAttribute('aria-label',b.title||'擴建');}
function askExpand(){const nx=nextSize(),p=nx?priceOf('size'+nx):0;if(!nx||!p||S.visit||!S.on)return;const CAT=TTCat.price(p),cur=sizeOk(S.size),title='擴建小屋：'+cur+'×'+cur+' → '+nx+'×'+nx;
 ttConfirm(title,'粉紅色虛線圍起來的是新增的地板，原本的家具都留在原位。\n需要 '+TTCat.fmt(CAT)+' 貓貓幣（你現在有 '+TTCat.fmt(window.__cat||0)+'）。',()=>{xpEnd();expand();},'擴建');
 xpStart(nx,title);}
// v509 擴建預覽：確認視窗開著時，房間先畫出擴建後的大小（TTRoom.previewSize），確認視窗改到左邊聊天框上面、不壓暗不模糊；
// 取消、點外面、Esc、換成別的確認視窗都會變回來（ttConfirm 沒有取消的回呼，看 #ttcModal 有沒有關掉）。按「擴建」先收掉預覽，再走原本的 expand()
let XP=null;
function xpStart(n,title){xpEnd();const m=$('ttcModal'),T=$('ttcT');if(!m||!m.classList.contains('on'))return;
 XP={n};const ch=$('ttHouseChat')?.getBoundingClientRect();document.body.style.setProperty('--tt-xprev-b',Math.round(ch&&ch.height?innerHeight-ch.top+14:24)+'px');
 document.body.classList.add('tt-house-xprev');room('previewSize',n);
 if(window.MutationObserver&&T){const ob=new MutationObserver(()=>{if(!m.classList.contains('on')||T.textContent!==title)xpEnd();});
  ob.observe(m,{attributes:true,attributeFilter:['class']});ob.observe(T,{childList:true,characterData:true,subtree:true});XP.ob=ob;}}
function xpEnd(){if(!XP)return;try{XP.ob&&XP.ob.disconnect();}catch(_){}XP=null;document.body.classList.remove('tt-house-xprev');document.body.style.removeProperty('--tt-xprev-b');room('previewSize',null);}
async function expand(){let nx=nextSize(),p=nx?priceOf('size'+nx):0;const key=S.key;if(S.buying||!nx||!p||!key||key!==KEY()||S.visit)return;
 S.buying=true;
 try{const was=sizeOk(S.size),now=sizeOk((await DB().ref(R()+'/house/'+key+'/size').once('value')).val());   // v508：用資料庫裡最新的大小
  if(now!==was){S.size=now;renderExpand();if(S.on&&!S.visit)await room('setSize',now);if(now>=nx){say('小屋已經擴建到 '+now+'×'+now+' 了');return;}nx=nextSize();p=nx?priceOf('size'+nx):0;if(!nx||!p)return;}
  const CAT=TTCat.price(p);
const bal=await DB().ref(R()+'/cat/'+key+'/balance').once('value');
  if(!Number.isSafeInteger(bal.val())||bal.val()<CAT){say('貓貓幣不夠，還差 '+TTCat.fmt(CAT-(Number(bal.val())||0))+(TTCat.EXCHANGE_ON?'，可以先到錢包用金幣兌換':'（每日任務每天送 '+TTCat.DAILY+'）'));return;}
  const ref=DB().ref(R()+'/clientOrders').push(),ts=Date.now(),name=(typeof me==='function'&&me()?.b?.name)||'酒館客人',nm='小屋擴建 '+nx+'×'+nx;
  const o={type:'shop',plan:'house:size'+nx,planName:'小屋擴建・'+nx+'×'+nx,amount:p,origAmount:p,couponUsed:false,couponDisc:0,itemId:'house:size'+nx,itemName:nm,name,paidBy:'cat',catAmount:CAT,status:'done',createdAt:ts,myKey:key};
  const lay=room('layout');
  await catSafety().execute({key,amount:CAT,ids:[ref.key],lookup:walletLookup,commit:async()=>{const ch={};
   ch['clientOrders/'+ref.key]=o;ch['cat/'+key+'/balance']=firebase.database.ServerValue.increment(-CAT);
   ch['catTx/'+key+'/'+ref.key]={type:'spend',amount:-CAT,ref:ref.key,note:o.planName,ts};ch['cat/'+key+'/lastTx']=ref.key;
   ch['house/'+key+'/size']=nx;ch['house/'+key+'/sizeRef']=ref.key;ch['house/'+key+'/at']=TS();
   if(Array.isArray(lay)&&lay.length)ch['house/'+key+'/layout']=JSON.parse(JSON.stringify(lay));
   await DB().ref(R()).update(ch);}});
  try{rememberPaymentIds([ref.key]);}catch(_){}
  S.size=nx;
  if(S.on&&S.key===key&&!S.visit){await room('setSize',nx);publish(room('layout'));renderBag();renderExpand();say('小屋擴建到 '+nx+'×'+nx+' 了！原本的家具都留在原位');}
 }catch(e){if(e&&e.ids)try{rememberPaymentIds(e.ids);}catch(_){}say(e&&e.message||'擴建沒有完成，請到訂單看看');
  DB().ref(R()+'/house/'+key+'/size').once('value').then(s=>{const n=sizeOk(s.val());if(n!==sizeOk(S.size)){S.size=n;renderExpand();if(S.on&&!S.visit)room('setSize',n);}}).catch(()=>{});}   // 結果不明：照資料庫的大小
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
 if(S.joining)return false;S.joining=true;S.lastFail='closed';const tok=S.tok||0;
 try{
  let view=null,owner=null;
  try{const [v,o]=await Promise.all([DB().ref(R()+'/houseView/'+key).once('value'),DB().ref(R()+'/lobby/'+key).once('value').catch(()=>null)]);view=v.val();owner=o?o.val():null;await loadCatalog();}
  catch(_){view=null;}
  if(!view||!(Array.isArray(view.layout)||view.at)){if(via!=='random')say('這間小屋現在沒有開放');return false;}
  if(!Array.isArray(view.layout))view.layout=[];   // v505：主人把家具全收起來了，空房間照樣可以進
  const name=String((owner&&owner.name)||view.name||'旅人').slice(0,40);
  const st=await sit(key);   // 先在對方家坐好，坐不下就留在原地
  if((S.tok||0)!==tok){if(st.r==='ok'){try{st.ref.onDisconnect().cancel();}catch(_){}st.ref.remove().catch(()=>{});}S.lastFail='left';return false;}   // v508：等座位的時候按了回大廳
  if(st.r!=='ok'){S.lastFail=st.r;if(via!=='random')say(st.r==='full'?name+' 的小屋客滿了（最多 4 人），等一下再來':st.r==='kicked'?name+' 請你先離開了，過一陣子再來吧':'這間小屋現在沒有開放');return false;}
  if(S.on)await teardown();
  useSeat(st);
  try{window.TinyTavernUI?.close?.();window.TTHub?.close?.();window.dmClose?.();}catch(_){}
  S.visit={key,name,layout:view.layout,size:sizeOk(view.size),paint:view.paint||null,at:view.at||0,via,likes:0,liked:false};S.key=mk;S.hk=key;S.on=true;S.mode='walk';watchMyDoll();
  if(owner&&owner.doll){S.dolls[key]=dollCanvasOf(owner.doll);redrawDoll(key,owner.doll);}
  document.body.classList.add('tt-house-on','tt-house-visit');document.body.classList.remove('tt-house-edit');
  setSign('Tiny Tavern・拜訪小屋',name+' 的小屋');
  if(via==='random')S.seen.add(key);
  DB().ref(R()+'/houseVisit/'+key+'/'+mk).update({name:myName(),at:TS()}).catch(()=>{});
  watch('houseVisit/'+key,v=>{const vs=v||{},m=vs[mk];if(!S.visit||S.visit.key!==key)return;S.visit.likes=Object.values(vs).filter(x=>x&&x.like===true).length;S.visit.liked=!!(m&&m.like===true);renderTop();});
  watch('houseView/'+key,v=>{const V=S.visit;if(!V||V.key!==key||!v||!v.at||v.at===V.at)return;V.at=v.at;   // v550 D：「朋友布置完後朋友看不到」——在別人家時，主人改擺設／壁紙地板／擴建，這邊馬上跟著換
   V.layout=Array.isArray(v.layout)?v.layout:[];V.paint=v.paint||null;const sz=sizeOk(v.size);if(sz!==V.size){V.size=sz;room('setSize',sz);}room('setLayout',V.layout);room('setPaint',V.paint||{});});
  S.fxHost={};watch('houseFx/'+key,v=>{if(!S.visit||S.visit.key!==key)return;S.fxHost=fxClean(v&&v.e);fxApply();});   // v526 主人開的光效（主人改了這邊也跟著變）
  startRoom(key);
  openFrame(name+' 的小屋',()=>{fxApply();room('spawn',+S.seat);S.last=null;pubPos();pushPeers();const host=SEATS.some(s=>S.room[s]&&S.room[s].k===key&&S.room[s].at>SNOW()-STALE);
    room('hint',host?'來到 '+name+' 的小屋了，打聲招呼吧':name+' 現在不在家，可以到處看看');});
  renderTop();renderKeys();renderChat();return true;
 }finally{S.joining=false;}}
// 隨機拜訪：公開名單裡挑一間，主人兩分鐘內在家的先挑；這次逛過的先跳過
// v508 隨機拜訪過場（lobby-ui/house-trip.js）：先洗牌候選人，再秀出這一間主人的頭像框＋闆卡，房間載好才離場；客滿／沒開門蓋章換下一間
function profileOf(k,dir){return Promise.all([DB().ref(R()+'/lobby/'+k).once('value').catch(()=>null),DB().ref(R()+'/houseView/'+k).once('value').catch(()=>null)]).then(([a,v])=>{
  const b=(a&&a.val())||{},view=(v&&v.val())||{},pub=b.pub||{};let photo='';try{photo=window.ttPhotoOf?ttPhotoOf(b)||'':'';}catch(_){}
  return {key:k,name:String(b.name||view.name||'旅人').slice(0,40),photo,doll:b.doll||{},frm:pub.frm,vip:+pub.vip||0,tags:b.tags,games:b.games,bm:b.bm,bd:b.bd,quote:b.quote,
   size:sizeOk(view.size),n:+view.n||(Array.isArray(view.layout)?view.layout.length:0),home:!!(dir&&dir.on>SNOW()-120000)};});}
async function roomReady(){for(let t=0;t<90;t++){const w=S.frame?.contentWindow;if(w&&w.TTRoom){try{await w.TTRoom.ready;}catch(_){}return;}await new Promise(r=>setTimeout(r,100));}}
async function randomVisit(){const mk=KEY();if(!mk||!DB()){say('先做一張闆卡、用 Discord 登入，才能去別人的小屋玩');return;}
 if(S.tripping)return;S.tripping=true;if(skipTrip())return quickVisit(mk);const T=window.TTHouseTrip;
 try{T?.open();
 let all={};try{all=(await DB().ref(R()+'/houseDir').orderByChild('at').limitToLast(200).once('value')).val()||{};}catch(_){}
 const cur=S.visit?.key,now=SNOW(),mix=a=>a.map(k=>[Math.random(),k]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
 let keys=Object.keys(all).filter(k=>k!==mk&&k!==cur);if(keys.every(k=>S.seen.has(k)))S.seen.clear();keys=keys.filter(k=>!S.seen.has(k));
 const home=keys.filter(k=>all[k]&&all[k].on>now-120000),away=keys.filter(k=>!home.includes(k));
 const pool=[...mix(home),...mix(away)].slice(0,6);
 if(!pool.length){say('現在還沒有其他開放的小屋，過幾天再來看看');await T?.close(false,'現在還沒有其他開放的小屋，過幾天再來看看');return;}
 const profs=pool.map(k=>profileOf(k,all[k]));
 if(T){const first=await Promise.all(profs.slice(0,5));await T.search(first);}
 for(let i=0;i<pool.length;i++){const k=pool[i];
  if(T){await T.show(await profs[i]);}
  if(await visit(k,'random')){if(T)await T.done(roomReady());return;}
  if(S.lastFail==='left')return;
  S.seen.add(k);
  if(T){await T.fail(S.lastFail);if(i<pool.length-1)await T.search(await Promise.all(profs.slice(i+1,i+6)));}}
 say('剛剛那幾間都客滿或沒開放，再按一次試試');await T?.close(false,'剛剛那幾間都客滿或沒開放，再按一次試試');
 }finally{S.tripping=false;T?.close(true);}}   // 正常走完 done()／close() 已經收掉；中途出錯也不會卡著
// v535 設定「串門子不看翻卡」（存本機 tt_skip_trip）：不播選角／翻卡、也不跑色條轉場，直接找一間有開門的進去（D 11/16）
const SKIP_KEY='tt_skip_trip';function skipTrip(){try{return localStorage.getItem(SKIP_KEY)==='1';}catch(_){return false;}}
async function quickVisit(mk){
 try{
  let all={};try{all=(await DB().ref(R()+'/houseDir').orderByChild('at').limitToLast(200).once('value')).val()||{};}catch(_){}
  const cur=S.visit?.key,now=SNOW(),mix=a=>a.map(k=>[Math.random(),k]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  let keys=Object.keys(all).filter(k=>k!==mk&&k!==cur);if(keys.every(k=>S.seen.has(k)))S.seen.clear();keys=keys.filter(k=>!S.seen.has(k));
  const home=keys.filter(k=>all[k]&&all[k].on>now-120000),away=keys.filter(k=>!home.includes(k));
  const pool=[...mix(home),...mix(away)].slice(0,6);
  if(!pool.length){say('現在還沒有其他開放的小屋，過幾天再來看看');return;}
  for(const k of pool){if(await visit(k,'random'))return;
   if(S.lastFail==='left')return;S.seen.add(k);}
  say('剛剛那幾間都客滿或沒開放，再按一次試試');
 }finally{S.tripping=false;}}
function bindSkipTrip(){const b=$('tglSkipTrip'),row=$('setSkipTripRow');if(!b)return;
 const phone=()=>isPhone()||(!!window.TTMobile&&!window.TTGame)||document.body.classList.contains('mhome-on');   // 手機功能首頁不能進小屋，不顯示
 const sync=()=>{if(row)row.hidden=phone();b.classList.toggle('on',skipTrip());b.setAttribute('aria-checked',String(skipTrip()));};
 b.setAttribute('role','switch');b.setAttribute('aria-label','隨機拜訪不看翻卡');sync();$('gearBtn')?.addEventListener('click',sync);   // v562 D：設定名稱也不用「串門子」→ 隨機拜訪
 b.addEventListener('click',()=>{try{localStorage.setItem(SKIP_KEY,skipTrip()?'0':'1');}catch(_){}sync();try{SFX.tap();}catch(_){}});}
// 試看面板用（?tripdemo=1）：自己＋隨機名單裡幾位的資料
async function tripSample(){const mk=KEY();if(!mk||!DB())return [];let all={};try{all=(await DB().ref(R()+'/houseDir').limitToLast(6).once('value')).val()||{};}catch(_){}
 const keys=[...new Set([...Object.keys(all).filter(k=>k!==mk),mk])].slice(0,5);return Promise.all(keys.map(k=>profileOf(k,all[k])));}
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
function openPanel(){if(!S.on||S.visit)return;if(S.mode==='edit')setMode('walk');fxClose();S.panel=true;document.body.classList.add('tt-house-panel');renderPanel();renderTop();loadFriends();
 clearInterval(S.onT);S.onT=setInterval(()=>{if(S.panel&&onSig()!==S.onSig)renderPanel();},3000);   // 好友上線／下線時才重畫（不然按鈕會被換掉、點不到）
 requestAnimationFrame(()=>room('frame'));}
function closePanel(){clearInterval(S.onT);S.onT=0;if(!S.panel)return;S.panel=false;document.body.classList.remove('tt-house-panel');requestAnimationFrame(()=>room('frame'));}
// v506 D：「邀請好友應該是邀請在線上的」→ 在線＝大廳有他的位置心跳（posMap，跟通訊錄同一套；在自己小屋裡的人大廳也照常回報）
const isOn=k=>{try{return !!posMap[k];}catch(_){return false;}};
const onSig=()=>Object.keys(S.friends||{}).filter(isOn).sort().join('|');
async function loadFriends(){const mk=KEY();if(!mk||!DB())return;try{S.friends=(await DB().ref(R()+'/friends/'+mk).once('value')).val()||{};}catch(_){S.friends={};}renderPanel();}
const ago=t=>{const m=Math.max(0,Math.round((SNOW()-(Number(t)||0))/60000));return m<1?'剛剛':m<60?m+' 分鐘前':m<1440?Math.round(m/60)+' 小時前':Math.round(m/1440)+' 天前';};
function renderPanel(){const box=$('ttVisitPanel');if(!box||!S.panel)return;
 const vs=Object.entries(S.visitors||{}).filter(([,v])=>v&&typeof v==='object'),likes=vs.filter(([,v])=>v.like===true).length;
 const recent=vs.sort((a,b)=>(b[1].at||0)-(a[1].at||0)).slice(0,8);
 const here=SEATS.map(s=>S.room[s]).filter(v=>v&&v.k!==S.key&&v.at>SNOW()-STALE*2);
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
// ---------- v526 光效（D 11/13：「客人收集到了但沒有拿到特效」「取得後能選擇要混搭裝備哪個特效，並且給客人調整的參數」）----------
// 扭蛋圖鑑的「集滿獎勵」：同一個系列集到一半解鎖第一階段、集滿解鎖招牌光效（數法跟圖鑑一樣：這個系列的扭蛋家具有幾種）。
// 解鎖後在自己小屋右下「光效」打開：可以同時開好幾個（混搭），每個各自調亮度／速度／數量／範圍。
// 存在 houseFx/<闆卡>（第二十四批規則；來玩的人照小屋開放設定看得到）＋這台電腦（規則還沒發布時只有自己看得到）。
const FX_SETS=[{set:'cn',series:'中華小惡魔',fx:[['金粉紅韻','整間染上暖暖的橘紅色調，金光一點一點往上飄'],['紅燈籠夜','關了燈的夜裡，空中飄著點點紅色火星，飄一飄就熄了']]},
 {set:'mermaid',series:'海底人魚屋',fx:[['泡泡藍調','整間染上海底的藍，房間裡飄著泡泡'],['深海天光','海面的光斜斜照進來，地上一圈晃動的水波光']]},
 {set:'forest',series:'森林精靈小屋',fx:[['螢火綠光','整間染上森林的綠，螢火蟲在房間裡飛'],['林間葉影','陽光穿過樹葉，地上一片會晃動的葉影']]}];   // 最新的卡池放最上面（光效面板照這個順序列）
const FX_P={a:['亮度',30,150,10],s:['速度',30,200,10],n:['數量',0,200,10],r:['範圍',60,160,10]};
const FX_HAS={mermaid1:'asn',mermaid2:'asnr',forest1:'asnr',forest2:'asnr',cn1:'asn',cn2:'asnr'};   // 調得到哪幾項：沒有粒子就沒有數量、沒有光池就沒有範圍
const FX_NIGHT={mermaid2:1,cn2:1};   // 11/23 D：紅燈籠夜關燈（黑黑的）；金粉紅韻是純色調、不關燈   // 夜晚系招牌光效：開了房間會變暗（光才亮眼），可以關掉
const FX_NAME={};FX_SETS.forEach(st=>st.fx.forEach(([nm],i)=>{FX_NAME[st.set+(i+1)]=nm;}));
const fxDef=()=>({a:100,s:100,n:100,r:100});
function fxProgress(set){const ser=FX_SETS.find(x=>x.set===set)?.series;let n=0,own=0;
 for(const c of S.cat||[])if(c.gacha&&!isVar(c)&&c.set===ser){n++;if(Object.keys(S.inv[c.k]||{}).length)own++;}   // 異色不算種類（跟圖鑑一樣只數原色）
 return {n,own,need1:Math.ceil(n/2),need2:n};}
function fxUnlocked(id){const p=fxProgress(id.slice(0,-1));return p.n>0&&p.own>=(id.slice(-1)==='1'?p.need1:p.need2);}
function fxClean(e){const out={};for(const [id,v] of Object.entries(e&&typeof e==='object'?e:{})){if(!/^[a-z]{2,12}[12]$/.test(id)||!v||typeof v!=='object')continue;
  const q={o:Math.max(0,Math.min(99,Math.round(+v.o)||0))};for(const [k,[,lo,hi]] of Object.entries(FX_P)){const x=Math.round(+v[k]);q[k]=Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):100;}
  if(v.d===false)q.d=false;const x=Math.round(+v.x),y=Math.round(+v.y);if(v.x!=null&&v.y!=null&&Number.isFinite(x)&&Number.isFinite(y)){q.x=Math.max(0,Math.min(100,x));q.y=Math.max(0,Math.min(100,y));}   // D 11/16 光的位置（沒擺過＝自動找空地）
  out[id]=q;}return out;}
const fxLocal=k=>'tt_house_fx_'+k;
async function fxLoad(key){let loc=null,rem;try{loc=JSON.parse(localStorage.getItem(fxLocal(key))||'null');}catch(_){}
 try{rem=(await DB().ref(R()+'/houseFx/'+key).once('value')).val();S.fxRemote=true;}catch(_){rem=undefined;S.fxRemote=false;}
 const pick=rem&&(!loc||(Number(rem.at)||0)>=(Number(loc.at)||0)-5000)?rem:loc;   // 新的那份為準（換電腦也在；規則還沒發布＝只看這台）
 const out={e:fxClean(pick&&pick.e),at:Number(pick&&pick.at)||0};
 if(S.fxRemote&&pick&&pick===loc&&Object.keys(out.e).length)setTimeout(()=>{if(S.fx===out)fxSave();},0);   // 之前只存在這台的，規則發布後補存上去
 return out;}
function fxSave(){const key=S.key;if(!key||S.visit||!S.fx||!DB())return;S.fx.at=SNOW();
 try{localStorage.setItem(fxLocal(key),JSON.stringify({at:S.fx.at,e:S.fx.e}));}catch(_){}
 clearTimeout(S.fxT);S.fxT=setTimeout(()=>{const body={at:TS()};if(Object.keys(S.fx.e).length)body.e=S.fx.e;
  const ref=DB().ref(R()+'/houseFx/'+key),fail=err=>{S.fxRemote=false;console.warn('[houseFx] 沒存進資料庫（規則還沒發布？）先存在這台電腦',err&&err.code);};
  ref.set(body).then(()=>{S.fxRemote=true;},err=>{const pos=body.e&&Object.values(body.e).some(v=>v.x!=null);if(!pos)return fail(err);   // 規則還沒收光的位置（第二十五批）：先存不帶位置的
   const e2={};for(const [k,v] of Object.entries(body.e)){const q={...v};delete q.x;delete q.y;e2[k]=q;}ref.set({...body,e:e2}).then(()=>{S.fxRemote=true;},fail);});},700);}
function fxList(e,check){return Object.entries(e||{}).filter(([id])=>!check||fxUnlocked(id)).sort((a,b)=>(a[1].o||0)-(b[1].o||0))
 .map(([id,v])=>({set:id.slice(0,-1),lv:+id.slice(-1),a:v.a,s:v.s,n:v.n,r:v.r,d:v.d!==false,x:v.x,y:v.y}));}
function fxApply(){const w=S.frame?.contentWindow;if(!w||!w.TTFX||!S.on)return;try{if(w.TTFX.previewing())return;}catch(_){}   // 試看中先不蓋掉，試看結束會再套一次
 const L=S.visit?fxList(S.fxHost,false):fxList(S.fx&&S.fx.e,true);try{w.TTFX.set(L.length?L:false);}catch(_){}}
let FX_RAF=0;const fxApplySoon=()=>{if(!FX_RAF)FX_RAF=requestAnimationFrame(()=>{FX_RAF=0;fxApply();});};
// 剛解鎖：還沒存過任何光效設定的人直接幫他打開（客人反應「收集到了但沒有拿到特效」）；存過的只提示＋光效鈕亮紅點
function fxInvChanged(){const key=S.key;if(!key||S.visit||!S.cat)return;const ok=[];FX_SETS.forEach(st=>st.fx.forEach((_,i)=>{const id=st.set+(i+1);if(fxUnlocked(id))ok.push(id);}));
 let seen=null;try{seen=JSON.parse(localStorage.getItem('tt_house_fxseen_'+key)||'null');}catch(_){}
 const fresh=ok.filter(id=>!(seen||[]).includes(id));
 if(fresh.length&&S.fx){let auto=false;if(!S.fx.at){for(const id of fresh)if(!S.fx.e[id]){S.fx.e[id]={...fxDef(),o:fxNextO()};auto=true;}if(auto){fxSave();fxApply();}}
  try{localStorage.setItem('tt_house_fxseen_'+key,JSON.stringify(ok));}catch(_){}
  const nm=fresh.map(id=>'「'+FX_NAME[id]+'」').join('、');
  setTimeout(()=>say(auto?'解鎖了光效'+nm+'，已經幫你打開了！右下「光效」可以調整或混搭':'解鎖了光效'+nm+'！到右下「光效」打開'),900);
  $('ttHouseFx')?.classList.add('dot');}
 fxRender();}
function fxNextO(){let m=-1;for(const v of Object.values(S.fx.e))m=Math.max(m,v.o||0);if(m>=99){let i=0;for(const v of Object.values(S.fx.e).sort((a,b)=>a.o-b.o))v.o=i++;m=i-1;}return m+1;}
function fxOpen(){if(!S.on||S.visit)return;if(S.mode==='edit')setMode('walk');closePanel();S.fxOpen=true;document.body.classList.add('tt-house-fxp');$('ttHouseFx')?.classList.remove('dot');
 fxRender();requestAnimationFrame(()=>room('frame'));}
function fxClose(){fxPickEnd(true);fxStopTry();if(!S.fxOpen)return;S.fxOpen=false;document.body.classList.remove('tt-house-fxp');requestAnimationFrame(()=>room('frame'));}
function fxTry(id){const w=S.frame?.contentWindow;if(!w||!w.TTFX)return;if(S.fxTry===id){fxStopTry();return;}
 try{w.TTFX.preview([{set:id.slice(0,-1),lv:+id.slice(-1)}],10000);S.fxTry=id;}catch(_){}fxRender();}
function fxStopTry(){if(!S.fxTry)return;S.fxTry=null;try{S.frame?.contentWindow?.TTFX?.stopPreview();}catch(_){}fxApply();fxRender();}
function fxHasPool(id){try{return !!S.frame?.contentWindow?.TTFX?.hasPool?.(id);}catch(_){return false;}}
function fxPickStart(id){const w=S.frame?.contentWindow,cur=S.fx&&S.fx.e[id];if(!w||!w.TTFX||!w.TTFX.pick||!cur)return;fxPickEnd(true);fxStopTry();S.fxPick=id;
 w.TTFX.pick(id,(q,fin)=>{const c=S.fx&&S.fx.e[id];if(!c)return;c.x=q.x;c.y=q.y;if(fin)fxSave();});fxRender();}
function fxPickEnd(quiet){if(!S.fxPick)return;S.fxPick=null;try{S.frame?.contentWindow?.TTFX?.pickEnd();}catch(_){}fxSave();if(!quiet)fxRender();}
function fxToggle(id){if(S.fxPick===id)fxPickEnd(true);if(!S.fx||!fxUnlocked(id))return;const e=S.fx.e;if(e[id])delete e[id];else e[id]={...fxDef(),o:fxNextO()};fxSave();fxApply();fxRender();}
function fxRender(){const box=$('ttFxPanel');if(!box||!S.fxOpen)return;const body=box.querySelector('.tt-fx-body'),e=(S.fx&&S.fx.e)||{};
 const keep=box.contains(document.activeElement)?document.activeElement.dataset.f:null,top=body.scrollTop;
 body.innerHTML=FX_SETS.map(st=>{const p=fxProgress(st.set);
  return '<section class="tt-fx-set"><h4><span>'+esc(st.series)+'</span><small>已收集 '+p.own+'／'+p.n+'</small></h4>'
   +st.fx.map(([nm,ds],i)=>{const lv=i+1,id=st.set+lv,need=lv===1?p.need1:p.need2,ok=p.n>0&&p.own>=need,on=ok&&!!e[id],v=e[id]||fxDef();
    return '<article class="tt-fx-card'+(on?' on':'')+(ok?'':' lock')+'" data-id="'+id+'"><div class="tt-fx-row">'
     +'<i class="tt-fx-img"><img src="gacha/3d/fx/'+st.set+'_'+lv+'.jpg?v='+VER+'" alt="" loading="lazy">'+(ok?'':'<s>未解鎖</s>')+(on?'<s class="tt-fx-onbadge">開著</s>':'')+'</i>'
     +'<div class="tt-fx-info"><em>'+(lv===1?'集到一半':'全部集滿')+'</em><b>'+esc(nm)+'</b><p>'+esc(ds)+'</p>'
     +(ok?'<button type="button" class="tt-fx-tog" role="switch" aria-checked="'+on+'" aria-label="'+esc(nm)+'" data-tog="'+id+'" data-f="t'+id+'"><i></i><span>'+(on?'開著':'關著')+'</span></button>'
      :'<div class="tt-fx-need"><u><span style="width:'+(Math.min(p.own,need)/Math.max(1,need)*100).toFixed(1)+'%"></span></u><small>'+p.own+'／'+need+'・再收集 '+Math.max(0,need-p.own)+' 件解鎖</small></div>'
       +'<button type="button" class="tt-fx-try'+(S.fxTry===id?' on':'')+'" data-try="'+id+'" data-f="y'+id+'">'+(S.fxTry===id?'試看中・點一下結束':'試看 10 秒')+'</button>')
     +'</div></div>'
     +(on?'<div class="tt-fx-params">'+[...(FX_HAS[id]||'asnr')].map(k=>{const [lb,lo,hi,stp]=FX_P[k];
        return '<label><span>'+lb+'</span><input type="range" min="'+lo+'" max="'+hi+'" step="'+stp+'" value="'+v[k]+'" data-p="'+k+'" data-f="p'+id+k+'" aria-label="'+esc(nm)+lb+'"><output>'+v[k]+'%</output></label>';}).join('')
       +(FX_NIGHT[id]?'<label class="tt-fx-chk"><input type="checkbox" data-d="'+id+'" data-f="d'+id+'"'+(v.d===false?'':' checked')+'><span>房間跟著變暗（光比較亮眼）</span></label>':'')
       +(fxHasPool(id)?'<div class="tt-fx-pos'+(S.fxPick===id?' on':'')+'"><button type="button" class="tt-fx-posbtn" data-pos="'+id+'" data-f="q'+id+'">'+(S.fxPick===id?'擺好了':'調整光的位置')+'</button>'
        +'<small>'+(S.fxPick===id?'在房間地板上點一下或按住拖曳，光就會跟著移過去':v.x!=null?'光在你擺的位置':'光會自己找空地')+'</small>'
        +(v.x!=null&&S.fxPick!==id?'<button type="button" class="tt-fx-posauto" data-posauto="'+id+'" data-f="u'+id+'">讓光自己找空地</button>':'')+'</div>':'')
       +'<button type="button" class="tt-fx-reset" data-reset="'+id+'" data-f="r'+id+'">恢復預設</button></div>':'')
     +'</article>';}).join('')+'</section>';}).join('')
  +'<button type="button" class="tt-fx-off" data-f="off"'+(Object.keys(e).length?'':' disabled')+'>全部關掉</button>';
 body.scrollTop=top;if(keep){const el=body.querySelector('[data-f="'+keep+'"]');if(el)el.focus({preventScroll:true});}}
function fxBind(box){
 box.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();fxClose();}});   // 焦點在拉桿上也能 Esc 關掉
 box.addEventListener('click',ev=>{const t=ev.target.closest('button');if(!t)return;
  if(t.classList.contains('tt-vp-close'))return fxClose();
  if(t.dataset.tog)return fxToggle(t.dataset.tog);
  if(t.dataset.try)return fxTry(t.dataset.try);
  if(t.dataset.pos)return S.fxPick===t.dataset.pos?fxPickEnd():fxPickStart(t.dataset.pos);
  if(t.dataset.posauto){const cur=S.fx&&S.fx.e[t.dataset.posauto];if(cur){delete cur.x;delete cur.y;fxSave();fxApply();fxRender();}return;}
  if(t.dataset.reset){if(S.fxPick===t.dataset.reset)fxPickEnd(true);const cur=S.fx&&S.fx.e[t.dataset.reset];if(cur){Object.assign(cur,fxDef());delete cur.d;delete cur.x;delete cur.y;fxSave();fxApply();fxRender();}return;}
  if(t.dataset.f==='off'&&S.fx){fxPickEnd(true);S.fx.e={};fxSave();fxApply();fxRender();}});
 box.addEventListener('input',ev=>{const t=ev.target;if(!t.dataset.p)return;const id=t.closest('[data-id]')?.dataset.id,cur=S.fx&&S.fx.e[id];if(!cur)return;
  cur[t.dataset.p]=+t.value;const o=t.nextElementSibling;if(o)o.textContent=t.value+'%';if(t.dataset.p!=='r')fxApplySoon();});   // 範圍放開再套（葉影要重算）
 box.addEventListener('change',ev=>{const t=ev.target,id=t.closest('[data-id]')?.dataset.id,cur=S.fx&&S.fx.e[id];if(!cur)return;
  if(t.dataset.d){if(t.checked)delete cur.d;else cur.d=false;}fxApply();fxSave();});}

const ICON={
 houseImg:'<img src="lobby-ui/assets/house.png" alt="">',   // v497 大廳 dock 的小屋鈕：像素小屋圖示（跟我的酒館／商城／背包同一套畫風）
 house:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 13 14 4.5 24 13"/><path d="M7 11v12h14V11"/><path d="M12 23v-6h4v6"/></svg>',
 grow:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 9.5l6.5 3.5-6.5 3.5-6.5-3.5z"/><path d="M4 9V4h5M24 9V4h-5M4 19v5h5M24 19v5h-5"/></svg>',
 brush:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M6 22c3 0 5-2 5-5l9-11 3 3-11 9c0 3-2 5-6 4z"/><path d="M15 9l4 4"/></svg>',
 shop:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 11h18l-1.5 11h-15z"/><path d="M9 11V8a5 5 0 0 1 10 0v3"/><path d="M11 16h6"/></svg>',
 roller:'<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="4" y="4" width="17" height="7" rx="2"/><path d="M21 7.5h2.5v6H13v4"/><path d="M11.5 17.5h3V25h-3z"/></svg>',
 back:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M11 7 5 13l6 6"/><path d="M5 13h12a6 6 0 0 1 0 12h-3"/></svg>',
 plus:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 7v14M7 14h14"/></svg>',
 help:'<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="10"/><path d="M10.8 11a3.3 3.3 0 1 1 4.6 3c-1 .5-1.4 1.1-1.4 2.2"/><path d="M14 19.6v.4"/></svg>',
 minus:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M7 14h14"/></svg>',
 fit:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 10V5h5M18 5h5v5M23 18v5h-5M10 23H5v-5"/></svg>',
 visit:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 14 9 9l6 5"/><path d="M5 12.5V21h8v-8.5"/><path d="M15 11l5-4 5 4"/><path d="M17 9.5V21h6V9.5"/></svg>',
 heart:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 23s-9-5.4-9-11.5A4.8 4.8 0 0 1 14 9a4.8 4.8 0 0 1 9 2.5C23 17.6 14 23 14 23z"/></svg>',
 dice:'<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="5" y="5" width="18" height="18" rx="4"/><path d="M10 10h.01M18 10h.01M14 14h.01M10 18h.01M18 18h.01"/></svg>',
 dress:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M11.5 8.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.6v.6"/><path d="M14 12.9 4.6 19.2a1.3 1.3 0 0 0 .7 2.3h17.4a1.3 1.3 0 0 0 .7-2.3z"/></svg>',
 spark:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M13 3.5l2.3 6.9 6.9 2.3-6.9 2.3L13 21.9l-2.3-6.9-6.9-2.3 6.9-2.3z"/><path d="M21.5 17.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/></svg>',
 ticket:'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z"/><path d="M17.5 8v2M17.5 13v2M17.5 18v2"/><path class="tt-tix-gem" d="M10.5 9.5l3 4.5-3 4.5-3-4.5z"/></svg>',   // 家具券（票根＋菱形）
 find:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'};
function btn(id,cls,icon,label,fn){const b=document.createElement('button');b.type='button';b.id=id;b.className=cls;b.innerHTML=ICON[icon]+'<span>'+label+'</span>';b.onclick=fn;return b;}
function build(){
 const dock=$('ttMainDock');if(!dock||$('ttHouseBtn'))return;
 const entry=btn('ttHouseBtn','tt-house-entry','houseImg','小屋',enter);
 const hub=$('ttHubButton');if(hub)hub.after(entry);else dock.prepend(entry);
 dock.append(btn('ttHouseExpand','tt-house-only off','grow','擴建',askExpand));   // v507 D：擴建單獨一顆，放在佈置左邊（價格上架、還能再擴才出現）
 dock.append(btn('ttHouseDress','tt-house-only tt-house-any','dress','換裝',openDress));   // 11/24 D：自己家、朋友家都能隨時換裝（開背包）
 dock.append(btn('ttHouseFx','tt-house-only','spark','光效',()=>S.fxOpen?fxClose():fxOpen()));   // v526 光效：扭蛋集滿獎勵解鎖的系列光效，開關、混搭、調整
 dock.append(btn('ttHouseEdit','tt-house-only','brush','佈置',()=>setMode('edit')));
 dock.append(btn('ttHouseMall','tt-house-only','roller','商城',openMall));   // v510 D：小屋右下多一個商城，專門賣各系列的壁紙跟地板（扭蛋鈕插在家具店前面＝商城右邊）
 dock.append(btn('ttHouseShop','tt-house-only tt-house-main','shop','家具店',openShop));
 const top=document.createElement('div');top.id='ttHouseTop';
 top.append(btn('ttVisitLike','tt-house-btn tt-visit-only','heart','讚',toggleLike),btn('ttVisitNext','tt-house-btn tt-visit-only','dice','下一間',randomVisit),
  btn('ttVisitHome','tt-house-btn tt-visit-only','house','我的小屋',enter),
  btn('ttHouseVisit','tt-house-btn tt-own-only','visit','拜訪',()=>S.panel?closePanel():openPanel()),btn('ttHouseHelp','tt-house-btn tt-own-only','help','教學',houseTour),btn('ttHouseBack','tt-house-btn','back','回大廳',exit));
// v495 D：右邊的放大／縮小／整間拿掉（滾輪縮放、按住拖曳照樣能用），「我的家具」改成右側整欄
 const bag=document.createElement('section');bag.id='ttHouseBag';bag.setAttribute('aria-label','我的家具');
 // v572 D 11/26：改到畫面下排——上列＝分類＋搜尋（在分類右邊）＋家具券＋去扭蛋／完成，下列＝家具（電腦左右捲；手機照舊直的三欄）
 bag.innerHTML='<header><span class="tt-hb-title"><b>我的家具</b><small>MY FURNITURE</small></span><div class="tt-hb-tabs" role="group" aria-label="家具分類"></div>'
  +'<label class="tt-hb-search">'+ICON.find+'<input id="ttHouseFind" type="text" inputmode="search" enterkeyhint="search" maxlength="20" autocomplete="off" spellcheck="false" placeholder="搜尋家具" aria-label="用名字搜尋家具">'
  +'<button type="button" class="tt-hb-clear" hidden aria-label="清除搜尋">'+ICON.x+'</button></label>'
  +'<button type="button" class="tt-hb-tix" hidden title="抽到重複的家具會變成家具券，可以在扭蛋圖鑑換「再一件」或異色家具">'+ICON.ticket+'<span>家具券</span><b>0</b><span>張</span><small>到扭蛋圖鑑換家具 ›</small></button>'
  +'<div class="tt-hb-acts"><button type="button" class="tt-hb-shop">去扭蛋</button><button type="button" class="tt-hb-done">完成</button></div></header>'
  +'<p class="tt-hb-tip">點家具拿出來，移到房間裡再點一下放好；點房間裡的家具可以移動。</p>'
  +'<div class="tt-hb-grid"></div>';
 {const find=bag.querySelector('#ttHouseFind'),grid=bag.querySelector('.tt-hb-grid'),tabs=bag.querySelector('.tt-hb-tabs');let comp=false;
  // 搜尋：打字就篩（注音還在拼的時候先不篩）；Esc 先清字、再離開輸入框；貼壁紙／鋪地板時打字＝回到找家具
  const apply=()=>{const v=find.value.slice(0,20);if(v===S.bagQ)return;S.bagQ=v;
   if(bagNorm(v)&&(S.bagKind==='pw'||S.bagKind==='pf')){S.bagKind='all';if(S.ptool){paintSelect(null);grid.scrollLeft=0;grid.scrollTop=0;return;}}
   renderBag();grid.scrollLeft=0;grid.scrollTop=0;};
  find.addEventListener('compositionstart',()=>{comp=true;});find.addEventListener('compositionend',()=>{comp=false;apply();});
  find.addEventListener('input',()=>{if(!comp)apply();});
  find.addEventListener('keydown',e=>{if(e.isComposing||e.keyCode===229)return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(find.value){find.value='';apply();}else find.blur();}
   else if(e.key==='Enter'){e.preventDefault();apply();}});
  bag.querySelector('.tt-hb-clear').onclick=e=>{e.preventDefault();find.value='';apply();find.focus({preventScroll:true});};
  // 電腦：滑鼠滾輪上下滾＝清單／分類左右捲
  const wheel=el=>el.addEventListener('wheel',e=>{if(window.TTGame||e.ctrlKey||el.scrollWidth<=el.clientWidth+1)return;
   const d=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!d)return;e.preventDefault();el.scrollLeft+=d*(e.deltaMode===1?32:e.deltaMode===2?el.clientWidth:1);},{passive:false});
  wheel(grid);wheel(tabs);tabs.addEventListener('scroll',()=>bagEdge(),{passive:true});addEventListener('resize',()=>{if(S.on&&S.mode==='edit')bagEdge();});}
 bag.querySelector('.tt-hb-tix').onclick=()=>{if(window.TTGacha)TTGacha.open();};
 bag.querySelector('.tt-hb-shop').onclick=()=>{if(window.TTGacha)TTGacha.open();else openShop();};/* v507 家具店入口拿掉，改去扭蛋 */bag.querySelector('.tt-hb-done').onclick=()=>setMode('walk');
 // v504 串門子側欄（跟「我的家具」同一個位置、同一套外觀）
 const vp=document.createElement('section');vp.id='ttVisitPanel';vp.setAttribute('aria-label','拜訪');   // v506 D：「串門子」聽起來像中國用語 → 拜訪
 vp.innerHTML='<header><span class="tt-hb-title"><b>拜訪</b><small>VISIT</small></span><button type="button" class="tt-vp-close">關閉</button></header><div class="tt-vp-body"></div>';
 // v504 小屋聊天（左下）：最近幾句＋輸入框；說的話也會冒在小人頭上
 const chat=document.createElement('section');chat.id='ttHouseChat';chat.setAttribute('aria-label','小屋聊天');
 chat.innerHTML='<header><b>小屋聊天</b><small class="tt-hc-who"></small></header><div class="tt-hc-log" aria-live="polite"></div>'
  +'<form class="tt-hc-form"><button type="button" class="tt-hc-stkbtn" title="聊天貼圖" aria-label="發送聊天貼圖" aria-expanded="false" aria-controls="ttHouseStk">'+STK_ICON+'</button>'
  +'<input id="ttHouseSay" maxlength="'+CHAT_MAX+'" autocomplete="off" placeholder="說點什麼…（Enter 送出）" aria-label="在小屋裡說話"><button type="submit">送出</button></form>'
  +'<div class="tt-hc-pick" id="ttHouseStk" hidden aria-label="聊天貼圖選單"><div class="tt-hc-pickhd"><b>聊天貼圖</b><span>點一下發送</span></div><div class="tt-hc-pickgrid"></div></div>';
 chat.querySelector('form').addEventListener('submit',e=>{e.preventDefault();sendChat();});
 {const pick=chat.querySelector('.tt-hc-pick'),sb=chat.querySelector('.tt-hc-stkbtn'),grid=pick.querySelector('.tt-hc-pickgrid'),cat=window.TTStickerCatalog||[];
  if(!cat.length||!window.TTChatStickers)sb.hidden=true;
  grid.innerHTML=cat.map(it=>'<button type="button" data-id="'+esc(it.id)+'" aria-label="發送'+esc(it.name)+'貼圖"><img src="'+esc(stkUrl(it))+'" alt="" draggable="false"><span>'+esc(it.name)+'</span></button>').join('');
  const hide=()=>{pick.hidden=true;sb.setAttribute('aria-expanded','false');};
  sb.onclick=()=>{const open=pick.hidden;pick.hidden=!open;sb.setAttribute('aria-expanded',String(open));if(open)grid.querySelector('button')?.focus({preventScroll:true});};
  grid.onclick=e=>{const b=e.target.closest('button[data-id]');if(!b)return;hide();sendSticker(b.dataset.id);$('ttHouseSay')?.focus({preventScroll:true});};
  pick.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hide();sb.focus({preventScroll:true});}});
  document.addEventListener('pointerdown',e=>{if(!pick.hidden&&!chat.contains(e.target))hide();});}
 const fxp=document.createElement('section');fxp.id='ttFxPanel';fxp.setAttribute('aria-label','光效');   // v526 光效面板（跟拜訪、我的家具同一個位置、同一套外觀）
 fxp.innerHTML='<header><span class="tt-hb-title"><b>光效</b><small>ROOM FX</small></span><button type="button" class="tt-vp-close">關閉</button></header>'
  +'<p class="tt-hb-tip">扭蛋家具集到一半、集滿各解鎖一個系列光效。可以同時開好幾個混搭，再調成喜歡的樣子；來玩的朋友也看得到。</p><div class="tt-fx-body"></div>';
 fxBind(fxp);
 const keys=document.createElement('p');keys.id='ttHouseKeys';keys.setAttribute('aria-live','polite');
 document.body.append(top,bag,vp,fxp,chat,keys);renderKeys();renderChat();
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
  :S.ptool?(S.ptool.theme?'點一格＝貼上　':'點一格＝還原　')+K('按住拖曳')+' 連續'+(S.ptool.theme?'貼':'還原')+'　從房間外按住拖曳＝移動視角　'+K('Esc')+' 放下'
  :hold?'移動滑鼠＝搬家具　'+K('點一下')+' 放好　'+K('R')+' 轉向　'+K('Delete')+' 收回背包　'+K('Esc')+' 取消'
  :'點下面的家具＝拿出來　點房間裡的家具＝拿起來移動　'+K('按住拖曳')+' 移動視角　'+K('滾輪')+' 放大縮小';}

// ---------- 給房間（iframe）用的介面 ----------
window.TTHouse={
 initialLayout:()=>S.visit?S.visit.layout:S.layout,
 initialPaint:()=>S.visit?S.visit.paint:S.paint,
 paintChanged:p=>{if(S.visit||!p)return;S.paint=p;S.paintTouched=true;save(room('layout')||S.layout||[]);},
 paintDropped:()=>{if(S.ptool){S.ptool=null;renderBag();renderKeys();}},
 tripSample,
 fxPreviewEnd:()=>{if(!S.fxTry)return;S.fxTry=null;fxApply();fxRender();},   // v526 試看光效 10 秒到了（房間那邊通知）
 roomSize:()=>S.visit?S.visit.size:sizeOk(S.size),
 visiting:()=>S.visit?{key:S.visit.key,name:S.visit.name}:null,
 save,
 changed:()=>{renderBag();renderKeys();},
 modeChanged:m=>{if(S.mode!==m){S.mode=m;document.body.classList.toggle('tt-house-edit',m==='edit');if(m==='edit')bagEnter();else bagLeave();renderBag();}renderKeys();},
 dollCanvas:myDollCanvas,
 insets(){const vh=innerHeight,vw=innerWidth;let t=20,b=20,l=20,r=20;
  if(window.TTGame){const tp=document.querySelector('#ttG .ttg-top')?.getBoundingClientRect(),bag=document.body.classList.contains('tt-house-edit')?$('ttHouseBag')?.getBoundingClientRect():null;   // v539 手機：上面名牌、下面佈置清單
   return {t:(tp?tp.bottom:60)+8,b:bag&&bag.height?vh-bag.top+8:vh-(document.querySelector('#ttG .ttg-bar')?.getBoundingClientRect().top||vh-90)+56,l:8,r:8};}
  const sg=$('sign')?.getBoundingClientRect();if(sg&&sg.height)t=Math.max(t,sg.bottom+12);
  const hud=$('hud2')?.getBoundingClientRect();if(hud&&hud.height&&hud.right>vw*.3)t=Math.max(t,hud.bottom+8);
  const dk=$('ttMainDock')?.getBoundingClientRect();if(dk&&dk.height&&!document.body.classList.contains('tt-house-edit'))b=Math.max(b,vh-dk.top+10);
  if(document.body.classList.contains('tt-house-edit')){const q=$('ttHouseBag')?.getBoundingClientRect();if(q&&q.height)b=Math.max(b,vh-q.top+34);if(S.editUp)t=Math.max(20,t-S.editUp);}   // v572 佈置：家具在畫面下排，上面再讓一行操作說明
  const side=S.panel?$('ttVisitPanel'):S.fxOpen?$('ttFxPanel'):null;
  if(side){const q=side.getBoundingClientRect();if(q.width)r=Math.max(r,vw-q.left+12);}   // 拜訪、光效：右側整欄
  const ch=$('ttHouseChat')?.getBoundingClientRect();if(ch&&ch.width&&ch.right<vw*.4)l=Math.max(l,ch.right+12);   // 左下的小屋聊天
  return {t,b,l,r};},
 enter,exit,openShop,openMall,visit,randomVisit,placeNew,
 state:()=>({on:S.on,mode:S.mode,inv:S.inv,visit:S.visit?{key:S.visit.key,name:S.visit.name,via:S.visit.via}:null,vis:S.vis,seat:S.seat,room:S.room,chat:S.chatLog.slice(-5)})};
addEventListener('keydown',e=>{const t=e.target;if(!S.on||(t&&typeof t.closest==='function'&&t.closest('input,textarea')))return;
 if(e.key==='Escape'&&XP){e.preventDefault();$('ttcNo')?.click();return;}   // v509 擴建確認視窗開著：Esc＝取消（預覽跟著收掉）
 if(e.key==='Escape'&&S.mode==='edit'&&S.ptool){e.preventDefault();paintSelect(null);return;}   // v510 拿著壁紙／地板：Esc 先放下
 if(S.mode==='edit'&&room('key',e.key)){e.preventDefault();renderKeys();return;}   // 焦點在大廳時，R／Delete／Esc 轉給房間
 if(e.key==='Escape'&&S.fxOpen){fxClose();return;}
 if(e.key==='Escape'&&S.panel){closePanel();return;}
 if(e.key==='Escape'&&S.mode==='edit'&&!room('holding'))setMode('walk');
 if(e.key==='Enter'&&S.mode!=='edit'&&!(t&&typeof t.closest==='function'&&t.closest('button,a,[role=button],select'))&&!document.querySelector('.ttc.on')){const i=$('ttHouseSay');if(i){e.preventDefault();i.focus();}}});
addEventListener('pagehide',()=>{if(S.seatRef)try{S.seatRef.remove();}catch(_){}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{build();bindSkipTrip();});else{build();bindSkipTrip();}
})();
