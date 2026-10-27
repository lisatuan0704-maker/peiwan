import {CATEGORIES,ticketInput} from './support-core.mjs?v=421';
const auth=firebase.auth(),db=firebase.database(),stamp=()=>firebase.database.ServerValue.TIMESTAMP;
const dialog=document.createElement('dialog');dialog.className='tt-support';dialog.setAttribute('aria-labelledby','supportTitle');
dialog.innerHTML=`<header><small>TINY TAVERN · CUSTOMER SUPPORT</small><h1 id="supportTitle">聯絡客服</h1><p>有什麼需要幫忙的？留下問題，掌櫃會在站內信箱回覆你。</p><button type="button" class="support-close" aria-label="關閉聯絡客服">×</button></header><div class="support-body"><div class="support-steps"><span>01 填寫問題</span><span>02 掌櫃處理</span><span>03 站內信收回覆</span></div><p class="support-identity" id="supportIdentity"></p><form id="supportForm"><label for="supportCategory">問題類型</label><select id="supportCategory">${CATEGORIES.map(x=>`<option>${x}</option>`).join('')}</select><label for="supportSubject">主旨</label><input id="supportSubject" minlength="2" maxlength="60" required placeholder="請簡短說明需要協助的事情"><label for="supportOrder">訂單編號 <small>（選填）</small></label><input id="supportOrder" maxlength="80" placeholder="與訂單有關時，可填入編號方便查詢"><label for="supportText">問題說明</label><textarea id="supportText" minlength="5" maxlength="1500" required placeholder="請描述遇到的情況與需要協助的內容。"></textarea><p class="support-note">請勿填寫密碼、驗證碼或完整信用卡資料。回覆會送到「我的酒館 → 信箱」，不會寄到 Email。</p><button class="support-primary" id="supportSubmit">送出給客服</button></form><div id="supportStatus" class="support-status" role="status" aria-live="polite"></div><p class="support-note">客服內容僅供本人與掌櫃查看。<br>無法登入？可透過 <a href="https://discord.gg/aK9GFarxm" target="_blank" rel="noopener">Discord 聯絡酒館</a>。</p></div>`;
document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
let pending=null,busy=false,epoch=0,inboxRef=null,inboxFirst=true,known=new Set();
window.TTSupportInbox={};
function repaint(){window.updateMailBadge?.();if(document.getElementById('mailBoxM')?.classList.contains('on'))window.renderMailBox?.();}
function validUser(){const u=auth.currentUser;return u?.uid?.startsWith('discord_')?u:null;}
function status(text,error=false){$('supportStatus').textContent=text;$('supportStatus').dataset.error=String(error);}
function identity(){const user=validUser();$('supportIdentity').textContent=user?'回覆將送至目前登入帳號的站內信箱。':'登入 Discord 並建立酒館角色後，即可送出客服單。';$('supportSubmit').disabled=!user||busy;dialog.querySelectorAll('input,select,textarea').forEach(field=>field.disabled=busy);}
function open(){identity();if(!dialog.open)dialog.showModal();}
dialog.querySelector('.support-close').onclick=()=>dialog.close();
document.addEventListener('click',e=>{if(e.target.closest('[data-contact-support]')){e.preventDefault();open();}});
async function flag(id,field){const user=validUser();if(!user||!id.startsWith('support_'))return;const version=epoch;
  try{await db.ref(`supportV1/inbox/${user.uid}/${id.slice(8)}/${field}`).set(stamp());if(version!==epoch)return;}
  catch{window.toast?.('信件更新失敗，請稍後再試。');}}
window.TTSupport={open,handles:id=>id.startsWith('support_'),hide:id=>flag(id,'hid'),read:id=>flag(id,'read')};
auth.onAuthStateChanged(()=>{epoch++;pending=null;busy=false;inboxRef?.off();inboxRef=null;known=new Set();inboxFirst=true;window.TTSupportInbox={};$('supportForm').reset();$('supportForm').hidden=false;status('');identity();repaint();
  const user=validUser();if(!user)return;const version=epoch;inboxRef=db.ref(`supportV1/inbox/${user.uid}`).limitToLast(100);
  inboxRef.on('value',snap=>{if(version!==epoch)return;const rows=snap.val()||{};const fresh=Object.keys(rows).some(id=>!known.has(id));window.TTSupportInbox=Object.fromEntries(Object.entries(rows).map(([id,m])=>['support_'+id,m]));known=new Set(Object.keys(rows));repaint();if(!inboxFirst&&fresh)window.lobbyNotify?.({icon:'note',title:'客服回覆已送達',sub:'請到「我的酒館 → 信箱」查看。',onclick:()=>{window.renderMailBox?.();window.gOpen?.('mailBoxM');}});inboxFirst=false;},()=>{if(version===epoch)window.toast?.('客服回覆暫時無法載入，請稍後重試。');});
});
$('supportForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const user=validUser();if(!user){identity();return;}const version=epoch;let input;
  try{input=ticketInput({category:$('supportCategory').value,subject:$('supportSubject').value,text:$('supportText').value,orderId:$('supportOrder').value});}catch(e){status(e.message,true);return;}
  busy=true;identity();status('正在送出，請稍候…');
  try{
    const keySnap=await db.ref(`secureV1/members/${user.uid}/key`).once('value');if(version!==epoch)return;const key=keySnap.val();if(!key)throw Error('請先建立酒館角色，再送出客服單。');
    const person=await db.ref(`secureV1/characters/${key}/pub/n`).once('value');if(version!==epoch)return;
    const fingerprint=JSON.stringify(input);if(!pending||pending.fingerprint!==fingerprint)pending={id:db.ref(`supportV1/tickets/${user.uid}`).push().key,fingerprint};
    const ref=db.ref(`supportV1/tickets/${user.uid}/${pending.id}`),existing=await ref.once('value');if(version!==epoch)return;
    if(!existing.exists())await ref.set({...input,myKey:key,name:String(person.val()||user.displayName||'酒館會員').slice(0,80),at:stamp()});
    if(version!==epoch)return;const id=pending.id;pending=null;$('supportForm').hidden=true;status('');const box=document.createElement('div');box.className='support-success';const title=document.createElement('strong');title.textContent='客服單已送出';const detail=document.createElement('p');detail.textContent='客服單號：'+id+'\n掌櫃回覆後，請到「我的酒館 → 信箱」查看。';detail.style.whiteSpace='pre-wrap';const again=document.createElement('button');again.type='button';again.className='support-primary';again.textContent='再填寫一筆問題';again.onclick=()=>{$('supportForm').reset();$('supportForm').hidden=false;status('');};box.append(title,detail,again);$('supportStatus').append(box);
  }catch(e){if(version===epoch)status(e.code==='PERMISSION_DENIED'?'目前無法送出，請確認已登入並建立酒館角色；也可以透過下方 Discord 聯絡客服。':(e.message?.startsWith('請先')?e.message:'送出結果尚未確認，請保持原內容後重試；系統會核對同一筆客服單，避免重複送出。'),true);}
  finally{if(version===epoch){busy=false;identity();}}
};
if(new URLSearchParams(location.search).has('contact'))open();
