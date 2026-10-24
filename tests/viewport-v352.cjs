const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('lobby-ui/fixed-view.js','utf8');
function run({framed=false,desktop=true,preview=false}={}){const calls=[],handlers={},location={pathname:'/lobby.html',search:preview?'?preview=1':'?v=352',hash:'#room',replace:url=>calls.push(['replace',url]),assign:url=>calls.push(['self',url])},window={location};window.top=framed?{}:window;window.self=window;window.parent=framed?{location:{pathname:'/lobby-view.html',assign:url=>calls.push(['parent',url])}}:window;const c={window,location,document:{documentElement:{classList:{add(){}}},addEventListener:(type,fn)=>handlers[type]=fn},matchMedia:()=>({matches:desktop}),URLSearchParams};vm.runInNewContext(src,c);return {calls,window,handlers};}
assert.deepEqual(run().calls,[['replace','lobby-view.html?v=367#room']]);
assert.equal(run({desktop:false}).calls.length,0,'touch/mobile keeps the responsive lobby');
assert.equal(run({preview:true}).calls.length,0,'local fixture remains isolated');
const framed=run({framed:true});assert.equal(framed.calls.length,0,'no recursive frame');
framed.window.ttNavigate('https://discord.com/oauth2/authorize?test');assert.deepEqual(framed.calls.pop(),['parent','https://discord.com/oauth2/authorize?test'],'OAuth must navigate the outer window');
framed.window.ttNavigate('card.html');assert.deepEqual(framed.calls.pop(),['parent','card.html']);
const plain=run({desktop:false});plain.window.ttNavigate('card.html');assert.deepEqual(plain.calls.pop(),['self','card.html']);
const voice=[];const voiceContext={window:{ttNavigate:url=>voice.push(url)},sessionStorage:{setItem(){}},location:{origin:'https://tinytavern.tw',assign(){throw Error('OAuth must leave frame')}},TTDiscordAuth:{begin:()=> 'https://discord.com/oauth2/authorize?test'}};
vm.runInNewContext(fs.readFileSync('lobby-ui/voice-rehearsal.mjs','utf8').replace(/export /g,''),voiceContext);voiceContext.beginVoiceLogin();voiceContext.beginRehearsal('test');assert.equal(voice.length,2);
console.log('PASS: desktop route, mobile route, preview bypass, no iframe loop, top-level login and card navigation');
