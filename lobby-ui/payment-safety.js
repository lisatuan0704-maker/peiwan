/* v273：跨分頁交易鎖與未完成交易紀錄；不把逾時當成失敗，也不自動重試扣款。 */
(function(root){
 'use strict';
 const prefix='tt_pending_payment_v1:';
 const message='上一筆交易結果尚未確認，請先查看訂單或聯絡掌櫃，勿重複付款';
 function error(text,code){const e=new Error(text);e.code=code;return e;}
 function create({storage,locks,now=Date.now}){
  function pending(key){const raw=storage.getItem(prefix+key);if(!raw)return null;try{return JSON.parse(raw);}catch(_){throw error(message,'PENDING');}}
  async function execute({key,amount,ids,commit,lookup}){
   if(!key||!Number.isSafeInteger(amount)||amount<0||!Array.isArray(ids)||!ids.length)throw error('交易資料有誤，請重新選擇','INVALID');
   if(!locks?.request)throw error('此瀏覽器不支援安全交易鎖，請使用更新版 Chrome、Edge 或 Safari','UNSUPPORTED');
   return locks.request('tt-wallet:'+key,{ifAvailable:true},async lock=>{
    if(!lock)throw error('另一個分頁正在處理付款，請稍候','BUSY');
    const old=pending(key);
    if(old){
     if(lookup&&Array.isArray(old.ids)&&old.ids.length){
      let rows;try{rows=await lookup(old.ids);}catch(_){}
      if(rows&&rows.length===old.ids.length&&rows.every(o=>o&&o.myKey===key&&o.paidBy==='wallet')&&rows.reduce((n,o)=>n+Number(o.amount),0)===old.amount){
       try{storage.removeItem(prefix+key);}catch(_){}
       const e=error('上一筆付款已確認完成，請先查看訂單；本次沒有再次扣款','RECOVERED');e.ids=old.ids;throw e;
      }
     }
     const e=error(message,'PENDING');e.ids=old.ids;throw e;
    }
    const entry={key,amount,ids,stage:'commit_pending',at:now()};
    const write=()=>storage.setItem(prefix+key,JSON.stringify(entry));
    const stage=s=>{entry.stage=s;try{write();}catch(_){/* 初始紀錄已保留，不能中途清掉保護。 */}};
    const clear=()=>{try{storage.removeItem(prefix+key);}catch(_){}};
    try{write();}catch(_){throw error('無法保存交易復原紀錄，請確認瀏覽器儲存空間後再試','STORAGE');}
    try{await commit();}catch(e){
     const code=String(e.code||'').toLowerCase().replace(/-/g,'_');
     if(['permission_denied','database/permission_denied','validation_failed'].includes(code)){
      clear();throw error('送出遭拒，訂單未成立，也未扣款；請確認餘額或聯絡掌櫃','REJECTED');
     }
     stage('commit_unconfirmed');throw error('交易結果尚未確認，請查看訂單或聯絡掌櫃，勿重複付款','UNCONFIRMED');
    }
    clear();return {ids};
   });
  }
  return {execute,pending};
 }
 root.TTPaymentSafety={create,prefix};
 if(typeof module==='object')module.exports=root.TTPaymentSafety;
})(typeof window==='undefined'?globalThis:window);
