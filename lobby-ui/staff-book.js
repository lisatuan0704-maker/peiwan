/* v414 冒險者通訊錄（手機首頁）：三位冒險者的上班狀態與會員私訊入口。
   上班中＝在線上；未加入月費會員時整區蓋一層灰色提示。只讀既有 staffStatus／dmMeta，不新增資料寫入。 */
(function(){
  'use strict';
  const NAMES={KABUKI:'蕪',RIRA:'縭',MOMO:'桃'};
  const ORDER=['MOMO','KABUKI','RIRA'];
  let box=null,timer=null,sig='';
  const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;};
  const list=()=>{let a=[];try{a=window.TinyTavernUI?.staff?.()||[];}catch(e){}
    return a.filter(s=>s&&s.theme).sort((x,y)=>Number(y.on)-Number(x.on)||ORDER.indexOf(x.theme)-ORDER.indexOf(y.theme));};
  const tier=()=>{try{return Number(window.ttMemberTier?.())||0;}catch(e){return 0;}};
  const meta=()=>{try{return window.ttDmMeta?.()||{};}catch(e){return {};}};
  function close(){if(!box)return;box.hidden=true;if(timer){clearInterval(timer);timer=null;}}
  function build(){
    box=el('div');box.id='staffBookM';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','sbTitle');
    box.addEventListener('click',e=>{if(e.target===box)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box&&!box.hidden)close();});
    document.body.append(box);
  }
  function row(s,m,locked){
    const r=el('article','sb-row'+(s.on?' is-on':''));
    const av=el('span','sb-ava');const pic=el('span','sb-pic');const im=el('img');im.src='tavern-ui/assets/avatar-'+s.theme+'.png?v=260';im.alt=s.name;pic.append(im);av.append(pic);
    av.append(el('i','sb-dot'+(s.on?(s.busy?' busy':' on'):'')));
    const info=el('div','sb-info');
    const top=el('div','sb-top');top.append(el('b','sb-name',NAMES[s.theme]||s.name),el('small','sb-state'+(s.on?' on':''),s.on?(s.busy?'上班中・委託進行中':'上班中・在線上'):'休息中'));
    info.append(top);
    const t=m['staff_'+s.cid];
    info.append(el('p','sb-last',t&&t.last?t.last:(s.on?'現在上班中，可以留言給我。':'下班中也能先留言，上班後會看到。')));
    const un=Number(t&&t.unread)||0;
    const b=el('button','sb-go',un?'私訊 '+un:'私訊');b.type='button';b.disabled=locked;
    b.onclick=()=>{close();setTimeout(()=>window.staffDmOpen?.(s.cid,NAMES[s.theme]||s.name),40);};
    r.append(av,info,b);return r;
  }
  function paint(){
    if(!box||box.hidden)return;
    const staff=list(),m=meta(),hasThread=staff.some(s=>m['staff_'+s.cid]);
    const locked=tier()<1&&!hasThread;
    const k=JSON.stringify([locked,staff.map(s=>[s.cid,s.on,s.busy]),staff.map(s=>m['staff_'+s.cid]||0)]);
    if(k===sig&&box.firstChild)return;sig=k;
    const keep=box.querySelector('.sb-body')?.scrollTop||0;
    box.replaceChildren();
    const card=el('div','sb-card');box.append(card);
    const head=el('div','sb-head');head.append(el('small','sb-eyebrow','ADVENTURER CONTACTS'));
    const h=el('h2','','冒險者通訊錄');h.id='sbTitle';head.append(h);
    const x=el('button','sb-x','×');x.type='button';x.setAttribute('aria-label','關閉');x.onclick=close;head.append(x);
    card.append(head);
    const body=el('div','sb-body');card.append(body);
    const on=staff.filter(s=>s.on),off=staff.filter(s=>!s.on);
    const sec=(title,arr,empty)=>{const w=el('section','sb-sec');w.append(el('h3','',title+'・'+arr.length+' 位'));
      if(!arr.length)w.append(el('p','sb-empty',empty));arr.forEach(s=>w.append(row(s,m,locked)));body.append(w);};
    sec('在線區',on,'目前沒有冒險者上班，可以先留言。');
    sec('休息中',off,'大家都在線上。');
    body.append(el('p','sb-note','會員私訊會保留在酒館，掌櫃可調閱。上班時間以冒險者實際打卡為準。'));
    if(locked){
      const lock=el('div','sb-lock');lock.append(el('b','','此區為月卡會員專用'),el('span','','加入任一月費會員方案即可使用'));
      const go=el('button','sb-plan','查看月費會員');go.type='button';go.onclick=()=>{close();try{shopOpen(2,'member');}catch(e){}};
      lock.append(go);body.classList.add('is-locked');card.append(lock);requestAnimationFrame(()=>card.style.setProperty('--sb-head',head.offsetHeight+'px'));
    }
    body.scrollTop=keep;
  }
  function open(){
    if(!box)build();box.hidden=false;sig='';paint();
    if(timer)clearInterval(timer);timer=setInterval(paint,2000);
    setTimeout(()=>box.querySelector('.sb-x')?.focus(),30);
  }
  window.TTStaffBook={open,close};
})();
