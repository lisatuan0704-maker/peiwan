(function(root){
 'use strict';
 const KEY='tt_discord_oauth_state_v1';
 function begin(clientId,redirectUri){
  const bytes=new Uint8Array(32);root.crypto.getRandomValues(bytes);
  const state=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  root.sessionStorage.setItem(KEY,JSON.stringify({state,redirectUri,at:Date.now()}));
  const url=new URL('https://discord.com/oauth2/authorize');
  url.search=new URLSearchParams({client_id:clientId,response_type:'token',scope:'identify',redirect_uri:redirectUri,state}).toString();
  return url.href;
 }
 function consume(){
  const hash=root.location.hash;
  // Clear the credential before loading third-party SDKs or making requests.
  root.history.replaceState(null,'',root.location.pathname+root.location.search);
  let pending;
  try{const raw=root.sessionStorage.getItem(KEY);root.sessionStorage.removeItem(KEY);pending=JSON.parse(raw)}catch{return {error:'請回大廳重新開始 Discord 綁定。'}}
  const p=new URLSearchParams(hash.replace(/^#/,''));
  if(!pending||p.getAll('state').length!==1||p.get('state')!==pending.state||!/^[a-f0-9]{64}$/.test(pending.state)||pending.redirectUri!==root.location.origin+root.location.pathname||!Number.isFinite(pending.at)||Date.now()-pending.at>600000||Date.now()<pending.at)return {error:'授權已過期或不是從這個分頁發起，請回大廳重新綁定。'};
  if(p.has('error'))return {error:'你已取消 Discord 授權，可以回大廳重新開始。'};
  const token=p.get('access_token');
  if(p.getAll('access_token').length!==1||!token||token.length<10||token.length>4096||p.get('token_type')?.toLowerCase()!=='bearer')return {error:'沒有取得有效授權，請回大廳重新綁定。'};
  return {token};
 }
 function escapeText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 root.TTDiscordAuth={begin,consume,escapeText};
})(window);
