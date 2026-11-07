// v499 線上儲值（應援）：網站端按鈕、主機回應、付款頁回跳、店長頁標記。不連網路、不連資料庫。
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'lobby.html'),'utf8');
const a=html.indexOf("const PAY_API='https://pay.tinytavern.tw';"),b=html.indexOf('let tuProofData=null;',a);
assert(a>0&&b>a,'找不到線上儲值程式段');
const block=html.slice(a,b);

function setup(opt={}){
  const store=new Map(opt.storage||[]),calls=[],notes=[],toasts=[],nav=[],replaced=[];
  const reply=Object.assign({config:{ok:true,live:true,methods:['card','cvs','atm'],needEmail:false},topup:{ok:true,url:'https://tinytavern.oen.tw/checkout/T1',orderId:'ORD1'}},opt.reply);
  const c={
    URLSearchParams,JSON,Object,Promise,
    console,
    fetch:async(url,init)=>{calls.push({url,init});const body=url.endsWith('/api/pay-config')?reply.config:reply.topup;if(body instanceof Error)throw body;
      if(body==='NOT_JSON')return {json:async()=>{throw new SyntaxError('Unexpected token <');}};   // 舊版主機回 404 網頁
      return {json:async()=>body};},
    toast:m=>toasts.push(m),
    needCard:()=>!!opt.noCard,
    myKey:'K_me',ROOT:'peiwan',curTier:{amt:1000,bonus:100},
    firebase:{auth:()=>({currentUser:opt.signedOut?null:{getIdToken:async()=>'ID_TOKEN'}})},
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    myOrderIds:()=>{try{return JSON.parse(store.get('tt_orders')||'[]');}catch(e){return[];}},
    ttNavigate:u=>nav.push(u),
    lobbyNotify:n=>notes.push(n),
    dcAuth:()=>notes.push({login:true}),
    openTopup:()=>{},shopOpen:()=>{},
    db:{ref:p=>({once:async()=>({val:()=>(opt.orders||{})[p.split('/').pop()]||null})})},
    document:{getElementById:()=>null},
    location:{search:opt.search||'',pathname:'/lobby.html',hash:''},
    history:{replaceState:(s,t,u)=>replaced.push(u)},
    setTimeout:(fn)=>{fn();return 0;},
  };
  c.window=c;vm.createContext(c);vm.runInContext(block,c);
  return {c,calls,notes,toasts,nav,replaced,store,ready:()=>vm.runInContext('ONLINE_PAYMENT_READY',c)};
}
const flush=()=>new Promise(r=>setImmediate(r));

(async()=>{
  // 主機回報正式環境：線上付款開放，付款方式文字跟著設定
  let t=setup({reply:{config:{ok:true,live:true,methods:['card','cvs'],needEmail:false}}});await flush();
  assert.equal(t.ready(),true);assert.equal(t.c.ttPayMethodsText(),'信用卡、超商代碼');
  assert.equal(t.calls[0].url,'https://pay.tinytavern.tw/api/pay-config');

  // 主機還在測試環境：自動關閉，不會送出儲值
  t=setup({reply:{config:{ok:true,live:false,methods:['card']}}});await flush();
  assert.equal(t.ready(),false);
  assert.equal(await t.c.ttPayOnline({amt:1000}),false);
  assert(!t.calls.some(x=>x.url.endsWith('/api/topup')));assert(t.toasts.some(m=>m.includes('準備中')));

  // 主機連不上、還是舊版主機（沒有 pay-config）、沒說 live：一律準備中，不會送出儲值
  t=setup({reply:{config:new Error('offline')}});await flush();
  assert.equal(t.ready(),false);assert.equal(t.c.ttPayMethodsText(),'信用卡、超商代碼、ATM 轉帳');
  assert.equal(await t.c.ttPayOnline({amt:1000}),false);assert(!t.calls.some(x=>x.url.endsWith('/api/topup')));
  t=setup({reply:{config:'NOT_JSON'}});await flush();assert.equal(t.ready(),false);
  t=setup({reply:{config:{ok:true,methods:['card']}}});await flush();assert.equal(t.ready(),false);

  // 沒登入：不送出，提示用 Discord 登入
  t=setup({signedOut:true});await flush();
  assert.equal(await t.c.ttPayOnline({amt:1000}),false);
  assert(!t.calls.some(x=>x.url.endsWith('/api/topup')));assert(t.notes.some(n=>n.title==='先用 Discord 登入'));

  // 成功：帶登入憑證、金額；訂單記到本機清單；跳到應援付款頁
  t=setup({storage:[['tt_orders','["OLD"]']]});await flush();
  assert.equal(await t.c.ttPayOnline({amt:1000,bonus:100},{name:'阿明'}),true);
  const req=t.calls.find(x=>x.url==='https://pay.tinytavern.tw/api/topup');
  assert.equal(req.init.method,'POST');assert.equal(req.init.headers.Authorization,'Bearer ID_TOKEN');
  assert.deepEqual(JSON.parse(req.init.body),{amount:1000,myKey:'K_me',name:'阿明',email:''});
  assert.deepEqual(JSON.parse(t.store.get('tt_orders')),['OLD','ORD1']);
  assert.deepEqual(t.nav,['https://tinytavern.oen.tw/checkout/T1']);

  // 應援要求 Email：叫出 Email 欄位
  let asked=0;t=setup({reply:{topup:{ok:false,code:'EMAIL_REQUIRED'}}});await flush();
  assert.equal(await t.c.ttPayOnline({amt:1000},{onEmail:()=>asked++}),false);
  assert.equal(asked,1);assert.equal(t.c.__payCfg.needEmail,true);assert.equal(t.nav.length,0);

  // 主機說還沒上線：之後也不再嘗試
  t=setup({reply:{topup:{ok:false,code:'NOT_LIVE'}}});await flush();
  assert.equal(await t.c.ttPayOnline({amt:1000}),false);assert.equal(t.ready(),false);

  // 其他錯誤：都有對應提示、不會跳頁
  for(const [code,word] of [['LOGIN_REQUIRED',null],['BAD_AMOUNT','重新選'],['TOO_MANY','幾分鐘'],['BUSY','忙線'],['BAD_EMAIL','Email']]){
    t=setup({reply:{topup:{ok:false,code}}});await flush();
    assert.equal(await t.c.ttPayOnline({amt:1000}),false);assert.equal(t.nav.length,0);
    if(word)assert(t.toasts.some(m=>m.includes(word)),code);else assert(t.notes.some(n=>n.title==='先用 Discord 登入'));
  }
  t=setup({reply:{topup:new Error('network')}});await flush();
  assert.equal(await t.c.ttPayOnline({amt:1000}),false);assert(t.toasts.some(m=>m.includes('連不上')));

  // 付款成功回跳：訂單加回清單、網址參數清掉、已入帳就恭喜
  t=setup({search:'?pay=ok&order=ORD9&v=499',orders:{ORD9:{type:'topup',status:'done',coinAmount:1100}}});await flush();await flush();
  assert.deepEqual(JSON.parse(t.store.get('tt_orders')),['ORD9']);
  assert.deepEqual(t.replaced,['/lobby.html?v=499']);
  assert(t.notes.some(n=>n.title==='金幣已入帳!'&&n.sub.includes('1100')));
  // 超商代碼：提醒去繳費
  t=setup({search:'?pay=ok&order=ORD8',orders:{ORD8:{type:'topup',status:'pending',payCode:{kind:'cvs',code:'X1'}}}});await flush();await flush();
  assert(t.notes.some(n=>n.title==='記得到超商繳費'));assert.deepEqual(t.replaced,['/lobby.html']);
  // 還在確認：不宣稱成功
  t=setup({search:'?pay=ok&order=ORD7',orders:{ORD7:{type:'topup',status:'pending'}}});await flush();await flush();
  assert(t.notes.some(n=>n.title==='已返回酒館'));assert(!t.notes.some(n=>n.title==='金幣已入帳!'));
  // 奇怪的訂單編號不收
  t=setup({search:'?pay=ok&order=a%2Fb'});await flush();await flush();
  assert.equal(t.store.get('tt_orders'),undefined);
  // 付款失敗回跳（應援加上 payment_error）
  t=setup({search:'?payment_error=T0004'});await flush();
  assert(t.notes.some(n=>n.title==='付款沒有完成'&&n.sub.includes('換一張卡')));assert.deepEqual(t.replaced,['/lobby.html']);
  t=setup({search:'?payment_error=V0003&v=1'});await flush();
  assert(t.notes.some(n=>n.title==='付款確認中'));assert.deepEqual(t.replaced,['/lobby.html?v=1']);
  // 一般進場不動網址
  t=setup({search:'?v=499'});await flush();assert.equal(t.replaced.length,0);assert.equal(t.notes.length,0);

  // 回跳網址：主機送給應援的成功網址會帶 pay=ok&order=，失敗網址不帶 ?（應援會自己加 ?payment_error=）
  const srvFile=process.env.TT_PAY_SERVER||'C:/tinytavern/server/lib/topup.js';   // 付款主機程式不在 repo 裡，有才檢查
  if(fs.existsSync(srvFile)){const srv=fs.readFileSync(srvFile,'utf8');
    assert(srv.includes("'/lobby.html?pay=ok&order=' + orderId"));assert(srv.includes("failureUrl: siteBase + '/lobby.html',"));}

  // 店長頁：線上付款不列待核帳、沒有手動確認收款；標記付款進度
  const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  assert(admin.includes("o.status==='pending'&&o.payChannel!=='oen');\n")||admin.includes("o.status==='pending'&&o.payChannel!=='oen');\r\n"));
  assert(admin.includes("+(o.status==='pending'&&o.payChannel!=='oen'?'<button onclick=\"coSet("));
  const s=admin.indexOf('function oenBadge(o){'),e=admin.indexOf('function topupTampered(o){',s);
  const ac={esc:x=>String(x)};vm.createContext(ac);vm.runInContext(admin.slice(s,e),ac);
  assert(ac.oenBadge({creditedAt:1,payMethod:'card',oenHid:'P1'}).includes('信用卡・已自動入帳・P1'));
  assert(ac.oenBadge({payAbandoned:true}).includes('未完成付款'));
  assert(ac.oenBadge({payCode:{kind:'cvs'}}).includes('等超商繳費'));
  assert(ac.oenBadge({payAlert:'同一筆儲值付款成功 2 次'}).includes('⚠ 同一筆'));
  assert(ac.oenBadge({testOnly:true}).includes('測試'));

  // 客人看得到的新文字不能有禁用字
  const added=block+fs.readFileSync(path.join(root,'lobby-ui/mobile-app.js'),'utf8').split('v499')[1];
  for(const w of ['陪玩','店員','服務','金流','透明','乾淨','無擦邊','虛擬角色','下單'])assert(!added.includes(w),'禁用字：'+w);
  console.log('PASS: v499 線上儲值——主機開關、付款方式文字、未登入、成功跳轉與訂單記錄、Email、各種錯誤、成功/超商/確認中/失敗回跳、網址清理、店長頁標記');
})().catch(e=>{console.error(e);process.exitCode=1;});
