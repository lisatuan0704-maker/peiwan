# v252：可愛字體（中文粉圓、英文 Coiny、英文大標題 Rammetto One）

- 中文與全形標點改用粉圓 Huninn（自架切片 tavern-ui/assets/fonts/huninn/，只載入畫面用到的字）。
- 英文字母改用 Coiny；英文大標題（名簿字標、Tavern Display、闆卡 Tiny Tavern 字樣）改用 Rammetto One。
- 數字全部不換：Tavern Numerals（Lilita One 數字）與原本的數字字體維持原樣；新字體的 unicode-range 只涵蓋字母與 ! ? & '。
- 新字型家族定義在 tavern-ui/assets/fonts/lineseed.css 末端：'TT Huninn'、'TT Latin'、'TT Title'，並加在各處字體堆疊最前面；LINE Seed TW 保留當後備。
- 粉圓只有一種粗細，粗體由瀏覽器加粗：遊戲字體.css 與 numerals.css 的 font-synthesis 由 none 改為 weight。
- 闆卡畫布輸出前先載入新字體。字體授權皆為 OFL，授權檔放在同資料夾。
