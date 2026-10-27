/* v411 冒險者手札：會員私訊收件匣。
   沿用大廳私訊同一套資料：dm/<雙方代號排序以~相接>、dmMeta/<代號>/<對方>；冒險者代號為 staff_<角色ID>。
   只讀寫這兩個位置，不碰訂單、錢包或其他資料。 */
(function(root){
 'use strict';
 const pairKey=(a,b)=>[a,b].sort().join('~');
 const clock=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const when=at=>Number.isFinite(at)&&at>0?clock.format(new Date(at)):'';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const catalog=()=>Array.isArray(root.TTStickerCatalog)?root.TTStickerCatalog:[];
 function sticker(text){const m=/^\[貼圖:([a-z0-9-]+)\]$/.exec(String(text||''));if(!m)return null;return catalog().find(s=>s.id===m[1])||null;}
 function mount(opts){
  const {db,ROOT,cid,host}=opts;const me='staff_'+cid;const myName=()=>{try{return opts.getName()||'冒險者'}catch(e){return '冒險者'}};
  host.classList.add('sdm');
  host.innerHTML='';
  const head=el('div','sdm-head');head.append(el('h2','','會員私訊'),el('span','sdm-count',''));
  const hint=el('p','sdm-hint','進階／尊榮會員可以從酒館私訊你。點名字打開對話，可以回覆文字或貼圖。');
  const body=el('div','sdm-body');const list=el('div','sdm-list');const pane=el('div','sdm-pane');
  body.append(list,pane);host.append(head,hint,body);
  let meta={},current=null,ref=null,sending=false;
  function paintList(){
   const rows=Object.entries(meta).filter(([k,v])=>v&&typeof v==='object').sort((a,b)=>(Number(b[1].lastAt)||0)-(Number(a[1].lastAt)||0));
   const unread=rows.reduce((s,[,v])=>s+(Number(v.unread)||0),0);
   head.querySelector('.sdm-count').textContent=unread?unread+' 則未讀':'';
   list.replaceChildren();
   if(!rows.length){list.append(el('div','sdm-empty','還沒有會員私訊你。'));return;}
   for(const [k,v] of rows){
    const b=el('button','sdm-row'+(k===current?' on':''));b.type='button';
    const top=el('div','sdm-row-top');top.append(el('b','',v.name||'老闆'),el('small','',when(Number(v.lastAt))));
    b.append(top,el('span','sdm-last',v.last||''));
    if(Number(v.unread)>0)b.append(el('i','sdm-badge',String(v.unread>99?'99+':v.unread)));
    b.onclick=()=>open(k);list.append(b);
   }
  }
  function renderMessages(log,v){
   const entries=Object.entries(v||{}).filter(([,m])=>m&&typeof m==='object').sort(([,a],[,b])=>(Number(a.at)||0)-(Number(b.at)||0));
   const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;
   log.replaceChildren();
   for(const [,m] of entries){
    const mine=m.f===me;const row=el('div','sdm-msg'+(mine?' mine':''));
    const st=sticker(m.x);
    if(st){const img=el('img','sdm-sticker');img.src='tavern-ui/'+st.asset;img.alt=st.name+'貼圖';img.draggable=false;row.append(img);}
    else row.append(el('div','sdm-bubble',String(m.x||'')));
    row.append(el('small','sdm-time',when(Number(m.at))));log.append(row);
   }
   if(!entries.length)log.append(el('div','sdm-empty','還沒有訊息。'));
   if(atBottom||log.dataset.first!=='0'){log.scrollTop=log.scrollHeight;log.dataset.first='0';}
  }
  function open(k){
   if(ref){try{ref.off()}catch(e){}ref=null;}
   current=k;paintList();
   const v=meta[k]||{};pane.replaceChildren();
   const top=el('div','sdm-pane-head');top.append(el('b','',v.name||'老闆'));
   const log=el('div','sdm-log');log.dataset.first='1';
   const form=el('div','sdm-form');const input=el('input','sdm-input');input.maxLength=200;input.placeholder='回覆訊息（最多 200 字）';
   const stBtn=el('button','sdm-st-btn','貼圖');stBtn.type='button';const send=el('button','sdm-send','送出');send.type='button';
   const picker=el('div','sdm-picker');picker.hidden=true;
   for(const s of catalog()){const b=el('button','');b.type='button';b.title=s.name;const img=el('img','');img.src='tavern-ui/'+s.asset;img.alt=s.name;b.append(img);b.onclick=()=>{picker.hidden=true;void post('[貼圖:'+s.id+']',s.name);};picker.append(b);}
   stBtn.onclick=()=>{picker.hidden=!picker.hidden;};
   send.onclick=()=>void post(input.value.trim());input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();void post(input.value.trim());}};
   form.append(stBtn,input,send);pane.append(top,log,picker,form);
   try{db.ref(ROOT+'/dmMeta/'+me+'/'+k+'/unread').set(0);}catch(e){}
   ref=db.ref(ROOT+'/dm/'+pairKey(me,k)).limitToLast(100);
   ref.on('value',s=>{if(current!==k)return;renderMessages(log,s.val());try{db.ref(ROOT+'/dmMeta/'+me+'/'+k+'/unread').set(0);}catch(e){}});
   async function post(text,stickerName){
    if(sending||!text||current!==k)return;sending=true;send.disabled=true;
    try{
     const at=Date.now();await db.ref(ROOT+'/dm/'+pairKey(me,k)).push({f:me,x:text.slice(0,200),at});
     if(!stickerName)input.value='';
     const last=stickerName?'[貼圖] '+stickerName:text.slice(0,40);
     await Promise.allSettled([
      db.ref(ROOT+'/dmMeta/'+me+'/'+k).update({last,lastAt:at}),
      db.ref(ROOT+'/dmMeta/'+k+'/'+me).update({last,lastAt:at,name:myName(),staff:true}),
      db.ref(ROOT+'/dmMeta/'+k+'/'+me+'/unread').transaction(c=>(c||0)+1)]);
    }catch(e){alert('訊息沒有送出，請稍後再試。');}
    finally{sending=false;send.disabled=false;input.focus();}
   }
  }
  pane.append(el('div','sdm-empty','選一位老闆打開對話。'));
  db.ref(ROOT+'/dmMeta/'+me).on('value',s=>{meta=s.val()||{};paintList();});
 }
 root.TTStaffDM={mount};
})(window);
