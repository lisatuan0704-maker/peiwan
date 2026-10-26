/* v399 當季套組展示配色：只影響商城「當季套組」卡片上的展示人物髮色與卡片背景漸層。
   不影響試穿、穿搭保存、染髮券、商品或價格。數值由 season-color-adjust.html 匯出後貼回這裡。
   格式：{套組編號:{main:'#主色',tail:'#髮尾色'|null,highlight:'#挑染色'|null,bg:['#色1','#色2','#色3']|null}}
   bg 為 null 時，背景自動跟隨髮色。 */
window.TTSeasonDisplay=Object.assign({
},window.TTSeasonDisplay||{});
