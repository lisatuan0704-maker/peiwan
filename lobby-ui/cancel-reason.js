/* v432 取消原因與預約確認視窗。
   取消：客人要選一個原因（或寫下其他原因）才送出取消申請；原因會存在 cancelReq/<訂單>.reason，
   店長頁、冒險者頁處理退款時一併寫進訂單 cancelReason。
   預約：送出前再確認一次時段，並提醒「取消需填原因、店長看得到取消紀錄」。 */
(()=>{'use strict';
const REASONS=['時間臨時無法配合','選錯方案或時段','想換一位冒險者','等太久沒有接單','其他'];
const css=`#ttAsk{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(40,26,48,.55);box-sizing:border-box;font-family:inherit}
#ttAsk[hidden]{display:none}
#ttAsk .ta-card{width:min(420px,100%);max-height:calc(100% - 8px);overflow:auto;border-radius:20px;background:#fffdfe;color:#5e4a68;box-shadow:0 18px 50px rgba(40,20,50,.3);padding:20px 18px 16px;box-sizing:border-box}
#ttAsk h2{margin:0 0 6px;font-size:19px;line-height:1.4;color:#5e4a68}
#ttAsk p{margin:0 0 12px;font-size:14px;line-height:1.7;color:#7d6a86}
#ttAsk .ta-box{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#f6eef6;font-size:14px;line-height:1.7;color:#5e4a68}
#ttAsk .ta-box b{color:#8d5f7c}
#ttAsk .ta-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
#ttAsk .ta-chips button{min-height:40px;padding:6px 12px;border:1.5px solid #e3d8e6;border-radius:999px;background:#fff;color:#5e4a68;font:inherit;font-size:14px;cursor:pointer}
#ttAsk .ta-chips button[aria-pressed=true]{border-color:#846c90;background:#846c90;color:#fff}
#ttAsk textarea{display:block;width:100%;box-sizing:border-box;min-height:84px;padding:10px 12px;border:1.5px solid #e3d8e6;border-radius:12px;font:inherit;font-size:16px;color:#5e4a68;resize:vertical}
#ttAsk textarea:focus{outline:none;border-color:#846c90}
#ttAsk .ta-count{text-align:right;font-size:12px;color:#a593ad;margin:4px 0 0}
#ttAsk .ta-warn{margin:10px 0 0;font-size:12.5px;line-height:1.6;color:#b0607f}
#ttAsk .ta-err{min-height:18px;margin:6px 0 0;font-size:13px;color:#c0476d}
#ttAsk .ta-btns{display:flex;gap:10px;margin-top:12px}
#ttAsk .ta-btns button{flex:1;min-height:48px;border-radius:14px;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
#ttAsk .ta-no{border:1px solid #e3d8e6;background:#fff;color:#5e4a68}
#ttAsk .ta-yes{border:0;background:#846c90;color:#fff}
#ttAsk .ta-yes.danger{background:#c0607f}`;
let host=null,resolveNow=null;
function ensure(){
 if(host)return host;
 const st=document.createElement('style');st.textContent=css;document.head.append(st);
 host=document.createElement('div');host.id='ttAsk';host.hidden=true;host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');
 host.addEventListener('click',e=>{if(e.target===host)finish(null);});
 host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(null);}});
 document.body.append(host);return host;
}
function finish(v){if(!host||host.hidden)return;host.hidden=true;host.innerHTML='';const r=resolveNow;resolveNow=null;r?.(v);}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function open(html,setup){
 ensure();if(resolveNow)finish(null);
 return new Promise(res=>{resolveNow=res;host.innerHTML='<div class="ta-card">'+html+'</div>';host.hidden=false;setup(host.firstElementChild);});
}
// 取消原因：回傳原因文字（最多 120 字），按「先不要」回傳 null。
function ask({title,amount}){
 return open('<h2 id="taTitle">取消這筆訂單？</h2><p>「'+esc(title)+'」'+(amount?'，'+Number(amount).toLocaleString('zh-TW')+' 金幣會退回你的錢包。':'')+'</p>'
  +'<p style="margin-bottom:8px"><b>請告訴我們取消的原因</b>（必填，店長與冒險者會看到）</p>'
  +'<div class="ta-chips" role="group" aria-label="取消原因">'+REASONS.map(r=>'<button type="button" aria-pressed="false">'+r+'</button>').join('')+'</div>'
  +'<textarea id="taText" maxlength="100" placeholder="想補充的話（選「其他」時必填）"></textarea><div class="ta-count"><span id="taN">0</span> / 100</div>'
  +'<div class="ta-err" id="taErr" role="alert"></div>'
  +'<div class="ta-btns"><button type="button" class="ta-no">先不要</button><button type="button" class="ta-yes danger">確定取消</button></div>',card=>{
  host.setAttribute('aria-labelledby','taTitle');
  let pick='';const text=card.querySelector('#taText'),err=card.querySelector('#taErr');
  card.querySelectorAll('.ta-chips button').forEach(b=>b.onclick=()=>{pick=b.textContent;card.querySelectorAll('.ta-chips button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));err.textContent='';if(pick==='其他')text.focus();});
  text.oninput=()=>{card.querySelector('#taN').textContent=text.value.length;err.textContent='';};
  card.querySelector('.ta-no').onclick=()=>finish(null);
  card.querySelector('.ta-yes').onclick=()=>{
   const note=text.value.replace(/\s+/g,' ').trim().slice(0,100);
   if(!pick&&!note){err.textContent='請選一個原因，或寫下取消的原因';return;}
   if(pick==='其他'&&note.length<2){err.textContent='選「其他」時請寫下原因';text.focus();return;}
   finish(((pick&&pick!=='其他')?pick:'其他')+(note?'：'+note:''));
  };
  card.querySelector('.ta-chips button')?.focus();
 });
}
// 預約確認：回傳 true／false。
function confirmBooking({when,staff,plan,amount}){
 return open('<h2 id="taTitle">請確定是否預約此時段</h2>'
  +'<div class="ta-box">時段：<b>'+esc(when)+'</b><br>冒險者：<b>'+esc(staff)+'</b><br>方案：<b>'+esc(plan)+'</b>'+(amount?'<br>金額：<b>NT$ '+Number(amount).toLocaleString('zh-TW')+'</b>':'')+'</div>'
  +'<p>送出後冒險者會為你保留這個時段。</p>'
  +'<p class="ta-warn">※ 預約後如需取消，必須填寫取消原因，店長看得到每一筆取消紀錄。請確認時間可以再預約。</p>'
  +'<div class="ta-btns"><button type="button" class="ta-no">再想想</button><button type="button" class="ta-yes">確定預約</button></div>',card=>{
  host.setAttribute('aria-labelledby','taTitle');
  card.querySelector('.ta-no').onclick=()=>finish(false);card.querySelector('.ta-yes').onclick=()=>finish(true);card.querySelector('.ta-yes').focus();
 }).then(v=>v===true);
}
window.TTCancelReason={ask,confirmBooking,REASONS};
})();
