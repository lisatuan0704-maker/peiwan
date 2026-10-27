const API='https://api.tinytavern.tw',KEY='tt_partner_discord_bind_v1';
export async function bindingRequest(user,cid,discordToken){
 const token=await user.getIdToken();const r=await fetch(API+'/v1/partner/discord',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({cid,...(discordToken?{discordToken}:{})}),signal:AbortSignal.timeout(15000)});
 const result=await r.json();if(!r.ok)throw Error(result.error||'REQUEST_FAILED');return result;
}
export function errorText(code){return ({PARTNER_ACCOUNT_REQUIRED:'此工作帳號尚未開放綁定，請聯絡店長。',DISCORD_ALREADY_BOUND:'此 Discord 已綁定其他陪玩帳號。',REBIND_REQUIRES_ADMIN:'更換 Discord 帳號請聯絡店長。',INVALID_SESSION:'授權已失效，請重新登入並綁定。',SERVICE_NOT_ACTIVATED:'綁定功能尚未開放。'})[code]||'暫時無法完成，請稍後再試。'}
export function mountBinding({root,getUser,getCid}){
 root.innerHTML='<span class="partner-dc-status" role="status">Discord：未查詢</span><button type="button" class="partner-dc-button">綁定 Discord</button>';
 const label=root.querySelector('span'),button=root.querySelector('button');let busy=false;
 async function refresh(){const user=getUser(),cid=getCid();if(!user||!cid)return;try{const result=await bindingRequest(user,cid);label.textContent=result.bound?'Discord：已綁定':'Discord：未綁定';button.textContent=result.bound?'重新確認綁定':'綁定 Discord'}catch(e){label.textContent=errorText(e.message)}}
 button.onclick=()=>{if(busy)return;const user=getUser(),cid=getCid();if(!user||!cid){label.textContent='請先登入陪玩工作帳號。';return}busy=true;sessionStorage.setItem(KEY,JSON.stringify({cid,uid:user.uid,at:Date.now()}));location.assign(window.TTDiscordAuth.begin('1527394621368303636',location.origin+'/dc.html'))};
 void refresh();return {refresh};
}
export async function finishBinding(callback,auth,card){
 let pending;try{pending=JSON.parse(sessionStorage.getItem(KEY))}catch{}sessionStorage.removeItem(KEY);
 card.replaceChildren();const title=document.createElement('h1'),status=document.createElement('p'),back=document.createElement('a');title.textContent='陪玩 Discord 綁定';status.textContent='正在驗證…';back.className='btn';back.href='partner.html';back.textContent='返回工作頁';card.append(title,status,back);
 try{
  if(!pending||!Number.isFinite(pending.at)||Date.now()-pending.at>600000||Date.now()<pending.at||!callback?.token)throw Error('INVALID_SESSION');
  const user=await new Promise(resolve=>{const unsub=auth.onAuthStateChanged(u=>{unsub();resolve(u)})});
  if(!user||user.uid!==pending.uid)throw Error('INVALID_SESSION');
  await bindingRequest(user,pending.cid,callback.token);status.textContent='Discord 已綁定，可返回工作頁。';
 }catch(e){status.textContent=errorText(e.message)}
}
