/* v428 酒館帳號登入：Discord 授權交給伺服器驗證，伺服器確認這個 Discord 帳號擁有哪張闆卡後，
   發給 Firebase 登入憑證。資料庫規則用這個登入身分判斷「這張闆卡、這些金幣、這些私訊是不是你的」。 */
(function(root){
'use strict';
const API='https://api.tinytavern.tw',STORE='tt_secure_v428';
const MESSAGES={
  KEY_TAKEN:'這張闆卡已經綁定另一個 Discord 帳號。如果你製作闆卡時填錯了 Discord ID，請重新製作；有疑問請到 Discord 聯絡店長。',
  ACCOUNT_REVIEW_REQUIRED:'為了防止別人冒用你的闆卡，這個帳號需要店長確認後才能登入。請到 Discord 聯絡店長，告訴他你的 Discord 名稱與闆卡名字。',
  CHARACTER_REQUIRED:'還沒有找到你的闆卡，請先製作一張闆卡。',
  ACCOUNT_DISABLED:'這個帳號已停用，請到 Discord 聯絡店長。',
  INVALID_SESSION:'Discord 授權已過期，請回大廳重新登入。',
  INVALID_REQUEST:'登入資料有誤，請回大廳重新登入。'
};
function message(code){return MESSAGES[code]||'登入暫時無法使用，請稍後再試；如果一直失敗，請到 Discord 聯絡店長。';}
function read(){try{const v=JSON.parse(root.localStorage.getItem(STORE)||'null');return v&&typeof v.uid==='string'&&typeof v.key==='string'?v:null}catch{return null}}
function remember(uid,key){try{root.localStorage.setItem(STORE,JSON.stringify({uid,key,at:Date.now()}))}catch{}}
function forget(){try{root.localStorage.removeItem(STORE)}catch{}}
// Discord token -> server verifies and binds -> Firebase sign-in. Returns the character key this Discord account owns.
async function login(auth,discordToken,key){
  const body=typeof key==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(key)?{key}:{};
  let r,data;
  try{r=await fetch(API+'/v1/voice/session',{method:'POST',headers:{Authorization:'Bearer '+discordToken,'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});data=await r.json();}
  catch{throw Object.assign(Error(message('UNAVAILABLE')),{code:'UNAVAILABLE'});}
  if(!r.ok||typeof data?.token!=='string'||typeof data?.key!=='string')throw Object.assign(Error(message(data?.error)),{code:data?.error||'UNAVAILABLE'});
  const cred=await auth.signInWithCustomToken(data.token);
  remember(cred.user.uid,data.key);
  try{root.localStorage.setItem('tt_me',data.key)}catch{}
  return {uid:cred.user.uid,key:data.key,claimed:!!data.claimed};
}
function firstUser(auth){return new Promise(res=>{const stop=auth.onAuthStateChanged(u=>{stop();res(u)},()=>{stop();res(null)})})}
// Is this browser signed in as the owner of `myKey`? {ok, switchTo} — switchTo when the account owns a different card.
async function check(auth,db,rootPath,myKey){
  const user=await firstUser(auth);
  if(!user||!/^discord_\d{16,22}$/.test(user.uid))return {ok:false};
  let key=read()?.uid===user.uid?read().key:null;
  if(!key){try{const v=(await db.ref(rootPath+'/accounts/'+user.uid.slice(8)+'/myKey').once('value')).val();if(typeof v==='string'&&v){key=v;remember(user.uid,v);}}catch{}}
  if(!key)return {ok:false};
  if(myKey&&key!==myKey)return {ok:true,switchTo:key};
  return {ok:true,key};
}
root.TTSecureLogin={login,check,message,read,forget};
})(window);
