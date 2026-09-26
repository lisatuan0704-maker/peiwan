/* 測試道具發放：沿用掌櫃登入，只更新指定角色的 owned 節點。 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const firebaseConfig={apiKey:'AIzaSyCXUrJCDqAuB7LmrZhp8SCYM6tVLXWDevc',authDomain:'my-shop-0520.firebaseapp.com',databaseURL:'https://my-shop-0520-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'my-shop-0520',appId:'1:430482271005:web:967059c91a9b7970bdcff4'};
 firebase.initializeApp(firebaseConfig);
 const db=firebase.database(),auth=firebase.auth(),root='peiwan';let draft=null;
 const builtins={cloth0:'露亞經典裝',cloth1:'小莓甜心裝',cloth2:'星夜吟遊裝',cloth3:'貓耳限定裝'};
 try{$('target').value=localStorage.getItem('tt_me')||'';}catch{}
 const read=async path=>(await db.ref(root+'/'+path).once('value')).val();
 async function owner(){const u=auth.currentUser;if(!u||u.uid!==await read('config/adminUid'))throw new Error('請先在掌櫃台帳登入，再重開此頁。');return u.uid;}
 function clear(){draft=null;$('grant').disabled=true;}
 $('target').oninput=clear;$('tickets').oninput=clear;
 auth.onAuthStateChanged(async()=>{clear();$('preview').disabled=true;try{await owner();$('preview').disabled=false;$('summary').textContent='掌櫃身分已確認，請先核對目標帳號。';}catch(e){$('summary').textContent=e.message;}});
 $('preview').onclick=async()=>{
  clear();$('preview').disabled=true;$('status').textContent='讀取中…';
  try{
   const uid=await owner(),key=$('target').value.trim(),tickets=Number($('tickets').value);
   if(!key||/[.#$\[\]/\u0000-\u001f\u007f]/.test(key))throw new Error('角色 ID 格式不正確。');
   if(!Number.isInteger(tickets)||tickets<0||tickets>9999)throw new Error('券數需為 0 至 9999 的整數。');
   const [card,lobby,cfg,owned]=await Promise.all([read('cards/'+key),read('lobby/'+key),read('shopConfig'),read('owned/'+key)]);
   if(!card&&!lobby)throw new Error('找不到這個角色，尚未修改任何資料。');
   const items={...builtins};for(const [id,c] of Object.entries(cfg||{})){if(id in items)items[id]=c.name||items[id];else if(c.custom&&(!c.type||c.type==='時裝'))items[id]=c.name||'新時裝';}
   draft={uid,key,tickets,items,owned:owned||{},name:lobby?.name||card?.name||'未命名角色'};
   $('summary').textContent=JSON.stringify({角色ID:key,角色名稱:draft.name,時裝總數:Object.keys(items).length,目前已擁有:Object.keys(items).filter(id=>owned?.[id]).length,染髮券目前:Number(owned?.dyeTickets)||0,染髮券設定為:tickets,時裝清單:items},null,2);
   $('grant').disabled=false;$('status').textContent='只會補齊缺少的時裝並設定券數；保留既有收藏及染色組合。';
  }catch(e){$('status').textContent=e.message;}finally{$('preview').disabled=false;}
 };
 $('grant').onclick=async()=>{
  if(!draft)return;const d=draft;$('grant').disabled=true;$('preview').disabled=true;
  try{
   if(await owner()!==d.uid)throw new Error('登入身分已變更，請重新核對。');
   const ref=db.ref(root+'/owned/'+d.key),before=(await ref.once('value')).val();
   // 保留修改前快照，無法保存快照時停止發放。
   localStorage.setItem('tt-test-inventory-backup-'+d.key+'-'+Date.now(),JSON.stringify({key:d.key,at:Date.now(),owned:before}));
   const at=Date.now();
   const result=await ref.transaction(current=>{
    const next={...(current||{})};for(const [id,name] of Object.entries(d.items)){if(!next[id])next[id]={name,at,source:'owner-test-grant'};}
    next.dyeTickets=d.tickets;return next;
   },undefined,false);
   if(!result.committed)throw new Error('道具更新未完成，請重新核對。');
   const after=(await ref.once('value')).val();
   if(after?.dyeTickets!==d.tickets||Object.keys(d.items).some(id=>!after?.[id]))throw new Error('寫入後核對不一致，請重新讀取。');
   $('summary').textContent=JSON.stringify({角色ID:d.key,角色名稱:d.name,已解鎖時裝:Object.keys(d.items).length,染髮券:after.dyeTickets,結果:'已完成並重新讀取核對'},null,2);
   $('status').textContent='測試道具已套用。回到大廳重新開啟背包即可確認。';draft=null;
  }catch(e){$('status').textContent=e.message;}finally{$('preview').disabled=false;}
 };
})();
