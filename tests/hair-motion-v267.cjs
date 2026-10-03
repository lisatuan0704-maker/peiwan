const assert=require('node:assert/strict'),hair=require('../lobby-ui/hair-motion.js'),reference=require('./fixtures/prototype-warp-v270.cjs');
const src={data:new Uint8ClampedArray(64*64*4)};
for(let y=8;y<58;y++)for(let x=10;x<54;x++){if(x>24&&x<28&&y>32&&y<38)continue;src.data.set([180,y+80,x+110,255],(y*64+x)*4)}
for(const mode of ['idle','walk'])for(let phase=0;phase<(mode==='idle'?4:8);phase++)for(const kind of ['hair','tail','body','cloth','rigid']){
 const walking=mode==='walk',bs=walking?[0,-1,0,-1,0,-1,0,-1]:[0,-1,-1,0],n=bs.length,i=phase,p=(i+n-1)%n,b=bs[i],bp=bs[p],lean=[1,0,-1,0,1,0,-1,0],arm=walking?lean[i]:0,L=walking?lean[i]:0,Lp=walking?lean[p]:0;
 const w=y=>{const t=(y-(kind==='tail'?40:22))/(kind==='tail'?16:34);return t<=0?0:t>=1?1:Math.pow(t,1.15)};
 let vy,dx,mirror=false;
 if(kind==='hair'||kind==='tail'){
  vy=y=>Math.round(b*(1-w(y))+bp*w(y));
  dx=y=>{let v=Math.round(L*(1-w(y))+Lp*w(y));if(walking){const z=w(y)*1.5;v+=Math.round(z*(-.7+1.8*Math.sin(Math.PI*2*i/8-2.4*z)))}else v+=Math.round(w(y)*[1.5,.5,0,.5][i]*1.5);return v};mirror=!walking;
 }else if(kind==='body'||kind==='cloth'){
  vy=(y,x)=>(y<=46?b:0)+(arm&&x>=40&&y>=38&&y<=47?arm:arm&&x<=27&&y>=42&&y<=50?-arm:0);dx=y=>y<=46?L:(kind==='cloth'&&y<=49?Lp:0);
 }else{vy=()=>b;dx=()=>L;}
 const expected=reference(src,vy,dx,mirror).data,actual=hair.deform(src,mode,phase,kind).data;
 for(let k=0;k<expected.length;k+=4)if(expected[k+3]||!['hair','tail'].includes(kind))assert.deepEqual([...actual.slice(k,k+4)],[...expected.slice(k,k+4)],mode+phase+kind+' pixel '+k/4);
 for(let y=52;y<58;y++)for(let x=28;x<38;x++)if(kind==='body'||kind==='cloth')assert.deepEqual([...actual.slice((y*64+x)*4,(y*64+x)*4+4)],[...src.data.slice((y*64+x)*4,(y*64+x)*4+4)]);
}
assert.equal(hair.amplitude,1.5);
assert.notDeepEqual(hair.deform(src,'idle',0,'body').data,hair.deform(src,'idle',1,'body').data);
console.log('PASS: 60 layer/phase combinations match original prototype sampling, grounded feet, coordinated body/head/hair, 1.5 amplitude');
