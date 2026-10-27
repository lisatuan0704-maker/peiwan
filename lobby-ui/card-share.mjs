/* v414 闆卡分享到 Discord：分享入口、欄位選擇、後端圖片預覽、本人確認發布與撤下。
   只呼叫 api.tinytavern.tw /v1/card-share/*（card-share-client.mjs），不寫 Firebase、不碰訂單或錢包。
   必須由本人勾選同意並按下「確認分享」才會發布；儲存闆卡、產生預覽、關閉視窗都不會發文。
   驗收前只在測試入口開放：網址加 ?cardshare=1（記在本機），或 localStorage tt_card_share_test=1。 */
import {createCardShareClient} from './card-share-client.mjs?v=414';
import {beginVoiceLogin} from './voice-rehearsal.mjs?v=353';

const OPEN_TO_EVERYONE=false;            // 本人驗收（預覽、發布、開啟連結、撤下）完成後再改成 true
const API='https://api.tinytavern.tw';
const FIELD_LABEL={name:'名字',character:'角色樣子',pet:'寵物',tags:'標籤',games:'常玩遊戲',quote:'一段話'};
const ERR={
 AUTH_REQUIRED:'請先用 Discord 登入。',AUTH_EXPIRED:'登入已過期，請重新用 Discord 登入。',
 ACCOUNT_REQUIRED:'這個 Discord 帳號還沒有完成闆卡綁定，暫時不能分享。',
 PROFILE_NOT_FOUND:'找不到你的闆卡資料，請先儲存闆卡。',PREVIEW_NOT_FOUND:'找不到這張預覽，請重新產生。',PUBLICATION_NOT_FOUND:'找不到這則分享，可能已經撤下。',
 PUBLICATION_CONFLICT:'你已經有一則分享中的闆卡，要先撤下舊的才能分享新的。',
 IDEMPOTENCY_CONFLICT:'這次分享的操作編號和預覽對不上，請重新產生預覽。',
 PUBLICATION_PENDING:'上一則分享的結果還在確認中，暫時不能撤下。',
 PREVIEW_EXPIRED:'預覽已超過 15 分鐘，請重新產生。',RATE_LIMITED:'操作太頻繁了，請稍等一下再試。',
 RENDER_UNAVAILABLE:'卡片圖片正在排隊產生，請稍後再試。',DISCORD_UNAVAILABLE:'Discord 暫時連不上，請稍後再試。',TEMPORARILY_UNAVAILABLE:'分享功能暫時休息中，請稍後再試。',
 PLAYER_MUTED:'目前帳號暫時不能分享。',ACCOUNT_CHANGED:'登入的帳號變了，請確認目前的 Discord 帳號後重新操作。',REQUEST_FAILED:'連線沒有成功，請稍後再試。'
};
const msgOf=e=>ERR[e?.code]||(e?.name==='TimeoutError'?'等待太久沒有回應，可以按「再試一次」。':'連線沒有成功，請稍後再試。');

export function installCardShare({auth}){
 const enabled=()=>{if(OPEN_TO_EVERYONE)return true;try{if(/[?&]cardshare=1\b/.test(location.search)||/[?&]cardshare=1\b/.test(parent.location.search))localStorage.setItem('tt_card_share_test','1');return localStorage.getItem('tt_card_share_test')==='1';}catch(e){return false;}};
 const user=()=>{const u=auth.currentUser;return u&&String(u.uid||'').startsWith('discord_')?u:null;};
 const client=createCardShareClient({baseUrl:API,getUser:user});
 let st=fresh();let lastUid=null;let polling=null;
 function fresh(){return {fields:new Set(['name','character']),preview:null,imageUrl:'',consent:false,pending:null,publication:null,busy:false,error:'',loaded:false};}
 function resetAll(){client.reset();if(polling){clearTimeout(polling);polling=null;}st=fresh();}

 const box=document.createElement('div');box.id='cardShareM';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','csTitle');
 document.body.append(box);
 box.addEventListener('click',e=>{if(e.target===box)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){const z=box.querySelector('.cs-zoom');if(z){z.remove();return;}close();}});
 function close(){box.hidden=true;}
 auth.onAuthStateChanged(u=>{const uid=u?.uid||null;if(uid!==lastUid){lastUid=uid;resetAll();if(!box.hidden){paint();loadCurrent().then(paint);}}});
 const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;};
 const btn=(c,x,fn)=>{const b=el('button',c,x);b.type='button';b.onclick=fn;return b;};

 function available(){
  let b={};try{const a=typeof me==='function'?me():null;b=(a&&a.b)||{};}catch(e){}
  const d=b.doll||{};const pid=(d.ps&&d.ps.pet)||d.set||'';
  const out=['name','character'];
  if(/^pet_(bubu|dengdeng|guigui)$/.test(pid)&&!(d.uiBaseSlots||[]).includes('pet'))out.push('pet');
  if(Array.isArray(b.tags)&&b.tags.length)out.push('tags');
  if(String(b.games||'').trim())out.push('games');
  if(String(b.quote||'').trim())out.push('quote');
  return out;
 }
 function clearPreview(){st.preview=null;st.imageUrl='';st.consent=false;st.pending=null;}

 async function loadCurrent(){
  if(!user()){st.loaded=true;return;}
  try{const r=await client.current();st.publication=r&&r.publication||null;if(st.publication&&st.publication.status==='processing')poll(st.publication.publicationId||st.publication.id,0);}
  catch(e){if(e.code!=='ACCOUNT_CHANGED')st.error=msgOf(e);}
  st.loaded=true;
 }
 async function makePreview(){
  st.busy=true;st.error='';clearPreview();paint();
  try{const fields=[...st.fields];const p=await client.preview(fields);st.preview=p;paint();st.imageUrl=await client.image(p);}
  catch(e){clearPreview();st.error=msgOf(e);if(e.code==='ACCOUNT_CHANGED')resetAll();}
  finally{st.busy=false;paint();}
 }
 async function publish(retry){
  if(!st.preview||!st.consent||!st.imageUrl)return;
  if(!retry||!st.pending||st.pending.previewId!==st.preview.previewId)st.pending={previewId:st.preview.previewId,requestId:crypto.randomUUID()};
  st.busy=true;st.error='';paint();
  try{const r=await client.publish(st.pending.previewId,st.pending.requestId);handlePublication(r);}
  catch(e){
   if(e.code==='PUBLICATION_CONFLICT'){await loadCurrent();}
   if(e.code==='PREVIEW_EXPIRED'||e.code==='IDEMPOTENCY_CONFLICT'||e.code==='PREVIEW_NOT_FOUND'){clearPreview();}
   if(e.code==='ACCOUNT_CHANGED')resetAll();
   st.error=msgOf(e);
  }finally{st.busy=false;paint();}
 }
 function handlePublication(r){
  const id=r.publicationId||r.id;
  st.publication={...r,publicationId:id};
  if(r.status==='published'){clearPreview();}
  else if(r.status==='processing')poll(id,0);
 }
 function poll(id,n){
  if(polling)clearTimeout(polling);
  if(n>=5){polling=null;st.error='發布結果還在確認中，請稍後重新打開這個視窗查看，不要重複分享。';paint();return;}
  polling=setTimeout(async()=>{polling=null;try{const r=await client.status(id);st.publication={...r,publicationId:r.publicationId||id};if(r.status==='published')clearPreview();else if(r.status==='processing')poll(id,n+1);}catch(e){st.error=msgOf(e);}paint();},3000);
 }
 async function withdraw(){
  const p=st.publication;if(!p)return;const id=p.publicationId||p.id;
  st.busy=true;st.error='';paint();
  try{await client.withdraw(id);st.publication=null;clearPreview();}
  catch(e){st.error=msgOf(e);if(e.code==='PUBLICATION_NOT_FOUND')st.publication=null;}
  finally{st.busy=false;paint();}
 }

 function paint(){
  box.replaceChildren();const card=el('div','cs-card');box.append(card);
  const head=el('div','cs-head');head.append(el('small','cs-eyebrow','GUEST CARD · SHARE'),el('h2','','分享闆卡到 Discord'));head.querySelector('h2').id='csTitle';
  head.append(btn('cs-x','×',close));head.lastChild.setAttribute('aria-label','關閉');card.append(head);
  const body=el('div','cs-body');card.append(body);
  if(!user()){
   body.append(el('p','cs-lead','分享前要先用 Discord 登入，酒館才能確認這張闆卡是你的。'),btn('cs-primary','用 Discord 登入',()=>beginVoiceLogin()));
   body.append(el('p','cs-note','不分享也沒關係，點單和其他功能都照常使用。'));return;
  }
  if(!st.loaded){body.append(el('p','cs-lead','讀取分享狀態中…'));return;}
  const pub=st.publication;
  if(pub&&pub.status!=='withdrawn'){
   const box2=el('div','cs-status');
   if(pub.status==='published'){
    box2.append(el('b','','你的闆卡已經分享到 Discord'),el('p','cs-note',pub.publishedAt?'分享時間：'+new Date(pub.publishedAt).toLocaleString('zh-TW',{hour12:false}):''));
    if(pub.messageUrl&&/^https:\/\/(discord\.com|discordapp\.com)\//.test(pub.messageUrl)){const a=el('a','cs-link','打開 Discord 訊息 ↗');a.href=pub.messageUrl;a.target='_blank';a.rel='noopener';box2.append(a);}
    box2.append(el('p','cs-note','想換新的闆卡，請先撤下這則，再重新預覽與分享。'));
    const w=btn('cs-ghost',st.busy?'撤下中…':'撤下這則分享',withdraw);w.disabled=st.busy;box2.append(w);
   }else if(pub.status==='processing'){
    box2.append(el('b','','發布中，正在等 Discord 回覆…'),el('p','cs-note','請不要重複分享。'));
   }else{
    box2.append(el('b','','發布結果待確認，請勿重複分享'),el('p','cs-note','操作編號：'+(pub.publicationId||'')+'。酒館會確認結果；需要協助請把這個編號給掌櫃。'));
   }
   body.append(box2);if(st.error)body.append(el('p','cs-error',st.error));return;
  }
  // 欄位選擇
  const sec=el('div','cs-fields');sec.append(el('div','cs-label','要公開的內容'));
  const avail=available();for(const f of [...st.fields])if(!avail.includes(f))st.fields.delete(f);
  for(const f of avail){
   const lab=el('label','cs-field');const cb=el('input');cb.type='checkbox';cb.checked=st.fields.has(f);
   if(f==='name'||f==='character'){cb.checked=true;cb.disabled=true;}
   cb.onchange=()=>{cb.checked?st.fields.add(f):st.fields.delete(f);clearPreview();st.error='';paint();};
   lab.append(cb,el('span','',FIELD_LABEL[f]+(cb.disabled?'（必選）':'')));sec.append(lab);
  }
  sec.append(el('p','cs-note','圖片與文字不會出現生日、錢包或 Discord ID。'));
  body.append(sec);
  const gen=btn('cs-ghost',st.busy&&!st.preview?'產生預覽中…（最多約 1 分鐘）':(st.preview?'重新產生預覽':'產生預覽'),makePreview);gen.disabled=st.busy;body.append(gen);
  if(st.preview){
   const pv=el('div','cs-preview');
   if(st.imageUrl){const img=el('img','cs-img');img.src=st.imageUrl;img.alt='闆卡分享預覽';img.title='點一下放大';img.onclick=()=>zoom(st.imageUrl);pv.append(img,el('small','cs-note','點圖片可以放大。這是當下的快照，改了裝扮要重新預覽。'));}
   else pv.append(el('p','cs-lead','圖片載入中…'));
   body.append(pv);
   const who=st.preview.discordIdentity||{};const dest=(st.preview.destination&&st.preview.destination.name)||'酒館 Discord';
   const idText=who.displayName?who.displayName+'（ID '+who.id+'）':'尚未取得 Discord 名稱（ID '+(who.id||'—')+'）';
   const info=el('div','cs-info');info.append(el('div','','發布帳號：'+idText),el('div','','發布位置：'+dest));
   if(st.preview.expiresAt)info.append(el('div','cs-note','預覽有效到 '+new Date(st.preview.expiresAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})));
   body.append(info);
   const lab=el('label','cs-consent');const cb=el('input');cb.type='checkbox';cb.checked=st.consent;cb.disabled=!st.imageUrl||st.busy;
   cb.onchange=()=>{st.consent=cb.checked;paint();};
   lab.append(cb,el('span','','我確認用上面的 Discord 帳號，把這張闆卡發到「'+dest+'」，訊息會連結我的 Discord 身分。'));body.append(lab);
   const go=btn('cs-primary',st.busy&&st.pending?'分享中…':(st.pending?'再試一次':'確認分享'),()=>publish(!!st.pending));go.disabled=!st.consent||!st.imageUrl||st.busy;body.append(go);
  }
  if(st.error)body.append(el('p','cs-error',st.error));
 }
 function zoom(url){const z=el('div','cs-zoom');const img=el('img');img.src=url;img.alt='闆卡分享預覽放大';z.append(img);z.onclick=()=>z.remove();box.append(z);}

 async function open(){
  if(!enabled())return;box.hidden=false;st.error='';if(!st.loaded||!st.publication){st.loaded=false;paint();await loadCurrent();}paint();
 }
 window.TTCardShare={open,enabled};
 // 自己的闆卡加上入口（只在測試入口開放期間顯示）
 const orig=window.pcSocialRender;
 window.pcSocialRender=function(){const r=typeof orig==='function'?orig.apply(this,arguments):undefined;
  try{const host=document.getElementById('pcSocial');const t=window.popTarget||(typeof popTarget!=='undefined'?popTarget:null);
   if(host&&enabled()&&t&&t.myKey&&typeof myKey!=='undefined'&&t.myKey===myKey&&!host.querySelector('.cs-entry')){host.append(btn('cs-entry','分享到 Discord ↗',()=>{try{closeCard();}catch(e){}open();}));}}catch(e){}
  return r;};
}
