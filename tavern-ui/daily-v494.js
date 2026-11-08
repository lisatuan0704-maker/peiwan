/* v494 日常系列（犬尤繪製：髮型四組、眼睛四組、上衣 A–D、下衣 A–C、套裝 A–B，128×128 對齊身體）。
   使用者 11/06：這批用貓貓幣買（店長送的日常福利款，付費時裝照舊收金幣）；價格由 Claude 訂：
   髮型（前髮＋後髮）300、眼睛（眼睛＋眉毛）200、上衣 150、下衣 150、套裝 300 貓貓幣。
   每一件是一組「草稿」（同當季時裝的格式），店長上架（shopConfig 有同編號、custom、price、cur:'cat'）前客人看不到。
   shopConfig 的 price 是金幣等值價（30／20／15／15／30），結帳與顯示 ×10；規則照 v493 第十批（cur:'cat' 才能付貓貓幣）。
   名稱 v509 依實際圖重取（原本沿用 11/05 樣稿暫定名）。下衣是「下身」配件（身體與上衣之間），可以跟任何上衣搭。 */
(()=>{const D='img/daily-v494/';
// v509 D：名字照實際的圖重取（原本是 11/05 樣稿暫定名）。商城、背包、結帳都讀這裡（shopConfig 的 name 不會蓋過草稿名）
const NAMES={hair:{A:'俏皮外翹髮',B:'甜心側馬尾',C:'刺蝟短髮',D:'隨性短髮'},eye:{A:'紫晶大眼',B:'森林綠眼',C:'淡定眼',D:'瞇瞇笑眼'},
 top:{A:'愛心白T',B:'藍白水手衫',C:'金星深藍T',D:'海軍條紋T'},bottom:{A:'黑色直筒褲',B:'深色百褶裙',C:'丹寧吊帶褲'},suit:{A:'森林帽T洋裝',B:'草莓蛋糕裙'}};
const base={price:null,previewOnly:true,hideUntilLive:true,noParts:true,highlightHair:false,daily:true};
const out={};
for(const k of 'ABCD'){const n=NAMES.hair[k];out['daily_hair_'+k]={...base,name:n,dailyKind:'hair',doll:{hair:2},parts:{
  front:{n:n+'・前髮',d:D+'hair_front_'+k+'.png',x:0,y:0,g:1},back:{n:n+'・後髮',d:D+'hair_back_'+k+'.png',x:0,y:0,g:1}},sourceLayerCount:2};}
for(const k of 'ABCD'){const n=NAMES.eye[k];out['daily_eye_'+k]={...base,name:n,dailyKind:'face',parts:{
  eye:{n:n,d:D+'eye_'+k+'.png',x:0,y:0,g:0},brow:{n:n+'・眉毛',d:D+'brow_'+k+'.png',x:0,y:0,g:0}},sourceLayerCount:2};}
for(const k of 'ABCD'){const n=NAMES.top[k];out['daily_top_'+k]={...base,name:n,dailyKind:'top',parts:{
  cloth:{n:n,d:D+'top_'+k+'.png',x:0,y:0,g:0}},sourceLayerCount:1};}
for(const k of 'ABC'){const n=NAMES.bottom[k];out['daily_bottom_'+k]={...base,name:n,dailyKind:'bottom',parts:{
  acc1:{n:n,d:D+'bottom_'+k+'.png',x:0,y:0,g:0,group:'bottom',z:'under',independent:true,defaultEquipped:true}},sourceLayerCount:1};}
for(const k of 'AB'){const n=NAMES.suit[k];out['daily_suit_'+k]={...base,name:n,dailyKind:'suit',parts:{
  cloth:{n:n,d:D+'suit_'+k+'.png',x:0,y:0,g:0}},sourceLayerCount:1};}
window.TTSeasonDrafts=Object.assign(window.TTSeasonDrafts||{},out);
// 價格（金幣等值價；×10＝貓貓幣）。店長頁上架按鈕與本機預覽都用這一份
window.TTDailyPrices={hair:30,face:20,top:15,bottom:15,suit:30};
})();
