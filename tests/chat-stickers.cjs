const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const context={window:{},console};vm.createContext(context);
for(const file of ['tavern-ui/sticker-catalog.js','tavern-ui/sticker-approved.js','lobby-ui/stickers.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const api=context.window.TTChatStickers;
for(let n=1;n<=10;n++){const id='sticker-'+String(n).padStart(2,'0'),code=api.encode(id);assert.equal(api.decode(code).id,id);assert.ok(Array.from(code).length<=18);}
for(const text of ['[貼圖:sticker-11]','[貼圖:https://example.com/a.png]','[貼圖:sticker-01]x','安安','<img src=x>'])assert.equal(api.decode(text),null);
assert.equal(api.encode('unknown'),null);assert.equal(api.durationMs,5000);
const html=fs.readFileSync(path.join(root,'lobby.html'),'utf8');
const start=html.indexOf('function sendChat(stickerCode)'),end=html.indexOf('window.TTBubbleCalibration.bindInput',start);
const input={value:'保留草稿'},writes=[],logs=[];let mode='member';
Object.assign(context,{document:{getElementById:()=>input},me:()=>mode==='guest'?null:{b:{name:'測試'}},myKey:'local-test',curMap:'hall',ROOT:'local-only',showBubble:()=>{},statInc:()=>{},pushLog:(...args)=>logs.push(args),db:{ref:()=>({push:()=>({key:'message',set:msg=>{writes.push(msg);return Promise.resolve();}})})}});
context.window.TTBubbleCalibration={clip:s=>Array.from(s).slice(0,18).join('')};
vm.runInContext(html.slice(start,end),context);
assert.equal(context.sendChat(api.encode('sticker-01')),true);assert.equal(writes.length,1);assert.equal(input.value,'保留草稿');assert.equal(writes[0].text,'[貼圖:sticker-01]');
mode='guest';assert.equal(context.sendChat(api.encode('sticker-02')),false);assert.equal(writes.length,1);
mode='member';context.window.__mute={until:-1};assert.equal(context.sendChat(api.encode('sticker-02')),false);assert.equal(writes.length,1);
context.window.__mute=null;input.value='字'.repeat(20);context.sendChat();assert.equal(writes.at(-1).text.length,18);assert.equal(input.value,'');
console.log('PASS: ten allowed stickers, invalid codes rejected, 5-second lifetime, draft preserved, guest and mute gates, text cap');
