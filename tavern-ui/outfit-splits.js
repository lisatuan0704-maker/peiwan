/* v441 已上架套組的衣服拆件（依繪師原檔；原本多張合成一件衣服）。大廳商城與店長頁拆件共用。
   splitFrom：從哪個購買單位拆出——買過舊「衣服」單位或整套的人自動擁有。 */
(()=>{const val='img/outfit-studio-v280/時裝-心動情人/',piece=(n,file,group,z,drawOrder)=>({n,d:val+file,x:0,y:0,g:0,group,z,independent:true,defaultEquipped:true,splitFrom:'cloth',drawOrder});
window.TTOutfitSplits=Object.assign(window.TTOutfitSplits||{},{
 season283_valentine:{cloth:{n:'心動花襯衫',d:val+'3.心動花襯衫.png',x:0,y:0,g:0},acc5:piece('心動下褲','3.心動下褲.png','bottom','under'),acc6:piece('心動披風','4.心動披風.png','outer','over',1),acc7:piece('心動披肩','5.心動披肩.png','outer','over',2)}
});})();
