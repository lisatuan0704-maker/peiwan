const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'lobby-ui/presence.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'lobby-ui/scene.js'),'utf8'),ctx);
const P=ctx.TTPresence,S=ctx.TTScene,dist=(a,b)=>Math.hypot((a.x-b.x)*1600,(a.y-b.y)*900),actor=()=>({x:.9,y:.78,mapLoc:'hall',state:'idle',faceLeft:false});
let remote=actor(),sender={x:.4,y:.34,state:'idle'};
P.receive(remote,P.packet(sender,'hall',1),0);assert(dist(remote,sender)<1e-8,'初次收到必須立即對齊');
assert.equal(remote._scenePath,null);assert.equal(remote.state,'idle');
sender.x+=.02;P.receive(remote,P.packet(sender,'hall',2),10);P.receive(remote,P.packet(sender,'hall',2),131);assert(dist(remote,sender)<1e-8);
P.receive(remote,{x:.2,y:.8,m:'forest',f:1,s:1,v:1,t:3},140);assert.equal(remote.mapLoc,'forest');assert.equal(remote.sitting,true);assert.equal(remote.faceLeft,true);assert.equal(remote.x,.2);
const last={...remote};assert.equal(P.receive(remote,{x:NaN,y:.2},150),false);assert.equal(remote.x,last.x);
let legacyCalled=0;P.receive(actor(),{x:.9,y:.2},1,()=>{legacyCalled++;return [.8,.7]});assert.equal(legacyCalled,1);
P.receive(actor(),{x:.9,y:.2,v:1},1,()=>{throw Error('新版座標不可在接收端重新碰撞');});
// 重播本人繞吧台的實際路徑：送出 150ms、網路延遲 100ms，接收端不自行找路。
const route=S.route([600,305],[1000,760]).map(p=>Array.from(p));sender={x:600/1600,y:305/900,state:'walk',faceLeft:false};remote=actor();let queue=[],peak=0,lastSend=-999,idx=0;
P.receive(remote,P.packet(sender,'hall',0),0);
for(let now=0;now<16000;now+=10){
 const target=route[idx],dx=target[0]-sender.x*1600,dy=target[1]-sender.y*900,d=Math.hypot(dx,dy),step=Math.min(d,1.9);
 if(d<2){if(idx<route.length-1)idx++;else sender.state='idle';}else{sender.x+=dx/d*step/1600;sender.y+=dy/d*step/900;}
 if(now-lastSend>=150){queue.push({at:now+100,p:P.packet(sender,'hall',now)});lastSend=now;}
 while(queue.length&&queue[0].at<=now)remote.packet=queue.shift().p;
 if(remote.packet)P.receive(remote,remote.packet,now);
 peak=Math.max(peak,dist(sender,remote));
}
assert(peak<60,'持續走動不可累積落後：'+peak);assert(dist(sender,remote)<.01,'停下後必須對齊');
const one=P.packet(sender,'hall',0),two={...one,x:one.x+.0001};assert(P.changed(two,one),'停止前的小移動也要同步');assert(P.changed({...one,w:1},one));
const html=fs.readFileSync(path.join(root,'lobby.html'),'utf8');const start=html.indexOf('    /* 位置與停止狀態一起回報');const block=html.slice(start,html.indexOf('\n    const actorMap=',start));
const roles=new Map(['old','new'].map(key=>[key,{isMe:key==='old',state:'walk',b:{name:key},tag:{style:{}}}]));
const claimCtx={agents:roles,localStorage:{setItem(){}},myKey:'old',camFocus:null};vm.createContext(claimCtx);
vm.runInContext(html.slice(html.indexOf('function claimMe(key){'),html.indexOf('function screenToWorld(')),claimCtx);
claimCtx.claimMe('new');assert.equal(roles.get('old').isMe,false);assert.equal(roles.get('old').state,'idle');assert.equal(roles.get('new').isMe,true);
claimCtx.claimMe('not-loaded');assert.equal([...roles.values()].filter(a=>a.isMe).length,0);
const writes=[];let fail=true,now=1000;const a={...sender,key:'sender',isMe:true,state:'walk'};
const sendCtx={TTPresence:P,a,now,myKey:'sender',ROOT:'/peiwan',curMap:'hall',posWriteOK:false,posErr:'',syncBadge(){},performance:{now:()=>now},console:{warn(){}},db:{ref:()=>({onDisconnect:()=>({remove(){}}),set:async p=>{writes.push(p);if(fail)throw Error('offline');}})}};vm.createContext(sendCtx);
async function run(t){now=t;sendCtx.now=t;vm.runInContext(block,sendCtx);await new Promise(r=>setImmediate(r));}
(async()=>{await run(1000);assert.equal(writes.length,1);assert(!a._sentPosition,'失敗不可當作已同步');await run(1500);assert.equal(writes.length,1);fail=false;await run(2001);assert.equal(writes.length,2);assert(a._sentPosition);a.state='idle';a.x+=.0001;await run(2010);assert.equal(writes.length,3);assert.equal(writes[2].w,0);assert.equal(writes[2].x,+a.x.toFixed(6));a.key='old-role';a.x+=.1;await run(9000);assert.equal(writes.length,3,'舊角色不可覆寫目前角色的位置');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);console.log('PASS: 首次與跨圖立即對齊、120ms平滑收斂、吧台路徑最高誤差 '+peak.toFixed(1)+'px（100ms模擬延遲）、停下精確對齊、本人座標優先、舊版座標修正、無效封包拒絕、寫入失敗重試、停止立即同步、頁面語法');})().catch(e=>{console.error(e);process.exitCode=1});
