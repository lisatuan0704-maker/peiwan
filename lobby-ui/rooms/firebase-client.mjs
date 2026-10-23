import {encodePresence,decodePresence} from './presence-codec.mjs?v=361';
const roomPattern=/^(public-0[123]|private-[a-f0-9]{32})$/;
export function createFirebaseAdapter({database,getUid,serverTimestamp,now=Date.now,setTimer=setInterval,clearTimer=clearInterval,createPositionTransport}){
 const transports=new Map();
 function validateRoom(id){if(!roomPattern.test(id||''))throw Error('INVALID_ROOM')}
 return {
  async publish(roomId,packet){
   validateRoom(roomId);const uid=getUid();if(!/^discord_[0-9]{1,25}$/.test(uid||''))throw Error('AUTH_REQUIRED');
   const encoded=encodePresence(packet,serverTimestamp);
   if(createPositionTransport){const transport=transports.get(roomId);if(!transport)throw Error('PRESENCE_OFFLINE');return transport.publish(packet)}
   await database.ref('socialV1/live/'+roomId+'/positions/'+uid).set(encoded);
  },
  watch(roomId,onSnapshot,onError){
   validateRoom(roomId);let stopped=false,metadata=null,live=null,last=null,pending=null,transport=null,relayPositions={};const extra=[];
   const metaRef=database.ref('socialV1/roomViews/'+roomId),liveRef=database.ref('socialV1/live/'+roomId);
   function emit(){
    if(stopped||!metadata)return;
    const positions={},time=now(),roomActive=metadata.kind==='public'||metadata.expiresAt>time;
    if(roomActive)for(const [uid,p] of Object.entries(createPositionTransport?relayPositions:(live?.positions||{}))){
     if(!(metadata.members?.[uid]?.leaseUntil>time))continue;
     const decoded=createPositionTransport?p:decodePresence(p);if(decoded)positions[uid]=decoded;
    }
    const appearances={};if(roomActive)for(const [uid,p] of Object.entries(live?.appearances||{}))if(metadata.members?.[uid]?.leaseUntil>time)appearances[uid]=p;
    const result={positions,appearances,messages:roomActive?(live?.messages||{}):{}};
    const signature=JSON.stringify(result);if(signature===last)return;last=signature;onSnapshot(result);
   }
   function fail(error){if(stopped)return;stop();onError(error)}
   // A busy room can deliver hundreds of changes a second. Render the latest
   // complete snapshot at most every 50 ms, without dropping the final stop.
   function schedule(){if(stopped||pending!==null)return;pending=setTimeout(()=>{pending=null;emit()},50)}
   function metaChanged(s){metadata=s.val();if(!metadata){fail(Error('ROOM_UNAVAILABLE'));return}schedule()}
   function liveChanged(s){live=s.val();schedule()}
   const timer=setTimer(schedule,1000);timer?.unref?.();
   function stop(){if(stopped)return;stopped=true;if(pending!==null)clearTimeout(pending);pending=null;clearTimer(timer);metaRef.off('value',metaChanged);liveRef.off('value',liveChanged);for(const off of extra)off();transport?.dispose();if(transports.get(roomId)===transport)transports.delete(roomId)}
   metaRef.on('value',metaChanged,fail);
   if(!stopped&&createPositionTransport){
    for(const key of ['appearances','messages']){
     if(stopped)break;
     const ref=liveRef.child(key),changed=s=>{live??={};live[key]=s.val();schedule()};
     extra.push(()=>ref.off('value',changed));ref.on('value',changed,fail);
    }
    if(!stopped){
     transport=createPositionTransport({roomId,onSnapshot:s=>{relayPositions=s.positions||{};schedule()},onError:error=>{if(!stopped)onError(error)}});
     if(stopped)transport.dispose();else transports.set(roomId,transport);
    }
   }else if(!stopped)liveRef.on('value',liveChanged,fail);
   return stop;
  }
 };
}
