import {encodePresence} from './presence-codec.mjs?v=361';
// Create one publisher per room. Disposing it prevents queued writes from
// being sent after a room switch. A write already sent is enforced by rules.
export function createPresencePublisher({publish,onError=()=>{},now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,minInterval=100,idleInterval=10000,retryInterval=2000}){
 if(!(minInterval>=100&&idleInterval>=minInterval&&retryInterval>=minInterval))throw Error('INVALID_INTERVAL');
 let latest=null,lastSent=null,lastStarted=-Infinity,lastCompleted=-Infinity,retryAt=-Infinity,timer=null,busy=false,paused=false,disposed=false;
 function cancel(){if(timer!==null){clearTimer(timer);timer=null}}
 function plan(){
  cancel();if(disposed||paused||busy||!latest)return;
  const changed=JSON.stringify(latest)!==lastSent;
  const due=Math.max(lastStarted+minInterval,retryAt,changed?-Infinity:lastCompleted+idleInterval);
  timer=setTimer(()=>{timer=null;void flush()},Math.max(0,due-now()));timer?.unref?.();
 }
 async function flush(){
  if(disposed||paused||busy||!latest)return;
  busy=true;lastStarted=now();const packet={...latest},signature=JSON.stringify(packet);
  try{await publish(packet);lastSent=signature;lastCompleted=now();retryAt=-Infinity}
  catch(e){retryAt=now()+retryInterval;if(!disposed)onError(e)}
  finally{busy=false;plan()}
 }
 return {
  offer(packet){if(disposed)return;encodePresence(packet,0);latest={x:packet.x,y:packet.y,f:packet.f,s:packet.s,w:packet.w,m:packet.m,v:1,...(packet.st?{st:packet.st,sa:packet.sa}:{})};plan()},
  setConnected(connected){if(disposed)return;paused=!connected;if(!paused){lastSent=null;retryAt=-Infinity}plan()},
  dispose(){disposed=true;latest=null;cancel()}
 };
}

export function createServerClock(database,{localNow=Date.now,onConnection=()=>{}}={}){
 let offset=0,connected=false,disposed=false;
 const offsetRef=database.ref('.info/serverTimeOffset'),connectionRef=database.ref('.info/connected');
 const updateOffset=s=>{if(!disposed&&Number.isFinite(s.val()))offset=s.val()};
 const updateConnection=s=>{if(disposed)return;connected=s.val()===true;onConnection(connected)};
 offsetRef.on('value',updateOffset);connectionRef.on('value',updateConnection);
 return {now:()=>localNow()+offset,isConnected:()=>connected,dispose(){if(disposed)return;disposed=true;offsetRef.off('value',updateOffset);connectionRef.off('value',updateConnection)}};
}
