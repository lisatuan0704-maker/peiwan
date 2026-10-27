/* v438 闆卡工房：用 Discord 登入自動帶入 Discord 帳號（客人不用自己打、也改不了）。
   做好闆卡後若剛登入過，直接請伺服器把這個 Discord 帳號綁到新闆卡，進大廳不用再登入一次、也不需要店長審核。 */
(()=>{'use strict';
const CLIENT='1527394621368303636',REDIRECT='https://tinytavern.tw/dc.html',FLAG='tt_card_login_v438',TOKEN='tt_dc_token_v438';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function profile(){try{const v=JSON.parse(localStorage.getItem('tt_dc')||'null');return v&&/^[0-9]{16,22}$/.test(v.id||'')&&v.username?v:null;}catch{return null;}}
function login(){
 try{sessionStorage.setItem(FLAG,String(Date.now()));location.href=TTDiscordAuth.begin(CLIENT,REDIRECT);}
 catch(e){alert('無法開始 Discord 登入，請確認瀏覽器允許此網站使用儲存空間後再試。');}
}
function switchAccount(){try{localStorage.removeItem('tt_dc');sessionStorage.removeItem(TOKEN);}catch{}login();}
function paint(){
 const f=$('fDcid');if(!f)return;const u=profile();
 f.readOnly=true;f.value=u?'@'+u.username:'';f.placeholder='用下方按鈕登入 Discord 自動帶入';f.style.cursor='default';
 let box=$('dcLoginBox');if(!box){box=document.createElement('div');box.id='dcLoginBox';box.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 2px';f.after(box);}
 box.innerHTML=u
  ?'<span style="font-size:13px;color:#3E8E62;font-weight:700">✓ 已用 Discord 登入：@'+esc(u.username)+(u.global_name?'（'+esc(u.global_name)+'）':'')+'</span><button type="button" id="dcSwitch" style="border:0;background:none;color:#8E68C8;font:inherit;font-size:12.5px;text-decoration:underline;cursor:pointer">不是我，換一個帳號</button>'
  :'<button type="button" id="dcLoginBtn" style="border:0;border-radius:10px;background:#5865F2;color:#fff;font:inherit;font-size:14px;font-weight:700;padding:9px 16px;cursor:pointer">用 Discord 登入</button><span style="font-size:12.5px;color:#8E7AB0">登入後自動帶入你的 Discord 帳號</span>';
 $('dcSwitch')&&($('dcSwitch').onclick=switchAccount);$('dcLoginBtn')&&($('dcLoginBtn').onclick=login);
 const hint=$('discordHint');if(hint)hint.textContent='闆卡會綁定這個 Discord 帳號，換裝置時用同一個 Discord 登入就能找回。';
}
// 一進工房就先登入（不然做到一半跳去登入，選好的造型會不見）。
function gate(){
 if(profile())return;
 const g=document.createElement('div');g.id='dcCardGate';
 g.style.cssText='position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(40,26,48,.6);box-sizing:border-box';
 g.innerHTML='<div style="width:min(420px,100%);border-radius:20px;background:#fffdfe;color:#5e4a68;padding:24px 20px;text-align:center;box-shadow:0 18px 50px rgba(40,20,50,.3)">'
  +'<h2 style="margin:0 0 8px;font-size:20px">先用 Discord 登入</h2>'
  +'<p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:#7d6a86">闆卡會綁定你的 Discord 帳號，<br>不用自己填 Discord ID，換裝置也找得回來。</p>'
  +'<button type="button" style="display:block;width:100%;min-height:50px;border:0;border-radius:14px;background:#5865F2;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer">用 Discord 登入</button>'
  +'<p style="margin:12px 0 0;font-size:12px;color:#a593ad">我們只會讀取你的 Discord 名稱與頭像。</p></div>';
 g.querySelector('button').onclick=login;document.body.append(g);
}
// 做好闆卡後：用剛才登入的憑證直接綁定新闆卡（失敗也沒關係，大廳入口會請他再登入一次）。
function bindAfterCreate(key){
 let tok=null;try{tok=sessionStorage.getItem(TOKEN);}catch{}
 if(!tok||!key||!window.TTSecureLogin||!window.firebase?.auth)return Promise.resolve(false);
 return TTSecureLogin.login(firebase.auth(),tok,key).then(()=>{try{sessionStorage.removeItem(TOKEN);}catch{}return true;}).catch(()=>false);
}
function boot(){paint();gate();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.TTCardDiscord={login,paint,bindAfterCreate,profile};
})();
