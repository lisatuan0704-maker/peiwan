/* v494 日常系列（犬尤繪製：髮型四組、眼睛四組、上衣 A–D、下衣 A–C、套裝 A–B，128×128 對齊身體）。
   使用者 11/06：這批用貓貓幣買（店長送的日常福利款，付費時裝照舊收金幣）；價格由 Claude 訂：
   髮型（前髮＋後髮）300、眼睛（眼睛＋眉毛）200、上衣 150、下衣 150、套裝 300 貓貓幣。
   每一件是一組「草稿」（同當季時裝的格式），店長上架（shopConfig 有同編號、custom、price、cur:'cat'）前客人看不到。
   shopConfig 的 price 是金幣等值價（30／20／15／15／30），結帳與顯示 ×10；規則照 v493 第十批（cur:'cat' 才能付貓貓幣）。
   名稱沿用 11/05 日常衣櫃樣稿（暫定）。下衣是「下身」配件（身體與上衣之間），可以跟任何上衣搭。 */
(()=>{const D='img/daily-v494/';
const NAMES={hair:{A:'蓬鬆長髮',B:'側馬尾',C:'刺刺短髮',D:'柔順短髮'},eye:{A:'星光大眼',B:'溫柔眼',C:'酷酷眼',D:'笑瞇眼'},
 top:{A:'愛心短T',B:'水手領上衣',C:'星星上衣',D:'條紋上衣'},bottom:{A:'直筒長褲',B:'百褶短裙',C:'吊帶褲'},suit:{A:'帽T小洋裝',B:'粉紅蛋糕裙'}};
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
