/* 儲值與 VIP 的視覺導引。沿用既有付款、送出及等級切換處理器。 */
(() => {
  'use strict';
  const pay=document.getElementById('topupPayM');
  const info=document.getElementById('tuPayInfo');
  const fields=pay.querySelector('.tu-transfer-fields');
  fields.addEventListener('focusin',event=>{
    const prompts={tuName:'填寫稱呼，讓掌櫃核對這筆轉帳。',tuLast5:'填寫轉出帳號末五碼，方便對帳。',tuProof:'上傳轉帳成功的截圖，再送出核帳。'};
    const hint=info.querySelector('.tu-next-hint');
    if(hint&&prompts[event.target.id])hint.textContent=prompts[event.target.id];
  });
  function preparePayment(){
    if(!info.querySelector('.tu-receipt')||info.querySelector('.tu-methods'))return;
    const receipt=info.querySelector('.tu-receipt');
    const divider=info.querySelector('.tu-bank-divider');
    const online=document.createElement('section');online.className='tu-method-body tu-online-view';online.id='tuOnlineView';
    const bank=document.createElement('section');bank.className='tu-method-body tu-bank-view';bank.id='tuBankView';
    let inBank=false;
    [...info.children].forEach(node=>{
      if(node===receipt)return;
      if(node===divider){inBank=true;node.remove();return;}
      (inBank?bank:online).append(node);
    });
    bank.append(fields);
    pay.querySelector('.tu-bank-view')?.remove();
    const choice=document.createElement('div');choice.className='tu-methods';
    choice.innerHTML='<div class="tu-choice-label"><b>選擇付款方式</b><span>先選一種，再繼續付款</span></div><div class="tu-method-grid" role="group" aria-label="付款方式"><button type="button" data-method="online" aria-controls="tuOnlineView"><span class="tu-method-icon" aria-hidden="true">↗</span><span><b>線上付款</b><small>信用卡・超商 / 自動入帳</small></span><i aria-hidden="true">✓</i></button><button type="button" data-method="bank" aria-controls="tuBankView"><span class="tu-method-icon" aria-hidden="true">⇄</span><span><b>銀行轉帳</b><small>上傳憑證 / 掌櫃核帳</small></span><i aria-hidden="true">✓</i></button></div>';
    info.append(choice,online,bank);
    online.querySelector('.tu-section-heading>span').textContent='NEXT / 前往付款';
    fields.querySelector('.tu-section-heading>span').textContent='NEXT / 填寫轉帳資料';
    const hint=document.createElement('p');hint.className='tu-next-hint';hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');info.append(hint);
    function select(method){
      pay.dataset.method=method;
      online.hidden=method!=='online';bank.hidden=method!=='bank';
      pay.querySelector('#tuSubmitBtn').hidden=method!=='bank';
      choice.querySelectorAll('[data-method]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.method===method)));
      hint.textContent=method==='online'?'下一步：點選「線上付款」，前往付款頁。':'下一步：完成轉帳後，填寫資料並上傳付款證明。';
    }
    choice.addEventListener('click',event=>{const button=event.target.closest('[data-method]');if(button)select(button.dataset.method);});
    // 放回固定位置，避免下次選金額重建內容時連同表單一起移除。
    info.after(bank);
    select('online');
  }
  new MutationObserver(preparePayment).observe(info,{childList:true});
  preparePayment();
  const vip=document.getElementById('vipList');
  let navigation=null;
  vip.addEventListener('click',event=>{
    const button=event.target.closest('.vipDots button,.vipPgB');
    if(button&&!button.disabled)navigation=button.classList.contains('vipPgB')?(button===button.parentElement.lastElementChild?'next':'previous'):button.textContent;
  },true);
  function prepareMembership(){
    const card=vip.querySelector('.vipCard');if(!card||card.dataset.guided)return;
    card.dataset.guided='true';
    const dots=vip.querySelector('.vipDots');
    const items=[...dots.children],current=items.findIndex(dot=>dot.classList.contains('on'));
    dots.setAttribute('role','group');dots.setAttribute('aria-label','查看各級 VIP 獎勵');
    items.forEach((dot,index)=>{
      const button=document.createElement('button');button.type='button';button.className=dot.className;
      button.textContent=String(index+1);button.setAttribute('aria-label','查看 VIP '+(index+1)+' 獎勵');button.setAttribute('aria-pressed',String(index===current));
      button.onclick=()=>window.vipPg(index-current);dot.replaceWith(button);
    });
    const label=document.createElement('div');label.className='vip-browse-label';label.innerHTML='<span>會員獎勵 / '+(current+1)+' OF '+items.length+'</span><b>查看每一級的小禮</b>';
    card.before(label);
    const summary=vip.querySelector('.vip-progress-summary');
    const eyebrow=document.createElement('span');eyebrow.className='vip-summary-label';eyebrow.textContent='目前的你 / YOUR MEMBERSHIP';summary.prepend(eyebrow);
    if(navigation){
      const target=navigation==='next'?vip.querySelector('.vipPgB:last-child'):navigation==='previous'?vip.querySelector('.vipPgB:first-child'):[...dots.children].find(button=>button.textContent===navigation);
      const pane=document.querySelector('#vipM .panel-content');
      requestAnimationFrame(()=>{
        (target?.disabled?dots.querySelector('.on'):target)?.focus({preventScroll:true});
        pane.scrollTo({top:pane.scrollTop+label.getBoundingClientRect().top-pane.getBoundingClientRect().top-12,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      });
      navigation=null;
    }
  }
  new MutationObserver(prepareMembership).observe(vip,{childList:true});
  prepareMembership();
})();
