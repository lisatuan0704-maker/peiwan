const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').join(__dirname,'../');
const html=fs.readFileSync(root+'lobby.html','utf8');let scripts=0;
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc=|application\/ld\+json/.test(m[1])){new vm.Script(m[2]);scripts++;}
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'lobby-ui/scene.js','utf8'),ctx);const s=ctx.TTScene;
const spots=[[640,738],[600,305],[1050,305],[900,490],[155,490],[120,805],[850,820],[1450,590]];
let paths=0,segments=0;
for(const a of spots)for(const b of spots){let last=s.nearest(a);const route=s.route(a,b);assert(Math.hypot(route.at(-1)[0]-b[0],route.at(-1)[1]-b[1])<1);for(const p of route){assert(s.clear(last,p));for(let t=0;t<=1;t+=.01)assert(s.valid([last[0]+(p[0]-last[0])*t,last[1]+(p[1]-last[1])*t]));last=p;segments++;}paths++;}
// 真正的逐幀點擊走路：不可在轉角停住、穿過吧台或永遠到不了終點。
for(const b of spots){const a={x:.4,y:.82,tx:b[0]/1600,ty:b[1]/900};let arrived=false;for(let frame=0;frame<5000;frame++){const aim=s.target(a),dx=aim[0]*1600-a.x*1600,dy=aim[1]*900-a.y*900,d=Math.hypot(dx,dy);if(d<6){arrived=true;break;}const step=Math.min(2.5,d);const p=s.nearest([a.x*1600+dx/d*step,a.y*900+dy/d*step]);a.x=p[0]/1600;a.y=p[1]/900;assert(s.valid(p));}assert(arrived);assert(Math.hypot(a.x*1600-b[0],a.y*900-b[1])<7);}
// 持續朝障礙物推進，腳底仍停在碰撞區外；側向移動可沿邊行走。
let p=[800,480];for(let i=0;i<200;i++){p=s.slide(p,[p[0],p[1]-3]);assert(s.valid(p));}assert(p[1]>=430);
p=[800,340];for(let i=0;i<200;i++){p=s.slide(p,[p[0],p[1]+3]);assert(s.valid(p));}assert(p[1]<=352);
assert(s.size(334/900)<s.size(873/900));
console.log(JSON.stringify({inlineScripts: scripts,routePairs:paths,clearSegments:segments,arrivalTests:spots.length,keyboardCollision:'passed',perspective:'passed'}));
