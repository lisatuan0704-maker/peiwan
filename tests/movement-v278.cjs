const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),cp=require('child_process');
const load=source=>{const c={};vm.createContext(c);vm.runInContext(source,c);return c.TTScene;};
const source=fs.readFileSync('lobby-ui/scene.js','utf8'),scene=load(source);
const old=load(cp.execFileSync('git',['show','3de064e:lobby-ui/scene.js'],{encoding:'utf8'}));
function keyboard(s,fps,start,dir){let p=start.slice();for(let f=0;f<fps;f++){const end=[p[0]+dir[0]*144/fps,p[1]+dir[1]*81/fps];p=s.nearest(s.slide(p,end));assert(s.valid(p));}return p;}
assert.equal(keyboard(old,240,[800,650],[0,1])[1],650,'重現舊版 240Hz 垂直移動完全失效');
assert.equal(keyboard(old,360,[800,650],[1,0])[0],800,'重現舊版 360Hz 水平移動完全失效');
for(const fps of [30,60,120,144,165,240,360]){
 for(const dir of [[1,0],[-1,0],[0,1],[0,-1]]){
  const p=keyboard(scene,fps,[800,650],dir);
  assert(Math.abs(p[0]-(800+dir[0]*144))<1e-6);
  assert(Math.abs(p[1]-(650+dir[1]*81))<1e-6);
 }
 // 左攤位附近起步，點地板繞過告示牌及坐墊。
 for(const start of [[270,600],[300,630],[320,500]]){
  let p=scene.nearest(start),a={x:p[0]/1600,y:p[1]/900,tx:600/1600,ty:700/900},arrived=false;
  for(let f=0;f<fps*15;f++){
   const t=scene.target(a),dx=t[0]*1600-a.x*1600,dy=t[1]*900-a.y*900,d=Math.hypot(dx,dy);
   if(d<6&&!a._sceneTransit){arrived=true;break;}
   const step=Math.min(165/fps,d),prev=[a.x*1600,a.y*900];
   p=scene.nearest([prev[0]+dx/d*step,prev[1]+dy/d*step]);
   assert(scene.clear(prev,p),'走路不得穿過家具');a.x=p[0]/1600;a.y=p[1]/900;
  }
  assert(arrived,'攤位附近卡住 '+JSON.stringify({fps,start}));
 }
}
console.log('PASS: 舊版高更新率凍結已重現；七種更新率方向鍵速度一致、21 條攤位離開路線抵達且無穿模');
