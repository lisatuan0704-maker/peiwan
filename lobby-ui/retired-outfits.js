/* Retired copyright-test outfits: retain legacy render data, never offer for sale. */
(function(root){
 'use strict';
 const ids=new Set(['cloth0','cloth1']),names=/露亞|小莓/;
 function retired(id,item){return ids.has(id)||!!item&&(names.test(item.name||item.nm||'')||Object.values(item.parts||{}).some(p=>names.test(p?.n||''))||(!Object.keys(item.parts||{}).length&&Object.entries(item.doll||{}).some(([sl,i])=>baseRetired(sl,i))));}
 function baseRetired(slot,index){return ({back:[0,1],front:[0,1],cloth:[0,1,2],face:[0,1],eye:[0,1],acc:[1,2,3,4,5,6]}[slot]||[]).includes(index);}
 function refRetired(ref,cfg){return !!ref&&(ref.base!==undefined?baseRetired(ref.slot,ref.base):retired(ref.source,cfg?.[ref.source]));}
 function sanitize(doll,cfg={}){
  const d=JSON.parse(JSON.stringify(doll||{}));
  if(retired(d.set,cfg[d.set]))delete d.set;
  if(d.ps)d.ps=Object.fromEntries(Object.entries(d.ps).filter(([,id])=>!retired(id,cfg[id])));
  if(d.uiAccessories)d.uiAccessories=d.uiAccessories.filter(r=>!refRetired(r,cfg));
  for(const [slot,native,fallback]of [['back','back',3],['front','front',3],['eye','face',3],['cloth','cloth',3]]){
   const source=d.uiBaseSlots?.includes(slot)?null:d.ps?.[slot]||d.set;
   if(!source&&baseRetired(native,d[native]||0))d[native]=fallback;
  }
  if(baseRetired('acc',d.acc))d.acc=0;
  return d;
 }
 root.TTRetiredOutfits=Object.freeze({retired,baseRetired,refRetired,sanitize});
})(typeof window==='undefined'?globalThis:window);
