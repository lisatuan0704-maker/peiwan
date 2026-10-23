const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dm=require('../lobby-ui/dm-log.js'),ach=require('../lobby-ui/companion-achievements.js');
assert.equal(dm.timeText(Date.parse('2026-10-23T04:05:00Z')),'12:05');
assert.equal(dm.timeText(Date.parse('2026-10-23T16:05:00Z')),'00:05');
for(const v of [null,undefined,{},NaN,0])assert.equal(dm.timeText(v),'');
const rewards={key:'alice',frames:[{id:'companion_rira',unlocked:true},{id:'companion_kabuki',unlocked:false}]};
assert.equal(ach.states(rewards,'alice').filter(x=>x.unlocked).length,1);
assert(ach.states(rewards,'bob').every(x=>!x.unlocked&&!x.loaded));
assert(ach.states(rewards,null).every(x=>!x.unlocked&&!x.loaded));
assert(ach.states(null,'alice').every(x=>!x.unlocked&&!x.loaded));
for(const c of ach.states(rewards,'alice')){assert(fs.existsSync('img/companions-v352/'+c.asset+'-staff.gif'));assert(fs.existsSync('img/frames/companions/'+c.id+'.png'));}
const html=fs.readFileSync('lobby.html','utf8'),start=html.indexOf('  window.dmSend=async function'),end=html.indexOf('  window.dmBlockCur=',start);
let release,posts=0,blocked=false;const button={disabled:false,setAttribute(){},removeAttribute(){}};
const input={value:'測試訊息',parentElement:{querySelector:()=>button},dispatchEvent(){}};
const context={document:{getElementById:()=>input},_dmWith:'bob',_dmSending:false,myKey:'alice',FR:{bob:{name:'B'}},myName:()=> 'A',ROOT:'test',pairKey:()=> 'alice~bob',toast(){},SFX:{},Event:class{},db:{ref:()=>({once:()=>new Promise(r=>release=()=>r({val:()=>blocked})),push:async()=>{posts++},update:async()=>{},transaction:async()=>{}})}};
context.window=context;vm.createContext(context);vm.runInContext(html.slice(start,end),context);
(async()=>{
 const first=context.dmSend();assert(button.disabled);assert.equal(await context.dmSend(),false);release();assert.equal(await first,true);assert.equal(posts,1);assert(!button.disabled);assert.equal(input.value,'');
 input.value='保留草稿';blocked=true;const denied=context.dmSend();release();assert.equal(await denied,false);assert.equal(posts,1);assert.equal(input.value,'保留草稿');assert(!button.disabled);
 blocked=false;const switched=context.dmSend();context._dmWith='charlie';release();assert.equal(await switched,false);assert.equal(posts,1);assert.equal(input.value,'保留草稿');
 console.log('PASS: Taiwan clock and midnight, invalid timestamps, per-account rewards, source assets, duplicate sends, block checks, conversation switch, draft preservation');
})().catch(e=>{console.error(e);process.exitCode=1});
