/* Independent scene editor. No account or database connections. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),W=1600,H=900,storageKey='tt-npc-layout-v1';
 const people=[
  {asset:'kabuki',cid:'-OxY46ezlpnRt64hUIw9',name:'蕪',bottom:104,pet:{size:123,x:86,y:22},initial:{x:551,y:438,mirror:false}},
  {asset:'rira',cid:'-OxY7C4vDkgsr1zcyWbk',name:'縭',bottom:104,pet:{size:133,x:-93,y:-4},initial:{x:307,y:777,mirror:false}},
  {asset:'momo',cid:'-OzbfbQcF6J6fIR6YYGh',name:'桃',bottom:106,pet:{size:125,x:-89,y:-51},initial:{x:1398,y:466,mirror:true}}
 ];
 let settings=Object.fromEntries(people.map(p=>[p.asset,{...p.initial}])),selected='momo',scale=1,drag=null;
 const nodes=new Map();
 function parse(value){
  if(value?.version!==1||value?.coordinateSystem!=='1600x900'||value?.anchor!=='feet'||!Array.isArray(value.npcs)||value.npcs.length!==people.length)throw Error('請選擇這個調整頁匯出的 NPC 站位設定。');
  return Object.fromEntries(people.map(p=>{const matches=value.npcs.filter(n=>n.id===p.cid);if(matches.length!==1)throw Error('設定缺少角色，或角色重複。');const n=matches[0];if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||n.x<0||n.x>W||n.y<0||n.y>H||typeof n.mirror!=='boolean')throw Error('位置或鏡像設定不正確。');return [p.asset,{x:Math.round(n.x),y:Math.round(n.y),mirror:n.mirror}];}));
 }
 function documentValue(){return {version:1,coordinateSystem:'1600x900',anchor:'feet',npcs:people.map(p=>({id:p.cid,name:p.name,asset:p.asset,...settings[p.asset]}))};}
 try{const saved=localStorage.getItem(storageKey);if(saved)settings=parse(JSON.parse(saved));}catch{$('saveState').textContent='暫時無法讀取先前設定；請用匯入或下載保留調整。';}
 TTScene.mount($('world'));
 function point(e){const r=$('world').getBoundingClientRect();return {x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale};}
 function select(asset){selected=asset;render();}
 function move(x,y){settings[selected].x=Math.round(Math.max(0,Math.min(W,x)));settings[selected].y=Math.round(Math.max(0,Math.min(H,y)));render();save();}
 function save(){const json=JSON.stringify(documentValue(),null,2);$('json').value=json;try{localStorage.setItem(storageKey,json);$('saveState').textContent='已自動儲存在這個瀏覽器。調好後可下載設定。';}catch{$('saveState').textContent='瀏覽器無法儲存，請下載設定以免遺失。';}}
 for(const p of people){
  const button=document.createElement('button');button.type='button';button.className='edit-npc';button.setAttribute('aria-label',p.name+'，拖曳調整站位');button.dataset.npc=p.asset;
  button.innerHTML='<span class="shadow"></span><img class="sprite" src="img/companions-v352/'+p.asset+'-staff.gif" alt="" draggable="false"><img class="pet" src="img/companions-v352/'+p.asset+'-pet.gif" alt="" draggable="false"><span class="led">離線中</span><span class="name">☆ '+p.name+'</span><span class="foot-marker"></span>';
  $('world').append(button);nodes.set(p.asset,button);
  button.addEventListener('pointerdown',e=>{if(e.button!==0)return;select(p.asset);const q=point(e),c=settings[p.asset];drag={id:e.pointerId,asset:p.asset,dx:q.x-c.x,dy:q.y-c.y};button.setPointerCapture(e.pointerId);button.focus({preventScroll:true});e.preventDefault();});
  button.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const q=point(e);move(q.x-drag.dx,q.y-drag.dy);});
  const end=e=>{if(drag?.id===e.pointerId){drag=null;if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);}};
  button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',()=>drag=null);
  button.addEventListener('click',()=>select(p.asset));
  button.addEventListener('keydown',e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();select(p.asset);const c=settings[selected],step=e.shiftKey?10:1;move(c.x+delta[0]*step,c.y+delta[1]*step);});
  const choice=document.createElement('button');choice.type='button';choice.dataset.choice=p.asset;choice.setAttribute('aria-label','選擇'+p.name);choice.innerHTML='<img src="img/companions-v352/'+p.asset+'-staff.gif" alt="" draggable="false"><span>'+p.name+'</span>';choice.onclick=()=>select(p.asset);$('roster').append(choice);
 }
 $('world').addEventListener('click',e=>{if(e.target.closest('.edit-npc')||drag)return;const q=point(e);move(q.x,q.y);});
 function render(){
  for(const p of people){const c=settings[p.asset],el=nodes.get(p.asset),size=Math.round(TTScene.size(c.y/H)),foot=size*(p.bottom+2)/118,lift=TTScene.lift(c.x/W,c.y/H),petScale=size/160;
   Object.assign(el.style,{width:size+'px',height:size+'px',left:(c.x-size/2)+'px',top:(c.y-foot-lift)+'px',zIndex:Math.round(c.y/H*1000)});el.style.setProperty('--foot',foot+'px');el.setAttribute('aria-pressed',String(selected===p.asset));
   el.querySelector('.sprite').style.transform='scaleX('+(c.mirror?-1:1)+')';
   Object.assign(el.querySelector('.pet').style,{width:p.pet.size*petScale+'px',height:p.pet.size*112/96*petScale+'px',left:(size/2+p.pet.x*petScale)+'px',top:(foot+p.pet.y*petScale)+'px',transform:'translate(-50%,-100%) scaleX('+(c.mirror?-1:1)+')'});
   $('roster').querySelector('[data-choice="'+p.asset+'"]').setAttribute('aria-pressed',String(selected===p.asset));
  }
  const p=people.find(p=>p.asset===selected),c=settings[selected];$('selectedName').textContent=p.name+'的站位';$('x').value=c.x;$('y').value=c.y;$('mirror').setAttribute('aria-pressed',String(c.mirror));$('mirrorState').textContent=c.mirror?'目前：左右鏡像':'目前：原圖方向';$('json').value=JSON.stringify(documentValue(),null,2);
  $('placementNotice').textContent=TTScene.valid([c.x,c.y])?'腳底目前位於可站立的地板。':'這個位置落在家具或不可走區域；仍可自由擺放，請確認遮擋是否符合預期。';
 }
 $('mirror').onclick=()=>{settings[selected].mirror=!settings[selected].mirror;render();save();};
 for(const axis of ['x','y']){const update=()=>{if(!Number.isFinite($(axis).valueAsNumber))return;const c=settings[selected];move(axis==='x'?$(axis).valueAsNumber:c.x,axis==='y'?$(axis).valueAsNumber:c.y);};$(axis).addEventListener('input',update);$(axis).addEventListener('change',()=>{update();render();});}
 $('resetOne').onclick=()=>{settings[selected]={...people.find(p=>p.asset===selected).initial};render();save();};
 $('clean').onchange=()=>$('world').classList.toggle('clean',$('clean').checked);
 function fit(){const heightLimit=innerWidth<=950?innerHeight*.65:Math.max(180,innerHeight-260);scale=Math.min($('viewport').clientWidth/W,heightLimit/H)*Number($('zoom').value);$('world').style.transform='scale('+scale+')';$('stageSpace').style.width=W*scale+'px';$('stageSpace').style.height=H*scale+'px';}
 new ResizeObserver(fit).observe($('viewport'));addEventListener('resize',fit);$('zoom').onchange=()=>{fit();const c=settings[selected];$('viewport').scrollTo({left:c.x*scale-$('viewport').clientWidth/2,top:c.y*scale-$('viewport').clientHeight/2});};
 $('export').onclick=()=>{save();const url=URL.createObjectURL(new Blob([JSON.stringify(documentValue(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='小小酒館-NPC站位設定.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('import').onclick=()=>$('importFile').click();$('importFile').onchange=async()=>{const file=$('importFile').files[0];if(!file)return;try{if(file.size>100000)throw Error('設定檔過大，請選擇匯出的站位 JSON。');const next=parse(JSON.parse(await file.text()));settings=next;render();save();$('saveState').textContent='已匯入並儲存站位設定。';}catch(e){$('saveState').textContent='匯入失敗：'+e.message;}finally{$('importFile').value='';}};
 render();fit();
})();
