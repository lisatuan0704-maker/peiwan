import {replyUpdates} from './support-core.mjs?v=427';
const auth=firebase.auth(),db=firebase.database(),root=document.getElementById('tab10');
let ref=null,rows={},version=0,busy=new Set(),drafts=new Map(),expanded=new Set();
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function render(){const sorted=Object.entries(rows).flatMap(([uid,tickets])=>Object.entries(tickets||{}).map(([id,t])=>({uid,id,...t}))).sort((a,b)=>b.at-a.at);
  const count=sorted.filter(t=>!t.reply).length;document.getElementById('supportBadge').textContent=count?' '+count:'';root.replaceChildren();const card=el('section',null,'card');card.append(el('h2','線上客服 · '+count+' 筆待回覆'),el('p','客人的聯絡表單會顯示在這裡。寄出回覆後，客人會在網站信箱收到。','hint'));root.append(card);
  if(!sorted.length){card.append(el('p','目前沒有客服單。'));return;}
  for(const t of sorted){const key=t.uid+'/'+t.id,item=el('article',null,'support-admin-ticket');item.append(el('h3',(t.reply?'已回覆 · ':'待回覆 · ')+t.subject),el('small',t.category+'｜'+t.name+'｜'+new Date(t.at).toLocaleString('zh-TW')),el('p','客服單號：'+t.id+(t.orderId?'\n訂單編號：'+t.orderId:'')),el('p',t.text));
    if(t.reply){item.append(el('p','店長回覆：\n'+t.reply.text,'support-reply'));}
    else{const label=el('label','回覆內容'),tx=document.createElement('textarea');tx.maxLength=1500;tx.placeholder='這段回覆會寄到客人的站內信箱';tx.value=drafts.get(key)||'';tx.oninput=()=>drafts.set(key,tx.value);label.append(tx);const button=el('button',busy.has(key)?'寄送中…':'回覆並寄到站內信箱','btn');button.type='button';button.disabled=busy.has(key);const message=el('p',null,'hint');message.setAttribute('role','status');button.onclick=async()=>{if(busy.has(key))return;const v=version;try{const updates=replyUpdates({uid:t.uid,id:t.id,ticket:t,text:tx.value,at:firebase.database.ServerValue.TIMESTAMP});busy.add(key);button.disabled=true;button.textContent='寄送中…';await db.ref().update(updates);if(version===v){drafts.delete(key);message.textContent='回覆已寄出。';}}catch(e){if(version===v){message.textContent=e.message?.includes('回覆請')?e.message:'寄送未完成，請稍後重試；若已回覆，重新整理後即可查看。';}}finally{busy.delete(key);if(version===v){button.disabled=false;button.textContent='回覆並寄到站內信箱';}}};item.append(label,button,message);}
    card.append(item);
  }
}
auth.onAuthStateChanged(async user=>{const v=++version;ref?.off();ref=null;rows={};drafts.clear();busy.clear();render();if(!user)return;try{const admin=await db.ref('peiwan/config/adminUid').once('value');if(v!==version||user.uid!==admin.val())return;ref=db.ref('supportV1/tickets');ref.on('value',s=>{if(v===version){rows=s.val()||{};render();}},()=>{if(v===version)root.textContent='客服資料暫時無法載入，請稍後重新整理。';});}catch{if(v===version)root.textContent='無法確認店長權限。';}});
