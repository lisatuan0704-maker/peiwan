const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'lobby.html'),'utf8'),live=fs.readFileSync(path.join(root,'lobby-ui/live.js'),'utf8');

// Execute the production functions, stopping at the first complete function expression.
// This avoids coupling the test to an unrelated function's name or copying the resolver.
function sourceFunction(source,name){
 const found=new RegExp('\\bfunction\\s+'+name+'\\s*\\(').exec(source);
 assert(found,'production function is present: '+name);
 for(let end=source.indexOf('}',found.index);end>=0;end=source.indexOf('}',end+1)){
  const candidate=source.slice(found.index,end+1);
  try{new vm.Script('('+candidate+')');return candidate;}catch{}
 }
 assert.fail('complete production function was not found: '+name);
}
const nodes=Object.fromEntries(['ordList','ordTabA','ordTabH','issueOrd','issueTx','renewBody'].map(id=>[id,{innerHTML:'',value:'draft',style:{}}]));
nodes.renewM={style:{},querySelector:selector=>{assert.equal(selector,'#renewBody');return nodes.renewBody;}};
let currentOrder,renewalOptions,renderWrites=0;
const ctx={console,Date,Number,Math,Set,document:{getElementById:id=>nodes[id]||null},issueSent:()=>({}),canSelfCancel:()=>false,backendNumber:()=>null,identity:()=>'',
 myOrdersCache:{},myOrderIds:()=>Object.keys(ctx.myOrdersCache),ORD_PER:7,_ordTab:'active',_ordPage:0,_ordOpen:new Set(),_issueId:null,__renewRes:{},__wallet:1000,
 activeOrder:()=>currentOrder?{id:'qa-order',o:currentOrder}:null,sessionEndOf:()=>Date.now()+3600000,hhmm:()=> '12:00',renewOptions:()=>renewalOptions,RENEW_BUFFER:0,
 shopClose(){},gOpen(id){assert.equal(id,'issueM');},toast(){},db:{ref(){renderWrites++;throw Error('display functions must not access the database');}}};
ctx.window=ctx;vm.createContext(ctx);
for(const name of ['esc','ttStaffDisplayName','ttOrderStaffDisplayName','renderMyOrders','bkOrdLine','openIssue','renewCardHtml','openRenew'])vm.runInContext(sourceFunction(html,name),ctx,{filename:'lobby.html:'+name});
const textStart=live.indexOf('  const text ='),textEnd=live.indexOf('  const geometry =',textStart);
assert(textStart>=0&&textEnd>textStart,'production HTML escaping helpers are present');
vm.runInContext(live.slice(textStart,textEnd)+'\n'+sourceFunction(live,'orderCard'),ctx,{filename:'lobby-ui/live.js:orderCard'});

const people=[
 {cid:'-OxY46ezlpnRt64hUIw9',old:'Caboo',name:'蕪'},
 {cid:'-OxY7C4vDkgsr1zcyWbk',old:'大卡',name:'縭'},
 {cid:'-OzbfbQcF6J6fIR6YYGh',old:'小mo',name:'桃'}
];
const cases=people.flatMap(p=>[
 {label:p.old+' with CID',cid:p.cid,stored:p.old,expected:p.name},
 {label:p.old+' without CID',cid:null,stored:p.old,expected:p.name},
 {label:p.old+' with unknown historical CID',cid:'old-character-id',stored:p.old,expected:p.name},
 {label:p.name+' already formal',cid:p.cid,stored:p.name,expected:p.name},
 {label:p.name+' formal without CID',cid:null,stored:p.name,expected:p.name},
 {label:p.name+' CID without name',cid:p.cid,stored:undefined,expected:p.name},
 {label:p.old+' CID wins',cid:p.cid,stored:people.find(q=>q.cid!==p.cid).old,expected:p.name}
]).concat([
 {label:'unknown person',cid:'other-person',stored:'新店員',expected:'新店員'},
 {label:'unassigned',cid:null,stored:'不指定',expected:'不指定'},
 {label:'exact alias only',cid:null,stored:'Caboo 的朋友',expected:'Caboo 的朋友'},
 {label:'case is not an invented alias',cid:null,stored:'caboo',expected:'caboo'},
 {label:'unknown HTML is escaped',cid:'other-person',stored:'<img src=x onerror="bad()"> & 店員',expected:'<img src=x onerror="bad()"> & 店員'}
]);
function orderFor(item,extra={}){
 return Object.freeze({type:'play',planName:'一起玩・2 小時',staffCid:item.cid,staffName:item.stored,status:'confirmed',createdAt:1700000000000,amount:250,...extra});
}
function checkMarkup(markup,item,label){
 assert(markup.includes(ctx.esc(item.expected)),label+' displays the resolved, escaped name');
 if(item.stored&&item.expected!==item.stored)assert(!markup.includes(item.stored),label+' does not expose the historical name');
 if(item.stored?.startsWith('<img'))assert(!markup.includes(item.stored),label+' does not inject raw HTML');
}
let cardCases=0,surfaceCases=0;
for(const item of cases){
 assert.equal(ctx.ttStaffDisplayName(item.cid,item.stored),item.expected,item.label);
 const initial=orderFor(item),before=JSON.stringify(initial);
 assert.equal(ctx.ttOrderStaffDisplayName(initial),item.expected,item.label+' order resolver');
 assert.equal(JSON.stringify(initial),before,'resolver preserves historical fields');
 for(const status of ['pending','confirmed','done','cancelled'])for(const group of [false,true]){
  const o=orderFor(item,{status,...(group?{groupId:'qa-group',groupSize:3,groupAmount:750,groupStaffNames:Object.freeze(['Caboo','大卡','小mo'])}:{})}),snapshot=JSON.stringify(o);
  const card=ctx.orderCard('qa-order',o),escaped=ctx.esc(item.expected);
  assert(card.includes('<small>與 '+escaped+' 一起玩</small>'),item.label+' '+status+' card heading');
  assert.equal(card.includes('這張為 '+escaped+' 的陪玩紀錄。'),group,item.label+' group description');
  if(group)assert(card.includes('整組實付 NT$ 750'),'group total is preserved');
  checkMarkup(card,item,'order card');assert.equal(JSON.stringify(o),snapshot,'card rendering preserves the order and group snapshot');cardCases++;
  ctx.myOrdersCache={'qa-order':o};ctx._ordTab=['done','cancelled'].includes(status)?'history':'active';ctx._ordOpen=new Set(['qa-order']);
  ctx.renderMyOrders();checkMarkup(nodes.ordList.innerHTML,item,'legacy '+status+' order renderer');
  checkMarkup(ctx.bkOrdLine(o).txt,item,'journal '+status+' entry');surfaceCases+=2;
 }
 ctx.myOrdersCache={'qa-order':initial};currentOrder=initial;
 ctx.openIssue('qa-order');checkMarkup(nodes.issueOrd.innerHTML,item,'issue summary');assert.equal(nodes.issueTx.value,'');
 checkMarkup(ctx.renewCardHtml(),item,'active play card');surfaceCases+=2;
 for(const list of [[],[{mins:30,price:125}]]){
  renewalOptions={end:Date.now()+3600000,nb:Date.now()+7200000,list};
  ctx.openRenew();checkMarkup(nodes.renewBody.innerHTML,item,'renewal dialog');
  const occurrences=nodes.renewBody.innerHTML.split(ctx.esc(item.expected)).length-1;
  assert.equal(occurrences,2,'both renewal heading and next-booking warning use the resolved name');surfaceCases++;
 }
 assert.equal(JSON.stringify(initial),before,'all auxiliary views preserve the order');
}
assert.equal(renderWrites,0,'rendering does not read or write the database');
for(const type of ['topup','shop','member']){
 const o={type,status:'done',createdAt:1700000000000,amount:99};
 assert(!ctx.orderCard('qa-other',o).includes('一起玩'),'non-play order does not gain a staff heading');
}

async function checkVoiceInbox(useLobbyOptions){
 const source=fs.readFileSync(path.join(root,'lobby-ui/voice-rehearsal.mjs'),'utf8');
 const element=tag=>({tag,children:[],style:{},textContent:'',append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(){},querySelectorAll(selector){return this.children.flatMap(child=>[...(child.tag===selector?[child]:[]),...child.querySelectorAll(selector)]);}});
 const inbox=element('div'),requests=[],received=[],notifications=[],storage=new Map();let stop,unsubscribed=0;
 const item=Object.freeze({id:'qa-voice',staffNames:Object.freeze(['Caboo','大卡','小mo','新店員']),customerName:'測試客人',startAt:1700000000000,url:'https://discord.com/channels/123/456',revision:1});
 const data=Object.freeze({items:Object.freeze([item])}),snapshot=JSON.stringify(data);
 const auth={currentUser:{uid:'qa-voice-user',getIdToken:async()=> 'isolated-token'},onAuthStateChanged:()=>()=>{unsubscribed++;}};
 const voice={API:'https://api.tinytavern.tw',Date,Set,AbortSignal:{timeout:()=>undefined},document:{createElement:element,getElementById:id=>id==='voiceInbox'?inbox:null},
  setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>data};},firebase:{auth:()=>auth},orderVoice:{update:items=>received.push(items)},lobbyNotify(){},shopOpen(){}};
 voice.window=voice;vm.createContext(voice);
 for(const name of ['ttStaffDisplayName'])vm.runInContext(sourceFunction(html,name),voice);
 vm.runInContext(sourceFunction(source,'mountVoiceInbox'),voice,{filename:'voice-rehearsal.mjs:mountVoiceInbox'});
 const realMount=voice.mountVoiceInbox;
 if(useLobbyOptions){
  // Run the real lobby mounting statement so a missing injection fails this test.
  const mountLine=html.split(/\r?\n/).find(line=>line.includes("const root=document.getElementById('voiceInbox');"));
  assert(mountLine,'lobby voice inbox mounting statement is present');
  voice.mountVoiceInbox=options=>{const notify=options.notify;stop=realMount({...options,notify:value=>{notifications.push(value);notify?.(value);}});};
  vm.runInContext(mountLine,voice,{filename:'lobby.html:voice inbox mount'});
 }else stop=realMount({root:inbox,auth,onItems:items=>received.push(items),notify:value=>notifications.push(value)});
 await new Promise(setImmediate);stop();
 const titles=inbox.querySelectorAll('strong').map(node=>node.textContent);
 assert.deepEqual(titles,['語音預約 · '+(useLobbyOptions?'蕪、縭、桃、新店員':'Caboo、大卡、小mo、新店員')],useLobbyOptions?'lobby injects formal display names':'shared module keeps the partner/default names');
 assert.equal(received.length,1);assert.equal(received[0],data.items,'onItems receives the original array');
 assert.equal(notifications.length,1);assert.equal(notifications[0],item,'notify receives the original item');
 assert.equal(JSON.stringify(data),snapshot,'voice response and historical staff names are unchanged');
 assert.equal(requests.length,1,'display conversion introduces no extra request');
 assert.equal(requests[0].url,'https://api.tinytavern.tw/v1/voice/inbox');assert.equal(requests[0].options.body,'{}','the only request is the existing read payload');
 assert.equal(unsubscribed,1,'the voice inbox listener is disposed');
}

(async()=>{
 // Exercise the existing renewal notification against an isolated write stub only.
 // The payload remains the original ID/plan/minutes/price fields, never a display name.
 const writes=[],notices=[];ctx.ROOT='local-only';ctx.myKey='qa';ctx.paintPlayCard=()=>{};ctx.lobbyNotify=value=>notices.push(value);
 ctx.db={ref:p=>({set:value=>{writes.push({path:p,value});return Promise.resolve();}})};
 vm.runInContext(sourceFunction(html,'doRenew'),ctx,{filename:'lobby.html:doRenew'});
 for(const person of people){
  const o=orderFor({cid:person.cid,stored:person.old}),snapshot=JSON.stringify(o);ctx.myOrdersCache={'qa-order':o};ctx._renewing=false;
  ctx.doRenew('qa-order',30,125);await new Promise(setImmediate);
  assert(notices.at(-1).sub.includes('正在跟 '+person.name+' 確認時間'),'renewal notification uses formal name');
  const written=writes.at(-1);assert.equal(written.path,'local-only/renewReq/qa-order');
  assert.deepEqual(Object.keys(written.value).sort(),['at','mins','myKey','planName','price','staffCid']);
  assert.equal(written.value.staffCid,person.cid);assert.equal(written.value.price,125);assert.equal(written.value.mins,30);
  assert.equal(JSON.stringify(o),snapshot,'renewal notification preserves the historical order');
 }
 assert.equal(writes.length,3);assert.equal(notices.length,3);
 await checkVoiceInbox(true);await checkVoiceInbox(false);
 console.log('PASS: '+cases.length+' name cases, '+cardCases+' current order cards, '+surfaceCases+' legacy/journal/issue/play/renewal views; escaped names, unchanged snapshots, zero render writes, three isolated renewal notifications; voice inbox lobby/default display, original callbacks/data and read-only request.');
})().catch(error=>{console.error(error);process.exitCode=1;});
