/* v399 當季套組展示配色：只影響商城「當季套組」卡片上的展示人物髮色與卡片背景漸層。
   不影響試穿、穿搭保存、染髮券、商品或價格。數值由 season-color-adjust.html 匯出後貼回這裡。
   格式：{套組編號:{main:'#主色',tail:'#髮尾色'|null,highlight:'#挑染色'|null,bg:['#色1','#色2','#色3']|null}}
   bg 為 null 時，背景自動跟隨髮色。 */
window.TTSeasonDisplay=Object.assign({
 /* v403 使用者以 season-color-adjust.html 調整後匯出（四套） */
 /* v444 疾風喵行預設展示色（待使用者調整） */
 "season293_wind":{"main": "#3B4A86", "tail": "#8FC3F0", "highlight": null, "bg": null},
 /* v442 使用者匯出的喵頻連線展示色 */
 "season292_meow":{"main": "#b7e6de", "tail": "#a9d4ea", "highlight": null, "bg": null},
 "season291_bear":{"main": "#5D72B1", "tail": "#AECFDB", "highlight": "#63C3CA", "bg": ["#95A5D6", "#16ADE3", "#096167"]},
 "season291_wolf":{"main": "#120d1c", "tail": "#812c5a", "highlight": "#d2a1f2", "bg": ["#bbabd8", "#b325da", "#9f3c5f"]},
 "season283_devil":{"main": "#d2566f", "tail": "#52192a", "highlight": null, "bg": ["#a08895", "#e81756", "#510b0b"]},
 "season283_valentine":{"main": "#f7efd4", "tail": "#f0cce5", "highlight": null, "bg": ["#fef69f", "#fecd62", "#e70da2"]}
},window.TTSeasonDisplay||{});
