// v428 lobby-ui/secure-login.js：伺服器登入、錯誤訊息、帳號比對與換裝置找回（不連正式服務）。
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../lobby-ui/secure-login.js'),'utf8');
function env({fetchResult,user=null,accountKey=null}={}){
  const store=new Map(),calls=[];
  const win={localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    fetch:async(url,opt)=>{calls.push({url,opt});return fetchResult();},AbortSignal};
  win.window=win;vm.createContext(win);vm.runInContext(src,win);
  let current=user;const signIns=[];
  const auth={onAuthStateChanged(fn){setTimeout(()=>fn(current));return ()=>{}},async signInWithCustomToken(t){signIns.push(t);current={uid:'discord_100000000000000001'};return {user:current};}};
  const db={ref:p=>({once:async()=>({val:()=>p.endsWith('/accounts/100000000000000001/myKey')?accountKey:null})})};
  return {S:win.TTSecureLogin,store,calls,auth,db,signIns};
}
const ok=body=>()=>({ok:true,json:async()=>body}),bad=(status,error)=>()=>({ok:false,status,json:async()=>({error})});
(async()=>{
  // 1. 成功登入：送出本機闆卡鑰匙，伺服器回傳帳號擁有的鑰匙並登入
  let e=env({fetchResult:ok({token:'tok',key:'kA',claimed:true})});
  let r=await e.S.login(e.auth,'discord-token','kA');
  assert.equal(r.key,'kA');assert.deepEqual(e.signIns,['tok']);assert.equal(e.store.get('tt_me'),'kA');
  assert.equal(JSON.parse(e.calls[0].opt.body).key,'kA');assert.equal(e.calls[0].opt.headers.Authorization,'Bearer discord-token');
  // 2. 換裝置：沒有本機鑰匙也能登入，回傳的鑰匙寫回本機
  e=env({fetchResult:ok({token:'tok',key:'kOld'})});r=await e.S.login(e.auth,'t',null);assert.equal(JSON.parse(e.calls[0].opt.body).key,undefined);assert.equal(e.store.get('tt_me'),'kOld');
  // 3. 不合法的本機鑰匙不送出
  e=env({fetchResult:ok({token:'tok',key:'k'})});await e.S.login(e.auth,'t','../evil');assert.equal(JSON.parse(e.calls[0].opt.body).key,undefined);
  // 4. 錯誤碼轉成中文說明，且不登入
  for(const [code,word] of [['KEY_TAKEN','另一個 Discord'],['ACCOUNT_REVIEW_REQUIRED','店長確認'],['CHARACTER_REQUIRED','製作'],['ACCOUNT_DISABLED','停用']]){
    e=env({fetchResult:bad(409,code)});await assert.rejects(e.S.login(e.auth,'t','kA'),x=>x.code===code&&x.message.includes(word));assert.equal(e.signIns.length,0);
  }
  e=env({fetchResult:()=>{throw Error('offline')}});await assert.rejects(e.S.login(e.auth,'t','kA'),x=>x.code==='UNAVAILABLE');
  // 5. check：沒登入 → 需要登入
  e=env({});assert.deepEqual({...await e.S.check(e.auth,e.db,'peiwan','kA')},{ok:false});
  // 6. 已登入且鑰匙相同 → 放行；不同 → 切換到帳號擁有的闆卡
  e=env({fetchResult:ok({token:'tok',key:'kA'})});await e.S.login(e.auth,'t','kA');
  assert.equal((await e.S.check(e.auth,e.db,'peiwan','kA')).ok,true);
  assert.equal((await e.S.check(e.auth,e.db,'peiwan','kB')).switchTo,'kA');
  // 7. 已登入但這台沒記錄（例如之前用語音登入）→ 讀自己的帳號紀錄比對
  e=env({user:{uid:'discord_100000000000000001'},accountKey:'kA'});
  assert.equal((await e.S.check(e.auth,e.db,'peiwan','kA')).ok,true);
  e=env({user:{uid:'discord_100000000000000001'},accountKey:null});assert.equal((await e.S.check(e.auth,e.db,'peiwan','kA')).ok,false);
  // 8. Email 登入的店員帳號不算客人登入
  e=env({user:{uid:'staffUid'}});assert.equal((await e.S.check(e.auth,e.db,'peiwan','kA')).ok,false);
  console.log('PASS: secure login request/response, key restore on a new device, invalid key not sent, error messages, gate check (signed-out, same key, switch, account lookup, staff account)');
})().catch(e=>{console.error(e);process.exitCode=1});
