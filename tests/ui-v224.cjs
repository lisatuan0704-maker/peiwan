const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..'),js=fs.readFileSync(path.join(root,'tavern-ui/live-wardrobe.js'),'utf8');
const parts=[['back','hair'],['front','hair'],['eye','eye'],['cloth','cloth']].map(([slot,category])=>({slot,category,source:'cloth0',id:'cloth0::'+slot}));
const data={catalog:[{id:'cloth0',owned:true,parts}],baseParts:Object.fromEntries(['back','front','face','cloth'].map(s=>[s,{items:[{idx:0,n:'重複款'},{idx:3,n:'保留款'}]}]))};
const ctx={data,selection:{},area:'bag',category:'hair',filter:'all'};
vm.runInNewContext(js.match(/const key=p=>[^\n]+/)[0]+js.match(/function isTrying\([^]*?\n }/)[0]+js.match(/function products\([^\n]+/)[0]+js.match(/function entries\([^]*?\n }/)[0],ctx);
for(const category of ['hair','eye','cloth']){
 ctx.category=category;const list=ctx.entries();
 assert(list.every(p=>p.base!==0),'已擁有同款時移除重複原有部件');
 assert(list.some(p=>p.base===3),'其他款式必須保留');
 assert(list.some(p=>p.source==='cloth0'),'保留指定的第一款');
}
for(const p of parts){ctx.selection[p.slot]={base:0,slot:p.slot};assert(ctx.isTrying(p),'舊穿搭對應保留卡片');}
data.catalog=[];ctx.category='hair';assert(ctx.entries().some(p=>p.base===0),'缺少替代部件時不得讓原有部件消失');
const html=fs.readFileSync(path.join(root,'lobby.html'),'utf8');
const cta={textContent:''},sub={textContent:''},b={style:{display:'none'},setAttribute(){},querySelector:()=>cta};
let tables=[];
const tableCtx={document:{getElementById:id=>({tbMenuBtn:b,tbMenuSub:sub}[id])},tbSellable:()=>tables};
vm.runInNewContext(html.match(/function tbMenuRefresh\([^]*?renderTbList\(\); }/)[0],tableCtx);
tableCtx.tbMenuRefresh();assert(b.disabled&&b.style.display===''&&cta.textContent==='尚未開放');
tables=[['test',{taken:0,seats:3}]];tableCtx.tbMenuRefresh();assert(!b.disabled&&cta.textContent==='看場次 →');
tables=[['test',{taken:3,seats:3}]];tableCtx.tbMenuRefresh();assert(!b.disabled&&sub.textContent.includes('已滿'));
tables=[];tableCtx.tbMenuRefresh();assert(b.disabled&&cta.textContent==='尚未開放');
console.log('重複項目移除、舊穿搭相容、缺少替代款保留、併桌未開放／開放／額滿狀態：通過');
