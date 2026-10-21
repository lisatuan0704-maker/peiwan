/* Contact rendering only; identity and mutations remain in the existing handlers. */
(()=>{'use strict';
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const labels={friends:'好友',requests:'邀請',blocked:'封鎖與屏蔽'};
function render(host,data,actions){
 let ui=host._contacts;
 if(!ui){
  host.replaceChildren();host.classList.add('tt-contacts');
  const head=make('div','contacts-heading');head.append(make('small','','MY ADDRESS BOOK'),make('h2','','通訊錄'));
  const search=make('input','contacts-search');search.type='search';search.placeholder='搜尋名字';search.setAttribute('aria-label','搜尋通訊錄名字');
  const tabs=make('div','contacts-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','通訊錄分類');
  const list=make('div','contacts-list');list.id='contactEntries';list.setAttribute('role','tabpanel');
  const result=make('p','contacts-result');result.setAttribute('aria-live','polite');
  host.append(head,search,tabs,result,list);ui=host._contacts={search,tabs,list,result,tab:'friends'};
  search.addEventListener('input',()=>paint(host));
  for(const [id,label]of Object.entries(labels)){const b=make('button','',label);b.type='button';b.dataset.tab=id;b.id='contacts-tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-controls',list.id);b.onclick=()=>{ui.tab=id;paint(host);};tabs.append(b);}
  tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=Object.keys(labels),i=keys.indexOf(ui.tab);ui.tab=keys[e.key==='Home'?0:e.key==='End'?keys.length-1:(i+(e.key==='ArrowLeft'?-1:1)+keys.length)%keys.length];paint(host);tabs.querySelector('[data-tab="'+ui.tab+'"]').focus();});
 }
 ui.data=data;ui.actions=actions;paint(host);
}
function paint(host){const ui=host._contacts,{data,actions,tab}=ui;
 const counts={friends:Object.keys(data.friends).length,requests:Object.keys(data.requests).length,blocked:Object.keys(data.blocked).length+Object.keys(data.hidden).length};
 for(const b of ui.tabs.children){const active=b.dataset.tab===tab;b.textContent=labels[b.dataset.tab]+' '+counts[b.dataset.tab];b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
 ui.list.setAttribute('aria-labelledby','contacts-tab-'+tab);ui.list.replaceChildren();
 let rows=tab==='friends'?Object.entries(data.friends).map(([id,v])=>({id,name:v?.name||'旅人',kind:'friend'})):tab==='requests'?Object.entries(data.requests).map(([id,v])=>({id,name:v?.name||'旅人',kind:'request'})):[...Object.entries(data.blocked).map(([id,v])=>({id,name:v?.name||'旅人',kind:'block'})),...Object.entries(data.hidden).map(([id,name])=>({id,name:name||'旅人',kind:'hide'}))];
 const query=ui.search.value.trim().toLocaleLowerCase();rows=rows.filter(x=>x.name.toLocaleLowerCase().includes(query));
 rows.sort((a,b)=>Number(data.present.has(b.id))-Number(data.present.has(a.id))||a.name.localeCompare(b.name,'zh-Hant'));
 ui.result.textContent=query?'找到 '+rows.length+' 位旅人':labels[tab]+' · '+rows.length+' 位';
 const button=(parent,label,fn)=>{const b=make('button','contact-action',label);b.type='button';b.onclick=fn;parent.append(b);};
 for(const row of rows){const article=make('article','contact-entry');article.dataset.contact=row.id;
  const icon=make('span','contact-initial',Array.from(row.name)[0]);icon.setAttribute('aria-hidden','true');
  const info=make('div','contact-info');info.append(make('strong','',row.name));
  const state=row.kind==='block'?'已封鎖':row.kind==='hide'?'已在你的畫面屏蔽':row.kind==='request'?'想和你成為好友':data.present.has(row.id)?'在此大廳':'未在此大廳';info.append(make('small','',state));
  const controls=make('div','contact-actions');
  if(row.kind==='friend'){const unread=Number(data.messages[row.id]?.unread)||0;if(unread)info.append(make('span','contact-unread',unread+' 則未讀'));button(controls,'私訊',()=>actions.message(row.id));button(controls,'移除',()=>actions.remove(row.id));}
  if(row.kind==='request'){button(controls,'接受',()=>actions.accept(row.id));button(controls,'婉拒',()=>actions.decline(row.id));button(controls,'封鎖',()=>actions.block(row.id));}
  if(row.kind==='block')button(controls,'解除封鎖',()=>actions.unblock(row.id));
  if(row.kind==='hide')button(controls,'解除屏蔽',()=>actions.unhide(row.id));
  article.append(icon,info,controls);ui.list.append(article);
 }
 if(!rows.length){const empty=make('div','contacts-empty');empty.append(make('h3','',query?'沒有符合的名字':tab==='friends'?'把聊得來的人留在這裡':tab==='requests'?'目前沒有好友邀請':'目前沒有封鎖或屏蔽的旅人'),make('p','',query?'試試其他名字。':tab==='friends'?'在大廳點開對方的闆卡，就能送出好友邀請。':'新的紀錄會顯示在這裡。'));ui.list.append(empty);}
}
window.TTContacts={render};
})();
