/* v414 闆卡分享到 Discord：分享入口、欄位選擇、後端圖片預覽、本人確認發布與撤下。
   只呼叫 api.tinytavern.tw /v1/card-share/*（card-share-client.mjs），不寫 Firebase、不碰訂單或錢包。
   必須由本人勾選同意並按下「確認分享」才會發布；儲存闆卡、產生預覽、關閉視窗都不會發文。
   v418 起開放給所有人（OPEN_TO_EVERYONE）；改回 false 時只在測試入口顯示：網址加 ?cardshare=1，或 localStorage tt_card_share_test=1。 */
import {createCardShareClient} from './card-share-client.mjs?v=414';
import {beginVoiceLogin} from './voice-rehearsal.mjs?v=353';

const OPEN_TO_EVERYONE=true;             // 10/27 本人驗收（預覽、確認發布、Discord 貼文、撤下）完成；使用者決定開放（Discord 伺服器尚未公開）
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
 // 狀態物件 st 換帳號／重置時整個換新；每個非同步操作記下自己的 st 與操作編號，回來時不符就丟掉，
 // 舊請求的 catch/finally 也不會動到新帳號或新操作的狀態。
 let st=fresh();let lastUid=null;let polling=null;
 function fresh(){return {fields:new Set(['name','character']),preview:null,imageUrl:'',imgOk:false,imgErr:false,consent:false,pending:null,publication:null,
   busy:'',error:'',loaded:false,loading:false,loadErr:'',op:0,loadSeq:0,pollSeq:0};}
 // 停止輪詢＝取消排程，並讓已送出的 status 請求回應失效（pollSeq +1）
 function stopPoll(s=st){if(polling){clearTimeout(polling);polling=null;}if(s)s.pollSeq++;}
 function resetAll(){client.reset();stopPoll();st=fresh();}
 const live=(s,my)=>s===st&&(my==null||s.op===my);

 const box=document.createElement('div');box.id='cardShareM';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','csTitle');
 document.body.append(box);
 box.addEventListener('click',e=>{if(e.target===box)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){const z=box.querySelector('.cs-zoom');if(z){z.remove();return;}close();}});
 function close(){box.hidden=true;}
 auth.onAuthStateChanged(u=>{const uid=u?.uid||null;if(uid!==lastUid){lastUid=uid;resetAll();if(!box.hidden){paint();loadCurrent();}}});
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
 // 清掉預覽並讓進行中的預覽請求失效（操作編號 +1）
 function clearPreview(s=st){s.op++;s.preview=null;s.imageUrl='';s.imgOk=false;s.imgErr=false;s.consent=false;s.pending=null;}

 async function loadCurrent(){
  const s=st;const my=++s.loadSeq;
  stopPoll(s);   // 重新讀取 current 前先讓所有舊輪詢失效，較新的 current 不會被晚到的舊 status 蓋掉
  if(!user()){s.loaded=true;s.loading=false;paint();return;}
  s.loading=true;s.loadErr='';paint();
  try{
   const r=await client.current();if(s!==st||my!==s.loadSeq)return;
   s.publication=r&&r.publication||null;s.loaded=true;
   if(s.publication&&s.publication.status==='processing')poll(s.publication.publicationId||s.publication.id,0);else stopPoll(s);
  }catch(e){if(s!==st||my!==s.loadSeq)return;s.loadErr=msgOf(e);}
  finally{if(s===st&&my===s.loadSeq){s.loading=false;paint();}}
 }
 async function makePreview(){
  const s=st;if(s.busy)return;clearPreview(s);const my=s.op;const fields=[...s.fields];
  s.busy='preview';s.error='';paint();
  try{
   const p=await client.preview(fields);if(!live(s,my))return;
   s.preview={...p,requested:fields};paint();
   const url=await client.image(p);if(!live(s,my))return;
   s.imageUrl=url;
  }catch(e){if(!live(s,my))return;s.preview=null;s.imageUrl='';s.error=msgOf(e);if(e.code==='ACCOUNT_CHANGED'){resetAll();}}
  finally{if(live(s,my)&&s.busy==='preview')s.busy='';if(s===st)paint();}
 }
 async function reloadImage(){
  const s=st,my=s.op;if(!s.preview||s.busy)return;s.imageUrl='';s.imgOk=false;s.imgErr=false;s.consent=false;s.busy='image';paint();
  try{const url=await client.image(s.preview);if(!live(s,my))return;s.imageUrl=url;}
  catch(e){if(!live(s,my))return;s.imgErr=true;s.error=msgOf(e);}
  finally{if(live(s,my)&&s.busy==='image')s.busy='';if(s===st)paint();}
 }
 const canPublish=s=>!!(s.preview&&s.imageUrl&&s.imgOk&&s.consent&&!s.busy&&!s.publication);
 async function publish(retry){
  const s=st;if(!canPublish(s))return;const my=s.op;
  if(!retry||!s.pending||s.pending.previewId!==s.preview.previewId)s.pending={previewId:s.preview.previewId,requestId:crypto.randomUUID()};
  const req=s.pending;s.busy='publish';s.error='';paint();
  try{const r=await client.publish(req.previewId,req.requestId);if(!live(s,my))return;handlePublication(s,r);}
  catch(e){
   if(!live(s,my))return;
   s.error=msgOf(e);
   if(e.code==='PREVIEW_EXPIRED'||e.code==='IDEMPOTENCY_CONFLICT'||e.code==='PREVIEW_NOT_FOUND')clearPreview(s);
   if(e.code==='ACCOUNT_CHANGED'){resetAll();}
   else if(e.code==='PUBLICATION_CONFLICT'){s.busy='';loadCurrent();}
  }finally{if(s===st&&s.busy==='publish')s.busy='';if(s===st)paint();}
 }
 function handlePublication(s,r){
  const id=r.publicationId||r.id;
  s.publication={...r,publicationId:id};
  if(r.status==='published'){clearPreview(s);stopPoll(s);}
  else if(r.status==='processing')poll(id,0);
 }
 function poll(id,n){
  const s=st;stopPoll(s);const my=s.pollSeq;
  if(n>=5){s.error='發布結果還在確認中，請稍後按「重新讀取」查看，不要重複分享。';paint();return;}
  polling=setTimeout(async()=>{polling=null;
   try{const r=await client.status(id);if(s!==st||my!==s.pollSeq)return;
    s.publication={...r,publicationId:r.publicationId||id};
    if(r.status==='published'){clearPreview(s);s.error='';}else if(r.status==='processing')poll(id,n+1);
   }catch(e){if(s!==st||my!==s.pollSeq)return;s.error=msgOf(e);}
   if(s===st)paint();},3000);
 }
 async function withdraw(){
  const s=st;const p=s.publication;if(!p||s.busy)return;const id=p.publicationId||p.id;
  s.busy='withdraw';s.error='';paint();
  try{await client.withdraw(id);if(s!==st)return;s.publication=null;stopPoll(s);clearPreview(s);}
  catch(e){if(s!==st)return;s.error=msgOf(e);if(e.code==='PUBLICATION_NOT_FOUND'){s.publication=null;s.error='';}if(e.code==='ACCOUNT_CHANGED')resetAll();}
  finally{if(s===st&&s.busy==='withdraw')s.busy='';if(s===st)paint();}
 }

 function paint(){
  if(box.hidden&&!box.firstChild)return;
  const s=st;
  box.replaceChildren();const card=el('div','cs-card');box.append(card);
  const head=el('div','cs-head');head.append(el('small','cs-eyebrow','GUEST CARD · SHARE'),el('h2','','分享闆卡到 Discord'));head.querySelector('h2').id='csTitle';
  head.append(btn('cs-x','×',close));head.lastChild.setAttribute('aria-label','關閉');card.append(head);
  const body=el('div','cs-body');card.append(body);
  if(!user()){
   body.append(el('p','cs-lead','分享前要先用 Discord 登入，酒館才能確認這張闆卡是你的。'),btn('cs-primary','用 Discord 登入',()=>beginVoiceLogin()));
   body.append(el('p','cs-note','不分享也沒關係，點單和其他功能都照常使用。'));return;
  }
  if(s.loadErr){
   body.append(el('p','cs-lead','讀取分享狀態失敗'),el('p','cs-error',s.loadErr));
   const r=btn('cs-primary',s.loading?'讀取中…':'重新讀取',loadCurrent);r.disabled=s.loading;body.append(r);return;
  }
  if(!s.loaded||(s.loading&&!s.preview)){body.append(el('p','cs-lead','讀取分享狀態中…'));return;}
  const pub=s.publication;
  if(pub&&pub.status!=='withdrawn'){
   const box2=el('div','cs-status');
   if(pub.status==='published'){
    box2.append(el('b','','你的闆卡已經分享到 Discord'),el('p','cs-note',pub.publishedAt?'分享時間：'+new Date(pub.publishedAt).toLocaleString('zh-TW',{hour12:false}):''));
    if(pub.messageUrl&&/^https:\/\/(discord\.com|discordapp\.com)\//.test(pub.messageUrl)){const a=el('a','cs-link','打開 Discord 訊息 ↗');a.href=pub.messageUrl;a.target='_blank';a.rel='noopener';box2.append(a);}
    box2.append(el('p','cs-note','想換新的闆卡，請先撤下這則，再重新預覽與分享。'));
    const w=btn('cs-ghost',s.busy==='withdraw'?'撤下中…':'撤下這則分享',withdraw);w.disabled=!!s.busy||s.loading;box2.append(w);
   }else if(pub.status==='processing'){
    box2.append(el('b','','發布中，正在等 Discord 回覆…'),el('p','cs-note','請不要重複分享。'));
    const r=btn('cs-ghost',s.loading?'讀取中…':'重新讀取',loadCurrent);r.disabled=s.loading;box2.append(r);
   }else{
    box2.append(el('b','','發布結果待確認，請勿重複分享'),el('p','cs-note','操作編號：'+(pub.publicationId||'')+'。酒館會確認結果；需要協助請把這個編號給掌櫃。'));
    const r=btn('cs-ghost',s.loading?'讀取中…':'重新讀取',loadCurrent);r.disabled=s.loading;box2.append(r);
   }
   body.append(box2);if(s.error)body.append(el('p','cs-error',s.error));return;
  }
  const locked=!!s.busy||s.loading;
  // 欄位選擇（預覽、發布進行中停用）
  const sec=el('div','cs-fields');sec.append(el('div','cs-label','要公開的內容'));
  const avail=available();for(const f of [...s.fields])if(!avail.includes(f))s.fields.delete(f);
  for(const f of avail){
   const lab=el('label','cs-field');const cb=el('input');cb.type='checkbox';cb.checked=s.fields.has(f);
   const must=f==='name'||f==='character';if(must)cb.checked=true;cb.disabled=must||locked;
   cb.onchange=()=>{if(s!==st||s.busy||s.loading){cb.checked=s.fields.has(f);return;}cb.checked?s.fields.add(f):s.fields.delete(f);clearPreview(s);s.error='';paint();};
   lab.append(cb,el('span','',FIELD_LABEL[f]+(must?'（必選）':'')));sec.append(lab);
  }
  sec.append(el('p','cs-note','圖片與文字不會出現生日、錢包或 Discord ID。'));
  body.append(sec);
  const gen=btn('cs-ghost',s.busy==='preview'?'產生預覽中…（最多約 1 分鐘）':(s.preview?'重新產生預覽':'產生預覽'),makePreview);gen.disabled=locked;body.append(gen);
  if(s.preview){
   const pv=el('div','cs-preview');
   if(s.imageUrl&&!s.imgErr){
    const url=s.imageUrl,img=el('img','cs-img');img.alt='闆卡分享預覽';img.title='點一下放大';img.onclick=()=>zoom(url);
    // 只有目前這張預覽圖真的載入並解碼成功，才開放同意；重畫時已成功就不再觸發 paint，避免循環
    if(!s.imgOk){img.onload=async()=>{try{await img.decode?.();}catch(e){}if(s!==st||s.imageUrl!==url||s.imgOk)return;if(img.naturalWidth>0){s.imgOk=true;paint();}};
     img.onerror=()=>{if(s!==st||s.imageUrl!==url)return;s.imgOk=false;s.imgErr=true;s.consent=false;paint();};}
    img.src=url;pv.append(img,el('small','cs-note',s.imgOk?'點圖片可以放大。這是當下的快照，改了裝扮要重新預覽。':'圖片顯示中…'));
   }else if(s.imgErr){
    pv.append(el('p','cs-error','預覽圖片沒有顯示成功，暫時不能分享。'));const r=btn('cs-ghost',s.busy==='image'?'重新載入中…':'重新載入圖片',reloadImage);r.disabled=locked;pv.append(r);
   }else pv.append(el('p','cs-lead','圖片載入中…'));
   body.append(pv);
   const who=s.preview.discordIdentity||{};const dest=(s.preview.destination&&s.preview.destination.name)||'酒館 Discord';
   const idText=who.displayName?who.displayName+'（ID '+who.id+'）':'尚未取得 Discord 名稱（ID '+(who.id||'—')+'）';
   const info=el('div','cs-info');info.append(el('div','','發布帳號：'+idText),el('div','','發布位置：'+dest));
   const shown=(s.preview.requested||[]).map(f=>FIELD_LABEL[f]).filter(Boolean).join('、');if(shown)info.append(el('div','cs-note','這張預覽包含：'+shown));
   if(s.preview.expiresAt)info.append(el('div','cs-note','預覽有效到 '+new Date(s.preview.expiresAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})));
   body.append(info);
   const lab=el('label','cs-consent');const cb=el('input');cb.type='checkbox';cb.checked=s.consent&&s.imgOk;cb.disabled=!s.imgOk||locked;
   cb.onchange=()=>{if(s!==st||!s.imgOk){cb.checked=false;return;}s.consent=cb.checked;paint();};
   lab.append(cb,el('span','','我確認用上面的 Discord 帳號，把這張闆卡發到「'+dest+'」，訊息會連結我的 Discord 身分。'));body.append(lab);
   const go=btn('cs-primary',s.busy==='publish'?'分享中…':(s.pending?'再試一次':'確認分享'),()=>publish(!!s.pending));go.disabled=!canPublish(s);body.append(go);
  }
  if(s.error)body.append(el('p','cs-error',s.error));
 }
 function zoom(url){const z=el('div','cs-zoom');const img=el('img');img.src=url;img.alt='闆卡分享預覽放大';z.append(img);z.onclick=()=>z.remove();box.append(z);}

 // 每次打開都重新讀取 current（另一個分頁撤下、輪詢到上限後重開都能更新）
 function open(){
  if(!enabled())return;box.hidden=false;st.error='';paint();loadCurrent();
 }
 window.TTCardShare={open,enabled};
 // 自己的闆卡加上入口（只在測試入口開放期間顯示）
 const orig=window.pcSocialRender;
 window.pcSocialRender=function(){const r=typeof orig==='function'?orig.apply(this,arguments):undefined;
  try{const host=document.getElementById('pcSocial');const t=window.popTarget||(typeof popTarget!=='undefined'?popTarget:null);
   if(host&&enabled()&&t&&t.myKey&&typeof myKey!=='undefined'&&t.myKey===myKey&&!host.querySelector('.cs-entry')){host.append(btn('cs-entry','分享到 Discord ↗',()=>{try{closeCard();}catch(e){}open();}));}}catch(e){}
  return r;};
}
