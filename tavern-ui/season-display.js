/* v399 當季套組展示配色：只影響商城「當季套組」卡片上的展示人物髮色與卡片背景漸層。
   不影響試穿、穿搭保存、染髮券、商品或價格。數值由 season-color-adjust.html 匯出後貼回這裡。
   格式：{套組編號:{main:'#主色',tail:'#髮尾色'|null,highlight:'#挑染色'|null,bg:['#色1','#色2','#色3']|null}}
   bg 為 null 時，背景自動跟隨髮色。 */
window.TTSeasonDisplay=Object.assign({
 /* v402 使用者以 season-color-adjust.html 調整後匯出 */
 "season291_bear":{"main": "#5d72b1", "tail": "#aecfdb", "highlight": "#63c3ca", "bg": ["#95a5d6", "#16ade3", "#096167"]},
 "season291_wolf":{"main": "#d05f39", "tail": "#824040", "highlight": "#ff0a0a", "bg": ["#eaa690", "#f20d0d", "#610000"]}
},window.TTSeasonDisplay||{});
