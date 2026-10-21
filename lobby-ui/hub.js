/* Reuse the live modal nodes: no copied IDs, order data, or transaction handlers. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const views={friends:{label:'通訊錄',id:'frM',open:()=>frOpen()},mail:{label:'信箱',id:'mailBoxM',open:()=>{renderMailBox();gOpen('mailBoxM');}},orders:{label:'訂單',id:'shopM4',open:()=>shopOpen(4)},wallet:{label:'錢包',id:'topupM',open:()=>openTopup()},achievements:{label:'成就',id:'achM',open:()=>{buildAch2();gOpen('achM');}},settings:{label:'設定',id:'setM',open:()=>$('gearBtn').click()}};
const hub=document.createElement('div');hub.id='ttHub';hub.hidden=true;
hub.innerHTML='<section class="hub-card" role="dialog" aria-modal="true" aria-labelledby="hubTitle"><header class="hub-header"><div><small>MY TINY TAVERN</small><h1 id="hubTitle">我的酒館</h1></div><button type="button" class="hub-close" aria-label="關閉我的酒館">×</button></header><nav class="hub-tabs" role="tablist" aria-label="我的酒館功能"></nav><div class="hub-mount" role="tabpanel" id="hubContent"></div></section>';
document.body.append(hub);const tabs=hub.querySelector('.hub-tabs'),mount=hub.querySelector('.hub-mount');let current=null,anchor=null,returnFocus=null;
function release(){if(!current)return;const node=$(views[current].id);node.classList.remove('on','hub-embedded');if(node.classList.contains('shopModal'))node.style.display='none';anchor?.replaceWith(node);anchor=null;current=null;}
function close(){release();hub.hidden=true;document.body.classList.remove('tt-hub-open');returnFocus?.focus?.();}
function show(key){if(!views[key])return;
 if(hub.hidden)returnFocus=document.activeElement;
 release();views[key].open();const node=$(views[key].id);
 if(!node||(!node.classList.contains('on')&&node.style.display!=='flex')){close();return;}
 anchor=document.createComment('hub original '+node.id);node.before(anchor);mount.append(node);node.classList.add('hub-embedded');current=key;hub.hidden=false;document.body.classList.add('tt-hub-open');
 for(const b of tabs.children){b.setAttribute('aria-selected',String(b.dataset.view===key));b.tabIndex=b.dataset.view===key?0:-1;}
 mount.setAttribute('aria-labelledby','hub-tab-'+key);tabs.querySelector('[data-view="'+key+'"]').focus();
}
for(const [key,v]of Object.entries(views)){const b=document.createElement('button');b.type='button';b.textContent=v.label;b.dataset.view=key;b.id='hub-tab-'+key;b.setAttribute('role','tab');b.setAttribute('aria-controls','hubContent');b.onclick=()=>show(key);tabs.append(b);}
tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=Object.keys(views),i=keys.indexOf(current);show(keys[e.key==='Home'?0:e.key==='End'?keys.length-1:(i+(e.key==='ArrowLeft'?-1:1)+keys.length)%keys.length]);});
hub.querySelector('.hub-close').onclick=close;hub.addEventListener('click',e=>{if(e.target===hub)close();});
hub.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const focusable=[...hub.querySelectorAll('button,input,select,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
// Native actions that open another modal release this mounted view first.
const originalOpen=window.gOpen;window.gOpen=function(id){if(current&&id!==views[current].id)close();return originalOpen(id);};
const originalShop=window.shopOpen;window.shopOpen=function(...args){const n=args[0];if(current&&!(current==='orders'&&n===4))close();return originalShop.apply(this,args);};
const originalShopClose=window.shopClose;window.shopClose=function(...args){if(current==='orders')close();return originalShopClose.apply(this,args);};
const originalClose=window.gClose;window.gClose=function(id){if(current&&id===views[current].id)close();return originalClose(id);};
const dock=$('ttMainDock');if(dock){const entry=document.createElement('button');entry.type='button';entry.id='ttHubButton';entry.innerHTML='<img src="lobby-ui/assets/chat.png" alt=""><span>我的酒館</span>';entry.onclick=()=>show('friends');dock.prepend(entry);for(const id of ['frBtn','ttAchBtn','ttWalletBtn','ttMailBtn','ordBtn'])$(id)?.classList.add('hub-old-shortcut');
 const badge=document.createElement('b');badge.className='hub-unread';badge.hidden=true;entry.append(badge);
 const watched=['frDockBadge','mailBadge','ordBadge'].map($).filter(Boolean);
 const update=()=>{const active=watched.filter(n=>n.style.display!=='none'&&n.textContent.trim()&&n.textContent.trim()!=='0');badge.hidden=!active.length;badge.textContent='•';entry.setAttribute('aria-label',active.length?'我的酒館，有未讀通知':'我的酒館');};
 const observer=new MutationObserver(update);for(const n of watched)observer.observe(n,{attributes:true,attributeFilter:['style'],childList:true,characterData:true,subtree:true});update();
}
window.TTHub={open:show,close,get current(){return current;}};
})();
