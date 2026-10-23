const bit=x=>x===0||x===1;
const scene=x=>x==='hall'||x==='forest';
const coordinate=(x,max)=>Number.isFinite(x)&&x>=0&&x<=max;
const seat=p=>p.st==null||(p.st==='seat3'||p.st==='seat4')&&Number.isFinite(p.sa)&&p.sa>0;
const seatFields=p=>p.st?{st:p.st,sa:p.sa}:{};
export function encodePresence(packet,serverTimestamp){
 if(!packet||!coordinate(packet.x,1)||!coordinate(packet.y,1)||!bit(packet.f)||!bit(packet.s)||!bit(packet.w)||!scene(packet.m)||packet.v!==1)throw Error('INVALID_PRESENCE');
 if(!seat(packet))throw Error('INVALID_SEAT');
 return {x:Math.round(packet.x*1600*1e6)/1e6,y:Math.round(packet.y*900*1e6)/1e6,f:packet.f,s:packet.s,w:packet.w,m:packet.m,v:1,at:serverTimestamp,...seatFields(packet)};
}
export function decodePresence(packet){
 if(!packet||!coordinate(packet.x,1600)||!coordinate(packet.y,900)||!Number.isFinite(packet.at)||!bit(packet.f)||!bit(packet.s)||!bit(packet.w)||!scene(packet.m)||packet.v!==1)return null;
 if(!seat(packet))return null;
 return {x:packet.x/1600,y:packet.y/900,f:packet.f,s:packet.s,w:packet.w,m:packet.m,v:1,t:packet.at,...seatFields(packet)};
}
