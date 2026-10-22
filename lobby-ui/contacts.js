/* Contact rendering only; identity and mutations remain in the existing handlers. */
(()=>{'use strict';
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const playerStates={online:'在線上',away:'暫時離開',busy:'請勿打擾'};
let statusSaving=false;
function selfKey(){try{return myKey||''}catch{return ''}}
function playerRecord(id){try{return bosses[id]||agents.get(id)?.b||null}catch{return null}}
function selectedStatus(id){const code=playerRecord(id)?.pub?.status;return Object.hasOwn(playerStates,code)?code:'online'}
function isPresent(id,data){try{return id===myKey||!!posMap[id]}catch{return data.present.has(id)}}
function canSetStatus(){try{return !!db&&!!myKey&&window.__hasCard===true&&!window.TTLegacySocial?.isolated&&!window.TTScopedSocial}catch{return false}}
async function saveStatus(host,code){
 if(statusSaving||!Object.hasOwn(playerStates,code))return;
 const ui=host._contacts,id=selfKey();if(!canSetStatus()){ui.statusNote.textContent='先建立自己的闆卡，就能設定個人狀態。';return}
 statusSaving=true;ui.statusNote.textContent='正在儲存…';paintStatus(ui);
 try{await db.ref(ROOT+'/lobby/'+id+'/pub').update({status:code});if(selfKey()!==id)return;
  const record=playerRecord(id);if(record){record.pub=record.pub||{};record.pub.status=code}
  try{const a=agents.get(id);if(a?.b){a.b.pub=a.b.pub||{};a.b.pub.status=code}}catch{}
  ui.statusNote.textContent='已設為「'+playerStates[code]+'」，好友會看到你的狀態。';paint(host);
 }catch{if(selfKey()===id)ui.statusNote.textContent='狀態沒有存成功，請再試一次。';}
 finally{statusSaving=false;paintStatus(ui)}
}
function paintStatus(ui){const active=selectedStatus(selfKey());for(const b of ui.statusButtons.children){b.setAttribute('aria-pressed',String(b.dataset.status===active));b.disabled=statusSaving||!canSetStatus()}}

const avatarCache=new Map();
function avatar(id,name){const wrap=make('span','contact-avatar');const cv=make('canvas','');cv.width=cv.height=64;cv.setAttribute('role','img');cv.setAttribute('aria-label',name+'的像素小人');
 const draw=record=>{const fid=typeof ttFrameId==='function'?ttFrameId(record?.pub?.frm):'wr1';wrap.dataset.frame=fid;
  if(typeof ttFrame==='function'){const inner=ttFrame(wrap,fid==='wr1'?{anim:false}:{art:fid});inner.append(cv);}else wrap.replaceChildren(cv);
  const doll=record?.doll||{front:0,back:0,cloth:0,face:0,hair:0};if(window.TinyTavernUI)TinyTavernUI.draw(cv,doll);else if(typeof drawDollTo==='function')drawDollTo(cv,doll,'idle');};
 let record;try{record=agents.get(id)?.b||bosses[id]}catch{}draw(record);
 if(!record){try{if(!avatarCache.has(id))avatarCache.set(id,db?db.ref(ROOT+'/lobby/'+id).once('value').then(s=>{const v=s.val();return v?{doll:v.doll,pub:{frm:v.pub?.frm}}:null}).catch(()=>null):Promise.resolve(null));const pending=avatarCache.get(id);pending.then(v=>{if(v&&cv.isConnected)draw(v)}).finally(()=>{if(avatarCache.get(id)===pending)avatarCache.delete(id)});}catch{}}
 return wrap;}
window.TTContactAvatar=avatar;
const labels={friends:'好友',requests:'邀請',blocked:'封鎖與屏蔽'};
function render(host,data,actions){
 let ui=host._contacts;
 if(!ui){
  host.replaceChildren();host.classList.add('tt-contacts');
  const head=make('div','contacts-heading');head.append(make('small','','TAVERN CONNECTIONS'),make('h2','','在酒館，相遇的人。'),make('p','','把想再見的人，留在這一頁。'));const stamp=make('span','contacts-stamp','✦');head.append(stamp);
  const search=make('input','contacts-search');search.type='search';search.placeholder='搜尋名字';search.setAttribute('aria-label','搜尋通訊錄名字');
  const tabs=make('div','contacts-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','通訊錄分類');
  const list=make('div','contacts-list');list.id='contactEntries';list.setAttribute('role','tabpanel');
  const result=make('p','contacts-result');result.setAttribute('aria-live','polite');
  const status=make('section','contacts-my-status');status.setAttribute('aria-label','我的狀態');const statusTitle=make('strong','','我的狀態');const statusButtons=make('div','contacts-status-buttons');statusButtons.setAttribute('role','group');statusButtons.setAttribute('aria-label','選擇個人狀態');const statusNote=make('p','contacts-status-note','自己決定現在的狀態，好友會看到你選的燈號。');statusNote.setAttribute('aria-live','polite');
  for(const [code,label]of Object.entries(playerStates)){const b=make('button','',label);b.type='button';b.dataset.status=code;b.onclick=()=>saveStatus(host,code);statusButtons.append(b)}
  status.append(statusTitle,statusButtons,statusNote);host.append(head,status,search,tabs,result,list);ui=host._contacts={search,tabs,list,result,statusButtons,statusNote,tab:'friends'};
  search.addEventListener('input',()=>paint(host));
  for(const [id,label]of Object.entries(labels)){const b=make('button','',label);b.type='button';b.dataset.tab=id;b.id='contacts-tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-controls',list.id);b.onclick=()=>{ui.tab=id;paint(host);};tabs.append(b);}
  tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=Object.keys(labels),i=keys.indexOf(ui.tab);ui.tab=keys[e.key==='Home'?0:e.key==='End'?keys.length-1:(i+(e.key==='ArrowLeft'?-1:1)+keys.length)%keys.length];paint(host);tabs.querySelector('[data-tab="'+ui.tab+'"]').focus();});
 }
 ui.data=data;ui.actions=actions;paint(host);
}
function paint(host){const ui=host._contacts,{data,actions,tab}=ui;
 paintStatus(ui);
 const counts={friends:Object.keys(data.friends).length,requests:Object.keys(data.requests).length,blocked:Object.keys(data.blocked).length+Object.keys(data.hidden).length};
 for(const b of ui.tabs.children){const active=b.dataset.tab===tab;b.textContent=labels[b.dataset.tab]+' '+counts[b.dataset.tab];b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
 ui.list.setAttribute('aria-labelledby','contacts-tab-'+tab);ui.list.replaceChildren();
 let rows=tab==='friends'?Object.entries(data.friends).map(([id,v])=>({id,name:v?.name||'旅人',kind:'friend'})):tab==='requests'?Object.entries(data.requests).map(([id,v])=>({id,name:v?.name||'旅人',kind:'request'})):[...Object.entries(data.blocked).map(([id,v])=>({id,name:v?.name||'旅人',kind:'block'})),...Object.entries(data.hidden).map(([id,name])=>({id,name:name||'旅人',kind:'hide'}))];
 const query=ui.search.value.trim().toLocaleLowerCase();rows=rows.filter(x=>x.name.toLocaleLowerCase().includes(query));
 rows.sort((a,b)=>Number(isPresent(b.id,data))-Number(isPresent(a.id,data))||a.name.localeCompare(b.name,'zh-Hant'));
 ui.result.textContent=query?'找到 '+rows.length+' 位旅人':labels[tab]+' · '+rows.length+' 位';
 const button=(parent,label,fn)=>{const b=make('button','contact-action',label);b.type='button';b.onclick=fn;parent.append(b);};
 for(const row of rows){const article=make('article','contact-entry');article.dataset.contact=row.id;article.style.setProperty('--contact-tone',String([...row.id].reduce((n,c)=>n+c.codePointAt(0),0)%3));article.dataset.tone=String([...row.id].reduce((n,c)=>n+c.codePointAt(0),0)%3);
  const icon=avatar(row.id,row.name);article.classList.toggle('is-present',isPresent(row.id,data));article.dataset.kind=row.kind;
  const info=make('div','contact-info');info.append(make('strong','',row.name));
  article.dataset.presence=isPresent(row.id,data)?selectedStatus(row.id):'offline';
  const state=row.kind==='block'?'已封鎖':row.kind==='hide'?'已在你的畫面屏蔽':row.kind==='request'?'想和你成為好友':isPresent(row.id,data)?playerStates[selectedStatus(row.id)]:'未在此大廳';info.append(make('small','contact-presence',state));if(row.kind==='friend')info.append(make('p','contact-last',data.messages[row.id]?.last||'今天也來聊兩句吧。'));
  const controls=make('div','contact-actions');
  if(row.kind==='friend'){const unread=Number(data.messages[row.id]?.unread)||0;if(unread)info.append(make('span','contact-unread',unread+' 則未讀'));button(controls,'聊聊 ↗',()=>actions.message(row.id));button(controls,'移除',()=>actions.remove(row.id));}
  if(row.kind==='request'){button(controls,'接受',()=>actions.accept(row.id));button(controls,'婉拒',()=>actions.decline(row.id));button(controls,'封鎖',()=>actions.block(row.id));}
  if(row.kind==='block')button(controls,'解除封鎖',()=>actions.unblock(row.id));
  if(row.kind==='hide')button(controls,'解除屏蔽',()=>actions.unhide(row.id));
  article.append(icon,info,controls);ui.list.append(article);
 }
 if(!rows.length){const empty=make('div','contacts-empty');empty.append(make('h3','',query?'沒有符合的名字':tab==='friends'?'把聊得來的人留在這裡':tab==='requests'?'目前沒有好友邀請':'目前沒有封鎖或屏蔽的旅人'),make('p','',query?'試試其他名字。':tab==='friends'?'在大廳點開對方的闆卡，就能送出好友邀請。':'新的紀錄會顯示在這裡。'));ui.list.append(empty);}
}
window.TTContacts={render};
let statusSignature='';setInterval(()=>{const host=document.getElementById('frBody'),ui=host?._contacts;if(!ui||!host.getClientRects().length||document.hidden)return;const signature=JSON.stringify([selfKey(),canSetStatus(),selectedStatus(selfKey()),...Object.keys(ui.data.friends).map(id=>[id,isPresent(id,ui.data),selectedStatus(id)])]);if(signature!==statusSignature){statusSignature=signature;paint(host)}},1000);
})();
