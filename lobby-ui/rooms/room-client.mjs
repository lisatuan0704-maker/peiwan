// No globals or stored credentials: caller supplies the current Firebase token
// and room subscription adapter. Room subscriptions are scoped to the current membership.
export function createRoomClient({request,watch,onState=()=>{},onSnapshot=()=>{},onError=()=>{},setTimer=setInterval,clearTimer=clearInterval}){
 let room=null,connected=true,disposed=false,generation=0,unsubscribe=null,queue=Promise.resolve(),heartbeatPending=false;
 const state=()=>({room:room?{...room}:null,connected,disposed});
 function notify(){onState(state())}
 function detach(){generation++;if(unsubscribe){unsubscribe();unsubscribe=null}onSnapshot(null)}
 function expire(error){detach();room=null;notify();onError(error)}
 function attach(next){
  detach();room=next;notify();if(!room)return;
  const version=generation;
  const stop=watch(room.roomId,snapshot=>{if(!disposed&&version===generation)onSnapshot(snapshot)},error=>{
   if(disposed||version!==generation)return;
   expire(error);
  });
  // A subscription may synchronously fail before watch returns.
  if(version!==generation||disposed)stop();else unsubscribe=stop;
 }
 function enqueue(operation){const result=queue.then(()=>{if(disposed)throw Error('CLIENT_DISPOSED');return operation()});queue=result.catch(()=>{});return result}
 async function change(command){return enqueue(async()=>{
  if(!connected)throw Error('OFFLINE');
  const result=await request('/v1/rooms',command);
  if(!disposed)attach(result.roomId?result:null);
  return result;
 })}
 async function heartbeat(){
  if(disposed||!connected||!room||heartbeatPending)return;
  heartbeatPending=true;
  try{await enqueue(async()=>{
   if(!room||!connected)return;
   const result=await request('/v1/rooms',{action:'heartbeat'});
   if(disposed)return;
   // Another tab may have moved this account. Do not keep the old room live.
   if(result.roomId!==room?.roomId)attach({roomId:result.roomId});
  })}catch(e){if(!disposed){if(['MEMBERSHIP_EXPIRED','INVALID_SESSION','AUTH_REQUIRED','SESSION_IN_USE'].includes(e.code))expire(e);else onError(e)}}finally{heartbeatPending=false}
 }
 const timer=setTimer(()=>{void heartbeat()},20000);timer?.unref?.();
 return {
  state,
  joinPublic:roomId=>change({action:'public',roomId}),
  createPrivate:title=>change({action:'create',title}),
  joinPrivate:code=>change({action:'join',code}),
  leave:()=>change({action:'leave'}),
  heartbeat,
  setConnected(value){if(disposed)return;const was=connected;connected=!!value;notify();if(!was&&connected)void heartbeat()},
  async sendMessage(text,requestId){const target=room?.roomId,epoch=generation;return enqueue(async()=>{
   if(!connected)throw Error('OFFLINE');if(!room)throw Error('ROOM_REQUIRED');
   if(room.roomId!==target||generation!==epoch)throw Error('ROOM_CHANGED');
   return request('/v1/room-messages',{roomId:room.roomId,requestId,text});
  })},
  dispose(){if(disposed)return;disposed=true;clearTimer(timer);detach();room=null;notify()}
 };
}

export function createTransport({baseUrl,getToken,fetchImpl=fetch,timeoutMs=10000}){
 const url=new URL(baseUrl);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('HTTPS_REQUIRED');
 if(url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('INVALID_API_ORIGIN');
 return async(path,body)=>{
  if(!['/v1/rooms','/v1/room-messages','/v1/friends','/v1/profile','/v1/avatar','/v1/account','/v1/characters','/v1/wardrobe','/v1/hair-dye'].includes(path))throw Error('INVALID_API_PATH');
  const token=await getToken();if(!token)throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(url.origin+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:controller.signal,credentials:'omit',redirect:'error'});
   const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'REQUEST_FAILED'),{code:result.error||'REQUEST_FAILED',status:response.status});return result;
  }finally{clearTimeout(timer)}
 };
}
