/* v234：同組冒險者共用方案與時段；每位保留既有接單資料格式。 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), money=n=>Number(n).toLocaleString('zh-TW');
 const previous={open:shopOpen,pick:pickPlan,reserve:openReserve,coin:payWithCoins,transfer:submitOrder,coinInfo:renderCoinInfo};
 let submitting=false,reserveToken=0;
 function members(){if(curKind!=='play'||!selStaff)return [];return selStaff.members||[selStaff];}
 function count(){return Math.max(1,members().length);}
 function duration(plan){const n=plan?.n||plan?.planName||'';let m=n.match(/(\d+(?:\.\d+)?)\s*小時/);if(m)return Math.round(+m[1]*60);m=n.match(/(\d+)\s*分/);if(m)return +m[1];if(/一日|一天|全日/.test(n))return 1440;return 60;}
 function pricing(unit,quantity,discount=0){
   if(!Number.isFinite(unit)||unit<=0||!Number.isInteger(quantity)||quantity<1)throw Error('方案價格有誤，請重新選擇');
   const scale=Number.isInteger(unit)&&Number.isInteger(Number(discount)||0)?1:100;
   const cents=Math.round(unit*scale),total=cents*quantity,off=Math.min(total,Math.max(0,Math.round((Number(discount)||0)*scale)));
   const base=Math.floor(off/quantity),extra=off%quantity;
   return {unit:cents/scale,total:total/scale,discount:off/scale,amount:(total-off)/scale,shares:Array.from({length:quantity},(_,i)=>({amount:(cents-base-(i<extra?1:0))/scale,discount:(base+(i<extra?1:0))/scale}))};
 }
 const AVN={KABUKI:'蕪',MOMO:'桃',RIRA:'縭'};function chips(){const list=members();return '<div class="of-members">'+(list.length?list.map(p=>{const th=p.theme,nm=(th&&AVN[th])||p.name;return th?'<img class="of-av" src="tavern-ui/assets/avatar-'+esc(th)+'.png?v=260" alt="'+esc(nm)+'" title="'+esc(nm)+'">':'<span>'+esc(nm)+'</span>';}).join(''):'<span>不指定冒險者 · 1 位</span>')+'</div>';}
 function heading(id,kicker,title,step){
   const box=$(id),card=box.querySelector('.shopCard');box.classList.add('tt-order-flow');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',title);
   let head=card.querySelector('.of-heading');if(!head){head=document.createElement('div');head.className='of-heading';card.prepend(head);}
   head.innerHTML='<small>'+kicker+'</small><h2>'+title+'</h2><span class="of-ghost" aria-hidden="true">PLAY</span><button type="button" class="of-close" aria-label="關閉點單視窗">×</button>';
   head.querySelector('.of-close').onclick=()=>{if(submitting){toast('正在送出這組點單，請稍候');return;}reserveToken++;shopClose();};
   const old=card.querySelector(':scope > h3');if(old)old.hidden=true;
   let track=card.querySelector('.of-track');if(!track){track=document.createElement('div');track.className='of-track';head.after(track);}
   track.innerHTML=['選冒險者','選方案',pkMode==='book'?'約時間':'即時出發','確認付款'].map((t,i)=>'<span class="'+(i===step?'active':'')+'"><b>0'+(i+1)+'</b> '+t+'</span>').join('');
 }
 function context(id){const card=$(id).querySelector('.shopCard');let el=card.querySelector('.of-context');if(!el){el=document.createElement('div');el.className='of-context';card.querySelector('.of-track').after(el);}el.innerHTML='<div class="of-context-line"><strong>這次一起玩的 '+count()+' 位冒險者</strong><span>'+(pkMode==='book'?'預約一起玩':'即時一起玩')+'</span></div>'+chips();}
 function summary(){
   if(curKind!=='play'||!curPlan)return '';
   const unit=curPlan.unitPrice??curPlan.p,qty=curPlan.quantity||1;
   return '<div class="of-receipt"><div><span>方案</span><b>'+esc(curPlan.n)+'</b></div><div><span>每位冒險者</span><b>NT$ '+money(unit)+'</b></div><div><span>冒險者人數</span><b>'+qty+' 位</b></div>'+(curBooking&&curReserveAt?'<div><span>預約時間</span><b>'+esc(fmtRes(curReserveAt))+'</b></div>':'')+'<div class="of-total"><span>方案合計</span><strong>'+money(unit)+' <i>× '+qty+' ＝</i> '+money(curPlan.p)+'</strong></div><small>優惠券如有使用，會從整筆合計折抵一次。</small></div>';
 }
 function checkout(){if(curKind!=='play')return;heading('shopM3','CHECK YOUR ORDER / 點單確認','這次，就一起玩吧。',3);context('shopM3');const card=$('shopM3').querySelector('.shopCard');let receipt=card.querySelector('.of-checkout-summary');if(!receipt){receipt=document.createElement('div');receipt.className='of-checkout-summary';card.querySelector('.of-context').after(receipt);}receipt.innerHTML=summary();}
 function validate(list=members(),booking=pkMode==='book'){
   for(const p of list){const s=STAFF_ALL[p.cid],c=STAFF_CARDS[p.cid]||{};if(!s||(!booking&&(!s.on||s.busy))||(booking&&c.noBooking))throw Error(p.name+' 的接單狀態已變更，請返回名簿重新選擇');}
 }
 function validPlan(){const p=playItems().find(x=>x.id===curPlan?.id);if(!p||p.p!==(curPlan.unitPrice??curPlan.p))throw Error('方案價格已更新，請返回重新選擇');return p;}
 shopOpen=function(step,kind){
   if(submitting){toast('正在送出這組點單，請稍候');return;}
   const result=previous.open(step,kind);
   if(step===2&&curKind==='play'){
     heading('shopM2','CHOOSE YOUR PLAN / 今天想怎麼玩','選一個，一起玩。',1);context('shopM2');
     $('m2list').innerHTML=playItems().map((p,i)=>'<button type="button" class="planBtn" data-of-plan="'+esc(p.id)+'"><span class="of-plan-number">'+String(i+1).padStart(2,'0')+'</span><span class="of-plan-name"><b>'+esc(p.n)+'</b><small>這個方案會套用到所選的 '+count()+' 位冒險者</small></span><span class="pp">NT$ '+money(p.p)+'<small>／每位冒險者</small></span><span class="of-plan-arrow" aria-hidden="true">→</span></button>').join('');
     $('m2list').querySelectorAll('[data-of-plan]').forEach(b=>b.onclick=()=>pickPlan(b.dataset.ofPlan));
     $('shopM2').querySelector('.sc-back').textContent='← 調整冒險者名單';
   } else if(step===3&&curKind==='play')checkout();
   else if(step===2||step===3){const modal=$('shopM'+step);modal.classList.remove('tt-order-flow');modal.querySelectorAll('.of-heading,.of-track,.of-context,.of-checkout-summary').forEach(e=>e.remove());modal.querySelector('.shopCard > h3').hidden=false;}
   return result;
 };
 pickPlan=function(id){
   if(curKind!=='play')return previous.pick(id);
   try{validate();const p=playItems().find(x=>x.id===id);if(!p)throw Error('這個方案已下架，請重新選擇');const price=pricing(p.p,count());curPlan={...p,unitPrice:p.p,quantity:count(),p:price.total};curBooking=pkMode==='book';curReserveAt=null;if(curBooking)openReserve(()=>shopOpen(3));else shopOpen(3);}catch(e){toast(e.message);}
 };
 renderCoinInfo=function(){
   const out=previous.coinInfo();if(curKind!=='play')return out;
   const box=$('payCoinInfo'),label=box.querySelector('label'),topup=box.querySelector('a')?.closest('div'),balance=window.__wallet||0,amount=payFinalAmount();
   box.innerHTML='<div class="of-payment-line"><span>本次應付</span><strong>'+money(amount)+' <small>金幣</small></strong></div><div class="of-wallet-line">持有 '+money(balance)+' 金幣 · 付款後剩 '+money(Math.max(0,balance-amount))+' 金幣</div>';
   if(label)box.append(label);if(topup)box.append(topup);checkout();return out;
 };
 async function bookings(list){
   const result=await Promise.all(list.map(async p=>{const snap=await db.ref(ROOT+'/clientOrders').orderByChild('staffCid').equalTo(p.cid).once('value');return Object.values(snap.val()||{}).filter(o=>o&&o.booking&&o.reserveAt&&o.status!=='cancelled'&&o.status!=='done'&&!o.staffDeclined).map(o=>({s:o.reserveAt,e:o.reserveAt+(duration(o)+(+o.extraMins||0))*60000,cid:p.cid,name:p.name}));}));return result.flat();
 }
 function conflict(list,ranges,ms,mins){for(const p of list){const b=busyRange(p.cid,ms,mins);if(b)return {...b,name:p.name};}return ranges.find(b=>b.s<ms+mins*60000&&b.e>ms)||null;}
 openReserve=async function(next){
   if(curKind!=='play')return previous.reserve(next);
   const token=++reserveToken,list=members().map(p=>({...p}));let date=null,hour=null,minute=null,ranges=[],loading=true,loadError=false;
   curReserveAt=null;shopClose();heading('resM','FIND A TIME / 共用時段','約個大家都有空的時間。',2);context('resM');$('resM').style.display='flex';
   const oldIntro=$('resM').querySelector('.shopCard > h3 + div');if(oldIntro)oldIntro.textContent='選一次時間，所選冒險者會一起收到同一時段的預約。';
   $('resM').querySelector('.sc-back').textContent='← 返回方案';$('resM').querySelector('.sc-back').onclick=()=>{reserveToken++;shopOpen(2,'play');};
   $('resGo').textContent='確認時段，前往結帳 →';$('resGo').disabled=true;
   const today=new Date();today.setHours(0,0,0,0);$('resDates').innerHTML='';
   for(let i=0;i<=30;i++){const d=new Date(today);d.setDate(d.getDate()+i);const b=document.createElement('button');b.type='button';b.className='resChip';b.innerHTML='<span>'+(i===0?'今天':i===1?'明天':'週'+'日一二三四五六'[d.getDay()])+'</span><b>'+(d.getMonth()+1)+'/'+d.getDate()+'</b>';b.setAttribute('aria-label',(d.getMonth()+1)+'月'+d.getDate()+'日');b.onclick=()=>{date=d;hour=minute=null;curReserveAt=null;[...$('resDates').children].forEach(x=>x.classList.toggle('on',x===b));draw();};$('resDates').append(b);}
   function time(h,m){const d=new Date(date);d.setHours(h,m,0,0);return d.getTime();}
   function blocked(ms){return ms<Date.now()+15*60000||!!conflict(list,ranges,ms,duration(curPlan));}
   function draw(){
     $('resHours').innerHTML='';$('resMins').innerHTML='';
     for(let h=0;h<24;h++){const b=document.createElement('button');b.type='button';b.textContent=String(h).padStart(2,'0');b.setAttribute('aria-label',h+'時');b.disabled=!date||loading||loadError||Array.from({length:6},(_,i)=>time(h,i*10)).every(blocked);b.className=(b.disabled?'busy ':'')+(hour===h?'on':'');b.onclick=()=>{hour=h;minute=null;curReserveAt=null;draw();};$('resHours').append(b);}
     for(let m=0;m<60;m+=10){const b=document.createElement('button');b.type='button';b.textContent=':'+String(m).padStart(2,'0');b.setAttribute('aria-label',m+'分');b.disabled=hour===null||loading||loadError||blocked(time(hour,m));b.className=(b.disabled?'busy ':'')+(minute===m?'on':'');b.onclick=()=>{minute=m;curReserveAt=time(hour,m);draw();};$('resMins').append(b);}
     $('resPick').textContent=loading?'正在確認所有冒險者的行事曆…':loadError?'時段資料讀取失敗，請返回方案再試。':curReserveAt?'已選 '+fmtRes(curReserveAt):!date?'先選日期，再挑選時間。':hour===null?'接著選擇小時。':'最後選擇分鐘。';
     $('resBooked').textContent=loading||loadError?'':'灰色時段表示至少一位冒險者已有安排，或距現在不足 15 分鐘。';$('resGo').disabled=loading||loadError||!curReserveAt;
   }
   $('resGo').onclick=()=>{try{validate(list,true);validPlan();if(!curReserveAt||blocked(curReserveAt))throw Error('這個時段已無法預約，請重新選擇');shopClose();next();}catch(e){toast(e.message);}};
   draw();try{ranges=await bookings(list);}catch(e){loadError=true;}if(token!==reserveToken)return;loading=false;draw();
 };
 function coupon(){const use=payMethod==='coin'?_coinCoupon:!!$('useCoupon')?.checked;const vi=window.__vipInfo?.();return use&&couponsLeft()>0&&vi?.lv?Number(vi.cur.disc)||0:0;}
 function makeRecords(snapshot,ids,groupId){
   const {list,plan,price,name,last5,booking,reserveAt,key,method,createdAt}=snapshot;
   return list.map((p,i)=>({id:ids[i],order:{plan:plan.id,planName:plan.n,amount:price.shares[i].amount,origAmount:price.unit,couponUsed:price.discount>0,couponDisc:price.shares[i].discount,type:'play',itemId:null,itemName:null,name,last5:method==='coin'?null:last5,hasProof:method!=='coin',...(method==='coin'?{paidBy:'wallet'}:{}),staffName:p.name,staffCid:p.cid,booking,reserveAt:booking?reserveAt:null,status:method==='coin'?'confirmed':'pending',createdAt,payDue:createdAt+PAY_MINS*60000,myKey:key,groupId,groupSize:list.length,groupStaffNames:list.map(x=>x.name),groupTotal:price.total,groupAmount:price.amount,groupCouponDisc:price.discount,unitPrice:price.unit}}));
 }
 async function submitGroup(method){
   if(submitting||_submitting)return;
   let snap;
   try{
     if(!myKey||!me()?.b)throw Error('請先使用闆卡進入酒館，再進行點單');validate();validPlan();
     const name=$(method==='coin'?'payNameCoin':'payName').value.trim(),last5=$('payLast5').value.trim();
     if(!name)throw Error('請填稱呼或 Discord 名');if(method!=='coin'&&!/^\d{5}$/.test(last5))throw Error('帳號末五碼需為 5 位數字');if(method!=='coin'&&!proofData)throw Error('請上傳轉帳截圖');
     const list=members().map(p=>({...p})),price=pricing(curPlan.unitPrice,list.length,coupon());
     if(method==='coin'&&(window.__wallet||0)<price.amount)throw Error('餘額不足，請先儲值');
     snap={list,plan:{...curPlan},price,name,last5,booking:curBooking,reserveAt:curReserveAt,key:myKey,method,createdAt:Date.now(),proof:proofData};
   }catch(e){toast(e.message);return;}
   submitting=_submitting=true;const btn=$('paySubmitBtn');btn.disabled=true;btn.textContent='正在確認與送出…';
   const stopWait=submitGuard('paySubmitBtn','送出訂單');
   let records=[],groupId;
   try{
     if(snap.booking){const ranges=await bookings(snap.list);validate(snap.list,true);if(!snap.reserveAt||snap.reserveAt<Date.now()+15*60000||conflict(snap.list,ranges,snap.reserveAt,duration(snap.plan)))throw Error('至少一位冒險者的時段已有安排，請返回重新選擇');}
     const refs=snap.list.map(()=>db.ref(ROOT+'/clientOrders').push());groupId=refs[0].key;records=makeRecords(snap,refs.map(r=>r.key),groupId);
     const updates={};records.forEach(({id,order})=>{updates['clientOrders/'+id]=order;if(method!=='coin')updates['clientOrderProofs/'+id]=snap.proof;});
     if(method==='coin'){
      await walletSafety().execute({key:snap.key,amount:snap.price.amount,ids:records.map(r=>r.id),lookup:walletLookup,commit:async()=>{
        updates['wallet/'+snap.key+'/balance']=firebase.database.ServerValue.increment(-snap.price.amount);
        updates['walletTx/'+snap.key+'/'+groupId]={type:'spend',amount:-snap.price.amount,ref:groupId,groupId,orderIds:records.map(r=>r.id),note:snap.plan.n+'・'+snap.list.length+' 位冒險者',ts:snap.createdAt};
        await db.ref(ROOT).update(updates);
       }});
     }else await db.ref(ROOT).update(updates);
     try{const ids=[...new Set([...myOrderIds(),...records.map(r=>r.id)])];localStorage.setItem('tt_orders',JSON.stringify(ids));}catch(_){}
     proofData=null;shopClose();
     try{statInc('orders');watchMyOrders();}catch(_){}
     records.forEach(({order})=>{try{notifyOrder(order);}catch(_){}});
     const title=method==='coin'?'已完成這組付款':'這組預約已送出';
     if(window.lobbyNotify)lobbyNotify({ok:true,icon:'receipt',title,sub:snap.list.map(p=>p.name).join('、')+' · '+snap.plan.n+' · 合計 '+money(snap.price.amount),onclick:()=>shopOpen(4),hold:8000});else toast(title);
   }catch(e){
     if(e.ids)rememberPaymentIds(e.ids);toast(e.message||'這組點單未成立，請重試');
   }finally{stopWait();submitting=_submitting=false;btn.disabled=false;btn.textContent=method==='coin'?'用金幣支付':'送出訂單';}
 }
 submitOrder=function(){if(curKind==='play'&&members().length>1)return submitGroup('transfer');return previous.transfer();};
 payWithCoins=function(){if(curKind==='play'&&members().length>1)return submitGroup('coin');return previous.coin();};
 window.TTOrderFlow={pricing,duration,makeRecords,members};
})();
