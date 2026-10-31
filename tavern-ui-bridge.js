/* 正式站介面接線：資料由既有網站供應，選購沿用原結帳流程。 */
(() => {
  'use strict';
  const oldStep=shopStep, oldInfo=openPcInfo, oldWard=window.openWardrobe, oldBack=backFromPlans, oldShopOpen=shopOpen;
  const oldBookOpen=window.bookOpen, oldBookGo=window.bkGo;
  const oldDress=document.getElementById('dressBtn').onclick;
  const THEMES={'-OxY46ezlpnRt64hUIw9':'KABUKI','-OxY7C4vDkgsr1zcyWbk':'RIRA','-OzbfbQcF6J6fIR6YYGh':'MOMO'};
  let frame, overlay, trigger, pending, active=false;
  const clone=x=>JSON.parse(JSON.stringify(x));
  function close(){if(overlay)overlay.hidden=true;active=false;document.body.classList.remove('tt-approved-open');trigger?.focus?.();}
  function open(view='roster',cid=null){
    trigger=document.activeElement;pending={view,cid,mode:pkMode};active=true;document.body.classList.add('tt-approved-open');
    if(!overlay){
      overlay=document.createElement('div');overlay.id='ttApprovedUI';overlay.hidden=true;
      overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Tiny Tavern');
      frame=document.createElement('iframe');frame.title='Tiny Tavern 名簿與商城';
      frame.style.visibility='hidden';frame.src='tavern-ui/index.html?v=478';overlay.append(frame);document.body.append(overlay);
      frame.onload=()=>{frame.contentWindow.ttLiveOpen?.(pending);frame.style.visibility='visible';};
      overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    }
    shopClose();try{gClose('pcM');gClose('wardM');if(typeof bookClose==='function')bookClose();}catch(_){}
    document.getElementById('dressM').style.display='none';overlay.hidden=false;
    frame.contentWindow.ttLiveOpen?.(pending);frame.focus();
  }
  function staff(){return Object.entries(STAFF_ALL).filter(([,s])=>s).map(([cid,s])=>({cid,theme:THEMES[cid]||null,name:({KABUKI:'蕪',RIRA:'縭',MOMO:'桃'}[THEMES[cid]])||s.name||'冒險者',on:!!s.on,busy:!!s.busy,card:clone(STAFF_CARDS[cid]||{})}));}
  function group(part,source,key){
    if(['head','ear','face','hand','back','bottom','outer','glove'].includes(part?.group))return part.group;   // v441 下身／外套／手套（商城列在衣服分類）
    const known={'cloth0:acc1':'hand','cloth0:acc2':'head','cloth0:acc3':'head','cloth3:acc1':'hand','cloth3:acc2':'ear','cloth3:acc3':'head','cloth2:acc2':'face','cloth2:acc3':'hand'};
    if(known[source+':'+key])return known[source+':'+key];
    const n=String(part?.n||'');
    if(/耳環|耳飾/.test(n))return 'ear';
    if(/髮|頭|冠|帽|貓耳|獸耳|蝴蝶結|角/.test(n))return 'head';
    if(/眼鏡|面|口罩|眼罩|腮紅/.test(n))return 'face';
    if(/尾巴|背|翅膀|披風/.test(n))return 'back';
    return 'hand';
  }
  // Visible bounds cover all 16 original GIF frames, including the floating effects.
  const companionPets={pet_bubu:{name:'布布',asset:'kabuki',bounds:[6,44,68,90]},pet_guigui:{name:'鬼鬼',asset:'rira',bounds:[14,10,78,88]},pet_dengdeng:{name:'燈燈',asset:'momo',bounds:[8,16,88,112]}};
  const staffPetLayout={kabuki:{size:123,x:86,y:22},rira:{size:133,x:-93,y:-4},momo:{size:125,x:-89,y:-51}};
  function followingPet(d){if(d?.uiBaseSlots?.includes('pet'))return null;const id=d?.ps?.pet||d?.set,pet=companionPets[id];return pet?{...pet,id,layout:{reference:160,...staffPetLayout[pet.asset]},src:'img/companions-v352/'+pet.asset+'-pet.gif?v=356'}:null;}
  const staffPets={'-OxY7C4vDkgsr1zcyWbk':'pet_guigui','-OxY46ezlpnRt64hUIw9':'pet_bubu','-OzbfbQcF6J6fIR6YYGh':'pet_dengdeng'};
  const previousSetFrame=setFrame;setFrame=function(a,p){
    const staffPet=a.staff&&staffPets[a.cid];
    const pet=followingPet(staffPet?{ps:{pet:staffPet}}:a.b?.doll);
    if(!pet){a._companionPet?.remove();a._companionPet=null;}
    else if(a.el){
      let img=a._companionPet;
      if(!img){img=document.createElement('img');img.className='companion-follower';img.style.cssText='position:absolute;width:32px;height:42px;right:-17px;bottom:7px;pointer-events:none;image-rendering:pixelated;object-fit:contain';a.el.append(img);a._companionPet=img;}
      if(img.dataset.pet!==pet.id){img.dataset.pet=pet.id;img.src=pet.src;img.alt=pet.name;}
      if(staffPet){
        const layout=staffPetLayout[pet.asset],scale=Math.round(TTScene.size(a.y))/160;
        Object.assign(img.style,{width:layout.size*scale+'px',height:layout.size*112/96*scale+'px',left:'calc(50% + '+layout.x*scale+'px)',right:'auto',bottom:'auto',top:'calc(var(--tt-foot) + '+layout.y*scale+'px)'});
        const step=a._staffWalking?Math.sin(performance.now()/1000*17+a.seed+1):0;
        img.style.transform='translate(-50%,-100%) translateY('+Math.round(-Math.abs(step)*3)+'px) scaleX('+(a.faceLeft?-1:1)+')';
      }else{
        /* v407 玩家跟隨寵物：沿用試穿與 NPC 的寵物比例（以 160px 人物為基準），面向改變時左右鏡像 */
        const layout=staffPetLayout[pet.asset],sz=parseFloat(a.cv?.style.width)||Math.round(TTScene.size(a.y)),scale=sz/160,dir=a.faceLeft?-1:1;
        Object.assign(img.style,{width:layout.size*scale+'px',height:layout.size*112/96*scale+'px',left:'calc(50% + '+layout.x*scale*dir+'px)',right:'auto',bottom:'auto',top:'calc(var(--tt-foot) + '+layout.y*scale+'px)'});
        img.style.transform='translate(-50%,-100%) scaleX('+dir+')';
      }
    }
    return previousSetFrame(a,p);
  };
  let drinkCounts={},drinkUid=null;
  const drinkCompanions={pet_drink_ghost:{name:'縭',asset:'rira'},pet_drink_blue:{name:'蕪',asset:'kabuki'},pet_drink_sakura:{name:'桃',asset:'momo'}};
  const isDrink=id=>['pet_drink_blue','pet_drink_sakura','pet_drink_ghost'].includes(id);
  const category=k=>({front:'hair',back:'hair',cloth:'cloth',eye:'eye',brow:'eye',pet:'pet',seat:'seat',drink:'other'}[k]||(/^acc\d*$/.test(k)?'acc':null));
  const slotLabel={front:'瀏海',back:'後髮',cloth:'衣服',eye:'眼型',brow:'眉毛',pet:'寵物',seat:'座椅'};
  // 拆件使用繪師原圖；不修改商城商品、持有紀錄或舊穿搭。
  function partsFor(source){
    if(isDrink(source)){const c=window.__shopCfg?.[source];return c?.img?{drink:{n:drinkCompanions[source].name+'的飲料',d:c.img}}:{};}

    const parts=window.TTSeasonDrafts?.[source]?.parts||window.__shopCfg?.[source]?.parts||{};
    if(source==='cloth2'&&parts.acc)return {...parts,acc:{...parts.acc,n:'黑珠耳環',group:'ear'}};
    if(window.TTOutfitSplits?.[source])return {...parts,...window.TTOutfitSplits[source]};   // v441 心動情人衣服依原檔拆開
    if(source!=='season283_devil')return parts;
    const root='img/outfit-studio-v280/時裝-中華風小惡魔/';
    const part=(n,file,group,z)=>({n,d:root+file,x:0,y:0,g:0,group,z,independent:true});
    return {...parts,
      acc1:part('小惡魔蝴蝶結','0.中華風背後蝴蝶結.png','back','back'),
      acc2:{...part('紅寶石髮飾','2.中華風紅寶石髮飾.png','head','headTop'),requiresHair:['cloth0','season283_devil'],requirement:'限定髮型：波浪雙馬尾／中華風包包頭'},
      acc5:part('小惡魔翅膀','5.中華風小惡魔翅膀.png','back','back'),
      acc6:part('小惡魔角','8.中華風小惡魔角.png','head','headTop')};
  }
  const accessoryKey=p=>'accessory:'+(p.independent?p.source+':'+p.slot:p.group);
  function expandAccessories(refs,d){
    if(d?.uiAccessoryVersion>=287)return refs;
    return refs.flatMap(r=>r.source==='season283_devil'&&['acc1','acc2'].includes(r.slot)?[r,{source:r.source,slot:r.slot==='acc1'?'acc5':'acc6'}]:[r]);
  }
  function compatible(p,selection){
    if(p.requiresPart&&!Object.entries(selection).some(([key,r])=>key.startsWith('accessory:')&&r?.source===p.requiresPart.source&&r?.slot===p.requiresPart.slot))return false;
    if(!p.requiresHair)return true;
    const hair=selection.back;
    return !!hair&&(p.requiresHair.includes(hair.source)||(hair.base===0&&hair.slot==='back'));
  }
  function normalizeSelection(selection){
    const next={...selection};
    for(const [key,r] of Object.entries(next))if(key.startsWith('accessory:')&&r){const p=validPart(r);if(p&&!compatible(p,next))next[key]=null;}
    return next;
  }
  // v441 拆件後，舊穿搭（441 前保存）穿著某套衣服／眼睛時自動補上從中拆出的部件，外觀不變。
  function legacySplit(d,have=[]){
    if(!d||(d.uiAccessoryVersion||0)>=441)return [];
    const base=new Set(Array.isArray(d.uiBaseSlots)?d.uiBaseSlots:[]),out=[];
    for(const slot of ['cloth','eye']){const src=base.has(slot)?null:(d.ps?.[slot]||d.set);if(!src)continue;
      for(const [k,p] of Object.entries(partsFor(src)))if(p?.splitFrom===slot&&!have.some(r=>r.source===src&&r.slot===k))out.push({source:src,slot:k});}
    return out;
  }
  const wearKinds={bottom:'bottom',outer:'outer',glove:'glove'};
  const initialOutfitNames={cloth2:'啟程旅人',cloth3:'微風日常'};
  const displayPartName=name=>String(name||'').replace(/星夜吟遊裝/g,'啟程旅人').replace(/貓耳限定裝/g,'微風日常').replace(/[（(]\s*灰階\s*[）)]/g,'').replace(/灰階/g,'').trim();
  // v405：時裝部件單買。頭髮（瀏海＋後髮）、臉（眼型＋眉毛）、衣服、每件配件各為一個購買單位；
  // 售價由店長設定在 config/partPricing（可被商品 partPrices 覆蓋），網站不寫死價格。持有整套＝持有全部部件。
  let partPricing=null;try{db.ref(ROOT+'/config/partPricing').on('value',s=>{partPricing=s.val()||null;try{window.__dressRefresh?.()}catch(e){}})}catch(e){}
  // v421 工房初始部件單買價格（config/basePricing：hair 頭髮前後髮一起／face 眼睛＋眉毛／cloth 衣服／acc 配件），未設定就不開賣。
  window.__basePricing=null;try{db.ref(ROOT+'/config/basePricing').on('value',s=>{window.__basePricing=s.val()||null;try{window.__dressRefresh?.()}catch(e){}})}catch(e){}
  const baseSlotName={back:'back',front:'front',cloth:'cloth',face:'eye',brow:'brow',acc:'acc'};
  function baseProducts(){
    const units=window.TTBaseUnits?.list?.()||[],all=window.__allBaseParts?.()||{};
    return units.map(u=>{const price=window.__basePricing?.[u.kind],priced=Number.isSafeInteger(price)&&price>0,owned=!!window.TTBaseUnits.owned(u.id);
      const parts=u.parts.map(([sl,idx])=>{const item=all[sl]?.items?.find(x=>x.idx===idx);if(!item)return null;const slot=baseSlotName[sl];return {id:u.id+'::'+slot,base:idx,slot,name:displayPartName(item.n),category:slot==='acc'?'acc':category(slot),group:slot==='acc'?'head':null,owned:owned||window.TTBaseUnits.partOwned(sl,idx)===true};}).filter(Boolean);
      return parts.length?{id:u.id,name:u.name,type:'時裝',baseUnit:true,kind:u.kind,price:priced?price:null,sale:priced,owned:owned||parts.every(p=>p.owned),retired:false,previewOnly:false,highlightHair:false,doll:null,img:null,featured:0,sourceLayerCount:0,parts}:null;}).filter(Boolean);
  }
  const saleGroup=slot=>['front','back'].includes(slot)?'hair':['eye','brow'].includes(slot)?'face':slot==='cloth'?'cloth':/^acc\d*$/.test(slot)?slot:null;
  const saleKind=g=>['hair','face','cloth'].includes(g)?g:'acc';
  function partPrice(c,g,grp){const k=wearKinds[grp]||saleKind(g),v=c?.partPrices?.[g]??c?.partPrices?.[k]??partPricing?.[k];   // v443 單一配件可另訂價（有特效的部件 +30），鍵名 accN 與資料庫規則相同
  return Number.isSafeInteger(v)&&v>0?v:null;}
  function withPartSale(o,c,own){
    if(o.drink||o.pet||o.type!=='時裝'||o.id==='cloth0'||o.retired||o.noParts)return o;   // v445 noParts：限整套購買
    const buyable=o.sale&&!o.previewOnly;
    for(const p of o.parts){const g=saleGroup(p.slot);if(!g)continue;p.saleId=o.id+'::'+g;p.saleLabel=g==='hair'?'頭髮（瀏海＋後髮）':g==='face'?'臉（眼型＋眉毛）':p.name;p.owned=!!own[o.id]||!!own[p.saleId]||(!!p.splitFrom&&!!own[o.id+'::'+(p.splitFrom==='eye'?'face':p.splitFrom)]);p.salePrice=buyable?partPrice(c,g,p.group):null;}
    const units=o.parts.filter(p=>p.saleId);if(!o.owned&&units.length&&units.every(p=>p.owned))o.owned=true;
    if(o.owned)units.forEach(p=>p.owned=true);
    return o;
  }
  function catalog(){
    const shopCfg=window.__shopCfg||{},cfg={...shopCfg},own=window.__owned||{},now=Date.now();
    // v399：當季草稿保留原圖部件；店長上架後（shopConfig 有同編號且售價有效）才改用店長設定的售價與上架狀態。
    for(const [id,d] of Object.entries(window.TTSeasonDrafts||{})){const live=shopCfg[id];cfg[id]=live&&live.custom&&Number.isSafeInteger(live.price)&&live.price>0?{...d,price:live.price,active:live.active,start:live.start,end:live.end,vipOnly:d.vipOnly,noParts:d.noParts,img:live.img||d.img,partPrices:(d.partPrices||live.partPrices)?{...(d.partPrices||{}),...(live.partPrices||{})}:undefined,previewOnly:false}:d;}
    const base=(window.__outfitList?.()||[]).filter(o=>!window.TTSeasonDrafts?.[o.id]);
    const ids=new Set(base.map(o=>o.id));
    const pets=Object.keys(cfg).filter(id=>cfg[id]?.custom&&['寵物','其他'].includes(cfg[id]?.type)&&!ids.has(id)).map(id=>({id}));
    const seats=Object.entries(window.TTSeats?.CATALOG||{}).map(([id,c])=>{const s=TTSeatUI.state(id);return {id,name:c.name,type:'座椅',seat:true,owned:s.owned,sale:s.onSale,price:s.price,parts:[{id:id+'::seat',source:id,slot:'seat',category:'seat',name:c.name}]};});
    // v441 新套組在店長上架前只在預覽網址（?preview）顯示，客人看不到
    // v445 VIP 限定套組（vipOnly）：只有達到該 VIP 等級或已擁有的人看得到，上架前 VIP3 也能看到並免費二選一
    const previewMode=/[?&]preview/.test(location.search),vipLv=(()=>{try{return window.__vipInfo?.().lv||0}catch(e){return 0}})();
    const drafts=Object.keys(window.TTSeasonDrafts||{}).filter(id=>{const d=window.TTSeasonDrafts[id];if(previewMode||own[id])return true;if(d.vipOnly)return true;   // v460 使用者：VIP 套組先放出來給大家看（只能看、試穿；購買／領取仍限 VIP 等級）
      return !d.hideUntilLive||(shopCfg[id]?.custom&&Number.isSafeInteger(shopCfg[id]?.price)&&shopCfg[id].price>0);});
    return [...base,...pets,...drafts.map(id=>({id}))].map(o=>{
      const c=cfg[o.id]||{},retired=!!window.TTRetiredOutfits?.retired(o.id,{...o,...c}),sale=!retired&&(c.active===undefined?true:!!c.active)&&(!c.start||now>=c.start)&&(!c.end||now<c.end);
      const prod={id:o.id,name:isDrink(o.id)?drinkCompanions[o.id].name+'的飲料':initialOutfitNames[o.id]||c.name||o.nm,companion:drinkCompanions[o.id]||null,type:isDrink(o.id)?'其他':c.type||'時裝',drink:isDrink(o.id),pet:!!companionPets[o.id],price:c.price??o.pr,quantity:isDrink(o.id)&&drinkUid===window.TTVoiceOrders?.userId?.()?(drinkCounts[o.id]||0):0,owned:isDrink(o.id)?(drinkUid===window.TTVoiceOrders?.userId?.()&&(drinkCounts[o.id]||0)>0):o.id==='cloth0'||!!own[o.id],sale,retired,previewOnly:!!c.previewOnly,highlightHair:!!c.highlightHair,
        doll:c.doll||o.doll||null,img:c.img||null,featured:c.seasonFeatured||0,sourceLayerCount:c.sourceLayerCount||0,parts:Object.entries(partsFor(o.id)).filter(([k,p])=>category(k)&&p?.d).map(([k,p])=>({id:o.id+'::'+k,source:o.id,slot:k,name:displayPartName(p.n||((c.name||o.nm)+'・'+(slotLabel[k]||'配件'))),category:isDrink(o.id)||c.type==='其他'?'other':category(k),group:category(k)==='acc'?group(p,o.id,k):null,independent:!!p.independent,requiresHair:p.requiresHair,requiresPart:p.requiresPart,requirement:p.requirement,note:p.note,defaultEquipped:p.defaultEquipped,splitFrom:p.splitFrom}))};
      if(c.vipOnly){prod.vipOnly=c.vipOnly;prod.vipLocked=vipLv<c.vipOnly;prod.vipClaimable=!prod.vipLocked&&!prod.owned&&!own.vip3Outfit;prod.vipBuyable=!prod.vipLocked&&!prod.owned&&!!own.vip3Outfit;prod.price=500;prod.previewOnly=false;prod.sale=false;}   // v450 VIP 限定：價格 500 由伺服器收費，不走一般結帳
      if(c.noParts)prod.noParts=true;
      return withPartSale(prod,c,own);
    }).concat(seats,baseProducts());
  }
  function state(){const a=typeof me==='function'?me():null,doll=clone(a?.b?.doll||{back:0,front:0,cloth:0,face:0,acc:0,hair:0});if(Array.isArray(doll.uiAccessories))doll.uiAccessories.push(...legacySplit(doll,doll.uiAccessories));return {loggedIn:!!a,doll,catalog:catalog(),baseParts:window.__ownedParts?.()||{},colors:HAIRS.map(h=>h[0]),skins:SKINS.slice(),tickets:Number((window.__owned||{}).dyeTickets)||0,dyed:clone(Object.fromEntries(Object.entries((window.__owned||{}).dyedHairSets||{}).filter(([,s])=>![s.front,s.back].some(ref=>window.TTRetiredOutfits?.refRetired(ref,window.__shopCfg)))))};}
  function validPart(ref,owned=false,cache={}){if(!ref||typeof ref!=='object')return null;const o=(cache.items??=catalog()).find(o=>o.id===ref.source);const p=o&&!o.retired&&o.parts.find(p=>p.slot===ref.slot);return p&&(!owned||o.owned||p.owned)?p:undefined;}
  function makeDoll(selection,color,owned=false){
    const a=typeof me==='function'?me():null;
    const d=clone(a?.b?.doll||{back:0,front:0,cloth:0,face:0,acc:0,hair:0});
    if(!selection||typeof selection!=='object')throw Error('搭配資料不完整');
    const ps={},baseKeys=[],baseSlots={front:'front',back:'back',cloth:'cloth',eye:'face',brow:'brow',acc:'acc'};
    let changed=false,baseParts,allBase;const validation={};
    const usedGroups=new Set();
    for(const [slot,ref] of Object.entries(selection)){
      if(ref===null){if(['pet','seat'].includes(slot))baseKeys.push(slot);continue;}
      if(ref?.base!==undefined){
        // v421：保存時檢查持有；試穿預覽可以看未持有的工房部件（已下架的仍不行）
        const sl=baseSlots[slot]||slot,opts=(owned?(baseParts??=(window.__ownedParts?.()||{})):(allBase??=(window.__allBaseParts?.()||window.__ownedParts?.()||{})))[sl]?.items||[];
        if(!Number.isInteger(ref.base)||!opts.some(x=>x.idx===ref.base))throw Error('這個部件尚未取得');
        d[sl]=ref.base;baseKeys.push(slot);changed=true;continue;
      }
      const p=validPart(ref,owned,validation);if(!p)throw Error('搭配包含尚未取得或已移除的部件');if(isDrink(ref.source))throw Error('飲料不能穿戴');
      if(p.category==='acc'){
        const place=accessoryKey(p);
        if(slot!==place||usedGroups.has(place))throw Error('同一配件部位只能穿戴一件');
        if(!compatible(p,selection))throw Error(p.requirement);
        usedGroups.add(place);
      }else if(slot!==p.slot)throw Error('部件位置不正確');
      // 商城原配件鍵可能重複，實際組合另存於既有 doll 的自訂穿戴欄位。
      if(!slot.startsWith('accessory:'))ps[p.slot]=p.source;
      changed=true;
    }
    if(changed||Object.keys(selection).some(k=>k.startsWith('accessory:'))){delete d.set;d.ps=ps;d.uiBaseSlots=baseKeys;d.acc=Number.isInteger(selection.acc?.base)?selection.acc.base:0;d.uiAccessoryVersion=441;d.uiAccessories=Object.entries(selection).filter(([s,r])=>s.startsWith('accessory:')&&r).map(([,r])=>({source:r.source,slot:r.slot}));}
    if(color){
      if(Number.isInteger(color.hair)&&color.hair>=0&&color.hair<HAIRS.length){d.hair=color.hair;if(!color.keepOriginal){delete d.hairHex;delete d.hairHex2;delete d.hairHighlight;}}
      if(color.skin!==undefined){if(!Number.isInteger(color.skin)||color.skin<0||color.skin>=SKINS.length)throw Error('請選擇有效的膚色');d.skin=color.skin;}   // v440 背包可隨時換膚色
      if(color.highlight!==undefined){if(!Number.isInteger(color.highlight)||color.highlight<0||color.highlight>=HAIRS.length)throw Error('請選擇有效的挑染色');d.hairHighlight=HAIRS[color.highlight][0];}
      if(color.savedId){const saved=(window.__owned||{}).dyedHairSets?.[color.savedId];if(!saved)throw Error('找不到染色組合');
        const sameRef=(a,b)=>!!a&&!!b&&a.slot===b.slot&&(a.base!==undefined||b.base!==undefined?a.base===b.base:a.source===b.source);if(!sameRef(selection.front,saved.front)||!sameRef(selection.back,saved.back))throw Error('染色組合必須整組穿戴');d.hairHex=saved.main;d.hairHex2=saved.tail;d.dyedHairSet=color.savedId;if(saved.highlight)d.hairHighlight=saved.highlight;else delete d.hairHighlight;
      }else delete d.dyedHairSet;
    }
    return dollSafe(window.TTRetiredOutfits?.sanitize(d,window.__shopCfg)||d);
  }
  // 這份新穿戴資料才套用新部位規則；舊角色仍使用既有繪製方式。

  const oldPartDraw=csDrawV;
  csDrawV=function(g,p,hi,hx,hx2){const drawn=oldPartDraw(g,p,hi,hx,hx2);if(p?.highlight){const h=p.highlight;oldPartDraw(g,activeHighlight?{...h,g:1}:h,0,activeHighlight,null);}return drawn;};
  const oldAcc=csAccList,oldZ=csAccZ,oldDraw=drawDollTo,oldPick=csPick; let activeHighlight;
  csPick=function(d,key){if(isDrink(d?.ps?.[key]||d?.set))return null;if(Array.isArray(d?.uiBaseSlots)&&d.uiBaseSlots.includes(key))return null;if(key==='body'&&d?.ps&&!d.set&&!d.ps.body)return partsFor(d.ps.cloth).body||null;const draft=window.TTSeasonDrafts?.[d?.ps?.[key]||d?.set];return draft?.parts[key]||oldPick(d,key);};
  csAccList=function(d){
    if(!Array.isArray(d?.uiAccessories)){const extra=legacySplit(d).map(r=>partsFor(r.source)[r.slot]).filter(Boolean);return extra.length?[...oldAcc(d),...extra].sort((a,b)=>(a.drawOrder||0)-(b.drawOrder||0)):oldAcc(d);}
    const refs0=expandAccessories(d.uiAccessories,d),refs=[...refs0,...legacySplit(d,refs0)],hair=d.uiBaseSlots?.includes('back')?{base:d.back||0,slot:'back'}:{source:d.ps?.back||d.set,base:!d.ps?.back&&!d.set?d.back||0:undefined,slot:'back'};
    const worn={back:hair,...Object.fromEntries(refs.map(r=>{const p=partsFor(r.source)[r.slot];return [accessoryKey({...p,source:r.source,slot:r.slot}),r];}))};
    return refs.map(r=>{const p=partsFor(r.source)[r.slot];return p&&compatible(p,worn)?{...p,z:group(p,r.source,r.slot)==='head'&&!window.TTSeasonDrafts?.[r.source]?'headTop':p.z}:null;}).filter(Boolean).sort((a,b)=>(a.drawOrder||0)-(b.drawOrder||0));
  };
  csAccZ=function(p){return p?.z==='headTop'?'headTop':oldZ(p);};
  // 保留所有繪製參數，包含身體／頭髮動畫；不能只轉傳姿勢而畫成靜態。
  drawDollTo=function(cv,d,pose,...renderOptions){
    const previousHighlight=activeHighlight;activeHighlight=d?.hairHighlight;try{oldDraw(cv,d,pose,...renderOptions);}finally{activeHighlight=previousHighlight;}
    const pet=csPick(d,'pet');if(pet&&!followingPet(d))csDrawV(cv.getContext('2d'),pet,0);
    if(!Array.isArray(d?.uiAccessories))return;
    const parts=csAccBy(d,'headTop');if(!parts.length)return;
    const motion=renderOptions[0];
    if(motion&&window.TTHairMotion){
      const layer=document.createElement('canvas');layer.width=layer.height=64;
      const g=layer.getContext('2d');g.imageSmoothingEnabled=false;
      parts.forEach(p=>csDrawV(g,p,d.hair||0,d.hairHex,d.hairHex2));
      TTHairMotion.paint(cv.getContext('2d'),layer,motion,'rigid');
    }else parts.forEach(p=>csDrawV(cv.getContext('2d'),p,d.hair||0,d.hairHex,d.hairHex2));
  };
  async function wear(selection,color){
    const a=typeof me==='function'?me():null;if(!a||!db||!myKey)throw Error('先做一張闆卡，再保存穿搭');
    const d=makeDoll(selection,color,true);
    await db.ref(ROOT+'/lobby/'+myKey+'/doll').set(d);
    a.b.doll=d;if(a.frames)POSES.forEach(p=>{if(a.frames[p])drawDollTo(a.frames[p],d,p);});a.frame=null;setFrame(a,'idle');return true;
  }
  let dyeSaving=false;
  async function saveDye(selection,draft,requestId){
    if(dyeSaving)throw Error('染色正在保存，請稍候');
    const a=typeof me==='function'?me():null,key=myKey;
    if(!a||!db||!key)throw Error('先登入自己的闆卡，再保存染髮');
    if(!/^dye_[a-zA-Z0-9_-]{8,80}$/.test(requestId||''))throw Error('請重新開啟染髮頁面');
    if(!draft||!/^#[0-9a-f]{6}$/i.test(draft.main)||!/^#[0-9a-f]{6}$/i.test(draft.tail))throw Error('請選擇有效的主色與髮尾色');
    if(draft.highlight!==undefined&&!/^#[0-9a-f]{6}$/i.test(draft.highlight))throw Error('請選擇有效的挑染色');
    if(!selection?.front||!selection?.back)throw Error('請先選好瀏海與後髮');
    makeDoll(selection,{},true);
    const record={name:String(draft.name||'專屬染髮').trim().slice(0,24)||'專屬染髮',front:clone(selection.front),back:clone(selection.back),main:draft.main.toLowerCase(),tail:draft.tail.toLowerCase()};
    if(draft.highlight)record.highlight=draft.highlight.toLowerCase();
    const same=s=>s&&(s.highlight||null)===(record.highlight||null)&&['name','main','tail'].every(k=>s[k]===record[k])&&['front','back'].every(k=>{const a=s[k],b=record[k];return !!a&&!!b&&a.slot===b.slot&&(a.base!==undefined||b.base!==undefined?a.base===b.base:a.source===b.source);});
    const ownedRef=db.ref(ROOT+'/owned/'+key);let reason='保存未完成，請再試一次';
    dyeSaving=true;
    try{
      // v-sec2: 扣券與新增組合放在同一筆多路徑更新。資料庫規則只允許「券數剛好減 1＋同時新增這筆組合」，
      // 兩個分頁同時保存時較晚的一筆會被拒絕，不會一張券用兩次；重試同一請求不重複扣券。
      const own=(await ownedRef.once('value')).val()||{};
      if(myKey!==key)throw Error('帳號已切換，請重新開啟背包');
      const existing=own.dyedHairSets?.[requestId];
      if(existing&&!same(existing))throw Error('這次染色資料已變更，請重新開啟染髮');
      if(!existing){
        if([record.front,record.back].some(r=>r.source&&r.source!=='cloth0'&&!own[r.source]&&!own[r.source+'::hair']))throw Error('這個髮型尚未取得');
        if(!Number.isSafeInteger(own.dyeTickets)||own.dyeTickets<1)throw Error('染髮券不足，預覽不會扣券');
        try{await ownedRef.update({dyeTickets:own.dyeTickets-1,dyeLast:requestId,['dyedHairSets/'+requestId]:{...record,at:Date.now()}});}
        catch(e){reason=String(e?.code||e?.message||'').toUpperCase().includes('PERMISSION')?'染髮券數量剛剛有變動（可能在其他分頁使用了），請重新開啟染髮再試一次':(e?.message||reason);}
      }
      const saved=(await ownedRef.once('value')).val();
      if(!saved?.dyedHairSets?.[requestId])throw Error(reason);
      if(!same(saved?.dyedHairSets?.[requestId]))throw Error('尚未確認保存結果，請重試');
      if(myKey===key)window.__owned=saved;
      return {id:requestId,tickets:saved.dyeTickets};
    }finally{dyeSaving=false;}
  }
  const previewJobs=new WeakMap(),imageJobs=new Map();
  function afterPreviewImages(cv,sources,draw){const token={};previewJobs.set(cv,token);const pending=[...new Set(sources.filter(Boolean))].map(src=>{const image=csImg(src);if(image.complete&&image.naturalWidth)return null;if(!imageJobs.has(src))imageJobs.set(src,new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}));return imageJobs.get(src);}).filter(Boolean);if(pending.length)Promise.all(pending).then(()=>{if(previewJobs.get(cv)===token&&cv.isConnected)draw();});}
  function drawPreview(cv,d,onDraw){const sources=[];for(const source of new Set([d.set,...Object.values(d.ps||{}),...(d.uiAccessories||[]).map(p=>p.source)])){for(const p of Object.values(partsFor(source)))if(p?.d){sources.push(p.d);if(p.highlight?.d)sources.push(p.highlight.d);}}const source=cv.dataset.fixedPixelPreview?document.createElement('canvas'):cv;if(source!==cv)source.width=source.height=64;const draw=()=>{drawDollTo(source,d,'idle');onDraw?.(source);};draw();afterPreviewImages(cv,sources,draw);}
  window.TinyTavernUI={followingPet,async refreshDrinks(){const uid=window.TTVoiceOrders?.userId?.();if(!uid){drinkCounts={};drinkUid=null;return;}const r=await window.TTVoiceOrders.drinks({action:'list'});if(uid!==window.TTVoiceOrders.userId())return;drinkUid=uid;drinkCounts=r.inventory;},
    async drinkAction(action,itemId,quantity){if(!isDrink(itemId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>99)throw Error('杯數有誤');const uid=window.TTVoiceOrders?.userId?.();if(!uid)throw Error('請先登入 Discord');const storageKey='tt_drink_pending_'+uid;let pending;try{pending=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{}if(pending&&(pending.action!==action||pending.itemId!==itemId||pending.quantity!==quantity))throw Error('上一筆結果尚未確認，請先以原杯數重試。');pending??={action,itemId,quantity,requestId:crypto.randomUUID()};localStorage.setItem(storageKey,JSON.stringify(pending));try{const result=await window.TTVoiceOrders.drinks(pending);localStorage.removeItem(storageKey);drinkUid=uid;drinkCounts[itemId]=result.remaining;if(action==='feed'&&uid===window.TTVoiceOrders.userId()&&result.message){const petId={pet_drink_ghost:'pet_guigui',pet_drink_blue:'pet_bubu',pet_drink_sakura:'pet_dengdeng'}[itemId];const cid=Object.keys(staffPets).find(id=>staffPets[id]===petId);if(cid)showNpcDrinkThanks(cid,result.message);}return result;}catch(e){if(['INSUFFICIENT_DRINKS','INSUFFICIENT_BALANCE','INVALID_REQUEST','PRODUCT_UNAVAILABLE','ACCOUNT_REQUIRED'].includes(e.code))localStorage.removeItem(storageKey);throw e;}},
    drinkName:()=>String(me()?.b?.name||'老闆').slice(0,60),open,close,isActive:()=>active,staff,state,group,makeDoll,wear,saveDye,accessoryKey,expandAccessories,compatible,normalizeSelection,displayPartName,
    idlePose:now=>_hairMotionPreference.matches?{sqx:1,sqy:1}:ttIdlePose(now??performance.now(),me()?.seed||0),previewFoot:cv=>TTScene.metrics({cv}),
    collection:()=>ACH_DEF.filter(a=>TT_STATS.u.includes(a.id)||!!(a.k&&(TT_STATS[a.k]||0)>=a.need)).map(a=>({id:a.id,name:a.n,description:a.d,image:AICON[a.ic],source:'酒館成就',kind:'成就紀錄'})),
    calendar:cid=>calWeekHtml(cid),booked:cid=>new Promise(resolve=>staffBookedTimes(cid,resolve)),
    draw:drawPreview,fx:{active:d=>window.TTOutfitFx?.active(d)||[],render:(src,t,list)=>window.TTOutfitFx.render(src,t,list)},
    // v467 闆卡手帳圖鑑：沒有展示圖的時裝改畫人物（整套部件＋當季展示髮色），特效由手帳自己播放
    outfitDoll(id){const o=catalog().find(x=>x.id===id&&!x.retired&&!x.drink&&!x.pet&&!x.seat&&!x.baseUnit);if(!o?.parts?.length)return null;const sel={};
      for(const p of o.parts){if(p.defaultEquipped===false)continue;const k=p.category==='acc'?accessoryKey(p):p.slot;if(p.category==='acc'||['front','back','cloth','eye','brow'].includes(p.slot))sel[k]={source:o.id,slot:p.slot};}
      let d;try{d=makeDoll(normalizeSelection(sel),{hair:o.doll?.hair||0});}catch(e){return null;}
      const c=window.TTSeasonDisplay?.[id],hex=v=>/^#[0-9a-f]{6}$/i.test(v||'');if(c&&hex(c.main)){d.hairHex=c.main;if(hex(c.tail))d.hairHex2=c.tail;else delete d.hairHex2;if(hex(c.highlight))d.hairHighlight=c.highlight;}
      delete d.ps?.pet;if(d.uiBaseSlots&&!d.uiBaseSlots.includes('pet'))d.uiBaseSlots.push('pet');return d;},   // v443 時裝特效
seatChoice:()=>window.TTSeatUI?.choice(),selectSeat:id=>window.TTSeatUI?.select(id),seatThumb:(id,cv)=>window.TTSeatUI?.thumb(id,cv),
    drawPart(cv,ref,color){if(ref.slot==='seat'&&Object.hasOwn(window.TTSeats?.CATALOG||{},ref.source)){TTSeatUI.thumb(ref.source,cv);return;}const g=cv.getContext('2d');g.clearRect(0,0,64,64);g.imageSmoothingEnabled=false;
      if(ref.slot==='pet'&&companionPets[ref.source]){const pet=companionPets[ref.source],src='img/companions-v352/'+pet.asset+'-pet.gif?v=356',img=csImg(src),[left,top,right,bottom]=pet.bounds;const draw=()=>{g.clearRect(0,0,cv.width,cv.height);if(!img.complete||!img.naturalWidth)return;const scale=Math.min((cv.width-8)/(right-left),(cv.height-8)/(bottom-top)),w=(right-left)*scale,h=(bottom-top)*scale;g.drawImage(img,left,top,right-left,bottom-top,(cv.width-w)/2,(cv.height-h)/2,w,h);};draw();afterPreviewImages(cv,[src],draw);return;}
      if(ref.base!==undefined&&ref.slot==='acc'){const ap=TACCP[ref.base];if(ap)['b','m','f','t'].forEach(k=>accLayer(g,ap[k],color?.hair||0,color?.hairHex));}
      else if(ref.base!==undefined){const key={front:'前髮',back:'後髮',cloth:'衣服',eye:'眼睛',brow:'眉毛'}[ref.slot];const p=TP.parts[key]?.[ref.base];if(p)tpDraw(g,p,color?.hair||0);}
      else{const p=partsFor(ref.source)[ref.slot];if(p){const preview=ref.slot==='pet'&&p.preview?{...p,d:p.preview,x:0,y:0}:p;const draw=()=>{g.clearRect(0,0,64,64);const previousHighlight=activeHighlight;activeHighlight=Number.isInteger(color?.highlight)?HAIRS[color.highlight]?.[0]:color?.keepOriginal?me()?.b?.doll?.hairHighlight:null;try{csDrawV(g,preview,color?.hair||0,color?.hairHex,color?.hairHex2);}finally{activeHighlight=previousHighlight;}};draw();afterPreviewImages(cv,[preview.d,...(p.highlight?.d?[p.highlight.d]:[])],draw);}}
    },
    choose(ids,mode){
      const keys=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean))];
      const members=keys.map(cid=>{const s=STAFF_ALL[cid],c=STAFF_CARDS[cid]||{};if(!s||(mode==='now'&&(!s.on||s.busy))||(mode==='book'&&c.noBooking))throw Error('冒險者狀態已更新，請重新選擇');return {cid,name:s.name||'冒險者',theme:THEMES[cid]||null};});
      pkMode=mode;selStaff=members.length?{cid:members.length===1?members[0].cid:null,name:members.map(p=>p.name).join('、'),members}:null;
      close();shopOpen(2,'play');
    },
    originalInfo(cid){const s=staff().find(s=>s.cid===cid);if(s){close();oldInfo(cid,{name:s.name,st:s.on?(s.busy?'busy':'free'):'off'},0);}},
    openChatSkins(){close();window.openChatSkins();},
    buy(source){if(isDrink(source))throw Error('請在其他分類選擇飲料杯數');if(/^[^:]+::(hair|face|cloth|acc\d*)$/.test(String(source))){const sid=source.split('::')[0],o=catalog().find(x=>x.id===sid),part=o?.parts.find(p=>p.saleId===source);if(!o||o.retired)throw Error('這套時裝已下架');if(!o.sale||o.previewOnly)throw Error('這套時裝目前開放試穿，售價尚未設定');if(!part||!part.salePrice)throw Error('這個部件尚未開放單買');if(o.owned||part.owned)throw Error('這個部件已在背包裡');close();curKind='shop';curBooking=false;curReserveAt=null;curPlan={id:source,n:'時裝部件・'+o.name+'・'+part.saleLabel,p:part.salePrice,itemId:source,itemName:o.name+'・'+part.saleLabel};shopClose();shopOpen(3);return;}const o=catalog().find(x=>x.id===source);if(o?.retired)throw Error('這套測試時裝已下架');if(!o||!o.sale||o.previewOnly)throw Error('這套時裝目前開放試穿，售價尚未設定');if(o.owned)throw Error('這件商品已在背包裡');close();curKind='shop';curBooking=false;curReserveAt=null;curPlan={id:o.id,n:o.baseUnit?'工房部件・'+o.name+(o.kind==='hair'?'（前髮＋後髮）':o.kind==='face'&&o.parts.length>1?'（眼睛＋眉毛）':''):(['寵物','其他','座椅'].includes(o.type)?o.type+'・':'時裝・')+o.name,p:o.price,itemId:o.id,itemName:o.name};shopClose();shopOpen(3);},
    /* v258:染髮券商品(一張全包主色+漸層;價格可由店長在商城新增 id 為 dyeTicket 的商品覆蓋,預設 299) */
    dyePrice(){return Number(window.__shopCfg?.dyeTicket?.price)||299;},
    buyDye(){if(typeof me!=='function'||!me())throw Error('先做一張闆卡，再購買染髮券');close();curKind='shop';curBooking=false;curReserveAt=null;const p=this.dyePrice();curPlan={id:'dyeTicket',n:'染髮券 1 張',p,itemId:'dyeTicket',itemName:'染髮券 1 張'};shopClose();shopOpen(3);},
    staffDm(cid){const p=staff().find(s=>s.cid===cid);close();setTimeout(()=>window.staffDmOpen?.(cid,p?.name||'冒險者'),60);},
    originalWard(){close();oldWard?.();},
    originalDress(){close();oldDress?.();}
  };
  shopStep=function(kind){if(kind==='play'){selStaff=null;pkMode='now';open('roster');}else oldStep(kind);};
  window.ttAfterDyeTicket=function(){let pending=null;try{pending=JSON.parse(sessionStorage.getItem('tt_dye_pending_v408')||'null');}catch(e){}if(!pending||Date.now()-pending.at>1800000)return;
    setTimeout(()=>{try{open('shop');}catch(e){return;}let n=0;const t=setInterval(()=>{n++;try{const ui=document.querySelector('#ttApprovedUI iframe')?.contentDocument;const w=ui?.getElementById('shopFrame')?.contentWindow;if(w&&typeof w.ttResumeDye==='function'&&w.ttResumeDye()){clearInterval(t);return;}}catch(e){}if(n>48)clearInterval(t);},250);},1200);};
  shopOpen=function(step,kind){if(step===2&&(kind||curKind)==='shop'){open('shop');return;}return oldShopOpen(step,kind);};
  if(oldBookOpen)window.bookOpen=function(tab){if(tab==='ward'){open('bag');return;}return oldBookOpen(tab);};
  if(oldBookGo)window.bkGo=function(tab){if(tab==='ward'){open('bag');return;}return oldBookGo(tab);};
  backFromPlans=function(){if(curKind==='play')open('roster');else if(curKind==='shop')open('shop');else oldBack();};
  openPcInfo=function(cid,info,i){if(THEMES[cid])open('profile',cid);else oldInfo(cid,info,i);};
  document.getElementById('dressBtn').onclick=()=>open('shop');
  window.openWardrobe=()=>open('bag');
  document.getElementById('wardBtn').onclick=()=>open('bag');
  window.__openDressAt=()=>open('shop');
  document.addEventListener('keydown',e=>{if(active&&e.key==='Escape')close();});
})();
