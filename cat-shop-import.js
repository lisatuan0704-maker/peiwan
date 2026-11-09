/* v494 貓貓幣商品上架（店長頁「商城」分頁）：日常系列 17 件＋小屋第一批家具 78 件（入住禮 4 件不用上架）。
   只新增 shopConfig 還沒有的商品、已有的不覆寫；上架前先下載一份商城備份。
   日常系列：shopConfig/<daily_*>{name,price,cur:'cat',custom:true,active:true,type:'時裝'}（會出現在下方「時裝」清單，可個別調價、上下架）。
   小屋家具：shopConfig/house:<家具>{name,price,cur:'cat',type:'小屋家具',active:true}（不列在清單裡，價格表在 house/catalog.json）。
   price 一律是金幣等值價，客人看到、扣款都是 ×10 貓貓幣（v493 規則：只有 cur:'cat' 的商品能用貓貓幣買）。
   v507：小屋擴建 house:size18（3,000 貓貓幣）、house:size22（6,000 貓貓幣），type '小屋擴建'；扭蛋家具（catalog gacha:true、price 0）不上架
   （上架成 0 元的話，客人可以自己寫一張 0 元訂單把扭蛋家具拿走）。
   v510：小屋壁紙／地板 house:wall_<系列>／house:floor_<系列>（type 小屋壁紙／小屋地板，各 500 貓貓幣）。 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const box=document.createElement('section');box.className='card';
box.innerHTML='<h2>貓貓幣商品上架</h2><p>日常系列 17 件（髮型 300／眼睛 200／上衣 150／下衣 150／套裝 300 貓貓幣）、小屋第一批家具 78 件（小件 100～200、中件 150～300、大件 300～500 貓貓幣；入住禮 4 件免費，不用上架），小屋擴建兩級（18×18 3,000、22×22 6,000 貓貓幣），以及小屋商城的壁紙／地板（森林精靈小屋、海底人魚屋，各 500 貓貓幣）。只新增還沒有的商品，已有的不覆寫；上架前會先下載一份商城備份。</p>'
 +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button id="catShopPublish">上架貓貓幣商品</button><span id="catShopStatus" style="font-size:13px"></span></div>';
document.getElementById('pgMain').append(box);
async function wanted(){
 const r=await fetch('house/catalog.json?v=494',{cache:'no-store'});if(!r.ok)throw Error('家具清單載入失敗');const cat=await r.json(),out={};
 for(const c of cat){if(c.starter||c.gacha)continue;if(!Number.isSafeInteger(c.price)||c.price%10)throw Error('家具價格有誤：'+c.name);out['house:'+c.k]={name:c.name,price:c.price/10,cur:'cat',type:'小屋家具',active:true};}
 out['house:size18']={name:'小屋擴建・18×18',price:300,cur:'cat',type:'小屋擴建',active:true};   // v507
 out['house:size22']={name:'小屋擴建・22×22',price:600,cur:'cat',type:'小屋擴建',active:true};
 for(const [t,n] of [['forest','森林精靈小屋'],['mermaid','海底人魚屋']]){   // v510 小屋商城：每個系列的壁紙、地板各 500 貓貓幣（買一次就能貼任何一格）
  out['house:wall_'+t]={name:n+'・壁紙',price:50,cur:'cat',type:'小屋壁紙',active:true};out['house:floor_'+t]={name:n+'・地板',price:50,cur:'cat',type:'小屋地板',active:true};}
 const P=window.TTDailyPrices||{};
 for(const [id,d] of Object.entries(window.TTSeasonDrafts||{})){if(!d.daily)continue;const p=P[d.dailyKind];if(!Number.isSafeInteger(p)||p<=0)throw Error('日常系列價格有誤：'+d.name);out[id]={name:d.name,price:p,cur:'cat',custom:true,active:true,type:'時裝'};}
 return out;}
async function refresh(){try{const w=await wanted(),now=(await db.ref(ROOT+'/shopConfig').once('value')).val()||{},have=Object.keys(w).filter(id=>now[id]).length,total=Object.keys(w).length;
  $('catShopStatus').textContent=have===total?'已全部上架（'+total+' 件）':'已上架 '+have+'／'+total+' 件';$('catShopPublish').disabled=have===total;}catch(e){$('catShopStatus').textContent=e.message;}}
$('catShopPublish').onclick=async()=>{const btn=$('catShopPublish');btn.disabled=true;
 try{const owner=(await db.ref(ROOT+'/config/adminUid').once('value')).val();if(!firebase.auth().currentUser||firebase.auth().currentUser.uid!==owner)throw Error('請先登入店長帳號');
  const w=await wanted(),ref=db.ref(ROOT+'/shopConfig'),before=(await ref.once('value')).val()||{};
  const add=Object.keys(w).filter(id=>!before[id]);if(!add.length){$('catShopStatus').textContent='都已經上架了';return;}
  const blob=new Blob([JSON.stringify(before,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='商城上架前備份-v494.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  // 只寫還沒有的那幾筆（shopConfig 只有店長能寫；不用整個節點的 transaction，避免快取還沒載到時整批放棄）
  const ch={},ts=Date.now();for(const id of add)ch[id]={...w[id],updatedAt:ts};await ref.update(ch);
  const after=(await ref.once('value')).val()||{};
  for(const id of Object.keys(before))if(JSON.stringify(after[id])!==JSON.stringify(before[id]))throw Error('原本的商品被動到了：'+id);
  for(const id of add){const p=after[id];if(!p||p.cur!=='cat'||p.price!==w[id].price)throw Error('上架後驗證未通過：'+id);}
  $('catShopStatus').textContent='上架成功：新增 '+add.length+' 件，原本的商品完整保留。';
 }catch(e){$('catShopStatus').textContent='未完成：'+e.message;btn.disabled=false;return;}
 setTimeout(refresh,2500);};
// 只在「商城」分頁顯示（同 v413）
const sync=()=>{box.style.display=document.getElementById('tb8')?.classList.contains('on')?'':'none';};
const orig=window.showTab;if(typeof orig==='function'){window.showTab=function(){const r=orig.apply(this,arguments);sync();return r;};}
sync();try{firebase.auth().onAuthStateChanged(()=>refresh());}catch(e){refresh();}
})();
