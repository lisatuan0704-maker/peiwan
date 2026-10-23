/* Keyed message rows preserve scroll position and avoid replaying old animations. */
(function(root){
 'use strict';
 const states=new WeakMap();
 const clock=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const date=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function timeText(at){return typeof at==='number'&&Number.isFinite(at)&&at>0?clock.format(new Date(at)):'';}
 function reset(log){states.delete(log);log.replaceChildren();}
 function render(log,messages,myKey){
  let state=states.get(log);const first=!state;
  if(!state){state={rows:new Map()};states.set(log,state);}
  const bottom=log.scrollHeight-log.scrollTop-log.clientHeight<48;
  const oldTop=log.scrollTop,logTop=log.getBoundingClientRect().top;
  const anchor=[...log.children].find(n=>n.getBoundingClientRect().bottom>logTop);
  const anchorTop=anchor?.getBoundingClientRect().top;
  const entries=Object.entries(messages||{}).filter(([,m])=>m&&typeof m==='object').sort(([ak,a],[bk,b])=>(Number(a.at)||0)-(Number(b.at)||0)||ak.localeCompare(bk));
  const keep=new Set(entries.map(([id])=>id));let ownAdded=false,cursor=log.firstChild;
  for(const [id,m] of entries){
   const mine=m.f===myKey,signature=JSON.stringify([m.f,m.x,m.at,mine]);
   let item=state.rows.get(id);
   if(!item){const row=document.createElement('div');row.className='dm-message'+(mine?' is-mine':'')+(!first?' dm-new':'');row.dataset.messageId=id;row.style.display='flex';row.style.justifyContent=mine?'flex-end':'flex-start';item={row,signature:null};state.rows.set(id,item);if(mine)ownAdded=true;}
   if(item.signature!==signature){
    const row=item.row,bubble=document.createElement('span'),content=document.createElement('span');content.className='dm-text';
    const sticker=root.TTChatStickers?.decode(m.x||'');
    row.classList.toggle('is-mine',mine);row.classList.toggle('dm-is-sticker',!!sticker);
    if(sticker)content.append(root.TTChatStickers.logImage(sticker));else content.textContent=m.x||'';
    bubble.append(content);
    const label=timeText(m.at);
    if(label){const time=document.createElement('time');time.className='dm-time';time.dateTime=new Date(m.at).toISOString();time.textContent=label;time.title='台灣時間 '+date.format(new Date(m.at));bubble.append(time);}
    row.replaceChildren(bubble);item.signature=signature;
   }
   if(item.row!==cursor)log.insertBefore(item.row,cursor);cursor=item.row.nextSibling;
  }
  for(const [id,item] of state.rows){if(!keep.has(id)){item.row.remove();state.rows.delete(id);}}
  if(first||bottom||ownAdded)log.scrollTop=log.scrollHeight;
  else if(anchor?.isConnected)log.scrollTop=oldTop+anchor.getBoundingClientRect().top-anchorTop;
  else log.scrollTop=oldTop;
 }
 const api={render,reset,timeText};root.TTDirectMessageLog=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
