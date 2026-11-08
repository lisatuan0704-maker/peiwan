/* 家具扭蛋 v3（D 11/07：特效好假好廉價 → 改做像素偽 3D，演出先做好再轉像素）
   流程：3D 場景（卡通打光）→ 泛光 → 轉像素（OKLab 找最近的色盤色＋4×4 抖動點）→ 疊上卡片層與字卡層（不轉色，家具原色）。
   所有演出都是「時間 s 的函式」（粒子用公式算位置），所以可以任意跳到某一格檢查（G.seek）。 */
import * as THREE from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
THREE.ColorManagement.enabled=false;   // 顏色一律照 sRGB 字面值，跟像素色盤一致

const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const cv=$('cv'),ui=$('ui'),stageEl=$('stage');
const PRICE1=120,PRICE10=1200;
// 正式版（v504 D「上酒館大廳」）：放在大廳小屋的扭蛋視窗裡時，貓貓幣、背包、抽卡都交給大廳（parent.TTGachaHost）——結果由付款主機抽，這頁只負責演出
const HOST=(()=>{try{return window.parent!==window&&window.parent.TTGachaHost?window.parent.TTGachaHost:null;}catch(e){return null;}})(),LIVE=!!HOST;
if(LIVE)document.documentElement.classList.add('live');
const RATE={common:79,rare:18,limited:3},RANK={common:0,rare:1,limited:2};
const RN={common:['普通','COMMON'],rare:['稀有','RARE'],limited:['限定','LIMITED']};

// ---------- 小工具 ----------
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,u)=>a+(b-a)*u,sat=v=>clamp(v,0,1);
const EZ={lin:t=>t,out:t=>1-Math.pow(1-t,3),in:t=>t*t*t,inout:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,sine:t=>.5-.5*Math.cos(Math.PI*t),
  back:t=>{const c=1.6;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);},out5:t=>1-Math.pow(1-t,5),in2:t=>t*t};
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const seg=(s,a,b)=>sat((s-a)/(b-a));
const decay=(s,t,d)=>s<t?0:Math.exp(-(s-t)/d);
const C=h=>new THREE.Color(h);
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16),bay=(x,y)=>BAY[(y&3)*4+(x&3)];

// ---------- 尺寸：畫布高約 330 點，整數倍放大 ----------
let S=2,W=640,H=360;
// 手機直立時也看寬度，不然介面會擠爆
function measure(){S=Math.max(1,Math.round(Math.min(innerHeight/330,innerWidth/200)));S=Math.min(S,Math.max(2,Math.round(innerWidth/600)));   // 接近正方形的視窗別把像素放太大：內部至少約 600 寬，十連的房間才擺得下十件（最小還是 2 倍）
W=Math.ceil(innerWidth/S);H=Math.ceil(innerHeight/S);W+=W&1;H+=H&1;
  stageEl.style.width=W*S+'px';stageEl.style.height=H*S+'px';document.documentElement.style.setProperty('--s',S);}
measure();

// ---------- 色盤（像素化時每一點都會被換成這裡最接近的顏色） ----------
const PALETTE=['#1a1028','#241638','#2f1d4a','#3b2559','#4b2f6c','#5e3b82','#734896','#8a58a8','#3a2622','#5a3438',
  '#7d3a63','#a24a75','#c8648a','#e27d9c','#f290a8','#ffb3c0','#ffd4dc','#ffeef2',
  '#c99a8e','#e9b9b4','#f3d3c4','#fbe1cf','#fff1e3','#fff6ec','#ffffff',
  '#5a48a0','#7a64c8','#9a86e6','#b8a2ff','#d4c6ff','#ebe4ff',
  '#8a4b22','#b8692a','#d9952f','#f2b53e','#ffd25e','#ffe27a','#fff3c2',
  '#3f7f78','#5fae9a','#8fd9bb','#bff0da','#e6fff3','#5b6fd6','#8ec8ff','#d2f0ff',
  '#c06a4a','#e39a5c','#ffc58f','#ffe2c2','#9a5f9e','#c27fb8','#d98fb6','#f4b8cf',
  '#5c4a63','#7a6680','#9a8499','#bba3b2','#d9c4cc','#b8907e','#9cb35e','#7a9450','#56703f'];   // 淡紫灰中間色：變暗＋打光時不會被拉去青綠色
function oklab(hex){const c=C(hex);const f=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);const r=f(c.r),g=f(c.g),b=f(c.b);
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  return V3(.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s);}

// ---------- 稀有度配色 ----------
const CAPC={pink:['#ffd4dc','#f290a8','#c8648a'],peach:['#ffe2c2','#ffc58f','#e39a5c'],common:['#d8f8ea','#9fe0c4','#5fae9a'],rare:['#ebe4ff','#b8a2ff','#7a64c8'],limited:['#fff3c2','#ffd25e','#d9952f']};
const GLOW={common:[1,.82,.9],rare:[.74,.6,1],limited:[1,.74,.3]};
const SPK={common:{a:[1,.8,.88],b:[.55,.3,.45]},rare:{a:[.78,.64,1],b:[.3,.2,.55]},limited:{a:[1,.8,.38],b:[.62,.26,.1]}};
const CONF={common:['#ffb3c0','#ffd4dc','#bff0da','#fff6ec'],rare:['#d4c6ff','#b8a2ff','#ffd4dc','#ffffff','#8ec8ff'],limited:['#ffe27a','#ffd25e','#ffb3c0','#d4c6ff','#ffffff','#bff0da']};

// ---------- 渲染器 ----------
const R=new THREE.WebGLRenderer({canvas:cv,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
R.setPixelRatio(1);R.outputColorSpace=THREE.LinearSRGBColorSpace;
const world=new THREE.Scene(),cardScene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(30,W/H,.1,300);
const RESU={value:new THREE.Vector2(W,H)};
let rtW,rtC,rtB,bloom;
function makeTargets(){R.setSize(W,H,false);RESU.value.set(W,H);
  rtW?.dispose();rtC?.dispose();rtB?.dispose();
  {const k=Math.max(1,Math.min(S,Math.floor(2560/W)));rtB=new THREE.WebGLRenderTarget(W*k,H*k,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});}   // 背景原畫用螢幕解析度畫（不轉像素，低解析度會糊）
  rtW=new THREE.WebGLRenderTarget(W,H,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  rtC=new THREE.WebGLRenderTarget(W,H,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  if(!bloom){bloom=new UnrealBloomPass(new THREE.Vector2(W,H),.4,.14,1.0);addB(bloom.blendMaterial);}bloom.setSize(W,H);
  // 視窗大小變了：卡片與字卡那層的貼圖要整張重建（舊貼圖的尺寸固定，沿用會被拉寬或整層不見）
  if(!ovTex||ovc.width!==W||ovc.height!==H){ovc.width=W;ovc.height=H;octx.imageSmoothingEnabled=false;ovTex?.dispose();ovTex=mkOvTex();if(FINAL)FINAL.uniforms.tO.value=ovTex;}}
const ovc=document.createElement('canvas'),octx=ovc.getContext('2d');
const mkOvTex=()=>{const t=new THREE.CanvasTexture(ovc);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;};
let ovTex=null,FINAL=null;

// 最後一道：轉像素
FINAL=new THREE.ShaderMaterial({uniforms:{tW:{value:null},tC:{value:null},tO:{value:ovTex},tB:{value:null},tR:{value:null},uBg:{value:0},uRoom:{value:0},uBgDim:{value:0},uRes:RESU,uPL:{value:[...PALETTE.map(oklab),...Array(64-PALETTE.length).fill(0).map(()=>V3(9,9,9))]},uPR:{value:[...PALETTE.map(C),...Array(64-PALETTE.length).fill(0).map(()=>C('#000000'))]},uN:{value:PALETTE.length},
  uFlash:{value:new THREE.Vector4(1,1,1,0)},uDith:{value:.075},uImp:{value:new THREE.Vector4(1,1,1,0)},uImpD:{value:C('#2f1d4a')}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`precision highp float;uniform sampler2D tW,tC,tO,tB,tR;uniform float uBg,uRoom,uBgDim;uniform vec2 uRes;uniform vec3 uPL[64];uniform vec3 uPR[64];uniform int uN;uniform vec4 uFlash,uImp;uniform vec3 uImpD;uniform float uDith;varying vec2 vUv;
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 lab(vec3 c){c=toLin(clamp(c,0.,1.));float l=.4122214708*c.r+.5363325363*c.g+.0514459929*c.b;float m=.2119034982*c.r+.6806995451*c.g+.1073969566*c.b;float s=.0883024619*c.r+.2817188376*c.g+.6299787005*c.b;
l=pow(max(l,0.),1./3.);m=pow(max(m,0.),1./3.);s=pow(max(s,0.),1./3.);return vec3(.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s);}
float b2(vec2 a){return a.x*2.+a.y*3.-4.*a.x*a.y;}
float bayer(vec2 p){vec2 q=mod(p,4.);return(b2(mod(q,2.))*4.+b2(floor(q/2.))+.5)/16.;}
void main(){vec2 px=floor(vUv*uRes);vec4 w4=texture2D(tW,vUv);vec3 c=w4.rgb;bool bg=uBg>.5&&w4.a<.99;   /* 3D 沒畫到的地方＝背景原畫（光效是加上去的） */
if(bg)c=mix(texture2D(tB,vUv).rgb,vec3(.16,.09,.24),uBgDim)+c;
float mx=max(c.r,max(c.g,c.b));if(mx>1.){c/=mx;c=mix(c,vec3(1.),clamp((mx-1.)*.35,0.,.8));}
c=mix(c,uFlash.rgb,uFlash.a);
vec3 L0=lab(clamp(c,0.,1.));float b0=1e9;vec3 q0=vec3(0.);for(int i=0;i<64;i++){if(i>=uN)break;vec3 d=L0-uPL[i];float e=dot(d,d);if(e<b0){b0=e;q0=uPR[i];}}
vec3 L=lab(clamp(c+(bayer(px)-.5)*uDith,0.,1.));float best=1e9;vec3 q=vec3(0.);
for(int i=0;i<64;i++){if(i>=uN)break;vec3 d=L-uPL[i];float e=dot(d,d);if(e<best){best=e;q=uPR[i];}}
if(b0<.00012)q=q0;
if(bg)q=clamp(c,0.,1.);
if(uImp.a>.5){float on=step(.86,dot(c,vec3(.3,.55,.15)));if(uImp.a>1.5)on=1.-on;q=mix(uImpD,uImp.rgb,on);}   /* 衝擊格：只剩亮／暗兩色（漫畫的衝擊畫面），第二格反白 */
if(uRoom>.5){vec4 rm=texture2D(tR,vUv);q=mix(q,mix(rm.rgb,uFlash.rgb,uFlash.a),rm.a);}
vec4 cc=texture2D(tC,vUv);q=mix(q,cc.rgb,cc.a);vec4 o=texture2D(tO,vUv);q=mix(q,o.rgb,o.a);gl_FragColor=vec4(q,1.);}`});
const fsq=new FullScreenQuad(FINAL);

// ---------- 材質 ----------
const BLANK=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);BLANK.needsUpdate=true;
const GU={uSMOn:{value:0},uSM:{value:null},uSMM:{value:new THREE.Matrix4()},uKey:{value:V3(-.55,.75,.62).normalize()},uPLp:{value:V3(0,0,0)},uPLc:{value:new THREE.Color(0,0,0)},uPLi:{value:0},uDim:{value:0},uDimC:{value:C('#1a1028')}};
const TOON_V=`varying vec3 vN;varying vec3 vW;varying vec2 vUv;void main(){vUv=uv;vec4 lp=vec4(position,1.);vec3 ln=normal;
#ifdef USE_INSTANCING
lp=instanceMatrix*lp;ln=mat3(instanceMatrix)*ln;
#endif
vec4 w=modelMatrix*lp;vW=w.xyz;vN=normalize(mat3(modelMatrix)*ln);gl_Position=projectionMatrix*viewMatrix*w;}`;
const TOON_F=`uniform sampler2D uSM;uniform mat4 uSMM;uniform float uSMOn;uniform vec3 uLit,uMid,uShd,uRimC,uEmis,uMapC,uKey,uPLp,uPLc,uDimC;uniform float uRim,uPLi,uDim,uSpec;uniform vec2 uMapI;uniform sampler2D uMap;
varying vec3 vN;varying vec3 vW;varying vec2 vUv;
void main(){vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;vec3 V=normalize(cameraPosition-vW);
float d=dot(N,uKey);float lv=d>.42?2.:(d>-.12?1.:0.);if(uSMOn>.5&&lv>.5){vec4 q=uSMM*vec4(vW+N*.05,1.);vec3 sp=q.xyz*.5+.5;if(sp.x>0.&&sp.x<1.&&sp.y>0.&&sp.y<1.&&sp.z<1.&&sp.z-.0015>texture2D(uSM,sp.xy).r)lv-=1.;}vec3 c=lv>1.5?uLit:(lv>.5?uMid:uShd);
if(!gl_FrontFacing)c=uShd*.8;
if(uSpec>0.){float s=dot(reflect(-uKey,N),V);if(s>.88)c=mix(c,vec3(1.),uSpec);}
float fr=1.-max(dot(N,V),0.);if(uRim>0.&&fr>.68&&d>-.4)c=mix(c,uRimC,uRim);
vec3 L=uPLp-vW;float dl=length(L);float pl=max(dot(N,L/max(dl,.001)),0.)*uPLi/(1.+dl*dl*.4);c+=uPLc*floor(pl*4.+.5)/4.;
c=mix(c,uDimC,uDim);c+=uEmis;vec4 m=texture2D(uMap,vUv);c+=uMapC*dot(m.rg,uMapI);gl_FragColor=vec4(c,1.);}`;
function toon(lit,mid,shd,o={}){const u={...GU,uLit:{value:C(lit)},uMid:{value:C(mid)},uShd:{value:C(shd)},uRimC:{value:C(o.rim||'#ffffff')},uRim:{value:o.rimA||0},
  uEmis:{value:new THREE.Color(0,0,0)},uMap:{value:o.map||BLANK},uMapC:{value:new THREE.Color(0,0,0)},uMapI:{value:new THREE.Vector2(0,0)},uSpec:{value:o.spec||0}};
  if(o.noDim)u.uDim={value:0};
  return new THREE.ShaderMaterial({uniforms:u,vertexShader:TOON_V,fragmentShader:TOON_F,side:o.side||THREE.FrontSide});}
// 描邊：背面往外推 1 個像素（螢幕空間，遠近都一樣粗）
const OLM=new THREE.ShaderMaterial({uniforms:{uRes:RESU,uPx:{value:1},uInk:{value:C('#3a2622')},uDim:GU.uDim,uDimC:GU.uDimC},side:THREE.BackSide,
  vertexShader:`uniform vec2 uRes;uniform float uPx;void main(){vec4 w=modelMatrix*vec4(position,1.);vec4 c=projectionMatrix*viewMatrix*w;vec3 n=normalize(mat3(modelMatrix)*normal);
vec4 c2=projectionMatrix*viewMatrix*vec4(w.xyz+n*.02,1.);vec2 d=c2.xy/c2.w-c.xy/c.w;float l=length(d);d=l>1e-7?d/l:vec2(0.);c.xy+=d*uPx*2./uRes*c.w;gl_Position=c;}`,
  fragmentShader:`uniform vec3 uInk,uDimC;uniform float uDim;void main(){gl_FragColor=vec4(mix(uInk,uDimC,uDim*.5),1.);}`});
const OLN=OLM.clone();OLN.uniforms={...OLM.uniforms,uDim:{value:0}};   // 不受「場景變暗」影響的描邊（主角扭蛋）
const HC=new Map();
function hull(geo){if(HC.has(geo))return HC.get(geo);let g=geo.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);g=mergeVertices(g,1e-4);g.computeVertexNormals();HC.set(geo,g);return g;}
function ol(mesh,m=OLM){mesh.add(new THREE.Mesh(hull(mesh.geometry),m));return mesh;}
function mk(geo,mat,parent,p=[0,0,0],r=[0,0,0],s=[1,1,1],outline=true,olm=OLM){const m=new THREE.Mesh(geo,mat);m.position.set(...p);m.rotation.set(...r);m.scale.set(...s);parent.add(m);if(outline)ol(m,olm);return m;}
// 貼圖（臉、泡泡、硬幣面）：不打光
const TEX_F=`uniform sampler2D map;uniform float uDim,uOp;uniform vec3 uDimC;varying vec2 vUv;void main(){vec4 t=texture2D(map,vUv);if(t.a<.5||uOp<.5)discard;gl_FragColor=vec4(mix(t.rgb,uDimC,uDim),1.);}`;
const FX_V=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
function texMat(tex,o={}){return new THREE.ShaderMaterial({uniforms:{map:{value:tex},uDim:o.noDim?{value:0}:GU.uDim,uDimC:GU.uDimC,uOp:{value:1}},vertexShader:FX_V,fragmentShader:TEX_F,transparent:false,side:o.side||THREE.FrontSide});}
// 加亮的光效
const VOL_V=`varying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
// 加亮的光只加顏色、不改透明度：酒館那一鏡，3D 沒畫到的地方要露出背景原畫（光效不能把整塊矩形標成「有東西」）
const addB=m=>{m.blending=THREE.CustomBlending;m.blendEquation=THREE.AddEquation;m.blendSrc=THREE.SrcAlphaFactor;m.blendDst=THREE.OneFactor;m.blendSrcAlpha=THREE.ZeroFactor;m.blendDstAlpha=THREE.OneFactor;return m;};
const addMat=(frag,u,vert=FX_V,side=THREE.FrontSide)=>addB(new THREE.ShaderMaterial({uniforms:u,vertexShader:vert,fragmentShader:frag,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,side}));
const RAYS_F=`uniform float uI,uN,uRot,uSeed,uCore,uLen;uniform vec3 uC;varying vec2 vUv;
float h(float n){return fract(sin(n*12.9898+uSeed*78.233)*43758.5453);}
void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=atan(p.y,p.x)+uRot;float k=a/6.2831853*uN;float id=floor(k);float f=fract(k);
float w=mix(.1,.34,h(id));float beam=1.-smoothstep(w*.35,w,abs(f-.5));float len=mix(.45,1.,h(id+3.1))*uLen;
float fall=(1.-smoothstep(len*.2,len,r))*smoothstep(0.,.05,r);float core=exp(-r*r*22.)*uCore;
float v=beam*fall*mix(.55,1.,h(id+7.7))+core;v=floor(v*4.+.5)/4.;   /* 光分成幾階硬邊（像素畫的發光畫法），不要平滑漸層 */
gl_FragColor=vec4(uC*v*uI,1.);}`;
const GLOW_F=`uniform float uI;uniform vec3 uC;varying vec2 vUv;void main(){float r=length(vUv*2.-1.);float a=pow(max(0.,1.-r),2.2);a=floor(a*4.+.5)/4.;gl_FragColor=vec4(uC*a*uI,1.);}`;
// 結果畫面背後：硬邊的放射色塊（慢慢轉），分三圈越外越淡
const SUN_F=`uniform float uI,uN,uRot;uniform vec3 uC;varying vec2 vUv;void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=atan(p.y,p.x)+uRot;
float on=step(.5,fract(a/6.2831853*uN));float f=r<.36?1.:(r<.64?.62:(r<.9?.34:0.));gl_FragColor=vec4(uC*on*f*uI,1.);}`;
const RING_F=`uniform float uI,uR,uT;uniform vec3 uC;varying vec2 vUv;void main(){float r=length(vUv*2.-1.);float a=1.-smoothstep(0.,uT,abs(r-uR));a*=step(r,1.);gl_FragColor=vec4(uC*a*uI,1.);}`;
const VOL_F=`uniform float uI,uTop;uniform vec3 uC;varying vec2 vUv;varying vec3 vN;varying vec3 vW;
void main(){float f=abs(dot(normalize(vN),normalize(cameraPosition-vW)));float a=pow(f,2.2)*mix(1.,vUv.y,uTop)*smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.88,1.,vUv.y));a=floor(a*4.+.5)/4.;gl_FragColor=vec4(uC*a*uI,1.);}`;
const BB=[];   // 永遠面向鏡頭的板子
function board(frag,u,size=1){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),addMat(frag,u));m.scale.setScalar(size);m.frustumCulled=false;m.visible=false;BB.push(m);world.add(m);return m;}
const raysU=(n,seed,core=.8)=>({uI:{value:0},uN:{value:n},uRot:{value:0},uSeed:{value:seed},uCore:{value:core},uLen:{value:1},uC:{value:new THREE.Color(1,1,1)}});
const glowU=()=>({uI:{value:0},uC:{value:new THREE.Color(1,1,1)}});
const ringU=()=>({uI:{value:0},uR:{value:.5},uT:{value:.05},uC:{value:new THREE.Color(1,1,1)}});
const setC=(u,rgb,k=1)=>u.uC.value.setRGB(rgb[0]*k,rgb[1]*k,rgb[2]*k);

// ---------- 背景：漸層天空、星星、遠處慢轉的細線幾何、探照燈 ----------
const bgMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uRev:{value:0},uRevC:{value:new THREE.Color(1,1,1)},uDim:GU.uDim,uDimC:GU.uDimC},
  vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uRev,uDim;uniform vec3 uRevC,uDimC;varying vec3 vD;void main(){float y=floor(normalize(vD).y*44.+.5)/44.;   /* 分成一條一條色帶：像素畫天空的畫法，轉色後不會變成一片髒髒的網點 */
vec3 top=vec3(.10,.063,.157),mid=vec3(.23,.145,.35),hz=vec3(.54,.35,.66),low=vec3(.16,.10,.26);
vec3 c=y>.06?mix(hz,mid,smoothstep(.06,.32,y)):mix(low,hz,smoothstep(-.12,.06,y));c=y>.32?mix(mid,top,smoothstep(.32,.8,y)):c;
c+=vec3(.25,.12,.22)*exp(-pow((y-.04)/.07,2.));c+=uRevC*uRev*(.28+.3*exp(-pow((y-.1)/.25,2.)));c=mix(c,uDimC,uDim*.7);gl_FragColor=vec4(c,1.);}`});
world.add(new THREE.Mesh(new THREE.SphereGeometry(120,32,16),bgMat));
const starGeo=new THREE.BufferGeometry();{const r=rng(11),P=[],A=[];for(let i=0;i<320;i++){const a=r()*6.283,y=.06+r()*.94,rr=Math.sqrt(1-y*y);P.push(Math.cos(a)*rr*110,y*110,Math.sin(a)*rr*110);A.push(r()*100,r()<.15?2:1);}
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));starGeo.setAttribute('aS',new THREE.Float32BufferAttribute(A,2));}
const starMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uDim:GU.uDim},blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,
  vertexShader:`attribute vec2 aS;uniform float uTime;varying float vA;void main(){vA=.25+.75*max(0.,sin(uTime*.0011+aS.x));gl_PointSize=aS.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uDim;varying float vA;void main(){gl_FragColor=vec4(vec3(1.,.88,.96)*vA*.9*(1.-uDim*.6),1.);}`});
world.add(new THREE.Points(starGeo,starMat));
const GEO=[];{const r=rng(5);for(let i=0;i<7;i++){const n=i%3===0?3:4,pts=[];for(let k=0;k<n;k++){const a=k/n*6.283;pts.push(V3(Math.cos(a),Math.sin(a),0));}
  const ln=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:i%2?C('#7a64c8'):C('#a24a75'),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
  const a=-1.2+i/6*2.4;ln.position.set(Math.sin(a)*34,6+r()*12,-30+Math.cos(a)*-4);ln.scale.setScalar(3+r()*4);ln.userData={sp:(r()-.5)*.0006,ph:r()*6};world.add(ln);GEO.push(ln);}}
// 地板：菱形格（遠處慢慢淡進地平線）；開出好東西時舞台下方映出稀有色
const floorMat=new THREE.ShaderMaterial({uniforms:{uRev:{value:0},uRevC:{value:new THREE.Color(1,1,1)},uDim:GU.uDim,uDimC:GU.uDimC},vertexShader:VOL_V,
  fragmentShader:`uniform float uRev,uDim;uniform vec3 uRevC,uDimC;varying vec3 vW;void main(){vec2 p=vec2(vW.x+vW.z,vW.x-vW.z)*.4;float ck=mod(floor(p.x)+floor(p.y),2.);
float dc=length(cameraPosition.xz-vW.xz),d0=length(vW.xz);float fade=floor(smoothstep(9.,42.,dc)*4.+.5)/4.;
vec3 c=mix(vec3(.231,.145,.349),vec3(.29,.184,.42),ck*(1.-fade));c=mix(c,vec3(.27,.17,.38),fade);
c+=uRevC*uRev*.3*floor(exp(-d0*d0/50.)*4.+.5)/4.;c=mix(c,uDimC,uDim*.7);gl_FragColor=vec4(c,1.);}`});
const FLOORM=new THREE.Mesh(new THREE.CircleGeometry(48,72),floorMat);FLOORM.rotation.x=-Math.PI/2;FLOORM.position.y=-.34;world.add(FLOORM);

// ---------- 舞台 ----------
const stg=new THREE.Group();world.add(stg);
const STGM=toon('#f4b8cf','#d98fb6','#8a58a8',{rim:'#ffeef2',rimA:.6});mk(new THREE.CylinderGeometry(3.7,3.85,.34,72),STGM,stg,[0,-.17,0]);
mk(new THREE.TorusGeometry(3.4,.045,6,120),toon('#fff3c2','#ffd25e','#d9952f'),stg,[0,.005,0],[Math.PI/2,0,0],[1,1,1],false);
mk(new THREE.TorusGeometry(2.3,.03,6,100),toon('#ffeef2','#ffd4dc','#d98fb6'),stg,[0,.004,0],[Math.PI/2,0,0],[1,1,1],false);
// 舞台上的魔法陣（貓掌在中間），平常淡淡的、開出好東西時亮起來
const mcv=document.createElement('canvas');mcv.width=mcv.height=512;{const x=mcv.getContext('2d'),c=256;x.strokeStyle=x.fillStyle='#fff';x.lineCap='round';
  const ring=(r,w)=>{x.lineWidth=w;x.beginPath();x.arc(c,c,r,0,7);x.stroke();};ring(246,5);ring(232,2);ring(168,3);ring(150,1.5);ring(64,3);
  for(let i=0;i<72;i++){const a=i/72*Math.PI*2,l=i%6===0?14:6;x.lineWidth=i%6===0?3:1.5;x.beginPath();x.moveTo(c+Math.cos(a)*232,c+Math.sin(a)*232);x.lineTo(c+Math.cos(a)*(232-l),c+Math.sin(a)*(232-l));x.stroke();}
  x.lineWidth=2.5;x.beginPath();for(let i=0;i<=8;i++){const a=-Math.PI/2+i*3*Math.PI*2/8;const px=c+Math.cos(a)*226,py=c+Math.sin(a)*226;i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();
  for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4,px=c+Math.cos(a)*199,py=c+Math.sin(a)*199;x.beginPath();x.moveTo(px,py-9);x.lineTo(px+7,py);x.lineTo(px,py+9);x.lineTo(px-7,py);x.closePath();x.fill();}
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;x.beginPath();x.arc(c+Math.cos(a)*159,c+Math.sin(a)*159,i%2?2:3.5,0,7);x.fill();}
  x.beginPath();x.ellipse(c,c+12,22,17,0,0,7);x.fill();for(const[dx,dy]of[[-26,-14],[-10,-30],[10,-30],[26,-14]]){x.beginPath();x.arc(c+dx,c+dy,9,0,7);x.fill();}}
const mTex=new THREE.CanvasTexture(mcv);
const MAGIC_F=`uniform sampler2D map;uniform vec3 uC;uniform float uI;varying vec2 vUv;void main(){float a=texture2D(map,vUv).a;gl_FragColor=vec4(uC*a*uI,1.);}`;
const magic=new THREE.Mesh(new THREE.CircleGeometry(3.3,64),addMat(MAGIC_F,{map:{value:mTex},uC:{value:new THREE.Color(1,.95,.97)},uI:{value:.35}}));magic.rotation.x=-Math.PI/2;magic.position.y=.012;stg.add(magic);
function magicAt(s,k,amt){magic.rotation.z=s*.00006;const G=k?GLOW[k]:[1,.92,.95];magic.material.uniforms.uC.value.setRGB(G[0],G[1],G[2]);magic.material.uniforms.uI.value=.4+amt;}
const BULBS=[];{const g=new THREE.SphereGeometry(.075,8,6);for(let i=0;i<36;i++){const a=i/36*Math.PI*2,m=toon('#fff6ec','#f3d3c4','#c99a8e');const b=mk(g,m,stg,[Math.cos(a)*3.62,.02,Math.sin(a)*3.62]);BULBS.push(b);}}

// ---------- 扭蛋機（貓） ----------
const MC={pink:toon('#ffb3c0','#f290a8','#c8648a',{rim:'#ffeef2',rimA:.85}),cream:toon('#fff6ec','#fbe1cf','#e9b9b4',{rim:'#ffffff',rimA:.5}),
  knob:toon('#ffd4dc','#f290a8','#a24a75',{spec:.9}),gold:toon('#fff3c2','#ffd25e','#d9952f',{spec:1}),dark:toon('#5a3438','#3a2622','#2f1d4a'),ear:toon('#ffd4dc','#ffb3c0','#e27d9c'),lid:toon('#ffb3c0','#f290a8','#c8648a',{rim:'#ffeef2',rimA:.85}),earO:toon('#ffb3c0','#f290a8','#c8648a',{rim:'#ffeef2',rimA:.85})};
const mach=new THREE.Group();world.add(mach);const body=new THREE.Group();mach.add(body);
mk(new RoundedBoxGeometry(2.2,1.9,1.7,4,.36),MC.pink,body,[0,1.1,0]);
mk(new RoundedBoxGeometry(1.8,1.3,.12,3,.06),MC.cream,body,[0,1.25,.86]);
const FW=270,FH=195,fcv=document.createElement('canvas');fcv.width=FW;fcv.height=FH;const fctx=fcv.getContext('2d');
const faceTex=new THREE.CanvasTexture(fcv);faceTex.anisotropy=1;
const faceMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.3),new THREE.ShaderMaterial({uniforms:{map:{value:faceTex},uDim:GU.uDim,uDimC:GU.uDimC,uOp:{value:1}},vertexShader:FX_V,fragmentShader:TEX_F,transparent:true}));
faceMesh.position.set(0,1.25,.925);body.add(faceMesh);
const knob=new THREE.Group();knob.position.set(0,1.02,.93);body.add(knob);
mk(new THREE.CylinderGeometry(.37,.37,.13,32),MC.knob,knob,[0,0,.065],[Math.PI/2,0,0]);
mk(new RoundedBoxGeometry(.66,.15,.12,2,.05),MC.cream,knob,[0,0,.17]);
// 投幣口（D 11/07：要有「投進投幣口」的感覺 → 硬幣停在投幣口前、倒平對準橫的縫再推進去；投進去時投幣口亮一下）
const slotMat=toon('#fff3c2','#ffd25e','#d9952f',{spec:1});
mk(new RoundedBoxGeometry(.5,.17,.07,2,.03),slotMat,body,[0,1.66,.93]);
mk(new THREE.BoxGeometry(.36,.05,.04),MC.dark,body,[0,1.66,.965],[0,0,0],[1,1,1],false);
mk(new RoundedBoxGeometry(.74,.4,.12,2,.05),MC.dark,body,[0,.4,.82]);
const flap=new THREE.Group();flap.position.set(0,.58,.9);body.add(flap);
mk(new RoundedBoxGeometry(.64,.32,.04,2,.015),MC.cream,flap,[0,-.16,0]);
for(const[x,z]of[[-.72,.5],[.72,.5],[-.72,-.5],[.72,-.5]])mk(new THREE.SphereGeometry(.3,16,12),MC.pink,body,[x,.13,z],[0,0,0],[1,.55,1]);
mk(new THREE.TorusGeometry(1.0,.1,10,48),MC.gold,body,[0,2.08,0],[Math.PI/2,0,0]);
const domeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uGlow:{value:0},uGlowC:{value:new THREE.Color(1,1,1)},uDim:GU.uDim,uDimC:GU.uDimC},vertexShader:VOL_V,
  fragmentShader:`uniform float uGlow,uDim;uniform vec3 uGlowC,uDimC;varying vec3 vN;varying vec3 vW;varying vec2 vUv;
void main(){vec3 N=normalize(vN);vec3 V=normalize(cameraPosition-vW);float fr=1.-abs(dot(N,V));if(fr>.955){gl_FragColor=vec4(mix(vec3(.227,.149,.133),uDimC,uDim*.5),1.);return;}vec3 c=vec3(.85,.9,1.);float a=.06+pow(fr,3.)*.6;
/* 卡通玻璃反光：左上一道弧＋一顆小圓點（照螢幕方向畫，鏡頭怎麼轉都在左上） */
vec2 q=normalize((viewMatrix*vec4(N,0.)).xyz).xy;float rr=length(q),ang=atan(q.y,q.x);
if(rr>.7&&rr<.82&&ang>2.0&&ang<2.95){a=.92;c=vec3(1.);}else if(length(q-vec2(-.3,.46))<.085){a=.92;c=vec3(1.);}else if(length(q-vec2(.56,-.38))<.05){a=.6;c=vec3(1.);}
c=mix(c,uDimC,uDim*.6);c+=uGlowC*uGlow*(1.2-fr);a=max(a,uGlow*.55);gl_FragColor=vec4(c,a);}`});
const dome=new THREE.Mesh(new THREE.SphereGeometry(1.0,40,28),domeMat);dome.position.set(0,2.8,0);dome.renderOrder=2;body.add(dome);
// 玻璃罩上面的蓋子（D 11/07：貓耳直接黏在玻璃上、頂上一條粉紅弧線很不自然 → 改成實心的粉紅蓋子，貓耳從蓋子長出來）
{const LY=2.8+.8;   // 蓋子底邊的高度（玻璃球在這個高度的半徑約 .6）
  mk(new THREE.SphereGeometry(.74,32,16,0,Math.PI*2,0,Math.PI/2),MC.lid,body,[0,LY,0],[0,0,0],[1,.6,1]);
  mk(new THREE.TorusGeometry(.72,.065,8,40),MC.gold,body,[0,LY+.01,0],[Math.PI/2,0,0]);
  for(const sd of[-1,1]){mk(new THREE.ConeGeometry(.27,.48,24),MC.earO,body,[sd*.46,LY+.46,0],[0,0,-sd*.5]);
    mk(new THREE.ConeGeometry(.15,.31,16),MC.ear,body,[sd*.46,LY+.46,.12],[.2,0,-sd*.5],[1,1,.6],false);}
  mk(new THREE.SphereGeometry(.11,12,10),MC.gold,body,[0,LY+.48,0]);}
{const cv2=new THREE.CatmullRomCurve3([V3(.55,.5,-.8),V3(1.05,.6,-1.05),V3(1.42,1.0,-1.0),V3(1.48,1.55,-.85),V3(1.28,1.95,-.72),V3(1.42,2.2,-.62)]);
  const tg=new THREE.TubeGeometry(cv2,48,.15,12),pa=tg.attributes.position,P0=V3(),v=V3();for(let i=0;i<pa.count;i++){const sgi=Math.floor(i/13),u=sgi/48;cv2.getPointAt(u,P0);v.fromBufferAttribute(pa,i).sub(P0).multiplyScalar(lerp(1,.55,u)).add(P0);pa.setXYZ(i,v.x,v.y,v.z);}
  tg.computeVertexNormals();mk(tg,MC.pink,body);const tip=cv2.getPointAt(1);mk(new THREE.SphereGeometry(.1,12,10),MC.cream,body,[tip.x,tip.y,tip.z]);}
// 玻璃罩裡的小扭蛋
const MINI=[];{const r=rng(3),cols=[['#ffd4dc','#f290a8','#c8648a'],['#d8f8ea','#9fe0c4','#5fae9a'],['#ebe4ff','#b8a2ff','#7a64c8'],['#ffe2c2','#ffc58f','#e39a5c'],['#fff3c2','#ffd25e','#d9952f']].map(c=>toon(...c));
  const top=new THREE.SphereGeometry(.2,14,8,0,Math.PI*2,0,Math.PI/2),bot=new THREE.SphereGeometry(.2,14,8,0,Math.PI*2,Math.PI/2,Math.PI/2);const pos=[];
  for(let t=0;t<400&&pos.length<22;t++){const p=V3((r()-.5)*1.5,-.78+r()*.72,(r()-.5)*1.5);if(p.length()>.76)continue;if(pos.some(q=>q.distanceTo(p)<.37))continue;pos.push(p);}
  pos.forEach((p,i)=>{const g=new THREE.Group();g.position.copy(p).add(V3(0,2.8,0));g.rotation.set(r()*3,r()*3,r()*3);mk(top,cols[i%5],g);mk(bot,MC.cream,g);body.add(g);MINI.push({g,base:g.position.clone(),rot:g.rotation.clone(),ph:r()*6.28});});}
// 驚嘆號泡泡
const bcv=document.createElement('canvas');bcv.width=13;bcv.height=15;{const x=bcv.getContext('2d');x.fillStyle='#3a2622';x.fillRect(1,0,11,13);x.fillRect(0,1,13,11);x.fillRect(3,13,3,2);
  x.fillStyle='#fff';x.fillRect(2,1,9,11);x.fillRect(1,2,11,9);x.fillRect(4,12,1,1);x.fillStyle='#ff5f8f';x.fillRect(5,3,3,5);x.fillRect(5,9,3,2);}
const bubTex=new THREE.CanvasTexture(bcv);bubTex.magFilter=bubTex.minFilter=THREE.NearestFilter;bubTex.generateMipmaps=false;
const bubble=new THREE.Mesh(new THREE.PlaneGeometry(.52,.6),texMat(bubTex,{noDim:true}));bubble.visible=false;world.add(bubble);

// 臉（向量畫在 270×195，貼上去後由像素化統一顆粒）
let faceKey='';
function star5(x,cx,cy,R,r,fill,ink){x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R;x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}x.closePath();x.fillStyle=fill;x.fill();x.lineWidth=1.1;x.strokeStyle=ink;x.stroke();}
function drawFace(ex){if(ex===faceKey)return;faceKey=ex;const x=fctx;x.clearRect(0,0,FW,FH);x.save();x.scale(5,5);x.lineCap='round';x.lineJoin='round';const ink='#3a2622';
  const eye=(cx,cy,side)=>{x.strokeStyle=ink;x.fillStyle=ink;
    if(ex==='blink'){x.lineWidth=1.7;x.beginPath();x.moveTo(cx-4,cy+1.5);x.quadraticCurveTo(cx,cy+4.5,cx+4,cy+1.5);x.stroke();}
    else if(ex==='happy'){x.lineWidth=1.9;x.beginPath();x.moveTo(cx-4.6,cy+2.6);x.quadraticCurveTo(cx,cy-4.4,cx+4.6,cy+2.6);x.stroke();}
    else if(ex==='squint'){x.lineWidth=1.9;x.beginPath();const s=side;x.moveTo(cx-3.6*s,cy-3.6);x.lineTo(cx+3*s,cy);x.lineTo(cx-3.6*s,cy+3.6);x.stroke();}
    else if(ex==='wow'){x.lineWidth=1.7;x.beginPath();x.ellipse(cx,cy,3.5,4.6,0,0,7);x.stroke();}
    else if(ex==='star'){star5(x,cx,cy,6.4,2.9,'#ffd25e',ink);x.fillStyle='#fff';x.beginPath();x.arc(cx-1.3,cy-1.2,1.1,0,7);x.fill();}
    else{x.beginPath();x.ellipse(cx,cy,3.4,4.7,0,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.ellipse(cx-1.2,cy-1.9,1.3,1.7,0,0,7);x.fill();x.beginPath();x.arc(cx+1.4,cy+1.9,.65,0,7);x.fill();}};
  eye(11,9,1);eye(43,9,-1);
  x.fillStyle=ex==='open'||ex==='blink'?'#ffc4d0':'#ff8fab';for(const bx of[7,47]){x.beginPath();x.ellipse(bx,17.5,3.6,2,0,0,7);x.fill();}
  x.strokeStyle='#c8648a';x.lineWidth=.9;for(const[y,dy]of[[22,.8],[25.5,-.8]]){x.beginPath();x.moveTo(.5,y);x.lineTo(5.5,y+dy);x.stroke();x.beginPath();x.moveTo(53.5,y);x.lineTo(48.5,y+dy);x.stroke();}
  x.fillStyle='#f290a8';x.beginPath();x.ellipse(7,34,2.6,2,0,0,7);x.fill();for(const[a,b]of[[4.2,30.6],[6.4,29.4],[8.6,29.6],[10.2,31.2]]){x.beginPath();x.arc(a,b,1,0,7);x.fill();}
  x.beginPath();x.moveTo(47,36.5);x.bezierCurveTo(43,33.5,43.5,29.8,47,31.6);x.bezierCurveTo(50.5,29.8,51,33.5,47,36.5);x.fill();
  x.restore();faceTex.needsUpdate=true;}

// ---------- 扭蛋（主角＋十連用） ----------
function crackTex(seed){const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');const r=rng(seed);x.lineCap='round';
  for(const[ch,n]of[['#ff0000',4],['#00ff00',7]]){x.strokeStyle=ch;x.globalCompositeOperation='lighter';x.lineWidth=2.2;for(let i=0;i<n;i++){let u=r()*128,v=0;x.beginPath();x.moveTo(u,v);for(let k=0;k<4;k++){u+=(r()-.5)*26;v+=8+r()*9;x.lineTo(u,v);}x.stroke();}}
  const t=new THREE.CanvasTexture(c);return t;}
const CRK=crackTex(9);
const capTop=r=>new THREE.SphereGeometry(r,24,12,0,Math.PI*2,0,Math.PI/2),capBot=r=>new THREE.SphereGeometry(r,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2);
function makeCap(r,hero){const g=new THREE.Group(),top=new THREE.Group(),bot=new THREE.Group();g.add(top,bot);
  const mt=toon('#d8f8ea','#9fe0c4','#5fae9a',{noDim:hero,spec:.7,map:CRK,side:THREE.DoubleSide,rim:'#ffffff',rimA:.5}),mb=toon('#fffaf3','#fbe1cf','#e0b4a8',{noDim:hero,spec:.5,map:CRK,side:THREE.DoubleSide});
  const olm=hero?OLN:OLM;mk(capTop(r),mt,top,[0,0,0],[0,0,0],[1,1,1],true,olm);mk(capBot(r),mb,bot,[0,0,0],[0,0,0],[1,1,1],true,olm);
  const band=mk(new THREE.TorusGeometry(r*1.005,r*.07,6,32),toon('#ffffff','#f3d3c4','#c99a8e',{noDim:hero}),g,[0,0,0],[Math.PI/2,0,0],[1,1,1],false);
  g.visible=false;world.add(g);
  const o={g,top,bot,mt,mb,kind:'',r,setKind(k){if(k===o.kind)return;o.kind=k;const c=CAPC[k];mt.uniforms.uLit.value.set(c[0]);mt.uniforms.uMid.value.set(c[1]);mt.uniforms.uShd.value.set(c[2]);},
    // 快打開前：上下兩半撐開一條縫，縫裡透出稀有色的光
    seam(k,a){const G=GLOW[k],d=a*r*.11;top.position.set(0,d,0);bot.position.set(0,-d,0);band.material.uniforms.uEmis.value.setRGB(G[0]*a*1.1,G[1]*a*1.1,G[2]*a*1.1);band.scale.setScalar(1+a*.04);},
    glow(k,a){const G=GLOW[k];mt.uniforms.uEmis.value.setRGB(G[0]*a*.2,G[1]*a*.2,G[2]*a*.2);mb.uniforms.uEmis.value.setRGB(G[0]*a*.12,G[1]*a*.12,G[2]*a*.12);},
    crack(k,l1,l2){const G=GLOW[k];for(const m of[mt,mb]){m.uniforms.uMapC.value.setRGB(G[0]*1.8,G[1]*1.8,G[2]*1.8);m.uniforms.uMapI.value.set(l1,l2);}}};
  o.setKind('common');return o;}
const HERO=makeCap(.36,true);
const TENC=[...Array(10)].map(()=>makeCap(.27,true));   // 不跟著場景變暗：推近限定那顆時它要亮著
// 扭蛋殼碎片（爆開時飛出去，顏色跟主角扭蛋同一個材質）
const SHARDS=[];{const g1=new THREE.TetrahedronGeometry(.075),g2=new THREE.OctahedronGeometry(.055);for(let i=0;i<18;i++){const m=new THREE.Mesh(i%3?g1:g2,i%4===3?HERO.mb:HERO.mt);ol(m,OLN);m.visible=false;world.add(m);SHARDS.push(m);}}

// ---------- 舞台後面：三角旗＋燈串、遠處漂浮的大扭蛋 ----------
const FLAGS=[],LIGHTS=[],BGC=[];
{const sh=new THREE.Shape();sh.moveTo(-.27,0);sh.lineTo(.27,0);sh.lineTo(0,-.6);sh.closePath();const flagGeo=new THREE.ExtrudeGeometry(sh,{depth:.05,bevelEnabled:false});flagGeo.translate(0,0,-.025);
  const FC=[['#ffb3c0','#f290a8','#c8648a'],['#fff6ec','#fbe1cf','#e9b9b4'],['#d4c6ff','#b8a2ff','#7a64c8'],['#ffe27a','#ffd25e','#d9952f'],['#bff0da','#8fd9bb','#5fae9a']].map(c=>toon(...c,{side:THREE.DoubleSide}));
  const lineMat=new THREE.ShaderMaterial({uniforms:{uDim:GU.uDim,uDimC:GU.uDimC},vertexShader:FX_V,fragmentShader:`uniform float uDim;uniform vec3 uDimC;void main(){gl_FragColor=vec4(mix(vec3(.227,.149,.133),uDimC,uDim*.5),1.);}`});
  const bulbG=new THREE.SphereGeometry(.085,10,8);
  for(const[z,y0,hw,sag,n,sc]of[[-6.2,5.5,8.4,1.45,21,1],[-10.5,7.9,13,2.3,27,1.35]]){const cat=x=>y0-sag*(1-(x/hw)**2),pts=[];for(let i=0;i<=48;i++){const x=-hw+i/48*hw*2;pts.push(V3(x,cat(x),z));}
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));
    for(let i=0;i<n;i++){const x=-hw+(i+.5)/n*hw*2,y=cat(x);
      if(i%2===0){const f=new THREE.Group();f.position.set(x,y,z);f.rotation.z=Math.atan(2*sag*x/(hw*hw));f.scale.setScalar(sc);mk(flagGeo,FC[(i/2)%5],f);world.add(f);FLAGS.push({f,ph:i*.55+z});}
      else LIGHTS.push(mk(bulbG,toon('#fff6ec','#f3d3c4','#c99a8e'),world,[x,y-.1*sc,z],[0,0,0],[sc,sc,sc]));}}
  const r=rng(21),cols=[['#ffd4dc','#f290a8','#c8648a'],['#d8f8ea','#9fe0c4','#5fae9a'],['#ebe4ff','#b8a2ff','#7a64c8'],['#fff3c2','#ffd25e','#d9952f'],['#ffe2c2','#ffc58f','#e39a5c']];
  for(let i=0;i<10;i++){const a=-1.0+i/9*2.0+(r()-.5)*.12,R=19+r()*8,rad=.8+r()*.9,g=new THREE.Group();
    mk(capTop(rad),toon(...cols[i%5],{rim:'#ffffff',rimA:.45}),g);mk(capBot(rad),toon('#fffaf3','#fbe1cf','#e0b4a8'),g);
    mk(new THREE.TorusGeometry(rad*1.005,rad*.07,6,32),toon('#ffffff','#f3d3c4','#c99a8e'),g,[0,0,0],[Math.PI/2,0,0],[1,1,1],false);
    g.position.set(Math.sin(a)*R,.8+r()*6.5,-Math.cos(a)*R);g.userData={y:g.position.y,ph:r()*6.28,sp:.6+r()*.6,rx:r()*6,rz:(r()-.5)*1.2};world.add(g);BGC.push(g);}}

// ---------- 第二個鏡頭：酒館大門（D 11/07：用犬尤的酒館原畫當參考、GPT 畫的「從外面看的正門」當背景；3D 的扭蛋、門板、家具疊在上面）----------
// 背景圖 tavern/gpt1.png（1672×941）：門中線 x=836、地面線 y=790、門拱頂 y=215、拱的橢圓中心 y=393（半寬 251、半高 178）。
// 背景另外畫在 bgScene（不經過轉色，保留原畫）；兩片門板用同一張圖切出來，會往外甩開，門後是光。
const bgScene=new THREE.Scene(),TAV=new THREE.Group();bgScene.add(TAV);TAV.visible=false;
const TI={w:1672,h:941,cx:836,gy:790,top:215,ey:393,a:251,b:178},TS=2.7/(TI.gy-TI.top);   // 圖上一點＝多少世界單位（門高 2.7）
const TZD=1.75,TDA=TI.a*TS,TDSP=(TI.gy-TI.ey)*TS,TDB=TI.b*TS,TDS=TDSP,TDR=TDA;   // 門半寬、直邊高、拱半高
const tavUV=(x,y)=>[(TI.cx+x/TS)/TI.w,1-(TI.gy-y/TS)/TI.h];   // 門面上的世界座標 → 圖的 UV
const tavTex=Q.has('paint')?new THREE.TextureLoader().load('tavern/gpt1.png'):new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);tavTex.needsUpdate=true;tavTex.colorSpace=THREE.NoColorSpace;tavTex.anisotropy=4;
const tavMat=new THREE.MeshBasicMaterial({map:tavTex});
// v8（D 11/07「這張背景沒有我要的 3D 感」）：原畫不再是一張平的板子 → 照深度圖（tavern/depth.png，mk_depth.py 產生）做成有高低的網格：
// 燈籠、招牌、旗子、花箱、酒桶、盆栽往前凸、大門往裡凹、兩邊的樹往後退；地面那一列打到真的地板上。
// 從參考鏡頭 TC 看，網格跟原畫一模一樣；鏡頭一移動就有前後視差。
const TC=V3(0,.664,4.5);
function tavP(ix,iy,d){const X=(ix-TI.cx)*TS,Y=(TI.gy-iy)*TS,k=(TC.z+TZD-d)/(TC.z+TZD);return V3(TC.x+(X-TC.x)*k,TC.y+(Y-TC.y)*k,-TZD+d);}   // 原畫一點＋離牆距離 → 世界座標（沿著參考鏡頭的視線）
function tavG(ix,iy){const X=(ix-TI.cx)*TS,Y=(TI.gy-iy)*TS,t=TC.y/(TC.y-Y);return V3(TC.x+(X-TC.x)*t,0,TC.z+(-TZD-TC.z)*t);}   // 地面那幾列 → 打到地板的位置
if(Q.has('paint')){const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const D=x.getImageData(0,0,im.width,im.height).data;
    const dAt=(ix,iy)=>{ix=Math.max(0,Math.min(im.width-1,Math.round(ix)));iy=Math.max(0,Math.min(im.height-1,Math.round(iy)));return -.8+D[(iy*im.width+ix)*4]/255*1.8;};
    const NX=300,NY=190,X0=-260,X1=TI.w+260,Y0=-320,Y1=TI.h,pos=[],uv=[],idx=[];   // 左右多做一截（邊緣拉長），鏡頭左右移時不會看到邊
    for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++){const ix=X0+i/NX*(X1-X0),iy=Y0+j/NY*(Y1-Y0),d=dAt(ix,iy),q=iy>TI.gy&&d<.03?tavG(ix,iy):tavP(ix,iy,d);pos.push(q.x,q.y,q.z);uv.push(ix/TI.w,1-iy/TI.h);}
    for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const a=j*(NX+1)+i,b=a+1,c2=a+NX+1,d2=c2+1;idx.push(a,c2,b,b,c2,d2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
    const m=new THREE.Mesh(g,tavMat);m.frustumCulled=false;TAV.add(m);};im.src='tavern/depth.png';}
// 圖下緣以外（更靠近鏡頭）的地面：同一個參考鏡頭往回投，超出原畫的部分把石板路來回鏡射
{const gm=new THREE.ShaderMaterial({uniforms:{map:{value:tavTex}},vertexShader:VOL_V,
    fragmentShader:`uniform sampler2D map;varying vec3 vW;void main(){vec3 C=vec3(${TC.x.toFixed(3)},${TC.y.toFixed(3)},${TC.z.toFixed(3)});float k=(${(-TZD).toFixed(3)}-C.z)/min(vW.z-C.z,-.3);vec2 P=C.xy+(vW.xy-C.xy)*k;
float ix=P.x/${TS.toFixed(6)}+${TI.cx.toFixed(1)},iy=${TI.gy.toFixed(1)}-P.y/${TS.toFixed(6)},b0=${(TI.gy+30).toFixed(1)},L=${(TI.h-2-TI.gy-30).toFixed(1)};
if(iy>b0+L){float f=mod(iy-b0,2.*L);iy=b0+(f>L?2.*L-f:f);}gl_FragColor=vec4(texture2D(map,vec2(ix/${TI.w.toFixed(1)},1.-iy/${TI.h.toFixed(1)})).rgb,1.);}`});
  const gp=new THREE.Mesh(new THREE.PlaneGeometry(TI.w*TS*1.8,16),gm);gp.rotation.x=-Math.PI/2;gp.position.set(0,-.003,-TZD+8);TAV.add(gp);}
// 大門往裡凹：門板、門後的光、門縫放在 DOORG（沿參考鏡頭視線往後推 0.16，從參考鏡頭看大小不變）
const DOORG=new THREE.Group();TAV.add(DOORG);{const k=(TC.z+TZD+.16)/(TC.z+TZD);DOORG.scale.setScalar(k);DOORG.position.copy(TC).multiplyScalar(1-k);}
// 門的形狀（世界座標，門底中心＝原點）：直邊＋橢圓拱
function tavArch(n=20){const pts=[[-TDA,0],[TDA,0],[TDA,TDSP]];for(let i=1;i<n;i++){const a=Math.PI*i/n;pts.push([Math.cos(a)*TDA,TDSP+Math.sin(a)*TDB]);}pts.push([-TDA,TDSP]);return pts;}
function archHalf(sd,n=12){const pts=[[0,0],[sd*TDA,0],[sd*TDA,TDSP]];for(let i=1;i<=n;i++){const a=Math.PI/2*i/n;pts.push([sd*TDA*Math.cos(a),TDSP+TDB*Math.sin(a)]);}return pts;}
const shapeOf=pts=>new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x,y)));
// 門後的光（門關著時被門板蓋住）
const tDoorLight=new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(tavArch())),new THREE.ShaderMaterial({uniforms:{uI:{value:0},uC:{value:new THREE.Color(1,1,1)}},vertexShader:FX_V,
  fragmentShader:`uniform float uI;uniform vec3 uC;varying vec2 vUv;void main(){gl_FragColor=vec4(mix(vec3(.16,.09,.24),min(vec3(1.),uC*1.15),uI),1.);}`}));tDoorLight.position.set(0,0,-TZD+.004);DOORG.add(tDoorLight);
// 兩片門板（UV 對回原圖的門）：左片鉸鍊在 -半寬、右片在 +半寬
const tLeaf=[];
for(const sd of[-1,1]){const piv=new THREE.Group();piv.position.set(sd*TDA,0,-TZD+.01);DOORG.add(piv);
  const pts=archHalf(sd);   // 世界座標（以門底中心為原點）
  const g=new THREE.ShapeGeometry(shapeOf(pts.map(([x,y])=>[x-sd*TDA,y])));const pos=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<pos.count;i++){const[u,v]=tavUV(pos.getX(i)+sd*TDA,pos.getY(i));uv.setXY(i,u,v);}
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:tavTex,side:THREE.DoubleSide}));piv.add(mesh);tLeaf.push({piv,sd,mesh});}
// 門縫透光（關著時）
const tGap=new THREE.Mesh(new THREE.PlaneGeometry(.035,TDSP+TDB-.04),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));tGap.position.set(0,(TDSP+TDB)/2,-TZD+.02);DOORG.add(tGap);
// 地上的扇形光帶（門開時，朝鏡頭）——放在 bgScene 才會畫在背景上
const BEAM_F=`uniform float uI;uniform vec3 uC;varying vec2 vUv;void main(){float w=abs(vUv.x*2.-1.);float sp=.32+.68*vUv.y;if(w>sp)discard;float a=(1.-vUv.y)*(1.-w/sp*.6);a=floor(a*4.+.5)/4.;gl_FragColor=vec4(uC*a*uI,1.);}`;
const tBeam=new THREE.Mesh(new THREE.PlaneGeometry(1,1),addMat(BEAM_F,{uI:{value:0},uC:{value:new THREE.Color(1,1,1)}}));tBeam.rotation.x=-Math.PI/2;tBeam.rotation.z=Math.PI;tBeam.position.set(0,.01,-TZD+2.3);tBeam.scale.set(4.4,4.6,1);TAV.add(tBeam);
// 壁燈、窗戶的光暈（加在 3D 那層，閃一閃）
const tavPt=(ix,iy,d=.08)=>tavP(ix,iy,d);
const TLAMPG=[tavPt(493,313,.5),tavPt(1179,313,.5)].map(p=>{const b=board(GLOW_F,glowU());b.position.copy(p);b.scale.setScalar(1.1);return b;});
const TWING=[tavPt(340,410),tavPt(1332,410)].map(p=>{const b=board(GLOW_F,glowU());b.position.copy(p);b.scale.setScalar(1.6);return b;});
const TDOOR_C=V3(0,TDSP*.8,-TZD+.1);
const tRays=board(RAYS_F,raysU(14,3.3,.9)),tGlow=board(GLOW_F,glowU());
const SKY=world.children.find(o=>o.material===bgMat),STARS=world.children.find(o=>o.isPoints&&o.material===starMat);
const EXT=[mach,stg,FLOORM,SKY,STARS,...FLAGS.map(f=>f.f),...LIGHTS,...BGC,...GEO,...world.children.filter(o=>o.isLine&&!o.isLineLoop)];   // 舞台那一組（切到酒館大門時整組藏起來）
function tavShow(on){TAV.visible=on&&!TAV3_ON;for(const k in HOUSES)HOUSES[k].visible=on&&TAV3_ON&&k===THEME;if(on&&TAV3_ON){const H=HOUSES[THEME];if(tBeam.parent!==H){H.add(tBeam);H.add(tGap);}}if(!on){[...TLAMPG,...TWING].forEach(b=>b.visible=false);}}
// 門板角度、透光、窗燈（每一格呼叫）：a＝開門角度（0 關）；leak＝門縫透光；col＝光的顏色
function tavLights(s,a,leak,col,win,winC,lamp){tLeaf.forEach(l=>{l.piv.rotation.y=l.sd*a;});TLEAF3.forEach(l=>{l.piv.rotation.y=l.sd*a;});   // 往外（朝鏡頭）開
  tGap.material.opacity=a<.3?Math.min(1,leak):0;tGap.material.color.setRGB(...col);tDoorLight.material.uniforms.uI.value=Math.min(1,a/.45);tDoorLight.material.uniforms.uC.value.setRGB(...col);
  TLAMPG.forEach((b,i)=>{b.visible=true;setC(b.material.uniforms,[1,.82,.5]);b.material.uniforms.uI.value=.18*lamp*(.85+.15*Math.sin(s/130+i*2));});
  TWING.forEach((b,i)=>{b.visible=win>.4;setC(b.material.uniforms,winC);b.material.uniforms.uI.value=(win-.35)*.35*(.85+.15*Math.sin(s/300+i));});}

// ---------- 光效物件 ----------
const fxRays=board(RAYS_F,raysU(18,1.7)),fxRays2=board(RAYS_F,raysU(9,4.2,.4)),fxGlow=board(GLOW_F,glowU()),fxCrack=board(RAYS_F,raysU(7,8.1,0));
const fxRings=[...Array(5)].map(()=>board(RING_F,ringU()));
const fxBG=board(SUN_F,{uI:{value:0},uN:{value:16},uRot:{value:0},uC:{value:new THREE.Color(1,1,1)}}),fxBG2=board(GLOW_F,glowU());
const domeGlow=board(GLOW_F,glowU()),domeRays=board(RAYS_F,raysU(10,6.6,.5));
const pillar=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,28,1,true),addMat(VOL_F,{uI:{value:0},uTop:{value:.6},uC:{value:new THREE.Color(1,1,1)}},VOL_V,THREE.DoubleSide));pillar.visible=false;world.add(pillar);
const tenRays=[...Array(10)].map((_,i)=>board(RAYS_F,raysU(10,20+i,.4)));
const coin=new THREE.Group();world.add(coin);coin.visible=false;
let coinTex=null;

// ---------- 粒子（GPU 依公式算位置：可倒帶、可跳格） ----------
const P_V=`attribute vec3 aV;attribute vec4 aT;attribute vec3 aA;attribute vec3 aB;attribute vec4 aK;uniform float uTime,uBoost;uniform vec2 uRes;
varying vec3 vC;varying float vK;varying float vS;varying float vU;varying float vSd;
void main(){float t=(uTime-aT.x)*.001;float L=aT.y*.001;vK=aK.x;vSd=aK.z;vU=0.;vS=0.;vC=vec3(0.);
if(t<0.||t>L){gl_Position=vec4(9.,9.,9.,1.);gl_PointSize=0.;return;}
float u=t/L;vU=u;vec3 p;
if(aK.w<.5){float dr=aT.z;float f=dr>.001?(1.-exp(-dr*t))/dr:t;p=position+aV*f;p.y-=.5*aT.w*t*t;}else{float e=u*u*u;p=mix(position,aV,e);}
vec4 c=projectionMatrix*modelViewMatrix*vec4(p,1.);
float sz=aK.y;if(aK.x<.5)sz*=1.-u*u;else if(aK.x<1.5)sz*=1.-u*.6;else if(aK.x>2.5)sz*=1.+u*.8;if(aK.w>.5)sz=aK.y*(.6+u*.6);
sz=floor(sz+.5);vS=sz;gl_PointSize=sz;
vec2 pp=(c.xy/c.w*.5+.5)*uRes;pp=mod(sz,2.)>.5?floor(pp)+.5:floor(pp+.5);c.xy=(pp/uRes*2.-1.)*c.w;gl_Position=c;
vec3 col=mix(vec3(1.),aA,smoothstep(0.,.3,u));col=mix(col,aB,smoothstep(.45,1.,u));
if(aK.w>.5)col=mix(aA,vec3(1.),u);if(aK.x>1.5&&aK.x<2.5)col=aA;if(aK.x>2.5)col=aA;
vC=col*(1.+uBoost*(1.-u)*.8);}`;
const P_F=`uniform float uTime;varying vec3 vC;varying float vK;varying float vS;varying float vU;varying float vSd;
void main(){if(vS<.5)discard;vec2 q=floor(gl_PointCoord*vS);float c=floor(vS*.5);vec3 col=vC;
if(vK>.5&&vK<1.5){float dx=abs(q.x-c),dy=abs(q.y-c);bool arm=(dx<.5||dy<.5);bool core=vS>=5.&&dx<1.5&&dy<1.5&&(dx+dy)<1.5;if(!(arm||core))discard;
 if(arm&&!core&&max(dx,dy)>c*.65)col*=.6;col*=.7+.3*sin(uTime*.013+vSd*61.);}
else if(vK>1.5&&vK<2.5){float ph=mod(floor(uTime/85.+vSd*13.),4.);if(ph>1.5&&ph<2.5){if(abs(q.y-c)>.5)discard;col*=.72;}else if(ph>.5&&ph<1.5){if(q.x>c+.5)discard;col*=.88;}else if(ph>2.5){if(q.y>c+.5)discard;}}
else if(vK>2.5){if(vU>.3&&mod(q.x+q.y,2.)>.5)discard;if(vU>.65&&mod(q.x,2.)>.5)discard;}
gl_FragColor=vec4(col,1.);}`;
class PSys{constructor(add,max){this.max=max;this.n=0;const g=new THREE.BufferGeometry();
  this.a={position:new Float32Array(max*3),aV:new Float32Array(max*3),aT:new Float32Array(max*4),aA:new Float32Array(max*3),aB:new Float32Array(max*3),aK:new Float32Array(max*4)};
  for(const[k,v]of Object.entries(this.a))g.setAttribute(k,new THREE.BufferAttribute(v,v.length/max));g.setDrawRange(0,0);this.g=g;
  this.mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uRes:RESU,uBoost:{value:add?1:0}},vertexShader:P_V,fragmentShader:P_F,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending});if(add)addB(this.mat);
  this.pts=new THREE.Points(g,this.mat);this.pts.frustumCulled=false;world.add(this.pts);}
  clear(){this.n=0;this.g.setDrawRange(0,0);}
  add(o,v,t0,life,drag,grav,ca,cb,kind,size,seed,mode=0){if(this.n>=this.max)return;const i=this.n++,A=this.a;A.position.set(o,i*3);A.aV.set(v,i*3);A.aT.set([t0,life,drag,grav],i*4);A.aA.set(ca,i*3);A.aB.set(cb,i*3);A.aK.set([kind,size,seed,mode],i*4);}
  commit(){for(const k in this.a)this.g.attributes[k].needsUpdate=true;this.g.setDrawRange(0,this.n);}}
const PA=new PSys(true,9000),PN=new PSys(false,3000);window.__dbg={PA,PN,cardScene,world,ovc,cam,tLeaf,tDoorLight,TAV,bgScene,get IMG(){return IMG},get ITEMS(){return ITEMS},lf:k=>loadFurn(k),get fxRays(){return fxRays},R,get rtW(){return rtW},get rtB(){return rtB}};
const hex3=h=>{const c=C(h);return[c.r,c.g,c.b];};
function unit(r){const z=r()*2-1,a=r()*6.283,q=Math.sqrt(1-z*z);return[q*Math.cos(a),z,q*Math.sin(a)];}
// 爆開的火花
function sparks(r,o,t,n,k,{sp=[2,7],drag=2.6,grav=1.2,life=[450,1100],size=[2,3],up=.5,spread=1,flat=1}={}){const c=SPK[k];
  for(let i=0;i<n;i++){const d=unit(r),v=sp[0]+r()*(sp[1]-sp[0]);PA.add(o,[d[0]*v*spread,(d[1]*flat+up)*v,d[2]*v*spread*.6],t+r()*40,life[0]+r()*(life[1]-life[0]),drag,grav,c.a,c.b,0,Math.round(size[0]+r()*(size[1]-size[0])),r());}}
function stars(r,o,t,n,k,{sp=[1.5,5],life=[600,1300],size=[5,9],drag=2.2}={}){const c=SPK[k];
  for(let i=0;i<n;i++){const d=unit(r),v=sp[0]+r()*(sp[1]-sp[0]);let sz=Math.round(size[0]+r()*(size[1]-size[0]));sz+=1-(sz&1);PA.add(o,[d[0]*v,d[1]*v*.8+.6,d[2]*v*.5],t+r()*60,life[0]+r()*(life[1]-life[0]),drag,.4,c.a,c.b,1,sz,r());}}
function confetti(r,o,t,n,k,{sp=[3,7.5]}={}){const L=CONF[k];
  for(let i=0;i<n;i++){const d=unit(r),v=sp[0]+r()*(sp[1]-sp[0]),col=hex3(L[i%L.length]);PN.add(o,[d[0]*v,Math.abs(d[1])*v*.9+2.2,d[2]*v*.5],t+r()*80,1500+r()*1100,1.3,3.2,col,col,2,3,r());}}
function dust(r,o,t,n){for(let i=0;i<n;i++){const d=unit(r);PN.add(o,[d[0]*1.4,Math.abs(d[1])*.6+.2,d[2]*1.2],t+r()*30,320+r()*260,4,0,hex3('#fff1e3'),hex3('#fff1e3'),3,2,r());}}
function converge(r,o,t,dur,n,k){const c=SPK[k];for(let i=0;i<n;i++){const d=unit(r),rr=1.6+r()*2.2,st=[o[0]+d[0]*rr,o[1]+d[1]*rr*.8,o[2]+d[2]*rr*.6];PA.add(st,o,t+r()*dur*.45,dur*.55,0,0,c.a,c.b,r()<.3?1:0,r()<.3?5:2,r(),1);}}

// ---------- 卡片（2D 像素畫，3D 飛行時當貼圖、停好後原樣疊上去） ----------
const FRC={common:{l:'#fff6f8',m:'#ffc4d0',m2:'#f7a8ba',d:'#e27d9c',dd:'#a24a75',p:['#fffaf4','#fff2ee','#ffe4ea'],pat:'#ffe0e7',gem:'#f290a8',sh:'#f3d3c4',sil:'#ff9cbc'},
  rare:{l:'#efe8ff',m:'#b8a2ff',m2:'#9a86e6',d:'#6b56b8',dd:'#4b3a8a',p:['#fdfbff','#f3eeff','#e4dbff'],pat:'#e8e0ff',gem:'#9a86e6',sh:'#d8cdf0',sil:'#b8a2ff'},
  limited:{l:'#fffbe2',m:'#ffd968',m2:'#f2b53e',d:'#c98a2a',dd:'#7a3f1c',p:['#fffcf2','#fff5d8','#ffecbd'],pat:'#ffeab0',gem:'#ff8fab',sh:'#f0d9a8',sil:'#ffd25e'}};
const STAR7=['...#...','..###..','#######','.#####.','.##.##.','##...##'];
const IMG={};let ITEMS=[];
function grade(im){const w=im.width,h=im.height,c=document.createElement('canvas'),b=document.createElement('canvas');c.width=b.width=w;c.height=b.height=h;
  const bc=b.getContext('2d');bc.filter='blur(5px) contrast(1.7) brightness(.8)';bc.drawImage(im,0,0);bc.filter='none';
  const x=c.getContext('2d');x.drawImage(im,0,0);x.globalCompositeOperation='screen';x.fillStyle='rgba(110,52,60,.16)';x.fillRect(0,0,w,h);
  x.globalCompositeOperation='soft-light';x.fillStyle='rgba(255,196,188,.30)';x.fillRect(0,0,w,h);
  x.globalCompositeOperation='screen';x.globalAlpha=.26;x.drawImage(b,0,0);x.globalAlpha=1;x.globalCompositeOperation='destination-in';x.drawImage(im,0,0);return c;}
function cardBase(kind,w,h,back){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const F=FRC[kind];const id=x.createImageData(w,h),p=id.data;
  const rr=(xx,yy)=>{const r=6,cx=xx<r?r:(xx>w-1-r?w-1-r:xx),cy=yy<r?r:(yy>h-1-r?h-1-r:yy);return(xx-cx)**2+(yy-cy)**2<=r*r+3;};
  const set=(i,hx)=>{const v=parseInt(hx.slice(1),16);p[i]=v>>16;p[i+1]=v>>8&255;p[i+2]=v&255;p[i+3]=255;};const B=5,sm=Math.min(w,h)<130;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){if(!rr(xx,yy))continue;const i=(yy*w+xx)*4;
    if(!rr(xx-1,yy)||!rr(xx+1,yy)||!rr(xx,yy-1)||!rr(xx,yy+1)){set(i,'#3a2622');continue;}
    const e=Math.min(xx,yy,w-1-xx,h-1-yy);
    if(e<=1){set(i,(xx===1||yy===1)&&xx<w-2&&yy<h-2?F.l:F.dd);continue;}
    if(e<B){const t=yy/h+(bay(xx,yy)-.5)*.18;set(i,e===2&&(xx===2||yy===2)?F.l:(t<.42?F.m:(t<.8?F.m2:F.d)));continue;}
    if(e===B){set(i,F.dd);continue;}
    if(back){const dg=((xx+yy)>>2)%3===0;set(i,dg?F.m:F.p[1]);continue;}
    const t=yy/h+(bay(xx,yy)-.5)*.14;let col=t<.36?F.p[0]:(t<.74?F.p[1]:F.p[2]);
    if(e>B+2){if(kind==='limited'&&((xx+yy)%12===0||(xx-yy+1200)%12===0))col=F.pat;else if(kind==='rare'&&xx%8===4&&yy%8===4)col=F.pat;else if(kind==='common'&&xx%10===5&&yy%10===5)col=F.pat;}
    set(i,col);}
  x.putImageData(id,0,0);
  const gem=(cx,cy)=>{for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const m=Math.abs(dx)+Math.abs(dy);if(m>3)continue;x.fillStyle=m===3?'#3a2622':(dx+dy<0?'#ffffff':F.gem);if(m===1&&dx<=0&&dy<=0)x.fillStyle='#ffffff';x.fillRect(cx+dx,cy+dy,1,1);}};
  for(const[cx,cy]of[[B+4,B+4],[w-B-5,B+4],[B+4,h-B-5],[w-B-5,h-B-5]])gem(cx,cy);
  if(back){const k=Math.max(1,Math.round(w/70)),mx=w>>1,my=h>>1;const pc=(cx,cy,r)=>{for(let yy=-r-1;yy<=r+1;yy++)for(let xx=-r-1;xx<=r+1;xx++){const d=Math.hypot(xx,yy);if(d>r+.5)continue;x.fillStyle=d>r-.7?'#3a2622':(xx+yy<-r*.6?F.l:F.d);x.fillRect(Math.round(cx+xx),Math.round(cy+yy),1,1);}};
    pc(mx,my+5*k,8*k);pc(mx-9*k,my-5*k,3.4*k);pc(mx-3.4*k,my-11*k,3.4*k);pc(mx+3.4*k,my-11*k,3.4*k);pc(mx+9*k,my-5*k,3.4*k);}
  return c;}
function starRow(x,w,y,n,F,sc=1){const sw=7*sc+2,x0=Math.round(w/2-(n*sw-2)/2);for(let s=0;s<n;s++){const ox=x0+s*sw;
  for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]])for(let r=0;r<6;r++)for(let c=0;c<7;c++)if(STAR7[r][c]==='#'){x.fillStyle='#3a2622';x.fillRect(ox+c*sc+dx,y+r*sc+dy,sc,sc);}
  for(let r=0;r<6;r++)for(let c=0;c<7;c++)if(STAR7[r][c]==='#'){x.fillStyle=r<2?F.l:(r<4?F.m:F.m2);x.fillRect(ox+c*sc,y+r*sc,sc,sc);}}}
function star1(x,ox,y,sc,F,white){for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1],[0,2]])for(let r=0;r<6;r++)for(let c=0;c<7;c++)if(STAR7[r][c]==='#'){x.fillStyle=dy===2?'#7a3f1c':'#3a2622';x.fillRect(ox+c*sc+dx,y+r*sc+dy,sc,sc);}
  for(let r=0;r<6;r++)for(let c=0;c<7;c++)if(STAR7[r][c]==='#'){x.fillStyle=white?'#ffffff':(r<2?F.l:(r<4?F.m:F.m2));x.fillRect(ox+c*sc,y+r*sc,sc,sc);}
  if(!white&&sc>=2){x.fillStyle='#ffffff';x.fillRect(ox+3*sc,y+sc,Math.max(1,sc>>1),sc);}}
// 卡面：家具在中間（整數倍），上方稀有度星星、下方小裝飾；sil=剪影版
function cardArt(item,w,h,o={}){const k=item.r,F=FRC[k],front=cardBase(k,w,h,false),x=front.getContext('2d');const small=h<140;
  if(!o.noStars)starRow(x,w,small?9:11,RANK[k]+1,F,small?1:1);
  const im=IMG['f_'+item.k];let dw=0,dh=0,ix=0,iy=0;
  if(im){const top=small?18:22,bot=small?10:18,mw=w-16,mh=h-top-bot;let s=Math.floor(Math.min(mw/im.width,mh/im.height));if(s>=1){s=Math.min(s,3);dw=im.width*s;dh=im.height*s;}else{dw=im.width>>1;dh=im.height>>1;}
    ix=Math.round((w-dw)/2);iy=Math.round(top+(mh-dh)/2+(small?0:2));
    for(let yy=-3;yy<=3;yy++)for(let xx=-Math.round(dw*.42);xx<=Math.round(dw*.42);xx++){const q=(xx/(dw*.42))**2+(yy/3)**2;if(q>1)continue;if(q>.55&&bay(xx+200,yy+200)<.5)continue;x.fillStyle=F.sh;x.fillRect(w/2+xx|0,iy+dh-2+yy,1,1);}
    x.imageSmoothingEnabled=false;x.drawImage(im,ix,iy,dw,dh);}
  if(!small){const y=h-B2;x.fillStyle=F.m2;for(let xx=16;xx<w-16;xx+=3)if(Math.abs(xx-w/2)>6)x.fillRect(xx,y,2,1);x.fillStyle='#3a2622';x.fillRect(w/2-2|0,y-2,5,5);x.fillStyle=F.gem;x.fillRect(w/2-1|0,y-1,3,3);}
  const sil=document.createElement('canvas');sil.width=w;sil.height=h;const sx=sil.getContext('2d');sx.drawImage(front,0,0);
  if(im){const m=document.createElement('canvas');m.width=w;m.height=h;const mx=m.getContext('2d');mx.imageSmoothingEnabled=false;mx.drawImage(im,ix,iy,dw,dh);
    const md=mx.getImageData(0,0,w,h).data,sd=sx.getImageData(0,0,w,h),q=sd.data,on=(xx,yy)=>xx>=0&&yy>=0&&xx<w&&yy<h&&md[(yy*w+xx)*4+3]>200;const gl=parseInt(F.sil.slice(1),16);
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const i=(yy*w+xx)*4;if(on(xx,yy)){q[i]=0x3b;q[i+1]=0x25;q[i+2]=0x59;}else{let n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.abs(dx)+Math.abs(dy)<=2&&on(xx+dx,yy+dy))n++;
      if(n){q[i]=gl>>16;q[i+1]=gl>>8&255;q[i+2]=gl&255;}}}
    sx.putImageData(sd,0,0);}
  return{front,sil,back:cardBase(k,w,h,true)};}
const B2=12;
const texOf=c=>{const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;};
const CARD_F=`uniform sampler2D map;uniform float uFoil,uPh;varying vec2 vUv;void main(){vec4 t=texture2D(map,vUv);if(t.a<.5)discard;vec3 c=t.rgb;
if(uFoil>0.){float p=vUv.x*.8+vUv.y*.5-uPh;float b=abs(p);vec2 fp=floor(gl_FragCoord.xy);if(b<.025)c=mix(c,vec3(1.),.6);else if(b<.06&&mod(fp.x+fp.y,2.)<.5)c=mix(c,vec3(1.),.45);}
gl_FragColor=vec4(c,1.);}`;
function card3(){const g=new THREE.Group();const mf=new THREE.ShaderMaterial({uniforms:{map:{value:BLANK},uFoil:{value:0},uPh:{value:0}},vertexShader:FX_V,fragmentShader:CARD_F});
  const mb=new THREE.ShaderMaterial({uniforms:{map:{value:BLANK},uFoil:{value:0},uPh:{value:0}},vertexShader:FX_V,fragmentShader:CARD_F});
  const f=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mf),b=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mb);b.rotation.y=Math.PI;g.add(f,b);g.visible=false;cardScene.add(g);return{g,mf,mb};}
const CARD=card3(),PICK=card3();

// ---------- 家具本體（D 11/07：不要卡片，家具直接蹦出來）----------
// 家具只有一張斜角像素圖 → 做成「像素積木」：正面是原圖，邊緣每一格往後擠出厚度（側面用往內兩格的顏色壓暗）。
// 飛行、翻轉時看得出厚度；停好時正對鏡頭、一格對一格，再交給 2D 層（跟原圖一模一樣）。
const FURN_V=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FURN_F=`uniform sampler2D map;uniform vec2 uSz;uniform float uRev,uWhite,uRim,uDk;uniform vec3 uSilC,uRimC;varying vec2 vUv;
float b2(vec2 a){return a.x*2.+a.y*3.-4.*a.x*a.y;}float bayer(vec2 p){vec2 q=mod(p,4.);return(b2(mod(q,2.))*4.+b2(floor(q/2.))+.5)/16.;}
float al(vec2 p){if(p.x<0.||p.y<0.||p.x>=uSz.x||p.y>=uSz.y)return 0.;return texture2D(map,(p+.5)/uSz).a;}
void main(){vec2 px=floor(vUv*uSz);vec4 t=texture2D(map,(px+.5)/uSz);if(t.a<.5)discard;
float edge=step(.5,1.-min(min(min(al(px+vec2(1.,0.)),al(px-vec2(1.,0.))),min(al(px+vec2(0.,1.)),al(px-vec2(0.,1.)))),min(min(al(px+vec2(2.,0.)),al(px-vec2(2.,0.))),min(al(px+vec2(0.,2.)),al(px-vec2(0.,2.))))));   /* 剪影外圈兩格亮邊 */
vec3 sil=mix(uSilC,uRimC,edge*uRim);vec3 c=bayer(px)<uRev?t.rgb*uDk:sil;c=mix(c,vec3(1.),uWhite);gl_FragColor=vec4(c,1.);}`;
const FWALL_V=`attribute vec3 aCol;varying vec3 vC;void main(){vC=aCol;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FWALL_F=`uniform float uRev,uWhite;uniform vec3 uSilC;varying vec3 vC;void main(){vec3 c=uRev>.5?vC:uSilC*.6;c=mix(c,vec3(1.),uWhite*.6);gl_FragColor=vec4(c,1.);}`;
function furnObj(im,scene=cardScene){const w=im.width,h=im.height,c2=document.createElement('canvas');c2.width=w;c2.height=h;const x=c2.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const d=x.getImageData(0,0,w,h).data;
  const op=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&d[(j*w+i)*4+3]>127,col=(i,j,f)=>{const k=(j*w+i)*4;return[d[k]/255*f,d[k+1]/255*f,d[k+2]/255*f];};
  const T=Math.max(4,Math.round(Math.min(w,h)*.1)),P=[],Cl=[],q=(a,b,c,e,cc)=>{P.push(...a,...b,...c,...a,...c,...e);for(let n=0;n<6;n++)Cl.push(...cc);};
  const cc=(i,j,di,dj,f)=>op(i+di*2,j+dj*2)?col(i+di*2,j+dj*2,f):(op(i+di,j+dj)?col(i+di,j+dj,f):col(i,j,f));
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(!op(i,j))continue;const X0=i-w/2,X1=X0+1,Y1=h-j,Y0=Y1-1;
    if(!op(i-1,j))q([X0,Y0,0],[X0,Y1,0],[X0,Y1,-T],[X0,Y0,-T],cc(i,j,1,0,.74));
    if(!op(i+1,j))q([X1,Y0,0],[X1,Y0,-T],[X1,Y1,-T],[X1,Y1,0],cc(i,j,-1,0,.56));
    if(!op(i,j-1))q([X0,Y1,0],[X1,Y1,0],[X1,Y1,-T],[X0,Y1,-T],cc(i,j,0,1,.9));
    if(!op(i,j+1))q([X0,Y0,0],[X0,Y0,-T],[X1,Y0,-T],[X1,Y0,0],cc(i,j,0,-1,.46));}
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));wg.setAttribute('aCol',new THREE.Float32BufferAttribute(Cl,3));
  const tex=texOf(c2),U={map:{value:tex},uSz:{value:new THREE.Vector2(w,h)},uRev:{value:1},uWhite:{value:0},uRim:{value:0},uSilC:{value:C('#3b2559')},uRimC:{value:new THREE.Color(1,1,1)}};
  const mf=new THREE.ShaderMaterial({uniforms:{...U,uDk:{value:1}},vertexShader:FURN_V,fragmentShader:FURN_F}),mb=new THREE.ShaderMaterial({uniforms:{...U,uDk:{value:.5}},vertexShader:FURN_V,fragmentShader:FURN_F});
  const mw=new THREE.ShaderMaterial({uniforms:{uRev:U.uRev,uWhite:U.uWhite,uSilC:U.uSilC},vertexShader:FWALL_V,fragmentShader:FWALL_F,side:THREE.DoubleSide});
  const g=new THREE.Group(),pg=new THREE.PlaneGeometry(w,h);pg.translate(0,h/2,0);const f=new THREE.Mesh(pg,mf),b=new THREE.Mesh(pg,mb);b.rotation.y=Math.PI;b.position.z=-T;
  g.add(f,b,new THREE.Mesh(wg,mw));g.visible=false;scene.add(g);
  return{g,U,w,h,T,dispose(){scene.remove(g);pg.dispose();wg.dispose();tex.dispose();mf.dispose();mb.dispose();mw.dispose();}};}
// 家具的影子（畫在舞台上，會跟著轉成像素）
let FURN=null,TENF=[];
const fShadow=new THREE.Mesh(new THREE.CircleGeometry(.5,40),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uA:{value:0}},vertexShader:FX_V,
  fragmentShader:`uniform float uA;varying vec2 vUv;void main(){float r=length(vUv*2.-1.);float a=r<.62?1.:(r<1.?.5:0.);gl_FragColor=vec4(.17,.09,.24,a*uA);}`}));
fShadow.rotation.x=-Math.PI/2;fShadow.visible=false;world.add(fShadow);

// ---------- 家具本體 v5（D 11/07：「平平的很微妙」→ 改用小屋家具的原始 3D 模型）----------
// 模型：bed/export_gacha_glb.py 從 Blender 原檔轉出（models/<key>.glb，只有幾何＋材質名）。
// 上色：models/tone.json＝從原圖量出來的「每個材質 8 階顏色＋明暗門檻」，轉到斜角時明暗分布跟原圖一樣；停好後換成原圖（整數倍、一格對一格）。
const GLL=new GLTFLoader(),FCACHE={},DV='?v=73';let TONE={},FPAL={};   // DV＝資料版本：家具重匯後改這裡，瀏覽器才不會讀到舊的快取
const PPU=45.255,EL30=Math.PI/6;
function loadFurn(k){return FCACHE[k]||(FCACHE[k]=GLL.loadAsync('models/'+k+'.glb'+DV).then(gl=>{gl.scene.updateMatrixWorld(true);const parts=[];
  gl.scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const a of Object.keys(g.attributes))if(a!=='position'&&a!=='normal')g.deleteAttribute(a);parts.push({g,mat:o.material.name});});
  // 斜角（轉 45°、俯角 30°）投影後的外框（家具單位）：停好時用來對齊原圖
  const c=Math.SQRT1_2,ce=Math.cos(EL30),se=Math.sin(EL30);let x0=1e9,x1=-1e9,u0=1e9,u1=-1e9,ymax=0,rad=0;
  for(const p of parts){const a=p.g.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),xr=(x+z)*c,zr=(z-x)*c,u=y*ce-zr*se;
    if(xr<x0)x0=xr;if(xr>x1)x1=xr;if(u<u0)u0=u;if(u>u1)u1=u;if(y>ymax)ymax=y;const rr=Math.hypot(x,z);if(rr>rad)rad=rr;}}
  for(const p of parts)p.h=hull(p.g);
  return{k,parts,x0,x1,u0,u1,ymax,rad};}));}
// 原圖投影（D 11/07「有些 3D 模型跟像素細節不一樣」）：從小屋的斜角把原圖「投」到模型上 → 停好那一格跟原圖一模一樣、轉起來細節跟著轉；
// 原圖看不到的面（背面、被擋住的地方）照舊用量出來的色階上色。uP＝外框左下角（家具單位）＋跟原圖的位移（格），uS＝原圖大小
const PJ_GL=`uniform vec4 uP;uniform vec2 uS;uniform vec2 uD;
vec3 pjOf(vec3 p){float xr=(p.x+p.z)*.70710678,zr=(p.z-p.x)*.70710678,u=p.y*.8660254-zr*.5;return vec3(((xr-uP.x)*45.255-uP.z)/uS.x,(uS.y-(u-uP.y)*45.255-uP.w)/uS.y,p.y*.5+zr*.8660254);}`;
const DEP_V=PJ_GL+`varying float vD;void main(){vec3 q=pjOf(position);vD=q.z;gl_Position=vec4(q.x*2.-1.,q.y*2.-1.,(1.-2.*(q.z-uD.x)/(uD.y-uD.x+1e-5))*.98,1.);}`;
const DEP_F=`varying float vD;void main(){gl_FragColor=vec4(vD,0.,0.,1.);}`;
const F3_V=PJ_GL+`varying vec3 vN;varying vec3 vW;varying vec3 vPj;varying vec3 vNl;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);vNl=normal;vPj=pjOf(position);gl_Position=projectionMatrix*viewMatrix*w;}`;
const F3_F=`uniform vec3 uR[8];uniform float uT[7];uniform vec3 uKey,uSilC,uRimC;uniform float uRev,uWhite,uRim,uPjOn;uniform sampler2D uSp,uDp;uniform vec2 uD;varying vec3 vN;varying vec3 vW;varying vec3 vPj;varying vec3 vNl;
float b2(vec2 a){return a.x*2.+a.y*3.-4.*a.x*a.y;}float bayer(vec2 p){vec2 q=mod(p,4.);return(b2(mod(q,2.))*4.+b2(floor(q/2.))+.5)/16.;}
void main(){vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;float t=dot(N,uKey)*.5+.5;int i=0;for(int k=0;k<7;k++)if(t>uT[k])i=k+1;vec3 c=uR[0];for(int k=1;k<8;k++)if(k==i)c=uR[k];
if(uPjOn>.5){vec3 q=vPj;float fac=abs(dot(normalize(vNl),vec3(-.6123724,.5,.6123724)));
  if(fac>.06&&q.x>=0.&&q.x<=1.&&q.y>=0.&&q.y<=1.){vec4 sp=texture2D(uSp,q.xy);float dm=texture2D(uDp,q.xy).r;if(sp.a>.5&&q.z>=dm-max(.01,(uD.y-uD.x)*.015))c=sp.rgb;}}
if(bayer(gl_FragCoord.xy)>=uRev){vec3 V=normalize(cameraPosition-vW);float fr=1.-abs(dot(N,V));c=uSilC*(.85+.35*step(.55,t))+(uRimC-uSilC)*step(.62,fr)*uRim;}   /* 剪影（稀有以上先只看得到形狀）＋稀有色亮邊 */
gl_FragColor=vec4(mix(c,vec3(1.),uWhite),1.);}`;
const fbTone=p=>{const r=(p&&p.ramp)||['#3a2622','#5a3438','#8a5a50','#b08070','#d0a090','#f0c8b0'];return{t:[.3,.42,.52,.6,.68,.76,.86],c:[r[0],r[1],r[2],r[2],r[3],r[4],r[4],r[5]]};};
let FIT={};   // 每件家具：3D 外框跟原圖的位移（格）＋外形重疊率（mtest 量的）
function projOf(F){if(F.pj!==undefined)return F.pj;const im=IMG['raw_'+F.k];if(!im){F.pj=null;return null;}
  const w=im.width,h=im.height,[dx,dy]=FIT[F.k]||[0,0];let d0=1e9,d1=-1e9;const c=Math.SQRT1_2,ce=Math.cos(EL30),se=Math.sin(EL30);
  for(const p of F.parts){const a=p.g.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),d=y*se+(z-x)*c*ce;if(d<d0)d0=d;if(d>d1)d1=d;}}
  const tex=new THREE.Texture(im);tex.flipY=false;tex.magFilter=tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.colorSpace=THREE.NoColorSpace;tex.needsUpdate=true;
  // 原圖那個角度的深度圖（3 倍細）：用來判斷模型上這一點在原圖裡是不是被前面的東西擋住
  const q=3,rt=new THREE.WebGLRenderTarget(w*q,h*q,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true,generateMipmaps:false});
  const U={uP:{value:new THREE.Vector4(F.x0,F.u0,dx,dy)},uS:{value:new THREE.Vector2(w,h)},uD:{value:new THREE.Vector2(d0,d1)}};
  const m=new THREE.ShaderMaterial({uniforms:U,vertexShader:DEP_V,fragmentShader:DEP_F,side:THREE.DoubleSide}),sc=new THREE.Scene();
  for(const p of F.parts){const ms=new THREE.Mesh(p.g,m);ms.frustumCulled=false;sc.add(ms);}
  const cc=R.getClearColor(new THREE.Color()),ca=R.getClearAlpha();R.setRenderTarget(rt);R.setClearColor(0x000000,1);R.clear();R.render(sc,cam);R.setRenderTarget(null);R.setClearColor(cc,ca);m.dispose();
  F.pj={tex,dep:rt.texture,U};return F.pj;}
function furn3D(F,scene=cardScene){const tn=TONE[F.k]||{},pl=FPAL[F.k]||{},U={uRev:{value:1},uWhite:{value:0},uRim:{value:0},uSilC:{value:C('#3b2559')},uRimC:{value:new THREE.Color(1,1,1)}};
  const pj=projOf(F);Object.assign(U,{uPjOn:{value:pj?1:0},uSp:{value:pj?pj.tex:null},uDp:{value:pj?pj.dep:null},uP:pj?pj.U.uP:{value:new THREE.Vector4()},uS:pj?pj.U.uS:{value:new THREE.Vector2(1,1)},uD:pj?pj.U.uD:{value:new THREE.Vector2(0,1)}});
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);inner.rotation.y=Math.PI/4;   // 外層轉 0 ＝ 小屋頁的斜角（跟原圖同一個方向）
  const om=OLN.clone();om.uniforms={uRes:RESU,uPx:{value:1},uInk:{value:C('#4a2a3a')},uDim:{value:0},uDimC:GU.uDimC};const mats=[om];
  for(const p of F.parts){const t=tn[p.mat]||fbTone(pl[p.mat]);const m=new THREE.ShaderMaterial({uniforms:{...U,uR:{value:t.c.map(C)},uT:{value:t.t},uKey:GU.uKey},vertexShader:F3_V,fragmentShader:F3_F,side:THREE.DoubleSide});mats.push(m);
    const ms=new THREE.Mesh(p.g,m);ms.frustumCulled=false;inner.add(ms);if(!pj){const o=new THREE.Mesh(p.h,om);o.frustumCulled=false;ms.add(o);}}   // 有投影原圖時不畫描邊：原圖自己有描邊，模型的小零件（坐墊凹痕、圖釘）描出來的線原圖裡沒有
  g.visible=false;scene.add(g);return{g,inner,U,F,om,dispose(){scene.remove(g);mats.forEach(m=>m.dispose());}};}

// ---------- 像素字（RARE／LIMITED／COMMON） ----------
const GL={L:['##.....','##.....','##.....','##.....','##.....','##.....','##.....','#######','#######'],I:['######','..##..','..##..','..##..','..##..','..##..','..##..','..##..','######'],
  M:['##...##','###.###','#######','##.#.##','##...##','##...##','##...##','##...##','##...##'],T:['######','######','..##..','..##..','..##..','..##..','..##..','..##..','..##..'],
  E:['######','######','##....','##....','#####.','##....','##....','######','######'],D:['#####.','######','##..##','##..##','##..##','##..##','##..##','######','#####.'],
  R:['#####.','######','##..##','##..##','#####.','####..','##.##.','##..##','##..##'],A:['.####.','######','##..##','##..##','######','######','##..##','##..##','##..##'],
  O:['.####.','######','##..##','##..##','##..##','##..##','##..##','######','.####.'],N:['##...##','###..##','####.##','##.####','##..###','##...##','##...##','##...##','##...##'],
  C:['.#####','######','##....','##....','##....','##....','##....','######','.#####'],'!':['##','##','##','##','##','##','..','##','##']};
const TG={limited:['#ffffff','#fff3c2','#ffe27a','#ffe27a','#ffd25e','#ffd25e','#f2b53e','#d9952f','#b8692a'],rare:['#ffffff','#ebe4ff','#d4c6ff','#d4c6ff','#b8a2ff','#b8a2ff','#9a86e6','#7a64c8','#5a48a0'],
  common:['#ffffff','#fff6ec','#ffeef2','#ffd4dc','#ffb3c0','#ffb3c0','#f290a8','#e27d9c','#c8648a']};
function drawWord(x,word,cx,cy,sc,kind,t,pops){const gs=[...word].map(ch=>GL[ch]);const ws=gs.map(g=>g[0].length);const tw=ws.reduce((a,b)=>a+b,0)*sc+(gs.length-1)*sc*1.5;let ox=Math.round(cx-tw/2);
  const ink='#3a2622',o=Math.max(1,sc>>1);
  gs.forEach((g,i)=>{const p=pops?pops[i]:1;if(p<=0){ox+=ws[i]*sc+sc*1.5;return;}const s=Math.max(1,Math.round(sc*p)),gw=ws[i]*s,gx=Math.round(ox+(ws[i]*sc-gw)/2),gy=Math.round(cy-9*s/2-(p>1?(p-1)*sc*3:0));
    for(let r=0;r<9;r++)for(let c=0;c<g[0].length;c++)if(g[r][c]==='#'){x.fillStyle='#24163a';x.fillRect(gx+c*s,gy+r*s+o+1,s,s);}
    for(let r=0;r<9;r++)for(let c=0;c<g[0].length;c++)if(g[r][c]==='#'){x.fillStyle=ink;x.fillRect(gx+c*s-o,gy+r*s-o,s+o*2,s+o*2);}
    for(let r=0;r<9;r++)for(let c=0;c<g[0].length;c++)if(g[r][c]==='#'){let col=TG[kind][r];const sh=((t/4+i*40)%900)-120;if(Math.abs((gx+c*s)-(cx-tw/2)-sh+r*s*.6)<s*1.6)col='#ffffff';x.fillStyle=col;x.fillRect(gx+c*s,gy+r*s,s,s);}
    ox+=ws[i]*sc+sc*1.5;});}

// ---------- 音效（同 v2） ----------
let AC=null,SND=true,MUTE=false;const ac=()=>AC||(AC=new (window.AudioContext||window.webkitAudioContext)());
function tone(f,d,type='sine',v=.1,t0=0,f2){if(!SND||MUTE)return;const A=ac(),t=A.currentTime+t0,o=A.createOscillator(),gn=A.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);gn.gain.setValueAtTime(v,t);gn.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(gn).connect(A.destination);o.start(t);o.stop(t+d+.02);}
function noise(d,v,f0,f1,t0=0){if(!SND||MUTE)return;const A=ac(),t=A.currentTime+t0,b=A.createBuffer(1,Math.ceil(A.sampleRate*d),A.sampleRate),ch=b.getChannelData(0);for(let i=0;i<ch.length;i++)ch[i]=Math.random()*2-1;
  const s=A.createBufferSource(),bp=A.createBiquadFilter(),gn=A.createGain();s.buffer=b;bp.type='bandpass';bp.Q.value=1.2;bp.frequency.setValueAtTime(f0,t);bp.frequency.exponentialRampToValueAtTime(f1,t+d);gn.gain.setValueAtTime(v,t);gn.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(bp).connect(gn).connect(A.destination);s.start(t);}
function meow(p=1,t0=0,v=.09){if(!SND||MUTE)return;const A=ac(),t=A.currentTime+t0,o=A.createOscillator(),lf=A.createOscillator(),lg=A.createGain(),bp=A.createBiquadFilter(),gn=A.createGain();
  o.type='triangle';o.frequency.setValueAtTime(560*p,t);o.frequency.linearRampToValueAtTime(980*p,t+.12);o.frequency.linearRampToValueAtTime(640*p,t+.42);lf.frequency.value=7;lg.gain.value=14*p;lf.connect(lg).connect(o.frequency);
  bp.type='bandpass';bp.frequency.value=1300*p;bp.Q.value=1.4;gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(v,t+.04);gn.gain.exponentialRampToValueAtTime(.001,t+.46);o.connect(bp).connect(gn).connect(A.destination);o.start(t);lf.start(t);o.stop(t+.5);lf.stop(t+.5);}
const sfx={coin:()=>{tone(1320,.12,'square',.04);tone(1980,.22,'square',.04,.06);},click:()=>tone(240,.04,'square',.05),whoosh:()=>noise(.28,.12,400,2400),pop:()=>{tone(620,.14,'triangle',.12,0,200);noise(.08,.08,3000,800);},
  land:()=>tone(160,.08,'sine',.12),charge:k=>tone(k==='limited'?330:262,.5,'sine',.06,0,k==='limited'?990:784),
  up:k=>{const b=k==='limited'?660:523;[0,1,2,3].forEach(i=>tone(b*Math.pow(1.26,i),.18,'triangle',.08,i*.05));},crack:()=>noise(.06,.14,4000,1800),
  burst:k=>{const n=k==='limited'?[523,659,784,1047,1319,1568]:(k==='rare'?[523,659,784,1047]:[659,784,1047]);n.forEach((f,i)=>tone(f,.6,'triangle',.07,i*.06));noise(.5,k==='common'?.06:.14,1800,200);if(k!=='common')tone(80,.6,'sawtooth',.05,0,45);},
  shine:()=>[1568,2093,2637].forEach((f,i)=>tone(f,.25,'sine',.035,i*.05)),mini:k=>tone(k==='common'?880:(k==='rare'?1175:1568),.18,'triangle',.06)};

// ---------- 鏡頭 ----------
// 鍵：[時間, 目標x,y,z, 方位角°, 仰角°, 距離, 視角°, 側傾°, 緩動]
function camAt(K,s){if(s<=K[0][0])return K[0];for(let i=1;i<K.length;i++)if(s<K[i][0]){const a=K[i-1],b=K[i],u=(EZ[b[9]||'inout'])(sat((s-a[0])/(b[0]-a[0])));const r=[s];for(let j=1;j<9;j++)r.push(lerp(a[j],b[j],u));return r;}return K[K.length-1];}
function applyCam(k,shk,punch,e){const[,tx,ty,tz,az,el,d0,fov,roll]=k;const asp=W/H,d=d0*Math.max(1,1.55/asp);const A=az*Math.PI/180,E=el*Math.PI/180;
  cam.position.set(tx+d*Math.sin(A)*Math.cos(E),ty+d*Math.sin(E),tz+d*Math.cos(A)*Math.cos(E));cam.up.set(0,1,0);cam.lookAt(tx,ty,tz);cam.rotateZ(roll*Math.PI/180);
  if(shk>0&&!RM){const f=Math.floor(e/34);cam.translateX((hash(f)-.5)*2*shk*d*.22);cam.translateY((hash(f+.37)-.5)*2*shk*d*.22);}
  cam.fov=fov*(1-punch);cam.aspect=asp;cam.updateProjectionMatrix();}
const sumEv=(L,s)=>L.reduce((a,[t,amp,d])=>a+amp*decay(s,t,d),0);
function flashAt(L,s){let best=null,ba=0;for(const[t,col,a,d]of L){if(s<t||s>t+d)continue;const v=a*(1-(s-t)/d);if(v>ba){ba=v;best=col;}}return[best,ba];}

// ---------- 抽（試做：本機亂數，不碰真的貓貓幣） ----------
let wallet=LIVE?0:3000,FORCE=LIVE?null:Q.get('force');if(!RATE[FORCE])FORCE=null;
// 已擁有的家具（試做：只記在這台電腦的瀏覽器；正式版＝大廳給的背包 houseInv 裡有的家具）
const OWN=new Set(LIVE?[]:(()=>{try{return JSON.parse(localStorage.getItem('tt_gacha_owned')||'[]');}catch(e){return[];}})());
const saveOwn=()=>{if(LIVE)return;try{localStorage.setItem('tt_gacha_owned',JSON.stringify([...OWN]));}catch(e){}};
function hostSync(s){if(!LIVE)return;try{s=s||HOST.state();wallet=Number.isSafeInteger(s.balance)?s.balance:0;OWN.clear();(s.owned||[]).forEach(k=>OWN.add(k));}catch(e){}}
hostSync();
function pickRarity(r){if(FORCE)return FORCE;const x=r()*100;return x<RATE.limited?'limited':(x<RATE.limited+RATE.rare?'rare':'common');}
function pickItem(rk,r){const L=poolItems().filter(i=>i.r===rk);return L[Math.floor(r()*L.length)];}
function roll(n,r){const o=[];for(let i=0;i<n;i++)o.push(pickItem(pickRarity(r),r));
  if(n===10&&!o.some(i=>i.r!=='common'&&!OWN.has(i.k))){   // 十連保底：這個卡池裡還沒擁有的稀有以上（限定：稀有＝3：18）
    const cand=poolItems().filter(i=>i.r!=='common'&&!OWN.has(i.k)),lim=cand.filter(i=>i.r==='limited'),rar=cand.filter(i=>i.r==='rare'),slot=()=>{const c=o.map((it,i)=>it.r==='common'?i:-1).filter(i=>i>=0);return c.length?c[Math.floor(r()*c.length)]:Math.floor(r()*10);};
    if(cand.length){const L=lim.length&&(!rar.length||r()*(RATE.limited+RATE.rare)<RATE.limited)?lim:rar;o[slot()]=L[Math.floor(r()*L.length)];}
    else if(!o.some(i=>i.r!=='common'))o[slot()]=pickItem(r()*100<RATE.limited/(RATE.limited+RATE.rare)*100?'limited':'rare',r);}   // 稀有以上都收齊了：至少一件稀有以上
  if(!LIVE&&n===10&&Q.get('tenlim')!=null)o[+Q.get('tenlim')||0]=pickItem('limited',r);
  if(!LIVE&&window.__item){const it=ITEMS.find(i=>i.k===window.__item);if(it)o[0]=it;}   // 測試用：指定第一件
  return o;}

// ---------- 卡片停放的位置（讓 3D 卡片停好時剛好 1:1 對到像素） ----------
const REST={x:0,y:2.2,z:2.4,D:7.2,fov:30};
// 家具停放：大字在上、星星在大字下、家具站在舞台上（底邊對齊），整數倍放大；再反推鏡頭高度讓 3D 停好時剛好一格對一格
function furnLayout(it){const im=IMG['f_'+it.k]||IMG['raw_'+it.k],w=im.width,h=im.height,nar=W/H<1.45;
  const titleCY=Math.round(H*(nar?.21:.1)),starsY=titleCY+12,top=starsY+17,bot=Math.round(H*.77);
  const ks=Math.max(1,Math.min(4,Math.floor(Math.min((bot-top)/h,W*.62/w)))),fw=w*ks,fh=h*ks,left=Math.round(W/2-fw/2),y0=bot-fh;
  const d=REST.D*Math.max(1,1.55/(W/H)),wpp=2*d*Math.tan(REST.fov*Math.PI/360)/H,ty=(bot-H/2)*wpp,x0=(left+fw/2-W/2)*wpp;
  return{im,ks,w,h,fw,fh,left,top:y0,bot,titleCY,starsY,wpp,ty,x0,unit:ks*wpp,cyW:fh*wpp/2,hW:fh*wpp,wW:fw*wpp};}
function restLayout(){const nar=W/H<1.45;   // 窄畫面（手機直立、窄視窗）：卡片小一點、往下放，大字才不會壓到左上角標題
  const Ch=Math.round(H*(nar?.52:.64)/2)*2,Cw=Math.round(Ch*.78/2)*2,top=nar?Math.max(Math.round(H*.25),Math.round(H*.45-Ch/2)):Math.round(H*.45-Ch/2),left=(W-Cw)/2;
  const d=REST.D*Math.max(1,1.55/(W/H)),wpp=2*d*Math.tan(REST.fov*Math.PI/360)/H;   // 一個像素在卡片距離的世界長度
  const cyPix=top+Ch/2,ty=REST.y-(H/2-cyPix)*wpp;return{Cw,Ch,top,left,wpp,ty,hW:Ch*wpp,wW:Cw*wpp};}

const CAP0=V3(0,.42,.95);
// ---------- 單抽 v7（D 11/07）：扭蛋機吐出扭蛋 → 朝鏡頭滾、把畫面吞掉 → 貼地的鏡頭：扭蛋從大大的慢慢往前滾小、滾到高大的酒館大門前 →
//            門縫透光（升級）→ 大門砰地打開、家具從光裡跳出來 → 白光 → 小屋裡（跟上架預覽圖一樣：小屋地板＋小人在旁邊），家具掉下來、轉停在斜角 ----------
const VIS=4.2,FOV_F=4;   // 最後鏡頭：可見高度（世界單位）、視角（小視角＝接近小屋頁的正交斜角）
// 結果版面：寬畫面＝左邊字（稀有度大字、星星、名牌）、右邊大大的家具；窄畫面（手機直立）＝字在上、家具在下
function resLayout(it,ksMax=4,dx=0){const im=IMG['f_'+it.k]||IMG['raw_'+it.k],w=im.width,h=im.height,wide=W/H>=1.45;let o;
  if(wide){const bot=Math.round(H*.84),top0=Math.round(H*.06),cx=Math.round(W*.58)-dx,ks=Math.max(1,Math.min(ksMax,Math.floor(Math.min((bot-top0)/h,W*.46/w))));
    const titleX=Math.round(W*.2),titleCY=Math.round(H*.34);o={ks,bot,cx,titleX,titleCY,starsY:titleCY+12,plateX:titleX,plateY:titleCY+40};}
  else{const titleCY=Math.round(H*.21),bot=Math.round(H*.77),top0=titleCY+29,ks=Math.max(1,Math.min(ksMax,Math.floor(Math.min((bot-top0)/h,W*.62/w))));o={ks,bot,cx:Math.round(W/2)-dx,titleX:Math.round(W/2),titleCY,starsY:titleCY+12,plateX:Math.round(W/2),plateY:bot+6};}
  const fw=w*o.ks,fh=h*o.ks;return{im,w,h,fw,fh,left:Math.round(o.cx-fw/2),top:o.bot-fh,...o};}
function inLayout(it,F,ksMax,dx){const L=resLayout(it,ksMax,dx),wpp=VIS/H,unit=L.ks*PPU*wpp,ce=Math.cos(EL30),se=Math.sin(EL30);
  const[fx,fy]=FIT[F.k]||[0,0],Tx=unit*F.x0-(L.left-fx*L.ks-W/2)*wpp,Tu=unit*F.u0-(H/2-(L.bot-fy*L.ks))*wpp;   // 讓家具斜角外框的左下角落在原圖的左下角（再加上量出來的位移）
  const hW=(F.u1-F.u0)*unit;return{...L,F,wpp,unit,T:V3(Tx,Tu*ce,-Tu*se),hW,cyW:hW/2,wW:(F.x1-F.x0)*unit};}
function applyCamH(k,shk,punch,e){const[,tx,ty,tz,az,el,h,fov,roll]=k;const d=h/(2*Math.tan(fov*Math.PI/360));const A=az*Math.PI/180,E=el*Math.PI/180;
  cam.position.set(tx+d*Math.sin(A)*Math.cos(E),ty+d*Math.sin(E),tz+d*Math.cos(A)*Math.cos(E));cam.up.set(0,1,0);cam.lookAt(tx,ty,tz);cam.rotateZ(roll*Math.PI/180);
  if(shk>0&&!RM){const f=Math.floor(e/34);cam.translateX((hash(f)-.5)*2*shk*h*.12);cam.translateY((hash(f+.37)-.5)*2*shk*h*.12);}
  cam.fov=fov*(1-punch);cam.aspect=W/H;cam.updateProjectionMatrix();}
const T_Z0=-TZD+4.2,T_ZS=-TZD+.55,STAGE_Z0=1.35;   // 酒館那一鏡：扭蛋起點（鏡頭前）、停在門口的位置；舞台上落地的位置
const CAMF=[0,.5,1.6,0,3,3.0,38,0];   // 舞台上「扭蛋朝鏡頭滾過來」那一鏡（距離制）
const CAM_IDLE=[0,0,1.9,0,0,15,13.5,30,0];   // 11/08 戶外舞台：俯角 24°→15°，看得到舞台框上緣跟遠方（原本 24° 是對齊店內原畫的地板角度）
const CAM_IDLE0=[0,0,1.7,0,0,24,13.5,30,0];   // 待機鏡頭（抽的時候從這裡開始推近，只推近不繞圈）；俯角跟犬尤酒館原畫的地板角度接近
function engZ(){const asp=W/H,d=CAMF[5]*Math.max(1,1.55/asp);return CAMF[2]+d*Math.cos(CAMF[4]*Math.PI/180)-.44;}   // 扭蛋滾到這裡時剛好把鏡頭吞掉
// 小屋結果畫面：從小屋頁截的空房間（room/room_<系列>.png，1 倍）＋小人，跟家具同一個倍數放大、對齊家具的位置
let ROOMD=null;const ROOMI={};
function roomPlan(it,L){const RI=ROOMD&&ROOMD.items[it.k];if(!RI||!ROOMI[RI.set])return null;const S0=ROOMD.sets[RI.set],ks=L.ks;
  const capA=[RI.A[0]-S0.cx+S0.w/2,RI.A[1]-S0.cy+S0.h/2],ox=L.left-Math.round(capA[0]-RI.ax)*ks,oy=L.top-Math.round(capA[1]-RI.ay)*ks;
  return{img:ROOMI[RI.set],S0,ks,ox,oy};}   // D 11/07：結果畫面不放小人
const roomC=document.createElement('canvas'),rctx=roomC.getContext('2d');let roomTex=null;
function drawRoom(P,s){const R=P.room;if(!R)return;if(roomC.width!==W||roomC.height!==H){roomC.width=W;roomC.height=H;roomTex?.dispose();roomTex=null;}
  if(!roomTex){roomTex=new THREE.CanvasTexture(roomC);roomTex.magFilter=roomTex.minFilter=THREE.NearestFilter;roomTex.generateMipmaps=false;FINAL.uniforms.tR.value=roomTex;}
  const x=rctx;x.imageSmoothingEnabled=false;x.fillStyle='#4b2f6c';x.fillRect(0,0,W,H);x.drawImage(R.img,R.ox,R.oy,R.S0.w*R.ks,R.S0.h*R.ks);
  // 家具背後慢慢轉的放射光（稀有色、很淡）
  const L=P.L,cx=L.left+L.fw/2,cy=L.top+L.fh*.55,k=P.it.r,G=GLOW[k],a0=s*.00018,rr=Math.max(L.fw,L.fh)*1.15,al=(P.st?.03:.018)*sat((s-P.RC)/400)+.07*decay(s,P.REV,320);
  if(al>.003){x.save();x.globalCompositeOperation='lighter';x.fillStyle=`rgba(${G.map(v=>Math.round(v*255)).join(',')},${al})`;for(let i=0;i<16;i+=2){const a=a0+i/16*Math.PI*2,b=a0+(i+1)/16*Math.PI*2;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);x.lineTo(cx+Math.cos(b)*rr,cy+Math.sin(b)*rr);x.closePath();x.fill();}x.restore();}
  // 掉下來時地上的影子（越接近地面越大越深）
  if(P.FU&&s<P.HAND+200){const f=P.footS,hgt=P.FU.g.position.y,q=1-Math.min(1,hgt/(L.hW*1.5+.5)),sw=L.fw*.42*(.4+.6*q),sh=sw*.42;x.fillStyle=`rgba(70,34,52,${.28*q*(1-seg(s,P.HAND,P.HAND+200))})`;x.beginPath();x.ellipse(f[0],f[1],sw,sh,0,0,7);x.fill();}
  roomTex.needsUpdate=true;}
function planOne(it,seed,F){const st=RANK[it.r],P={n:1,it,st,seed,res:[it],best:it,F};const r=rng(seed);PA.clear();PN.clear();
  Object.assign(P,{COIN:620,T0:720,T1:1960,TEASE:1460,POP:2000,B1:2230,STG:860,UPG:560});
  P.ENG=P.B1+760;P.EZ=engZ();P.ARR=P.ENG+1500;P.H0=P.ARR+260;
  P.stages=[];for(let i=0;i<st;i++)P.stages.push({t:P.H0+i*P.STG,to:i===0?'rare':'limited'});
  P.CR1=P.H0+(st?st*P.STG:320)+60;P.CR2=P.CR1+280;P.holds=[[P.CR2+100,st?170:90]];P.OPEN=P.CR2+250;
  P.POP0=P.OPEN+80;P.RC=P.POP0+520;P.LAND=P.RC+560;P.SETTLE=P.LAND+620;P.REV=P.SETTLE+(st?120:0);P.HAND=P.REV+(st?260:160);P.DONE=P.REV+640+st*90;
  P.STARS=[...Array(st+1)].map((_,i)=>P.REV+240+i*190);
  const L=inLayout(it,F),RMP=roomPlan(it,L);
  P.L=L;P.room=RMP;P.unitT=1.5/Math.max(F.x1-F.x0,F.u1-F.u0);
  // 鏡頭：舞台（距離制）
  const K=[[0,...CAM_IDLE.slice(1)],[P.COIN,0,1.55,.6,0,4,6.4,30,0,'inout'],[P.T0+200,0,1.22,.9,0,-7,4.1,30,0,'out'],[P.TEASE,0,1.28,.9,0,-6,3.8,30,0,'lin']];   // 全部正面（az 0）：只推近、俯仰，不繞著機台轉
  if(st)K.push([P.T1-60,0,2.05,.6,0,-15,4.8,32,0,'inout']);else K.push([P.T1-60,0,1.25,.9,0,-5,3.5,30,0,'lin']);
  K.push([P.POP+60,...CAMF,'out']);P.cam=K;
  // 鏡頭：酒館大門（可見高度制）。貼地、微微往上看，大門顯得很高大；扭蛋從鏡頭前滾走、越來越小
  const D0=-TZD,KI=[[P.ENG,0,.4,T_Z0-.22,0,3,.5,42,0],[P.ENG+650,0,2.9,D0-.9,18,12,8.2,44,0,'out'],[P.ARR,0,1.8,D0-.2,9,-1,5.2,42,0,'inout'],[P.H0+220,0,1.2,D0,-5,-6,3.5,40,0,'inout']];
  let az=-7;P.stages.forEach((sg,i)=>{const to=i%2?-11:10;KI.push([sg.t+P.UPG-20,0,.95,D0,to,-8,2.4,38,i%2?3:-3,'inout'],[sg.t+P.UPG+240,0,1.0,D0,to*.8,-6,2.8,40,0,'out']);az=to*.8;});
  if(!st)KI.push([P.CR1-20,0,1.0,D0,az*.5,-6,2.7,40,0,'inout']);
  KI.push([P.CR2+60,0,.9,D0,-2,-7,2.3,38,2,'in'],[P.OPEN,0,.9,D0,-2,-7,2.25,38,2,'lin'],[P.POP0+120,0,1.15,D0,0,-6,3.4,44,0,'out'],[P.RC,0,1.3,D0+.6,0,-4,3.0,48,0,'in']);P.camI=KI;
  P.camR=[[P.RC,L.T.x,L.T.y,L.T.z,0,30,VIS,FOV_F,0]];
  // 震動、鏡頭推、閃光、衝擊格
  P.shk=[[P.COIN,.03,120],[P.POP,.06,160],[P.B1,.05,120],[P.ARR,.05,160],[P.CR1,.05,90],[P.CR2,.08,120],[P.OPEN,st===2?.2:(st?.13:.08),st?420:260],[P.LAND,st?.06:.04,200]];
  for(let i=0;i<8;i++)P.shk.push([P.T0+(i+.6)*(P.T1-P.T0)/8,.018,70]);
  P.pun=[[P.ENG-120,.06,120],[P.OPEN,st?.07:.04,160]];const IMPL={common:'#ffeef2',rare:'#ebe4ff',limited:'#fff3c2'}[it.r],gh='#'+C().setRGB(...GLOW[it.r]).getHexString();
  P.imp=st?[[P.OPEN,55,2,IMPL],[P.OPEN+55,55,1,IMPL]]:[];
  P.fl=[[P.OPEN+110,gh,st?.18:.12,220],[P.RC-90,'#ffffff',.5,90],[P.RC,'#ffffff',.9,240],[P.REV,'#ffffff',st?.25:.15,110]];if(!st)P.fl.push([P.OPEN,'#ffffff',.3,80]);
  P.stages.forEach(sg=>{const u=sg.t+P.UPG;P.shk.push([u,.11,260]);P.pun.push([u,.08,220]);P.fl.push([u,'#'+C().setRGB(...GLOW[sg.to]).getHexString(),.24,110]);});
  // 粒子（酒館那一鏡；小屋那一鏡用 2D 的小閃光）
  const k=it.r,slot=[0,1.66,1.0],dc=[0,TDSP*.8,-TZD+.3];
  for(let i=0;i<26;i++){const u=i/26,p=coinPath(u*P.COIN);PA.add([p.x,p.y,p.z],[(r()-.5)*.3,-.2,(r()-.5)*.3],u*P.COIN,380,1,0,[1,.88,.5],[.6,.35,.15],r()<.3?1:0,r()<.3?5:1,r());}
  sparks(r,slot,P.COIN,18,'limited',{sp:[1,3],life:[300,600],size:[1,2],up:.6});
  if(st){for(let i=0;i<40;i++){const a=r()*6.283,rr=r()*.7;PA.add([Math.cos(a)*rr,2.4+r()*.6,Math.sin(a)*rr*.6+.2],[(r()-.5)*.3,.9+r()*.8,(r()-.5)*.2],P.TEASE+r()*(P.POP-P.TEASE),700+r()*400,.6,-.2,SPK[k].a,SPK[k].b,r()<.35?1:0,r()<.35?5:2,r());}}
  dust(r,[0,.2,STAGE_Z0],P.B1,10);sparks(r,[0,.45,1.05],P.POP,12,'common',{sp:[1,3.5],size:[1,2],life:[250,500]});
  for(let t=P.B1;t<P.ENG-60;t+=45){const z=rollStage(P,t),sd=t%90<45?1:-1;PA.add([.22*sd,.06,z],[.7*sd,.5+r()*.4,-.5],t,300+r()*200,2.4,1.2,[1,.86,.6],[.6,.3,.4],r()<.3?1:0,r()<.3?5:1,r());}
  for(let t=P.ENG+80;t<P.ARR-150;t+=70){const z=rollTav(P,t),sd=t%140<70?1:-1;PA.add([.2*sd,.05,z],[.5*sd,.35+r()*.3,.3],t,280+r()*160,2.4,1.2,[1,.86,.6],[.6,.3,.4],r()<.3?1:0,r()<.3?5:1,r());}
  dust(r,[0,.08,T_ZS-.1],P.ARR,10);
  P.stages.forEach(sg=>{converge(r,dc,sg.t,P.UPG,46,sg.to);const u=sg.t+P.UPG;sparks(r,dc,u,46,sg.to,{sp:[2,6],life:[350,800]});stars(r,dc,u,8,sg.to,{size:[5,7]});});
  if(!st)converge(r,dc,P.H0,380,22,'common');
  sparks(r,dc,P.CR1,10,k,{sp:[1,3],size:[1,2],life:[200,400]});sparks(r,dc,P.CR2,16,k,{sp:[1.5,4],size:[1,2],life:[200,450]});
  {const big=st===2?1:(st?.72:.42);sparks(r,dc,P.OPEN,Math.round(170*big),k,{sp:[3,10],drag:2.4,grav:1.3,life:[500,1300],size:[1,3]});stars(r,dc,P.OPEN,Math.round(26*big),k,{sp:[2,6.5],size:[5,11]});confetti(r,[0,1.8,T_ZS],P.OPEN+40,Math.round(130*big),k);}
  PA.commit();PN.commit();
  // 聲音
  P.snd=[[P.COIN*COIN_IN,sfx.coin],[P.COIN,()=>meow(1.1)],[P.POP,()=>{sfx.pop();}],[P.B1,sfx.land],[P.ENG-140,sfx.whoosh],[P.ARR,()=>{tone(150,.1,'sine',.14);tone(150,.1,'sine',.12,.16);}],
    [P.CR1,sfx.crack],[P.CR2,sfx.crack],[P.OPEN,()=>{sfx.burst(k);noise(.35,.12,300,2600);if(st)setTimeout(()=>meow(1.15,0,.08),380);}],[P.RC,()=>{sfx.whoosh();tone(880,.2,'triangle',.05,0,1320);}],[P.REV,sfx.shine]];
  for(let i=0;i<8;i++)P.snd.push([P.T0+(i+.6)*(P.T1-P.T0)/8,sfx.click]);if(st)P.snd.push([P.TEASE,()=>meow(1.35,0,.07)]);
  for(let t=P.B1+80,i=0;t<P.ENG-60;t+=Math.max(55,130-i*10),i++)P.snd.push([t,()=>tone(180+i*14,.05,'triangle',.035)]);   // 滾動的咚咚聲（越滾越快）
  for(let t=P.ENG+90,i=0;t<P.ARR-120;t+=90+i*14,i++)P.snd.push([t,()=>tone(260-i*10,.05,'triangle',.03)]);   // 往門口滾（越來越慢）
  P.stages.forEach(sg=>{P.snd.push([sg.t,()=>sfx.charge(sg.to)],[sg.t+P.UPG,()=>{sfx.up(sg.to);meow(1.25,0,.06);}]);});
  P.STARS.forEach((t,i)=>P.snd.push([t,()=>{tone(1047*Math.pow(1.26,i),.2,'square',.035);tone(2093*Math.pow(1.26,i),.3,'triangle',.04,.03);}]));
  P.snd.push([P.POP0,()=>{sfx.pop();sfx.whoosh();}],[P.LAND,()=>{tone(130,.12,'sine',.16);noise(.12,.08,900,300);meow(1.2,.2,.05);}]);
  FURN?.dispose();FURN=furn3D(F);P.FU=FURN;
  // 最後交給 2D 時用原圖（不調色，跟小屋裡一樣）
  const raw=IMG['raw_'+it.k]||L.im;P.spr=document.createElement('canvas');P.spr.width=L.fw;P.spr.height=L.fh;{const x=P.spr.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(raw,0,0,L.fw,L.fh);}
  P.tmp=document.createElement('canvas');P.tmp.width=L.fw;P.tmp.height=L.fh;
  applyCamH([0,...P.camR[0].slice(1)],0,0,0);cam.updateMatrixWorld();{const v=V3(0,0,0).project(cam);P.footS=[(v.x+1)/2*W,(1-v.y)/2*H];}
  return P;}
function rollStage(P,s){return STAGE_Z0+(P.EZ-STAGE_Z0)*EZ.in2(seg(s,P.B1,P.ENG));}   // 舞台上：朝鏡頭越滾越快
function rollTav(P,s){return T_Z0+(T_ZS-T_Z0)*EZ.out(seg(s,P.ENG,P.ARR));}            // 酒館：往門口滾，越來越慢、停在門口
// 投幣：從右上拋過來（翻轉、越飛越慢）→ 停在投幣口前、正面朝鏡頭 → 倒平對準橫的投幣口 → 推進去（被機身擋住＝投進去了）
const COIN_A=V3(2.7,3.6,3.3),COIN_M=V3(1.5,3.9,2.4),COIN_H=V3(0,1.66,1.45),qFace=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)),
  qEdge=new THREE.Quaternion(),COIN_IN=.86;   // qEdge＝平躺（圓柱軸朝上）   // COIN_IN＝推進去的那一刻（佔整段的比例）
function coinAt(u){const p=V3(),q=new THREE.Quaternion();
  if(u<.55){const k=EZ.out(u/.55),a=1-k;p.copy(COIN_A).multiplyScalar(a*a).addScaledVector(COIN_M,2*k*a).addScaledVector(COIN_H,k*k);
    q.setFromEuler(new THREE.Euler(Math.PI/2+a*9,a*2.5,0));q.slerp(qFace,seg(k,.55,1));}
  else if(u<.7){const k=(u-.55)/.15;p.copy(COIN_H);p.y+=.03*Math.sin(k*Math.PI);q.copy(qFace).slerp(qEdge,EZ.inout(sat(k*1.4-.2)));}
  else{const k=EZ.in2(sat((u-.7)/(COIN_IN-.7)));p.set(0,COIN_H.y,lerp(COIN_H.z,.62,k));q.copy(qEdge);}
  return{p,q,vis:u<COIN_IN};}
function coinPath(s){return coinAt(sat(s/620)).p;}   // 拖尾小閃光用（單抽 COIN＝620）
let COINS=[];   // 十連：一串硬幣接連投進去
function capKindAt(P,s){return P.it.r;}   // 11/08 D「扭蛋從轉出來那刻起就知道稀有度，外殼顏色對應稀有度」：不再從普通色一階一階升級
// 大門：開門角度；扭蛋撞到門、升級、快爆開時門會晃
function tavDoor(P,s){if(s>=P.OPEN){const u=seg(s,P.OPEN,P.OPEN+170);return 2.0*EZ.back(u);}
  let w=.05*Math.sin((s-P.ARR)/30)*decay(s,P.ARR,160);for(const sg of P.stages||[])w+=.06*Math.sin((s-sg.t-P.UPG)/28)*decay(s,sg.t+P.UPG,180);if(s>=P.CR1)w+=.025*Math.sin(s/19)*(s>=P.CR2?1.8:1);return Math.abs(w);}

function updOne(s,e){const P=plan,k=P.it.r,st=P.st,L=P.L,tav=s>=P.ENG&&s<P.RC,room=s>=P.RC;stg.scale.setScalar(1);stg.position.z=0;TENF.forEach(F=>F.g.visible=false);TPAD.forEach(m=>m.visible=false);
  stageBg(!tav&&!room);tavShow(tav);P.bgOn=tav;P.roomOn=room;
  if(room)applyCamH(camAt(P.camR,s),sumEv(P.shk,s),0,e);else if(tav)applyCamH(camAt(P.camI,s),sumEv(P.shk,s),sumEv(P.pun,s),e);else applyCam(camAt(P.cam,s),sumEv(P.shk,s),sumEv(P.pun,s),e);
  // 扭蛋機
  let ex='open',sq=0,kn=0;const blink=(s%3700)<120||((s+2400)%5300)<110;
  if(s<P.COIN)ex=blink?'blink':'open';else if(s<P.T0)ex='happy';else if(s<P.T1){ex=st&&s>P.TEASE?'star':'squint';}else ex='wow';
  sq+=.05*decay(s,P.COIN,140)+.1*decay(s,P.POP,170);
  if(s>=P.T0){const n=8,ci=Math.min(n,Math.floor((s-P.T0)/(P.T1-P.T0)*n)),f=s<P.T1?((s-P.T0)/(P.T1-P.T0)*n)%1:1;kn=(Math.min(ci,n-1)+EZ.out(Math.min(1,f*1.6)))*Math.PI/2;if(s>=P.T1)kn=n*Math.PI/2;
    for(let i=0;i<n;i++)sq+=.035*decay(s,P.T0+(i+.6)*(P.T1-P.T0)/n,90);}
  mach.position.set(0,0,0);mach.rotation.y=0;body.scale.set(1+sq,1-sq*1.4,1+sq);knob.rotation.z=-kn;drawFace(ex);
  flap.rotation.x=s>P.POP-40?-1.1*Math.exp(-Math.max(0,s-P.POP)/260)*Math.cos(Math.max(0,s-P.POP)/60):0;
  let amp=0;for(let i=0;i<8;i++)amp+=decay(s,P.T0+(i+.6)*(P.T1-P.T0)/8,260);amp=Math.min(1.3,amp)+.05*decay(s,P.COIN,300);
  for(const m of MINI){m.g.position.set(m.base.x+Math.sin(s*.021+m.ph)*.07*amp,m.base.y+Math.abs(Math.sin(s*.027+m.ph*1.3))*.2*amp,m.base.z+Math.sin(s*.017+m.ph*2.1)*.06*amp);m.g.rotation.set(m.rot.x+Math.sin(s*.01+m.ph)*amp,m.rot.y+s*.002*amp,m.rot.z);}
  const tg=st?sat((s-P.TEASE)/360)*(s<P.POP?1:decay(s,P.POP,240)):0;domeMat.uniforms.uGlow.value=tg*.5;domeMat.uniforms.uGlowC.value.setRGB(...GLOW[k]);
  domeGlow.visible=domeRays.visible=tg>0&&s<P.ENG;if(domeGlow.visible){const dp=V3(0,2.8,0);domeGlow.position.copy(dp);domeGlow.scale.setScalar(3.2);setC(domeGlow.material.uniforms,GLOW[k],tg*.45);domeGlow.material.uniforms.uI.value=1;
    domeRays.position.copy(dp);domeRays.scale.setScalar(7.5);setC(domeRays.material.uniforms,GLOW[k]);domeRays.material.uniforms.uI.value=tg*.55;domeRays.material.uniforms.uRot.value=s*.0012;}
  bubble.visible=!!st&&s>P.TEASE&&s<P.POP;if(bubble.visible){const u=seg(s,P.TEASE,P.TEASE+140);bubble.position.set(1.35,3.35+Math.sin(s/120)*.04,.5);bubble.scale.setScalar(EZ.back(u));bubble.quaternion.copy(cam.quaternion);}
  COINS.forEach(c=>c.visible=false);if(s<P.COIN){const c=coinAt(s/P.COIN);coin.visible=c.vis;coin.position.copy(c.p);coin.quaternion.copy(c.q);}
  slotMat.uniforms.uEmis.value.setRGB(1,.75,.35).multiplyScalar(.9*decay(s,P.COIN*COIN_IN,260));
  // 主角扭蛋：彈出 → 朝鏡頭滾（吞掉畫面）→ 換鏡頭往大門滾 → 停在門口 → 跟著大門一起爆開
  const H0=HERO,ck=capKindAt(P,s);H0.setKind(ck);H0.top.position.set(0,0,0);H0.bot.position.set(0,0,0);H0.g.quaternion.identity();
  let hv=false,pos=V3(),scx=1,scy=1;
  if(s>=P.POP&&s<P.B1){hv=true;const u=seg(s,P.POP,P.B1);pos.lerpVectors(CAP0,V3(0,.36,STAGE_Z0),u);pos.y+=Math.sin(u*Math.PI)*.45;H0.g.rotation.set(u*Math.PI*2,0,0);}
  else if(s>=P.B1&&s<P.ENG){hv=true;const z=rollStage(P,s);pos.set(0,.36+Math.abs(Math.sin(z*6))*.01,z);H0.g.quaternion.setFromAxisAngle(V3(1,0,0),(z-STAGE_Z0)/.36);const l=decay(s,P.B1,70);scx=1+.22*l;scy=1-.26*l;}
  else if(tav&&s<P.OPEN+1300){hv=true;const z=rollTav(P,Math.min(s,P.ARR));pos.set(0,.36,z);if(s<P.ARR)H0.g.quaternion.setFromAxisAngle(V3(-1,0,0),(T_Z0-z)/.36);else{H0.g.quaternion.setFromAxisAngle(V3(-1,0,0),(T_Z0-T_ZS)/.36);pos.z+=.04*Math.sin((s-P.ARR)/40)*decay(s,P.ARR,140);}
    if(s>=P.CR1&&s<P.OPEN)pos.x+=Math.sin(s/13)*.02;for(const sg of P.stages){const u=seg(s,sg.t+P.UPG,sg.t+P.UPG+300);if(u>0&&u<1)pos.y+=Math.sin(u*Math.PI)*.3;}}
  H0.g.visible=hv;H0.g.position.copy(pos);H0.g.scale.set(scx,scy,scx);
  let glow=0;for(const sg of P.stages){if(s>=sg.t&&s<sg.t+P.UPG)glow=Math.max(glow,seg(s,sg.t,sg.t+P.UPG));if(s>=sg.t+P.UPG&&s<sg.t+P.STG)glow=Math.max(glow,1-seg(s,sg.t+P.UPG,sg.t+P.STG)*.5);}
  const crk1=s>=P.CR1?1:0,crk2=s>=P.CR2?1:0;H0.glow(ck,tav&&s<P.OPEN?Math.max(glow,.25+crk1*.4):0);H0.crack(ck,tav&&s<P.OPEN?crk1:0,tav&&s<P.OPEN?crk2:0);
  if(s>=P.OPEN){const t=(s-P.OPEN)/1000;H0.seam(ck,0);H0.top.position.set(-1.3*t,4.2*t-6.5*t*t,.9*t);H0.top.rotation.set(t*7,0,t*9);H0.bot.position.set(1.1*t,1.4*t-6.5*t*t,.7*t);H0.bot.rotation.set(-t*4,0,-t*6);}
  else{H0.top.rotation.set(0,0,0);H0.bot.rotation.set(0,0,0);H0.seam(ck,crk2?.9+.3*Math.sin(s/25):(crk1?.35:0));}
  {const t=(s-P.OPEN)/1000,o=V3(0,.36,T_ZS);SHARDS.forEach((m,j)=>{m.visible=tav&&t>=0&&t<1.3;if(!m.visible)return;const h1=hash(j*3.1+P.seed%97),h2=hash(j*7.7+1.3),h3=hash(j*1.9+5.1);
    const a=h1*6.283,el=(h2-.25)*1.7,v=(2.4+h3*3.4)*(st?1:.75),f=(1-Math.exp(-1.7*t))/1.7;
    m.position.set(o.x+Math.cos(a)*Math.cos(el)*v*f,o.y+Math.sin(el)*v*f-3.2*t*t,o.z+(Math.sin(a)*Math.cos(el)*.6+.4)*v*f);m.rotation.set(t*(6+h1*9),t*(4+h2*7),0);m.scale.setScalar(.7+h3*.9);});}
  // 酒館大門：門縫透光（升級時換稀有色）、窗戶跟著亮；爆開時兩扇門往外甩開
  const da=tavDoor(P,s),G=GLOW[ck],warm=[1,.88,.7],lc=s>=P.OPEN?GLOW[k]:(s>=P.H0?G:warm);
  const leak=s<P.ARR?0:(s<P.H0?.35*seg(s,P.ARR,P.H0):.45+glow*.6+crk1*.35+crk2*.3+.15*Math.sin(s/60));
  if(tav)tavLights(s,da,leak,lc,s>=P.H0?.55+glow*.5:.35,s>=P.H0?G:warm,.7+.1*Math.sin(s/90));
  const dcw=TDOOR_C.clone().add(V3(0,0,.2));tRays.visible=tGlow.visible=tav&&(da>.05||glow>0||!!crk1);if(tRays.visible){const op=s>=P.OPEN,ou=seg(s,P.OPEN,P.OPEN+300);
    tRays.position.copy(dcw);tRays.scale.setScalar(op?lerp(3,16*(st?1:.7)+4,EZ.out5(ou)):3.4+glow*1.5+crk1*.8);setC(tRays.material.uniforms,lc);tRays.material.uniforms.uI.value=op?(.45*decay(s,P.OPEN,300)+.12):glow*.3+crk1*.12;tRays.material.uniforms.uRot.value=s*.0011;
    tGlow.position.copy(dcw);tGlow.scale.setScalar(op?lerp(2,6,EZ.out(ou)):2+glow);setC(tGlow.material.uniforms,lc);tGlow.material.uniforms.uI.value=op?.4*decay(s,P.OPEN,260):glow*.25;}
  tBeam.visible=tav&&da>.1;if(tBeam.visible){tBeam.material.uniforms.uI.value=Math.min(1,da/1.2)*(.45*decay(s,P.OPEN,500)+.2);tBeam.material.uniforms.uC.value.setRGB(...lc);}
  fxCrack.visible=!!crk1&&s<P.OPEN&&tav;if(fxCrack.visible){fxCrack.position.copy(dcw);fxCrack.scale.setScalar((4.4+crk2*1.6)*(st?1:.75));setC(fxCrack.material.uniforms,G);fxCrack.material.uniforms.uI.value=(.45*(decay(s,P.CR1,120)+decay(s,P.CR2,140))+.14)*[.45,.8,1][st];fxCrack.material.uniforms.uRot.value=1.2+crk2*.4;}
  fxRays.visible=glow>0&&tav&&s<P.OPEN;if(fxRays.visible){fxRays.position.copy(pos);fxRays.scale.setScalar(2.4+glow*1.4);setC(fxRays.material.uniforms,G);fxRays.material.uniforms.uI.value=glow*.35;fxRays.material.uniforms.uRot.value=s*.002;fxRays.material.uniforms.uCore.value=.6;fxRays.material.uniforms.uLen.value=1;}
  fxRays2.visible=false;
  fxGlow.visible=tav&&s<P.OPEN+600;if(fxGlow.visible){const gu=fxGlow.material.uniforms;if(s<P.OPEN){fxGlow.position.copy(pos);fxGlow.scale.setScalar(1.2+glow*.8);setC(gu,G);gu.uI.value=glow*.3+crk1*.12;}else{fxGlow.position.set(0,.5,T_ZS);fxGlow.scale.setScalar(lerp(2,5,EZ.out(seg(s,P.OPEN,P.OPEN+300))));setC(gu,GLOW[k]);gu.uI.value=.45*decay(s,P.OPEN,200);}}
  GU.uPLp.value.copy(dcw).add(V3(0,0,1.1));GU.uPLi.value=tav?(s<P.ARR?.2:.35+glow*.7+crk1*.3)+(s>=P.OPEN?1.0*decay(s,P.OPEN,700):0):0;GU.uPLc.value.setRGB(lc[0]*.5,lc[1]*.5,lc[2]*.5);
  // 震波
  const RG=[];for(const sg of P.stages){RG.push(['in',sg.t+60,380,sg.to,1,pos.clone()],['out',sg.t+P.UPG,420,sg.to,1,pos.clone()]);}RG.push(['out',P.OPEN,520,k,1.6,dcw],['out',P.OPEN+90,640,k,1.1,dcw]);
  fxRings.forEach(m=>m.visible=false);let ri=0;for(const[dir,t0,d,kk,amt,o]of RG){if(!tav||s<t0||s>t0+d||ri>=fxRings.length)continue;const u=(s-t0)/d,m=fxRings[ri++],mu=m.material.uniforms;m.visible=true;
    m.position.copy(o);m.scale.setScalar(dir==='in'?3.6:(t0>=P.OPEN?(st?11:7):5));mu.uR.value=dir==='in'?.95*(1-EZ.in2(u)):.06+.92*EZ.out(u);mu.uT.value=dir==='in'?.04:.05*(1-u)+.012;mu.uI.value=(dir==='in'?u:1-u)*amt*.9;setC(mu,GLOW[kk]);}
  pillar.visible=false;fShadow.visible=false;fxBG.visible=fxBG2.visible=false;
  // 家具：酒館那一鏡＝從門口的光裡翻轉著跳出來、衝向鏡頭；小屋那一鏡＝從上面掉進房間、落地壓扁回彈、轉停在斜角；稀有以上先是剪影＋亮邊，停好才揭曉
  const FU=FURN;FU.g.visible=(tav&&s>=P.POP0)||(room&&s<P.HAND+220);
  if(FU.g.visible){let sx=1,sy=1;const U=FU.U,Gk=GLOW[k];
    if(!room){const u=seg(s,P.POP0,P.RC),sc=P.unitT*lerp(.15,1,EZ.out(sat(u*2.2)));FU.g.position.set(0,lerp(.7,1.9,EZ.out(u))+Math.sin(u*Math.PI)*.4,lerp(-TZD+.15,-TZD+2.4,EZ.out(u)));
      FU.g.rotation.set(Math.sin(u*Math.PI*2)*.3,u*Math.PI*5,Math.sin(u*Math.PI)*.2);FU.g.scale.setScalar(sc);}
    else{const u=seg(s,P.RC,P.LAND),apY=L.hW*2.2+1.2;let py=s<P.LAND?lerp(apY,0,EZ.in2(u)):0;
      if(s<P.LAND){const st2=sat((u-.7)/.3);sy=1+.14*st2;sx=1-.07*st2;}else{const q=seg(s,P.LAND,P.LAND+320);const w=q<1?Math.sin(q*Math.PI*2)*(1-q)*.24:0;sy=1-w;sx=1+w*.7;}
      FU.g.position.set(0,py,0);FU.g.rotation.set(0,Math.PI*3*(1-EZ.out(seg(s,P.RC,P.SETTLE))),0);FU.g.scale.set(L.unit*sx,L.unit*sy,L.unit*sx);}
    U.uRev.value=st?sat((s-P.REV)/180)*1.02:1;U.uRim.value=st?1:0;const pu=s>=P.LAND?.75+.25*Math.sin(s/60):1;U.uRimC.value.setRGB(Math.min(1,Gk[0]*pu+.15),Math.min(1,Gk[1]*pu+.15),Math.min(1,Gk[2]*pu+.15));
    U.uWhite.value=Math.max(.8*decay(s,P.REV,90),.6*decay(s,P.POP0,90),.5*decay(s,P.LAND,80));}
  if(room)drawRoom(P,s);
  FINAL.uniforms.uBgDim.value=tav?(s<P.ARR?0:(s<P.OPEN?sat((s-P.ARR)/400)*.3:.3*(1-sat((s-P.OPEN)/500)))):0;GU.uDim.value=0;   // 門縫透光時背景稍微壓暗
  bgMat.uniforms.uRev.value=floorMat.uniforms.uRev.value=0;
  stageLights(s,null,0);
  return{ex};}

function stageLights(s,k,amt){magicAt(s,k,amt??(k?.35:0));BULBS.forEach((b,i)=>{const on=(Math.floor(s/150)+i)%3===0;b.material.uniforms.uEmis.value.setRGB(...(on?(k?GLOW[k].map(v=>v*.9):[1,.85,.6]):[0,0,0]));});
  FLAGS.forEach(({f,ph})=>{f.rotation.x=Math.sin(s*.0021+ph)*.22;});
  LIGHTS.forEach((b,i)=>{const on=k?((Math.floor(s/120)+i)%2===0):((Math.floor(s/600)+i)%3!==0);b.material.uniforms.uEmis.value.setRGB(...(on?(k?GLOW[k].map(v=>v*.8):[.9,.7,.45]):[0,0,0]));});
  BGC.forEach((g,i)=>{const u=g.userData;g.position.y=u.y+Math.sin(s*.0006*u.sp+u.ph)*.45;g.rotation.set(u.rx+s*.00012*u.sp,s*.0002*u.sp+u.ph,u.rz);});
  GEO.forEach(g=>{g.rotation.z=g.userData.ph+s*g.userData.sp;});starMat.uniforms.uTime.value=s;}

// ---------- 十連 v8（D 11/07）：十顆扭蛋輪流從鏡頭兩邊滾過去、最後一顆把鏡頭吞掉 → 酒館大門前一顆一顆滾進來疊成小金字塔 → 大門砰地打開 → 白光 →
//            小屋裡（牆角入鏡、兩面牆都看得到）：十件家具一件件掉進房間擺好 ----------
function gridCells(){const cw=Math.min(124,Math.floor((W-24)/5)),gw=cw-20,gh=Math.round(gw*1.08/2)*2;return{cw,gw,gh,cells:[...Array(10)].map((_,i)=>({x:Math.round(W/2+((i%5)-2)*cw),y:Math.round(H*(i<5?.43:.7))}))};}
const TPAD=[];   // （舊版地上光圈，已不用）
const CLU=[...Array(10)].map((_,i)=>{const r=i<5?0:1,c=i%5;return V3((c-2)*.5+(r?.25:0),.27,T_ZS+r*.6);});   // 擠在門口的位置（兩排）
const TEN_X=[...Array(10)].map((_,i)=>((i*7)%10-4.5)*.3);   // 舞台上往鏡頭滾的時候左右散開
const isoH=(i,j)=>[(i-j)*16,(i+j)*8];   // 小屋頁的斜角座標（1 倍）
// 十件家具在小屋房間裡的擺法（D 11/07：掛牆的不能跑到看不到的地方、不放小人）：
// 牆角（地板最後面那一點）放在畫面上方中間 → 左右兩面牆都入鏡；掛牆的左右牆輪流掛、避開左上標題跟右上金幣；
// 地上的排三排（中 5、前 4、後 1，前排讓開下面的按鈕），高的放後面
function uiRect(sel){const e=ui.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect(),o=stageEl.getBoundingClientRect();return[(r.left-o.left)/S-3,(r.top-o.top)/S-3,(r.right-o.left)/S+3,(r.bottom-o.top)/S+3];}
const hitR=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
const TBX={};
function tightOf(k,RI){if(TBX[k])return TBX[k];const im=IMG['raw_'+k];let t=[0,0,RI.w,RI.h];
  if(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,im.width,im.height).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;
    for(let y=0;y<im.height;y++)for(let xx=0;xx<im.width;xx++)if(d[(y*im.width+xx)*4+3]>24){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1>=0){const sx=RI.w/im.width,sy=RI.h/im.height;t=[x0*sx,y0*sy,(x1+1)*sx,(y1+1)*sy];}}
  return TBX[k]=t;}
function tenRoom(P){const res=P.res,cnt={};res.forEach(it=>{const s=ROOMD?.items[it.k]?.set;if(s)cnt[s]=(cnt[s]||0)+1;});const mx=Math.max(...Object.values(cnt)),set=cnt[ROOMD?.items[P.best.k]?.set]===mx?ROOMD.items[P.best.k].set:Object.keys(cnt).find(k=>cnt[k]===mx);   // 房間：抽到最多件的系列；一樣多就看最稀有那件
  if(!set||!ROOMI[set]||res.some(it=>!ROOMD.items[it.k]))return null;const S0=ROOMD.sets[set],N=22;
  const cap=(hx,hy)=>[hx-S0.cx+S0.w/2,hy-S0.cy+S0.h/2],cx=Math.round(W/2),cy=Math.round(H*.3),c0=cap(0,0),ox=cx-Math.round(c0[0]),oy=cy-Math.round(c0[1]);
  const scr=(hx,hy)=>{const c=cap(hx,hy);return[ox+c[0],oy+c[1]];};
  // 掛牆：room.json 的錨點是「左牆第 8 格」；右牆＝左右鏡射（原圖也左右翻，跟小屋頁一樣）
  const wallRect=(RI,sd,c)=>{const L=sd==='L',a=L?[RI.A[0]-(c-8)*16,RI.A[1]+(c-8)*8]:[-RI.A[0]+(c-8)*16,RI.A[1]+(c-8)*8],q=scr(...a);
    const left=Math.round(q[0]-(L?RI.ax:RI.w-RI.ax)),top=Math.round(q[1]-RI.ay);return{left,top,w:RI.w,h:RI.h,wall:true,flip:!L,box:[left,top,left+RI.w,top+RI.h]};};
  // D 11/08「有些家具會蓋過對方」：每件都用原圖的實際外形（去掉透明邊）＋名牌一起算，跟已經擺好的、介面都不能疊到才放。
  // 名牌先放家具正下方，下面放不下就放上面。地上的家具試好幾種擺法（排序×挑位置的方式×間距），挑「疊到最少」的那一種。
  const UI=[uiRect('.head'),uiRect('.wallet'),[W/2-72,H-44,W/2+72,H+9]].filter(Boolean),out=new Array(res.length),taken=[];let nw=0;
  const tb=(k,RI,left,top,flip)=>{const t=tightOf(k,RI);return flip?[left+RI.w-t[2],top+t[1],left+RI.w-t[0],top+t[3]]:[left+t[0],top+t[1],left+t[2],top+t[3]];};
  const labs=(it,bx)=>{const w=Math.round([...it.name].length*5.8+12+(it.r==='common'?0:17)+(it.nw?17:0)),x=(bx[0]+bx[2])/2;return[{b:[x-w/2,bx[3]+1,x+w/2,bx[3]+12],p:[x,bx[3]]},{b:[x-w/2,bx[1]-13,x+w/2,bx[1]-2],p:[x,bx[1]-15]}];};
  const inScr=bx=>bx[0]>=2&&bx[2]<=W-2&&bx[1]>=2&&bx[3]<=H-2&&!UI.some(u=>hitR(bx,u));
  const hitT=(T,bx,m)=>T.some(t=>hitR(bx,[t[0]-m,t[1]-m,t[2]+m,t[3]+m]));
  const ar=(a,t)=>Math.max(0,Math.min(a[2],t[2])-Math.max(a[0],t[0]))*Math.max(0,Math.min(a[3],t[3])-Math.max(a[1],t[1]));
  // 疊到的嚴重程度：家具疊家具最重、牽涉名牌的輕一點、出畫面／壓到按鈕最重
  const pen=(T,bx,L)=>T.reduce((a,t)=>a+ar(bx,t)*(t[4]?50:10)+ar(L.b,t)*(t[4]?10:5),0)+(inScr(bx)?0:1e9)+(inScr(L.b)?0:2e4);
  const fits=(T,bx,it,m,ml)=>{if(!inScr(bx)||hitT(T,bx,m))return null;for(const L of labs(it,bx))if(inScr(L.b)&&!hitT(T,L.b,ml))return L;return null;};
  res.forEach((it,i)=>{const RI=ROOMD.items[it.k];if(RI.kind!=='wall')return;const wt=Math.max(1,Math.ceil(RI.w/16));let best=null,fb=null,fs=1e18;
    for(const sd of nw%2?['R','L']:['L','R']){for(let c=1;c<=N-1-wt&&!best;c++){const r=wallRect(RI,sd,c),bx=tb(it.k,RI,r.left,r.top,r.flip),L=fits(taken,bx,it,3,2);
        if(L)best={r,bx,L};else if(!best){const L0=labs(it,bx)[0],sc=pen(taken,bx,L0);if(sc<fs){fs=sc;fb={r,bx,L:L0};}}}if(best)break;}
    const pk=best||fb;taken.push([...pk.bx,1],[...pk.L.b,0]);nw++;out[i]={...pk.r,bx:pk.bx,lab:pk.L.p,ok:!!best};});
  // 地上：三排的目標位置（照畫面比例）；xm＝這一排左右最遠能放到哪
  const yb=H-48,yt=Math.min(yb-40,cy+62),ym=Math.round((yt+yb)/2),xm=y=>Math.max(24,Math.min(W/2-30,2*(y-cy)-44));
  const SL=[[ym,0,0],[ym,-.5,1],[ym,.5,1],[yb,-.52,2],[yb,.52,2],[ym,-1,3],[ym,1,3],[yb,-.97,4],[yb,.97,4],[yt,0,5]];   // 最後面中間那格最後才用（會擋到牆角的掛牆家具）
  const fl=res.map((it,i)=>i).filter(i=>ROOMD.items[res[i].k].kind!=='wall');
  const use=SL.map((v,i)=>[...v,i]).sort((a,b)=>a[2]-b[2]||a[3]-b[3]).slice(0,fl.length).sort((a,b)=>a[0]-b[0]||a[3]-b[3]);   // 選好的位置：後面的排在前
  const C={};for(const i of fl){const it=res[i],RI=ROOMD.items[it.k];C[i]=[];   // 每件家具在整片地板上所有能放的格子
    for(let di=1-8;di<=N-2-(RI.di||0)-8;di++)for(let dj=1-8;dj<=N-2-(RI.dj||0)-8;dj++){const q=scr(RI.A[0]+(di-dj)*16,RI.A[1]+(di+dj)*8),left=Math.round(q[0]-RI.ax),top=Math.round(q[1]-RI.ay);C[i].push({left,top,bx:tb(it.k,RI,left,top,false)});}}
  const byH=[...fl].sort((a,b)=>ROOMD.items[res[b].k].h-ROOMD.items[res[a].k].h);   // 高的先放、放後面
  const area=i=>{const t=tightOf(res[i].k,ROOMD.items[res[i].k]);return(t[2]-t[0])*(t[3]-t[1]);},byA=[...fl].sort((a,b)=>area(b)-area(a));   // 佔最多畫面的先放
  function attempt(ord,mode,m,ml){const T=taken.map(t=>t.slice()),o={};let bad=0,tot=0;
    ord.forEach((i,n)=>{const it=res[i],RI=ROOMD.items[it.k],[sy,f]=use[n],sx=cx+f*xm(sy);let best=null,bs=1e18,fb=null,fs=1e18;
      for(const c of C[i]){const mx=(c.bx[0]+c.bx[2])/2,d=mode?c.bx[3]+Math.abs(mx-cx)*.18:Math.hypot(mx-sx,(c.bx[3]-sy)*1.3);   // 0＝靠近目標位置；1＝從後面中間往外塞
        if(d>=bs)continue;const L=fits(T,c.bx,it,m,ml);if(L){bs=d;best={c,L};}else if(!best){const L0=labs(it,c.bx)[0],sc=pen(T,c.bx,L0)*20+d;if(sc<fs){fs=sc;fb={c,L:L0};}}}
      const pk=best||fb;if(!best){bad++;tot+=pen(T,pk.c.bx,pk.L);}T.push([...pk.c.bx,1],[...pk.L.b,0]);
      o[i]={left:pk.c.left,top:pk.c.top,w:RI.w,h:RI.h,wall:false,flip:false,bx:pk.c.bx,lab:pk.L.p,ok:!!best};});
    return{o,bad,tot};}
  let win=null;
  for(const [ord,mode,m,ml] of[[byH,0,3,2],[byA,0,3,2],[byH,1,3,2],[byA,1,3,2],[byH,0,1,1],[byA,0,1,1],[byH,1,1,1],[byA,1,1,1]]){const r=attempt(ord,mode,m,ml);
    if(!win||r.bad<win.bad||(r.bad===win.bad&&r.tot<win.tot))win=r;if(!win.bad)break;}
  for(const i of fl)out[i]=win.o[i];
  return{img:ROOMI[set],S0,ox,oy,items:out};}
function drawRoomTen(P,s){const R=P.room;if(!R)return;if(roomC.width!==W||roomC.height!==H){roomC.width=W;roomC.height=H;roomTex?.dispose();roomTex=null;}
  if(!roomTex){roomTex=new THREE.CanvasTexture(roomC);roomTex.magFilter=roomTex.minFilter=THREE.NearestFilter;roomTex.generateMipmaps=false;FINAL.uniforms.tR.value=roomTex;}
  const x=rctx;x.imageSmoothingEnabled=false;x.fillStyle='#4b2f6c';x.fillRect(0,0,W,H);x.drawImage(R.img,R.ox,R.oy);roomTex.needsUpdate=true;}
function planTen(res,seed,Fs){const r=rng(seed);PA.clear();PN.clear();const best=res.reduce((a,b)=>RANK[b.r]>RANK[a.r]?b:a,res[0]);const P={n:10,res,best,st:RANK[best.r],seed,Fs};
  Object.assign(P,{COIN:820,T0:900,T1:2300,TEASE:1850,SHOOT:2380,GAP:150});
  P.shoot=res.map((_,i)=>P.SHOOT+i*P.GAP);P.b1=P.shoot.map(t=>t+230);P.ENG=P.b1[9]+560;P.EZ=engZ();P.ZX=P.EZ+1.1;
  // 舞台：前九顆輪流往鏡頭左右兩邊滾過去（出畫，不會撞進鏡頭）；最後一顆直直滾過來把鏡頭吞掉
  P.ex=res.map((_,i)=>({sd:i%2?1:-1,dur:620+hash(i+5)*160,xe:1.5+hash(i+11)*.5}));
  // 酒館：一顆一顆從鏡頭兩旁滾進來（大大的 → 越滾越小），在大門前疊成 4-3-2-1 的小金字塔（第一顆＝吞掉鏡頭的那顆）
  const ord=[9,0,1,2,3,4,5,6,7,8],SLOT=[[0,1],[0,2],[0,0],[0,3],[1,1],[1,0],[1,2],[2,0],[2,1],[3,0]];P.tv=[];
  ord.forEach((ci,n)=>{const[row,col]=SLOT[n],x=(col-(3-row)/2)*.56,slot=V3(x,.27+row*.462,T_ZS),hop=row>0,g=hop?V3(x,.27,T_ZS+.6):slot.clone();
    const e=n===0?P.ENG:P.ENG+380+(n-1)*150,sd=x<-.01?-1:(x>.01?1:(n%2?1:-1)),s0=n===0?V3(0,.27,T_Z0-.3):V3(sd*1.05,.27,2.75);
    const a0=e+(n===0?1050:950),a1=a0+(hop?300:0),d=V3().subVectors(g,s0).setY(0),len=d.length();d.normalize();const tot=(len+(hop?.6:0))/.27,kr=Math.max(1,Math.round(tot/(Math.PI*2)))*Math.PI*2/tot;   // 滾到定位剛好轉整圈 → 有顏色的上半顆朝上
    P.tv[ci]={n,row,e,a0,a1,s0,g,slot,hop,len,kr,ax:V3(d.z,0,-d.x)};});
  P.ARR=Math.max(...P.tv.map(t=>t.a1));P.H0=P.ARR+260;P.OPEN=P.H0+(P.st?1000:700);P.RC=P.OPEN+620;P.IN=P.RC;P.LANDED=P.RC;
  const G=gridCells();P.G=G;P.room=tenRoom(P);
  // 小屋那一鏡的固定鏡頭：家具的「原點」在畫面上的位置往地面打光線＝家具站的位置（1 倍）
  const wpp=VIS/H,FIN=[0,0,0,0,30,VIS,FOV_F,0];P.FIN=FIN;P.unit=PPU*wpp;P.sc10=1;
  applyCamH([0,...FIN],0,0,0);cam.updateMatrixWorld();const ray=new THREE.Raycaster(),pl=new THREE.Plane(V3(0,1,0),0);
  const rect=P.room?P.room.items:G.cells.map((c,i)=>({left:c.x-Math.round(Fs[i].w/2),top:c.y-80}));
  P.rect=res.map((it,i)=>[rect[i].left,rect[i].top]);
  P.flip=res.map((it,i)=>!!rect[i].flip);
  P.foot=res.map((it,i)=>{const F=Fs[i],[fx,fy]=FIT[it.k]||[0,0],w=rect[i].w||IMG['raw_'+it.k].width,h=rect[i].h||IMG['raw_'+it.k].height;
    const sx=P.flip[i]?rect[i].left+w+fx+F.x0*PPU:rect[i].left-fx-F.x0*PPU,sy=rect[i].top+h+F.u0*PPU-fy;ray.setFromCamera(new THREE.Vector2(sx/W*2-1,-(sy/H*2-1)),cam);const p=V3();ray.ray.intersectPlane(pl,p);return p;});
  P.land=P.foot.map(f=>f.clone().setY(.27));
  P.anchor=res.map((it,i)=>{if(rect[i].lab)return[Math.round(rect[i].lab[0]),Math.round(rect[i].lab[1])];const im=IMG['raw_'+it.k];return[rect[i].left+Math.round((im?im.width:60)/2),rect[i].top+(im?im.height:60)];});
  // 小屋裡一件件掉下來（限定：金光閃一下、LIMITED 大字、先剪影再揭曉）
  let t=P.RC+380;P.op=[];P.fx=[];
  res.forEach((it,i)=>{const lim=it.r==='limited',rare=it.r==='rare';const pop=t,land=pop+(lim?560:400),rev=lim?land+260:land,settle=land+(lim?380:280);
    P.op.push({t:pop,lim,show:land,a:pop,up:pop,c1:pop,c2:pop});P.fx.push({pop,land,rev,settle,hand:Math.max(rev,settle)+120});t+=lim?900:(rare?360:200);});
  P.DONE=Math.max(...P.fx.map(f=>f.hand))+700;P.holds=[];
  // 鏡頭：舞台 → 酒館（貼地）→ 小屋（固定）
  const K=[[0,...CAM_IDLE.slice(1)],[P.COIN,0,1.55,.6,0,4,6.4,30,0,'inout'],[P.T0+200,0,1.22,.9,0,-7,4.1,30,0,'out'],[P.TEASE,0,1.28,.9,0,-6,3.8,30,0,'lin']];   // 全部正面（az 0）：只推近、俯仰，不繞著機台轉
  if(P.st)K.push([P.T1-60,0,2.05,.6,0,-15,4.8,32,0,'inout']);else K.push([P.T1-60,0,1.25,.9,0,-5,3.5,30,0,'lin']);
  K.push([P.SHOOT+60,...CAMF,'out']);P.cam=K;
  const D0=-TZD;P.camI=[[P.ENG,0,.4,T_Z0-.22,0,3,.5,42,0],[P.ENG+650,0,2.9,D0-.9,18,12,8.2,44,0,'out'],[P.ARR,0,1.8,D0-.2,9,-1,5.3,42,0,'inout'],[P.H0+220,0,1.2,D0,-5,-6,3.6,40,0,'inout'],
    [P.OPEN-60,0,.9,D0,-2,-7,2.6,38,2,'in'],[P.OPEN+40,0,.9,D0,-2,-7,2.55,38,2,'lin'],[P.RC,0,1.3,D0+.6,0,-4,3.0,48,0,'in']];P.camR=[[P.RC,...FIN]];
  P.shk=[[P.COIN,.03,120],[P.SHOOT,.05,160],[P.ARR,.06,160],[P.OPEN,P.st?.15:.08,320]];P.pun=[[P.ENG-120,.06,120],[P.OPEN,.05,160]];
  P.fl=[[P.OPEN+60,'#fff1e3',.14,200],[P.RC-90,'#ffffff',.5,90],[P.RC,'#ffffff',.9,240]];P.imp=[];
  P.snd=[[P.ENG-140,sfx.whoosh],[P.ARR,()=>{tone(150,.1,'sine',.14);tone(150,.1,'sine',.12,.16);}],[P.OPEN,()=>{sfx.burst(P.best.r==='limited'?'rare':P.best.r);noise(.4,.12,300,2600);}],[P.RC,()=>{sfx.whoosh();tone(880,.2,'triangle',.05,0,1320);}]];
  for(let i=0;i<16;i++){const tt=P.T0+(i+.6)*(P.T1-P.T0)/16;P.shk.push([tt,.016,60]);P.snd.push([tt,sfx.click]);}
  for(let i=0;i<10;i++)P.snd.push([P.COIN*.07*i+P.COIN*.37*COIN_IN,sfx.coin]);P.snd.push([P.COIN,()=>meow(1.1)]);if(P.st)P.snd.push([P.TEASE,()=>meow(1.35,0,.07)]);
  res.forEach((_,i)=>{P.snd.push([P.shoot[i],sfx.pop],[P.b1[i],()=>tone(170,.05,'triangle',.05)]);});
  for(let tt=P.b1[0]+90,i=0;tt<P.ENG-60;tt+=Math.max(60,130-i*4),i++)P.snd.push([tt,()=>tone(190+(i%9)*12,.04,'triangle',.03)]);
  P.ex.forEach((x,i)=>{if(i<9)P.snd.push([P.b1[i]+x.dur*.75,()=>noise(.14,.03,2600,700)]);});
  P.tv.forEach(T=>{P.snd.push([T.a1,()=>{tone(330*Math.pow(1.122,T.n),.08,'triangle',.07);tone(165,.05,'sine',.06);}]);if(T.n)P.snd.push([T.e+260,()=>noise(.18,.025,1800,500)]);});
  res.forEach((it,i)=>{const f=P.fx[i],o=P.op[i];P.snd.push([f.pop,()=>sfx.mini(it.r)],[f.land,()=>tone(150,.08,'sine',.1)]);
    if(o.lim){P.shk.push([f.land,.1,260]);P.fl.push([f.land,'#ffd27a',.3,150]);P.snd.push([f.land,()=>{sfx.burst('limited');setTimeout(()=>meow(1.15,0,.08),300);}]);}
    else if(it.r==='rare'){P.shk.push([f.land,.05,140]);P.fl.push([f.land,'#e2d4ff',.18,110]);}});
  {const k=P.best.r==='limited'?'rare':P.best.r,dc=[0,TDSP*.8,-TZD+.3];if(P.st)converge(r,dc,P.H0,600,40,k);sparks(r,dc,P.OPEN,90,k,{sp:[3,9],life:[400,1000],size:[1,3]});stars(r,dc,P.OPEN,14,k,{size:[5,9]});confetti(r,[0,1.6,T_ZS],P.OPEN+40,90,k);
    P.tv.forEach(T=>dust(r,[T.g.x,.08,T.g.z],T.a0,T.hop?2:4));}
  PA.commit();PN.commit();
  TENF.forEach(o=>o.dispose());TENF=Fs.map(F=>furn3D(F));
  P.sprs=res.map((it,i)=>{const im=IMG['raw_'+it.k]||IMG['f_'+it.k],c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.imageSmoothingEnabled=false;if(P.flip[i]){x.translate(im.width,0);x.scale(-1,1);}x.drawImage(im,0,0);return c;});
  // 疊的順序：越下面（越前面）越晚畫
  P.order=res.map((_,i)=>i).sort((a,b)=>(P.rect[a][1]+P.sprs[a].height)-(P.rect[b][1]+P.sprs[b].height));
  P.tmp=document.createElement('canvas');
  return P;}
function updTen(s,e){const P=plan,st=P.st,tav=s>=P.ENG&&s<P.RC,room=s>=P.RC;
  stageBg(!tav&&!room);tavShow(tav);P.roomOn=room&&!!P.room;TPAD.forEach(m=>m.visible=false);
  if(room)applyCamH(camAt(P.camR,s),sumEv(P.shk,s),0,e);else if(tav)applyCamH(camAt(P.camI,s),sumEv(P.shk,s),sumEv(P.pun,s),e);else applyCam(camAt(P.cam,s),sumEv(P.shk,s),sumEv(P.pun,s),e);
  let ex='open',sq=0,kn=0;const blink=(s%3700)<120;
  if(s<P.COIN)ex=blink?'blink':'open';else if(s<P.T0)ex='happy';else if(s<P.T1)ex=st&&s>P.TEASE?'star':'squint';else ex='happy';
  sq+=.05*decay(s,P.COIN,140);for(let i=0;i<10;i++)sq+=.05*decay(s,P.shoot[i],90);
  if(s>=P.T0){const n=16,f=Math.min(1,(s-P.T0)/(P.T1-P.T0))*n;kn=(Math.floor(Math.min(f,n-.001))+EZ.out(Math.min(1,(f%1)*1.6)))*Math.PI/2;if(s>=P.T1)kn=n*Math.PI/2;for(let i=0;i<n;i++)sq+=.03*decay(s,P.T0+(i+.6)*(P.T1-P.T0)/n,80);}
  stg.scale.setScalar(1);stg.position.z=0;mach.position.set(0,0,0);mach.rotation.y=0;body.scale.set(1+sq,1-sq*1.4,1+sq);knob.rotation.z=-kn;drawFace(ex);
  flap.rotation.x=s>P.SHOOT-40&&s<P.shoot[9]+300?-1.0+.15*Math.sin(s/40):(s>=P.shoot[9]+300?-1.0*Math.exp(-(s-P.shoot[9]-300)/250):0);
  let amp=0;for(let i=0;i<16;i++)amp+=decay(s,P.T0+(i+.6)*(P.T1-P.T0)/16,220);amp=Math.min(1.4,amp);
  for(const m of MINI){m.g.position.set(m.base.x+Math.sin(s*.021+m.ph)*.07*amp,m.base.y+Math.abs(Math.sin(s*.027+m.ph*1.3))*.2*amp,m.base.z+Math.sin(s*.017+m.ph*2.1)*.06*amp);m.g.rotation.set(m.rot.x+Math.sin(s*.01+m.ph)*amp,m.rot.y+s*.002*amp,m.rot.z);}
  const bk=P.best.r==='limited'?'rare':P.best.r;   // 預告只透露到「稀有」，限定留給最後
  const tg=st?sat((s-P.TEASE)/360)*(s<P.SHOOT?1:decay(s,P.SHOOT,240)):0;domeMat.uniforms.uGlow.value=tg*.5;domeMat.uniforms.uGlowC.value.setRGB(...GLOW[bk]);
  domeGlow.visible=domeRays.visible=tg>0&&s<P.ENG;if(domeGlow.visible){domeGlow.position.set(0,2.8,0);domeGlow.scale.setScalar(3.2);setC(domeGlow.material.uniforms,GLOW[bk],tg*.45);domeGlow.material.uniforms.uI.value=1;
    domeRays.position.set(0,2.8,0);domeRays.scale.setScalar(7.5);setC(domeRays.material.uniforms,GLOW[bk]);domeRays.material.uniforms.uI.value=tg*.55;domeRays.material.uniforms.uRot.value=s*.0012;}
  bubble.visible=!!st&&s>P.TEASE&&s<P.SHOOT;if(bubble.visible){bubble.position.set(1.35,3.35,.5);bubble.scale.setScalar(EZ.back(seg(s,P.TEASE,P.TEASE+140)));bubble.quaternion.copy(cam.quaternion);}
  coin.visible=false;{let gl=0;COINS.forEach((c,i)=>{const t0=P.COIN*.07*i,u=(s-t0)/(P.COIN*.37);c.visible=u>=0&&u<COIN_IN;if(c.visible){const a=coinAt(u);c.position.copy(a.p);c.quaternion.copy(a.q);}gl+=decay(s,t0+P.COIN*.37*COIN_IN,200);});
    slotMat.uniforms.uEmis.value.setRGB(1,.75,.35).multiplyScalar(.9*Math.min(1,gl));}
  HERO.g.visible=false;SHARDS.forEach(m=>m.visible=false);[fxRays,fxRays2,fxGlow,fxCrack,fxBG,fxBG2].forEach(m=>m.visible=false);pillar.visible=false;CARD.g.visible=false;fShadow.visible=false;if(FURN)FURN.g.visible=false;fxRings.forEach(m=>m.visible=false);tenRays.forEach(m=>m.visible=false);
  // 酒館大門
  const DP={ARR:P.ARR,OPEN:P.OPEN,CR1:P.OPEN-420,CR2:P.OPEN-200,stages:[],UPG:0},da=tavDoor(DP,s),G=GLOW[bk],warm=[1,.88,.7],lc=s>=P.H0?G:warm;
  if(tav){const leak=s<P.ARR?0:.4+(s>=P.OPEN-420?.4:0)+.15*Math.sin(s/60);tavLights(s,da,leak,lc,s>=P.H0?.6:.35,s>=P.H0?G:warm,.7+.1*Math.sin(s/90));}
  const dcw=TDOOR_C.clone().add(V3(0,0,.2));tRays.visible=tGlow.visible=tav&&(da>.05||s>=P.OPEN-420);if(tRays.visible){const op=s>=P.OPEN,ou=seg(s,P.OPEN,P.OPEN+300);
    tRays.position.copy(dcw);tRays.scale.setScalar(op?lerp(3,14,EZ.out5(ou)):3.4);setC(tRays.material.uniforms,lc);tRays.material.uniforms.uI.value=op?.45*decay(s,P.OPEN,400)+.1:.15;tRays.material.uniforms.uRot.value=s*.0011;
    tGlow.position.copy(dcw);tGlow.scale.setScalar(op?lerp(2,6,EZ.out(ou)):2.2);setC(tGlow.material.uniforms,lc);tGlow.material.uniforms.uI.value=op?.45*decay(s,P.OPEN,260):.15;}
  tBeam.visible=tav&&da>.1;if(tBeam.visible){tBeam.material.uniforms.uI.value=Math.min(1,da/1.2)*(.5*decay(s,P.OPEN,500)+.18);tBeam.material.uniforms.uC.value.setRGB(...lc);}
  GU.uPLp.value.copy(dcw).add(V3(0,0,1.1));GU.uPLi.value=tav?(s<P.ARR?.2:.5)+(s>=P.OPEN?1.0*decay(s,P.OPEN,700):0):0;GU.uPLc.value.setRGB(lc[0]*.5,lc[1]*.5,lc[2]*.5);
  FINAL.uniforms.uBgDim.value=tav&&s>=P.ARR&&s<P.OPEN?sat((s-P.ARR)/400)*.3:0;GU.uDim.value=0;
  // 扭蛋：舞台＝輪流從鏡頭旁滾過去、最後一顆吞掉鏡頭；酒館＝一顆一顆滾進來疊金字塔；大門打開時從上面開始一起爆開
  for(let i=0;i<10;i++){const c=TENC[i];let vis=false,p=V3(),scx=1,scy=1,kind=P.res[i].r,glow=0;c.g.quaternion.identity();c.top.position.set(0,0,0);c.bot.position.set(0,0,0);c.top.rotation.set(0,0,0);c.bot.rotation.set(0,0,0);
    if(s<P.ENG){const ex=P.ex[i],a=V3(ex.sd*.3,.27,STAGE_Z0);
      if(s>=P.shoot[i]&&s<P.b1[i]){vis=true;const u=seg(s,P.shoot[i],P.b1[i]);p.lerpVectors(CAP0,a,u);p.y+=Math.sin(u*Math.PI)*.45;c.g.rotation.set(u*Math.PI*2,0,0);}
      else if(s>=P.b1[i]){const l=decay(s,P.b1[i],70);scx=1+.22*l;scy=1-.26*l;
        if(i===9){vis=true;const u=EZ.in2(seg(s,P.b1[9],P.ENG)),z=STAGE_Z0+(P.EZ-.15-STAGE_Z0)*u;p.set(lerp(a.x,0,u),.27,z);c.g.quaternion.setFromAxisAngle(V3(1,0,0),(z-STAGE_Z0)/.27);}
        else{const u=seg(s,P.b1[i],P.b1[i]+ex.dur);vis=u<1;const k=EZ.in2(u),b=V3(ex.sd*ex.xe,.27,P.ZX),d=V3().subVectors(b,a),L=d.length();d.normalize();p.lerpVectors(a,b,k);c.g.quaternion.setFromAxisAngle(V3(d.z,0,-d.x),L*k/.27);}}}
    else if(tav&&s<P.OPEN+900){const T=P.tv[i];if(s>=T.e){vis=true;const u=EZ.out(seg(s,T.e,T.a0));p.lerpVectors(T.s0,T.g,u);let ang=T.len*u/.27;
        if(T.hop&&s>=T.a0){const h=seg(s,T.a0,T.a1);p.lerpVectors(T.g,T.slot,EZ.inout(h));p.y+=.28*Math.sin(Math.PI*h);ang+=.6*EZ.inout(h)/.27;}
        c.g.quaternion.setFromAxisAngle(T.ax,ang*T.kr);const l=decay(s,T.a1,90);scx=1+.14*l;scy=1-.18*l;
        if(s>=P.H0&&kind!=='common'){glow=.2+.15*Math.sin(s/90+i);}
        if(s>=P.OPEN){const t=(s-P.OPEN-(9-T.n)*25)/1000;if(t>0){c.seam(GLOW[kind]?kind:'common',0);const sd=T.slot.x<0?-1:1;c.top.position.set(sd*1.0*t,3.6*t-6.5*t*t,.6*t);c.top.rotation.set(t*7,0,sd*t*9);c.bot.position.set(-sd*.8*t,1.1*t-6.5*t*t,.5*t);c.bot.rotation.set(-t*4,0,-sd*t*6);}}}}
    const kg=GLOW[kind]?kind:'common';c.setKind(kind);c.g.visible=vis;if(!vis)continue;c.g.position.copy(p);c.g.scale.set(scx,scy,scx);c.glow(kg,glow);c.crack(kg,0,0);}
  // 小屋：家具一件件從上面掉下來、轉停在斜角，再換成原圖
  if(room)drawRoomTen(P,s);
  TENF.forEach((F,i)=>{const f=P.fx[i],o=P.op[i],ft=P.foot[i];F.g.visible=room&&s>=f.pop&&s<f.hand+150;if(!F.g.visible)return;
    const u=seg(s,f.pop,f.land),it=P.res[i],fh=P.Fs[i],hW=(fh.u1-fh.u0)*P.unit;let sx=1,sy=1;
    const py=s<f.land?lerp(hW*1.6+1,0,EZ.in2(u)):0;if(s>=f.land){const q=seg(s,f.land,f.land+220);const w=q<1?Math.sin(q*Math.PI*2)*(1-q)*.2:0;sy=1-w;sx=1+w*.7;}
    F.g.position.set(ft.x,py,ft.z);F.g.rotation.set(0,Math.PI*2*(o.lim?2:1)*(1-EZ.out(seg(s,f.pop,f.settle))),0);F.g.scale.set(P.unit*sx*(P.flip[i]?-1:1),P.unit*sy,P.unit*sx);
    const U=F.U;U.uRev.value=o.lim?sat((s-f.rev)/170)*1.02:1;U.uRim.value=o.lim?1:0;U.uRimC.value.setRGB(1,.86,.5);U.uWhite.value=Math.max(.8*decay(s,f.rev,90)*(o.lim?1:0),.5*decay(s,f.land,80));});
  GU.uPLi.value=room?0:GU.uPLi.value;bgMat.uniforms.uRev.value=floorMat.uniforms.uRev.value=0;
  stageLights(s,null,0);
  return{};}

// ---------- 待機 ----------
function updIdle(t){stg.scale.setScalar(1);stg.position.z=0;applyCam(CAM_IDLE,0,0,t);   // D 11/07：待機固定看著機台正面（3D 轉成像素一轉動就會閃，不要繞著轉）
  stageBg(true);tavShow(false);TPAD.forEach(m=>m.visible=false);FINAL.uniforms.uBgDim.value=0;COINS.forEach(c=>c.visible=false);
  mach.position.set(0,0,0);mach.rotation.y=0;const b=((t%2200)<1100?0:1)*1.6;body.scale.set(1+b*.012,1-b*.017,1+b*.012);   // 11/08 D「呼吸像老舊電視」：原本每格連續微縮放，轉像素後邊緣跟網點一直抖 → 改成像素動畫的兩格呼吸（正常／壓扁各停 1.1 秒）knob.rotation.z=0;flap.rotation.x=0;
  drawFace((t%3700)<120||((t+2400)%5300)<110?'blink':'open');
  for(const m of MINI){m.g.position.copy(m.base);m.g.rotation.copy(m.rot);}
  [HERO.g,fxRays,fxRays2,fxGlow,fxCrack,fxBG,fxBG2,domeGlow,domeRays,pillar,bubble,coin,CARD.g,fShadow,tRays,tGlow].forEach(m=>m.visible=false);if(FURN)FURN.g.visible=false;TENF.forEach(F=>F.g.visible=false);fxRings.forEach(m=>m.visible=false);TENC.forEach(c=>c.g.visible=false);tenRays.forEach(m=>m.visible=false);
  domeMat.uniforms.uGlow.value=0;GU.uDim.value=0;GU.uPLi.value=0;bgMat.uniforms.uRev.value=floorMat.uniforms.uRev.value=0;SHARDS.forEach(m=>m.visible=false);stageLights(t,null);
  stg.visible=true;}

// ---------- 酒館大門 v9（D 11/07「3D 酒館不夠好，不能分件做成真正的 3D 嗎」）：照 GPT 原畫 tavern/gpt1.png 一件件用 3D 蓋出來 ----------
// 牆（半木造：灰泥＋木框）、石砌牆腳、石拱門框、兩片木門、拱窗＋窗簾＋花箱、屋簷、壁燈、招牌、掛旗、酒桶花、圓錐樹、盆花、籬笆樹叢、兩旁的樹、藤蔓、石板路、晚霞天空。
// 跟扭蛋機同一套：卡通打光（toon）＋最後轉像素；轉像素時換成從原畫取的 64 色（tavern/tav_pal.json，mk_pal.py 產生）。網址加 ?paint 看回原畫版。
let MKH0=0,MKH1=0,MKV0=0,MKV1=0,TAV_TILE=null;   // 酒館小屋：房子本體、藤蔓在 TAV3.children 裡的範圍；屋瓦形狀
const TAV3_ON=!Q.has('paint'),TAV3=new THREE.Group();world.add(TAV3);TAV3.visible=false;
const PX=x=>(x-TI.cx)*TS,PY=y=>(TI.gy-y)*TS,WZ=-TZD;   // 原畫座標 → 世界座標（門面上）
const TM={plaster:toon('#f3c3b3','#e19087','#c4797c'),plaster2:toon('#fbe8c1','#f3c3b3','#db8b7a'),timber:toon('#7e4437','#5e2d2c','#481d1d'),
  stone:toon('#fbe8c1','#edc3b2','#d28381'),stone2:toon('#f3c3b3','#e19087','#c4797c'),stone3:toon('#edc3b2','#db8b7a','#b76d74'),
  door:toon('#ae544e','#964542','#763233'),doorD:toon('#763233','#5e2d2c','#481d1d'),iron:toon('#5e2d2c','#481d1d','#28090d'),
  roof:toon('#76404d','#5e2d2c','#481d1d'),roof2:toon('#a85f66','#8a4f5a','#76404d'),roofL:toon('#b76d74','#a85f66','#8a4f5a'),smoke:toon('#fffaf3','#f1b2c3','#cd84b4'),mortar:toon('#bd7a6d','#a85f66','#8a4f5a'),hillF:toon('#cd84b4','#b077b6','#8a4f5a'),hillN:toon('#a85f66','#8a4f5a','#76404d'),curtain:toon('#fbc1c1','#f1b2c3','#e07ba0'),
  flP:toon('#fbc1c1','#f89db2','#e07ba0'),flP2:toon('#f89db2','#e07ba0','#b76d74'),flV:toon('#cd84b4','#b077b6','#8a4f5a'),flW:toon('#fffaf3','#fbe8c1','#edc3b2'),
  leaf:toon('#a5794a','#8e6e41','#664733'),leafD:toon('#8e6d48','#795a3c','#654334'),trunk:toon('#8f6150','#77513c','#5e2d2c'),
  wood:toon('#c76857','#a24d4a','#873d3c'),pot:toon('#fbe8c1','#f3c3b3','#db8b7a'),band:toon('#8a4f5a','#76404d','#481d1d'),
  glass:toon('#fbe8c1','#f9bc8b','#e79a61',{noDim:true}),glassW:toon('#fbe8c1','#f9bc8b','#d87a5c',{noDim:true}),crystal:toon('#fbc1c1','#e07ba0','#b077b6',{spec:1})};
TM.glass.uniforms.uEmis.value.setRGB(.4,.28,.1);TM.glassW.uniforms.uEmis.value.setRGB(.22,.14,.06);
let BUILD=TAV3;   // 下面這些小工具把東西加到哪一組（酒館 TAV3／戶外舞台 STG3）
const T3=(geo,mat,p,r,s,outline=true)=>mk(geo,mat,BUILD,p,r,s,outline);
const shapeG=(pts,depth,z0,holes=[])=>{const sh=shapeOf(pts);for(const h of holes){const p=new THREE.Path();h.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();sh.holes.push(p);}
  const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:20});g.translate(0,0,z0);return g;};
// 長條（木樑、鐵條）：從 (x0,y0) 到 (x1,y1)，寬 w、厚 d，前面在 z
function tbm(x0,y0,x1,y1,w,d,z,mat,parent=BUILD,ol=true){const L=Math.hypot(x1-x0,y1-y0),m=mk(new THREE.BoxGeometry(L+w*.6,w,d),mat,parent,[(x0+x1)/2,(y0+y1)/2,z-d/2],[0,0,Math.atan2(y1-y0,x1-x0)],[1,1,1],ol);return m;}
const R3=rng(31);
// 小東西一大堆（花、葉子）用 InstancedMesh：pts＝[[x,y,z,s,rx,ry]]
function inst(geo,mat,pts,parent=BUILD){const m=new THREE.InstancedMesh(geo,mat,pts.length),o=new THREE.Object3D();pts.forEach((p,i)=>{o.position.set(p[0],p[1],p[2]);o.rotation.set(p[4]||0,p[5]||0,p[6]||0);o.scale.setScalar(p[3]||1);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.frustumCulled=false;parent.add(m);return m;}
const FLG=new THREE.IcosahedronGeometry(.045,0),LFG=new THREE.OctahedronGeometry(.04,0);LFG.scale(1,.32,1.8);   // 葉子要小、要多，大片多邊形看起來像積木
// 花團：中心 c、半徑 r、半球（上半）；cols＝[[材質,比例]]
function flowers(c,r,n,cols,flat=.75){const groups=cols.map(()=>[]);for(let i=0;i<n;i++){const u=R3(),v=R3()*.92,th=u*6.283,ph=Math.acos(1-v),rr=r*(.82+R3()*.22);
    const p=[c[0]+Math.sin(ph)*Math.cos(th)*rr,c[1]+Math.cos(ph)*rr*flat,c[2]+Math.sin(ph)*Math.sin(th)*rr,.8+R3()*.6,R3()*3,R3()*3];let a=R3(),k=0;for(;k<cols.length-1;k++){a-=cols[k][1];if(a<0)break;}groups[k].push(p);}
  cols.forEach(([m],k)=>groups[k].length&&inst(FLG,m,groups[k]));}
function leafy(c,r,n,flat=.6,mat=TM.leaf,ls=1){const pts=[];for(let i=0;i<n;i++){const th=R3()*6.283,ph=Math.acos(1-R3()*1.1);pts.push([c[0]+Math.sin(ph)*Math.cos(th)*r,c[1]+Math.cos(ph)*r*flat,c[2]+Math.sin(ph)*Math.sin(th)*r,(.8+R3()*.7)*ls,R3()*3,R3()*3]);}inst(LFG,mat,pts);}
// 大樹：粗樹幹＋樹根＋三根分枝，樹冠是七團密密的大葉子（底下的多面體只當襯底，不能露出大塊平面）
function bigTree(x,z,s,M=TM,y0=0){{const TM=M;T3(new THREE.CylinderGeometry(.17*s,.28*s,3.0*s,8),TM.trunk,[x,y0+1.5*s,z]);T3(new THREE.ConeGeometry(.42*s,.5*s,8),TM.trunk,[x,y0+.25*s,z],[0,0,0],[1,1,1],false);
  for(const [a,l,y] of[[.7,1.1,2.3],[-.8,1.0,2.6],[2.4,.9,2.9]])T3(new THREE.CylinderGeometry(.06*s,.1*s,l*s,6),TM.trunk,[x+Math.cos(a)*.35*s,y0+y*s,z+Math.sin(a)*.35*s],[Math.sin(a)*.7,0,-Math.cos(a)*.7],[1,1,1],false);
  for(const [dx,dy,dz,r] of[[0,3.9,0,1.15],[-.75,3.4,.2,.85],[.8,3.5,-.1,.9],[.1,3.2,.65,.8],[-.3,4.5,-.3,.8],[.55,4.3,.35,.75],[-.1,3.0,-.6,.75]]){const c=[x+dx*s,y0+dy*s,z+dz*s];
    T3(new THREE.IcosahedronGeometry(r*.8*s,2),TM.leafD,c,[R3(),R3(),0],[1,.88,1],false);leafy(c,r*s,Math.round(260*r*r*s*s),.88,R3()<.5?TM.leaf:TM.leafD,2.2);}}}
// 草叢：細細的三角錐，一叢叢
const GRS=new THREE.ConeGeometry(.035,.2,3);
function tufts(x0,x1,z0,z1,n){const A=[],B=[];for(let i=0;i<n;i++){const cx=x0+R3()*(x1-x0),cz=z0+R3()*(z1-z0);for(let j=0;j<5;j++)(j%2?A:B).push([cx+(R3()-.5)*.12,.07,cz+(R3()-.5)*.08,.8+R3()*.7,(R3()-.5)*.6,R3()*3,(R3()-.5)*.6]);}inst(GRS,TM.leaf,A);inst(GRS,TM.leafD,B);}
if(TAV3_ON){
  // 天空：依「看出去的仰角」分色帶（鏡頭怎麼動天空都像在無限遠）＋像素雲（上亮下暗兩階）＋快落下的夕陽；遠山兩層＋樹林剪影
  {const g=new THREE.PlaneGeometry(260,110);g.translate(0,30,0);const m=new THREE.Mesh(g,new THREE.ShaderMaterial({vertexShader:VOL_V,fragmentShader:`varying vec3 vW;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
    float cl(vec2 cp){return vn(cp*vec2(1.,2.6))*.6+vn(cp*vec2(2.3,5.2)+7.)*.4;}
    void main(){vec3 d=normalize(vW-cameraPosition);float el=degrees(asin(d.y)),az=degrees(atan(d.x,-d.z));
    vec3 c=el<1.5?vec3(.976,.737,.545):(el<4.?vec3(.961,.69,.553):(el<7.?vec3(.941,.627,.561):(el<11.?vec3(.878,.482,.627):(el<16.?vec3(.804,.518,.706):(el<23.?vec3(.69,.467,.714):vec3(.6,.4,.62))))));
    float sd=length(vec2((az+36.)*.9,el-5.));if(sd<3.4)c=vec3(.984,.91,.757);else if(sd<4.6)c=vec3(.976,.82,.62);
    vec2 cp=vec2(az*.055,el*.16);float band=smoothstep(5.,9.,el)*(1.-smoothstep(17.,25.,el));
    if(cl(cp)*band>.42)c=cl(cp-vec2(0.,.07))*band>.42?vec3(.984,.8,.78):vec3(.957,.655,.62);
    gl_FragColor=vec4(c,1.);}`}));
    m.position.set(0,0,-62);m.userData.noCast=1;TAV3.add(m);}
  for(let i=0;i<10;i++){const x=-40+i*9+R3()*3;T3(new THREE.SphereGeometry(1,24,8,0,6.283,0,Math.PI/2),TM.hillF,[x,-.2,-36-R3()*6],[0,R3()*3,0],[7+R3()*4,2.6+R3()*2.6,4],false).userData.noCast=1;}
  for(let i=0;i<7;i++){const x=-30+i*10+R3()*3;T3(new THREE.SphereGeometry(1,24,8,0,6.283,0,Math.PI/2),TM.hillN,[x,-.2,-24-R3()*4],[0,R3()*3,0],[6+R3()*3,1.4+R3()*1.2,3],false).userData.noCast=1;}
  for(let x=-30;x<30;x+=1.3+R3()*.7){if(Math.abs(x)<4)continue;const r=.9+R3()*.9,z=-13-R3()*5;T3(new THREE.IcosahedronGeometry(r,1),R3()<.5?TM.leafD:TM.hillN,[x,r*.85,z],[R3()*3,R3()*3,0],[1,1.15,1],false).userData.noCast=1;
    if(R3()<.4)T3(new THREE.ConeGeometry(r*.75,r*2.6,7),TM.leafD,[x+(R3()-.5),r*1.3,z-1],[0,R3()*3,0],[1,1,1],false).userData.noCast=1;}
  // 地面：門前廣場＋房子正面一條是石板（Voronoi 石塊＋灰縫），其他是草地；交界處石縫長草；遠處漸漸融進暮色
  {const g=new THREE.PlaneGeometry(100,80);g.rotateX(-Math.PI/2);g.translate(0,0,WZ-8);const m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uSM:GU.uSM,uSMM:GU.uSMM,uSMOn:GU.uSMOn},vertexShader:VOL_V,fragmentShader:`uniform float uDim;uniform vec3 uDimC;uniform sampler2D uSM;uniform mat4 uSMM;uniform float uSMOn;varying vec3 vW;
    vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
    void main(){vec2 p=vW.xz*vec2(2.1,2.7);vec2 i=floor(p),f=fract(p);float d1=9.,d2=9.;vec2 id=vec2(0.);
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),o=h2(i+g)*.75+.12,r=g+o-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=i+g;}else if(d<d2)d2=d;}
    float e=sqrt(d2)-sqrt(d1),k=h2(id).x;vec3 a=k<.33?vec3(.859,.545,.478):(k<.66?vec3(.824,.514,.506):vec3(.882,.565,.529));
    vec3 c=e<.07?vec3(.659,.373,.4):(e<.14?a*.9:a);
    vec2 P=vW.xz;float rz=P.y-(${WZ.toFixed(2)}),wob=(h2(floor(P*1.6)).x-.5)*.16;
    float pl=max(1.-length(vec2(P.x/8.4,(rz-3.)/5.6)),(abs(P.x)<5.7&&rz>-1.15&&rz<1.2)?.2:-1.)+wob;
    vec2 gq=floor(P*11.);float g1=h2(gq).x,g2=h2(floor(P*2.7)).y;vec3 gc=g2<.33?vec3(.557,.431,.255):(g2<.66?vec3(.639,.486,.282):vec3(.6,.46,.27));
    if(g1>.88)gc=vec3(.722,.569,.302);else if(g1<.09)gc=vec3(.475,.353,.235);
    if(pl<0.)c=gc;else if(pl<.1&&e<.13)c=gc;
    c=mix(c,vec3(.878,.58,.6),smoothstep(9.,34.,length(P-vec2(0.,${(WZ+2).toFixed(2)})))*.8);
    float lit=1.-smoothstep(1.,7.,length(vW.xz-vec2(0.,${(WZ+.5).toFixed(2)})));c=mix(c*.86,c*1.06,lit);
    if(uSMOn>.5){vec4 q=uSMM*vec4(vW,1.);vec3 sp=q.xyz*.5+.5;if(sp.x>0.&&sp.x<1.&&sp.y>0.&&sp.y<1.&&sp.z-.0015>texture2D(uSM,sp.xy).r)c*=vec3(.74,.66,.8);}
    c=mix(c,uDimC,uDim*.6);gl_FragColor=vec4(c,1.);}`}));
    m.userData.noCast=1;TAV3.add(m);}
  MKH0=TAV3.children.length;
  // ===== 小屋本體 v10b（D 11/08「你覺得這像小屋嗎」：原本只有一片薄牆，沒側牆、沒深度，屋頂只是一條邊，也沒影子）=====
  // 主屋有前後兩面山牆＋兩側牆（有深度）；兩側較矮的側翼往後退；厚屋頂鋪一片片瓦、封簷板、屋脊、簷下椽頭；山牆圓窗、煙囪；整棟會落影（tavShadow）
  const HW=3.35,EY=3.55,RY=5.75,DEP=4.4,OV=.62,OVF=.62,roofY=x=>RY-(RY-EY)*Math.abs(x)/HW;   // 主屋半寬、簷高、屋脊高、深度、側邊出簷、正面出簷
  const WIN={cx:PX(1330),y0:PY(470),ys:PY(335),a:.43,b:.29},AW={y:EY+.92,r:.34};   // 正面拱窗、山牆圓窗
  const winArch=(sd,pad=0,n=14)=>{const cx=sd*WIN.cx,a=WIN.a+pad,y0=WIN.y0-pad*.5,ys=WIN.ys,pts=[[cx-a,y0],[cx+a,y0],[cx+a,ys]];for(let i=1;i<n;i++){const t=Math.PI*i/n;pts.push([cx+Math.cos(t)*a,ys+Math.sin(t)*(WIN.b+pad)]);}pts.push([cx-a,ys]);return pts;};
  const circ=(cx,cy,r,n=24)=>[...Array(n)].map((_,i)=>{const a=i/n*6.283;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r];});
  const gable=[[-HW,0],[HW,0],[HW,EY],[0,RY],[-HW,EY]];
  T3(shapeG(gable,.25,WZ-.25,[tavArch(24),winArch(-1),winArch(1),circ(0,AW.y,AW.r)]),TM.plaster,[0,0,0],[0,0,0],[1,1,1],true);
  T3(shapeG(gable,.25,WZ-DEP),TM.plaster,[0,0,0],[0,0,0],[1,1,1],false);
  for(const sd of[-1,1])T3(new THREE.BoxGeometry(.25,EY,DEP-.5),TM.plaster,[sd*(HW-.125),EY/2,WZ-DEP/2],[0,0,0],[1,1,1],true);
  // 牆腳石：沿 x（正面）或沿 z（側面）一排排錯開；skip(c)＝這裡不放（門洞）
  const STM=()=>[TM.stone,TM.stone2,TM.stone3][Math.floor(R3()*3)];
  function plinth(a0,a1,fixed,alongZ,rows=4,skip=()=>false){const H=rows*.2+.02,sg=alongZ?Math.sign(fixed):1;
    for(let t=a0;t<a1;){if(skip(t+.025)){t+=.05;continue;}let t1=t;while(t1<a1&&!skip(t1+.025))t1+=.05;t1=Math.min(t1,a1);const c=(t+t1)/2,L=t1-t;   // 灰縫底（門洞那段跳過）
      if(alongZ)T3(new THREE.BoxGeometry(.05,H,L),TM.mortar,[fixed+sg*.025,H/2,c],[0,0,0],[1,1,1],false);else T3(new THREE.BoxGeometry(L,H,.05),TM.mortar,[c,H/2,fixed+.025],[0,0,0],[1,1,1],false);t=t1;}
    for(let row=0;row<rows;row++){const y0=row*.2;let t=a0+(row%2)*.15;while(t<a1){const w=.24+R3()*.24,t1=Math.min(a1,t+w),c=(t+t1)/2;
      if(!skip(c)&&t1-t>.08){const h=.14+R3()*.045,dz=.04+R3()*.045,yy=y0+.11+(R3()-.5)*.02,tl=(R3()-.5)*.08,L=t1-t-.04;
        if(alongZ)T3(new THREE.BoxGeometry(.1,h,L),STM(),[fixed+sg*dz,yy,c],[tl,0,0]);else T3(new THREE.BoxGeometry(L,h,.1),STM(),[c,yy,fixed+dz],[0,0,tl]);}t=t1;}}}
  plinth(-HW,HW,WZ,false,4,c=>Math.abs(c)<TDA+.36);
  T3(new THREE.BoxGeometry(TDA*2+.6,.06,.42),TM.stone,[0,.03,WZ+.23]);   // 門前石階（很薄，扭蛋停在門前不會卡到）
  for(const sd of[-1,1])plinth(WZ-.85,WZ-.05,sd*HW,true,4);
  // 半木造的木框（正面）：粗的轉角柱、牆腳樑、窗頂樑、簷口樑、直柱、山牆斜撐、圓窗兩旁的柱
  const BZ=WZ+.06;
  for(const [a,b,c,d,w] of[[-HW+.04,0,-HW+.04,EY,.26],[HW-.04,0,HW-.04,EY,.26],[-HW,.84,-TDA-.36,.84],[TDA+.36,.84,HW,.84],[-HW,2.78,-TDA-.42,2.78],[TDA+.42,2.78,HW,2.78],[-HW,EY,HW,EY,.24],
      [PX(215),.84,PX(215),EY],[PX(500),.84,PX(500),2.78],[PX(1172),.84,PX(1172),2.78],[PX(1458),.84,PX(1458),EY],
      [-.62,EY,-.62,roofY(.62)-.08],[.62,EY,.62,roofY(.62)-.08],[-2.15,EY,-.62,EY+.95],[2.15,EY,.62,EY+.95],[-.62,AW.y-.5,.62,AW.y-.5]])tbm(a,b,c,d,w||.2,.1,BZ,TM.timber);
  for(const sd of[-1,1])T3(new THREE.BoxGeometry(.1,.2,.85),TM.timber,[sd*(HW+.05),.84,WZ-.42]);
  // 山牆圓窗（木框＋透光玻璃＋十字窗格）
  T3(new THREE.TorusGeometry(AW.r+.03,.07,6,24),TM.timber,[0,AW.y,WZ+.03]);
  T3(new THREE.CircleGeometry(AW.r,20),TM.glass,[0,AW.y,WZ-.18],[0,0,0],[1,1,1],false);
  tbm(-AW.r,AW.y,AW.r,AW.y,.05,.05,WZ-.08,TM.timber);tbm(0,AW.y-AW.r,0,AW.y+AW.r,.05,.05,WZ-.08,TM.timber);
  // 屋頂：兩片有厚度的斜板往外伸出屋簷，上面一排排錯開的瓦（下緣微翹）、正面封簷板、簷下椽頭
  const TILE=new THREE.BoxGeometry(.3,.05,.32),SCAL=new THREE.CylinderGeometry(.075,.075,.05,10);TAV_TILE=TILE;
  for(const sd of[-1,1]){const x1=HW+OV,y1=roofY(x1),L=Math.hypot(x1,RY-y1)+.12,ang=Math.atan2(RY-EY,HW),zF=WZ+OVF,zB=WZ-DEP-.5,ZL=zF-zB;
    const roof=new THREE.Group();roof.position.set(sd*x1/2,(RY+y1)/2,(zF+zB)/2);roof.rotation.z=-sd*ang;TAV3.add(roof);
    mk(new THREE.BoxGeometry(L,.2,ZL),TM.roof,roof,[0,.1,0]);
    const A=[],B=[];for(let r=0;.14+r*.27<L-.1;r++){const u=.14+r*.27;for(let c=0;;c++){const z=-ZL/2+.17+c*.33-(r%2)*.165;if(z>ZL/2-.1)break;if(z<-ZL/2+.08)continue;(R3()<.22?B:A).push([sd*(u-L/2),.235,z,1,0,0,sd*.16]);}}
    inst(TILE,TM.roof2,A,roof);inst(TILE,TM.roofL,B,roof);
    mk(new THREE.BoxGeometry(L+.08,.32,.16),TM.timber,roof,[0,.06,ZL/2+.04]);mk(new THREE.BoxGeometry(L+.1,.07,.05),TM.wood,roof,[0,.2,ZL/2+.14],[0,0,0],[1,1,1],false);
    {const S=[];for(let x=-L/2+.14;x<L/2-.05;x+=.15)S.push([x,-.1,ZL/2+.1,1,Math.PI/2,0,0]);inst(SCAL,TM.timber,S,roof);}
    for(let z=-ZL/2+.4;z<ZL/2-.2;z+=.62)mk(new THREE.BoxGeometry(.42,.11,.11),TM.timber,roof,[sd*(L/2-.24),-.05,z],[0,0,0],[1,1,1],false);}
  {const zF=WZ+OVF,zB=WZ-DEP-.5;T3(new THREE.BoxGeometry(.3,.18,zF-zB+.06),TM.timber,[0,RY+.3,(zF+zB)/2]);
    T3(new THREE.CylinderGeometry(.04,.05,.3,6),TM.timber,[0,RY+.48,zF+.02],[0,0,0],[1,1,1],false);T3(new THREE.OctahedronGeometry(.12,0),TM.crystal,[0,RY+.72,zF+.02],[0,0,0],[1,1.5,1]);}
  // 煙囪（右邊屋頂後段）＋三團煙
  {const cx=1.95,cz=WZ-3.0,yb=roofY(cx)-.2,yt=RY+.8,hw=.31;T3(new THREE.BoxGeometry(hw*2,yt-yb,hw*2),TM.stone3,[cx,(yb+yt)/2,cz]);
    for(let row=0,y=yb+.02;y<yt-.05;row++,y+=.17){const h=Math.min(.15,yt-y-.02);for(const f of[0,1,2,3]){let t=-hw+(row%2)*.12;while(t<hw-.02){const w=.2+R3()*.1,t1=Math.min(hw,t+w),c=(t+t1)/2,L=t1-t-.025;if(L>.05){
      const g=f<2?new THREE.BoxGeometry(L,h,.04):new THREE.BoxGeometry(.04,h,L),pos=f===0?[cx+c,y+h/2,cz+hw+.01]:f===1?[cx+c,y+h/2,cz-hw-.01]:f===2?[cx+hw+.01,y+h/2,cz+c]:[cx-hw-.01,y+h/2,cz+c];T3(g,R3()<.5?TM.stone:TM.stone2,pos,[0,0,0],[1,1,1],false);}t=t1;}}}
    T3(new THREE.BoxGeometry(.8,.14,.8),TM.timber,[cx,yt+.07,cz]);T3(new THREE.CylinderGeometry(.13,.15,.26,8),TM.pot,[cx,yt+.27,cz]);
    for(let k=0;k<3;k++){const c0=[cx-.2-k*.42,yt+.6+k*.5,cz+.1],s0=.7+k*.35;for(let j=0;j<5;j++){const m=T3(new THREE.IcosahedronGeometry((.09+R3()*.06)*s0,1),TM.smoke,[c0[0]+(R3()-.5)*.3*s0,c0[1]+(R3()-.5)*.14*s0,c0[2]+(R3()-.5)*.2*s0],[R3(),R3(),0],[1,.8,1],false);m.userData.noCast=1;}}}
  // 兩側的側翼：比主屋矮、往後退，屋脊跟正面平行（正面看得到一片瓦屋頂），外側是小山牆；正面一扇方窗＋小花箱
  for(const sd of[-1,1]){const x0=HW,x1=HW+2.15,ww=x1-x0,cx=sd*(x0+x1)/2,fz=WZ-.85,wd=3.0,ey=2.4,ry=3.5,bz=fz-wd;
    T3(new THREE.BoxGeometry(ww,ey,.22),TM.plaster2,[cx,ey/2,fz-.11]);
    T3(shapeG([[-wd/2,0],[wd/2,0],[wd/2,ey],[0,ry],[-wd/2,ey]],.22,-.11),TM.plaster2,[sd*(x1-.11),0,fz-wd/2],[0,Math.PI/2,0]);
    T3(new THREE.BoxGeometry(ww,ey,.22),TM.plaster2,[cx,ey/2,bz+.11],[0,0,0],[1,1,1],false);
    plinth(sd>0?x0+.15:-x1,sd>0?x1:-x0-.15,fz,false,3);plinth(bz+.05,fz-.05,sd*x1,true,3);
    tbm(sd*(x1-.04),0,sd*(x1-.04),ey,.22,.1,fz+.06,TM.timber);tbm(sd*x0,.64,sd*x1,.64,.16,.1,fz+.06,TM.timber);tbm(sd*x0,ey-.08,sd*x1,ey-.08,.2,.1,fz+.06,TM.timber);
    for(const z of[fz,bz])T3(new THREE.BoxGeometry(.1,ey,.2),TM.timber,[sd*(x1+.05),ey/2,z+(z===fz?-.1:.1)]);
    T3(new THREE.BoxGeometry(.1,.16,wd),TM.timber,[sd*(x1+.05),.64,fz-wd/2]);T3(new THREE.BoxGeometry(.1,ry-ey-.1,.18),TM.timber,[sd*(x1+.05),(ey+ry)/2-.05,fz-wd/2]);
    {const xl=Math.min(sd*x0,sd*x1),xr=Math.max(sd*x0,sd*x1);for(const xx of[cx-.56,cx+.56])tbm(xx,.64,xx,ey-.08,.13,.09,fz+.06,TM.timber);
      tbm(xl+.08,.72,cx-.56,ey-.16,.11,.08,fz+.05,TM.timber);tbm(xr-.08,.72,cx+.56,ey-.16,.11,.08,fz+.05,TM.timber);}
    const wy=1.48;T3(new THREE.BoxGeometry(.8,.9,.04),TM.glassW,[cx,wy,fz+.0],[0,0,0],[1,1,1],false);
    for(const [a,b,c,d] of[[cx-.44,wy-.49,cx+.44,wy-.49],[cx-.44,wy+.49,cx+.44,wy+.49],[cx-.44,wy-.49,cx-.44,wy+.49],[cx+.44,wy-.49,cx+.44,wy+.49]])tbm(a,b,c,d,.1,.08,fz+.08,TM.timber);
    tbm(cx-.4,wy,cx+.4,wy,.05,.04,fz+.04,TM.timber,TAV3,false);tbm(cx,wy-.45,cx,wy+.45,.05,.04,fz+.04,TM.timber,TAV3,false);
    T3(new THREE.BoxGeometry(1.0,.22,.26),TM.wood,[cx,wy-.64,fz+.15]);
    flowers([cx,wy-.5,fz+.17],.36,90,sd<0?[[TM.flP,.5],[TM.flW,.3],[TM.flV,.2]]:[[TM.flV,.4],[TM.flP,.4],[TM.flW,.2]],.35);leafy([cx,wy-.55,fz+.2],.45,50,.25);
    // 前斜面屋頂（瓦）＋後斜面＋外側封簷板
    const W2=ww+.4,xc=sd*(x0+W2/2);
    {const dz=wd/2+.5,dy=ry-ey,Ls=Math.hypot(dz,dy)+.1,rf=new THREE.Group();rf.position.set(xc,(ey+ry)/2,fz+.5-dz/2);rf.rotation.x=Math.atan2(dy,dz);TAV3.add(rf);
      mk(new THREE.BoxGeometry(W2,.18,Ls),TM.roof,rf,[0,.09,0]);
      const A=[],B=[];for(let r=0;.14+r*.27<Ls-.1;r++){const v=Ls/2-.14-r*.27;for(let c=0;;c++){const x=-W2/2+.17+c*.33-(r%2)*.165;if(x>W2/2-.1)break;if(x<-W2/2+.08)continue;(R3()<.22?B:A).push([x,.215,v,1,-.16,0,0]);}}
      inst(TILE,TM.roof2,A,rf);inst(TILE,TM.roofL,B,rf);
      mk(new THREE.BoxGeometry(W2+.06,.28,.14),TM.timber,rf,[0,.05,Ls/2+.03]);mk(new THREE.BoxGeometry(.13,.28,Ls),TM.timber,rf,[sd*(W2/2+.02),.05,0]);}
    {const dz=wd/2+.3,dy=ry-ey,Ls=Math.hypot(dz,dy)+.1,rf=new THREE.Group();rf.position.set(xc,(ey+ry)/2,bz-.3+dz/2);rf.rotation.x=-Math.atan2(dy,dz);TAV3.add(rf);
      mk(new THREE.BoxGeometry(W2,.18,Ls),TM.roof,rf,[0,.09,0]);mk(new THREE.BoxGeometry(.13,.28,Ls),TM.timber,rf,[sd*(W2/2+.02),.05,0]);}}
  // 石拱門框（拱石＋門柱石塊），往外凸
  {const N=13,a0=TDA,b0=TDB,a1=TDA+.3,b1=TDB+.24;for(let i=0;i<N;i++){const t0=Math.PI*i/N,t1=Math.PI*(i+1)/N,P=(t,a,b)=>[Math.cos(t)*a,TDSP+Math.sin(t)*b],kst=i===(N>>1)?.06:0;
      const pts=[P(t0+.01,a0,b0),P(t1-.01,a0,b0),P(t1-.01,a1+kst,b1+kst),P(t0+.01,a1+kst,b1+kst)];T3(shapeG(pts,.36,WZ-.12),i%2?TM.stone:TM.stone2,[0,0,0],[0,0,0],[1,1,1],true);}
    for(const sd of[-1,1]){let y=0,k=0;while(y<TDSP-.02){const h=Math.min(.36,TDSP-y),w=k%2?.3:.36;T3(new THREE.BoxGeometry(w,h-.025,.36),k%2?TM.stone2:TM.stone,[sd*(TDA+w/2),y+h/2,WZ+.06],[0,0,0],[1,1,1],true);y+=h;k++;}}
    // 門洞內側（深色）
    T3(shapeG(tavArch(24),.02,WZ-.3),TM.doorD,[0,0,0],[0,0,0],[1,1,1],false);}
  // 拱窗：窗框、窗格、透光玻璃、粉紅窗簾、窗台花箱
  for(const sd of[-1,1]){const cx=sd*WIN.cx;
    T3(shapeG(winArch(sd,.08),.14,WZ-.06,[winArch(sd,0)]),TM.timber,[0,0,0],[0,0,0],[1,1,1],true);
    T3(shapeG(winArch(sd,0),.02,WZ-.2),TM.glassW,[0,0,0],[0,0,0],[1,1,1],false);
    tbm(cx,WIN.y0,cx,WIN.ys+WIN.b,.06,.05,WZ-.12,TM.timber);tbm(cx-WIN.a,(WIN.y0+WIN.ys)/2,cx+WIN.a,(WIN.y0+WIN.ys)/2,.06,.05,WZ-.12,TM.timber);
    for(const s2 of[-1,1]){const x0=cx+s2*(WIN.a-.02),x1=cx+s2*.12,top=WIN.ys+.2,mid=WIN.y0+.35;   // 窗簾：上面寬、中間綁起來、下面散開
      T3(shapeG([[x0,top],[x1,top],[x0+(x1-x0)*.25,mid],[x0+(x1-x0)*.45,WIN.y0+.05],[x0,WIN.y0+.05]],.05,WZ-.16),TM.curtain,[0,0,0],[0,0,0],[1,1,1],true);
      T3(new THREE.SphereGeometry(.035,8,6),TM.flP2,[x0+(x1-x0)*.22,mid,WZ-.1],[0,0,0],[1,1,1],false);}
    T3(new THREE.BoxGeometry(WIN.a*2+.3,.06,.24),TM.timber,[cx,WIN.y0-.03,WZ+.1]);
    T3(new THREE.BoxGeometry(1.42,.26,.3),TM.wood,[cx,WIN.y0-.25,WZ+.18]);T3(new THREE.BoxGeometry(1.46,.05,.32),TM.timber,[cx,WIN.y0-.13,WZ+.18],[0,0,0],[1,1,1],false);
    flowers([cx,WIN.y0-.05,WZ+.2],.42,150,sd<0?[[TM.flP,.45],[TM.flV,.3],[TM.flW,.25]]:[[TM.flV,.45],[TM.flP,.35],[TM.flW,.2]],.35);
    leafy([cx,WIN.y0-.08,WZ+.24],.55,90,.25);
    const hang=[];for(let k=0;k<60;k++){const x=cx-.65+R3()*1.3,yy=WIN.y0-.28-R3()*.45;hang.push([x,yy,WZ+.35+R3()*.05,.7+R3()*.5,R3()*3,R3()*3]);}inst(LFG,TM.leaf,hang);}
  // 壁燈（鐵臂＋六角燈＋粉紅水晶墜）
  for(const sd of[-1,1]){const x=sd*PX(1180),y=PY(322);tbm(x-sd*.02,y+.5,x,y+.5,.05,.42,WZ+.42,TM.iron);
    T3(new THREE.TorusGeometry(.09,.018,6,12,Math.PI*1.4),TM.iron,[x-sd*.08,y+.6,WZ+.15],[0,sd>0?Math.PI/2:-Math.PI/2,0]);
    T3(new THREE.CylinderGeometry(.008,.008,.12,4),TM.iron,[x,y+.42,WZ+.42],[0,0,0],[1,1,1],false);
    T3(new THREE.CylinderGeometry(.14,.11,.3,6),TM.glass,[x,y+.18,WZ+.42],[0,Math.PI/6,0]);
    T3(new THREE.ConeGeometry(.19,.14,6),TM.iron,[x,y+.4,WZ+.42],[0,Math.PI/6,0]);T3(new THREE.ConeGeometry(.12,.09,6),TM.iron,[x,y-.02,WZ+.42],[Math.PI,Math.PI/6,0]);
    for(let k=0;k<6;k++){const a=k/6*6.283+Math.PI/6;T3(new THREE.BoxGeometry(.02,.3,.02),TM.iron,[x+Math.cos(a)*.13,y+.18,WZ+.42+Math.sin(a)*.13],[0,0,0],[1,1,1],false);}
    T3(new THREE.OctahedronGeometry(.05,0),TM.crystal,[x,y-.14,WZ+.42],[0,0,0],[1,1.5,1]);}
  // 招牌（木牌＋貓臉）＋鏈條
  {const cv=document.createElement('canvas');cv.width=160;cv.height=46;const x=cv.getContext('2d');x.fillStyle='#a24d4a';x.fillRect(0,0,160,46);x.fillStyle='#873d3c';x.fillRect(4,4,152,38);x.fillStyle='#bb5c53';x.fillRect(6,6,148,34);
    const px=(a,b,w,h,c)=>{x.fillStyle=c;x.fillRect(a,b,w,h);};
    // 貓臉（米色）＋耳朵＋瞇眼、鬍鬚
    px(64,14,32,22,'#f3c3b3');px(62,18,36,16,'#f3c3b3');px(64,9,6,6,'#f3c3b3');px(66,7,3,3,'#f3c3b3');px(90,9,6,6,'#f3c3b3');px(91,7,3,3,'#f3c3b3');
    px(70,22,6,2,'#763233');px(84,22,6,2,'#763233');px(78,27,4,2,'#e07ba0');px(57,24,7,1,'#763233');px(96,24,7,1,'#763233');px(57,28,7,1,'#763233');px(96,28,7,1,'#763233');
    for(const [a,b] of[[22,18],[130,18]]){px(a,b+4,8,7,'#f3c3b3');px(a-2,b,3,3,'#f3c3b3');px(a+2,b-2,3,3,'#f3c3b3');px(a+6,b-2,3,3,'#f3c3b3');px(a+9,b,3,3,'#f3c3b3');}
    for(const a of[40,108]){px(a,20,12,2,'#d28381');px(a+2,17,2,3,'#d28381');px(a+6,16,2,3,'#d28381');px(a+9,17,2,3,'#d28381');}
    const tex=texOf(cv),y=PY(122),zz=WZ+.3;
    T3(shapeG([[-1.16,-.32],[1.16,-.32],[1.2,-.2],[1.2,.2],[1.16,.32],[.4,.34],[0,.38],[-.4,.34],[-1.16,.32],[-1.2,.2],[-1.2,-.2]],.08,-.04),TM.timber,[0,y,zz]);
    const face=new THREE.Mesh(new THREE.PlaneGeometry(2.1,.6),texMat(tex));face.position.set(0,y,zz+.045);TAV3.add(face);
    for(const sd of[-1,1])for(let k=0;k<4;k++)T3(new THREE.TorusGeometry(.03,.009,4,8),TM.iron,[sd*.95,y+.38+k*.07,zz-.02],[0,k%2?Math.PI/2:0,0],[1,1,1],false);}
  // 掛旗（鐵桿＋粉紅布＋菱形徽章）
  for(const sd of[-1,1]){const x=sd*PX(1535),y=PY(160);tbm(x-sd*.25,y,x+sd*.25,y,.04,.04,WZ+.32,TM.iron);
    T3(shapeG([[-.22,0],[.22,0],[.22,-.72],[0,-.86],[-.22,-.72]],.03,0),TM.curtain,[x,y-.04,WZ+.28]);
    T3(shapeG([[0,-.14],[.1,-.3],[0,-.46],[-.1,-.3]],.02,.03),TM.flP2,[x,y-.04,WZ+.28],[0,0,0],[1,1,1],false);
    tbm(x-sd*.02,y,x,y,.04,.32,WZ+.3,TM.iron);}
  // 酒桶＋繡球花、後面的圓錐樹、盆花、兩邊的籬笆與玫瑰樹叢
  MKH1=TAV3.children.length;
  const barrelG=new THREE.LatheGeometry([...Array(9)].map((_,i)=>{const t=i/8;return new THREE.Vector2(.28+.05*Math.sin(Math.PI*t),t*.46);}),14);
  for(const sd of[-1,1]){const bx=sd*PX(1223),bz=WZ+.58;
    T3(barrelG,TM.wood,[bx,0,bz]);for(const yy of[.08,.38])T3(new THREE.TorusGeometry(.315,.016,4,18),TM.band,[bx,yy,bz],[Math.PI/2,0,0],[1,1,1],false);
    for(let k=0;k<10;k++){const a=k/10*6.283;T3(new THREE.BoxGeometry(.012,.4,.012),TM.timber,[bx+Math.cos(a)*.31,.23,bz+Math.sin(a)*.31],[0,-a,0],[1,1,1],false);}
    flowers([bx,.48,bz],.36,190,sd<0?[[TM.flP,.5],[TM.flP2,.2],[TM.flW,.3]]:[[TM.flV,.4],[TM.flP,.35],[TM.flW,.25]],.6);leafy([bx,.44,bz],.4,26,.3);
    // 圓錐樹（三層葉團）＋小白花
    const tx=sd*PX(1160),tz=WZ+.32;for(let k=0;k<4;k++){const r=.26-k*.055;T3(new THREE.IcosahedronGeometry(r*.9,1),TM.leafD,[tx,.55+k*.2,tz],[R3(),R3(),0],[1,.85,1]);leafy([tx,.55+k*.2,tz],r*.95,90-k*15,.85,k%2?TM.leaf:TM.leafD);}
    T3(new THREE.ConeGeometry(.08,.16,6),TM.leaf,[tx,1.38,tz]);flowers([tx,.95,tz],.24,18,[[TM.flW,1]],2.2);
    // 盆花
    const px2=sd*PX(1366),pz=WZ+.72;T3(new THREE.LatheGeometry([[.12,0],[.14,.04],[.17,.2],[.19,.22],[.19,.25],[.16,.25]].map(p=>new THREE.Vector2(...p)),12),TM.pot,[px2,0,pz]);
    leafy([px2,.32,pz],.2,22,.6);flowers([px2,.38,pz],.2,60,sd<0?[[TM.flW,.55],[TM.flP,.45]]:[[TM.flP,.5],[TM.flV,.2],[TM.flW,.3]],.7);
    // 籬笆＋玫瑰樹叢
    for(let k=0;k<7;k++){const fx=sd*(3.45+k*.16);T3(shapeG([[-.035,0],[.035,0],[.035,.56],[0,.64],[-.035,.56]],.035,-.0175),TM.wood,[fx,0,WZ+.95]);}
    for(const yy of[.18,.45])tbm(sd*3.38,yy,sd*4.52,yy,.05,.03,WZ+.99,TM.wood);
    tufts(sd>0?TDA+.5:-HW,sd>0?HW:-TDA-.5,WZ+.1,WZ+.32,14);tufts(sd>0?HW+.1:-HW-2.2,sd>0?HW+2.2:-HW-.1,WZ-.8,WZ-.55,10);tufts(sd*3.3,sd*4.7,WZ+.85,WZ+1.15,8);
    for(let k=0;k<5;k++){const c=[sd*(3.5+R3()*1.1),.35+R3()*.7,WZ+.55+R3()*.3],r=.32+R3()*.18;T3(new THREE.IcosahedronGeometry(r*.92,1),TM.leafD,c,[R3(),R3(),0],[1,.85,1],false);leafy(c,r,70,.85,k%2?TM.leaf:TM.leafD);}
    flowers([sd*3.95,.75,WZ+.75],.65,120,[[TM.flP,.55],[TM.flP2,.25],[TM.flW,.2]],.9);
    // 兩旁的大樹（在側翼外面）
    bigTree(sd*6.9,WZ-1.3,1.05);bigTree(sd*9.4,WZ-3.6,.9);tufts(sd*6.3,sd*7.5,WZ-1.8,WZ-.8,10);}
  MKV0=TAV3.children.length;
  // 藤蔓：一團團葉子（深淺兩色）＋零星小花；招牌上方往兩邊垂、轉角柱往下、沿正面封簷板垂下
  {const V=[],F=[];const vine=(pts,n,sp=.13)=>{const cv=new THREE.CatmullRomCurve3(pts.map(p=>V3(...p)));for(let i=0;i<n;i++){const p=cv.getPointAt(i/(n-1));
      for(let j=0;j<3;j++)V.push([p.x+(R3()-.5)*sp*2,p.y+(R3()-.5)*sp*2,p.z+R3()*sp,1+R3()*.7,R3()*3,R3()*3,R3()*3]);if(R3()<.12)F.push([p.x+(R3()-.5)*.1,p.y+(R3()-.5)*.1,p.z+sp+.02,1.1+R3()*.4]);}};
    for(const sd of[-1,1]){vine([[sd*.15,EY+.2,WZ+.14],[sd*1.2,EY+.06,WZ+.16],[sd*1.75,3.2,WZ+.16],[sd*1.9,2.5,WZ+.12],[sd*1.95,1.8,WZ+.1]],80);
      vine([[sd*(HW-.1),EY+.1,WZ+.14],[sd*(HW-.18),2.8,WZ+.14],[sd*(HW-.14),2.0,WZ+.12]],45);
      vine([[sd*.5,roofY(.5)-.22,WZ+OVF+.12],[sd*1.6,roofY(1.6)-.24,WZ+OVF+.12],[sd*2.7,roofY(2.7)-.2,WZ+OVF+.1]],50,.11);}
    inst(LFG,TM.leaf,V.filter((_,i)=>i%2===0));inst(LFG,TM.leafD,V.filter((_,i)=>i%2===1));inst(FLG,TM.flW,F);inst(FLG,TM.flP,F.filter((_,i)=>i%3===0).map(p=>[p[0]+.05,p[1]-.04,p[2],1]));}
  MKV1=TAV3.children.length;
}
// 兩片門板（3D）：木板＋直紋、圓窗、鐵鉸鏈、門環；鉸鏈在兩邊、往外甩開（跟原本的 tLeaf 同樣的角度）
const TLEAF3=[];
if(TAV3_ON)for(const sd of[-1,1]){const piv=new THREE.Group();piv.position.set(sd*TDA,0,WZ-.1);TAV3.add(piv);
  const pts=archHalf(sd).map(([x,y])=>[x-sd*TDA,y]);mk(shapeG(pts,.08,-.04),TM.door,piv,[0,0,0]);
  for(let k=1;k<6;k++){const x=-sd*k*TDA/6;mk(new THREE.BoxGeometry(.018,TDSP+TDB*Math.sqrt(Math.max(0,1-Math.pow((sd*TDA+x)/TDA,2)))-.06,.01),TM.doorD,piv,[x,(TDSP+TDB*Math.sqrt(Math.max(0,1-Math.pow((sd*TDA+x)/TDA,2))))/2,.045],[0,0,0],[1,1,1],false);}
  const wy=PY(380);mk(new THREE.TorusGeometry(.17,.035,6,20),TM.doorD,piv,[-sd*.6,wy,.05]);mk(new THREE.CircleGeometry(.15,16),TM.glass,piv,[-sd*.6,wy,.045],[0,0,0],[1,1,1],false);
  mk(new THREE.BoxGeometry(.3,.025,.012),TM.doorD,piv,[-sd*.6,wy,.06],[0,0,0],[1,1,1],false);mk(new THREE.BoxGeometry(.025,.3,.012),TM.doorD,piv,[-sd*.6,wy,.06],[0,0,0],[1,1,1],false);
  for(const yy of[.35,1.05,1.75,2.25]){mk(new THREE.BoxGeometry(.55,.05,.02),TM.iron,piv,[-sd*.3,yy,.055],[0,0,0],[1,1,1],false);mk(new THREE.TorusGeometry(.05,.012,4,10,Math.PI*1.5),TM.iron,piv,[-sd*.6,yy+.03,.055],[0,0,sd>0?0:Math.PI],[1,1,1],false);}
  mk(new THREE.TorusGeometry(.085,.018,6,14),TM.iron,piv,[-sd*(TDA-.18),PY(500),.07],[0,0,0],[1,1,1],false);mk(new THREE.SphereGeometry(.035,8,6),TM.iron,piv,[-sd*(TDA-.18),PY(500)+.09,.06],[0,0,0],[1,1,1],false);
  TLEAF3.push({piv,sd});}
// 門後的光（3D 版）
if(TAV3_ON){const m=new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(tavArch())),tDoorLight.material);m.position.set(0,0,WZ-.22);m.userData.noCast=1;TAV3.add(m);tBeam.userData.noCast=1;tGap.userData.noCast=1;
  TAV3.add(tBeam);tGap.position.set(0,(TDSP+TDB)/2,WZ-.02);TAV3.add(tGap);}

// ---------- 戶外演唱會舞台（D 11/08「背景應該是戶外，扭蛋是滾向店內」→「舞台太簡單，要演唱會那種閃亮舞台」）----------
// 機台站在黑亮的舞台地板上（亮片會閃、搖頭燈打出彩色光圈）；後面一整面 LED 大螢幕（放射光、一圈圈光環、等化器、貓掌、星星都會動）；
// 鋁製桁架四根柱子圍起舞台，前面那支橫桁架吊一排搖頭燈、彩色光束會掃；兩側大音響、地上監聽喇叭、柱子上的 LED 燈條跑馬；
// 螢幕兩旁星星燈簾、空中亮片閃光、彩紙慢慢飄。外面是傍晚轉夜的天空（星星）、兩旁大樹。色盤沿用舞台那套（機台、扭蛋顏色不變）。
// 網址加 ?lobbybg 看回店內背景。
const STG3_ON=!Q.has('lobbybg')&&!Q.has('oldbg'),STG3=new THREE.Group();world.add(STG3);STG3.visible=false;
const DS=THREE.DoubleSide,SM={leaf:toon('#9cb35e','#7a9450','#5c4a63'),leafD:toon('#7a9450','#56703f','#3b2559'),trunk:toon('#b8907e','#8a4b22','#5a3438'),
  hillF:toon('#9a86e6','#7a64c8','#5a48a0'),hillN:toon('#7a9450','#56703f','#3b2559'),
  truss:toon('#9a8499','#7a6680','#3b2559'),spk:toon('#4b2f6c','#2f1d4a','#1a1028'),spkF:toon('#3b2559','#241638','#1a1028'),cone:toon('#7a6680','#5c4a63','#241638'),
  head:toon('#5e3b82','#3b2559','#1a1028'),lens:toon('#ffffff','#ffeef2','#ffd4dc',{noDim:true}),gold:toon('#ffe27a','#f2b53e','#b8692a')};
SM.lens.uniforms.uEmis.value.setRGB(.5,.45,.5);
const SMT={trunk:SM.trunk,leaf:SM.leaf,leafD:SM.leafD};
const CU={uT:{value:0}},HEADS=[],SPOT={uSpP:{value:[...Array(6)].map(()=>V3(0,-9,0))},uSpC:{value:[...Array(6)].map(()=>new THREE.Color(0,0,0))}};
const STG_FY=-1.24;   // 通用舞台地板高度：粉紅圓台（-.34～0）底下再墊兩層圓台，各高 .45
const H1=`float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}`;
if(STG3_ON){BUILD=STG3;const FY=STG_FY;
  // 天空：傍晚轉夜（地平線一點桃粉，往上變深紫）＋會閃的星星
  {const m=new THREE.Mesh(new THREE.SphereGeometry(88,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uT:CU.uT},vertexShader:VOL_V,fragmentShader:`uniform float uDim,uT;uniform vec3 uDimC;varying vec3 vW;${H1}
    void main(){vec3 d=normalize(vW-cameraPosition);float el=degrees(asin(d.y)),az=degrees(atan(d.x,-d.z));
    vec3 c=el<1.5?vec3(1.,.773,.561):(el<4.?vec3(.949,.565,.659):(el<8.?vec3(.761,.498,.722):(el<13.?vec3(.451,.282,.588):(el<20.?vec3(.294,.184,.424):vec3(.184,.114,.29)))));
    vec2 q=floor(vec2(az,el)*1.6);float s=h(q);if(el>6.&&s>.985&&fract(s*31.+uT*.0004)<.6)c=mix(c,vec3(1.,.95,1.),.85);
    c=mix(c,uDimC,uDim*.7);gl_FragColor=vec4(c,1.);}`}));m.userData.noCast=1;STG3.add(m);}
  // 草地（夜色）＋遠山＋樹林剪影＋兩旁大樹
  {const g=new THREE.PlaneGeometry(220,220);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:{uDim:GU.uDim,uDimC:GU.uDimC},vertexShader:VOL_V,fragmentShader:`uniform float uDim;uniform vec3 uDimC;varying vec3 vW;
    vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
    void main(){vec2 P=vW.xz;float g1=h2(floor(P*11.)).x,g2=h2(floor(P*2.7)).y;vec3 c=g2<.5?vec3(.337,.439,.247):vec3(.29,.35,.25);if(g1>.9)c=vec3(.478,.58,.314);
    c=mix(c,vec3(.294,.184,.424),.45);c=mix(c,vec3(.451,.282,.588),smoothstep(16.,62.,length(P))*.8);c=mix(c,uDimC,uDim*.6);gl_FragColor=vec4(c,1.);}`}));m.position.y=(FY-.28);m.userData.noCast=1;STG3.add(m);}
  for(let i=0;i<11;i++){const x=-50+i*10+R3()*4;T3(new THREE.SphereGeometry(1,24,8,0,6.283,0,Math.PI/2),SM.hillF,[x,(FY-.28),-62-R3()*8],[0,R3()*3,0],[12+R3()*6,2.6+R3()*2.4,6],false).userData.noCast=1;}
  for(let x=-34;x<34;x+=1.5+R3()*.8){const r=1+R3(),z=-24-R3()*6;T3(new THREE.IcosahedronGeometry(r,1),R3()<.5?SM.leafD:SM.hillN,[x,(FY-.28)+r*.85,z],[R3()*3,R3()*3,0],[1,1.15,1],false).userData.noCast=1;}
  bigTree(-10.2,-8.6,1.25,SMT,(FY-.28));bigTree(10.4,-9.2,1.3,SMT,(FY-.28));bigTree(-12.8,-3.4,1.1,SMT,(FY-.28));bigTree(13,-4,1.1,SMT,(FY-.28));
  // 舞台地板：黑亮拼板、亮片一閃一閃、LED 螢幕的倒影、搖頭燈打下來的彩色光圈；底下深色裙邊
  T3(new THREE.BoxGeometry(17.4,.3,13.4),SM.spkF,[0,FY-.16,-1.9],[0,0,0],[1,1,1],false);
  {const g=new THREE.PlaneGeometry(17.4,13.4);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uT:CU.uT,uSM:GU.uSM,uSMM:GU.uSMM,uSMOn:GU.uSMOn,...SPOT},vertexShader:VOL_V,fragmentShader:`uniform float uDim,uT,uSMOn;uniform vec3 uDimC,uSpP[6],uSpC[6];uniform sampler2D uSM;uniform mat4 uSMM;varying vec3 vW;${H1}
    void main(){vec2 P=vW.xz;vec2 g=fract(P*.8);float ln=max(step(g.x,.03),step(g.y,.03));
    vec3 c=mix(vec3(.141,.086,.22),vec3(.184,.114,.29),step(.5,h(floor(P*.8))));c=mix(c,vec3(.29,.184,.42),ln*.7);
    float rf=smoothstep(-3.,-7.6,P.y)*step(abs(P.x),5.6);c+=vec3(.2,.12,.26)*rf*.25;
    for(int i=0;i<6;i++){float d=length((P-uSpP[i].xz)*vec2(1.,1.25));c+=uSpC[i]*(d<.5?.62:(d<.8?.3:0.));}
    if(uSMOn>.5){vec4 q=uSMM*vec4(vW,1.);vec3 sp=q.xyz*.5+.5;if(sp.x>0.&&sp.x<1.&&sp.y>0.&&sp.y<1.&&sp.z-.0015>texture2D(uSM,sp.xy).r)c*=vec3(.7,.64,.8);}
    vec2 q=floor(P*13.);float s=h(q);if(s>.95&&fract(s*7.3+uT*.0007)<.14)c=mix(c,vec3(1.,.93,1.),.7);
    c=mix(c,uDimC,uDim*.55);gl_FragColor=vec4(c,1.);}`}));m.position.set(0,FY,-1.9);m.userData.noCast=1;STG3.add(m);}
  // 機台下面一層一層往上堆高的圓台（11/08 D「下方舞台做一層一層高的那種感覺」）：最上面一層＝原本的粉紅圓台，往下每層大一圈；邊緣一圈整齊的小燈泡＋金邊
  {const T1=toon('#f290a8','#c8648a','#7d3a63',{rim:'#ffd4dc',rimA:.4}),T2=toon('#c27fb8','#9a5f9e','#5e3b82',{rim:'#d4c6ff',rimA:.4}),BU=toon('#fff3c2','#ffe27a','#ffd25e',{noDim:true});BU.uniforms.uEmis.value.setRGB(.4,.3,.12);
    for(const [r,y0,mat] of[[4.75,-.79,T1],[5.7,-1.24,T2]]){T3(new THREE.CylinderGeometry(r,r+.06,.45,96),mat,[0,y0+.225,0]);T3(new THREE.TorusGeometry(r+.005,.035,6,120),SM.gold,[0,y0+.45,0],[Math.PI/2,0,0],[1,1,1],false);
      const B=[],n=Math.round(r*10);for(let k=0;k<n;k++){const a=k/n*6.283;B.push([Math.cos(a)*(r+.05),y0+.2,Math.sin(a)*(r+.05),1]);}inst(new THREE.SphereGeometry(.055,8,6),BU,B).userData.noCast=1;}}
  // LED 大螢幕（後面一整面）：一顆顆 LED；放射光慢慢轉＋光環往外推、下面等化器跳動、兩側貓掌跟著節拍、星星閃
  {const SW=11.8,SH=5.0,sz=-8.0,sy=FY+.25+SH/2;T3(new THREE.BoxGeometry(SW+.5,SH+.45,.4),SM.spk,[0,sy,sz-.25]);
    const g=new THREE.PlaneGeometry(SW,SH),m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uT:CU.uT},vertexShader:FX_V,fragmentShader:`uniform float uDim,uT;uniform vec3 uDimC;varying vec2 vUv;${H1}
      float paw(vec2 q){float k=step(length((q-vec2(0.,-.22))*vec2(1.,1.3)),.44);for(int i=0;i<4;i++){float a=-.85+float(i)*.57;k=max(k,step(length(q-vec2(sin(a)*.62,.22+cos(a)*.38)),.17));}return k;}
      void main(){vec2 uv=vUv*vec2(${SW.toFixed(1)},${SH.toFixed(1)});float L=.125;vec2 cell=floor(uv/L),f=fract(uv/L),c0=(cell+.5)*L;float t=uT*.001;
      vec2 p=c0-vec2(${(SW/2).toFixed(2)},3.);float r=length(p),a=atan(p.y,p.x);
      vec3 col=mix(vec3(.24,.14,.36),vec3(.6,.26,.55),smoothstep(0.,5.,c0.y));   // 11/08 D：特效不要全關 → 圖案都留著，但放淡、放慢
      col=mix(col,vec3(.95,.6,.85),step(.82,fract((a+t*.15)/.3927))*.28);col=mix(col,vec3(.83,.78,1.),step(.88,fract(r*.42-t*.4))*.35);
      float bt=pow(abs(sin(t*2.)),6.);for(int k=0;k<2;k++){vec2 pc=vec2(k==0?1.9:${(SW-1.9).toFixed(2)},3.1);vec2 q=(c0-pc)/(1.75+.12*bt);if(paw(q)>.5)col=mix(col,vec3(1.,.9,.96),.75);}
      float bx=floor(c0.x/.51),hg=.3+1.1*abs(sin(bx*1.7+t*2.))*abs(sin(bx*.63+t*.9+1.));if(c0.y<hg)col=mix(col,mix(vec3(.55,.85,1.),vec3(1.,.55,.8),c0.y/1.4),.5);
      float s=h(cell);if(s>.985&&fract(s*13.+t*.5)<.3)col=mix(col,vec3(1.),.8);
      float gp=step(.2,f.x)*step(.2,f.y);col*=mix(.86,1.,gp);
      col=mix(col,uDimC,uDim*.35);gl_FragColor=vec4(col,1.);}`}));m.position.set(0,sy,sz);m.userData.noCast=1;STG3.add(m);}
  // 鋁桁架：四根柱子＋上面一圈橫桁架（四根主管＋之字斜撐，用一個 InstancedMesh 畫完）
  const RODG=new THREE.CylinderGeometry(1,1,1,6),RODS=[];
  function truss(a,b,sz=.44){const d=V3().subVectors(b,a),len=d.length(),u=d.clone().normalize(),t1=Math.abs(u.y)>.9?V3(1,0,0):V3(0,1,0);
    const e1=V3().crossVectors(u,t1).normalize().multiplyScalar(sz/2),e2=V3().crossVectors(u,e1).normalize().multiplyScalar(sz/2),C4=[e1.clone().add(e2),e1.clone().sub(e2),e1.clone().negate().sub(e2),e1.clone().negate().add(e2)];
    for(const c of C4)RODS.push([a.clone().add(c),b.clone().add(c),.035]);const n=Math.max(1,Math.round(len/sz));
    for(let i=0;i<n;i++){const p0=a.clone().addScaledVector(d,i/n),p1=a.clone().addScaledVector(d,(i+1)/n);for(let f=0;f<4;f++){const c0=C4[f],c1=C4[(f+1)%4];RODS.push([p0.clone().add(i%2?c0:c1),p1.clone().add(i%2?c1:c0),.018]);}}}
  const TX=7.0,TZ0=-7.6,TZ1=-2.0,TY=5.15;
  for(const x of[-TX,TX])for(const z of[TZ0,TZ1]){truss(V3(x,FY,z),V3(x,TY+.22,z));T3(new THREE.BoxGeometry(.8,.12,.8),SM.spk,[x,FY+.06,z]);}
  truss(V3(-TX,TY,TZ1),V3(TX,TY,TZ1));truss(V3(-TX,TY,TZ0),V3(TX,TY,TZ0));for(const x of[-TX,TX])truss(V3(x,TY,TZ0),V3(x,TY,TZ1));
  {const m=new THREE.InstancedMesh(RODG,SM.truss,RODS.length),o=new THREE.Object3D(),Y=V3(0,1,0);RODS.forEach(([a,b,r],k)=>{const d=V3().subVectors(b,a),len=d.length();o.position.copy(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(Y,d.normalize());o.scale.set(r,len,r);o.updateMatrix();m.setMatrixAt(k,o.matrix);});m.frustumCulled=false;STG3.add(m);}
  // 搖頭燈：吊在前面的橫桁架下，光束是加亮的半透明圓錐（會掃動，打到地板變成光圈）
  const BL=9.5,BG=new THREE.ConeGeometry(1.15,BL,24,1,true);BG.translate(0,-BL/2,0);
  const BEAMV=`varying float vT;varying vec3 vN,vW;void main(){vT=-position.y/${BL.toFixed(1)};vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
  const BEAMF=`uniform vec3 uC;uniform float uI,uDim;varying float vT;varying vec3 vN,vW;void main(){vec3 V=normalize(cameraPosition-vW);float fr=abs(dot(normalize(vN),V));float a=pow(1.-vT,1.2)*(.3+.7*pow(fr,2.))*uI*(1.-uDim*.55);gl_FragColor=vec4(uC,a);}`;
  ['#d4c6ff','#ff8fd0','#d4c6ff','#d4c6ff','#ff8fd0','#d4c6ff'].forEach((col,i)=>{const on=i>0&&i<5;const x=-5.5+i*2.2,hd=new THREE.Group();hd.position.set(x,TY-.32,TZ1);STG3.add(hd);
    mk(new THREE.BoxGeometry(.5,.08,.16),SM.head,hd,[0,.12,0]);for(const sd of[-1,1])mk(new THREE.BoxGeometry(.06,.34,.14),SM.head,hd,[sd*.23,-.04,0],[0,0,0],[1,1,1],false);
    const body=new THREE.Group();body.position.y=-.12;hd.add(body);mk(new THREE.CylinderGeometry(.17,.21,.42,10),SM.head,body,[0,-.08,0]);mk(new THREE.CircleGeometry(.15,12),SM.lens,body,[0,-.3,0],[Math.PI/2,0,0],[1,1,1],false);
    const beam=new THREE.Mesh(BG,addB(new THREE.ShaderMaterial({uniforms:{uC:{value:C(col)},uI:{value:.42},uDim:GU.uDim},vertexShader:BEAMV,fragmentShader:BEAMF,transparent:true,depthWrite:false,side:THREE.FrontSide})));
    beam.position.y=-.3;beam.userData.noCast=1;beam.visible=on;body.add(beam);HEADS.push({body,beam,col:C(col),ph:i*1.13,on});});
  {const hd=new THREE.Group();hd.position.set(0,TY-.32,TZ1);STG3.add(hd);mk(new THREE.BoxGeometry(.5,.08,.16),SM.head,hd,[0,.12,0]);mk(new THREE.CylinderGeometry(.2,.26,.46,12),SM.head,hd,[0,-.12,.06],[-.45,0,0]);mk(new THREE.CircleGeometry(.18,14),SM.lens,hd,[0,-.3,.2],[Math.PI/2-.45,0,0],[1,1,1],false);}
  {const L=7.2,g=new THREE.ConeGeometry(1.75,L,32,1,true);g.translate(0,-L/2,0);const m=new THREE.Mesh(g,addB(new THREE.ShaderMaterial({uniforms:{uC:{value:C('#fff3e6')},uI:{value:.24},uDim:GU.uDim},vertexShader:BEAMV.replace('/'+BL.toFixed(1)+';','/7.2;'),fragmentShader:BEAMF,transparent:true,depthWrite:false})));
    m.position.set(0,TY-.42,TZ1+.12);m.quaternion.setFromUnitVectors(V3(0,-1,0),V3(0,-.6,.2).sub(m.position).normalize());m.userData.noCast=1;STG3.add(m);   // 聚光：只照扭蛋機
    const pg=new THREE.CircleGeometry(2.1,48);pg.rotateX(-Math.PI/2);const pm=new THREE.Mesh(pg,addB(new THREE.ShaderMaterial({uniforms:{uI:{value:.32},uDim:GU.uDim},vertexShader:FX_V,fragmentShader:`uniform float uI,uDim;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float a=(r<.55?1.:(r<.8?.55:(r<1.?.22:0.)))*uI*(1.-uDim*.6);gl_FragColor=vec4(vec3(1.,.95,.9),a);}`,transparent:true,depthWrite:false})));
    pm.position.set(0,.012,.1);pm.userData.noCast=1;STG3.add(pm);}
  // 兩側大音響（三個疊起來，正面兩顆喇叭）＋地上監聽喇叭（斜面朝機台）
  for(const sd of[-1,1]){const x=sd*5.95,z=-6.4;for(let k=0;k<3;k++){const y=FY+.43+k*.87;T3(new THREE.BoxGeometry(1.05,.84,.8),SM.spk,[x,y,z],[0,-sd*.18,0]);
      for(const dy of[-.18,.2]){const w=k===2?.13:.24;T3(new THREE.CylinderGeometry(w,w,.05,16),SM.spkF,[x+sd*Math.sin(.18)*.4,y+dy*(k===2?.5:1),z+.41],[Math.PI/2,0,-sd*.18*0],[1,1,1],false);T3(new THREE.CylinderGeometry(w*.42,w*.42,.07,10),SM.cone,[x+sd*Math.sin(.18)*.4,y+dy*(k===2?.5:1),z+.42],[Math.PI/2,0,0],[1,1,1],false);}}}
  // 地上監聽喇叭拿掉（會卡進下層圓台）
  // 柱子內側的 LED 燈條：顏色一段一段往上跑
  {const mat=new THREE.ShaderMaterial({uniforms:{uT:CU.uT,uDim:GU.uDim},vertexShader:VOL_V,fragmentShader:`uniform float uT,uDim;varying vec3 vW;void main(){float m=mod(floor(vW.y*2.-uT*.0015+(vW.x>0.?1.:0.)),2.);vec3 c=m<1.?vec3(1.,.56,.82):vec3(.75,.65,1.);gl_FragColor=vec4(c*.85*(1.-uDim*.4),1.);}`});
    for(const sd of[-1,1])for(const z of[TZ0,TZ1]){const m=new THREE.Mesh(new THREE.BoxGeometry(.09,TY-FY-.3,.09),mat);m.position.set(sd*(TX-.3),(TY+FY)/2-.1,z+(z===TZ1?-.0:.3));STG3.add(m);}}
  // 星星燈簾（螢幕兩旁）、空中亮片閃光、慢慢飄的彩紙：都用像素點畫
  {const P=[],A=[];for(const sd of[-1,1])for(let x=6.0;x<=6.85;x+=.2)for(let y=FY+.3;y<TY-.2;y+=.3){P.push(sd*x,y+(R3()-.5)*.08,TZ0+.35);A.push(R3()*6.28,.6+R3()*1.4);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aS',new THREE.Float32BufferAttribute(A,2));
    STG3.add(new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{uT:CU.uT,uDim:GU.uDim},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
      vertexShader:`attribute vec2 aS;uniform float uT;varying float vA;void main(){vA=.25+.75*max(0.,sin(uT*.0025*aS.y+aS.x));gl_PointSize=2.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uDim;varying float vA;void main(){gl_FragColor=vec4(vec3(1.,.9,.8)*vA*.8*(1.-uDim*.5),1.);}`})));}
  {const P=[],A=[];for(let k=0;k<24;k++){const sd=k%2?1:-1;P.push(sd*(2.6+R3()*4),FY+1.5+R3()*4.5,-7+R3()*6);A.push(R3()*6.28,.45+R3()*.5);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aS',new THREE.Float32BufferAttribute(A,2));
    STG3.add(new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{uT:CU.uT,uDim:GU.uDim},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
      vertexShader:`attribute vec2 aS;uniform float uT;varying float vA;void main(){vA=max(0.,sin(uT*.002*aS.y+aS.x));gl_PointSize=floor(3.+6.*vA);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uDim;varying float vA;void main(){vec2 q=abs(gl_PointCoord-.5)*2.;float k=step(min(q.x,q.y),.18)*step(max(q.x,q.y),1.-.4*(1.-vA));if(k<.5||vA<.05)discard;gl_FragColor=vec4(vec3(1.,.95,1.)*(1.-uDim*.5),1.);}`})));}
  {const P=[],A=[],CL=[];const pal=[[1,.56,.82],[1,.89,.48],[.56,.78,1],[.83,.78,1],[1,1,1]];for(let k=0;k<55;k++){P.push((R3()-.5)*13,R3()*6,-6.5+R3()*9);A.push(R3()*6.28,.18+R3()*.3);CL.push(...pal[k%5]);}   // 彩紙：適量、慢慢飄
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aS',new THREE.Float32BufferAttribute(A,2));g.setAttribute('aC',new THREE.Float32BufferAttribute(CL,3));
    const pts=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{uT:CU.uT,uDim:GU.uDim,uDimC:GU.uDimC},vertexShader:`attribute vec2 aS;attribute vec3 aC;uniform float uT;varying vec3 vC;void main(){vC=aC;vec3 p=position;float t=uT*.001;
      p.y=-.34+mod(p.y-t*aS.y,6.);p.x+=sin(t*1.1+aS.x)*.25;gl_PointSize=2.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`uniform float uDim;uniform vec3 uDimC;varying vec3 vC;void main(){gl_FragColor=vec4(mix(vC,uDimC,uDim*.6),1.);}`}));pts.frustumCulled=false;STG3.add(pts);}
BUILD=TAV3;}
// 每格更新：搖頭燈擺動、光束打到地板的光圈位置、所有會動的東西的時間
const _q=new THREE.Quaternion(),_v=V3(0,0,0),_d=V3(0,0,0);
const _tg=V3(0,0,0),_bp=V3(0,0,0),_dn=V3(0,-1,0);
function stageFX(t){CU.uT.value=t;HEADS.forEach((H,i)=>{if(H.on){H.body.parent.updateMatrixWorld(true);H.body.parent.getWorldPosition(_bp);_bp.y-=.12;   // 光束只打扭蛋機：對準機身，小幅晃
    _tg.set(Math.sin(t*.0007+H.ph)*.35,1.5+Math.sin(t*.0009+H.ph*2.)*.4,Math.cos(t*.0006+H.ph)*.25);const dl=_tg.sub(_bp).length();H.body.quaternion.setFromUnitVectors(_dn,_tg.normalize());H.beam.scale.set(1,(dl+.6)/9.5,1);}   // 光束長度剛好到機台就淡掉，不會把機台洗白else H.body.rotation.set(0,0,0);H.body.updateMatrixWorld(true);
  H.body.getWorldQuaternion(_q);H.body.getWorldPosition(_v);_d.set(0,-1,0).applyQuaternion(_q);const k=(STG_FY-_v.y)/Math.min(-.05,_d.y);
  SPOT.uSpP.value[i].copy(_v).addScaledVector(_d,k);SPOT.uSpC.value[i].setRGB(0,0,0);});}

// ---------- 卡池主題（D 11/08：分人魚、森林卡池，「整個場景跟著卡池換」：海洋舞台＋海洋扭蛋機＋貝殼小屋／森林舞台＋森林扭蛋機＋森林小屋；
// 原本的演唱會舞台＋酒館小屋＝通用）----------
// 小屋：照酒館小屋的結構（門的位置、大小都一樣，扭蛋才滾得進去）整棟複製，換材質顏色、換屋瓦形狀，再加各主題自己的裝飾跟環境。
const POOLS={sea:{name:'人魚卡池',sub:'海底人魚屋',sets:['mermaid'],fx:[['泡泡藍調',1,'fx/mermaid_1.jpg','整間染上海底的藍，房間裡飄著泡泡'],['深海天光',2,'fx/mermaid_2.jpg','海面的光斜斜照進來，地上一圈晃動的水波光']]},
  forest:{name:'森林卡池',sub:'森林精靈小屋',sets:['forest'],fx:[['螢火綠光',1,'fx/forest_1.jpg','整間染上森林的綠，螢火蟲在房間裡飛'],['林間葉影',2,'fx/forest_2.jpg','陽光穿過樹葉，地上一片會晃動的葉影']]},gen:{name:'通用',sub:'酒館日常＋萬用（常駐系列）',sets:['daily','basic']}};   // D 11/08：「日常跟萬用系列就是通用裡的，他們兩個是常駐系列」
// ---------- 限定卡池檔期（D 11/08「要幫現在的兩個限定小屋卡池加時效，之後統一為兩周一輪替」「更新點為周一的凌晨 4:00」）----------
// 每期 14 天：台灣時間星期一 04:00 開始，兩週後的星期一 04:00 結束；不在檔期內的限定卡池不能抽（正式版主機 gacha-pools.json 的 schedule 也會擋）。
// 通用（日常＋萬用）是常駐，不在檔期表裡。D 11/08：兩池「同時上架」。試做頁 ?now=2026-11-22T20:00 看某個時間點。
// 正式版以主機為準：大廳 lobby-ui/gacha.js 開視窗前先讀 /api/gacha-info 的 schedule 交給 HOST.schedule()；讀不到才用下面這份（要跟 server/gacha-pools.json 一致）。
const DAY=864e5,PERIOD=14*DAY;
const SCHED0=[['sea','2026-11-09'],['forest','2026-11-09']];   // 第一期：11/09（一）04:00 ～ 11/23（一）04:00
const SCHED=((LIVE&&HOST.schedule&&HOST.schedule())||SCHED0.map(([pool,d])=>({pool,start:d+'T04:00:00+08:00'})))
  .map(x=>{const t=Date.parse(x.start);return {pool:x.pool,start:t,end:t+(x.days||14)*DAY};}).filter(x=>!isNaN(x.start));
const NOW0=!LIVE&&Q.get('now')?Date.parse(Q.get('now')+(Q.get('now').length<=10?'T12:00:00':'')+'+08:00')-Date.now():0;
const nowMs=()=>Date.now()+(NOW0||0);
function poolState(k){const L=SCHED.filter(x=>x.pool===k);if(!L.length)return {open:true,perm:true};const t=nowMs();
  const cur=L.find(x=>t>=x.start&&t<x.end);if(cur)return {open:true,start:cur.start,end:cur.end,left:cur.end-t};
  const nx=L.filter(x=>x.start>t).sort((a,b)=>a.start-b.start)[0];if(nx)return {open:false,soon:true,start:nx.start,end:nx.end};
  return {open:false,ended:true,end:Math.max(...L.map(x=>x.end))};}
const tw=t=>{const d=new Date(t+8*3600e3);return {M:d.getUTCMonth()+1,D:d.getUTCDate(),W:'日一二三四五六'[d.getUTCDay()],h:String(d.getUTCHours()).padStart(2,'0'),m:String(d.getUTCMinutes()).padStart(2,'0')};};
const twDate=t=>{const x=tw(t);return x.M+'/'+x.D+'（'+x.W+'）'+x.h+':'+x.m;},twDay=t=>{const x=tw(t);return x.M+'/'+x.D+'（'+x.W+'）';};
const leftTxt=ms=>ms>=DAY?'剩 '+Math.floor(ms/DAY)+' 天':ms>=3600e3?'剩 '+Math.floor(ms/3600e3)+' 小時':'剩 '+Math.max(1,Math.ceil(ms/60e3))+' 分鐘';
const tabTxt=st=>st.perm?'常駐':st.open?leftTxt(st.left):st.soon?twDay(st.start)+'登場':'已結束';
const firstOpen=()=>Object.keys(POOLS).find(k=>poolState(k).open)||'gen';
let THEME=POOLS[Q.get('pool')]?Q.get('pool'):'sea';if(!poolState(THEME).open&&!Q.get('pool'))THEME=firstOpen();   // 預設的卡池不在檔期內就換一個開著的
const poolItems=()=>ITEMS.filter(i=>POOLS[THEME].sets.includes(i.set||ROOMD?.items?.[i.k]?.set));
const STG_S=new THREE.Group(),STG_F=new THREE.Group(),TAV_S=new THREE.Group(),TAV_F=new THREE.Group();for(const G of[STG_S,STG_F,TAV_S,TAV_F]){G.visible=false;world.add(G);}
const STAGES={gen:STG3,sea:STG_S,forest:STG_F},HOUSES={gen:TAV3,sea:TAV_S,forest:TAV_F};
const curStage=()=>STAGES[THEME],curHouse=()=>HOUSES[THEME];
const KELP=[],FISH=[],JELLY=[],SHAFT=[];
const SEA={coral:[toon('#ffb3c0','#f290a8','#c8648a'),toon('#ffc58f','#e39a5c','#b8692a'),toon('#d4c6ff','#b8a2ff','#7a64c8'),toon('#ffe27a','#f2b53e','#b8692a'),toon('#e6fff3','#bff0da','#8fd9bb')],
  kelp:toon('#8fd9bb','#5fae9a','#3f7f78',{side:DS}),kelpD:toon('#5fae9a','#3f7f78','#2f1d4a',{side:DS}),rock:toon('#9a86e6','#7a64c8','#5a48a0'),rockD:toon('#7a64c8','#5a48a0','#3b2559'),
  shell:toon('#fff6ec','#ffd4dc','#e27d9c',{side:DS}),shell2:toon('#ffeef2','#f4b8cf','#d98fb6',{side:DS}),shellLine:toon('#f4b8cf','#f290a8','#e27d9c'),star:toon('#ffc58f','#e39a5c','#b8692a'),pearl:toon('#ffffff','#ebe4ff','#b8a2ff',{noDim:true}),
  fish:[toon('#ffd25e','#f2b53e','#b8692a',{side:DS}),toon('#f290a8','#c8648a','#7d3a63',{side:DS}),toon('#8ec8ff','#5b6fd6','#5a48a0',{side:DS}),toon('#bff0da','#8fd9bb','#5fae9a',{side:DS})],
  jelly:toon('#ffd4dc','#f4b8cf','#d98fb6',{noDim:true}),jelly2:toon('#ebe4ff','#d4c6ff','#b8a2ff',{noDim:true}),gold:toon('#ffe27a','#f2b53e','#b8692a'),wood:toon('#c99a8e','#9a8499','#5c4a63'),
  sand:toon('#fff1e3','#fbe1cf','#f3d3c4')};
SEA.pearl.uniforms.uEmis.value.setRGB(.25,.22,.3);SEA.jelly.uniforms.uEmis.value.setRGB(.35,.15,.25);SEA.jelly2.uniforms.uEmis.value.setRGB(.25,.2,.4);
const FOR={moss:toon('#9cb35e','#7a9450','#56703f'),leaf:toon('#9cb35e','#7a9450','#5c4a63'),leafD:toon('#7a9450','#56703f','#3b2559'),trunk:toon('#b8907e','#8a4b22','#5a3438'),bark:toon('#8a4b22','#5a3438','#3a2622'),
  cap:toon('#f290a8','#c8648a','#7d3a63'),capO:toon('#ffc58f','#e39a5c','#b8692a'),stem:toon('#fff6ec','#fbe1cf','#d9c4cc'),dot:toon('#ffffff','#fff6ec','#fbe1cf'),
  glow:toon('#e6fff3','#bff0da','#8fd9bb',{noDim:true}),glow2:toon('#ebe4ff','#d4c6ff','#b8a2ff',{noDim:true}),lamp:toon('#fff3c2','#ffe27a','#ffd25e',{noDim:true}),
  flP:toon('#ffd4dc','#f290a8','#c8648a'),flY:toon('#fff3c2','#ffd25e','#d9952f'),flW:toon('#ffffff','#fff6ec','#d9c4cc'),flV:toon('#d4c6ff','#b8a2ff','#7a64c8'),
  wood:toon('#e39a5c','#b8692a','#8a4b22'),fern:toon('#7a9450','#56703f','#3b2559',{side:DS}),rock:toon('#bba3b2','#9a8499','#5c4a63')};
FOR.glow.uniforms.uEmis.value.setRGB(.25,.4,.35);FOR.glow2.uniforms.uEmis.value.setRGB(.3,.25,.45);FOR.lamp.uniforms.uEmis.value.setRGB(.5,.4,.15);
const FORT={trunk:FOR.trunk,leaf:FOR.leaf,leafD:FOR.leafD};

// ---- 共用小零件 ----
const STARG=(()=>{const pts=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.085:.22;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}const g=new THREE.ExtrudeGeometry(shapeOf(pts),{depth:.05,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1});g.center();return g;})();
function fanG(R,n,depth=.06){const pts=[[0,0]];for(let i=0;i<=n*4;i++){const a=Math.PI*i/(n*4),r=R*(1-.07*Math.abs(Math.sin(a*n)));pts.push([Math.cos(a)*r,Math.sin(a)*r]);}const g=new THREE.ExtrudeGeometry(shapeOf(pts),{depth,bevelEnabled:false});g.translate(0,0,-depth/2);return g;}
// 扇貝（11/08 D「貝殼做的好爛」：原本是幾片平的扇形拼起來，像紙扇）→ 真的扇貝：一條條隆起的放射肋（有亮面暗面）、邊緣跟著肋起伏成波浪、
// 整片往前鼓、幾圈生長紋、底部鉸鏈兩側的小耳朵
function scallopG(R,n){const NU=24,NV=n*10,P=[],I=[];
  const at=(u,v)=>{const t=Math.PI*(.05+.9*v),rb=.5+.5*Math.cos(v*n*Math.PI*2),r=R*(.07+.93*u)*(1+.05*rb*u),z=R*(.19*Math.max(0,1-Math.pow((u-.32)/.78,2))+.06*rb*u);return[Math.cos(t)*r,Math.sin(t)*r,z];};
  for(let i=0;i<=NU;i++)for(let j=0;j<=NV;j++)P.push(...at(i/NU,j/NV));
  for(let i=0;i<NU;i++)for(let j=0;j<NV;j++){const a=i*(NV+1)+j,b=a+NV+1;I.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();g.userData.at=at;return g;}
function scallop(x,y,z,R,rot=[0,0,0],m1=SEA.shell,m2=SEA.shellLine){const G=new THREE.Group();G.position.set(x,y,z);G.rotation.set(...rot);BUILD.add(G);const n=R>2?13:9,g=scallopG(R,n);
  mk(g,m1,G,[0,0,0]);
  for(const u of[.5,.78]){const pts=[];for(let j=0;j<=n*6;j++){const q=g.userData.at(u,j/(n*6));pts.push(V3(q[0],q[1],q[2]+R*.012));}mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),n*8,R*.006,4,false),m2,G,[0,0,0],[0,0,0],[1,1,1],false);}
  for(const sd of[-1,1])mk(new THREE.BoxGeometry(R*.3,R*.15,R*.07),m1,G,[sd*R*.2,R*.03,R*.07],[0,0,-sd*.2]);
  G.userData.at=g.userData.at;return G;}
function starfish(x,y,z,s,rot=[-Math.PI/2,0,0],m=SEA.star){return mk(STARG,m,BUILD,[x,y,z],rot,[s,s,s*.8]);}
function coral(x,z,s,mat,y0=0){const G=new THREE.Group();G.position.set(x,y0,z);G.scale.setScalar(s);BUILD.add(G);
  const br=(p,dir,len,r,d)=>{const e=p.clone().addScaledVector(dir,len),m=mk(new THREE.CylinderGeometry(r*.72,r,len,6),mat,G,[(p.x+e.x)/2,(p.y+e.y)/2,(p.z+e.z)/2],[0,0,0],[1,1,1],false);m.quaternion.setFromUnitVectors(V3(0,1,0),dir);
    if(d>0)for(let k=0;k<2;k++)br(e,dir.clone().add(V3((R3()-.5)*1.2,.4,(R3()-.5)*1.2)).normalize(),len*.74,r*.72,d-1);else mk(new THREE.SphereGeometry(r*1.35,6,5),mat,G,[e.x,e.y,e.z],[0,0,0],[1,1,1],false);};
  for(let k=0;k<3;k++)br(V3(0,0,0),V3((R3()-.5)*.9,1,(R3()-.5)*.9).normalize(),.45,.075,2);return G;}
function kelp(x,z,h,mat,y0=0){const G=new THREE.Group();G.position.set(x,y0,z);G.rotation.y=R3()*3;BUILD.add(G);
  for(let s=0;s<3;s++){const g=new THREE.PlaneGeometry(.3,h*(.75+R3()*.35),1,16),hh=g.parameters.height;g.translate(0,hh/2,0);const pa=g.attributes.position,ph=R3()*6;
    for(let i=0;i<pa.count;i++){const y=pa.getY(i),u=y/hh;pa.setX(i,pa.getX(i)*(1-u*.45)+Math.sin(y*1.7+ph)*.22*u);pa.setZ(i,Math.cos(y*1.3+ph)*.12*u);}g.computeVertexNormals();
    mk(g,s%2?SEA.kelpD:mat,G,[(s-1)*.18,0,(R3()-.5)*.2],[0,s*1.1,0],[1,1,1],false);}
  KELP.push({G,ph:R3()*6});return G;}
function clam(x,y,z,s,ry=0){const G=new THREE.Group();G.position.set(x,y,z);G.rotation.y=ry;G.scale.setScalar(s);BUILD.add(G);
  mk(new THREE.SphereGeometry(.5,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2),SEA.shell2,G,[0,.2,0],[0,0,0],[1,.55,1]);const top=new THREE.Group();top.position.set(0,.2,-.42);top.rotation.x=-.75;G.add(top);
  mk(new THREE.SphereGeometry(.5,16,8,0,Math.PI*2,0,Math.PI/2),SEA.shell,top,[0,0,.42],[0,0,0],[1,.5,1]);mk(new THREE.SphereGeometry(.17,14,10),SEA.pearl,G,[0,.26,.05]);return G;}
function bubbles(n,x0,x1,y0,y1,z0,z1,G){const P=[],A=[];for(let k=0;k<n;k++){P.push(x0+R3()*(x1-x0),y0+R3()*(y1-y0),z0+R3()*(z1-z0));A.push(R3()*6.28,.25+R3()*.5);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aS',new THREE.Float32BufferAttribute(A,2));
  const pts=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{uT:CU.uT,uDim:GU.uDim},transparent:true,depthWrite:false,vertexShader:`attribute vec2 aS;uniform float uT;varying float vA;void main(){vec3 p=position;float t=uT*.001;
    p.y=mod(p.y-(${y0.toFixed(2)})+t*aS.y,${(y1-y0).toFixed(2)})+(${y0.toFixed(2)});p.x+=sin(t*1.7+aS.x)*.12;vA=1.;gl_PointSize=floor(2.+aS.y*3.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float uDim;void main(){vec2 q=gl_PointCoord-.5;float r=length(q);if(r>.5)discard;vec3 c=r>.32?vec3(.824,.941,1.):vec3(.557,.784,1.);if(length(q-vec2(-.15,-.15))<.12)c=vec3(1.);gl_FragColor=vec4(c*(1.-uDim*.5),1.);}`}));
  pts.frustumCulled=false;G.add(pts);return pts;}
function fishSchool(G,cx,cy,cz,R,n,col,sp,dir=1){const S=new THREE.Group();G.add(S);const body=new THREE.SphereGeometry(.13,10,8),tail=new THREE.ConeGeometry(.09,.16,4);
  for(let i=0;i<n;i++){const f=new THREE.Group();mk(body,col,f,[0,0,0],[0,0,0],[1.7,1,.6],false);mk(tail,col,f,[-.27,0,0],[0,0,Math.PI/2],[1,1,.35],false);mk(new THREE.SphereGeometry(.025,6,4),MC.dark,f,[.13,.035,.06],[0,0,0],[1,1,1],false);
    S.add(f);FISH.push({f,cx,cy,cz,R,a0:i/n*.9+R3()*.2,dy:(R3()-.5)*.5,dr:(R3()-.5)*.6,sp,dir});}return S;}
function jelly(G,x,y,z,s,mat){const J=new THREE.Group();J.position.set(x,y,z);J.scale.setScalar(s);G.add(J);mk(new THREE.SphereGeometry(.45,16,8,0,Math.PI*2,0,Math.PI/2),mat,J,[0,0,0],[0,0,0],[1,.8,1]);
  mk(new THREE.CylinderGeometry(.46,.4,.06,16,1,true),mat,J,[0,-.02,0],[0,0,0],[1,1,1],false);
  for(let k=0;k<6;k++){const a=k/6*6.283,pts=[];for(let i=0;i<8;i++)pts.push(V3(Math.cos(a)*.26+Math.sin(i*.9+k)*.05,-i*.15,Math.sin(a)*.26));mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.022,4,false),mat,J,[0,0,0],[0,0,0],[1,1,1],false);}
  JELLY.push({J,y,ph:R3()*6});J.traverse(o=>{o.userData.noCast=1;});return J;}
const SHAFT_F=`uniform vec3 uC;uniform float uI,uDim;varying vec2 vUv;void main(){float w=1.-abs(vUv.x*2.-1.);float a=pow(w,1.5)*vUv.y*uI*(1.-uDim*.6);gl_FragColor=vec4(uC,a);}`;
function shafts(G,n,x0,x1,z0,z1,col,I=.16){for(let k=0;k<n;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.1+R3()*.8,16),addB(new THREE.ShaderMaterial({uniforms:{uC:{value:C(col)},uI:{value:I*(.6+R3()*.6)},uDim:GU.uDim},vertexShader:FX_V,fragmentShader:SHAFT_F,transparent:true,depthWrite:false,side:DS})));
  m.position.set(x0+R3()*(x1-x0),6,z0+R3()*(z1-z0));m.rotation.set(0,(R3()-.5)*.6,.22+(R3()-.5)*.15);m.userData.noCast=1;G.add(m);SHAFT.push({m,ph:R3()*6,r0:m.rotation.z});}}
// 水底的天空：越往上越亮（水面波光）、一道道斜射的光；遠處是藍色的水
function seaDome(G){const m=new THREE.Mesh(new THREE.SphereGeometry(88,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uT:CU.uT},vertexShader:VOL_V,fragmentShader:`uniform float uDim,uT;uniform vec3 uDimC;varying vec3 vW;
  void main(){vec3 d=normalize(vW-cameraPosition);float el=degrees(asin(d.y)),az=degrees(atan(d.x,-d.z));
  float b=el<3.?0.:(el<10.?1.:(el<20.?2.:(el<32.?3.:4.)));   // 11/08 D「很亂」：只用色盤裡的純色，不混色（混出來的中間色會變成一格一格的抖動雜點）
  if(el>4.&&step(.86,fract(az*.04+sin(el*.06+uT*.00025)*.25))>.5)b=min(4.,b+1.);
  vec3 c=b<.5?vec3(.353,.282,.627):(b<1.5?vec3(.357,.435,.839):(b<2.5?vec3(.557,.784,1.):(b<3.5?vec3(.824,.941,1.):vec3(.902,1.,.953))));
  if(el>32.&&step(.8,fract(az*.09+sin(az*.25+uT*.0012)*.6+el*.15))>.5)c=vec3(1.);
  c=mix(c,uDimC,uDim*.7);gl_FragColor=vec4(c,1.);}`}));m.userData.noCast=1;G.add(m);}
// 沙地：沙紋＋會流動的水波光紋（Voronoi 邊）；遠處融進藍色的水
function sandFloor(G,y,cz){const g=new THREE.PlaneGeometry(220,220);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uT:CU.uT,uSM:GU.uSM,uSMM:GU.uSMM,uSMOn:GU.uSMOn},vertexShader:VOL_V,fragmentShader:`uniform float uDim,uT,uSMOn;uniform vec3 uDimC;uniform sampler2D uSM;uniform mat4 uSMM;varying vec3 vW;
  vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
  void main(){vec2 P=vW.xz;float rp=sin(P.x*1.7+P.y*.6+sin(P.y*.8)*1.5);vec3 c=rp>.55?vec3(1.,.945,.89):vec3(.984,.882,.812);if(rp<-.75)c=vec3(.953,.827,.769);
  vec2 q=P*1.05+vec2(uT*.00022,uT*.00016),i=floor(q),f=fract(q);float d1=9.,d2=9.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),o=h2(i+g);o=.5+.4*sin(uT*.0007+6.2831*o);vec2 r=g+o-f;float dd=dot(r,r);if(dd<d1){d2=d1;d1=dd;}else if(dd<d2)d2=dd;}
  if(sqrt(d2)-sqrt(d1)<.06)c=vec3(1.,.965,.925);
  if(uSMOn>.5){vec4 qq=uSMM*vec4(vW,1.);vec3 sp=qq.xyz*.5+.5;if(sp.x>0.&&sp.x<1.&&sp.y>0.&&sp.y<1.&&sp.z-.0015>texture2D(uSM,sp.xy).r)c*=vec3(.72,.74,.9);}
  float fd=length(P-vec2(0.,${cz.toFixed(2)}));if(fd>34.)c=vec3(.557,.784,1.);else if(fd>26.)c=vec3(.824,.941,1.);c=mix(c,uDimC,uDim*.6);gl_FragColor=vec4(c,1.);}`}));m.position.y=y;m.userData.noCast=1;G.add(m);}
// 森林的天空：樹冠縫隙透出的暮色＋星星
function forestDome(G){const m=new THREE.Mesh(new THREE.SphereGeometry(88,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uT:CU.uT},vertexShader:VOL_V,fragmentShader:`uniform float uDim,uT;uniform vec3 uDimC;varying vec3 vW;${H1}
  void main(){vec3 d=normalize(vW-cameraPosition);float el=degrees(asin(d.y)),az=degrees(atan(d.x,-d.z));
  vec3 c=el<2.?vec3(1.,.886,.761):(el<6.?vec3(1.,.773,.561):(el<12.?vec3(.949,.565,.659):(el<20.?vec3(.761,.498,.722):vec3(.604,.525,.902))));
  vec2 q=floor(vec2(az,el)*1.6);float s=h(q);if(el>12.&&s>.985&&fract(s*31.+uT*.0004)<.6)c=vec3(1.,.95,1.);
  c=mix(c,uDimC,uDim*.7);gl_FragColor=vec4(c,1.);}`}));m.userData.noCast=1;G.add(m);}
// 森林地面：青苔＋落葉＋小花點；遠處融進暮色
function forestFloor(G,y,cz){const g=new THREE.PlaneGeometry(220,220);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:{uDim:GU.uDim,uDimC:GU.uDimC,uSM:GU.uSM,uSMM:GU.uSMM,uSMOn:GU.uSMOn},vertexShader:VOL_V,fragmentShader:`uniform float uDim,uSMOn;uniform vec3 uDimC;uniform sampler2D uSM;uniform mat4 uSMM;varying vec3 vW;
  vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i).x,h2(i+vec2(1.,0.)).x,f.x),mix(h2(i+vec2(0.,1.)).x,h2(i+vec2(1.,1.)).x,f.x),f.y);}
  void main(){vec2 P=vW.xz;float n=vn(P*.35)*.65+vn(P*1.1+7.)*.35;vec3 c=n<.45?vec3(.337,.439,.247):vec3(.478,.58,.314);
  float g1=h2(floor(P*9.)).x;if(g1>.994)c=vec3(1.,.83,.86);else if(g1>.988)c=vec3(1.,.95,.75);
  if(vn(P*.6+3.)>.76&&h2(floor(P*7.)).y>.8)c=vec3(.894,.604,.361);
  if(uSMOn>.5){vec4 qq=uSMM*vec4(vW,1.);vec3 sp=qq.xyz*.5+.5;if(sp.x>0.&&sp.x<1.&&sp.y>0.&&sp.y<1.&&sp.z-.0015>texture2D(uSM,sp.xy).r)c*=vec3(.7,.66,.82);}
  if(length(P-vec2(0.,${cz.toFixed(2)}))>36.)c=vec3(.337,.439,.247);c=mix(c,uDimC,uDim*.6);gl_FragColor=vec4(c,1.);}`}));m.position.y=y;m.userData.noCast=1;G.add(m);}
function mushroom(x,y,z,s,cap=FOR.cap,dots=true){const G=new THREE.Group();G.position.set(x,y,z);G.scale.setScalar(s);BUILD.add(G);mk(new THREE.CylinderGeometry(.13,.17,.5,10),FOR.stem,G,[0,.25,0]);
  mk(new THREE.SphereGeometry(.42,18,10,0,Math.PI*2,0,Math.PI/2),cap,G,[0,.46,0],[0,0,0],[1,.62,1]);
  if(dots)for(let k=0;k<7;k++){const a=k/7*6.283+R3(),r=.22+R3()*.12;mk(new THREE.SphereGeometry(.055,8,6),FOR.dot,G,[Math.cos(a)*r,.46+.62*Math.sqrt(Math.max(0,.42*.42-r*r))-.01,Math.sin(a)*r],[0,0,0],[1,.5,1],false);}return G;}
function fern(x,y,z,s){const G=new THREE.Group();G.position.set(x,y,z);G.scale.setScalar(s);BUILD.add(G);const fg=new THREE.PlaneGeometry(.22,.9,1,6);fg.translate(0,.45,0);{const pa=fg.attributes.position;for(let i=0;i<pa.count;i++){const yy=pa.getY(i);pa.setX(i,pa.getX(i)*(1-yy/.9*.8));pa.setZ(i,yy*yy*.35);}fg.computeVertexNormals();}
  for(let k=0;k<9;k++)mk(fg,FOR.fern,G,[0,0,0],[-.35-R3()*.3,k/9*6.283,0],[1,.9+R3()*.4,1],false);return G;}
function points(G,n,x0,x1,y0,y1,z0,z1,vs,fs){const P=[],A=[];for(let k=0;k<n;k++){P.push(x0+R3()*(x1-x0),y0+R3()*(y1-y0),z0+R3()*(z1-z0));A.push(R3()*6.28,.4+R3()*.8);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aS',new THREE.Float32BufferAttribute(A,2));
  const p=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:{uT:CU.uT,uDim:GU.uDim},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:vs,fragmentShader:fs}));p.frustumCulled=false;G.add(p);return p;}
const FIREFLY_V=`attribute vec2 aS;uniform float uT;varying float vA;void main(){vec3 p=position;float t=uT*.001;p+=vec3(sin(t*.7*aS.y+aS.x),sin(t*.9+aS.x*2.)*.6,cos(t*.6*aS.y+aS.x))*.35;vA=max(0.,sin(t*1.8*aS.y+aS.x*3.));gl_PointSize=floor(2.+3.*vA);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const FIREFLY_F=`uniform float uDim;varying float vA;void main(){vec2 q=gl_PointCoord-.5;if(length(q)>.5||vA<.08)discard;gl_FragColor=vec4(vec3(.85,1.,.55)*vA*(1.-uDim*.5),1.);}`;
const LEAFFALL_V=`attribute vec2 aS;uniform float uT;varying float vK;void main(){vec3 p=position;float t=uT*.001;p.y=-.3+mod(p.y-t*.25*aS.y,7.);p.x+=sin(t*1.1+aS.x)*.5;vK=aS.x;gl_PointSize=3.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const LEAFFALL_F=`uniform float uDim;varying float vK;void main(){vec2 q=abs(gl_PointCoord-.5);if(q.x+q.y>.5)discard;vec3 c=fract(vK)<.5?vec3(.894,.604,.361):vec3(.612,.702,.369);gl_FragColor=vec4(c*(1.-uDim*.5),1.);}`;

// ---- 扭蛋機換主題：機身／蓋子／耳朵換色，加各主題的小配件 ----
const MTH={gen:{body:['#ffb3c0','#f290a8','#c8648a','#ffeef2'],lid:['#ffb3c0','#f290a8','#c8648a'],ear:['#ffd4dc','#ffb3c0','#e27d9c'],plat:['#f4b8cf','#d98fb6','#8a58a8','#ffeef2']},
  sea:{body:['#bff0da','#8fd9bb','#5fae9a','#e6fff3'],lid:['#8ec8ff','#5b6fd6','#5a48a0'],ear:['#d2f0ff','#8ec8ff','#5b6fd6'],plat:['#d2f0ff','#8ec8ff','#5b6fd6','#e6fff3']},
  forest:{body:['#9cb35e','#7a9450','#56703f','#e6fff3'],lid:['#f290a8','#c8648a','#7d3a63'],ear:['#bff0da','#9cb35e','#56703f'],plat:['#e39a5c','#b8692a','#8a4b22','#ffe2c2']}};
const MACC={sea:new THREE.Group(),forest:new THREE.Group()};body.add(MACC.sea,MACC.forest);
{const LY=3.6,G=MACC.sea;BUILD=G;
  starfish(0,LY+.3,.5,1.15,[-.5,0,.2]);mk(STARG,SEA.star,G,[.12,LY+.62,.02],[0,0,.4],[.6,.6,.6]);
  {const P=[];for(let i=0;i<30;i++){const a=i/30*6.283;P.push([Math.cos(a)*1.0,2.2,Math.sin(a)*1.0,1]);}inst(new THREE.SphereGeometry(.065,8,6),SEA.pearl,P,G);}
  scallop(-.62,1.95,.62,.26,[0,-.6,0]);
  const fin=new THREE.Group();fin.position.set(1.42,2.2,-.62);fin.rotation.set(0,-.6,-.2);G.add(fin);for(const sd of[-1,1])mk(fanG(.32,5,.05),MC.lid,fin,[sd*.08,.18,0],[0,0,sd*.55]);
  for(const [x,y,z,r] of[[-1.35,2.6,.4,.1],[-1.5,3.0,.2,.07],[-1.42,3.35,.3,.05]])mk(new THREE.SphereGeometry(r,10,8),SEA.pearl,G,[x,y,z],[0,0,0],[1,1,1],false);}
{const LY=3.6,G=MACC.forest;BUILD=G;
  for(let k=0;k<9;k++){const a=k/9*6.283+.3,r=.28+(k%3)*.13;mk(new THREE.SphereGeometry(.07,8,6),FOR.dot,G,[Math.cos(a)*r,LY+.6*Math.sqrt(Math.max(0,.74*.74-r*r))-.01,Math.sin(a)*r],[0,0,0],[1,.45,1],false);}
  mk(new THREE.CylinderGeometry(.03,.04,.3,6),FOR.moss,G,[0,LY+.62,0]);for(const sd of[-1,1])mk(LFG,FOR.moss,G,[sd*.12,LY+.78,0],[0,0,sd*.6],[4,2.2,2.6]);
  const lf=new THREE.Group();lf.position.set(1.42,2.25,-.62);G.add(lf);mk(LFG,FOR.moss,lf,[0,.1,0],[0,0,.4],[6,3,4]);
  for(const [x,z] of[[-.95,.62],[.95,.62]]){mk(new THREE.SphereGeometry(.09,8,6),FOR.flP,G,[x,.42,z],[0,0,0],[1,1,1],false);mk(new THREE.SphereGeometry(.05,8,6),FOR.flY,G,[x,.45,z+.06],[0,0,0],[1,1,1],false);}
}
BUILD=TAV3;
function machTheme(k){const T=MTH[k];const set=(m,c)=>{m.uniforms.uLit.value.set(c[0]);m.uniforms.uMid.value.set(c[1]);m.uniforms.uShd.value.set(c[2]);if(c[3])m.uniforms.uRimC.value.set(c[3]);};
  set(MC.pink,T.body);set(MC.lid,T.lid);set(MC.earO,T.lid);set(MC.ear,T.ear);set(STGM,T.plat);MACC.sea.visible=k==='sea';MACC.forest.visible=k==='forest';}

// ---- 小屋：複製酒館小屋（MKH0~MKH1 是房子本體、MKV0~MKV1 是藤蔓），換材質 ----
function houseClone(G,map,tileG){const ch=TAV3.children,parts=[...ch.slice(MKH0,MKH1),...ch.slice(MKV0,MKV1)];
  for(const o of parts){const c=o.clone(true);c.traverse(m=>{if(m.material&&map.has(m.material))m.material=map.get(m.material);if(tileG&&m.isInstancedMesh&&m.geometry===TAV_TILE)m.geometry=tileG;});G.add(c);}
  for(const L of[...TLEAF3]){const c=L.piv.clone(true);c.traverse(m=>{if(m.material&&map.has(m.material))m.material=map.get(m.material);});G.add(c);TLEAF3.push({piv:c,sd:L.sd});}
  const dl=new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(tavArch())),tDoorLight.material);dl.position.set(0,0,WZ-.22);dl.userData.noCast=1;G.add(dl);}
const tmap=o=>{const M=new Map();for(const k in o)if(TM[k])M.set(TM[k],o[k]);return M;};
const t3=(a,b,c,o)=>toon(a,b,c,o);
const TMS={plaster:t3('#fff1e3','#fbe1cf','#e9b9b4'),plaster2:t3('#e6fff3','#bff0da','#8fd9bb'),timber:t3('#d9c4cc','#9a8499','#5c4a63'),stone:t3('#fff6ec','#f3d3c4','#c99a8e'),stone2:t3('#ebe4ff','#d4c6ff','#9a86e6'),stone3:t3('#ffeef2','#ffd4dc','#d98fb6'),
  door:t3('#8fd9bb','#5fae9a','#3f7f78'),doorD:t3('#5fae9a','#3f7f78','#241638'),iron:t3('#ffd25e','#d9952f','#8a4b22'),roof:t3('#5b6fd6','#5a48a0','#3b2559'),roof2:t3('#8ec8ff','#5b6fd6','#5a48a0'),roofL:t3('#bff0da','#8fd9bb','#5fae9a'),
  curtain:t3('#bff0da','#8fd9bb','#5fae9a'),flP:t3('#ffd4dc','#f290a8','#c8648a'),flP2:t3('#f290a8','#c8648a','#7d3a63'),flV:t3('#d4c6ff','#b8a2ff','#7a64c8'),flW:t3('#fff6ec','#fbe1cf','#e9b9b4'),
  leaf:t3('#8fd9bb','#5fae9a','#3f7f78'),leafD:t3('#5fae9a','#3f7f78','#2f1d4a'),trunk:t3('#c99a8e','#9a8499','#5c4a63'),wood:t3('#c99a8e','#9a8499','#5c4a63'),pot:t3('#fff1e3','#e9b9b4','#c99a8e'),band:t3('#ffd25e','#d9952f','#8a4b22'),
  glass:t3('#d2f0ff','#8ec8ff','#5b6fd6',{noDim:true}),glassW:t3('#d2f0ff','#8ec8ff','#5b6fd6',{noDim:true}),crystal:t3('#ffeef2','#d4c6ff','#9a86e6',{spec:1}),smoke:t3('#ffffff','#d2f0ff','#8ec8ff'),mortar:t3('#bba3b2','#9a8499','#7a6680')};
TMS.glass.uniforms.uEmis.value.setRGB(.15,.25,.35);TMS.glassW.uniforms.uEmis.value.setRGB(.1,.18,.26);
const TMF={plaster:t3('#fbe1cf','#e9b9b4','#c99a8e'),plaster2:t3('#fff1e3','#f3d3c4','#c99a8e'),timber:t3('#8a4b22','#5a3438','#3a2622'),stone:t3('#d9c4cc','#bba3b2','#7a6680'),stone2:t3('#bba3b2','#9a8499','#5c4a63'),stone3:t3('#c99a8e','#b8907e','#7a6680'),
  door:t3('#b8692a','#8a4b22','#5a3438'),doorD:t3('#5a3438','#3a2622','#1a1028'),iron:t3('#5c4a63','#3b2559','#1a1028'),roof:t3('#7d3a63','#5a3438','#3a2622'),roof2:t3('#f290a8','#c8648a','#7d3a63'),roofL:t3('#fff6ec','#fbe1cf','#e9b9b4'),
  curtain:t3('#ffe2c2','#ffc58f','#e39a5c'),flP:t3('#ffd4dc','#f290a8','#c8648a'),flP2:t3('#f290a8','#c8648a','#7d3a63'),flV:t3('#d4c6ff','#b8a2ff','#7a64c8'),flW:t3('#ffffff','#fff6ec','#d9c4cc'),
  leaf:t3('#9cb35e','#7a9450','#5c4a63'),leafD:t3('#7a9450','#56703f','#3b2559'),trunk:t3('#b8907e','#8a4b22','#5a3438'),wood:t3('#e39a5c','#b8692a','#8a4b22'),pot:t3('#fff1e3','#e9b9b4','#c99a8e'),band:t3('#5c4a63','#3b2559','#1a1028'),
  glass:t3('#fff3c2','#ffe27a','#f2b53e',{noDim:true}),glassW:t3('#fff3c2','#ffe27a','#f2b53e',{noDim:true}),crystal:t3('#e6fff3','#8fd9bb','#5fae9a',{spec:1}),smoke:t3('#fff6ec','#ebe4ff','#d4c6ff'),mortar:t3('#9a8499','#7a6680','#5c4a63')};
TMF.glass.uniforms.uEmis.value.setRGB(.4,.28,.1);TMF.glassW.uniforms.uEmis.value.setRGB(.25,.16,.06);
const SCALE_TILE=new THREE.CylinderGeometry(.17,.17,.05,12);   // 人魚屋的屋瓦：圓片一排排疊成魚鱗

if(TAV3_ON&&STG3_ON){
  // ===== 人魚卡池：海底的貝殼小屋 =====
  BUILD=TAV_S;houseClone(TAV_S,tmap(TMS),SCALE_TILE);seaDome(TAV_S);sandFloor(TAV_S,0,WZ);
  scallop(0,4.95,WZ+.12,.62,[0,0,0]);for(const sd of[-1,1]){starfish(sd*2.95,3.05,WZ+.1,.9,[0,0,sd*.3]);starfish(sd*1.05,4.15,WZ+.1,.6,[0,0,-sd*.5],SEA.coral[0]);}
  {const lb=new THREE.Group();lb.position.set(3.0,2.12,WZ+.14);TAV_S.add(lb);for(let k=0;k<8;k++)mk(new THREE.TorusGeometry(.26,.075,6,6,Math.PI/4),k%2?SEA.coral[0]:TMS.plaster,lb,[0,0,0],[0,0,k*Math.PI/4],[1,1,1],k===0);}
  for(const sd of[-1,1]){clam(sd*1.81,0,WZ+.62,.95,sd*.3);coral(sd*1.5,WZ+.3,1.1,SEA.coral[sd<0?0:2]);coral(sd*2.5,WZ+.72,.7,SEA.coral[3]);starfish(sd*2.2,.04,WZ+1.05,.9,[-Math.PI/2,0,sd]);
    for(let k=0;k<4;k++)coral(sd*(3.4+R3()*1.4),WZ+.5+R3()*.6,.7+R3()*.5,SEA.coral[Math.floor(R3()*5)]);
    for(let k=0;k<3;k++)T3(new THREE.IcosahedronGeometry(.35+R3()*.3,1),R3()<.5?SEA.rock:SEA.rockD,[sd*(3.6+R3()*1.2),.15,WZ+.9+R3()*.4],[R3(),R3(),0],[1,.6,1]);
    for(let k=0;k<6;k++)kelp(sd*(6+R3()*3),WZ-1-R3()*3,4+R3()*3,SEA.kelp);for(let k=0;k<5;k++)kelp(sd*(5.7+R3()*.9),WZ-.6+R3()*1.0,1.6+R3()*1.4,SEA.kelp);
    for(let k=0;k<6;k++)coral(sd*(6+R3()*5),WZ-2-R3()*6,1+R3()*1.2,SEA.coral[Math.floor(R3()*5)]);}
  for(let i=0;i<9;i++){const x=-34+i*8.5+R3()*3;T3(new THREE.SphereGeometry(1,20,8,0,6.283,0,Math.PI/2),SEA.rock,[x,-.1,-24-R3()*8],[0,R3()*3,0],[6+R3()*3,2.4+R3()*2,4],false).userData.noCast=1;}
  for(let k=0;k<26;k++){const s=.6+R3()*.6;starfish((R3()-.5)*14,.03,WZ+1.3+R3()*7,s*.8,[-Math.PI/2,0,R3()*6],R3()<.5?SEA.star:SEA.coral[0]);}
  bubbles(70,-7,7,0,7,WZ-6,WZ+4,TAV_S);fishSchool(TAV_S,-2,4.2,WZ-5,6,7,SEA.fish[0],.00022,1);fishSchool(TAV_S,3,2.6,WZ-8,7,6,SEA.fish[2],.00017,-1);
  jelly(TAV_S,-5.2,4.6,WZ-2.5,.9,SEA.jelly);jelly(TAV_S,5.6,5.2,WZ-3.4,.7,SEA.jelly2);
  // ===== 森林卡池：森林裡的蘑菇屋頂小屋 =====
  BUILD=TAV_F;houseClone(TAV_F,tmap(TMF));forestDome(TAV_F);forestFloor(TAV_F,0,WZ);
  for(const sd of[-1,1]){T3(new THREE.CylinderGeometry(.34,.4,.5,14),FOR.trunk,[sd*1.81,.25,WZ+.62]);T3(new THREE.CylinderGeometry(.33,.33,.02,14),FOR.capO,[sd*1.81,.51,WZ+.62],[0,0,0],[1,1,1],false);
    mushroom(sd*1.72,.5,WZ+.55,.55);mushroom(sd*1.95,.5,WZ+.7,.35,FOR.capO);fern(sd*1.52,0,WZ+.32,1.2);mushroom(sd*2.48,0,WZ+.72,.8);mushroom(sd*2.75,0,WZ+.92,.45,FOR.capO);
    for(let k=0;k<2;k++)tbm(sd*3.35,.22+k*.26,sd*4.6,.22+k*.26,.11,.11,WZ+.98,FOR.trunk);for(const x of[3.35,3.95,4.55])T3(new THREE.CylinderGeometry(.07,.08,.62,8),FOR.bark,[sd*x,.31,WZ+.98]);
    for(let k=0;k<4;k++)fern(sd*(3.6+R3()*1.2),0,WZ+.6+R3()*.4,.9+R3()*.6);flowers([sd*4.0,.25,WZ+.75],.5,90,[[FOR.flP,.4],[FOR.flY,.3],[FOR.flW,.3]],.6);
    bigTree(sd*6.9,WZ-1.3,1.2,FORT);bigTree(sd*9.6,WZ-4.2,1.1,FORT);bigTree(sd*12.5,WZ-1.0,1.3,FORT);bigTree(sd*8,WZ-8,1.4,FORT);
    for(let k=0;k<5;k++)mushroom(sd*(5+R3()*3),0,WZ+.2+R3()*2,.4+R3()*.5,R3()<.5?FOR.cap:FOR.capO);for(let k=0;k<4;k++)mushroom(sd*(5.8+R3()*2.5),0,WZ-1-R3()*3,.35+R3()*.3,R3()<.5?FOR.glow:FOR.glow2,false);}
  for(let x=-34;x<34;x+=1.3+R3()*.7){const r=1.3+R3()*.9,z=-14-R3()*8;for(let j=0;j<2;j++)T3(new THREE.IcosahedronGeometry(r*(1-j*.28),1),j?FOR.leaf:FOR.leafD,[x+(R3()-.5)*.8,r*(1+j*.95),z+j*.35],[R3()*3,R3()*3,0],[1.2,1,1],false).userData.noCast=1;}
  points(TAV_F,70,-9,9,.3,4,WZ-6,WZ+4,FIREFLY_V,FIREFLY_F);points(TAV_F,40,-8,8,0,7,WZ-4,WZ+4,LEAFFALL_V,LEAFFALL_F);

  // ===== 人魚卡池：海底舞台（大扇貝背板、珊瑚柱、珍珠燈串、水母燈、從水面射下的光）=====
  BUILD=STG_S;{const FY=-.34;seaDome(STG_S);sandFloor(STG_S,FY,-2);
    const SHL=scallop(0,FY+.1,-8.2,5.4,[0,0,0]);
    {const P=[];for(let i=0;i<=26;i++){const q=SHL.userData.at(1.02,i/26);P.push([q[0],FY+.1+q[1],-8.2+q[2]+.05,1]);}inst(new THREE.SphereGeometry(.12,8,6),SEA.pearl,P).userData.noCast=1;}
    mk(new THREE.SphereGeometry(.85,24,16),SEA.pearl,STG_S,[0,4.25,-7.6]);
    for(const sd of[-1,1]){const x=sd*6.6,z=-6.2;for(let k=0;k<5;k++)T3(new THREE.IcosahedronGeometry(.62-k*.06,1),k%2?SEA.rock:SEA.rockD,[x+(R3()-.5)*.2,FY+.4+k*.9,z],[R3(),R3(),0],[1,.75,1]);
      coral(x,z,1.2,SEA.coral[sd<0?0:2],FY+4.4);coral(x+sd*.5,z+.4,.9,SEA.coral[3],FY+2.2);coral(x-sd*.4,z+.5,.8,SEA.coral[4],FY+1.2);
      const pts=[];for(let i=0;i<=24;i++){const t=i/24,q=V3().lerpVectors(V3(x,FY+4.6,z),V3(sd*2.6,FY+5.0,-7.4),t);q.y-=1.1*4*t*(1-t);pts.push([q.x,q.y,q.z,1]);}inst(new THREE.SphereGeometry(.09,8,6),SEA.pearl,pts).userData.noCast=1;
      for(let k=0;k<5;k++)kelp(sd*(7.6+R3()*3),-9-R3()*4,5+R3()*3,SEA.kelp,FY);for(let k=0;k<4;k++)kelp(sd*(4.8+R3()*1.4),-5.2-R3()*1.6,2+R3()*1.6,SEA.kelp,FY);
      for(let k=0;k<5;k++)coral(sd*(4.4+R3()*2.6),-3-R3()*4,.7+R3()*.6,SEA.coral[Math.floor(R3()*5)],FY);
      clam(sd*5.2,FY,-1.6,1.1,-sd*.6);for(let k=0;k<4;k++)starfish(sd*(4.2+R3()*2),FY+.03,R3()*3-1,.9,[-Math.PI/2,0,R3()*6],R3()<.5?SEA.star:SEA.coral[0]);}
    {const tz=-4.4,tx=-5.0;T3(new THREE.BoxGeometry(.9,.55,.6),SEA.wood,[tx,FY+.28,tz]);T3(new THREE.CylinderGeometry(.3,.3,.9,12,1,false,0,Math.PI),SEA.wood,[tx,FY+.55,tz-.05],[0,0,Math.PI/2],[1,1,1]);
      for(const yy of[.12,.45])T3(new THREE.BoxGeometry(.94,.06,.64),SEA.gold,[tx,FY+yy,tz],[0,0,0],[1,1,1],false);for(let k=0;k<12;k++)T3(new THREE.CylinderGeometry(.07,.07,.02,8),SEA.gold,[tx+(R3()-.5)*.9,FY+.02,tz+.5+(R3()-.5)*.5],[R3()*.3,0,R3()*.3],[1,1,1],false);}
    for(let i=0;i<8;i++){const x=-40+i*11+R3()*4;T3(new THREE.SphereGeometry(1,20,8,0,6.283,0,Math.PI/2),SEA.rock,[x,FY,-30-R3()*10],[0,R3()*3,0],[7+R3()*4,3+R3()*2.4,5],false).userData.noCast=1;}
    jelly(STG_S,-4.4,4.2,-5.2,.9,SEA.jelly);jelly(STG_S,4.6,4.5,-5.6,.85,SEA.jelly2);jelly(STG_S,-2.6,5.3,-6.6,.6,SEA.jelly2);jelly(STG_S,2.8,5.4,-6.8,.6,SEA.jelly);
    bubbles(90,-7,7,FY,7,-8,3,STG_S);fishSchool(STG_S,0,3.4,-9.5,7,8,SEA.fish[0],.00024,1);fishSchool(STG_S,0,2.2,-11,8,7,SEA.fish[3],.00018,-1);fishSchool(STG_S,0,4.6,-6,6.5,5,SEA.fish[1],.0003,1);
}
  // ===== 森林卡池：森林舞台（兩棵大樹彎成拱門、花環、吊燈、發光蘑菇、螢火蟲）=====
  BUILD=STG_F;{const FY=-.34;forestDome(STG_F);forestFloor(STG_F,FY,-2);
    const arch=[];for(const sd of[-1,1]){const x=sd*5.9,z=-7.0;bigTree(x,z,2.0,FORT,FY);
      const cv=new THREE.CatmullRomCurve3([V3(x,FY+5.6,z),V3(sd*4.6,FY+6.6,z+.2),V3(sd*2.4,FY+7.0,z+.3),V3(0,FY+7.1,z+.3)]);arch.push(cv);
      for(let k=0;k<7;k++){const p=cv.getPointAt(k/6),c=[p.x,p.y+.4,p.z];T3(new THREE.IcosahedronGeometry(.9,1),FOR.leafD,c,[R3(),R3(),0],[1.2,.8,1],false);leafy(c,1.0,140,.75,R3()<.5?FOR.leaf:FOR.leafD,2);}
      for(let k=0;k<3;k++){const c=[x+sd*(.4+R3()),FY+5.2+R3()*1.6,z-.4-R3()];T3(new THREE.IcosahedronGeometry(1.1,1),FOR.leafD,c,[R3(),R3(),0],[1,.85,1],false);leafy(c,1.2,180,.8,R3()<.5?FOR.leaf:FOR.leafD,2.2);}
      {const pts=[];for(let i=0;i<=18;i++){const t=i/18,q=V3().lerpVectors(V3(x-sd*.6,FY+5.0,z+.8),V3(0,FY+5.5,z+.9),t);q.y-=.9*4*t*(1-t);pts.push(q);}
        const F=[[],[],[]];pts.forEach((q,i)=>{for(let j=0;j<6;j++)F[j%3].push([q.x+(R3()-.5)*.2,q.y+(R3()-.5)*.16,q.z+(R3()-.5)*.15,1.4]);});inst(FLG,FOR.flP,F[0]);inst(FLG,FOR.flW,F[1]);inst(FLG,FOR.flY,F[2]);
        const L=[];pts.forEach((q,i)=>{for(let j=0;j<4;j++)L.push([q.x+(R3()-.5)*.3,q.y+(R3()-.5)*.2,q.z,1.8,R3()*3,R3()*3,R3()*3]);});inst(LFG,FOR.leaf,L);}
      for(const [lx,ly] of[[sd*4.4,FY+5.1],[sd*2.2,FY+5.3]]){T3(new THREE.CylinderGeometry(.01,.01,.9,4),FOR.bark,[lx,ly+.45,z+.6],[0,0,0],[1,1,1],false);T3(new THREE.CylinderGeometry(.16,.12,.32,6),FOR.lamp,[lx,ly-.1,z+.6]);T3(new THREE.ConeGeometry(.2,.14,6),FOR.bark,[lx,ly+.12,z+.6]);}}
    {const B=[];for(const cv of arch)for(let i=0;i<=30;i++){const p=cv.getPointAt(i/30);B.push([p.x,p.y-.42,p.z+.3,1]);}inst(new THREE.SphereGeometry(.07,8,6),FOR.lamp,B).userData.noCast=1;}
    for(let i=0;i<14;i++){const a=Math.PI*(1.06+i/13*.88),r=4.35;mushroom(Math.cos(a)*r,FY,Math.sin(a)*r*.95,.38+R3()*.14,i%2?FOR.glow:FOR.glow2,false);}
    for(const sd of[-1,1]){for(let k=0;k<3;k++)mushroom(sd*(5+R3()*1.6),FY,-3.4-R3()*2.4,.7+R3()*.7,R3()<.6?FOR.cap:FOR.capO);for(let k=0;k<5;k++)fern(sd*(4.6+R3()*2.4),FY,-1.5-R3()*5,1+R3()*.6);
      flowers([sd*4.9,FY+.2,-1.2],.55,110,[[FOR.flP,.4],[FOR.flY,.25],[FOR.flW,.2],[FOR.flV,.15]],.6);T3(new THREE.CylinderGeometry(.45,.5,.6,12),FOR.trunk,[sd*6.2,FY+.3,-2.4]);T3(new THREE.CylinderGeometry(.44,.44,.02,12),FOR.capO,[sd*6.2,FY+.61,-2.4],[0,0,0],[1,1,1],false);
      bigTree(sd*9.4,-6,1.5,FORT,FY);bigTree(sd*12,-1.5,1.3,FORT,FY);bigTree(sd*8.2,-12,1.6,FORT,FY);bigTree(sd*3.4,-13,1.5,FORT,FY);}
    for(let x=-36;x<36;x+=1.3+R3()*.7){const r=1.4+R3()*.9,z=-18-R3()*8;for(let j=0;j<2;j++)T3(new THREE.IcosahedronGeometry(r*(1-j*.28),1),j?FOR.leaf:FOR.leafD,[x+(R3()-.5)*.8,FY+r*(1+j*.95),z+j*.35],[R3()*3,R3()*3,0],[1.2,1,1],false).userData.noCast=1;}
    points(STG_F,90,-8,8,FY+.3,5,-8,3,FIREFLY_V,FIREFLY_F);points(STG_F,46,-8,8,FY,7,-7,3,LEAFFALL_V,LEAFFALL_F);}
  BUILD=TAV3;}
// 主題場景的動畫：水草搖、魚游、水母上下、光束晃；演唱會舞台照舊
function themeFX(t){CU.uT.value=t;if(STG3.visible)stageFX(t);if(!(STG_S.visible||TAV_S.visible||STG_F.visible||TAV_F.visible))return;
  for(const K of KELP)K.G.rotation.z=Math.sin(t*.0011+K.ph)*.08;
  for(const F of FISH){const a=F.a0*6.283+t*F.sp*F.dir*6.283;F.f.position.set(F.cx+Math.cos(a)*(F.R+F.dr),F.cy+F.dy+Math.sin(t*.002+F.a0*9)*.08,F.cz+Math.sin(a)*(F.R+F.dr)*.45);F.f.rotation.y=-a-(F.dir>0?Math.PI/2:-Math.PI/2);}
  for(const J of JELLY)J.J.position.y=J.y+Math.sin(t*.0012+J.ph)*.25;
  for(const S of SHAFT)S.m.rotation.z=S.r0+Math.sin(t*.0004+S.ph)*.05;}
machTheme(THEME);
function setTheme(k){if(!POOLS[k])return;THEME=k;machTheme(k);mkHead();try{$('oddsBody').innerHTML=oddsHTML();}catch(e){}if(mode==='idle')idleUI();}


// 落影：從主光方向用正交鏡頭拍小屋的深度圖，卡通材質跟地面拿來判斷在不在影子裡（在影子裡就暗一階）
const SMS=2048,SMRT=new THREE.WebGLRenderTarget(SMS,SMS);SMRT.depthTexture=new THREE.DepthTexture(SMS,SMS);
const SMC=new THREE.OrthographicCamera(-10,10,10,-10,1,70),SMMAT=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const KEY_M=GU.uKey.value.clone(),KEY_T=V3(-.62,.62,.5).normalize();
function tavShadow(){const HH=curHouse(),SS=curStage(),tv=TAV3_ON&&HH.visible,sv=STG3_ON&&SS.visible,on=tv||sv,key=tv?KEY_T:KEY_M;GU.uKey.value.copy(key);GU.uSMOn.value=on?1:0;if(!on)return;
  const tg=tv?V3(0,2.4,WZ-1.6):V3(0,1.3,-2.6),keep=tv?[HH]:[SS,mach,stg];SMC.position.copy(tg).addScaledVector(key,32);SMC.up.set(0,1,0);SMC.lookAt(tg);SMC.updateMatrixWorld();SMC.updateProjectionMatrix();
  const hid=[];for(const o of world.children)if(!keep.includes(o)&&o.visible){hid.push(o);o.visible=false;}
  for(const K of keep)K.traverse(o=>{if(o.visible&&(o.userData.noCast||o.isPoints||o.isSprite||(o.material&&o.material.transparent))){hid.push(o);o.visible=false;}});
  world.overrideMaterial=SMMAT;R.setRenderTarget(SMRT);R.clear();R.render(world,SMC);world.overrideMaterial=null;for(const o of hid)o.visible=true;
  GU.uSMM.value.multiplyMatrices(SMC.projectionMatrix,SMC.matrixWorldInverse);GU.uSM.value=SMRT.depthTexture;}

// ---------- 待機／舞台背景（D 11/07：紫色天空、三角旗、漂浮大扭蛋換方向 → 犬尤畫的酒館店內，去掉小人）----------
// 從待機鏡頭把原畫「投」到真的地板（舞台底面那個高度）和後牆上：待機時看起來跟原畫一樣、扭蛋機站在畫裡的地板上；
// 抽的時候鏡頭推近、壓低，地板與後牆有真的遠近。網址加 ?oldbg 可以看回舊背景。
const LBG_ON=!Q.has('oldbg'),LBG=new THREE.Group();bgScene.add(LBG);LBG.visible=false;
const lbgTex=new THREE.TextureLoader().load('tavern/lobby_in.png?v=2');lbgTex.colorSpace=THREE.NoColorSpace;lbgTex.anisotropy=4;
const LBGI={w:1920,h:900,floorY:416,zoom:1.16,cx:960,cy:470};   // 原畫大小、地板最後面那一列（吧台底）、放大倍數、畫面中心對到原畫哪一點
const OLDBG=[FLOORM,SKY,STARS,...FLAGS.map(f=>f.f),...LIGHTS,...BGC,...GEO,...world.children.filter(o=>o.isLine&&!o.isLineLoop)];
let lbgKey='';
function buildLBG(){const key=W+'x'+H;if(key===lbgKey)return;lbgKey=key;LBG.clear();
  applyCam(CAM_IDLE,0,0,0);cam.updateMatrixWorld();
  const ph=LBGI.h/LBGI.zoom,pw=ph*W/H,toNdc=(ix,iy)=>new THREE.Vector2((ix-LBGI.cx)/(pw/2),-(iy-LBGI.cy)/(ph/2));
  const rc=new THREE.Raycaster(),gp=new THREE.Plane(V3(0,1,0),.34),hit=V3();
  rc.setFromCamera(toNdc(LBGI.cx,LBGI.floorY),cam);if(!rc.ray.intersectPlane(gp,hit))return;const zb=hit.z,wp=new THREE.Plane(V3(0,0,1),-zb);
  const NX=120,NY=80,X0=-420,X1=LBGI.w+420,Y0=-520,Y1=LBGI.h+60,pos=[],uv=[],idx=[],col=[];   // 四周多一點（邊緣拉長），鏡頭移動時不會看到邊
  for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++){const ix=X0+i/NX*(X1-X0),iy=Y0+j/NY*(Y1-Y0);rc.setFromCamera(toNdc(ix,iy),cam);
    let ok=iy>=LBGI.floorY&&rc.ray.intersectPlane(gp,hit)&&hit.z>=zb-1e-4;if(!ok)rc.ray.intersectPlane(wp,hit);pos.push(hit.x,hit.y,hit.z);uv.push(ix/LBGI.w,1-iy/LBGI.h);
    const f=iy<0?Math.max(.3,1+iy/260):1;col.push(f*(iy<0?.95:1),f*(iy<0?.82:1),f*(iy<0?.86:1));}   // 原畫上緣以外（鏡頭往上看才看得到）：拉長的上緣慢慢壓暗成天花板的陰影
  for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const a=j*(NX+1)+i,b=a+1,c=a+NX+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:lbgTex,side:THREE.DoubleSide,vertexColors:true}));m.frustumCulled=false;LBG.add(m);}
// 舞台那一組要顯示時：換成酒館店內背景（舊背景藏起來）
function stageBg(on){EXT.forEach(o=>o.visible=on);if(STG3_ON){OLDBG.forEach(o=>o.visible=false);LBG.visible=false;for(const k in STAGES)STAGES[k].visible=on&&k===THEME;return;}if(!LBG_ON){LBG.visible=false;return;}if(on){buildLBG();OLDBG.forEach(o=>o.visible=false);}LBG.visible=on;}

// 轉像素的色盤：平常用舞台色盤，酒館大門（3D 版）換成從原畫取的 64 色
let TAVPAL=null,palNow='main';const PALSET={};
function setPal(k){if(k===palNow)return;palNow=k;const U=FINAL.uniforms;
  if(!PALSET.main)PALSET.main={pl:U.uPL.value,pr:U.uPR.value,n:U.uN.value};
  if(k==='tav'&&!PALSET.tav){const L=TAVPAL.slice(0,64);PALSET.tav={pl:[...L.map(oklab),...Array(64-L.length).fill(0).map(()=>V3(9,9,9))],pr:[...L.map(C),...Array(64-L.length).fill(0).map(()=>C('#000000'))],n:L.length};}
  const P=PALSET[k];U.uPL.value=P.pl;U.uPR.value=P.pr;U.uN.value=P.n;}

// ---------- 2D 疊層：卡片停好後、字卡、閃光 ----------
function foil2D(x,x0,y0,w,h,ph,kind){if(kind==='common')return;const B=7;for(let yy=y0+B;yy<y0+h-B;yy++){const c=Math.round(x0+ph-(yy-y0)*.62);for(let xx=c-5;xx<=c+5;xx++){if(xx<x0+B||xx>=x0+w-B)continue;const core=Math.abs(xx-c)<=1;if(!core&&((xx+yy)&1))continue;x.fillStyle=core?'rgba(255,255,255,.62)':'rgba(255,255,255,.4)';x.fillRect(xx,yy,1,1);}}}
function twinkle(x,cx,cy,sz,a,col='#ffffff'){if(a<=0)return;x.globalAlpha=Math.min(1,a);x.fillStyle=col;x.fillRect(cx-sz,cy,sz*2+1,1);x.fillRect(cx,cy-sz,1,sz*2+1);if(sz>=3){x.fillRect(cx-1,cy-1,3,3);}x.globalAlpha=1;}
let ovBlank=false;
function drawOverlay(s){octx.clearRect(0,0,W,H);if(!plan){rkHide();if(!ovBlank){ovTex.needsUpdate=true;ovBlank=true;}return;}ovBlank=false;const P=plan;let rkOn=false;   // 清空也要上傳一次，不然上一輪的家具會留在待機畫面（D 11/07）
  if(P.n===1){const L=P.L,k=P.it.r,st=P.st;
    // 家具停好後改畫 2D（原圖整數倍放大，跟 3D 停好的那一格完全一樣）；稀有以上有一道斜斜的亮光掃過家具本身
    if(s>=P.HAND){const x0=L.left,y0=L.top,hu=seg(s,P.HAND,P.HAND+200);
      if(hu<1){const t=P.tmp,x=t.getContext('2d');x.clearRect(0,0,L.fw,L.fh);x.drawImage(P.spr,0,0);const id=x.getImageData(0,0,L.fw,L.fh),d=id.data;for(let yy=0;yy<L.fh;yy++)for(let xx=0;xx<L.fw;xx++)if(bay(xx,yy)>=hu)d[(yy*L.fw+xx)*4+3]=0;x.putImageData(id,0,0);octx.drawImage(t,x0,y0);}
      else octx.drawImage(P.spr,x0,y0);
      for(let i=0;i<(st?7:3);i++){const t2=s+i*733,a=Math.sin(t2/260);if(a<=0)continue;const n=Math.floor(t2/816)+i*7,px2=x0-8+Math.round(hash(n)*(L.fw+16)),py2=y0-6+Math.round(hash(n+3)*(L.fh+6));twinkle(octx,px2,py2,a>.6?3:2,a);}}
    // 稀有度字卡（DOM，店內介面風格）：爆開時在畫面中間彈出 → 縮到旁邊；四芒星一顆一顆蓋上去
    const tw=st?P.OPEN+110:P.REV;if(s>=tw){const u=EZ.inout(seg(s,st?P.LAND:P.REV,st?P.LAND+260:P.REV+1)),pop=seg(s,tw,tw+260);
      rkShow(k,P.STARS.length);rkAt(lerp(W/2,L.titleX,u),lerp(H*.42,L.titleCY,u),lerp(1.5,1,u)*(pop<1?EZ.back(pop):1),1);
      rkStars(P.STARS.map(t=>{const q=seg(s,t,t+220);return q<=0?0:(q<1?EZ.back(q):1);}));rkOn=true;}}
  else{if(P.roomOn){   // 十連：小屋裡，家具停好就換成原圖（前面的後畫）；小人站在最前面
    for(const i of P.order){const it=P.res[i],f=P.fx[i];if(s<f.hand)continue;const sp=P.sprs[i],[x0,y0]=P.rect[i],hu=seg(s,f.hand,f.hand+150);
      if(hu<1){const t=P.tmp;t.width=sp.width;t.height=sp.height;const x=t.getContext('2d');x.drawImage(sp,0,0);const id=x.getImageData(0,0,sp.width,sp.height),d=id.data;for(let yy=0;yy<sp.height;yy++)for(let xx=0;xx<sp.width;xx++)if(bay(xx,yy)>=hu)d[(yy*sp.width+xx)*4+3]=0;x.putImageData(id,0,0);octx.drawImage(t,x0,y0);}
      else octx.drawImage(sp,x0,y0);
      if(it.r!=='common'&&s>=f.hand+150){for(let q=0;q<(it.r==='limited'?3:2);q++){const t2=s+q*611+i*277,a=Math.sin(t2/240);if(a<=0)continue;const n=Math.floor(t2/754)+i*13+q;twinkle(octx,x0-4+Math.round(hash(n)*(sp.width+8)),y0-4+Math.round(hash(n+3)*(sp.height+4)),a>.6?3:2,a);}}}
    }
    for(const lim of P.op.filter(o=>o.lim))if(s>=lim.show&&s<lim.show+900){const a=seg(s,lim.show,lim.show+240),b=seg(s,lim.show+650,lim.show+900);
      rkShow('limited',3);rkAt(W/2,H*.3,1.3*(a<1?EZ.back(a):1),1-b);rkStars([0,1,2].map(i=>{const q=seg(s,lim.show+120+i*90,lim.show+320+i*90);return q<=0?0:(q<1?EZ.back(q):1);}));rkOn=true;}}
  if(!rkOn)rkHide();ovTex.needsUpdate=true;}
// 稀有度字卡（DOM 元素，index.html 的 #rk）
const rk=$('rk'),STAR_C={common:'#ff8db5',rare:'#b08cff',limited:'#ffc24a'};
const starURL=c=>'url("data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 1.2C12.9 7.7 16.3 11.1 22.8 12C16.3 12.9 12.9 16.3 12 22.8C11.1 16.3 7.7 12.9 1.2 12C7.7 11.1 11.1 7.7 12 1.2Z" fill="${c}" stroke="#1C2156" stroke-width="2" stroke-linejoin="round"/><path d="M10.6 7.4C10.9 9.2 11.2 9.9 12.3 10.4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>`)+'")';
function rkShow(k,n){if(rk.dataset.k===k+n)return;rk.dataset.k=k+n;rk.className='on rk-'+k;rk.style.setProperty('--st',starURL(STAR_C[k]));
  rk.querySelector('.wm').textContent=rk.querySelector('.en').textContent=RN[k][1];rk.querySelector('.box span').textContent=RN[k][0];rk.querySelector('.stars').innerHTML='<i></i>'.repeat(n);}
function rkAt(x,y,sc,a){rk.style.left=(x*S)+'px';rk.style.top=(y*S)+'px';rk.style.transform=`translate(-50%,-50%) scale(${sc.toFixed(3)})`;rk.style.opacity=a;}
function rkStars(v){rk.querySelectorAll('.stars i').forEach((e,i)=>{e.style.transform=`scale(${(v[i]||0).toFixed(3)})`;});}
function rkHide(){if(rk.dataset.k){rk.dataset.k='';rk.className='';}}

// ---------- 主迴圈 ----------
let mode='idle',plan=null,T0=0,fired=new Set(),paused=false,skipTo=-1,LOOK=null;
const showTime=e=>{let s=e;for(const[t,d]of(plan?.holds||[]))if(e>t)s-=Math.min(e-t,d);return s;};
function renderFrame(s,e){themeFX(s);tavShadow();const fl=plan&&mode!=='idle'?flashAt(plan.fl,s):[null,0];FINAL.uniforms.uFlash.value.set(...(fl[0]?(()=>{const c=C(fl[0]);return[c.r,c.g,c.b];})():[1,1,1]),RM?fl[1]*.3:fl[1]);
  const im=plan&&mode!=='idle'&&!RM?(plan.imp||[]).find(([t,d])=>s>=t&&s<t+d):null;if(im){const c=C(im[3]);FINAL.uniforms.uImp.value.set(c.r,c.g,c.b,im[2]);}else FINAL.uniforms.uImp.value.w=0;
  PA.mat.uniforms.uTime.value=PN.mat.uniforms.uTime.value=s;PA.mat.uniforms.uTime.value=s;for(const m of BB)m.quaternion.copy(cam.quaternion);
  CARD.mf.uniforms.uFoil.value=0;
  setPal(TAV3.visible&&Array.isArray(TAVPAL)&&TAVPAL.length?'tav':'main');
  const bgOn=TAV.visible||LBG.visible;if(LBG.visible)FINAL.uniforms.uBgDim.value=Math.max(FINAL.uniforms.uBgDim.value,GU.uDim.value*.7);if(bgOn){R.setRenderTarget(rtB);R.setClearColor(0x2f1d4a,1);R.clear();R.render(bgScene,cam);}
  FINAL.uniforms.uBg.value=bgOn?1:0;FINAL.uniforms.tB.value=rtB.texture;FINAL.uniforms.uRoom.value=plan&&mode!=='idle'&&plan.roomOn&&FINAL.uniforms.tR.value?1:0;
  R.setRenderTarget(rtW);R.setClearColor(0x1a1028,0);R.clear();R.render(world,cam);
  if(!window.__noBloom)bloom.render(R,null,rtW,0,false);
  R.setRenderTarget(rtC);R.setClearColor(0x000000,0);R.clear();R.render(cardScene,cam);
  drawOverlay(s);FINAL.uniforms.tW.value=rtW.texture;FINAL.uniforms.tC.value=rtC.texture;R.setRenderTarget(null);fsq.render(R);}
function step(e){if(mode==='loading')return;if(mode==='idle'){PICK.g.visible=false;updIdle(e);renderFrame(e,e);return;}
  PICK.g.visible=false;const s=showTime(e);
  for(const[t,fn]of plan.snd)if(s>=t&&!fired.has(t+''+fn)){fired.add(t+''+fn);if(!paused)try{fn();}catch(_){}}
  if(plan.n===1)updOne(s,e);else updTen(s,e);if(LOOK&&LOOK.k)applyCamH([0,...LOOK.k],0,0,e);renderFrame(s,e);
  if(mode!=='result'&&s>=plan.DONE){mode='result';resultUI();}}
let lastE=0;
function loop(t){if(innerWidth!==lastVW||innerHeight!==lastVH)onResize();if(!paused){const e=t-T0;if(skipTo>=0){T0-=skipTo-e;skipTo=-1;}step(mode==='idle'?t:t-T0);}else if(LOOK)step(LOOK.e);requestAnimationFrame(loop);}

// ---------- 介面 ----------
let HEAD='';function mkHead(){const P=POOLS[THEME];HEAD=`${LIVE?'<button class="p closeX" id="bx" aria-label="回小屋">×</button>':'<div class="p tag">試做頁・不會扣真的貓貓幣</div>'}<div class="p head"><small>FURNITURE GACHA</small><b>家具扭蛋</b><em class="pool">${P.name}<i>${P.sub}</i></em>${limitHTML()}</div>`;}
function limitHTML(){const st=poolState(THEME);if(st.perm)return '';
  if(st.open)return `<span class="lim${st.left<DAY?' last':''}"><b>LIMITED</b><i>${leftTxt(st.left)}</i>${twDate(st.end)} 結束</span>`;
  if(st.soon)return `<span class="lim off"><b>COMING</b><i>即將登場</i>${twDate(st.start)} 開始</span>`;
  return `<span class="lim off"><b>CLOSED</b><i>已結束</i>${twDate(st.end)} 結束</span>`;}
mkHead();
const walletHTML=()=>`<div class="p wallet"><i></i><span>${wallet.toLocaleString()}</span></div>`;
function setUI(h){ui.innerHTML=h;bind();}
function idleUI(){mkHead();UISIG=sig();setUI(HEAD+walletHTML()+`<div class="p pools">${Object.entries(POOLS).map(([k,P])=>{const st=poolState(k);return `<button data-pool="${k}" class="${k===THEME?'on':''}${st.open?'':' closed'}${st.open&&!st.perm&&st.left<DAY?' last':''}">${P.name}<small>${tabTxt(st)}</small></button>`;}).join('')}</div>${poolState(THEME).open?`<div class="p btns"><button class="btn hot" id="b1">抽一次<em><i></i>${PRICE1}</em></button><button class="btn hot" id="b10">抽十次<em><i></i>${PRICE10}</em></button></div>`
   :`<div class="p btns"><button class="btn" disabled>${poolState(THEME).soon?twDate(poolState(THEME).start)+' 開始':'這一期已經結束了'}</button></div>`}
  <div class="p links"><button id="bo">家具圖鑑・機率</button><button id="bs">音效：${SND?'開':'關'}</button>${LIVE?'':'<button id="br">試做重設（金額＋收藏）</button>'}</div>`);}
function bind(){const q=$,shut=!poolState(THEME).open;if(q('b1')){q('b1').onclick=()=>start(1);q('b1').disabled=shut||wallet<PRICE1;}if(q('b10')){q('b10').onclick=()=>start(10);q('b10').disabled=shut||wallet<PRICE10;}
  if(q('bo'))q('bo').onclick=()=>{$('oddsBody').innerHTML=oddsHTML();$('odds').classList.add('on');};if(q('bs'))q('bs').onclick=e=>{SND=!SND;e.target.textContent='音效：'+(SND?'開':'關');};
  if(q('br'))q('br').onclick=()=>{wallet=3000;OWN.clear();saveOwn();idleUI();};if(q('bx'))q('bx').onclick=()=>{try{HOST.close();}catch(e){}};ui.querySelectorAll('[data-pool]').forEach(b=>b.onclick=()=>setTheme(b.dataset.pool));if(q('bk'))q('bk').onclick=()=>{mode='idle';plan=null;PA.clear();PN.clear();idleUI();};}
$('odds').querySelector('.x').onclick=()=>$('odds').classList.remove('on');
// 家具圖鑑（11/08 D「機率一覽要做圖鑑」）：上面卡池名＋收集進度條＋保底規則；下面依限定／稀有／普通分區，一件一張卡（像素圖、名字、單件機率），已收集亮、沒收集灰
function dexImg(it){const B=40,f=Math.min(B/it.w,B/it.h),k=f>=.5?Math.floor(f*2)/2:f;   // 放大用整數／半格倍數保持像素整齊；太大的家具縮小時用平滑縮
  return `<img src="../img/${it.k}.png${DV}" alt="" style="width:calc(${(it.w*k).toFixed(2)}px*var(--s));height:calc(${(it.h*k).toFixed(2)}px*var(--s));image-rendering:${f>=.5?'pixelated':'auto'}">`;}
function oddsHTML(){const L=poolItems(),P=POOLS[THEME],own=L.filter(i=>OWN.has(i.k)).length,EN={limited:'LIMITED',rare:'RARE',common:'COMMON'};
  const sec=k=>{const A=L.filter(i=>i.r===k);if(!A.length)return'';const per=(RATE[k]/A.length).toFixed(2);
    return `<section class="dex-sec" data-r="${k}"><h4><small class="r-${k}">${RN[k][0]}</small><b>${EN[k]}</b><span>${RATE[k]}%　每件 ${per}%</span><em>${A.filter(i=>OWN.has(i.k)).length}／${A.length}</em></h4>
      <div class="dex-grid">${A.map(it=>{const o=OWN.has(it.k);return `<div class="dex-card ${o?'own':'no'}"><i>${dexImg(it)}</i><b>${it.name}</b>${o?'':'<s>未收集</s>'}</div>`;}).join('')}</div></section>`;};
  return `<div class="dex-top"><p class="pl">${P.name}・${P.sub}</p><div class="dex-bar"><i style="width:${(own/Math.max(1,L.length)*100).toFixed(1)}%"></i><span>已收集 ${own}／${L.length}</span></div>
    <p class="dex-rule">抽十次保證至少一件「這個卡池裡還沒有的」稀有以上家具；稀有以上全部收集齊了，就保證至少一件稀有以上。同一個稀有度裡，每件抽到的機會一樣。</p></div>${fxHTML(L,own)}${['limited','rare','common'].map(sec).join('')}`;}
// 集滿獎勵：這個系列專屬的房間光效（扭蛋抽不到；集到一半先給第一階段、集滿給招牌光效，解鎖後任何房間都能開）
function fxHTML(L,own){const F=POOLS[THEME].fx;if(!F)return'';const n=L.length;
  return `<section class="dex-sec dex-fx"><h4><small class="fxk">集滿獎勵</small><b>BONUS</b><span>系列專屬光效・扭蛋抽不到</span></h4><div class="fx-list">${F.map(([nm,lv,img,ds])=>{const need=lv===1?Math.ceil(n/2):n,ok=own>=need;
    return `<div class="fx-card ${ok?'own':'no'}"><i><img src="${img}${DV}" alt="">${ok?'':'<s>未解鎖</s>'}</i><div><em>${lv===1?'集到一半':'全部集滿'}</em><b>${nm}</b><p>${ds}</p><u><span style="width:${(Math.min(own,need)/need*100).toFixed(1)}%"></span><q>${ok?'已解鎖':Math.min(own,need)+'／'+need}</q></u></div></div>`;}).join('')}</div></section>`;}
function resultUI(){const P=plan;mkHead();
  if(P.n===1){const L=P.L,k=P.it.r;setUI(HEAD+walletHTML()+`<div class="p plate" style="left:calc(${L.plateX}px*var(--s));top:calc(${L.plateY}px*var(--s))">${P.it.nw?'<b class="nw">NEW</b>':''}${P.it.name}</div>
    <div class="p btns" style="bottom:calc(8px*var(--s))"><button class="btn" id="bk">收下</button><button class="btn hot" id="b1">再抽一次<em><i></i>${PRICE1}</em></button><button class="btn hot" id="b10">抽十次<em><i></i>${PRICE10}</em></button></div><div class="p links"><button id="bo">家具圖鑑・機率</button></div>`);}
  else{const G=P.G;let names='';G.cells.forEach((c,i)=>{const r=P.res[i].r;names+=`<span class="gname" style="left:calc(${P.anchor[i][0]}px*var(--s));top:calc(${P.anchor[i][1]+2}px*var(--s))">${P.res[i].nw?'<b class="nw">NEW</b>':''}${r==='common'?'':`<small class="r-${r}">${RN[r][0]}</small>`}${P.res[i].name}</span>`;});
    setUI(HEAD+walletHTML()+`<div class="p" style="inset:0;pointer-events:none">${names}</div><div class="p btns" style="bottom:calc(6px*var(--s))"><button class="btn" id="bk">收下</button><button class="btn hot" id="b10">再抽十次<em><i></i>${PRICE10}</em></button></div>`);unclutter(P);}}
// D 11/08「還是有文字會擋到彼此」：擺家具時名牌寬度是估的，十件塞不下時也會退而求其次 → 名牌畫出來後照「真的大小」再排一次：
// 名牌跟名牌絕對不疊、不出畫面、不壓到標題／金幣／按鈕；其餘照「離原位近、少蓋到別件家具」挑位置（上面的名牌先定位）
function unclutter(P){const els=[...ui.querySelectorAll('.gname')];if(!els.length)return;const o=stageEl.getBoundingClientRect();
  const box=e=>{const r=e.getBoundingClientRect();return[(r.left-o.left)/S,(r.top-o.top)/S,(r.right-o.left)/S,(r.bottom-o.top)/S];};
  const UIb=[uiRect('.head'),uiRect('.wallet'),...[...ui.querySelectorAll('.btns button')].map(b=>{const r=b.getBoundingClientRect();return[(r.left-o.left)/S-3,(r.top-o.top)/S-3,(r.right-o.left)/S+3,(r.bottom-o.top)/S+3];})].filter(Boolean),FB=(P.room?P.room.items:[]).map(x=>x&&x.bx);   // 按鈕列的外框橫跨整個畫面，只閃真的按鈕
  const ar=(a,t)=>Math.max(0,Math.min(a[2],t[2])-Math.max(a[0],t[0]))*Math.max(0,Math.min(a[3],t[3])-Math.max(a[1],t[1]));
  const done=[];
  els.map((e,i)=>({e,i,b:box(e)})).sort((a,b)=>a.b[1]-b.b[1]).forEach(({e,i,b})=>{const w=b[2]-b[0],h=b[3]-b[1],cx=(b[0]+b[2])/2,y0=b[1],own=FB[i];
    const ys=[0,1,-1,2,-2,3,-3,4,5].map(k=>y0+k*(h+1));if(own)ys.push(own[1]-h-2,own[3]+1);
    let best=null,bs=1e18;
    for(const y of ys)for(const f of[0,-.3,.3,-.6,.6,-.9,.9,-1.2,1.2]){const x=cx+f*w,q=[x-w/2,y,x+w/2,y+h];
      if(q[0]<2||q[2]>W-2||q[1]<2||q[3]>H-2||UIb.some(u=>hitR(q,u))||done.some(d=>hitR(q,[d[0]-1,d[1]-1,d[2]+1,d[3]+1])))continue;
      const sc=Math.hypot(x-cx,(y-y0)*1.6)+FB.reduce((a,t,j)=>a+(t?ar(q,t)*(j===i?.15:.6):0),0);if(sc<bs){bs=sc;best=q;}}
    const q=best||b;done.push(q);if(best&&(Math.abs(q[0]-b[0])>.5||Math.abs(q[1]-b[1])>.5)){e.style.left=`calc(${((q[0]+q[2])/2).toFixed(1)}px*var(--s))`;e.style.top=`calc(${q[1].toFixed(1)}px*var(--s))`;}});}
async function begin(n,seed,given){const r=rng(seed);const seen=new Set();const res=given||roll(n,r).map(it=>{const nw=!OWN.has(it.k)&&!seen.has(it.k);seen.add(it.k);return{...it,nw};});res.forEach(it=>OWN.add(it.k));saveOwn();fired=new Set();faceKey='';
  const Fs=await Promise.all(res.map(it=>loadFurn(it.k)));
  plan=n===1?planOne(res[0],seed,Fs[0]):planTen(res,seed,Fs);mode=n===1?'one':'ten';setUI(HEAD+walletHTML()+`<div class="p skip">點一下畫面可以略過</div>`);}
const ERR={POOL_CLOSED:'這個卡池這一期已經結束了',NOT_ENOUGH:'貓貓幣不夠喔，每日任務可以拿貓貓幣',LOGIN_REQUIRED:'要先用 Discord 登入，才能轉扭蛋',BUSY:'扭蛋機有點忙，等一下再試一次',TOO_MANY:'轉太快了，休息一下再來',NET:'連不上扭蛋機，檢查一下網路再試'};
function say(t){const d=document.createElement('div');d.className='p msg';d.textContent=t;ui.appendChild(d);setTimeout(()=>d.remove(),2800);}
async function startLive(n){mode='loading';setUI(HEAD+walletHTML()+`<div class="p skip">扭蛋機轉動中…</div>`);let j=null;
  try{j=await HOST.pull(THEME,n);}catch(e){j=null;}
  const res=j&&j.ok&&Array.isArray(j.items)&&j.items.length===n?j.items.map(x=>{const it=ITEMS.find(i=>i.k===x.k);return it?{...it,nw:!!x.nw}:null;}):null;
  if(!res||res.some(x=>!x)){mode='idle';hostSync();if(j&&j.code==='NOT_ENOUGH'&&Number.isSafeInteger(j.balance))wallet=j.balance;idleUI();say(ERR[j&&j.code]||(j&&j.ok?'抽到了！家具已經放進背包，重新打開扭蛋就看得到':ERR.NET));return;}
  if(Number.isSafeInteger(j.balance))wallet=j.balance;
  await begin(n,Math.random()*1e9|0,res);T0=performance.now();}
function start(n){const cost=n===10?PRICE10:PRICE1;if(mode!=='idle'&&mode!=='result')return;
  if(!poolState(THEME).open){say(poolState(THEME).soon?'這個卡池 '+twDate(poolState(THEME).start)+' 才開始':ERR.POOL_CLOSED);if(mode==='idle')idleUI();return;}if(wallet<cost){if(LIVE)say(ERR.NOT_ENOUGH);return;}if(LIVE){startLive(n);return;}wallet-=cost;
  const seed=Q.get('seed')?+Q.get('seed'):(Math.random()*1e9|0);mode='loading';setUI(HEAD+walletHTML());begin(n,seed).then(()=>{T0=performance.now();});}   // 載入家具模型時先把上一輪的按鈕收掉
stageEl.addEventListener('pointerdown',e=>{if((mode==='one'||mode==='ten')&&!e.target.closest('button')){const P=plan,target=P.n===1?P.OPEN-60:P.DONE-10;const e0=performance.now()-T0;if(showTime(e0)<target){for(const[t,fn]of P.snd)if(t<target)fired.add(t+''+fn);skipTo=target+(P.holds||[]).reduce((a,[t,d])=>a+(t<target?d:0),0);}}});

// ---------- 測試用：G.pull(1,'limited',7); G.seek(3000) ----------
window.G={ready:false,async pull(n,force,seed=7){if(force)FORCE=force;paused=true;MUTE=true;await begin(n,seed);const o={holds:plan.holds};for(const k of['COIN','T0','T1','TEASE','POP','B1','ENG','RC','DOOR','ARR','SLAM','H0','CR1','CR2','OPEN','CUT','IN','BURST','POP0','APEX','LAND','SETTLE','REV','HAND','DONE','SHOOT','LANDED'])if(plan[k]!=null)o[k]=plan[k];return o;},
  seek(e){paused=true;MUTE=true;step(e);return mode;},own(a){OWN.clear();(a||[]).forEach(k=>OWN.add(k));saveOwn();return OWN.size;},owned:()=>[...OWN],
  probe(x,y){const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(x/W*2-1,-(y/H*2-1)),cam);return rc.intersectObjects([...world.children,...cardScene.children],true).filter(h=>{if(h.object.isPoints)return false;let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;}).slice(0,5).map(h=>{let n=[],o=h.object;while(o&&o!==world){n.push((o.type||'')+(o.geometry?':'+o.geometry.type:''));o=o.parent;}return n.join('<')+' pos='+h.object.position.toArray().map(v=>v.toFixed(2))+' sc='+h.object.scale.toArray().map(v=>v.toFixed(2))+' u='+Object.keys(h.object.material.uniforms||{}).join('|')+' map='+!!(h.object.material.uniforms?.map?.value?.image?.width)+' d='+h.distance.toFixed(2)+' p='+h.point.toArray().map(v=>v.toFixed(2)).join(',');});},idle(t=1000){paused=true;mode='idle';plan=null;idleUI();step(t);},plan:()=>plan};

// 視窗大小變了就重算（分頁在背景載入時拿到的是預設大小，顯示出來時不一定會收到 resize 事件 → 每一格都檢查一次）
let lastVW=innerWidth,lastVH=innerHeight;
function onResize(){lastVW=innerWidth;lastVH=innerHeight;measure();makeTargets();if(mode==='idle')idleUI();else if(mode==='result')resultUI();}
addEventListener('resize',onResize);
let UISIG='';const sig=()=>Object.keys(POOLS).map(k=>tabTxt(poolState(k))).join('|')+limitHTML();
setInterval(()=>{if(mode==='idle'&&G.ready&&sig()!==UISIG)idleUI();else if(mode==='result'&&!poolState(THEME).open)bind();},20000);
if(LIVE){try{HOST.sub(s=>{hostSync(s);if(mode==='idle')idleUI();else{const w=ui.querySelector('.wallet span');if(w)w.textContent=wallet.toLocaleString();}});}catch(e){}
  addEventListener('keydown',e=>{if(e.key==='Escape'){if($('odds').classList.contains('on'))$('odds').classList.remove('on');else if(mode==='idle'||mode==='result')try{HOST.close();}catch(_){}}});}
// 看酒館模式（?look）：停在酒館那幾格但每一格都重畫（視窗縮放也不會黑掉），下方按鈕切換視角
async function lookMode(){await G.pull(1,null,7);const P=plan,D0=-TZD,e0=P.H0+100;
  const V=[['斜前方',e0,[0,2.9,D0-1,20,12,8.6,40,0]],['正面',e0,[0,2.9,D0,0,6,8.4,40,0]],['左斜',e0,[0,2.7,D0-1.2,-34,10,8.2,40,0]],['右斜',e0,[0,2.7,D0-1.2,34,10,8.2,40,0]],['大門',P.ARR-700,null],['窗台',e0,[-PX(1330),PY(420),D0,-16,-5,2.9,40,0]]];   // 開門那幾格是整片爆光，看不到東西，改放近看
  const show=i=>{LOOK={e:V[i][1],k:V[i][2]};ui.querySelectorAll('[data-look]').forEach(b=>b.classList.toggle('hot',+b.dataset.look===i));};
  setUI(HEAD+`<div class="p btns">${V.map((v,i)=>`<button class="btn" data-look="${i}" style="white-space:nowrap;padding:calc(3px*var(--s)) calc(8px*var(--s));font-size:calc(8px*var(--s))">${v[0]}</button>`).join('')}</div>`);
  ui.addEventListener('click',ev=>{const b=ev.target.closest('[data-look]');if(b)show(+b.dataset.look);});G.look=(e,k)=>{LOOK={e,k};};show(0);}
(async()=>{try{makeTargets();ITEMS=await fetch('../items.json'+DV).then(r=>r.json());[TONE,FPAL,ROOMD,FIT,TAVPAL]=await Promise.all(['models/tone.json'+DV,'models/pal.json'+DV,'room/room.json'+DV,'models/fit.json'+DV,'tavern/tav_pal.json'].map(u=>fetch(u).then(r=>r.json()).catch(()=>({}))));
  await Promise.all(Object.keys(ROOMD?.sets||{}).map(k=>new Promise(r=>{const i=new Image();i.onload=()=>{ROOMI[k]=i;r();};i.onerror=()=>r();i.src='room/room_'+k+'.png'+DV;})));
  const load=(k,src)=>new Promise(r=>{const i=new Image();i.onload=()=>{IMG[k]=i;r();};i.onerror=()=>r();i.src=src;});
  await Promise.all([load('coin','../img/cat-coin-px48.png'),...ITEMS.map(i=>load('raw_'+i.k,'../img/'+i.k+'.png'+DV))]);for(const i of ITEMS)if(IMG['raw_'+i.k])IMG['f_'+i.k]=grade(IMG['raw_'+i.k]);
  coinTex=texOf(IMG.coin);const cg=new THREE.CylinderGeometry(.15,.15,.045,24);const cm=[MC.gold,texMat(coinTex,{noDim:true}),texMat(coinTex,{noDim:true})];const cmesh=new THREE.Mesh(cg,cm);coin.add(cmesh);ol(cmesh);COINS=[...Array(10)].map(()=>{const g=coin.clone(true);g.visible=false;world.add(g);return g;});
  try{await document.fonts.ready;}catch(_){}
  $('oddsBody').innerHTML=oddsHTML();idleUI();G.ready=true;requestAnimationFrame(t=>{T0=t;loop(t);});if(Q.has('look'))lookMode();}
  catch(err){$('err').textContent='載入失敗：'+err.message;console.error(err);}})();
