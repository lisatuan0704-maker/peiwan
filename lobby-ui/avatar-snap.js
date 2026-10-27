/* v437 店長頁看到的客人小人＝大廳實際外觀：穿搭改變時，用大廳同一套繪製（含當季套組、染髮、配件）
   輸出 64px 圖存到自己的 cards/<key>/snap（只有本人與店員能讀，不在公開大廳資料裡）。 */
(()=>{'use strict';
const SIG='tt_snap_v437:';
let busy=false;
async function tick(){
 if(busy||document.hidden)return;
 try{
  if(typeof myKey==='undefined'||!myKey||typeof me!=='function'||!me()?.b?.doll||!window.TTCharacterSnapshot||typeof db==='undefined'||!db)return;
  const user=firebase.auth?.().currentUser;if(!user)return;           // 規則只允許登入本人寫自己的闆卡資料
  const sig=JSON.stringify(me().b.doll),k=SIG+myKey;
  let last=null;try{last=localStorage.getItem(k);}catch{}
  if(last===sig)return;
  busy=true;
  const blob=await TTCharacterSnapshot.exportCurrent({scale:1});
  const img=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});
  if(typeof img!=='string'||img.length>60000)return;
  await db.ref(ROOT+'/cards/'+myKey+'/snap').set({img,at:firebase.database.ServerValue.TIMESTAMP});
  try{localStorage.setItem(k,sig);}catch{}
 }catch(e){}finally{busy=false;}
}
setTimeout(tick,6000);setInterval(tick,20000);
window.TTAvatarSnap={refresh:tick};
})();
