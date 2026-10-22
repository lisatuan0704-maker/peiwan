const bit=x=>x===0||x===1;
const scene=x=>x==='hall'||x==='forest';
const coordinate=(x,max)=>Number.isFinite(x)&&x>=0&&x<=max;
export function encodePresence(packet,serverTimestamp){
 if(!packet||!coordinate(packet.x,1)||!coordinate(packet.y,1)||!bit(packet.f)||!bit(packet.s)||!bit(packet.w)||!scene(packet.m)||packet.v!==1)throw Error('INVALID_PRESENCE');
 return {x:Math.round(packet.x*1600*1e6)/1e6,y:Math.round(packet.y*900*1e6)/1e6,f:packet.f,s:packet.s,w:packet.w,m:packet.m,v:1,at:serverTimestamp};
}
export function decodePresence(packet){
 if(!packet||!coordinate(packet.x,1600)||!coordinate(packet.y,900)||!Number.isFinite(packet.at)||!bit(packet.f)||!bit(packet.s)||!bit(packet.w)||!scene(packet.m)||packet.v!==1)return null;
 return {x:packet.x/1600,y:packet.y/900,f:packet.f,s:packet.s,w:packet.w,m:packet.m,v:1,t:packet.at};
}
