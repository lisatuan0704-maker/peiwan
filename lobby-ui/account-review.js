/* v428 店長頁：帳號綁定審核。
   客人用 Discord 登入時，伺服器無法自動確認闆卡歸屬（例如闆卡上填的 Discord 名稱對不上）會請客人聯絡店長。
   店長核對後在這裡把「Discord 數字 ID」綁到「闆卡鑰匙」。只有店長帳號能寫入（資料庫規則限制）。 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const box=document.createElement('section');box.className='card';box.id='accountReview';
box.innerHTML='<h2>帳號綁定審核</h2>'
 +'<p>客人登入時看到「需要店長確認」，請向客人確認 Discord 名稱與闆卡名字，再在這裡綁定。<br>Discord 數字 ID：在 Discord 開啟開發者模式後，對客人按右鍵 →「複製使用者 ID」。</p>'
 +'<label>Discord 數字 ID <input id="arDc" inputmode="numeric" placeholder="例：262784759216734208" style="width:220px"></label> '
 +'<label>闆卡鑰匙 <input id="arKey" placeholder="客人的 tt_me，或在客人分頁查詢" style="width:240px"></label> '
 +'<button class="btn sm" id="arCheck">查詢</button> <button class="btn sm ok" id="arBind" disabled>確認綁定</button>'
 +'<pre id="arOut" style="white-space:pre-wrap;font-size:12px;margin-top:8px"></pre>';
{const t7=$('tab7');if(t7)t7.after(box);else($('pgMain')||document.body).append(box);}box.style.display=($('tab7')&&$('tab7').style.display!=='none')?'':'none';
let checked=null;
function input(){const dc=$('arDc').value.trim(),key=$('arKey').value.trim();
 if(!/^\d{16,22}$/.test(dc))throw Error('Discord 數字 ID 格式不對（16～22 位數字）');
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(key))throw Error('闆卡鑰匙格式不對');return {dc,key,uid:'discord_'+dc};}
$('arDc').oninput=$('arKey').oninput=()=>{checked=null;$('arBind').disabled=true;};
$('arCheck').onclick=async()=>{
 $('arBind').disabled=true;checked=null;
 try{
  const {dc,key,uid}=input();const get=p=>db.ref(p).once('value').then(s=>s.val());
  const [lobby,owner,member,account]=await Promise.all([get(ROOT+'/lobby/'+key),get('secureV1/owners/'+key),get('secureV1/members/'+uid),get(ROOT+'/accounts/'+dc)]);
  const lines=['闆卡名字：'+(lobby?.name||'（找不到這張闆卡）'),
   '這張闆卡目前綁定：'+(owner||'（尚未綁定）'),
   '這個 Discord 目前綁定的闆卡：'+(member?.key||'（尚未綁定）')+(member&&member.active!==true?'（已停用）':''),
   '帳號紀錄：'+(account?.myKey?('myKey='+account.myKey):'（沒有）')+(account?.username?(' @'+account.username):'')];
  let ok=!!lobby?.name;
  if(owner&&owner!==uid){lines.push('⚠ 這張闆卡已綁定其他 Discord，請先確認是否為同一人。');ok=false;}
  if(member?.key&&member.key!==key){lines.push('⚠ 這個 Discord 已綁定另一張闆卡。');ok=false;}
  if(owner===uid&&member?.key===key){lines.push('✔ 已經綁定完成，不需要再操作。');ok=false;}
  $('arOut').textContent=lines.join('\n');
  if(ok){checked={dc,key,uid};$('arBind').disabled=false;}
 }catch(e){$('arOut').textContent=e.message||'查詢失敗';}
};
$('arBind').onclick=async()=>{
 if(!checked)return;const {dc,key,uid}=checked;
 if(!confirm('確定把闆卡 '+key+' 綁定到 Discord '+dc+'？\n綁定後只有這個 Discord 帳號能使用這張闆卡的金幣、背包與私訊。'))return;
 $('arBind').disabled=true;
 try{
  const tx=await db.ref('secureV1/owners/'+key).transaction(cur=>cur===null||cur===uid?uid:undefined,undefined,false);
  if(!tx.committed)throw Error('這張闆卡剛剛被其他帳號綁定，請重新查詢');
  await db.ref('secureV1/members/'+uid).set({active:true,key,claimedAt:Date.now(),reviewedBy:'manager'});
  await db.ref(ROOT+'/accounts/'+dc).update({myKey:key});
  $('arOut').textContent+='\n✔ 已綁定。請客人回大廳重新用 Discord 登入。';checked=null;
 }catch(e){$('arOut').textContent+='\n✖ '+(e.message||'綁定失敗');}
};
})();
