/* 正式站介面接線：資料由既有網站供應，選購沿用原結帳流程。 */
(() => {
  'use strict';
  const oldStep=shopStep, oldInfo=openPcInfo, oldWard=window.openWardrobe, oldBack=backFromPlans, oldShopOpen=shopOpen;
  const oldBookOpen=window.bookOpen, oldBookGo=window.bkGo;
  const oldDress=document.getElementById('dressBtn').onclick;
  const THEMES={'-OxY46ezlpnRt64hUIw9':'KABUKI','-OxY7C4vDkgsr1zcyWbk':'RIRA','-OzbfbQcF6J6fIR6YYGh':'MOMO'};
  let frame, overlay, trigger, pending, active=false;
  const clone=x=>JSON.parse(JSON.stringify(x));
  function close(){if(overlay)overlay.hidden=true;active=false;trigger?.focus?.();}
  function open(view='roster',cid=null){
    trigger=document.activeElement;pending={view,cid,mode:pkMode};active=true;
    if(!overlay){
      overlay=document.createElement('div');overlay.id='ttApprovedUI';overlay.hidden=true;
      overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Tiny Tavern');
      frame=document.createElement('iframe');frame.title='Tiny Tavern 名簿與時裝間';
      frame.src='tavern-ui/index.html?v=213';overlay.append(frame);document.body.append(overlay);
      frame.onload=()=>{frame.contentWindow.ttLiveOpen?.(pending);};
      overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    }
    shopClose();try{gClose('pcM');gClose('wardM');if(typeof bookClose==='function')bookClose();}catch(_){}
    document.getElementById('dressM').style.display='none';overlay.hidden=false;
    frame.contentWindow.ttLiveOpen?.(pending);frame.focus();
  }
  function staff(){return Object.entries(STAFF_ALL).filter(([,s])=>s).map(([cid,s])=>({cid,theme:THEMES[cid]||null,name:s.name||'店員',on:!!s.on,busy:!!s.busy,card:clone(STAFF_CARDS[cid]||{})}));}
  function group(part,source,key){
    const known={'cloth0:acc1':'hand','cloth0:acc2':'head','cloth0:acc3':'head','cloth3:acc1':'hand','cloth3:acc2':'ear','cloth3:acc3':'head','cloth2:acc2':'face','cloth2:acc3':'hand'};
    if(known[source+':'+key])return known[source+':'+key];
    const n=String(part?.n||'');
    if(/耳環|耳飾/.test(n))return 'ear';
    if(/髮|頭|冠|帽|貓耳|獸耳|蝴蝶結|角/.test(n))return 'head';
    if(/眼鏡|面|口罩|眼罩|腮紅/.test(n))return 'face';
    if(/尾巴|背|翅膀|披風/.test(n))return 'back';
    return 'hand';
  }
  const category=k=>({front:'hair',back:'hair',cloth:'cloth',eye:'eye',pet:'pet',seat:'seat'}[k]||(/^acc\d*$/.test(k)?'acc':null));
  const slotLabel={front:'瀏海',back:'後髮',cloth:'衣服',eye:'眼神',pet:'寵物',seat:'座椅'};
  function catalog(){
    const cfg=window.__shopCfg||{},own=window.__owned||{},now=Date.now();
    return (window.__outfitList?.()||[]).map(o=>{
      const c=cfg[o.id]||{},sale=(c.active===undefined?true:!!c.active)&&(!c.start||now>=c.start)&&(!c.end||now<c.end);
      return {id:o.id,name:c.name||o.nm,price:c.price??o.pr,owned:o.id==='cloth0'||!!own[o.id],sale,
        doll:o.doll||null,img:c.img||null,parts:Object.entries(c.parts||{}).filter(([k,p])=>category(k)&&p?.d).map(([k,p])=>({id:o.id+'::'+k,source:o.id,slot:k,name:p.n||((c.name||o.nm)+'・'+(slotLabel[k]||'配件')),category:category(k),group:category(k)==='acc'?group(p,o.id,k):null}))};
    });
  }
  function state(){const a=typeof me==='function'?me():null;return {loggedIn:!!a,doll:clone(a?.b?.doll||{back:0,front:0,cloth:0,face:0,acc:0,hair:0}),catalog:catalog(),baseParts:window.__ownedParts?.()||{},colors:HAIRS.map(h=>h[0]),tickets:Number((window.__owned||{}).dyeTickets)||0,dyed:clone((window.__owned||{}).dyedHairSets||{})};}
  function validPart(ref,owned=false){if(!ref||typeof ref!=='object')return null;const o=catalog().find(o=>o.id===ref.source);return o&&(!owned||o.owned)&&o.parts.find(p=>p.slot===ref.slot);}
  function makeDoll(selection,color,owned=false){
    const a=typeof me==='function'?me():null;
    const d=clone(a?.b?.doll||{back:0,front:0,cloth:0,face:0,acc:0,hair:0});
    if(!selection||typeof selection!=='object')throw Error('搭配資料不完整');
    const ps={},baseKeys=[],baseSlots={front:'front',back:'back',cloth:'cloth',eye:'face',brow:'brow'};
    let changed=false;
    const usedGroups=new Set();
    for(const [slot,ref] of Object.entries(selection)){
      if(ref===null)continue;
      if(ref?.base!==undefined){
        const sl=baseSlots[slot]||slot,opts=window.__ownedParts?.()[sl]?.items||[];
        if(!Number.isInteger(ref.base)||!opts.some(x=>x.idx===ref.base))throw Error('這個部件尚未取得');
        d[sl]=ref.base;baseKeys.push(slot);changed=true;continue;
      }
      const p=validPart(ref,owned);if(!p)throw Error('搭配包含尚未取得或已移除的部件');
      if(p.category==='acc'){
        if(slot!=='accessory:'+p.group||usedGroups.has(p.group))throw Error('同一配件部位只能穿戴一件');
        usedGroups.add(p.group);
      }else if(slot!==p.slot)throw Error('部件位置不正確');
      // 商城原配件鍵可能重複，實際組合另存於既有 doll 的自訂穿戴欄位。
      if(!slot.startsWith('accessory:'))ps[p.slot]=p.source;
      changed=true;
    }
    if(changed){delete d.set;d.ps=ps;d.uiBaseSlots=baseKeys;d.acc=0;d.uiAccessories=Object.entries(selection).filter(([s,r])=>s.startsWith('accessory:')&&r).map(([,r])=>({source:r.source,slot:r.slot}));}
    if(color){
      if(Number.isInteger(color.hair)&&color.hair>=0&&color.hair<HAIRS.length){d.hair=color.hair;if(!color.keepOriginal){delete d.hairHex;delete d.hairHex2;}}
      if(color.savedId){const saved=(window.__owned||{}).dyedHairSets?.[color.savedId];if(!saved)throw Error('找不到染色組合');
        const refs=JSON.stringify([selection.front,selection.back]);if(refs!==JSON.stringify([saved.front,saved.back]))throw Error('染色組合必須整組穿戴');d.hairHex=saved.main;d.hairHex2=saved.tail;d.dyedHairSet=color.savedId;
      }else delete d.dyedHairSet;
    }
    return dollSafe(d);
  }
  // 這份新穿戴資料才套用新部位規則；舊角色仍使用既有繪製方式。
  const oldAcc=csAccList,oldZ=csAccZ,oldDraw=drawDollTo,oldPick=csPick;
  csPick=function(d,key){return Array.isArray(d?.uiBaseSlots)&&d.uiBaseSlots.includes(key)?null:oldPick(d,key);};
  csAccList=function(d){if(!Array.isArray(d?.uiAccessories))return oldAcc(d);return d.uiAccessories.map(r=>{const p=window.__shopCfg?.[r.source]?.parts?.[r.slot];return p?{...p,z:group(p,r.source,r.slot)==='head'?'headTop':p.z}:null;}).filter(Boolean);};
  csAccZ=function(p){return p?.z==='headTop'?'headTop':oldZ(p);};
  drawDollTo=function(cv,d,pose){oldDraw(cv,d,pose);if(Array.isArray(d?.uiAccessories))csAccBy(d,'headTop').forEach(p=>csDrawV(cv.getContext('2d'),p,d.hair||0,d.hairHex,d.hairHex2));};
  async function wear(selection,color){
    const a=typeof me==='function'?me():null;if(!a||!db||!myKey)throw Error('先做一張闆卡，再保存穿搭');
    const d=makeDoll(selection,color,true);
    await db.ref(ROOT+'/lobby/'+myKey+'/doll').set(d);
    a.b.doll=d;if(a.frames)POSES.forEach(p=>{if(a.frames[p])drawDollTo(a.frames[p],d,p);});a.frame=null;setFrame(a,'idle');return true;
  }
  window.TinyTavernUI={open,close,isActive:()=>active,staff,state,group,makeDoll,wear,
    calendar:cid=>calWeekHtml(cid),booked:cid=>new Promise(resolve=>staffBookedTimes(cid,resolve)),
    draw:(cv,d)=>drawDollTo(cv,d,'idle'),
    drawPart(cv,ref,color){const g=cv.getContext('2d');g.clearRect(0,0,64,64);g.imageSmoothingEnabled=false;
      if(ref.base!==undefined){const key={front:'前髮',back:'後髮',cloth:'衣服',eye:'眼睛',brow:'眉毛'}[ref.slot];const p=TP.parts[key]?.[ref.base];if(p)tpDraw(g,p,color?.hair||0);}
      else{const p=window.__shopCfg?.[ref.source]?.parts?.[ref.slot];if(p)csDrawV(g,p,color?.hair||0,color?.hairHex,color?.hairHex2);}
    },
    choose(cid,mode){const s=STAFF_ALL[cid],c=STAFF_CARDS[cid]||{};if(cid&&(!s||(mode==='now'&&(!s.on||s.busy))||(mode==='book'&&c.noBooking)))throw Error('店員狀態已更新，請重新選擇');pkMode=mode;selStaff=cid?{cid,name:s.name||'店員'}:null;close();shopOpen(2,'play');},
    originalInfo(cid){const s=staff().find(s=>s.cid===cid);if(s){close();oldInfo(cid,{name:s.name,st:s.on?(s.busy?'busy':'free'):'off'},0);}},
    buy(source){const o=catalog().find(x=>x.id===source);if(!o||!o.sale)throw Error('商品目前未開放選購');if(o.owned)throw Error('這件商品已在背包裡');close();curKind='shop';curBooking=false;curReserveAt=null;curPlan={id:o.id,n:'時裝・'+o.name,p:o.price,itemId:o.id,itemName:o.name};shopClose();shopOpen(3);},
    originalWard(){close();oldWard?.();},
    originalDress(){close();oldDress?.();}
  };
  shopStep=function(kind){if(kind==='play'){selStaff=null;pkMode='now';open('roster');}else oldStep(kind);};
  shopOpen=function(step,kind){if(step===2&&(kind||curKind)==='shop'){open('shop');return;}return oldShopOpen(step,kind);};
  if(oldBookOpen)window.bookOpen=function(tab){if(tab==='ward'){open('bag');return;}return oldBookOpen(tab);};
  if(oldBookGo)window.bkGo=function(tab){if(tab==='ward'){open('bag');return;}return oldBookGo(tab);};
  backFromPlans=function(){if(curKind==='play')open('roster');else if(curKind==='shop')open('shop');else oldBack();};
  openPcInfo=function(cid,info,i){if(THEMES[cid])open('profile',cid);else oldInfo(cid,info,i);};
  document.getElementById('dressBtn').onclick=()=>open('shop');
  window.openWardrobe=()=>open('bag');
  window.__openDressAt=()=>open('shop');
  document.addEventListener('keydown',e=>{if(active&&e.key==='Escape')close();});
})();
