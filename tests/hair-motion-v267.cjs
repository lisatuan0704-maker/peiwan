const assert=require('node:assert/strict'),hair=require('../lobby-ui/hair-motion.js');
const src={data:new Uint8ClampedArray(64*64*4)};
for(let y=8;y<57;y++)for(let x=15;x<23;x++){const k=(y*64+x)*4;src.data.set([180,y+80,150,255],k)}
for(const mode of ['idle','walk'])for(let phase=0;phase<(mode==='idle'?4:8);phase++){
 const d=hair.deform(src,mode,phase).data;
 // 頭頂原始像素不得位移；所有補色都必須來自原髮色，背景不能塗滿。
 for(let y=8;y<22;y++)for(let x=15;x<23;x++)assert.equal(d[(y*64+x)*4+3],255);
 let count=0;for(let k=0;k<d.length;k+=4)if(d[k+3]){count++;assert.equal(d[k],180);assert.equal(d[k+2],150);assert(d[k+1]>=88&&d[k+1]<=136)}
 assert(count<600&&count>=350);assert.equal(d[(40*64+40)*4+3],0);
 // 髮尾不能斷裂成不相連的區塊（四向相鄰）。
 const start=d.findIndex((v,i)=>i%4===3&&v>0)>>2,seen=new Set([start]),q=[start];
 for(let z=0;z<q.length;z++){const k=q[z];for(const v of [k-1,k+1,k-64,k+64])if(v>=0&&v<4096&&d[v*4+3]&&!seen.has(v)){seen.add(v);q.push(v)}}
 assert.equal(seen.size,count);
}
assert.equal(hair.amplitude,1.5);console.log('PASS: 12 hair phases, fixed crown, connected hair strands, local hair colors, transparent background preserved');

// 髮尾只到 40px 的短髮也必須保留大幅度，不能因固定 56px 權重而消失。
const short={data:new Uint8ClampedArray(64*64*4)};
for(let y=12;y<=40;y++)for(let x=15;x<=48;x++)short.data.set([200,120,160,255],(y*64+x)*4);
const widths=[];for(let i=0;i<4;i++){const d=hair.deform(short,'idle',i).data;let lo=64,hi=0;for(let y=39;y<43;y++)for(let x=0;x<64;x++)if(d[(y*64+x)*4+3]){lo=Math.min(lo,x);hi=Math.max(hi,x)}widths.push(hi-lo+1)}
assert(Math.max(...widths)-Math.min(...widths)>=8);
console.log('PASS: short hair reaches full large sway and visibly expands/contracts');
