// Retain drafts until acknowledgement; retries within the receipt window reuse IDs.
export function createChatComposer({send,getRoom,notify=()=>{},makeId=()=>crypto.randomUUID().replaceAll('-',''),now=Date.now}){
 let pending=false,retry=null;
 return {async submit(text,input,{sticker=false}={}){
  if(pending)return false;
  const room=getRoom(),draft=input.value;
  if(!room){notify('請先進入大廳再傳送訊息。');return false}
  const attempt=retry&&retry.room===room&&retry.text===text&&now()-retry.at<9*60*1000?retry:{room,text,id:makeId(),at:now()};
  retry=attempt;pending=true;
  try{
   await send(text,attempt.id);
   retry=null;
   if(!sticker&&getRoom()===room&&input.value===draft)input.value='';
   return true;
  }catch(e){
   const code=e.code||e.message;
   notify(({OFFLINE:'目前連線中斷，文字已保留，連線恢復後可再送出。',CHAT_RATE_LIMIT:'訊息送得太快，請稍等再送出。',ROOM_CHANGED:'大廳已切換，文字已保留，請確認後再送出。',ROOM_ACCESS_DENIED:'已離開這個大廳，文字已保留。'})[code]||'尚未確認送達，文字已保留。可以再按送出重試。');
   return false;
  }finally{pending=false}
 }};
}
