# v242：對話框校正頁

入口：tavern-ui/bubble-adjust.html?v=242。新增獨立頁面，不改大廳目前設定。

使用 v241 五款原始 TTBUB PNG 與 showBubble 合成器快照；移除六秒消失計時。使用 v240 闆卡引擎與既有像素部件繪製示範人物。無 Firebase、帳號、線上聊天、付款或資料寫入端點。

可調：字體大小、行距、框的 X/Y、框的寬高比例；框內文字 X/Y、文字區寬高與最大行數。滑鼠拖曳移動、角落拉伸、方向鍵微調。短長句預覽、文字溢出提醒、每框獨立設定、本機暫存、JSON 複製／下載／匯入。

匯出規格 tiny-tavern-bubble-calibration v1，sourceVersion 241。邏輯角色畫布 128px；框 bottom-center 相對角色 canvas top-center，正 X 往右，正 Y 往下。框尺寸先依來源合成器用原文字計算自適應尺寸，再乘 widthPercent / heightPercent。框內文字區同步乘寬高比例，再依 textWidthPercent / textHeightPercent 以文字區中心增減範圍，最後套用 textOffsetX / textOffsetY。字體獨立設定，不跟框拉伸。預覽鏡頭縮放不影響校正數值。實際套用到其他尺寸角色時，需以 128px 作參考換算，且不可重複套用舊的 translateX(-67.8%)。

檢查：五款素材載入；數值對應輸出；拖曳座標、拉角落寬高改變但文字大小不變；鍵盤移動；長句溢出；重新整理保留；複製與載入回環；390px 手機無水平溢出；頁面無錯誤；JavaScript 語法與 git 差異檢查。
