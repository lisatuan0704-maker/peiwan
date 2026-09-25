/* 繪師原圖維持 1600 × 900 對位；只用顯示裁切分開遮擋順序。 */
(function(root){
  'use strict';
  const W=1600,H=900, bounds=[32,300,1536,873];
  // 腳底碰撞區：吧台可從兩端繞入；棚頂不當成地面牆壁。
  // 吧台右端沿透視斜邊收合，通道繞過櫃體前緣，不能借用櫃子內部。
  const counter=[[382,352],[1140,352],[1140,310],[1180,310],[1308,430],[382,430]];
  const solids=[
    [205,0,382,334], [0,0,205,397], [1260,0,1415,378],
    [0,536,170,775], [210,595,290,640],
    [682,423,738,456],[814,423,870,456],[946,423,1002,456],[1078,423,1134,456]
  ];
  const inside=(p,r)=>p[0]>r[0]&&p[0]<r[2]&&p[1]>r[1]&&p[1]<r[3];
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
  const edges=counter.map((a,i)=>[a,counter[(i+1)%counter.length]]);
  function inCounter(p){
    let hit=false;
    for(const [a,b] of edges){
      const d=sub(b,a),q=sub(p,a);
      if(Math.abs(cross(d,q))<1e-7&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]))return false;
      if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  }
  const valid=p=>p[0]>=bounds[0]&&p[0]<=bounds[2]&&p[1]>=bounds[1]&&p[1]<=bounds[3]&&!inCounter(p)&&!solids.some(r=>inside(p,r));
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  function nearest(p){
    const q=[Math.max(bounds[0],Math.min(bounds[2],p[0])),Math.max(bounds[1],Math.min(bounds[3],p[1]))];
    if(valid(q))return q;
    const candidates=[];
    for(const r of solids)if(inside(q,r))candidates.push([r[0]-2,q[1]],[r[2]+2,q[1]],[q[0],r[1]-2],[q[0],r[3]+2]);
    if(inCounter(q))for(const [a,b] of edges){
      const d=sub(b,a),length=Math.hypot(...d),t=Math.max(0,Math.min(1,((q[0]-a[0])*d[0]+(q[1]-a[1])*d[1])/(length*length)));
      const x=a[0]+t*d[0],y=a[1]+t*d[1];
      candidates.push([x-2*d[1]/length,y+2*d[0]/length],[x+2*d[1]/length,y-2*d[0]/length]);
    }
    return candidates.filter(valid).sort((a,b)=>distance(a,q)-distance(b,q))[0]||[340,470];
  }
  function clear(a,b){
    if(!valid(a)||!valid(b))return false;
    // 在斜邊交點間取樣，避免長步幅直接穿過桌角。
    const d=sub(b,a),cuts=[0,1];
    for(const [u,v] of edges){
      const e=sub(v,u),den=cross(d,e);if(Math.abs(den)<1e-8)continue;
      const q=sub(u,a),t=cross(q,e)/den,s=cross(q,d)/den;
      if(t>0&&t<1&&s>=0&&s<=1)cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);
    for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2;if(inCounter([a[0]+d[0]*t,a[1]+d[1]*t]))return false;}
    for(const r of solids){
      let low=0,high=1;
      for(let axis=0;axis<2;axis++){
        const d=b[axis]-a[axis];
        if(Math.abs(d)<1e-8){if(a[axis]<=r[axis]||a[axis]>=r[axis+2]){low=2;break;}}
        else{const u=(r[axis]-a[axis])/d,v=(r[axis+2]-a[axis])/d;low=Math.max(low,Math.min(u,v));high=Math.min(high,Math.max(u,v));}
      }
      if(low<high&&high>0&&low<1)return false;
    }
    return true;
  }
  const corners=[...solids.flatMap(r=>[[r[0]-2,r[1]-2],[r[2]+2,r[1]-2],[r[0]-2,r[3]+2],[r[2]+2,r[3]+2]]),...counter.flatMap(([x,y])=>[[-2,-2],[2,-2],[-2,2],[2,2]].map(([dx,dy])=>[x+dx,y+dy]))].filter(valid);
  function route(from,to){
    const start=nearest(from),end=nearest(to);
    if(clear(start,end))return [end];
    const nodes=[start,end,...corners],cost=nodes.map(()=>Infinity),prev=[],done=new Set();cost[0]=0;
    for(let pass=0;pass<nodes.length;pass++){
      let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||cost[i]<cost[u]))u=i;
      if(u<0||!Number.isFinite(cost[u]))break;
      if(u===1){const path=[];for(let i=1;i!==0;i=prev[i])path.unshift(nodes[i]);return path;}
      done.add(u);
      for(let v=0;v<nodes.length;v++)if(!done.has(v)&&clear(nodes[u],nodes[v])){const next=cost[u]+distance(nodes[u],nodes[v]);if(next<cost[v]){cost[v]=next;prev[v]=u;}}
    }
    return [start];
  }
  function slide(from,to){
    const start=nearest(from),end=[Math.max(bounds[0],Math.min(bounds[2],to[0])),Math.max(bounds[1],Math.min(bounds[3],to[1]))];
    if(clear(start,end))return end;
    const x=[end[0],start[1]],y=[start[0],end[1]];
    if(clear(start,x))return x;
    if(clear(start,y))return y;
    return start;
  }
  function target(a){
    const key=a.tx+','+a.ty;
    if(a._sceneGoal!==key){a._sceneGoal=key;a._scenePath=route([a.x*W,a.y*H],[a.tx*W,a.ty*H]);}
    const path=a._scenePath;
    while(path.length>1&&distance([a.x*W,a.y*H],path[0])<6&&clear([a.x*W,a.y*H],path[1]))path.shift();
    a._sceneTransit=path.length>1;
    return [path[0][0]/W,path[0][1]/H];
  }
  function metrics(a){
    if(a._sceneBottom!=null)return a._sceneBottom;
    const cv=a.frames?.idle||a.cv, data=cv.getContext('2d').getImageData(0,0,64,64).data;
    let bottom=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(data[(y*64+x)*4+3]>80)bottom=y+1;
    a._sceneBottom=(bottom||64)/64;return a._sceneBottom;
  }
  function size(y){return 164+36*Math.max(0,Math.min(1,(y*H-300)/(873-300)));}
  // 與角色腳底使用同一套排序；到達物件前緣就必須站在物件前面。
  const ground={counter:430,stools:456,stall:619,board:633,wolf:633,white:634,flower:800};
  const layerDepth=y=>Math.round(y/H*1000)-1;
  function mount(world){
    const asset='img/lobby-layers-v218/';
    const layers=[
      ['counter','fixtures.png',layerDepth(ground.counter),'inset(0px 270px 440px 350px)'],
      ['stall','fixtures.png',layerDepth(ground.stall),'polygon(0 0,330px 0,330px 480px,190px 480px,190px 650px,330px 650px,330px 900px,0 900px)'],
      ['board','fixtures.png',layerDepth(ground.board),'inset(480px 1270px 250px 190px)'],
      ['flowers','fixtures.png',1001,'inset(0px 0px 0px 1450px)'],
      // 枕頭需蓋住攤販地面陰影與告示牌底部，再由卡布疊在枕頭上。
      ['cushions','wolf-cushions.png',layerDepth(ground.board),'inset(560px 0px 0px 0px)'],
      ['wolf','wolf-cushions.png',layerDepth(ground.wolf),'inset(0px 0px 340px 0px)'],
      ['purple','purple.png',layerDepth(ground.counter)],['white','white.png',layerDepth(ground.white)],['flower','flower.png',layerDepth(ground.flower)],
      ['stools','stools.png',layerDepth(ground.stools)],['cat','cat.png',layerDepth(ground.counter)],['food','food.png',layerDepth(ground.counter)]
    ];
    for(const [id,file,z,clip] of layers){
      const img=document.createElement('img');img.className='tt-scene-layer';img.dataset.layer=id;
      img.src=asset+file;img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');
      img.width=W;img.height=H;img.style.zIndex=z;if(clip)img.style.clipPath=clip;world.append(img);
    }
  }
  root.TTScene={bounds,solids,counter,valid,nearest,clear,route,slide,target,metrics,size,ground,layerDepth,mount};
})(typeof window!=='undefined'?window:globalThis);
