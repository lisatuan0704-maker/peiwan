const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),cp=require('child_process');
const load=src=>{const c={};vm.createContext(c);vm.runInContext(src,c);return c.TTScene};
const s=load(fs.readFileSync('lobby-ui/scene.js','utf8'));
const old=load(cp.execFileSync('git',['show','90a08c9:lobby-ui/scene.js'],{encoding:'utf8'}));
assert(old.valid([1280,350]),'舊版允許角色貼近吧台斜角');
for(let y=343;y<=368;y++)for(let x=1221;x<=1290;x++){
 assert(!s.valid([x,y]),'斜角必須預留身體空間');
 const p=s.nearest([x,y]);assert(s.valid(p));assert(p[0]<=1218,'舊位置須回到安全通道');
}
for(const from of [[1280,350],[1210,350],[800,520],[320,500]]){
 let p=s.nearest(from),last=p;
 for(const goal of [[1280,350],[700,350],[800,520]]){
  const end=s.nearest(goal),path=s.route(p,goal);last=p;
  for(const q of path){assert(s.clear(last,q));last=q;}
  assert(Math.hypot(last[0]-end[0],last[1]-end[1])<1);
 }
}
let p=[1200,350];for(let i=0;i<300;i++)p=s.slide(p,[p[0]+.25,p[1]]);
assert(p[0]<=1218.5);assert(s.valid(p));
assert(s.valid([1150,350]));assert.equal(s.lift(1150/1600,350/900),40);
console.log('PASS: 1820 個斜角位置受阻並可校正、12 條進出路線、鍵盤邊界、中央露頭保留');
