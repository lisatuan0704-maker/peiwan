export function watchPublicRooms(database,onChange,{now=Date.now,setTimer=setInterval,clearTimer=clearInterval,onError=()=>{}}={}){
 const ids=['public-01','public-02','public-03'],values=new Map(),stops=[];let stopped=false,last='';
 function emit(){if(stopped)return;const time=now();const list=ids.map(id=>{const r=values.get(id),available=r?.kind==='public'&&Number.isInteger(r.capacity)&&r.capacity>0;return {id,title:available?r.title:'公共大廳 '+id.slice(-2),capacity:available?r.capacity:0,count:available?Object.values(r.leases||{}).filter(until=>Number.isFinite(until)&&until>time).length:0,available}});const signature=JSON.stringify(list);if(last!==signature){last=signature;onChange(list)}}
 for(const id of ids){const ref=database.ref('socialV1/directory/'+id);const update=s=>{values.set(id,s.val());emit()};const fail=e=>{values.delete(id);emit();if(!stopped)onError(e)};ref.on('value',update,fail);stops.push(()=>ref.off('value',update))}
 const timer=setTimer(emit,1000);timer?.unref?.();emit();
 return ()=>{if(stopped)return;stopped=true;clearTimer(timer);stops.forEach(stop=>stop());values.clear()};
}
