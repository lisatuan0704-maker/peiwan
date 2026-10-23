/* 同一角色由本人回報世界座標；觀看者只平滑顯示，不重新找路。 */
(function(root){
  'use strict';
  function advance(a,state,now){
    // Rendering can pause in a hidden tab, a modal, or on a slow device.
    // Consume at most one 50ms visual step, never all the wall-clock backlog.
    state.elapsed+=Math.max(0,Math.min(50,now-state.renderedAt));
    state.renderedAt=now;
    const ratio=state.snap?1:Math.min(1,state.elapsed/state.duration);
    a.x=state.from[0]+(state.to[0]-state.from[0])*ratio;
    a.y=state.from[1]+(state.to[1]-state.from[1])*ratio;
    return ratio;
  }
  function receive(a,p,now,legacyClamp){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
    const map=p.m==='forest'?'forest':'hall';
    let point=[Math.max(0,Math.min(1,p.x)),Math.max(0,Math.min(1,p.y))];
    // 舊版可能回報門牆內的位置；新版已在本人端完成碰撞，不再由觀看者重算。
    if(p.v!==1&&legacyClamp)point=legacyClamp(point,map);
    const signature=[point[0],point[1],map,p.f,p.s,p.w,p.t].join('|');
    let state=a._remotePosition;
    if(state)advance(a,state,now);
    if(!state||state.signature!==signature){
      // Reordered packets must not pull a moving character backwards.
      if(state&&Number.isFinite(p.t)&&Number.isFinite(state.time)&&p.t<state.time)return receive(a,state.packet,now,legacyClamp);
      const distance=Math.hypot((point[0]-a.x)*1600,(point[1]-a.y)*900);
      const gap=state?now-state.at:150;
      const snap=!state||a.mapLoc!==map||distance<0.25;
      // Slow acknowledgements can leave more than 96px between updates.
      // Stay continuous within a map and adapt to the actual delivery cadence.
      const duration=Math.max(120,Math.min(650,gap*.8),distance/.32);
      state=a._remotePosition={signature,from:[a.x,a.y],to:point,at:now,snap,duration,time:p.t,packet:{...p},elapsed:0,renderedAt:now};
      a._sceneGoal=null;a._scenePath=null;a._sceneTransit=false;
    }
    const ratio=advance(a,state,now);
    a.tx=state.to[0];a.ty=state.to[1];a.mapLoc=map;a.sitting=!!p.s;
    const moving=!a.sitting&&(ratio<1||(p.w===1&&now-state.at<Math.max(400,state.duration+150)));
    a.state=moving?'walk2':'idle';
    const face=p.f===1;if(face!==a.faceLeft){a.faceLeft=face;a.flipping=true;}
    return true;
  }
  function packet(a,map,now){
    return {x:+a.x.toFixed(6),y:+a.y.toFixed(6),f:a.faceLeft?1:0,s:a.sitting?1:0,m:map,
      w:['walk','walkKey'].includes(a.state)?1:0,v:1,t:now};
  }
  function changed(a,b){return !b||['x','y','f','s','m','w'].some(k=>a[k]!==b[k]);}
  root.TTPresence={receive,packet,changed};
})(typeof window!=='undefined'?window:globalThis);
