const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const context={window:{},Intl};
vm.runInNewContext(fs.readFileSync(path.join(root,'lobby-ui/bubble-calibration.js'),'utf8'),context);
const api=context.window.TTBubbleCalibration;
for(const [text,expected] of [
 ['安安',[.5,24.5,97,108,13.5,1.15,109]],
 ['今天也一起玩吧！',[.5,24.5,129,154.05,13,1.15,167.12]],
 ['大家晚上好，今天要不要一起玩遊戲呢？',[4.01,26.05,158.71,132.49,10,1.3,141.26]]
]){
 const s=api.settings(text);['offsetX','offsetY','widthPercent','heightPercent','fontSize','lineHeight','maxWidth'].forEach((key,i)=>assert.equal(s[key],expected[i],key));
}
assert.equal(api.settings('好').fontSize,13.5);
assert.equal(api.settings('一二三四五').fontSize,13.25);
assert.equal(api.settings('一二三四五六七八九十甲乙丙').fontSize,11.5);
const emoji='👨‍👩‍👧‍👦';assert.equal(api.clip(emoji.repeat(19)),emoji.repeat(18));
assert.equal(api.clip('e\u0301'.repeat(19)),'e\u0301'.repeat(18));
const listeners={},input={value:'',addEventListener:(name,fn)=>listeners[name]=fn};api.bindInput(input);
listeners.compositionstart();input.value='字'.repeat(19);listeners.input();assert.equal(input.value.length,19);
listeners.compositionend();assert.equal(input.value.length,18);
input.value='字'.repeat(25);listeners.input();assert.equal(input.value.length,18);
const html=fs.readFileSync(path.join(root,'lobby.html'),'utf8');
let count=0;for(const match of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)){if(match[1].trim()){new vm.Script(match[1]);count++;}}
assert.match(html,/if\(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229\)/);
assert.match(html,/text:t, map:curMap/);
console.log('PASS: three anchors, interpolation, grapheme cap, IME, '+count+' lobby scripts');
