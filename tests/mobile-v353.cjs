const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('lobby-ui/fixed-view.js','utf8');
function boot(fine,width,height,search='',store={}){const classes=[],redirects=[],location={search,hash:'',replace:s=>redirects.push(s)},window={innerWidth:width,innerHeight:height,location};window.top=window.self=window.parent=window;
 const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);}};
 vm.runInNewContext(source,{window,location,URLSearchParams,localStorage,matchMedia:()=>({matches:fine}),document:{documentElement:{classList:{add:c=>classes.push(c)}},addEventListener(){}}});return {window,classes,redirects,store};}
for(const [w,h] of [[390,844],[844,390]]){const r=boot(false,w,h,'',{tt_mgame:'0'});assert(r.window.TTMobile);assert(r.classes.includes('tt-mobile'));assert.equal(r.redirects.length,0);}
// v546 手機預設遊戲畫面（沒設定過＝開）
{const r=boot(false,390,844);assert.equal(r.window.TTGame,true);assert(r.classes.includes('ttm-game'));assert.equal(r.redirects.length,0);}
assert.equal(boot(true,390,844).window.TTMobile,false,'a narrow desktop keeps the fixed desktop layout');
const html=fs.readFileSync('lobby.html','utf8'),start=html.indexOf('function tick(now){'),stop=html.indexOf('  if(document.hidden)',start);let scheduled=0;
vm.runInNewContext(html.slice(start,stop)+'}',{window:{TTMobile:true},last:0,requestAnimationFrame:()=>scheduled++});
const c={window:{TTMobile:true},last:0,requestAnimationFrame:()=>scheduled++};vm.createContext(c);vm.runInContext(html.slice(start,stop)+'}',c);c.tick(123);assert.equal(c.last,123);assert.equal(scheduled,1,'mobile skips world rendering and all position publication');
// v539 手機遊戲式畫面（TTGame）：有大廳場景，tick 不在第一行就跳掉（往下走到 document.hidden 判斷）
{let hit=0;const g={window:{TTMobile:true,TTGame:true},last:0,requestAnimationFrame:()=>hit++};vm.createContext(g);vm.runInContext(html.slice(start,stop)+'}',g);g.tick(456);assert.equal(hit,0,'game mode does not skip the world tick');assert.equal(g.last,0);}
// v539 開關：?game=1 記在這台、?game=0 關掉；電腦（精細滑鼠）不受影響；遊戲模式不加 tt-mobile（mobile-home.css 會把大廳藏起來）
{const st={};const r=boot(false,390,844,'?game=1',st);assert.equal(r.window.TTGame,true);assert(r.classes.includes('ttm-game'));assert(!r.classes.includes('tt-mobile'));assert.equal(st.tt_mgame,'1');
 const r2=boot(false,390,844,'',st);assert.equal(r2.window.TTGame,true,'remembered on this device');
 const r3=boot(false,390,844,'?game=0',st);assert.equal(r3.window.TTGame,false);assert(r3.classes.includes('tt-mobile'));
 const r4=boot(true,1280,800,'',{tt_mgame:'1'});assert.equal(r4.window.TTGame,false,'desktop never uses game mode');}
assert(!html.includes('把手機轉橫,體驗完整 2.5D'));
assert(html.includes("function isPortraitHome(){ return !!window.TTMobile&&!window.TTGame; }"));
console.log('PASS: portrait and landscape functional mode, narrow desktop route, no mobile world tick/publication, no enter-lobby prompt; v546 game mode default, ?game=0 switch, world tick runs, no tt-mobile');
