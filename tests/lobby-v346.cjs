const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('lobby.html','utf8');
const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const agents=new Map();let created=0;
const ctx={agents,STAFF_LAYOUT:{},STAFF_GIF:{},stopDemo(){},realStaffOn:false,makeStaff(cid,st){created++;const a={key:'staff_'+cid,cid,staff:true,on:!!st.on,busy:false,post:[.4,.7],b:{},tag:{},led:{},el:{remove(){this.removed=true}}};agents.set(a.key,a);return a;}};
vm.createContext(ctx);
vm.runInContext(section('function setStaffServe(', 'function makeCloak(')+section('function syncResidentStaff(',"if(db) db.ref(ROOT+'/staffStatus').on"),ctx);
ctx.syncResidentStaff({a:{name:'A',on:false,busy:true},b:{name:'B',on:true,busy:true},c:{name:'C',on:true}});
assert.equal(agents.size,3);
const a=agents.get('staff_a');assert.equal(a.led.textContent,'離線中');assert.equal(a.busy,false);
assert.equal(agents.get('staff_b').led.textContent,'接單中');assert.equal(agents.get('staff_c').led.textContent,'待接單');
for(const st of [{on:true},{on:true,busy:true},{on:false,busy:true},{on:true}]){
 ctx.syncResidentStaff({a:st,b:{on:false},c:{on:false}});
 assert.equal(agents.get('staff_a'),a);assert.equal(a.state,'post');assert.equal(a.x,.4);assert.equal(a.y,.7);
 assert.equal(a.led.textContent,!st.on?'離線中':st.busy?'接單中':'待接單');
}
assert.equal(created,3,'clocking in/out must not recreate actors');
ctx.syncResidentStaff({a:{on:false}});assert.equal(agents.size,1,'deleted staff must be removed');
ctx.syncResidentStaff(null);assert.equal(agents.size,0);
const motion=section('    a._hairMotion=null;', '    if(a._staffGif){hopRot=');
function sample(walking,now,reduced=false){const c={a:{seed:0,slime:false},walking,now,tt:now/1000,WALK_CYCLE:['a','a2','b','b2'],_hairMotionPreference:{matches:reduced},setFrame(a,p){a.pose=p}};vm.createContext(c);vm.runInContext(motion+';result={bob,hopRot,sqx,sqy,motion:a._hairMotion,pose:a.pose}',c);return c.result;}
const samples=Array.from({length:20},(_,i)=>sample(true,i*20));assert(samples.some(s=>s.bob<-4));assert(samples.every(s=>s.motion===null));assert(samples.every(s=>s.pose==='idle'),'hopping must keep the feet in the standing pose');
assert.equal(sample(false,100).motion,null);assert.equal(sample(false,100).pose,'idle');
const reduced=sample(true,100,true);assert.equal(reduced.bob,0);assert.equal(reduced.sqx,1);assert.equal(reduced.sqy,1);
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc\s*=|type\s*=\s*["'](?:module|application\/ld\+json)/i.test(match[1]))new vm.Script(match[2]);}
console.log('PASS: resident staff lifecycle, stale busy flags, deletion, hop with fixed standing pose, stable idle hair, reduced motion, inline script syntax');
