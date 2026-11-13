/* 同一角色由本人回報世界座標；觀看者只平滑顯示，不重新找路。
   v483：改成「追著目標走」——依發送端時間估出走路速度，維持約 0.6 個送達間隔的落後量；
   封包晚到時放慢而不是停住，落後太多才加快（上限 320px/s），停下時直接走到最後位置。
   v521（D：別人的網頁遊戲即時性都做很好）：本人走路時封包多帶「剩下的路線 r＋走路速度 sp」（點地板）或「目前速度 k」（方向鍵），
   再加伺服器時間 ts；觀看者照路線往前推算「對方現在走到哪」，不再故意落後一拍，轉彎、停下的位置也跟本人一樣。
   往前推算最多 0.6 秒（對方分頁切到背景、網路斷掉時不會自己走完全程）；沒帶路線的舊版封包照 v483 的方式。
   v531（流量）：點地板走路改成換目的地／停下才馬上送，其餘每 1 秒一包 → 往前推算放寬到 1.6 秒；方向鍵每 0.3 秒一包 → 推 0.35 秒。
   封包多帶 sb（基本速度，沒乘遠近），觀看者照「越下面走越快」一路算（本人 sp＝165×遠近），推算才會跟本人對上。
   追趕最多 1.25 倍速（原 2.2 倍＝看起來暴衝）；差太遠（>320px）改成淡出淡入，不直接閃過去。 */
(function(root){
  'use strict';
  const MAX=.32,MIN=.03,AHEAD=1600,KEY_AHEAD=350;
  // 大廳地板上緣 343/900、下緣 .97（lobby.html MAPS.hall.floor）；遠近係數同 lobby.html depthNow
  const depth=y=>.82+(y/900-343/900)/(.97-343/900)*.33;
  let OFF=0,offOK=false;
  function setClockOffset(v){OFF=Number(v)||0;offOK=true;}
  function advance(a,state,now){
    // Rendering can pause in a hidden tab, a modal, or on a slow device.
    // Consume at most one 50ms visual step, never all the wall-clock backlog.
    const dt=Math.max(0,Math.min(50,now-state.renderedAt));state.renderedAt=now;
    if(state.snap){a.x=state.to[0];a.y=state.to[1];return 0;}
    const dx=(state.to[0]-a.x)*1600,dy=(state.to[1]-a.y)*900,rem=Math.hypot(dx,dy);
    if(rem<.25){a.x=state.to[0];a.y=state.to[1];return 0;}
    const lag=Math.max(4,state.vel*state.gap*1.0);
    const floor=now-state.at>state.gap*1.3?1:.35;
    let speed=state.walking?state.vel*Math.max(floor,Math.min(2,rem/lag)):Math.max(state.vel,rem/300);
    speed=Math.max(MIN,Math.min(MAX,speed));
    const step=Math.min(rem,speed*dt);
    if(step>=rem){a.x=state.to[0];a.y=state.to[1];return 0;}
    a.x+=dx/rem*step/1600;a.y+=dy/rem*step/900;
    return rem-step;
  }
  // v521：封包送出後過了 age 毫秒，對方應該走到哪（照路線一段一段走，走到終點就停）
  function predict(pr,age){
    let x=pr.b[0]*1600,y=pr.b[1]*900;
    if(pr.k){const s=Math.min(age,KEY_AHEAD)/1000;return {x:(x+pr.k[0]*s)/1600,y:(y+pr.k[1]*s)/900,moving:true};}   // 方向鍵：只往前推一點點，放開時不會衝過頭
    if(pr.sb){   // v531：照遠近一小段一小段算（每段最多 6px）
      let t=Math.min(age,AHEAD)/1000;
      for(let i=0;i<pr.r.length;i+=2){const px=pr.r[i],py=pr.r[i+1];let L=Math.hypot(px-x,py-y);
        while(L>1e-6){const c=Math.min(6,L),v=pr.sb*depth(y),need=c/v,ux=(px-x)/L,uy=(py-y)/L;
          if(t<need){x+=ux*v*t;y+=uy*v*t;return {x:x/1600,y:y/900,moving:true};}
          t-=need;x+=ux*c;y+=uy*c;L-=c;}
        x=px;y=py;}
      return {x:x/1600,y:y/900,moving:false};
    }
    let d=pr.sp*Math.min(age,AHEAD)/1000;
    for(let i=0;i<pr.r.length;i+=2){const px=pr.r[i],py=pr.r[i+1],L=Math.hypot(px-x,py-y);
      if(d<L){x+=(px-x)/L*d;y+=(py-y)/L*d;return {x:x/1600,y:y/900,moving:true};}
      d-=L;x=px;y=py;}
    return {x:x/1600,y:y/900,moving:false};
  }
  function plan(p,point,prev){
    let age0=60;   // 不知道時間差時，當作封包在路上 0.06 秒
    if(offOK&&Number.isFinite(p.ts))age0=Math.max(0,Math.min(250,Date.now()+OFF-p.ts));
    if(p.w===1&&Array.isArray(p.k)&&p.k.length===2&&p.k.every(Number.isFinite))
      return {b:point,k:p.k,sp:Math.hypot(p.k[0],p.k[1])||150,age0};
    if(p.w===1&&Array.isArray(p.r)&&p.r.length>=2&&p.r.length%2===0&&p.r.every(Number.isFinite)&&Number.isFinite(p.sp)&&p.sp>0)
      return {b:point,r:p.r,sp:Math.min(400,p.sp),sb:p.m==='hall'&&Number.isFinite(p.sb)&&p.sb>0?Math.min(300,p.sb):0,age0};
    if(p.w!==1&&prev?.pred)return {b:point,r:[],sp:prev.pred.sp,age0};   // 停下：照原本的速度走到最後位置
    return null;
  }
  function follow(a,state,now){
    const dt=Math.max(0,Math.min(50,now-state.renderedAt));state.renderedAt=now;
    const pr=state.pred,p=predict(pr,pr.age0+Math.max(0,now-state.at));
    const dx=(p.x-a.x)*1600,dy=(p.y-a.y)*900,rem=Math.hypot(dx,dy);
    if(rem<.3){a.x=p.x;a.y=p.y;return {left:0,moving:p.moving};}
    if(rem>320){blink(a);a.x=p.x;a.y=p.y;return {left:0,moving:p.moving};}   // 差太遠（剛重連）：淡出淡入換過去
    const sp=pr.sb?pr.sb*depth(p.y*900):pr.sp;
    const speed=Math.min(sp*1.25,sp+rem/.25)/1000;   // v531：照對方速度走，落差最多多走 25% 慢慢補回（原 2.2 倍看起來暴衝）
    const step=Math.min(rem,speed*dt);
    a.x+=dx/rem*step/1600;a.y+=dy/rem*step/900;
    return {left:rem-step,moving:p.moving};
  }
  // v531：位置要大跳時，小人淡出淡入（不是一閃就換位置）
  function blink(a){const el=a.el;if(!el||!el.animate)return;try{el.animate([{opacity:.15},{opacity:1}],{duration:320,easing:'ease-out'});}catch(e){}}
  function move(a,state,now){
    if(state.pred)return follow(a,state,now);
    return {left:advance(a,state,now),moving:false};
  }
  function receive(a,p,now,legacyClamp){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
    const map=p.m==='forest'?'forest':p.m==='house'?'house':'hall';   // v510 在小屋裡＝不在大廳畫面上
    let point=[Math.max(0,Math.min(1,p.x)),Math.max(0,Math.min(1,p.y))];
    // 舊版可能回報門牆內的位置；新版已在本人端完成碰撞，不再由觀看者重算。
    if(p.v!==1&&legacyClamp)point=legacyClamp(point,map);
    const signature=[point[0],point[1],map,p.f,p.s,p.w,p.t,p.st,p.sa].join('|');
    let state=a._remotePosition;
    if(state)move(a,state,now);
    if(!state||state.signature!==signature){
      // Reordered packets must not pull a moving character backwards.
      if(state&&Number.isFinite(p.t)&&Number.isFinite(state.time)&&p.t<state.time)return receive(a,state.packet,now,legacyClamp);
      const snap=!state||a.mapLoc!==map||Math.hypot((point[0]-a.x)*1600,(point[1]-a.y)*900)<0.25;
      let vel=state?.vel??.17,gap=state?.gap??150;
      if(state&&!snap){
        const arrive=now-state.at;if(arrive>0)gap=Math.max(80,Math.min(1200,gap*.7+arrive*.3));
        const st=Number.isFinite(p.t)&&Number.isFinite(state.time)?p.t-state.time:arrive;
        const moved=Math.hypot((point[0]-state.to[0])*1600,(point[1]-state.to[1])*900);
        if(st>=40&&st<=3000)vel=Math.max(.04,Math.min(MAX,vel*.5+moved/st*.5));
      }
      const pred=plan(p,point,state);
      state=a._remotePosition={signature,to:point,at:now,snap,vel,gap,walking:p.w===1,time:p.t,packet:{...p},renderedAt:now,pred};
      if(snap){a.x=point[0];a.y=point[1];state.snap=false;}
      a._sceneGoal=null;a._scenePath=null;a._sceneTransit=false;
    }
    const r=move(a,state,now);
    a.tx=state.to[0];a.ty=state.to[1];a.mapLoc=map;a.sitting=!!p.s;
    const moving=!a.sitting&&(r.left>0||r.moving||(!state.pred&&p.w===1&&now-state.at<600));
    a.state=moving?'walk2':'idle';
    const face=p.f===1;if(face!==a.faceLeft){a.faceLeft=face;a.flipping=true;}
    return true;
  }
  function packet(a,map,now){
    const st=root.TTSeats?.current(a)||null;
    const out={x:+a.x.toFixed(6),y:+a.y.toFixed(6),f:a.faceLeft?1:0,s:a.sitting?1:0,m:map,
      w:['walk','walkKey'].includes(a.state)?1:0,v:1,t:now,st,sa:st?a._seatAt:null};
    // v521：走路中帶上「剩下的路線＋速度」或「方向鍵速度」，讓別人照著推算
    if(out.w===1&&a.state==='walk'&&a._spd>0){
      const path=map==='hall'?a._scenePath:(Number.isFinite(a.tx)&&Number.isFinite(a.ty)?[[a.tx*1600,a.ty*900]]:null);
      if(Array.isArray(path)&&path.length){out.r=[];for(const q of path.slice(0,8))out.r.push(Math.round(q[0]),Math.round(q[1]));out.sp=Math.round(a._spd);if(map==='hall'&&a._spb>0)out.sb=a._spb;}
    }else if(out.w===1&&a.state==='walkKey'&&Array.isArray(a._kv))out.k=[Math.round(a._kv[0]),Math.round(a._kv[1])];
    if(offOK)out.ts=Math.round(now+OFF);
    return out;
  }
  function changed(a,b){return !b||['x','y','f','s','m','w','st','sa'].some(k=>a[k]!==b[k]);}
  // v521：換了目的地（或方向鍵換方向）要馬上送，不等下一次 0.15 秒
  function turned(a,b){
    if(!b)return true;
    if(a.r)return !b.r||a.r[a.r.length-2]!==b.r[b.r.length-2]||a.r[a.r.length-1]!==b.r[b.r.length-1];
    if(a.k)return !b.k||Math.sign(a.k[0])!==Math.sign(b.k[0])||Math.sign(a.k[1])!==Math.sign(b.k[1]);
    return false;
  }
  root.TTPresence={receive,packet,changed,turned,setClockOffset};
})(typeof window!=='undefined'?window:globalThis);
