const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../lobby-ui/scene.js'),'utf8'),ctx);const s=ctx.TTScene;
// 櫃子左半部也必須阻擋，舊版錯誤通道不可再通過櫃體。
for(let x=1262;x<1415;x+=8)for(let y=300;y<378;y+=6){assert(!s.valid([x,y]));assert(s.valid(s.nearest([x,y])));}
for(const start of [[1248,330],[1318,400],[1430,330]]){
 let p=start;const goal=[1320,330];
 for(let i=0;i<150;i++){const d=Math.hypot(goal[0]-p[0],goal[1]-p[1]);if(d<1)break;p=s.slide(p,[p[0]+(goal[0]-p[0])/d*3,p[1]+(goal[1]-p[1])/d*3]);assert(s.valid(p));}
 assert(Math.hypot(p[0]-goal[0],p[1]-goal[1])>15);
}
// 後方與前方雙向通行，每一段、每一個腳底位置均不可穿越桌角或櫃子。
for(const [start,end] of [[[1100,305],[1350,460]],[[1350,460],[1100,305]]]){
 const route=s.route(start,end);assert.deepStrictEqual(Array.from(route.at(-1)),end);
 let last=start;for(const next of route){assert(s.clear(last,next));for(let t=0;t<=1;t+=.002)assert(s.valid([last[0]+(next[0]-last[0])*t,last[1]+(next[1]-last[1])*t]));last=next;}
 const a={x:start[0]/1600,y:start[1]/900,tx:end[0]/1600,ty:end[1]/900};
 for(let frame=0;frame<1500;frame++){const aim=s.target(a),dx=aim[0]*1600-a.x*1600,dy=aim[1]*900-a.y*900,d=Math.hypot(dx,dy);if(d<6&&!a._sceneTransit)break;const step=Math.min(2.5,d),p=s.nearest([a.x*1600+dx/d*step,a.y*900+dy/d*step]);assert(s.valid(p));a.x=p[0]/1600;a.y=p[1]/900;}
 assert(Math.hypot(a.x*1600-end[0],a.y*900-end[1])<7);
 console.log(JSON.stringify({start,end,route}));
}
console.log('櫃體網格阻擋、三側方向鍵碰撞、雙向通道與逐幀抵達：通過');
// 模擬實際掛載順序，枕頭不能再被攤販陰影或告示牌蓋掉，卡布仍在最上層。
ctx.document={createElement:()=>({dataset:{},style:{},setAttribute(){}})};
const layers=[];s.mount({append:el=>layers.push(el)});
const paint=layers.map((el,index)=>({id:el.dataset.layer,z:el.style.zIndex,index})).sort((a,b)=>a.z-b.z||a.index-b.index).map(el=>el.id);
assert(paint.indexOf('cushions')>paint.indexOf('stall'));
assert(paint.indexOf('cushions')>paint.indexOf('board'));
assert(paint.indexOf('white')>paint.indexOf('cushions'));
console.log('卡布枕頭、攤販陰影與告示牌疊放順序：通過');
