export function createServiceTimer({getOrder,request,originals,confirm,notify}){
 const pending=new Set();
 const actions={startTimer:'start',pauseTimer:'pause',resumeTimer:'resume',endTimer:'complete'};
 return Object.fromEntries(Object.entries(actions).map(([name,action])=>[name,async id=>{
  const order=getOrder(id);if(!order||pending.has(id))return;
  if(action==='complete'&&!confirm('結束這筆陪玩並記錄時長？'))return;
  pending.add(id);
  try{
   /* v511 D：「陪玩那邊也說無法正常計時」——以前要語音主機先記到時數才肯計時，主機沒有這筆單（語音登記失敗）就整個卡死，
      老闆那邊也拿不到開始時間。現在手札自己的計時一律照做；主機那份時數（冒險者頭像框用）記不到就提醒一下，不擋計時。 */
   let result=null,why='';
   if(order.clientOrderId){
    try{result=await request('/v1/voice/time',{orderId:order.clientOrderId,action});}
    catch(e){why=e.code?'代碼 '+e.code:(e.message||'');}
   }
   if(result&&result.state==='complete'&&action!=='complete'){notify('這筆服務已結束，請重新整理訂單。');return}
   if(result&&action==='start'&&result.state!=='running'){notify('這筆服務已開始過，請使用繼續計時。');return}
   await originals[name](id,action==='complete');
   if(order.clientOrderId&&!result&&action==='start')notify('計時照常進行；語音主機的時數紀錄這次沒有同步'+(why?'（'+why+'）':'')+'，不影響這筆單。');
  }catch(e){notify('計時尚未儲存成功，請重試。')}
  finally{pending.delete(id)}
 }]));
}
