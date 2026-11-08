// v504 規則測試：小屋串門子（houseView 擺設快照、houseDir 隨機名單、houseVisit 來玩紀錄、house/<key>/vis 開放設定、
// houseRoom 四個座位、houseKick 請人離開、houseChat 小屋聊天）。
'use strict';
const fs=require('fs');const {req,setRules,seed}=require('./emu.cjs');
const [,,oldFile,newFile]=process.argv;
const U=n=>({uid:'discord_10000000000000000'+n});
const ME=U(1),FRIEND=U(2),STRANGER_M=U(3),ADMIN={uid:'admin1'},EMAIL={uid:'email_stranger'};
const H=3600000,TS={'.sv':'timestamp'};
const LAY=[{t:'vr_bed',i:0,j:0,dir:0},{t:'vr_rug',i:5,j:5,dir:0},{t:'vr_window',wall:'R',c:6,dir:1}];
const view=(vis,o={})=>({layout:LAY,vis,at:TS,name:'小明',n:3,...o});
// k1＝主人（小明）、k2＝好友（小華，互為好友）、k3＝不認識的老闆（小美）
const data=setup=>{
 const now=Date.now();
 const p={config:{adminUid:'admin1'},lobby:{k1:{name:'小明'},k2:{name:'小華'},k3:{name:'小美'}},
  friends:{k1:{k2:{name:'小華',at:now}},k2:{k1:{name:'小明',at:now}}},
  house:{k1:{layout:LAY,at:now}},shopConfig:{'house:vr_desk':{name:'書桌',price:20,cur:'cat',type:'小屋家具'}}};
 if(setup==='pub'||setup==='fr'){p.houseView={k1:{...view(setup==='pub'?'public':'friends'),at:now}};if(setup==='pub')p.houseDir={k1:{at:now,n:3}};
  p.houseVisit={k1:{k3:{name:'小美',at:now},k2:{name:'小華',at:now,like:true}}};}
 const seat=(k,name,o={})=>({k,name,i:5,j:5,f:1,at:now,...o});
 // 座位：主人坐 0 號；in＝小美坐 2 號；full＝四個都有人；stale＝3 號那位 60 秒沒回報
 const S0=setup||'';
 if(/^(pub|fr|in|full|stale|kicked|blocked|muted)/.test(S0)){
  if(!p.houseView)p.houseView={k1:{...view('public'),at:now}};
  if(!p.houseDir&&p.houseView.k1.vis==='public')p.houseDir={k1:{at:now,n:3}};
  p.houseRoom={k1:{'0':seat('k1','小明')}};
  if(/^(in|muted)/.test(S0))p.houseRoom.k1['2']=seat('k3','小美');
  if(S0==='full'||S0==='stale'){p.houseRoom.k1['1']=seat('k2','小華');p.houseRoom.k1['2']=seat('kA','阿光');p.houseRoom.k1['3']=seat('kB','布丁',S0==='stale'?{at:now-60000}:{});}
  if(S0==='kicked')p.houseKick={k1:{k3:now-60000}};
  if(S0==='kicked-old')p.houseKick={k1:{k3:now-11*60000}};
  if(S0==='blocked')p.blocks={k1:{k3:true}};
  if(S0==='muted')p.mutes={k3:{until:-1}};
  if(S0==='muted-old')p.mutes={k3:{until:now-1000}};
  p.houseChat={k1:{m0:{f:'k1',n:'小明',x:'歡迎！',s:'0',at:now}}};}
 return {secureV1:{members:{[ME.uid]:{active:true,key:'k1'},[FRIEND.uid]:{active:true,key:'k2'},[STRANGER_M.uid]:{active:true,key:'k3'}},
  owners:{k1:ME.uid,k2:FRIEND.uid,k3:STRANGER_M.uid}},peiwan:p};
};
// [名稱, 身分, 方法, 路徑, 內容, 預期, 初始資料]
const cases=[
 ['主人發布公開快照＋隨機名單（同一次寫入）','me','PATCH','peiwan',{'houseView/k1':view('public'),'houseDir/k1':{at:TS,n:3}},true,'none'],
 ['主人發布只限好友的快照','me','PUT','peiwan/houseView/k1',view('friends'),true,'none'],
 ['只限好友卻放進隨機名單','me','PATCH','peiwan',{'houseView/k1':view('friends'),'houseDir/k1':{at:TS,n:3}},false,'none'],
 ['沒有快照就放進隨機名單','me','PUT','peiwan/houseDir/k1',{at:TS,n:3},false,'none'],
 ['把公開改成只限好友，忘了拿掉隨機名單','me','PUT','peiwan/houseView/k1/vis','friends',true,'pub'],
 ['別人幫我寫快照','stranger','PUT','peiwan/houseView/k1',view('public'),false,'none'],
 ['別人把我放進隨機名單','stranger','PUT','peiwan/houseDir/k1',{at:TS,n:3},false,'pub'],
 ['快照放沒上架的家具','me','PUT','peiwan/houseView/k1',view('public',{layout:[{t:'vx_secret',i:0,j:0,dir:0}]}),false,'none'],
 ['快照放有上架的家具','me','PUT','peiwan/houseView/k1',view('public',{layout:[{t:'vr_desk',i:1,j:1,dir:0}]}),true,'none'],
 ['快照多帶錢包欄位','me','PUT','peiwan/houseView/k1',view('public',{wallet:999}),false,'none'],
 ['快照 vis 寫 private（不公開應該整筆刪）','me','PUT','peiwan/houseView/k1',view('private'),false,'none'],
 ['快照名字超過 40 字','me','PUT','peiwan/houseView/k1',view('public',{name:'名'.repeat(41)}),false,'none'],
 ['快照時間寫未來','me','PUT','peiwan/houseView/k1',view('public',{at:Date.now()+H}),false,'none'],
 ['主人改成不公開（快照＋名單一起刪）','me','PATCH','peiwan',{'houseView/k1':null,'houseDir/k1':null},true,'pub'],
 ['別人刪我的快照','stranger','DELETE','peiwan/houseView/k1',undefined,false,'pub'],
 ['主人存開放設定 friends','me','PUT','peiwan/house/k1/vis','friends',true,'none'],
 ['主人存開放設定 private','me','PUT','peiwan/house/k1/vis','private',true,'none'],
 ['開放設定寫奇怪的值','me','PUT','peiwan/house/k1/vis','everyone',false,'none'],
 ['別人改我的開放設定','stranger','PUT','peiwan/house/k1/vis','public',false,'none'],
 ['不認識的老闆看公開小屋','stranger','GET','peiwan/houseView/k1',undefined,true,'pub'],
 ['不認識的老闆看只限好友的小屋','stranger','GET','peiwan/houseView/k1',undefined,false,'fr'],
 ['好友看只限好友的小屋','friend','GET','peiwan/houseView/k1',undefined,true,'fr'],
 ['主人看自己的快照','me','GET','peiwan/houseView/k1',undefined,true,'fr'],
 ['未登入看公開小屋',null,'GET','peiwan/houseView/k1',undefined,false,'pub'],
 ['沒有闆卡的 Email 帳號看公開小屋','email','GET','peiwan/houseView/k1',undefined,false,'pub'],
 ['店長看快照','admin','GET','peiwan/houseView/k1',undefined,true,'fr'],
 ['老闆列出隨機名單','stranger','GET','peiwan/houseDir',undefined,true,'pub'],
 ['未登入列出隨機名單',null,'GET','peiwan/houseDir',undefined,false,'pub'],
 ['列出全部快照（不能整包讀）','stranger','GET','peiwan/houseView',undefined,false,'pub'],
 ['老闆讀別人原本的小屋紀錄（含開放設定）','stranger','GET','peiwan/house/k1',undefined,false,'pub'],
 ['訪客留下拜訪紀錄','stranger','PUT','peiwan/houseVisit/k1/k3',{name:'小美',at:TS},true,'pub'],
 ['訪客按讚','stranger','PATCH','peiwan/houseVisit/k1/k3',{like:true,at:TS},true,'pub'],
 ['訪客收回讚','stranger','PATCH','peiwan/houseVisit/k1/k3',{like:false,at:TS},true,'pub'],
 ['訪客替別人留紀錄','stranger','PUT','peiwan/houseVisit/k1/k2',{name:'小華',at:TS,like:true},false,'pub'],
 ['不是好友去只限好友的小屋留紀錄','stranger','PUT','peiwan/houseVisit/k1/k3',{name:'小美',at:TS},false,'fr'],
 ['好友去只限好友的小屋留紀錄','friend','PUT','peiwan/houseVisit/k1/k2',{name:'小華',at:TS,like:true},true,'fr'],
 ['去不公開（沒有快照）的小屋留紀錄','stranger','PUT','peiwan/houseVisit/k1/k3',{name:'小美',at:TS},false,'none'],
 ['主人在自己家留紀錄（自己按讚）','me','PUT','peiwan/houseVisit/k1/k1',{name:'小明',at:TS,like:true},false,'pub'],
 ['讚寫成文字','stranger','PATCH','peiwan/houseVisit/k1/k3',{like:'yes'},false,'pub'],
 ['拜訪紀錄多帶欄位','stranger','PUT','peiwan/houseVisit/k1/k3',{name:'小美',at:TS,gift:100},false,'pub'],
 ['拜訪紀錄沒有名字','stranger','PUT','peiwan/houseVisit/k1/k3',{at:TS},false,'pub'],
 ['拜訪時間寫未來','stranger','PUT','peiwan/houseVisit/k1/k3',{name:'小美',at:Date.now()+H},false,'pub'],
 ['主人刪掉訪客紀錄','me','DELETE','peiwan/houseVisit/k1/k3',undefined,true,'pub'],
 ['訪客刪掉自己的紀錄','stranger','DELETE','peiwan/houseVisit/k1/k3',undefined,false,'pub'],
 ['訪客刪掉別人的紀錄','stranger','DELETE','peiwan/houseVisit/k1/k2',undefined,false,'pub'],
 ['主人讀拜訪紀錄','me','GET','peiwan/houseVisit/k1',undefined,true,'fr'],
 ['看得到小屋的人讀拜訪紀錄（算讚數）','stranger','GET','peiwan/houseVisit/k1',undefined,true,'pub'],
 ['看不到小屋的人讀拜訪紀錄','stranger','GET','peiwan/houseVisit/k1',undefined,false,'fr'],
 ['未登入讀拜訪紀錄',null,'GET','peiwan/houseVisit/k1',undefined,false,'pub'],
 // ── 座位（最多 4 人）──
 ['主人坐進自己的小屋（不公開也可以）','me','PUT','peiwan/houseRoom/k1/0',{k:'k1',name:'小明',i:5,j:5,f:1,at:TS},true,'none'],
 ['客人坐進公開小屋的空位','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},true,'pub'],
 ['不是好友坐進只限好友的小屋','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},false,'fr'],
 ['好友坐進只限好友的小屋','friend','PUT','peiwan/houseRoom/k1/2',{k:'k2',name:'小華',i:6,j:6,f:-1,at:TS},true,'fr'],
 ['坐進不公開（沒有快照）的小屋','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},false,'none'],
 ['坐到主人的座位上','stranger','PUT','peiwan/houseRoom/k1/0',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},false,'pub'],
 ['四個座位都滿了還硬坐','stranger','PUT','peiwan/houseRoom/k1/3',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},false,'full'],
 ['接手斷線超過 45 秒的座位','stranger','PUT','peiwan/houseRoom/k1/3',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},true,'stale'],
 ['用別人的名義坐下','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k2',name:'小華',i:6,j:6,f:1,at:TS},false,'pub'],
 ['坐第 5 個座位（編號 4）','stranger','PUT','peiwan/houseRoom/k1/4',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},false,'pub'],
 ['被主人請出 10 分鐘內又坐下','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},false,'kicked'],
 ['被請出超過 10 分鐘可以再來','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},true,'kicked-old'],
 ['被主人封鎖的人坐下','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS},false,'blocked'],
 ['更新自己的位置','stranger','PATCH','peiwan/houseRoom/k1/2',{i:7.5,j:3.25,f:-1,at:TS},true,'in'],
 ['起身離開（刪自己的座位）','stranger','DELETE','peiwan/houseRoom/k1/2',undefined,true,'in'],
 ['客人把主人的座位刪掉','stranger','DELETE','peiwan/houseRoom/k1/0',undefined,false,'in'],
 ['主人請客人離開（刪座位＋記下時間）','me','PATCH','peiwan',{'houseRoom/k1/2':null,'houseKick/k1/k3':TS},true,'in'],
 ['客人自己寫請出紀錄','stranger','PUT','peiwan/houseKick/k1/k2',TS,false,'in'],
 ['座位多帶欄位','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:6,j:6,f:1,at:TS,vip:5},false,'pub'],
 ['位置寫到房間外很遠','stranger','PUT','peiwan/houseRoom/k1/2',{k:'k3',name:'小美',i:99,j:6,f:1,at:TS},false,'pub'],
 ['看得到小屋的人讀座位','stranger','GET','peiwan/houseRoom/k1',undefined,true,'pub'],
 ['看不到小屋的人讀座位','stranger','GET','peiwan/houseRoom/k1',undefined,false,'fr'],
 ['未登入讀座位',null,'GET','peiwan/houseRoom/k1',undefined,false,'pub'],
 ['被請出的本人讀自己的請出時間','stranger','GET','peiwan/houseKick/k1/k3',undefined,true,'kicked'],
 ['別人讀整份請出名單','stranger','GET','peiwan/houseKick/k1',undefined,false,'kicked'],
 ['主人更新「在家」時間','me','PUT','peiwan/houseDir/k1/on',TS,true,'pub'],
 // ── 小屋聊天 ──
 ['坐在小屋裡說話','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k3',n:'小美',x:'嗨～',s:'2',at:TS},true,'in'],
 ['沒坐下就說話','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k3',n:'小美',x:'嗨～',s:'2',at:TS},false,'pub'],
 ['說話時冒用主人的座位','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k3',n:'小美',x:'嗨～',s:'0',at:TS},false,'in'],
 ['冒名說話','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k1',n:'小明',x:'嗨～',s:'0',at:TS},false,'in'],
 ['被禁言的人說話','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k3',n:'小美',x:'嗨～',s:'2',at:TS},false,'muted'],
 ['禁言到期後說話','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k3',n:'小美',x:'嗨～',s:'2',at:TS},true,'muted-old'],
 ['訊息超過 120 字','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k3',n:'小美',x:'哈'.repeat(121),s:'2',at:TS},false,'in'],
 ['空白訊息','stranger','PUT','peiwan/houseChat/k1/m1',{f:'k3',n:'小美',x:'',s:'2',at:TS},false,'in'],
 ['改掉主人說過的話','stranger','PUT','peiwan/houseChat/k1/m0',{f:'k3',n:'小美',x:'改掉',s:'2',at:TS},false,'in'],
 ['主人刪掉一則訊息','me','DELETE','peiwan/houseChat/k1/m0',undefined,true,'in'],
 ['客人刪掉主人的訊息','stranger','DELETE','peiwan/houseChat/k1/m0',undefined,false,'in'],
 ['看得到小屋的人讀聊天','stranger','GET','peiwan/houseChat/k1',undefined,true,'pub'],
 ['未登入讀聊天',null,'GET','peiwan/houseChat/k1',undefined,false,'pub'],
];
(async()=>{
 let pass=0,fail=0;
 for(const [rulesFile,label] of [[oldFile,'舊規則'],[newFile,'新規則']]){
  const rules=JSON.parse(fs.readFileSync(rulesFile,'utf8'));
  const ns='p14'+label.charCodeAt(0);await setRules(ns,rules);
  for(const [name,who,method,p,body,expect,setup] of cases){
   await seed(ns,data(setup));
   const w={me:ME,friend:FRIEND,stranger:STRANGER_M,admin:ADMIN,email:EMAIL}[who]||null;
   const r=await req(ns,method,p,body,w);
   if(label==='新規則'){if(r.ok===expect)pass++;else{fail++;console.log('✗',name,'預期',expect?'允許':'拒絕','實際',r.ok?'允許':'拒絕',r.body.slice(0,160));}}
   else console.log((r.ok?'舊規則允許':'舊規則拒絕')+'｜'+name);
  }
 }
 // 公開改成只限好友之後，名單那筆就算還在，也只是一筆 {at,n}；不認識的人打開快照會被擋
 {
  const ns='p14seq';await setRules(ns,JSON.parse(fs.readFileSync(newFile,'utf8')));await seed(ns,data('pub'));
  const a=await req(ns,'PUT','peiwan/houseView/k1/vis','friends',ME),b=await req(ns,'GET','peiwan/houseView/k1',undefined,STRANGER_M),c=await req(ns,'GET','peiwan/houseView/k1',undefined,FRIEND);
  if(a.ok&&!b.ok&&c.ok)pass++;else{fail++;console.log('✗ 公開改只限好友後的讀取',a.ok,b.ok,c.ok);}
 }
 console.log((fail?'FAIL':'PASS')+': phase14 '+pass+'/'+(pass+fail));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
