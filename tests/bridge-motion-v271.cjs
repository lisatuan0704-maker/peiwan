const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),hair=require('../lobby-ui/hair-motion.js');
const bridge=fs.readFileSync('tavern-ui-bridge.js','utf8'),html=fs.readFileSync('lobby.html','utf8');
const code=bridge.slice(bridge.indexOf('  const oldAcc='),bridge.indexOf('  async function wear('));
class Canvas{
 constructor(){this.data=new Uint8ClampedArray(64*64*4);this.dataset={};}
 getContext(){const c=this;return {imageSmoothingEnabled:false,clearRect:()=>c.data.fill(0),getImageData:()=>({data:c.data.slice(),width:64,height:64}),createImageData:()=>({data:new Uint8ClampedArray(c.data.length)}),putImageData:dd=>c.data.set(dd.data),drawImage:f=>{for(let k=0;k<c.data.length;k+=4)if(f.data[k+3])c.data.set(f.data.slice(k,k+4),k)}};}
}
const src={data:new Uint8ClampedArray(64*64*4)};for(let y=10;y<55;y++)for(let x=12;x<52;x++)src.data.set([170,y+70,200,255],(y*64+x)*4);
let forwarded;
const context={window:{TTHairMotion:hair},TTHairMotion:hair,document:{createElement:()=>new Canvas()},Date,JSON,Map,csPick:()=>null,csAccList:d=>d.uiAccessories||[],csAccZ:p=>p.z,csAccBy:d=>d.uiAccessories||[],group:()=> 'head',csDrawV:g=>{const dd=g.createImageData();dd.data.set([250,180,100,255],(12*64+30)*4);g.putImageData(dd);},drawDollTo:(cv,d,pose,...opts)=>{forwarded=[cv,d,pose,...opts];cv.data.set(opts[0]?hair.deform(src,opts[0].mode,opts[0].phase).data:src.data);}};
vm.createContext(context);vm.runInContext(code,context);
const start=html.indexOf('function setFrame(a,p)'),end=html.indexOf('function pickTarget',start);vm.runInContext(html.slice(start,end),context);
const a={b:{doll:{}},cv:new Canvas(),frames:Object.fromEntries(['idle','a','a2','b','b2'].map(p=>[p,new Canvas()]))};
for(const f of Object.values(a.frames))f.data.set(src.data);
for(const mode of ['idle','walk']){
 const images=new Set();for(let phase=0;phase<(mode==='idle'?4:8);phase++){
  a._hairMotion={mode,phase};context.setFrame(a,mode==='idle'?'idle':['a','a2','b','b2'][phase%4]);
  assert.equal(forwarded[3],a._hairMotion,'bridge must pass original motion object');assert.deepEqual(a.cv.data,hair.deform(src,mode,phase).data);
  images.add(Buffer.from(a.cv.data).toString('base64'));
 }assert(images.size>=4,'visible pixels must change through bridge + frame cache');
}
const cv=new Canvas(),d={uiAccessories:[{z:'headTop'}]},motion={mode:'idle',phase:1};context.drawDollTo(cv,d,'idle',motion,'future-option');assert.equal(forwarded[4],'future-option');
assert.equal(cv.data[(11*64+30)*4],250,'head accessory follows head moving upward');
assert(html.includes('tavern-ui-bridge.js?v=271'));
console.log('PASS: actual bridge + setFrame forward animation, 12 live-cache phases change pixels, head accessories follow motion, future arguments preserved');
