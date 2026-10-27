export function createServiceTimer({getOrder,request,originals,confirm,notify}){
 const pending=new Set();
 const actions={startTimer:'start',pauseTimer:'pause',resumeTimer:'resume',endTimer:'complete'};
 return Object.fromEntries(Object.entries(actions).map(([name,action])=>[name,async id=>{
  const order=getOrder(id);if(!order||pending.has(id))return;
  if(!order.clientOrderId){notify('這筆舊訂單未接上新計時，請聯絡店長確認。');return}
  if(action==='complete'&&!confirm('結束這筆陪玩並記錄時長？'))return;
  pending.add(id);
  try{
   const result=await request('/v1/voice/time',{orderId:order.clientOrderId,action});
   if(result.state==='complete'&&action!=='complete'){notify('這筆服務已結束，請重新整理訂單。');return}
   if(action==='start'&&result.state!=='running'){notify('這筆服務已開始過，請使用繼續計時。');return}
   await originals[name](id,action==='complete');
  }catch(e){notify(e.code==='OUTSIDE_SERVICE_WINDOW'?'尚未到這筆訂單的服務時間。':e.code==='TIMER_NOT_STARTED'?'這筆訂單尚未建立服務計時，請先開始計時。':'計時尚未儲存成功，請重試；未變更訂單。')}
  finally{pending.delete(id)}
 }]));
}
