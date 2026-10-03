const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../lobby-ui/scene.js'),'utf8'),ctx);const s=ctx.TTScene;
assert(s.valid([700,350]),'behind-counter corridor remains open');
assert(!s.valid([700,380]),'cannot stand through tabletop');
assert(!s.valid([210,630]),'cushion footprint blocks walking');
assert(s.lift(700/1600,350/900)===40);assert(s.lift(700/1600,520/900)===0);
const spots=[[700,350],[1150,350],[320,500],[800,520],[1050,700],[350,820],[1450,750]];let routes=0;
for(const a of spots)for(const b of spots){let last=s.nearest(a);const end=s.nearest(b);for(const p of s.route(a,b)){assert(s.clear(last,p),'route crosses obstacle');last=p;}assert(Math.hypot(last[0]-end[0],last[1]-end[1])<1,'route fails to connect floor regions');routes++;}
let seed=265;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
for(let n=0;n<200;n++){const a=s.nearest([rand()*1600,rand()*900]),b=s.nearest([rand()*1600,rand()*900]);let last=a;for(const p of s.route(a,b)){assert(s.clear(last,p),'random route crosses furniture '+JSON.stringify({a,b,last,p}));last=p;}assert(Math.hypot(last[0]-b[0],last[1]-b[1])<1,'random destination disconnected');}
for(const goal of spots){let p=s.nearest([800,520]);const a={x:p[0]/1600,y:p[1]/900,tx:goal[0]/1600,ty:goal[1]/900};let arrived=false;for(let f=0;f<7000;f++){const t=s.target(a),dx=t[0]*1600-a.x*1600,dy=t[1]*900-a.y*900,d=Math.hypot(dx,dy);if(d<3&&!a._sceneTransit){arrived=true;break;}const step=Math.min(2.5,d);p=s.nearest([a.x*1600+dx/d*step,a.y*900+dy/d*step]);assert(s.valid(p));a.x=p[0]/1600;a.y=p[1]/900;}assert(arrived,'actor gets stuck');}
console.log('PASS: '+routes+' region routes, 200 random routes, 7 animated arrivals, furniture collisions, behind-counter head visibility');
