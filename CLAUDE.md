# 小小酒館修改紀錄

## 2026/11/11 面試體驗版手札＋面試控制台＋TT 私訊面試者（Claude；TT 私訊需發布第二十三批規則＋主機 deploy-interviewdm-1111）
- D：面試冒險者時要讓對方實際操作手札、店長能即時發單、Discord 要跳通知。第一位（花熙）面試時只做了小房間 Webhook @，TT 沒有私訊——D：「他的 dc 私訊 tt 怎麼沒有發通知!! 下一個不要再錯了」「不要補發」。
- 頁面（不碰正式訂單／金流／資料庫）：partner-trial.html（體驗版手札，CSS 照抄 partner.html：暱稱登入、打卡、行事曆、冒險者卡、新單／進行中／本月，本月顯示店抽 20%／冒險者 80%、手續費稅金各半）、
  interview-control.html（店長控制台：開房間給連結、發即時／預約單、續單、取消／退款、看對方每一步、冒險者卡狀態、送單前提醒「下班中／暫停預約／這段不接單」）。
  兩頁靠 ntfy.sh 公開頻道 tt-iv-<房間代碼> 同步（事件記錄，since=all 重播；自己送出未回聲的排最後；送不出去重送兩次再退回畫面）。房間一位面試者一間，控制台打開就開新房；「清空」連打卡與 Discord 綁定一起清。時間一律用台灣時間（這台電腦是東京時區）。
- Discord 體驗綁定：體驗手札 → Discord 授權（identify）→ dc.html 新分支（只在 OAuth state 跟體驗手札記下的相同才走；取消授權時 30 分鐘內且沒有其他正式流程才帶回）→ 只把 Discord ID 交回體驗手札，不寫 tt_dc、不碰正式綁定。
- TT 私訊：控制台（要在同一個瀏覽器登入過掌櫃頁）每次發單／續單／測試寫 peiwan/interviewDm/<id>{to,kind,room,who,plan,amount,mins,name,book,reserveAt,game,at:伺服器時間}；
  主機 order-voice-bot/interview-dm.cjs 收到就由 TT 私訊面試者（同正式委託新單私訊的樣子、標「面試體驗」、附體驗手札連結），結果寫回 <id>/result（sent／blocked／failed／expired／limited），控制台顯示；
  只處理 5 分鐘內的新請求（不補發）、每筆一次（orderVoiceV1/interviewDm/<id> transaction）、一小時最多 60 則。TT 私訊不成功時，有填備用小房間 Webhook 才改在小房間 @ 她。
- 規則第二十三批（tests/security-rules-v428/build/harden-phase23.cjs、test-phase23 14 項，GitHub Actions sec-ci/interview1111 全過；快照 rules-before-interview1111.json）：interviewDm 只有店長讀寫、to 是 Discord ID、room 格式、at 必須是伺服器現在。
  同一次 CI：第 6、7、9 批各有 2～3 項失敗，是開幕禮／11/07 前每日任務的日期測試，改動前一樣失敗。
- 主機：ops/deploy-interviewdm-1111.sh（security-v428）只新增 interview-dm.cjs＋測試，service-server.cjs 在 staffDm 那行後接一行；本機假主機（以 20261111-voicepool 為底）跑過：檔案核對、只多 3 行、語法、測試 18 項；已部署過會停止。

## 2026/11/11 隨機單（不指定）的「確認語音」按了沒反應（Claude；網站 partner v423 已上線＋主機 ops/deploy-voicepool-1111.sh）
- D：「陪玩說她按了確認語音沒反應..這個問題怎麼又來了 可以好好排修嗎」「他是隨機單的確認語音」。
- 根本原因（主機 booking-voice.cjs）：registerOrder 要求每張單都有 staffCid → 不指定的單點單時被拒 ORDER_NOT_ELIGIBLE（客人端 order-voice.mjs 當永久錯誤丟掉、不提示）；
  冒險者 grabPoolOrder 接走後沒有人重新登記 → approveOrder 找不到 sourceIndex 一直回 CUSTOMER_BINDING_PENDING；手札 retryApprovals 遇到這個代碼默默每 5 秒重試、畫面完全沒反應。
- 主機修法：approveOrder 找不到登記時，先核對按的人＝接這張單的冒險者（staffAccounts／staffBindings authUid），用 secureV1/owners/<闆卡> 找老闆，替老闆跑 registerOrder；
  同一組（groupSize>1）用 walletTx/<闆卡>/<groupId>/orderIds，沒有就用 groupId 找；同組還有人沒接回 GROUP_NOT_READY（409）。測試 booking-voice-pool.test.cjs 7 項（舊版 4 項失敗）。
- 網站（lobby-ui/order-voice.mjs，partner 才用到的路徑）：按下先說「正在確認語音…」；等待類（CUSTOMER_BINDING_PENDING／GROUP_NOT_READY／ORDER_NOT_READY／TEMPORARILY_UNAVAILABLE／連不上）說一次原因＋每 5 秒自動再試；
  其他錯誤直接說；沒登入請先登入。partner.html import ?v=523、verTag v423、PT_VER 24；大廳 ?v=514 沒動。
- 部署：主機 root 終端機貼 curl -fsSL https://raw.githubusercontent.com/lisatuan0704-maker/peiwan/672a95db131c551e0af9e8d10d1ba5692ad06121/ops/deploy-voicepool-1111.sh -o /tmp/v.sh && bash /tmp/v.sh
  （插入點核對、docker 建置＋測試、重啟後 READY 與語音端點跟重啟前一樣，失敗自動還原；假主機演練 46 項通過）。
- 同一天：冒險者打卡後公開單沒出現「我接這張」（新單分頁打卡不重畫）→ partner v422 syncDutyUI 上下班一變就 render()。

## 2026/11/11 主機：Discord 通知分頻道（Claude；ops/deploy-notify-1111.sh，11/11 D 已在主機執行：20261111-notify 健康）
- D：「訂單通知／服務鈴／儲值通知要分開，甚至訂單要分時裝還是陪玩的」。原本 order-notify（訂單＋儲值）、counter-desk（服務鈴「想了解服務」、意見回饋）、recruit-desk（冒險者應徵）全用同一個 ORDER_NOTIFY_WEBHOOK_URL。
- 分流：委託（type play／table／沒有 type）→ 原本 ORDER_NOTIFY_WEBHOOK_URL；商城（shop、member…）→ SHOP_NOTIFY_WEBHOOK_URL；儲值（topup 待核帳＋線上儲值入帳）→ TOPUP_NOTIFY_WEBHOOK_URL；
  服務鈴＋應徵 → DESK_NOTIFY_WEBHOOK_URL。沒設定照舊發原本的；分出去的 Webhook 發不出去（被刪）改發原本的，不漏單。
- 標題：委託「小小酒館・委託通知／有新委託」（有填想玩會多一行）、商城「小小酒館・商城訂單／商城有新訂單」（沒方案名稱時用商品名稱，原本會只剩「（NT$99）」）；
  儲值字不變；服務鈴、應徵加發送名稱（原本 Discord 顯示預設的 Spidey Bot）。
- 部署：在主機 root 終端機貼
  curl -fsSL https://raw.githubusercontent.com/lisatuan0704-maker/peiwan/ef275cbf5b0348cecbbb0949418ea22921575b9d/ops/deploy-notify-1111.sh -o /tmp/d.sh && bash /tmp/d.sh
  會請 D 依序貼三個頻道的 Webhook 網址（read -rs 不顯示；Enter＝不分開），寫進服務的 --env-file（備份 *.before-notify），核對 order-notify.cjs 雜湊 40644ad8…、
  docker 建置＋30 項測試、重啟後檢查原本的 READY 都在、ORDER_NOTIFY_ROUTES 符合、語音端點跟重啟前一樣，失敗自動還原；成功後在每個新頻道發一則說明。
- 原始碼：order-notify.cjs 以 session d39d9fc6 的主機重建檔（dry514，v498b 版）為底。本機假主機演練（scratchpad/notify/fake）通過。
- 部署結果（11/11）：tests 30 pass；NOTIFY_SPLIT_DEPLOYED_AND_HEALTHY（shop=1 topup=1 desk=1）；三個新頻道（商城訂單／儲值通知／服務鈴）說明訊息都回 204。
  服務設定檔 /etc/tinytavern/service.env（舊的 service.env.before-notify）；主機版本 tinytavern-service:20261111-notify（舊版 unit 備份 *.before-notify）。
  主機是 DigitalOcean droplet tinytavern-service-sgp1（id 611427117），D 在自己的 Chrome 登入；auto mode 不讓 Claude 往正式主機主控台打指令，指令要給 D 自己貼。

## 2026/11/11 v522 小屋裡的朋友也照路線推算（Claude；需發布第二十二批規則，沒發布也照常運作）
- D：「好，小屋也做」（接 v521 大廳即時同步）。v521 小屋只調數字，朋友畫面仍固定晚 0.15 秒。
- 做法：走路的人座位多帶 r＝「剩下要轉的彎」（字串 "9,4;12,4;12,8"，只留轉彎格，最多 12 個、80 字；lobby-ui/house.js routeOf），停下時刪掉 r。
  看的人（house/room.html peerPlan／peerPredict／peerFollow）照路線從收到的位置往前推算「現在走到哪」：封包在路上的時間 age0＝伺服器時間－座位 at（0～0.25 秒，還不知道時間差時當 0.06 秒），
  往前推最多 0.6 秒；照走路速度跟上，有落差最多 2.2 倍速補回，差 5 格以上直接到；轉彎時跟著轉身（同 drawMe 的算法）。只有心跳（at）變了不重算。
  沒帶過路線的人照 v511 時間線；帶過路線的人停下（r 沒了）照原速走到最後位置。TTRoom.me() 多回傳 path（剩下的路，格子）。
  不送「目的地」讓對方自己找路：A* 從路上不同格出發可能挑另一條一樣長的路，兩邊會走不一樣。
- 相容：規則還沒發布時帶 r 的寫入整筆被拒 → 那次進房間改送不帶 r 的（S.noDest，只在 permission 錯誤且座位還是自己的才設），朋友那邊照時間線；刪 r（r:null）舊規則也允許。
  舊版網頁看新版的人：只讀 i/j/f，不受影響。
- 規則第二十二批（tests/security-rules-v428/build/harden-phase22.cjs，test-phase22 14 項；快照 rules-before-v522.json）：houseRoom/<主人>/<座位>/r 選填，字串 3～80 字、只能數字逗號分號。第 14、16 批重跑通過；
  run.sh 全跑：第 6、7、9 批各有 2～3 項失敗，用改動前的規則一樣失敗（開幕禮、11/07 前每日任務的日期測試），與這次無關。
- 實測（scratchpad/sync t3.cjs，本機模擬資料庫兩個分身、主人看朋友走 3 段有轉彎的路）：走路中平均差距 0.32 格 → 0.02 格（p95 0.53 → 0.06）、面向不同的畫格 2.7% → 1.3%、停下後兩邊位置一樣、沒有程式錯誤；
  模擬規則還沒發布、走路的人是舊版、看的人是舊版三種都照常同步。hsim.cjs（取檔案裡真正的函式，網路延遲 35～105ms 抖動）：舊 0.65 格 → 新 0.03 格。
- ⚠ tt-room-kit/house-lobby/house-embed.js 的朋友那段從 v511 起就沒同步（見 v520），重建 room.html 前要把 v511＋v520＋v522 的朋友程式搬回去。
- 版本：verTag v522、ver.json 522、lobby-view 522、house.js VER 522（room.html?v=522）、lobby 載入 house.js?v=522。
- 教訓：room.html 的 TTRoom 物件好幾個鍵寫在同一行，行尾加 // 註解會把後面的 setPeers／say／spawn 一起變成註解（語法檢查照樣過）→ 註解放上一行。

## 2026/11/11 v521 別人的小人即時同步（Claude）
- D：「網頁能不能同步率更高些？我看別人的網頁遊戲即時性都做很好」。
- 原因（大廳）：本人每 0.15 秒回報一次位置，觀看者（lobby-ui/presence.js v483）故意落後約一個送達間隔再追 → 本機零網路延遲實測，走路中別人看到的位置平均就差 42px（約 0.27 秒），轉彎會切角。
- 修法（大廳）：封包多帶 r（剩下的路線，最多 8 點，1600×900 像素整數）＋sp（走路速度 px/s）或 k（方向鍵實際速度 px/s），再加 ts（伺服器時間）；
  觀看者照路線往前推算「對方現在走到哪」（封包在路上的時間用 ts 算，0～0.25 秒；往前推最多 0.6 秒，方向鍵只推 0.12 秒），轉彎、停下位置跟本人一樣。
  換目的地／方向鍵換方向時馬上送（TTPresence.turned），不等 0.15 秒。沒帶路線的舊版封包照 v483 走法；舊版網頁收到新封包只是忽略多的欄位。
  pos 規則沒有欄位限制，不用發布規則。私人房（rooms/presence-codec）只取原本欄位，不受影響。lobby.html 的 serverTimeOffset 也餵給 TTPresence.setClockOffset。
- 小屋：houseRoom 座位規則 $other:false，不能多帶路線 → 只調數字：回報 0.2→0.1 秒（house.js pubPos）、朋友畫面延遲 0.25→0.15 秒（room.html PEER_DELAY）；停下時最後不到 0.05 格的位移也補送。
  要做到跟大廳一樣的預測，需要店長發布規則讓座位多收 ti/tj（目的地格子），再改 house.js／room.html。
- 實測（scratchpad/sync，本機模擬資料庫兩個分身）：大廳點地板走路平均差距 42.5px → 0.4px；方向鍵 26.7 → 7.4px；小屋 0.60 格 → 0.32 格；停下後兩邊位置一致、沒有程式錯誤；
  另用模擬網路延遲 35～105ms 抖動：舊 45px → 新 0.5px。v520 小屋朋友畫法測試照過。
- 版本：verTag v521、ver.json 521、lobby-view 521、presence.js?v=521、house.js?v=521（VER 521）。

## 2026/11/11 v520 小屋裡的朋友看起來糊、沒有待機擠壓（Claude）
- D：「我朋友進來看小屋，看起來很糊，還沒有待機擠壓動畫」。
- 原因：house/room.html 的朋友小人（PEERS）當成一般家具 blit——沒有腳底影子、沒有走路踏步擠壓與微傾、站著不呼吸，跟自己的小人（drawMe）畫法不同；
  朋友的 64px 小人圖（lobby-ui/house.js dollCanvasOf）拿到資料就畫一次、之後不再重畫，時裝部件圖還沒載好就會少圖層。
  本機 1.25 倍縮放實測，同一套衣服時兩邊的像素其實都是最近鄰、沒有被柔化；看起來「糊」主要是少了影子／動作、站著完全不動。
- 修法：room.html 新增 peerPose／drawPeer（照 drawMe：腳底影子、雙拍彈跳＋落地擠壓＋微傾、站著呼吸〔每人依 id 錯開節奏〕、光池跟著亮），drawItem 遇到朋友改走 drawPeer，litItem 略過朋友；
  名牌高度跟著彈跳。house.js 新增 redrawDoll：朋友（含拜訪時的主人）小人 1.2 秒、3.5 秒後各重畫一次。
  順手修：大廳 tick 裡別人在小屋（mapLoc 'house'）時 MAPS 沒有這張圖會丟錯（訪客分頁實測到 Cannot read properties of undefined (reading 'floor')），改成退回大廳地板。
- ⚠ room.html 這次直接改；tt-room-kit/house-lobby/house-embed.js 的朋友那段還停在 v504 版（v511 起就沒同步），重建 room.html 前要先把 v511＋v520 的朋友程式搬回去。
- 版本：verTag v520、ver.json 520、lobby-view 520、house.js VER 520（room.html?v=520）、lobby 載入 house.js?v=520。
- 驗證：scratchpad/peer/t8.cjs（本機模擬資料庫兩個分身、1.25 倍縮放、放大 3 段）：朋友改用跟自己一樣的畫法、縮放每幀在變（待機擠壓）、每幀兩個腳底影子、名牌正常、兩邊沒有程式錯誤。

## 2026/11/11 v519 私訊通知小卡：同一則只跳一次（Claude）
- D 回報：「明明已讀了還是重複看到通知」（#ttDmToast「無名 傳來私訊／傳了一張貼圖」）。
- 原因（本機兩個分身重現）：大廳同時開在兩個地方（兩個分頁／視窗、電腦＋手機）時，正在讀的那邊會把 dmMeta 未讀歸 0，
  但另一邊在未讀 0→1 的那一下就先跳小卡（v508 是一收到就跳）。只開一個分頁時流程都正常。
- 修法（lobby.html 私訊小卡 dmtCheck 那段，私訊寫入與規則沒動）：選到要通知的對話後等 1.2～1.6 秒（隨機，兩個分頁不會同時判斷），
  那時還是未讀、而且是「新的一則」才跳；分頁在背景時記著，切回來同樣要還沒讀、是新的才跳。
  「新的」＝本機 localStorage tt_dmt_seen_<闆卡> 記每段對話通知過／讀過到哪一則（lastAt）：跳過的、未讀從有變 0（讀掉了）都記下。
  只看「未讀是 0」不行——新訊息的內容（lastAt）常比未讀 +1 先到，會被誤記成讀過。
- 版本：verTag v519、ver.json 519、lobby-view 519（v517 這號沒用到）。
- 測試（本機 RTDB 模擬＋兩個分身，scratchpad/dmt t1 9 項、t2 4 項、t3 10 項全過）：收到才跳一次、打開讀完不再跳、對話開著不跳、
  兩個分頁一邊在讀另一邊不跳、同一則未讀 0→1→0→2 來回只跳一次、背景分頁回來跳一次、背景時在別處讀掉回來不跳、重整後舊的不跳新的會跳。

## 2026/11/11 v518 VIP 頭像框換了，闆卡和別人看到的還是花圈框（Claude）
- 客人回報：頭像框明明換成 VIP 1（藍調樂手），闆卡上看起來還是原本的花圈框。
- 原因：publishProfile（lobby.html 約 2483 行）用 `typeof curFrame` 讀目前戴的框，但 curFrame 是頭像框那段 IIFE（約 6687～7105 行）裡的 let，外面永遠讀不到
  → VIP 框從來沒寫進 lobby/<key>/pub/frm；左上角 HUD 與手帳用的是本機 curFrame 所以看起來有換，闆卡（drawFullCard 讀 pub.frm）、通訊錄、小屋名片、拜訪過場都是花圈框。
  夥伴角色框（companion_*）是主機 equipFrame 寫的，不受影響。
- 修法：publishProfile 改用 window.__curFrame()，花圈框或 __frameUsable()（VIP 等級／夥伴框解鎖確認了）才發佈；自己的闆卡直接用目前戴的框（不等發佈）。規則不用改（pub.frm 只擋 companion_ 要主機紀錄）。
- 版本：verTag v518、ver.json 518、lobby-view 518（v517 給私訊小卡修正的 session）。
- 驗證：本機模擬資料庫兩個分身（scratchpad/frm/t1.cjs 7 項）：VIP 1 客人選藍調樂手 → pub.frm＝vip1、HUD／自己的闆卡／別人開他的闆卡都是藍調樂手框；換回花圈框發佈 wr1；本機硬改 tt_frame=vip3（沒解鎖）不會發佈。
- 已上線的客人：重新整理（或換一次框）就會發佈出去。

## 2026/11/11 v516 儲值：銀行轉帳加送貓貓幣、線上付款（信用卡等）不加送（Claude）
- D：「想盡量鼓勵大家用轉帳的方式，轉帳送貓貓幣而不是送金幣；信用卡的話就沒優惠」。
- 儲值方案 config/topup/tiers 多一欄 catBonus（店長頁「儲值設定」的「轉帳送貓貓幣」，取代「送金幣」）；儲存時 bonus 一律存 0。
  付款主機（server/lib/topup.js）是照 bonus 算金幣的 → 線上付款＝原價金幣、不送，主機不用改。
- 入帳：店長頁按「確認收款」（銀行轉帳單，payChannel 不是 oen）→ 原本的 credited 旗標搶到才入帳：金幣照舊＋貓貓幣 cat/<闆卡>/balance += 方案 catBonus
  （照店長設定算，不信任客人送的數字），記 clientOrders/<單>/catCredited、catTx type 'topup'「銀行轉帳儲值加送」，入帳信寫「＋N 貓貓幣」。
  取消已入帳的儲值單：金幣扣回之外，catCredited 的貓貓幣也扣回（catTx adjust「儲值取消扣回加送」）。資料庫規則不用改（clientOrders 沒欄位白名單、cat 店長可寫）。
- 客人端：錢包方案卡（live.js／手機 mobile-app.js／舊版 renderTopup）「銀行轉帳送 N 貓貓幣」；付款頁（membership.js）方案有加送時「銀行轉帳」鈕掛綠色「加送 N 貓貓幣」徽章、
  而且預設先選銀行轉帳（沒加送的方案照舊預設線上付款）；線上付款說明加「（線上付款沒有加送貓貓幣）」。送出儲值單帶 catBonus（顯示用）。cat-coin.js 交易紀錄標籤 topup＝「儲值加送」。
- 版本：verTag v516、ver.json 516、lobby-view 516（v515 是主工作階段的商城 VIP3 修正）、live.js／mobile-app.js／cat-coin.js／membership.js／membership.css ?v=516。
- 驗證：本機預覽（模擬資料庫 namespace topup515）：方案卡、付款頁（有加送預設轉帳＋徽章、沒加送預設線上）、手機儲值頁、送出轉帳單 → 店長頁確認收款 金幣 +350／貓貓幣 +300／catTx／入帳信 →
  取消扣回金幣與貓貓幣；線上付款單不送；儲存方案 bonus 存 0、負數變 0。
- 上線後：店長到「儲值設定」填每個方案要送多少貓貓幣、按儲存（全部 0＝跟以前一樣）。
## 2026/11/11 v515 VIP 3 限定套組（疾風喵行／喵頻連線）商城只給 VIP 3 看（Claude）
- D：「這兩個從商城移除，因為一般買不到，VIP 3 時商城才會出現」——撤回 v460／v461 的「先放出來給大家看」。
- tavern-ui-bridge.js：catalog() 的 VIP 限定商品多 vipHidden（未達等級、沒擁有、不是 ?preview）；state() 給商城的清單把 vipHidden 拿掉。
  catalog() 本身不濾：手帳圖鑑（outfitDoll）、試穿驗證照舊；VIP 頁的兩個動態預覽與 VIP 3 二選一視窗（lobby-ui/vip-outfit.js）不經過商城清單，照舊。已擁有的人仍看得到。
- 版本：verTag v515、ver.json 515、lobby-view 515、tavern-ui-bridge.js?v=515（原本 508）。
- 驗證：本機大廳，VIP 0／2 商城當季只剩熊熊偵探、龐克搖滾狼、中華小惡魔、心動情人；VIP 3 六套都在；VIP 0 但擁有疾風喵行 → 只列疾風喵行；手帳圖鑑畫得出來。

## 2026/11/10 v514 網站：點單選想玩的遊戲＋送出後的引導（說明卡、委託進度卡）（Claude）
- D：「點單時讓老闆自行輸入要玩的遊戲（休閒／競技），給一些常見選項」「點完單後在等待的時間不知道現在可以幹嘛、後續要去哪，都沒有引導」。
- 想玩的遊戲（lobby-ui/order-flow.js）：方案名稱含「遊戲」的（休閒遊戲／競技遊戲）選完先跳「這次，想玩哪一款？」——自己打字（30 字）＋熱門遊戲小膠囊
  （競技：特戰英豪、英雄聯盟、傳說對決、APEX…；休閒：鵝鴨殺、猛獸派對、蛋仔派對、Minecraft…，常數 GAMES）＋「還沒想好，見面再聊」。
  存 clientOrders/<單>/game（有填才寫；同組每筆都帶）。規則 clientOrders 本來就沒有欄位白名單，不用改規則。TTOrderFlow.game() 給 lobby.html submitOrder／payWithCoins 讀。
  顯示：結帳摘要「想玩」、大廳訂單票卡副標、冒險者手札（新單、單子池、進行中）、店長頁訂單卡（也能搜尋）、店方 Discord 新訂單通知。主機那邊的委託私訊／聊天室開場也會帶（後端 v514）。
- 送出後的引導（新 lobby-ui/order-guide.js／.css，只讀不寫）：送出委託 0.4 秒後跳「接下來」說明卡——付款確認→冒險者接單→到 Discord 會合→一起玩，標「現在在這裡」，
  下面「等待的時候」：打開 Discord、換套衣服、回小屋等、在大廳聊聊；可勾「下次送出後不用再跳出來」（localStorage tt_guide_off）。
  左上角吊卡（renewCardHtml 接管；手機在訂單頁最上面 .tt-quest-m）在還沒開始玩之前改顯示委託進度卡：等店長確認付款／等 X 接單（同組 n／total 位已接單）／
  X 接下你的委託囉（打開 Discord）／預約還久：約好了，t 見／語音房開好了（進入語音房，讀 TTVoiceOrders.items()，order-voice.mjs 多 items() 與 tt-voice-items 事件）／冒險者這次接不上。
  冒險者按「開始」後換回原本的倒數吊卡。進度卡「接下來？」可以再打開說明卡。Discord 那段文字照主機 v514 的實際流程（接單後 TT 私訊→專屬聊天室→選私人／公開→語音房）。
- 版本：verTag v514、ver.json 514、lobby-view 514、live.js／order-flow.js／order-voice.mjs／order-guide ?v=514、partner verTag v420／PT_VER 21。
- 驗證：本機預覽（peiwan-local 18771）電腦 1100～1280 與手機 375：各階段進度卡（付款中、等接單、預約等待、預約還久、已接單、語音房好了、開始後換回倒數、接不上、同組 1／2）、
  重畫不重建 DOM、makeRecords 有填才帶 game、競技遊戲以外的方案不問。

## 2026/11/10 後端 v514 委託語音房：先問私人／公開＋專屬聊天室＋邀朋友＋冒險者小帳（主機 deploy-v514；網站只動 admin）
- D 轉達客人與冒險者建議：開語音房前先問老闆私人房還是公開房、之後老闆能自己調；另外開一間私人文字聊天室（老闆＋這張單的冒險者），
  老闆能邀朋友；冒險者在店裡用小帳接單、手冊綁的是大帳 → 權限和 TT 私訊要給小帳。
- 流程（主機 order-voice-bot/booking-room.cjs＋voice.cjs）：到開房時間（預約＝開始前 10 分；即時＝冒險者接單）先在委託語音分類開
  「<名字>的專屬聊天室」（文字頻道，@everyone 看不到），TT 貼提問 @ 老闆與冒險者、另外私訊老闆「前往聊天室」→ 老闆按 🔒私人房／🌐公開房才開語音房，
  3 分鐘沒選＝私人房。之後同一則訊息可隨時切換；「➕邀請朋友」（使用者選單，一次 5 位、一間最多 10 位）「➖請朋友離開」，兩間房權限一起改。
  公開房＝@everyone 可看可進。老闆在語音房另有「管理頻道」（改房名、人數上限），權限覆寫仍由 TT 管（老闆不能把冒險者／TT 踢掉）；TT 給不了就略過（noManage）。
  語音房收起來（大家都來過又走光、或時間到沒人）聊天室一起刪；問的時候就取消 → 聊天室直接刪。
- D：「時間到不應該消失，全部離開才消失」。舊版（GPT v27 起）冒險者按結束或時間到（endAt＋15 分）就把語音房權限收回 → 房裡的人整間消失。
  v514 改成：正常結束不收權限，大家都離開 30 秒後才刪（聊天室一起）；只有取消／退款（status cancelled）照舊馬上收。舊測試 voice-test.cjs 第 6 項（時間到收權限）因此不再適用。
- 配合網站點單新欄位 clientOrders/<單>/game（「想玩什麼」，主工作階段做的）：新委託私訊冒險者、專屬聊天室開場訊息多一行「想玩：…」（同組取第一個有填的、限 30 字、沒填就沒有）。
- 按鈕只放在伺服器頻道裡（gateway 的 onInteraction 只收 guild 互動，私訊裡的按鈕收不到）；custom_id `ttv:p|o|inv|add|rm|del:<訂單>`，只有那張單的老闆能按。
  設定存 orderVoiceV1/roomPrefs/<訂單>{privacy,friends{id:名字},rev}（只有主機讀寫，不用改規則）；按了直接處理那一張（有租約，不跟排程重複）。
- 冒險者小帳：admin「角色名冊」新欄「接單 Discord（小帳）」→ peiwan/characters/<角色>/orderDiscordId（原本就只有店長能寫）。
  語音房／聊天室權限、開房提醒、新委託私訊（staff-order-dm）都給小帳；小帳不在伺服器 → 退回手冊綁的帳號；私訊小帳失敗再發大帳。
  「大家都走光才收房」改用實際給權限的帳號判斷（job.staffTargets）。D 若要冒險者自己在手冊綁小帳（Discord 登入驗證），之後再做。
- 主機程式來源：沒有完整副本 → 從歷代 ops/deploy-v428～v513 腳本的 tgz 依序疊回主機現況（voice.cjs＝v433 版 0aa1315d…、service-server＝v478＋v511＋v513 補丁），
  部署前核對 voice.cjs／staff-order-dm.cjs 雜湊，不是預期版本就整個停止。gateway.cjs／discord.cjs／store.cjs 主機版本不明，所以都沒動。
- 驗證：booking-room 16 項（假 Discord＋假資料庫：先問、公開／私人、逾時、非老闆、邀／請離開、小帳、小帳不在伺服器、取消、收房、沒管理權、聊天室開不起來、建到一半當掉、舊房不受影響、別的分類不受影響）
  ＋私訊冒險者 10＋voice-open 5＋VIP 10＋通知；假根目錄 dry-run 53 項全過、雜湊不符與找不到接點都會停。admin 新欄位用假資料渲染＋存取測過。
- 上線順序：admin（隨時）→ 主機 bash deploy-v514.sh（ops 分支 security-v428）。沒填小帳＝照舊用大帳。

## 2026/11/10 v513 VIP 升級恭喜附老闆小人動圖（需發布第二十一批規則＋主機 deploy-v513）
- D：VIP 升級在 Discord 只讓 TT 說話的「✦｜酒館名人牆」公告，每一級都 @所有人＋@ 老闆的 Discord（文字不用闆卡名）；獎勵清單 TT 私訊本人（D 定稿文字）。
  公告附去背動圖：雜誌字卡（名字頁籤＝闆卡名、VIP＋菱形數字、等級名、右下 HALL OF FAME No.xxx）＋老闆「當下」闆卡小人（呼吸壓扁、頭髮擺動、眨眼）＋兩顆星，顏色跟等級。
  試做與 D 看過的版本在 C:\tinytavern\VIP升級動圖試做\v4雜誌字卡（D 否決過：碰杯點字圖、闆卡場景圖、小人點字圖、彩紙酒泡特效〔廉價〕、圓角貓耳腮紅卡〔AI 感〕）。
- 流程：主機 vip-celebrate.cjs 發現升級 → orderVoiceV1/vipCelebrate/seq 編期數 → 寫 peiwan/vipCardReq/<闆卡>{lv,no,at} → 老闆的大廳 lobby-ui/vip-card.js（每 3 秒看登入）讀到就用 me().b.doll／b.name
  畫 36 格 480×500 GIF（gifenc 1.0.3 jsdelivr、1 位元透明、約 700KB，4～9 秒）交到 peiwan/vipCard/<闆卡>/<等級> → 主機收到（檢查 GIF 檔頭、≤2MB）頻道＋私訊都附圖，發完刪單子和圖；
  24 小時沒交圖只發文字。兩台同時跑搶 claim、重啟從 pending 接著等；一次跳兩級只恭喜最高那級。TTVipCardGif.render({doll,name,lv,no}) 可單獨畫一張。
- 規則第二十一批（tests/security-rules-v428/build/harden-phase21.cjs、test-phase21 23 項；快照 rules-before-v513.json）：vipCardReq 本人與店員讀、只有店長寫；
  vipCard 本人只能交「請畫的那一級」、data:image/gif;base64、小於 2.4MB、不能覆蓋，店員讀與刪。
- 教訓：部件圖（含閉眼圖）第一次用到才開始載，沒載好就畫會少一層（D 抓到眨眼那格臉上沒眼睛）→ 重畫到前後兩次一模一樣才算。
  Windows 字型的空白點字比有點的窄（10.4 對 12.05px），點字圖在 Discord 電腦版會歪，別再用點字圖。
- 版本：verTag v513、ver.json 513、lobby-view 513、vip-card.js?v=513。
- 驗證：本機預覽＋模擬資料庫整輪（firebase-admin 跑真的機器人模組＋真的大廳網頁＋假 Discord）：儲值 → 請畫圖單 → 大廳交圖 → 公告附 GIF（@ Discord、不寫闆卡名）＋私訊附 GIF → 單子和圖清掉；
  全新瀏覽器四套時裝眨眼正常；正式規則重播交圖允許、再交拒絕；規則 11、12、14～21 批全過；機器人測試 VIP 10＋私訊冒險者 8 項。
- 上線順序：①Firebase 發布規則（第二十一批）②網站 v513 ③主機 deploy-v513（取代還沒跑的 v511／v512，已部署的部分自動跳過）。順序反了也不會壞：沒有規則就讀不到請畫圖單，24 小時後只發文字。

## 2026/11/09 v511 小屋裡朋友走路一頓一頓、上下抖（以 v510 緊急修正為底）
- D：「我在小屋看朋友走路超怪」「朋友很像在抖動」。原因（house/room.html peerStep）：朋友的小人用固定每秒 2.6 格追最新位置（真人走 3.5 格）、追到就停、彈跳歸零，
  畫的位置又被 rectOf 取整到整數像素 → 走一下停一下、上下抖、越走越落後（超過 5 格直接瞬移）。
- 修法：收到的位置排成時間線（peerSample），時間用「距離÷走路速度 0.0035 格/毫秒」排（大家走路一樣快，網路忽快忽慢也不跟著忽快忽慢；停了一陣子再走就往回推起步時間），
  畫面固定晚 0.25 秒（PEER_DELAY）在兩筆之間平滑補；一次跳超過 5 格（剛進門、重連）直接到；走路彈跳在兩筆之間短暫停也不收（180ms）；朋友小人改用小數位置畫（跟自己一樣）。
- 實測 scratchpad/v511/t_peer.cjs、t_peer_jitter.cjs（假朋友每 0.2 秒／0.12～0.32 秒不規則回報＋中途停 1 秒）：中途卡住 30～38 段→0～1 段（剩的是朋友真的停下）、晚到 0.8～1 秒→0.25～0.3 秒；
  三人分身實測 scratchpad/visit/multi511.cjs「主人看到好友走過來、一路平順」原版不過、新版過。同一支的「請陌生老闆離開」「改成不公開請好友出去」兩版都不過＝測試用全開規則（被請出的人會自己坐回來），
  正式規則有擋：test-phase14 對 HEAD 規則 89/89（含被請出 10 分鐘內又坐下拒絕）。
- 版本：verTag v511、ver.json 511、lobby-view 511、house.js VER 511（room.html?v=511）、lobby 載入 house.js?v=511。小屋商城那批改叫 v512。

## 2026/11/09 v510 緊急修正（正式營運當天：冒險者沒辦法計時／報單、老闆吊卡提早倒數）
- 只動三樣，以正式站 v509 為底；小屋商城等大改動（原本叫 v510）改跟著 v511 上。
- **手札計時／報單**（D：「陪玩那邊也說無法正常計時」「兩個陪玩都說無法正常報單」，畫面「計時尚未儲存成功，請重試；未變更訂單」）：
  lobby-ui/service-timer.mjs 以前要語音主機 /v1/voice/time 先記到時數才肯開始／暫停／結束，主機沒有這筆單（語音登記失敗）就整個卡死。
  現在手札自己的計時一律照做；主機記不到只在「開始」提示一次「計時照常進行；語音主機的時數紀錄這次沒有同步（代碼 …），不影響這筆單」。
  舊單沒有 clientOrderId 也能計時。主機回「已結束／已開始過」照舊擋。
- **大廳吊卡**：冒險者按「開始」（servingSince）才倒數；接單沒開始只顯示「縭 接下你的委託囉／到 Discord 跟冒險者會合，開始玩之後才會開始算時間」，不能續單。
  （手札接單不寫 acceptedAt，所以以前其實從老闆下單那一刻就倒數。）
- **語音登記錯誤**：lobby-ui/order-voice.mjs 沒列過的主機代碼改顯示「語音房還沒建好，系統會自動重試（代碼 …）」；一筆失敗不再擋住後面的委託。
- 語音房沒建、機器人沒私訊的根本原因（主機拒絕登記）還要在 api 主機查：ops/diag-voice-v511.sh（security-v428 分支，只讀）。
- 版本：verTag v510、ver.json 510、lobby-view 510、partner v418／PT_VER 19、order-voice.mjs?v=510、service-timer.mjs?v=510。
- 測試：scratchpad/v511/t_timer.cjs 9 項（手札真畫面＋假登入：主機拒絕時開始／暫停／繼續／結束照常、老闆單拿到 servingSince、主機正常時不多跳提示）、t_v511.cjs 8 項。

## v504 家具扭蛋上線（伺服器抽；需部署主機＋發布新規則）
使用者 11/08「可以了，上酒館大廳吧」：正式功能（真的扣貓貓幣、家具進小屋背包）、入口在小屋選單、結果由主機抽（防作弊）。
卡池：人魚卡池（海底人魚屋 34 件）、森林卡池（森林精靈小屋 37 件）、通用（酒館日常＋萬用 82 件，常駐）；每個卡池只抽自己的系列。機率 限定 3／稀有 18／普通 79（同稀有度每件機會一樣）；單抽 120、十連 1,200 貓貓幣；十連保底一件「這個卡池還沒擁有的」稀有以上，稀有以上收齊後保證至少一件稀有以上。
限定卡池檔期（D 11/08「兩周一輪替」「更新點為周一的凌晨 4:00」「同時上架」）：人魚、森林兩池同時上架，每期 14 天，台灣時間星期一 04:00 換期；第一期 11/09（一）04:00～11/23（一）04:00。檔期以主機 gacha-pools.json 的 schedule 為準（檔期外主機回 409 POOL_CLOSED、不扣錢），/api/gacha-info 會回傳 schedule；扭蛋頁顯示 LIMITED 剩 N 天／COMING 即將登場／CLOSED 已結束、卡池鈕上寫剩幾天、檔期外按鈕鎖住；讀不到主機時用 g3d.js 內建的 SCHED0（要跟主機一致）。11/23 之後還沒排下一期（D 11/08：其餘系列有些東西要再修，之後再討論）：兩池會顯示已結束，只剩通用。換期＝改主機 schedule 重新打包部署（新卡池另外要網站素材）。
主機（C:\tinytavern\server，不在 git）：lib/gacha.js＋gacha-pools.json（153 件，跟 gacha/items.json 同源），POST /api/gacha {myKey,pool,n}（Bearer 登入憑證，checkOwner 同儲值：secureV1 members／owners 確認本人）→ 讀 houseInv 算保底 → crypto 亂數抽 → cat/<key>/balance transaction 扣款（不夠回 402 NOT_ENOUGH、不寫任何東西）→ 一次 update：catTx/<key>/<id>{type spend,amount −cost,ref id,note 家具扭蛋・卡池＋單抽／十連}、cat/<key>/lastTx、houseInv/<key>/<家具>/<id>_<序>{ts,src:'gacha'}、gachaLog/<key>/<id>{pool,n,cost,items,ts}；寫入失敗把貓貓幣加回去回 503 BUSY。限流同闆卡 10 分鐘 40 次、同 IP 80 次（TOO_MANY）。GET /api/gacha-info。lib/topup.js 只多匯出 checkOwner。test/gacha.test.js 11 項、topup 22 項照過。部署：server/扭蛋上線步驟.md（pay-v504-貼上主機.txt 整段貼到網頁 SSH，先核對主機檔案是 v498 才換、備份 backup-v498/）。
網站：gacha/（扭蛋頁，從 tt-room-kit/gacha 用 gacha/sync_to_site.py 複製；3D 模型 153 個約 30MB，抽到才載入；three.js 走 jsdelivr）。gacha/3d/g3d.js 偵測 parent.TTGachaHost＝正式版：錢包與已擁有讀大廳、抽卡交給主機、拿掉試做字樣／重設鈕／測試參數，右上 × 與 Esc 回小屋，錯誤訊息（貓貓幣不夠、要先登入、太快、忙、連不上）；原畫背景 gpt1.png 只有 ?paint 才載。lobby-ui/gacha.js（新）：TTGachaHost（state／sub／pull／close／schedule，pull 帶 Firebase 登入憑證打 PAY_API/api/gacha；開視窗前先讀 /api/gacha-info 的檔期，讀完才載扭蛋頁）、開扭蛋視窗時監聽 houseInv/<key>、小屋右下「扭蛋」鈕（插在家具店前面，.tt-house-only，拜訪別人小屋時隱藏）、整頁圓角卡片視窗＋模糊遮罩。lobby.html 只多載入 lobby-ui/gacha.js?v=504。
小屋：tt-room-kit/house-lobby/build.py 加 GACHA（預設 1）把人魚＋森林 71 件放進 HOUSE_KEYS／圖集／catalog.json（標 gacha:true、price 0、r 稀有度；大小照佔地格數、精緻度照稀有度）；家具店本來就只列酒館日常／萬用，扭蛋家具不會出現在店裡，抽到後在「我的家具」裡擺。重建後用 house-lobby/pin_live.py 把正式站已有家具的圖釘回正式站版本（貓咪單人床、壁爐、電競書桌在試做頁已重畫但還沒給 D 看過，這次不換）。
規則第十五批（tests/security-rules-v428/build/harden-phase15.cjs，可重複執行，接在第十四批之後；若用 rules-before-v504.json 重跑第十四批要再跑這批）：house 與 houseView 的 layout 多接受「houseInv/<key> 裡有這件」；新增 gachaLog（本人與店員讀、客人不能寫）。test-phase15.cjs 18 項（擺自己有的扭蛋家具、沒有的、別人才有的、多欄位、寫別人小屋、拜訪快照、自己寫背包／抽卡紀錄、讀取權限、店員退款刪除），舊規則下除了店員刪除全部拒絕；phase14 89/89、phase11 25/25 照過。
驗證：本機模擬資料庫（9273）＋主機真的 lib/gacha.js＋網站真的 lobby-ui/gacha.js 與扭蛋頁（測試台 scratchpad/e2e）：森林十連 3000→1800、10 件進背包（本人憑證照正式規則讀得到）、限定蘑菇小屋演出、× 關閉；沒登入／不是本人 403、餘額不足不扣；房間頁擺出蘑菇小屋、背包縮圖正常、沒有程式錯誤。部署指令在假主機資料夾模擬過一次（核對、備份、解壓、兩組測試）。
上線順序：①部署主機 ②發布規則 ③推網站。網站先上也不會扣錢（舊主機回 404 → 顯示連不上扭蛋機）。
- 11/08 commit 時查主機 /api/gacha 仍是 404（主機還沒部署）→ v504 commit 只放小屋串門子＋規則第 14、15 批＋小屋圖集/catalog（含扭蛋家具，家具店不賣、沒抽到不會出現）；扭蛋入口 `lobby-ui/gacha.js`、`gacha/` 資料夾、lobby.html 的 `<script src="lobby-ui/gacha.js?v=504">` 留在工作資料夾未 commit，主機部署後再一起 commit。
- **11/08 15:3x 主機已部署 v504 扭蛋**（D 登入 GCP、Claude 貼）：sha 核對過、gacha 11/11、topup 22 項通過，pm2 重啟後仍是【正式環境】3D 開、通知簽章有；/api/gacha-info 對外回 200（sea/forest open:false 等 11/09 04:00、gen open:true）。舊檔備份 ~/pay/backup-v498/。
  網頁 SSH 貼長檔的方法：本機開小伺服器（CORS＋Access-Control-Allow-Private-Network）→ 頁面 JS `fetch('http://localhost:port')` 拿內容、核 sha256 → 對 `.xterm-helper-textarea` 送 ClipboardEvent('paste')（括號貼上，要再按 Enter）。瀏覽器面板的 Ctrl+V 與 clipboard.readText 都不行。

## v502 掛機收益：離線也累積、最多存 8 小時（需發布新規則）
使用者 11/08：掛機累積收益，最多 8 小時封頂，可以領貓貓幣，要有進度條，新手指南與大廳說明寫進去（之前只有「掛機亂走」開關和每日任務 v479 的「大廳待滿 10 分鐘」本機計時）。店長拍板：①離線也累積（像手遊放置：從上次領取後經過的時間算，關掉網頁也照存）；②「每天只領一次，七天要夠抽一次十連」，十連暫定 1,200、只算掛機 → 每小時 22、存滿 8 小時＝176，每天領一次七天 1,232。
資料：peiwan/idle/<key> {at,tx,amount}，at＝開始計時或上次領取的伺服器時間。第一次（沒有紀錄）本人寫 {at:伺服器時間} 開始計時；領取＝同一次寫入 idle（at＝伺服器時間、tx、amount）＋ catTx/<key>/<tx>{type:'idle',amount,ref,note:'掛機收益',ts} ＋ cat/<key>/lastTx ＋ cat/<key>/balance 加 amount。
規則第十二批（tests/security-rules-v428/build/harden-phase12.cjs，可重複執行；套用前快照 rules-before-v502.json）：idle 本人與店員可讀；本人只能「還沒有紀錄時開始計時（at 必須等於 now，不能帶 tx／amount）」或「領取」：at 必須等於 now、amount 為 1～176 的整數、amount×1 小時 ≤（now − 上次 at）×22（金額完全由伺服器時間把關，不信網頁算的）、tx 是新的貓貓幣交易且 type idle、金額相同、cat lastTx＝tx；本人不能刪紀錄、不能只改 at。catTx 多 idle 分支（同一次寫入的 idle 紀錄 tx／amount 相符、at＝now）；cat.balance 多 idle 分支（剛好加這次的 amount）。店員可任意調整或刪除 idle（刪除＝下次重新開始計時）。每小時與上限改了要同步 harden-phase12.cjs 的 RATE／CAP_H 與 lobby-ui/idle-income.js。
網站：新增 lobby-ui/idle-income.js（TTIdle，CSS 內含）：登入綁定後監聽 idle/<key>（同每日任務，要 Discord 登入；讀取被拒＝規則還沒發布或不是本人 → 整條不顯示），沒有紀錄就開始計時；用 .info/serverTimeOffset 估伺服器時間、少算 5 秒再送（網頁時鐘偏快也不會被拒）。畫面：電腦＝左上角名牌白卡下方的吊卡（#ttIdleHud，兩根吊環掛在名牌上，跟著名牌縮放；遊玩中吊卡 positionPlayCard 包一層自動往下讓開）；手機功能首頁＝上方個人卡下方（#ttmIdle）；錢包貓貓幣區（cat-coin.js mount 放 .tt-idle-slot）。內容：小硬幣＋旋轉菱形、「掛機收益 IDLE BONUS」（窄的時候縮成 IDLE）、5.2／8 小時、8 格進度條（流動斜紋，存滿換金粉閃光＋四芒星）、「每小時 22・再 X 小時 Y 分存滿」、領取鈕（顯示可領數量；不到 1 枚顯示「累積中」不能按）。領取成功：小硬幣從按鈕飛到名牌（手機：上方卡片）的貓貓幣、通知「掛機收益：收到 N 貓貓幣」；被拒時提示「剛剛已經領過了」或「稍等一下再試」。存滿每一輪通知一次。cat-coin.js：TX_LABEL idle「掛機收益」、錢包說明加一句、onChange 只在輸入兌換數量時不重畫（按了「領取」也會更新餘額）。lobby.html：載入 idle-income.js、店長布告欄「每日任務」後加「掛機收益」卡。guide.html 錢包章節加「掛機收益／每日任務」兩欄與 FAQ「掛機收益怎麼沒有增加？」。admin.html 刪除角色一併清 idle。
版本：verTag v502、lobby-view 502、cat-coin.js 502、idle-income.js 502。tests/security-rules-v428/emu.cjs 可用 RTDB_EMU 指定模擬資料庫（預設 9000），run.sh 加第十二批。
測試：test-phase12.cjs 41 項（第一次開始計時、時間寫早、開始時帶金額、重開計時、3 小時領 66／60／67、10 小時領 176／177／220、0／負數／小數、剛領完再領、同一筆交易再領、at 不改成現在、at 寫未來、加錢比交易多、餘額直接改、紀錄與交易金額不同、類型 daily／event、紀錄指向別筆、只加錢、只寫紀錄、沒改餘額、沒有交易、幫別人領、未登入、Email 帳號、幫別人開始計時、改早 at、刪紀錄、多寫欄位、讀取權限、店長調整／刪除、自己加貓貓幣、兩台裝置同時領），舊規則下全部拒絕；run.sh 第 1～12 批：第十二批 41/41，第七批 3 項、第九批 2 項失敗——都是「11/07 前送 10 金幣」那幾項，用改動前的規則一樣失敗（測試寫在 11/07 前，現在已過切換時間），與這次無關。本機模擬資料庫（9273）＋實際大廳頁面：沒有紀錄自動開始計時、5.2 小時領 114（cat 2500→2614、catTx idle、at＝伺服器時間）、剛領完按鈕變「累積中」直接呼叫也不送、10 小時存滿 176（2614→2790）、錢包區與布告欄文字、手機 390／360 領 165 無水平捲動、遊玩中吊卡自動讓開；頁面送出的三種寫入（開始計時、114、176）在新規則下用本人身分重播全部允許、同一筆重送與換編號馬上再領都被擋；舊規則下全部被拒，頁面三處都不顯示、沒有錯誤。payment-safety-v273、topup-online-v499、chat-skins-v364、subscriptions-v273、cart-checkout-v501、mobile-v353、hub-actions-v299、viewport-v352、social-v347 通過；security-v428、base-parts-v434 需要的 @firebase/rules-unit-testing 本機沒有裝，沒跑。
上線順序：①店長在 Firebase 主控台發布 security/database.rules.json（新規則相容舊網站，舊網站不會寫 idle）→ ②推網站。順序反過來也不會壞：網站先上、規則還沒發布時讀不到 idle，掛機收益整條不顯示，發布後重新整理就出現。開始時間從客人第一次打開新版大廳算起。店長 11/08 在本機預覽點過，確認可以。
限制：每個闆卡一份計時，換裝置共用；店員刪除角色會一併清掉。

## v501 商城「全部結帳」：試穿中要買的東西一次結帳
使用者 11/07（截圖：確認選購視窗把啟程旅人・眼鏡、菜刀、微風日常・青春洋溢髮箍各列一顆「前往結帳」）：穿上的東西可以一次結帳，不要一個一個結。
做法：資料庫規則（v428 第二批）一筆扣款明細只對應一筆訂單（wallet.lastTx 指向它、餘額剛好減它的金額），已用正式規則在本機模擬資料庫確認「一次寫入兩件」（兩筆明細或一張訂單兩件商品）都會整筆被拒 → 不改規則，改成「按一次付款、逐件送出」：每件仍是一筆完整交易（訂單＋扣款＋明細＋lastTx＋背包，寫入內容與單件相同），沿用 payment-safety 的交易鎖與未確認紀錄。
- tavern-ui/live-wardrobe.js：確認選購視窗拿掉每列的「前往結帳」，改列編號＋名稱＋價格，最下面一顆「全部結帳 · N 項」（清單太長時清單自己捲，按鈕固定看得到，look-summary.css）；按下前用最新的價格／持有重算，有變就重畫請老闆再確認；只有 1 項時照舊走單件結帳。計價規則不變（同套部件合計比整套貴時改買整套、已擁有不計價、尚未開賣不計價）。
- tavern-ui-bridge.js：原本 buy() 的檢查抽成 shopPlan(id)（下架、未開賣、已持有、名稱與價格），buy 照用；新增 buyCart(ids)（curPlan＝{cart:true,items,p 金幣合計,catP 貓貓幣商品的金幣等值合計}）、cartPlan、cartRecheck。
- lobby.html：payWithCoins 的寫入內容抽成 coinPayChanges()（單件與一起結帳共用，內容與 v500 相同）；payWithCoins 遇到 curPlan.cart 交給新的 payCartWithCoins()：付款前 cartRecheck 重讀價格與持有（不同就更新結帳頁、不扣款）、座椅／下架檢查同單件、先確認金幣與貓貓幣總額都夠（不夠一件都不扣）；之後逐件付款，按鈕顯示「結帳中 2／3」；全部成功跳「購買成功！N 件都收進背包了」；中途有一件沒成立就停下，已買到的照常持有，用確認視窗列出「買到了／沒買到（沒有扣款）／還沒結帳（沒有扣款）」，結果不明的那件寫「付款結果還沒確認，請先到訂單查看，不要重複付款」，按「回商城看看」回到商城（搭配保留，剩下的照常顯示要買）；一件都沒成立時跟單件一樣留在結帳頁提示原因。payCurrency：一起結帳全是貓貓幣商品才算貓貓幣；一起結帳不走轉帳；結帳頁按鈕「全部結帳」。
- lobby-ui/order-flow.js／.css：一起結帳的結帳頁列出全部商品（編號、名稱、價格）、本次應付金幣、另付貓貓幣、付款後餘額、不足時「金幣還差 N」＋去錢包並鎖住按鈕；付款中不重畫。
重整與重複：每件付款成立就記進 tt_orders；某件結果不明會留下未確認紀錄，重整後再按會先查那筆訂單（已成立就清掉紀錄、不扣款），再按一次才買下一件；已持有的商品商城重算會擋下，就算舊畫面硬送，資料庫也拒絕重複持有。
版本：verTag v501、lobby-view 501、bridge 501→tavern-ui index 501→時裝間比較 501→live-wardrobe 501、look-summary.css 501、order-flow.js／.css 501。資料庫規則沒有改。
驗證：tests/cart-checkout-v501.cjs（大廳實際付款程式＋本機模擬資料庫 9273＋正式規則）9 項：單件照常、三件 1000→910 三筆訂單格式同單件、餘額不足無寫入、第二件被拒只扣第一件、第二件結果不明＋重整不重複扣、重複結帳同一組不扣、價格變了先更新畫面、金幣＋貓貓幣一起結帳、兩個分頁同時按只成立一組。實際頁面（大廳＋商城連模擬資料庫，資料庫連線用模擬的本人登入，所有讀寫照正式規則）1685／1366：截圖情境三件一次結帳（餘額 1000→910、三件在背包）、重整後顯示已擁有且不能再扣、餘額 50 鎖住按鈕硬按也不寫入、結帳途中部件價格調高讓第二件被拒、第二件回應遺失後重整不重複扣、七件長清單按鈕看得到、「上一步」回商城。既有測試修改前後結果相同：payment-safety-v273、chat-skins-v364、topup-online-v499、dye-v230、wardrobe-state-v276 通過，security-v428、base-parts-v434 通過（本機沒有 @firebase/rules-unit-testing，用 REST 小替身接同一個模擬資料庫）；look-summary-v371、order-flow-v234、retired-outfits-v357、seats-v361、shop-browse-v363 在 v500 就失敗，錯誤相同。
沒驗到：手機（v432 起手機商城只開背包、不開放結帳，看不到這個視窗）；正式站真實付款。

## v500 先關掉月費會員區（MEMBERSHIP_ON=false，程式與資料保留）
店長 11/07：目前客人不夠支撐開會員，會員區先關掉。lobby.html 新增 `const MEMBERSHIP_ON=false`（PLANS 上方，同時掛 window.MEMBERSHIP_ON 給 live.js／staff-book.js／contacts.js），改成 true 就全部恢復。
關掉的地方：點單選單「加入會員」卡（#mbMenuBtn 隱藏；live.js 新版選單同樣藏起來，編號改 01 找冒險者一起玩、02 酒館併桌，選單副標改「找冒險者一起玩，挑一種喜歡的玩法。」）；shopOpen(2,'member') 一律擋下並提示「會員方案暫時沒有開放」（所有帶去會員方案的路徑都經過這裡）；VIP 視窗說明拿掉「儲值與月卡都算」。
店長決定（11/07）：
①冒險者私訊開放給所有老闆：新增 window.ttStaffDmOk()（會員區關著＝true，開著＝進階會員以上），staffDmOpen／dmSend／私訊視窗提示改用它；冒險者通訊錄（staff-book.js）不再蓋會員遮罩、私訊鈕都能按，「查看月費會員」鈕在會員區關著時不顯示；通訊錄冒險者列「冒險者・會員私訊」改「冒險者・私訊」（contacts.js）；舊手機首頁副標改「看誰在線上，也能私訊冒險者」。資料庫規則 dm／dmMeta 只檢查是否為綁定闆卡的本人（secureV1/members＝Discord 綁定，不是月費會員），沒有會員限制，不用改規則；沒有用 Discord 登入的人照舊送不出（v490 的提示）。
②目前沒有人買過會員，不處理既有會員。
③成就「月費會員」整個拿掉：ACH_DEF 由 ACH_ALL 過濾掉 crown（成就收藏冊、手帳、別人闆卡的成就圖示、成就數都不算），稱號 TITLE_BY 也略過，achMemberCheck 不再解鎖；已拿到的本機紀錄（tt_stats）與 pub.ach 保留不刪，會員區打開就恢復。
手機私訊分頁（使用者 11/07）：v432 起手機是功能首頁（訂單／私訊／儲值／信箱），舊首頁的「冒險者通訊錄」入口被藏起來，手機「私訊」分頁只列出已經聊過的冒險者，還沒聊過的老闆沒有地方開始私訊。mobile-app.js 在私訊分頁最上面（#frBody 前面，通訊錄重畫不會被清掉）加「冒險者通訊錄」按鈕（#ttmStaffBook，副標跟著 MEMBERSHIP_ON：關著「看誰在線上，也能私訊冒險者」、開著「看誰在線上，會員可私訊冒險者」），按下開原本的 TTStaffBook；mobile-theme.css 白紙深藍框＋粉色錯位紙頁＋粉色私訊圖示。
沒動：PLANS.member 三個方案、ttMemberTier、會員訂單的通知／票卡／店長頁、資料庫規則（harden-phase5 PRICE 照舊）、VIP 等級（累積支持，不是月費會員）、冒險者手札 partner.html 的「會員私訊」卡片與說明「進階／尊榮會員可以從酒館私訊你」（staff-dm.js，冒險者自己看的）。舊商城 #dressM 的「會員享折扣」字樣在已不使用的舊視窗裡（商城鈕已改開新商城），沒動。
不在這個 repo：Discord 伺服器的會員身分組（member-roles.cjs）與「💎 旅人私席」頻道在 api 主機，要一起關需另外處理。
版本：verTag v500、lobby-view 500、live.js 500、staff-book.js 500、contacts.js 500、mobile-app.js 500、mobile-theme.css 500。
驗證：本機 Playwright（Firebase 全擋、不寫正式資料）1366 電腦版：點單選單只剩兩張卡、shopOpen(2,'member') 不打開、點冒險者方案照常、VIP 說明、沒有會員也能打開冒險者私訊（不會跳去會員方案、沒有到期提示）、冒險者通訊錄三位都能按私訊沒有遮罩、通訊錄冒險者列沒有「會員」、成就與稱號沒有「月費會員」（含本機已拿到 crown 的老闆，紀錄仍在）；390 手機畫面沒有「會員」字樣；390／360 手機私訊分頁有冒險者通訊錄按鈕（切換分頁不重複）→ 打開通訊錄沒有遮罩、三位都能按 → 私訊縭打開對話視窗 → 關掉後回到私訊分頁、沒有水平捲動；兩邊沒有頁面錯誤。既有測試 hub-actions-v299、mobile-v353、payment-safety-v273、topup-online-v499、viewport-v352、social-v347 通過；hub-v297、contacts-v296（直接開 lobby.html 被轉到 lobby-view 而逾時）、lobby-v346、lobby-v358、order-flow-v234 在未修改的 v499 一樣失敗，錯誤相同。

## v499 線上儲值接上應援正式環境（付款主機 server/ v498 包已部署並切正式環境 2026/11/07）
使用者 11/06：應援（OEN）正式環境核准（商店代號 tinytavern；藍新信件：信用卡含國外卡、ATM 已開通、可 3D；超商代碼待正式付款頁確認；電子發票是否開通不確定）。業務要求綁定固定 IP（主機 35.229.172.14）。
付款主機（C:\tinytavern\server，不在 git；部署步驟 server/正式上線步驟.md，上傳包 pay-v498.tar.gz，舊版備份 _backup_v196/）：照應援官方文件 developer.oen.tw v10.3 重寫。lib/oen.js：OEN_ENV=testing|production 決定 API 與付款頁網址、OEN_MERCHANT_ID、OEN_TOKEN、OEN_WEBHOOK_SECRET（OenPay-Signature HMAC、5 分鐘時效）、OEN_PAYMENT_METHODS（預設 cvs,atm；linePay 開通才加，否則建單失敗）、OEN_USE3D、OEN_REQUIRE_EMAIL；403 無 code＝固定 IP 未綁定。lib/topup.js：/api/topup 需 Firebase 登入憑證且 secureV1 members/owners 確認是本人闆卡、金額必須是 config/topup/tiers（讀不到就拒絕，不再用預設金額）、建單 clientOrders（type topup、payChannel oen、payEnv、oenId、oenHid）＋ payV1/pending/<訂單>（只有主機讀寫），應援 /checkout 帶 Idempotency-Key、successUrl lobby.html?pay=ok&order=<訂單>、failureUrl lobby.html（應援會加 ?payment_error=）。付款通知只當提醒：用 id 回查 GET /transactions/{id}，orderId、金額、交易 id 對上且 charged／claimed 才入帳；入帳先 transaction 搶 credited（值 'oen:<交易id>'，店長手動入帳是 true），再一次多路徑 update 寫 status done、creditedAt、wallet balance increment、walletTx topup、信件、移除 pending，失敗就放回旗標。超商／ATM 取號（charging）把代碼存 clientOrders.payCode。每 5 分鐘補查 pending（GET /order/{orderId}/transactions）：漏收通知補入帳、同一筆付兩次只入一次並在訂單 payAlert 提醒退款、30 分鐘沒付款標 status cancelled＋payAbandoned（之後真的付款仍入帳）。測試環境：網站來的儲值一律回 NOT_LIVE（測試卡人人可用），只接受 try-topup.js 的測試帳號 paytest_v498（testOnly）。/api/pay-config 回 live、methods、needEmail。check-oen.js 上線前檢查（token、固定 IP、儲值方案）。test/topup.test.js 22 項（偽造通知、重送／同時送、金額或交易 id 不符、店長已入帳、已退款、寫入失敗後補查、旗標卡住、漏收、超商、放棄後付款、付兩次、Email、逾時、IP 403、簽章、測試環境）。
網站：lobby.html 線上付款共用 ttPayOnline(tier,opt)（帶 Firebase 登入憑證；錯誤碼 EMAIL_REQUIRED 叫出 Email 欄、LOGIN_REQUIRED 請 Discord 登入、NOT_LIVE 改準備中）；ONLINE_PAYMENT_READY 改 let 預設 false，/api/pay-config 明確回 live:true 才開放（主機還在測試環境、仍是舊版 v196 主機〔沒有 pay-config，舊主機在測試環境會讓測試卡拿到金幣〕或連不上，都顯示準備中，網站什麼時候上線都安全）；付款方式文字跟主機設定；付款視窗加 Email 欄（需要時才顯示）；回跳 ?pay=ok&order= 把訂單加回清單並查狀態（已入帳／超商代碼／確認中），?payment_error= 依代碼提示，參數連外框 lobby-view 一起清掉；訂單監看對 payAbandoned 改提示「線上儲值沒有完成」；錢包說明改「線上付款自動入帳」。live.js 訂單票卡：線上儲值顯示等待付款結果／超商代碼或 ATM 帳號與期限／沒有完成。membership.js 付款方式卡片文字跟主機設定、未開放改「準備中」。mobile-app.js 手機儲值頁選方案後多「線上付款・自動入帳」區＋「或用銀行轉帳」分隔，方案卡「轉帳 NT$」改「付 NT$」；mobile-theme.css 分隔線樣式。admin.html 線上付款不列待核帳／通知／徽章、沒有「確認收款」鈕、標「💳 線上付款・方式・進度・交易編號」與異常、取消已入帳的線上儲值提醒到應援後台退款。tests/topup-online-v498.cjs；payment-safety-v273 改檢查 live 旗標。verTag v499、lobby-view 499、live／membership／mobile-app／mobile-theme ?v=499（v498 是同日的好友名單修正）。
不需改資料庫規則（主機用服務帳號；payV1 在根節點，規則沒開放＝客人讀不到）。

## v498 好友名單：已是好友還在「邀請」、多出沒有闆卡的「神秘人」
使用者截圖：好友 2（神秘人、魚油）、邀請 1（魚油）。原因①：雙方互相送過邀請時，frAccept 只刪 friendReq/{我}/{對方}，我送給對方的那張 friendReq/{對方}/{我} 留著 → 對方同時看到「好友」和「邀請」；通訊錄的邀請分頁也沒有排除已是好友的人。原因②：好友節點指向已不存在的闆卡（開店前清空只清 lobby／cards 等，沒清 friends／friendReq；店長刪角色只刪對方名單裡「有回指」的那筆），名字是當初存在 friends 裡的舊名（程式裡沒有「神秘人」這個字）。
lobby.html 好友區塊：frView() 顯示前過濾——已是好友的邀請、指向自己、lobby/{key}/name 不存在（公開可讀，查一次快取）的好友／邀請都不顯示，紅點也用過濾後的數字；同時清掉自己名下那一筆（friendReq/{我}/{k}、friends/{我}/{k}，每筆每次開頁只試一次，被拒不重試）。frAccept 多刪 friendReq/{對方}/{我}；frAdd 遇到對方已邀請我時直接接受，不再反向送一張。verTag v498、lobby-view 498。
驗證：本機 emulator（9273）以工作複本載入大廳：修改前重現 好友 2／邀請 1，修改後 好友 1（魚油）／邀請 0、資料庫殘留已清；自己／沒有闆卡的邀請被藏起並清掉、正常邀請照常顯示；互相邀請後按接受兩張邀請都收掉；有待接受邀請時按加好友直接成為好友。清理與接受的讀寫以正式規則（security/database.rules.json）重播全部允許，不需發布新規則。

## v497 大廳「小屋」鈕換像素小屋圖示
- lobby-ui/assets/house.png（128×128，跟 chat／dress／gift／mug 同一套：2px 深暖棕描邊 #3a2622、硬邊、粉嫩色）。做法：C:\gen\gen_image.py（gpt-image-2）拿四顆舊圖示當畫風參考生草稿 → scratchpad 的 icon/px.py 去白底、縮 108 高、收 30 色、加 2px 描邊 → retouch.py 手修（圓窗逐格重畫成暖光橢圓窗、屋頂粉與木門加飽和）。
- lobby-ui/house.js：ICON.houseImg，dock 的 #ttHouseBtn 改用圖（小屋裡其他按鈕仍是線條 SVG）。verTag v497、house.js ?v=497。

## v496 金幣像素圖示、移除舊背包、四件家具凹槽與床頭重做
- **金幣圖示**（D 11/07：金幣要跟貓貓幣同一套）：img/gold-coin-px48.png／gold-coin-spin48.png，由 tt-room-kit/coin3d/goldtrace.py 產生
  （pixtrace.py 換金色色票；斜放顯示犬尤原圖「反面四芒星」，貓貓幣是正面貓臉）。TTCat.gold(size,mode)／TTCat.gtag(n,size) 跟 coin/tag 同用法（.nyan.nyan-g）。
  換掉的地方：大廳頂部錢數、手機錢數、錢包（餘額、右上大幣改轉動、儲值方案、含贈送）、時裝間標價（goldT／gM 記號 ，跟貓貓幣的  一起在 unCat 換）。
  dock 的「錢包」鈕圖示（lobby-ui/assets/coin.png）沒換。
- **舊背包移除**：lobby.html 的 #bagM 視窗、buildBag()、手機「背包」小鈕刪掉；錢包「獎勵與收藏 →」刪掉；右上 #h2bag 改開新背包（openWardrobe → 時裝間背包）。
- **家具**：流理台／浴缸／洗手台用 boolean 真的挖凹槽，內壁用深兩階材質（r_steelIn／r_tubInD）、槽底一塊亮色底板；雙人床改圓木 ∩ 床頭框、床框一圈同高。
  四件樣本用 palettes/basic_soft.json，D 看過說「可以，全部套用」→ 第一批 82 件全部改用 tt-room-kit/bed/palettes/soft_all.json（124 種材質，OKLCH 換算：暗階提亮帶色相、彩度拉高、亮階偏奶油；白色暗部偏淡紫、奶油／亞麻／紙暗部走蜜桃淺棕；原本飽和的紅粉綠不加多；發光材質不動；每種材質的 old 欄位留原色階）。上色指令 T4_LIT='r_mirrorW=0.4,f_glass=0.35,g_glass=0.35' OSFX=_t4 PALX=soft_all bash to_p1t.sh <名>；舊圖備份在 bed/_backup_1107/t4_before_soft/。前後對照 tt-room-kit/house-picker/柔和配色_酒館日常_1107.png、柔和配色_萬用系列_1107.png。
- **洗手台鏡子**（D 11/07）：鏡框半徑 0.23→0.30（約櫃寬 8 成）；兩道斜反光 D 說效果差 → 拿掉；鏡面朝正前方受光少會被染灰紫，上色時帶 T4_LIT='r_mirrorW=0.4'（tone4.py 新增的亮度下限，預設不開）。
- **小屋縮圖調色**（D 11/07「商店的圖有色差、黑黑灰灰」）：房間畫面每幀有 grade() 的白天調色光，縮圖原本沒有 → house-embed.js thumbGrade() 用同一組 GRADE 數值（提亮暗部＋暖粉霧＋5 格光暈）做一次，再用家具形狀剪回；家具店、佈置清單、背包縮圖都吃這個。lobby-ui/house.js 的 VER 495→496（room.html 網址版本）。

## v495 商城視窗固定＋分類鈕果凍點擊、貓貓幣商品排最上面、小屋縮圖不糊、小屋新手教學
使用者 11/06：商城按分類有些視窗大小會整個改變不舒服 → 要固定，上排分類鈕要有果凍感；每個分類能用貓貓幣買的排最上面；吊掛盆栽很模糊；想要新手教學（第一次進來畫面灰灰的隔一層、虛線圈起來說明要點哪裡）。
商城（tavern-ui/live-wardrobe.js）：目前搭配在每個分類都留著（原本座椅／飲品／染髮券／聊天氣泡會收起來，外框跟著變）；聊天氣泡改在商城裡直接列 10 款（預覽用時裝間自己載的 lobby-ui/chat-skins.js／css），點一下換上，買的時候交給大廳原本的 bkBubbleTap 確認框（lobby-ui/live.css：商城開著時 .ttc、#toast 疊在最上層），買好自動重畫；分類鈕點了套 .jelly（tavern-ui/shop-v495.css，減少動態設定不播）；商城每個分類 cur:'cat' 的商品排在最前面（catFirst，背包不重排）。
小屋：家具縮圖一律整數倍、不平滑（tt-room-kit/house-lobby/house-embed.js thumbOf；家具店框 136、佈置清單框 96，比框大的照 1 倍畫、object-fit:contain＋pixelated）；新手教學 lobby-ui/coach.js／coach.css（TTCoach.run(steps,{doneKey})，整片變灰、虛線圈呼吸、大廳同一套說明卡，Esc 略過、Enter 下一步）——第一次進小屋自動跑 6 步（房間、家具店、貓貓幣、佈置、縮放、回大廳），看過記 localStorage tt_house_tour_v1，右上新「教學」鈕可以再看；TTRoom.roomRect() 給教學圈房間。
上色（未改，等使用者挑）：82 件都是 11/04 定案的抖動版（tone4：SUB=3 近色豐富、少量抖動、玫瑰紫陰影、無白點與木紋）。對照圖 tt-room-kit/house-picker/上色對照_1106.png：A 現在／B 中間色少一點（T4_SUB=2）／C 只留 4 階＋交界抖動（T4_SUB=1 T4_RICH=0）／D 每個面平塗（GRAD=0 T4_SUB=1 T4_RICH=0），樣本在 bed/props/<名>_cmpA～D。
小屋後續（同日 D 再改）：家具店與佈置清單縮圖一律同一個比例（1 倍、不平滑，落地家具底部對齊，框 136）；房間背景改純漸層（像素晚霞天空先拿掉，house-lobby/house.css）；右側放大／縮小／整間拿掉（滾輪縮放、拖曳照用），「我的家具」改成右側整欄；拿起家具時旁邊的四顆按鈕拿掉，改鍵盤 R 轉向／Delete 收回／Esc 取消、點一下放好，大廳畫面最下面常駐一行白字操作說明（#ttHouseKeys，散步／佈置／拿著家具各一套；焦點在大廳時按鍵經 TTRoom.key 轉給房間）；新手教學拿掉縮放那步。
萬用系列 8 件改手工建模（D：Tripo 扶正後殘留歪斜，「冰箱不能是斜的」「請記得參考原設計」）：冰箱、流理台、爐台、浴缸（開口）、洗手台、格子櫃、三人布沙發・灰藍、雙人床・灰藍被，造型照 tt-room-kit/sets/R_basic/ref3/cells 原設計、尺寸照原 Tripo 外框、顏色沿用 Tripo 版材質（bed/set_props_R_fridge.py、set_props_R_t2hand.py；sets/R_basic/tripo2.json 拿掉這 8 件對應，props.tsv 補列；備份 bed/_backup_1106_tripo7、_backup_1106_fridge2）。量測（2 倍渲染法線圖，直立面應為 0°）：Tripo 版三人布沙發 3～4.5°、舊冰箱約 3°、爐台／雙人床／浴缸約 1°；手工版全部 0°。第一批 82 件現在全部是手工建模。
版本：verTag v495、lobby-view 495、live.css 495、bridge 495→tavern-ui index 495→時裝間比較 495→live-wardrobe 495、house.js／css 495（room.html?v=495）、coach 495。

## v494 小屋第一批家具（試做）＋日常系列用貓貓幣販售（需發布新規則）
使用者 11/06：小屋不一次全上，先出幾樣家具測試再慢慢推；第一批 82 件（酒館日常 41＋萬用系列 41，清單 tt-room-kit/house-picker/第一批上架.txt）；介面跟大廳同一套。家具「依精緻度區分價位、大型家具至少每日任務 3 天」，其餘價格與日常系列價格交給 Claude 訂；日常系列（犬尤畫的髮型四組、眼睛四組、上衣 A–D、下衣 A–C、套裝 A–B）改用貓貓幣買。
價格（貓貓幣；shopConfig 存金幣等值價，顯示與扣款 ×10）：家具＝大小×精緻度，小件 100／150／200、中件 150／200／300、大件 300／400／500（簡單／標準／精緻），逐件分級在 tt-room-kit/house-picker/第一批價格.txt；入住禮 4 件免費（木椅、單人床、方地毯、木框窗，第一次進小屋就擺好）。全部買齊 18,950。日常系列：髮型（前髮＋後髮）300、眼睛（眼睛＋眉毛）200、上衣 150、下衣 150、套裝 300（tavern-ui/daily-v494.js TTDailyPrices）。
小屋：右下新「小屋」鈕（手機功能首頁不開）→ 大廳場景換成自己的房間（house/room.html，iframe；名牌、設定照舊），右下改「佈置／家具店」，右上「回大廳」＋放大／縮小／整間。房間＝tt-room-kit 的小屋頁只留第一批家具與酒館日常外殼 14×14（tt-room-kit/house-lobby/build.py 產生 house/room.html、house/atl.png、house/catalog.json；家具或素材換了要重跑），晚霞像素天空＋浮空草地台沿用小屋試做頁，房間裡走的是自己的小人（drawDollTo）。佈置模式：下方「我的家具」清單（剩幾件）、點房間家具拿起、拿起時旁邊有 轉向／放好／收回／取消。家具店是 live.js 的 houseShopM（大廳同一套視窗），酒館日常／萬用系列、全部／地板／牆面。lobby-ui/house.js、house.css；window.TTHouse 給房間用、iframe 裡是 window.TTRoom。
資料：shopConfig/house:<家具>{name,price,cur:'cat',type:'小屋家具',active}（type 不是時裝、沒有 custom，不會出現在時裝間與店長商城清單）；購買＝同一次寫入 clientOrders（type shop、paidBy cat、itemId house:<家具>）＋cat 扣款＋catTx spend＋houseInv/<key>/<家具>/<訂單>{ts}（catSafety 鎖）；擺設 house/<key>{layout,at}，0.6 秒合併一次 set。
日常系列：tavern-ui/daily-v494.js 用當季時裝的草稿格式，每件一組（daily_hair_A…、daily_eye_、daily_top_、daily_bottom_（下身配件，z under）、daily_suit_），img/daily-v494/ 是繪師原檔；店長上架（shopConfig 同編號 custom、price、cur:'cat'）前客人看不到。tavern-ui-bridge.js：草稿上架時帶上 cur、商品帶 cur／daily、結帳 curPlan 帶 cur（payWithCoins 照 TTCat.forItem 付貓貓幣）、名稱「日常時裝・」。live-wardrobe.js：cur:'cat' 的商品標價用小硬幣（外層整段跳脫的地方用記號再換）、目前搭配／確認選購的需購買金額分金幣、貓貓幣。結帳提示與貓貓幣不足提示：兌換關著時改說每日任務每天送 100。
店長頁：新「貓貓幣商品上架」卡（cat-shop-import.js，商城分頁）一鍵新增日常系列 17＋家具 78 到 shopConfig，只新增沒有的、不覆寫，先下載備份；admin 載入 daily-v494.js；刪除角色一併清 house／houseInv。
規則第十一批（tests/security-rules-v428/build/harden-phase11.cjs，可重複執行；套用前快照 rules-before-v494.json）：houseInv 本人只能新增、同一次寫入要有本人的新訂單（itemId house:<家具>、paidBy cat、status done、amount ≥ shopConfig 價），不能改、不能刪，店員可刪（退款）；house 本人與店員讀寫，layout 每件只能是上架家具或入住禮、欄位與數字範圍限制。日常系列不用新規則（背包一般商品分支＋第十批 cur:'cat'）。test-phase11.cjs 25 項；run.sh 第 1～11 批全過（32／36／58／12／64／20／25／29／49／19／25）。本機預覽實際送出的寫入（買家具、存擺設、買日常上衣）在新規則下重播全部允許。
版本：verTag v494、lobby-view 494、live.js 494、bridge 494→tavern-ui index 494→時裝間比較 494→live-wardrobe 494。
上線順序：店長發布 security/database.rules.json → 推網站 → 店長頁按「上架貓貓幣商品」。貓貓幣兌換仍關著（EXCHANGE_ON=false），目前只能靠每日任務存。

## v493 付費商品改回金幣（更正 v492）
使用者 11/06：店內靠付費時裝回收繪師成本（幾十萬），v492 把時裝、寵物、座椅、染髮券、聊天氣泡、工房部件全改成貓貓幣是錯的——貓貓幣會白送（每日任務、活動），等於付費商品可以免費拿。正確分法：**付費商品一律金幣**；貓貓幣只用在小屋家具（混合 AI 流程可量產）與店長送的免費時裝（福利）。v492 已於 11/06 推上正式站，v493 修正前付費商品在正式站收的是貓貓幣。
網站：lobby.html payCurrency()／payWithCoins 只在商品標 cur:'cat'（TTCat.forItem）時付貓貓幣，目前沒有這類商品 → 全部走 v491 的金幣流程；coinsAvailable 回到 v491（只有貓貓幣商品略過儲值方案判斷）；聊天氣泡購買與手帳說明整段回到 v491（50 金幣、walletSafety）；布告欄「貓貓幣登場」改成「每日任務改送貓貓幣、付費商品照舊用金幣」。tavern-ui/live-wardrobe.js 整檔回到 v491（金幣標價）＋一行註解。lobby-ui/cat-coin.js：EXCHANGE_ON=false 錢包不顯示兌換（沒有能用貓貓幣買的東西，金幣換過去也換不回來），exchange() 與規則保留；錢包貓貓幣說明改「酒館送你的小心意」；live.js／mobile-app.js／guide.html 錢包文字改回金幣可買時裝。貓貓幣餘額顯示、每日任務 11/7 起送 100 貓貓幣、像素硬幣、名牌、手帳三格不變。版本鏈 cat-coin／live／mobile-app／bridge／tavern-ui index／時裝間比較／live-wardrobe 493、lobby-view 493、verTag v493。
規則第十批（tests/security-rules-v428/build/harden-phase10.cjs，可重複執行；套用前快照 rules-before-v493.json，需使用者發布）：clientOrders paidBy 'cat' 加上「shopConfig/<itemId>/cur == 'cat'」（shopConfig 只有店長能寫；背包 owned 本來就要求同一次寫入的新訂單，訂單擋下背包也拿不到）；染髮券拿掉第九批的貓貓幣 +1 分支，只收金幣。兌換、每日任務 11/07 起 100 貓貓幣、店長調整不變。之後上架貓貓幣商品（家具、免費時裝）：shopConfig 該商品加 cur:'cat'，網站 TTCat.forItem 也看同一個欄位（商城橋接要把 cur 帶進 plan）。新規則與 v492／v493 網站都相容（v492 的貓貓幣結帳會被整筆拒絕，不會扣錢）。
測試 test-phase10.cjs 19 項（貓貓幣買沒標的時裝／寵物／座椅／染髮券／工房部件／時裝部件、只寫訂單、客人自己標貓貓幣、同一次寫入先標再買都拒絕；標了貓貓幣的商品可買、少付與 catAmount 錯拒絕；金幣買時裝／寵物／染髮券／工房部件照常；店長標記與調整；11/07 起每日任務），舊規則下前六項全部放行；test-phase9 的 cloth9 改標 cur:'cat'、貓貓幣買染髮券改預期拒絕。run.sh 第 1～10 批全過（32／36／58／12／64／20／25／29／49／19），security-v428、base-parts-v434 用新規則通過。
測試：payment-safety-v273、chat-skins-v364、security-v428、base-parts-v434 換回 v491 版（金幣斷言）；payment-safety 補 TTCat stub 與 paidBy wallet 斷言；四個全過（後兩個用 v492 規則＋本機 emulator 9273）。本機預覽實際結帳熊熊偵探 350 金幣：wallet 1350→1000、paidBy wallet、貓貓幣不動、背包有；錢包無兌換、布告欄與氣泡說明正確。
v492 期間若有客人在正式站把金幣換成貓貓幣：店長頁名冊看貓貓幣餘額（11/7 前有餘額的都是兌換來的），可用「調整金幣／調整貓貓幣」退回。

## v492 雙幣制：貓貓幣（需先發布新規則）
使用者（11/05～11/06 拍板，見 C:\tinytavern\雙幣制規格書.md）：時裝類改用貓貓幣，金幣維持 1 金幣＝NT$1、只用在點冒險者／續單／併桌／會員；金幣可單向換貓貓幣 1:10（剛好 350 加送 200、剛好 1000 加送 1000，加送是提案值，要改同步 lobby-ui/cat-coin.js bonus 與 harden-phase9.cjs BONUS）；時裝價格 ×10；每日任務 2026-11-07 00:00（台北）起改送 100 貓貓幣（之前 10 金幣）；舊金幣不轉換；開幕禮 350 金幣不變（11/08 結束）。
資料：peiwan/cat/<key>/{balance,lastTx}、peiwan/catTx/<key>/<tx>{type:spend|daily|exchange|event|adjust|refund,amount,coin?,ref,note,ts}。時裝訂單 clientOrders paidBy 'cat'：amount 仍記「金幣等值價」（owned 規則照舊比價），catAmount＝amount×10 才是實扣。兌換＝同一次寫入 walletTx exchange −N＋wallet −N＋catTx exchange（coin N、amount N×10＋加送）＋cat 加同額，兩邊交易編號相同。
規則（tests/security-rules-v428/build/harden-phase9.cjs，可重複執行；套用前快照 rules-before-v492.json）：新增 cat／catTx（本人只能 spend／daily／exchange，店員可任意調整）；walletTx 加 exchange 分支；clientOrders 加 paidBy 'cat' 分支（只限 type shop、status done、catAmount＝amount×10、同一次寫入 catTx spend），paidBy 'cat' 不能走「待確認」跳過付款，金幣訂單不能拿 exchange 交易當付款紀錄；owned 時裝與染髮券接受 cat 訂單（染髮券多一條看 cat/lastTx 的分支）；dailyTask／wallet／walletTx 的每日任務依伺服器時間 1793980800000 切換金幣↔貓貓幣。
網站：lobby-ui/cat-coin.js（TTCat：餘額監聽 window.__cat、兌換、錢包區塊 mount、貓貓幣紀錄）；img/cat-coin-px48.png＋img/cat-coin-spin48.png（像素硬幣，見下方外觀）；payment-safety.js 加 currency（貓貓幣另一把鎖、紀錄鍵 tt_pending_payment_v1:cat:<key>）；lobby.html payWithCoins／renderCoinInfo／renderPayMethod 時裝類付貓貓幣，walletLookup 查不到訂單時改查同編號 walletTx exchange（兌換結果不明時的復原），聊天氣泡 500 貓貓幣，每日任務依 TTCat.dailyOn() 切換，布告欄新增「貓貓幣登場」，VIP 累積（vipSpent）排除 paidBy cat；live.js HUD 金幣＋貓貓幣並排（點一下開錢包）、錢包加貓貓幣區塊、訂單卡顯示貓貓幣；mobile-app.js 上方小卡與儲值頁同步；order-flow.js 結帳顯示貓貓幣；live-wardrobe.js 標價改貓貓幣（飲料、VIP 限定套組由伺服器收金幣，維持金幣）；admin.html 名冊／詳情顯示貓貓幣、「調整貓貓幣」鈕、貓貓幣訂單退款退回貓貓幣、VIP 累積排除 cat、刪除角色一併清 cat／catTx；guide.html 錢包說明。verTag v492、lobby-view 492。
外觀（使用者 11/06）：貓貓幣用「像素硬幣」——照犬尤原圖（C:/tinytavern/犬尤新部件/切好備用/金幣正面.png 貓臉、金幣反面.png 星星）描成 48×48：img/cat-coin-px48.png＝斜放、看得到厚度；img/cat-coin-spin48.png＝轉一圈 12 格（正面→側邊→背面→側邊，background-position steps(12)）。產生器 C:/Users/User/Downloads/tt-room-kit/coin3d/pixtrace.py（N=48，改色票或原圖要重跑；32 格版太糊，使用者嫌細節少）。TTCat.coin(size,mode)，class 前綴 nyan（避開大廳原本的 .ttc 確認視窗）；48 的整數倍才用 pixelated，較小尺寸整顆平滑縮小。名牌 32、結帳 32、手機小卡 18、價格旁 16 用 C＝斜放不動，貓貓幣增加時 data-cat-pop 的硬幣播一次轉圈＋跳一下＋冒星星（0.8 秒後拿掉 .pop 回斜放圖）；錢包大圖用 B＝48 一直轉。價格一律「小硬幣＋數字」（TTCat.tag，螢幕報讀唸「貓貓幣」），時裝間是 iframe 要先 TTCat.injectCss(document)；硬幣樣式加 !important（手機小卡、時裝間的 span／i 規則會蓋掉）。
名牌（使用者 11/06 第三版）：頭像框沒有底，旁邊接一條長白卡、只有兩行——第一行名字（超過 11 字省略），第二行「綁定 Discord」＋右邊 VIP 等級＋個人手帳圖示（只放圖示不寫字，SVG 書本）；金幣／貓貓幣直排在最右邊（虛線隔開）。白卡畫在 #hud2::after（z-index −1），左邊上下角收在頭像框底下；欄寬 152px auto auto（live.css 末段）。手帳個人頁三格改成 金幣／貓貓幣／圖鑑（成就拿掉，lobby.html bkTrio）。
沒改：寵物飲料、VIP3 第二套（api.tinytavern.tw 伺服器扣金幣）；首次儲值禮（金額未定）；小屋家具（未上線）。
測試：test-phase9.cjs 49 項（兌換三種方案、加送、竄改金額、只加不扣、金幣不足、幫別人、兌換扣款冒充付款／群組單、反向換回、貓貓幣買衣服／染髮券、少付、catAmount 不是 10 倍、待確認不付款、沒扣款、餘額不足、付陪玩單、直接改餘額、偽造收入、刪紀錄、讀取權限、店長調整、舊金幣流程、每日任務切換前後、沒有金幣紀錄用貓貓幣買／沒有貓貓幣紀錄用金幣買）；run.sh 加第九批，第 1～9 批全過。本機 RTDB emulator＋實際大廳頁面：兌換 350→3700、買時裝／染髮券／氣泡／工房部件／座椅、11/07 後每日任務 +100，頁面送出的寫入在正式規則下重播全部允許。payment-safety-v273、chat-skins-v364 改成貓貓幣流程並通過；security-v428、base-parts-v434 同步改成貓貓幣斷言，本機 emulator 通過。教訓：規則裡 child(null) 會讓整條規則失敗（不是只有那個分支）→ 用 lastTx 找訂單前先 exists()。
上線順序：先在 Firebase 主控台發布 security/database.rules.json（新規則相容舊網站），再推網站；兩者都要在 11/07 00:00 前，否則 11/07 起舊網站的每日任務會被拒。

## v491 VIP 優惠券改成回饋金幣（需發布新規則）
使用者：VIP1 送 150、VIP2 500、VIP3 800、VIP4 1200、VIP5 1500 回饋金幣，把優惠券改掉。每升一級送一次（跳級每一級都領），以店長頁確認的 vipServer 等級為準。
規則（tests/security-rules-v428/build/harden-phase8.cjs，可重複執行；套用前快照 rules-before-v491.json）：新節點 peiwan/vipGift/<key>/<1～5> {tx,at,amount}，本人與店員可讀；本人只能在 vipServer/<key>/lv ≥ 該等級、該等級還沒領過時新增一次，同一次寫入要有 walletTx（type vipgift、lv、amount 剛好該級金額、ref＝tx）＋ wallet.lastTx＝tx ＋ balance 剛好加該金額（沒有錢包時＝該金額）；walletTx 與 wallet.balance 各多一個 OR 分支。所有價格檢查中 v466 依 VIP 等級可折 30～200 的優惠券改為 0（38 處），帶 couponUsed 少付一律拒絕。金額改了要同步 lobby.html VIP_CFG.gift 與 harden-phase8.cjs GIFT。
網站：lobby.html VIP_CFG 每級第一項改「回饋金幣 N」（gift 欄位，cp／disc 歸 0）；couponsLeft() 一律 0（結帳不再出現優惠券勾選）；新增 TTVipGift：登入綁定後監聽 vipGift/<key> 與 vipServer/<key>/lv，有已達到未領的等級就逐級寫入，成功跳通知「VIP N 回饋：送你 X 金幣！」。背包「優惠券」改「VIP 回饋金幣」（已領金額、確認等級後自動存入）；闆卡手帳「優惠券」欄改「回饋金幣 已領 N」；升級慶祝文字、VIP 視窗說明、新手指南、訂單「優惠券與收藏」按鈕改字。錢包交易明細顯示「VIP 回饋」（電腦版兩處、手機 mobile-app.js 491）。live.js 491、mobile-app.js 491、verTag v491、lobby-view 491。
測試：test-phase8.cjs 29 項（各等級首次領、超過等級、重領、領過再領下一級、金額竄改、交易與紀錄不一致、只加錢／只寫紀錄、幫別人領、未登入、Email 帳號、沒有 vipServer、客人改 vipServer、讀寫權限、刪紀錄重領、店長調整、優惠券少付陪玩／時裝被拒、原價照常），第二、五批的優惠券成功案例改為預期拒絕；run.sh 加入第八批。網站以模擬資料跑 VIP 3 已領 1 級 → 自動補領 2、3 級共 1300、重複觸發不再寫。
上線順序：網站先上線無妨（規則未發布時讀不到 vipGift，不嘗試；優惠券已不顯示）；GitHub Actions 規則測試全過後，店長在 Firebase 主控台發布 security/database.rules.json。等級要店長頁開著同步 vipServer 後才會發放。

## v490 私訊送不出時講清楚原因
使用者：好友離線也要能留訊息（截圖：私訊貼圖顯示「貼圖未送出，請確認連線及好友狀態後再試」）。檢查程式與 v428 規則：私訊本來就不檢查對方是否在線（直接寫 dm／dmMeta，離線也收得到、上線看到未讀），舊提示的「好友狀態」容易誤會。lobby.html window.dmSend 每種失敗都回報原因（window.__dmFail＋提示＋console.warn('[dm] 未送出',代碼)）：私人房間、未登入、貼圖無法使用、禁言、非進階會員私訊冒險者、已不是好友、對方封鎖（原本無提示）、資料庫拒絕（登入狀態失效，請重新整理或用 Discord 再登入）、網路不穩。social-design.js 貼圖失敗改顯示同一原因。social-design.js 490、verTag v490、lobby-view 490。
真正原因尚未確認（需使用者再送一次看新提示）。

## v489 隨時保存闆卡圖片
使用者：客人問怎麼存自己的闆卡圖片（原本只有工房最後一頁能「保存闆卡」）。lobby.html window.ttSaveCardImage：自己的闆卡（pcSocialRender）在「編輯我的資料」旁加「保存闆卡圖片」；手機首頁訂單分頁的按鈕列加「存闆卡圖」（mobile-app.js 489）。按下後動態載入 card-ui/tavern-scene.js，用工房同一個 TTTavernCard.render（1280×1410，酒館門口地毯場景＋名字、@Discord、生日、常玩遊戲、標籤、一段話）以大廳 drawDollTo 畫目前穿搭，顯示預覽視窗：電腦按「下載闆卡圖片」（闆卡_名字.png），手機長按圖片存相簿。只讀自己的資料，不寫資料庫。
驗證：本機模擬資料桌機與 390 寬手機都產出 1280×1410 圖、預覽視窗與下載檔名正確；自己的闆卡按鈕為「編輯我的資料／保存闆卡圖片」。

## v488 跟隨寵物不穿牆
使用者：走到牆邊時寵物會穿牆，應該自動到另一邊。tavern-ui-bridge.js 玩家跟隨寵物定位：依寵物腳底位置（主人腳底＋layout 位移，左右各留 22px×縮放）以 TTScene.valid 檢查是否站在可走區，預設那一側站不下、另一側站得下時改站到主人另一側（寵物面向仍跟主人一致），回到空地自動換回；森林地圖不檢查。bridge 488、verTag v488、lobby-view 488。
驗證：本機大廳三個測試角色（右牆邊面左、中間、左牆邊面右）寵物位移分別為 −116／+116／+116px，牆邊兩位都換到空地那側。

## v487 私訊貼圖按鈕圖示
使用者：私訊視窗輸入列左邊的貼圖按鈕不對（只有一個小小的 ☺ 字元擠在框底、外面還有一圈淡紫框）。lobby-ui/social-design.js 改用大廳聊天貼圖按鈕同一個貼圖 SVG 圖示；theme-skin.css 改成與大廳聊天貼圖鈕相同的主題樣式（40px 方鈕、深藍框、白到淡粉漸層、粉色圖示，打開時粉底白圖示），只在鍵盤操作時顯示淡紫焦點框。social-design.js 487、theme-skin.css 487、verTag v487、lobby-view 487。
驗證：獨立測試頁截圖，圖示置中、與送出鈕同高。

## v486 三隻寵物正式名稱
使用者：桃的寵物叫鈴、蕪的寵物叫雪球、縭的寵物叫啵幽。tavern-ui-bridge.js companionPets：pet_bubu 布布→雪球、pet_guigui 鬼鬼→啵幽、pet_dengdeng 燈燈→鈴；商城商品名與寵物格名稱改為優先用 companionPets 名稱（shopConfig 裡的舊名不再蓋過，店長頁仍顯示舊名，可在店長頁自行改）。lobby.html 闆卡手帳寵物圖鑑名稱同步。bridge 486、lobby-view 486、verTag v486。
驗證：本機隔離商城寵物分類截圖顯示 雪球／啵幽／鈴／水晶龍／甜甜犬。

## v485 開店清資料後 Discord 登入找不回闆卡（變訪客、工房又說已經有闆卡）
客人回報：DC 登入後沒存到闆卡、DC 伺服器綁不進去；無痕重做又顯示這個 DC 已經做過闆卡。原因：清測試資料只刪了 peiwan 的闆卡，secureV1/members／owners 與 accounts/<ID>.myKey 舊紀錄還指向已刪除的闆卡；後端 account-claim 只要有 members 就回傳舊鑰匙（大廳顯示訪客，DC 身分組也判定未綁定），工房則因 lobby/<@username 鑰匙> 已有名字擋下重做。
後端（ops/deploy-v485.sh，security-v428；只替換 account-claim.cjs，核對主機檔案為 v466b 19f77a…或更早 fd0023…）：綁定的闆卡已不存在且有可認領的新闆卡（本機鑰匙或 keyFor(username)）時，先解除舊 members／owners 再走一般認領；候選順序 帳號紀錄 myKey → 本機鑰匙 → keyFor(username)，已不存在的闆卡跳過，某個候選認領失敗再試下一個；認領證據不變（帳號紀錄相符，或闆卡 dcid＝登入 username 且鑰匙＝keyFor(username)）。新增 account-claim-v485.test.cjs 11 項（舊程式 7 項失敗），v466 8 項照過；部署腳本已用模擬根目錄驗證替換與核對不符時停止。
網站：card.html 遇到已有闆卡時改呼叫 TTCardDiscord.recover（card-ui/discord-login.js 485）用剛才的 Discord 登入直接找回並回大廳；失敗才提示回大廳用 Discord 登入（拿掉「改成自己的 Discord ID」，欄位已自動帶入）。

## v484 甜甜犬商城縮圖縮小
使用者：甜甜犬太大，參考布布。商城縮圖依可見範圍填滿畫布，甜甜犬（54×40）在 112px 畫布顯得比布布大；shop-layout.css 把 pet_sweet 加入布布／鬼鬼的 82px 規則，兩隻畫出大小相同。大廳與試穿大小不變（與人物同像素密度，已比布布小）。版本鏈 shop-layout 484→時裝間比較 484→index 484→bridge 484→lobby 484、lobby-view 484。

## v483 遠端人物在下方走路一頓一頓
使用者：大家在下方走路卡卡的。原因：本人點地板走路速度隨深度變快（下方約 190px/s），v481 觀看端是「播完一段就停在終點等下一包」，追趕上限 200px/s 幾乎追不回來；封包間隔只要比上一段長，人物就會停一下再走（模擬網路抖動下 120px/s 約 10% 畫格停住）。lobby-ui/presence.js 改為追著目標走：依發送端時間 t 估走路速度、以送達間隔估落後量（約一個間隔），落後多就加快（最多 2 倍、上限 320px/s）、快追上就放慢（最低 0.35 倍）而不是停住；超過 1.3 個間隔沒收到新位置就恢復正常速度走完；停下（w=0）時以 max(速度, 剩餘/300ms) 走到最後位置。每幀仍最多算 50ms、舊封包不倒退、換地圖直接定位。模擬：停住畫格 120px/s 10.1%→1.4%、190px/s 1.9%→0，沒有暴衝畫格；落後量約多 20～30px。lobby.html presence.js?v=483、verTag v483、lobby-view 483。
驗證：presence-v353（穩定最大落後 23px）、presence-v354、movement-v278 通過。

## v482 399 系列寵物：水晶龍、甜甜犬（會動）
使用者提供兩包寵物素材（128px，為 64px 像素 2 倍）：水晶龍（走路 5 格、等待 10 格）、甜甜犬（走路 4 格、趴下 6 格、睡覺 4 格、趴下＋睡覺 11 格、原始靜態 64px）。img/pets-v482/：crystal-walk／crystal-idle／crystal.png、sweet-walk／sweet-lie（拿掉循環標記，只播一次）／sweet-sleep／sweet-rest（趴下＋睡覺，商城試穿用）／sweet.png（64→128 最近鄰）。
tavern-ui-bridge.js companionPets 加 pet_crystal／pet_sweet（src、still、anim），staffPetLayout 加 crystal／sweet（size 160＝與人物同像素密度、aspect 1、x -112／-100、y 34／36）；寵物框高改用 layout.aspect（舊寵物仍 112/96）。新增每 150ms 的狀態切換（只限玩家，不含冒險者 NPC）：主人走路（state 以 walk 開頭、未坐下）播走路，停下播待機；甜甜犬停下 4 秒後播趴下一次（1.3 秒）再循環睡覺，動了就回走路。商城縮圖用靜態圖，試穿用 src。live-wardrobe 寵物框高同樣讀 aspect。闆卡手帳圖鑑寵物加入兩隻。
上架：season-shop-import.js 新增 482（type 寵物、不需 seasonFeatured、每隻 399，檔案 img/pets-v482/products.json），店長頁按「載入寵物：水晶龍／甜甜犬（399）」→ 上架；shopConfig 有這兩筆後商城才會出現（資料庫規則照 shopConfig 售價檢查付款）。
驗證：本機隔離商城寵物分類、兩隻試穿畫面；大廳以兩個測試角色確認 待機→走路→停下 4.5 秒（甜甜犬趴下）→6 秒（睡覺）切換正確。版本鏈 lobby→bridge 482→index 482→時裝間比較 482→live-wardrobe 482、season-shop-import 482、lobby-view 482。

## v481 客人卡在高腳椅裡、遠端人物暴衝
使用者：客人被卡住（截圖：站在吧台高腳椅中間、被椅子蓋住）、人物暴衝。原因①：繪師遮罩只擋高腳椅的椅面與四支椅腳，椅腳之間有約 14px 寬的可走空隙（y 448～463），點地板或方向鍵會走進椅子底下，椅子圖層畫在人物前面、左右又被椅腳擋住，看起來卡住。lobby-ui/scene.js validInt 加上四張高腳椅整塊（x 670-749／803-881／935-1013／1067-1145 左右各多 3px、y 440～465）不可站；已在裡面的人會被 nearest 移到椅子下方。地圖連通檢查仍只有一塊、沒有走不出去的區域。原因②：觀看端以送達間隔的 0.8 倍播完一段（提早到、停一下、下一段再以最高 320px/s 追），走路看起來一衝一停。lobby-ui/presence.js 改為播滿實際送達間隔（上限 1200ms）、追趕上限 200px/s（本人走路約 150～180px/s）。presence-v353 第 10 行等待時間由 1300 改 1500（700ms 間隔現在會用 700ms 播完）。scene.js／presence.js 481、lobby-view 481。
驗證：scene-v265、movement-v278、presence-v353（穩定最大落後 15px）、presence-v354 通過。

## v480 背景音樂預設開啟、音量 20
使用者：背景音樂默認打開但小聲一點。lobby.html：tt_music 沒設定時視為開（!=='0'，關過的人維持關閉），預設音量 50→20（a.volume 0.2、兩個音量拉桿預設 20、tt_vol 沒設定時 20；自己調過音量的人照舊）。瀏覽器規定第一次點畫面或按鍵後才開始播。lobby-view 480。

## v479 每日任務加條件：大廳待滿 10 分鐘
使用者：每日任務條件再加大廳掛機 10 分鐘以上。lobby.html TTDaily：每 15 秒累計在大廳的時間（本機 localStorage tt_daily_stay_<key>_<日>，重新整理不歸零；每次最多算 70 秒，電腦睡眠回來不一次補；手機功能首頁 html.ttm-on 不計時），今天發言成功後記下訊息編號（tt_daily_chat_…），發言＋滿 600 秒兩個條件都達成才一次寫入 v475 的四個路徑（規則不變）。只發言還沒滿 10 分鐘時提示「再在大廳待 N 分鐘」；寫入被拒（記下的訊息已被聊天室清掉）時提示再說一句話。布告欄說明加上「並在大廳待滿 10 分鐘」。注意：10 分鐘只在網頁計時，資料庫規則仍只檢查發言與金額。lobby-view 479。
驗證：模擬資料庫跑 發言後才滿 10 分、先滿 10 分才發言、今天領過、昨天領過、寫入被拒 五種。

## v478 陪陪介紹卡（網站＋Discord 酒館居民）、商城目前搭配外掛框
使用者：三張陪陪介紹卡（縭／蕪／桃，繪師白露立繪＋PSD 原圖物件裝飾，製作檔在 /tmp/claude-0/cards）放到 Discord 酒館居民由機器人發，網站點兩下像素小人跳出自己的卡。
網站：img/staff-cards-v478/<rira|kabuki|momo>.webp（2400×1500）；lobby-ui/staff-card.js／.css（TTStaffCard.open(asset)，整站主題視窗、Esc／點外面關閉）；lobby.html makeStaff 加上點擊：300ms 內點兩下開卡（STAFF_GIF[cid].asset），點一下走過去。換人或換卡時更新圖片與版本號。
後端（ops/deploy-v478.sh，security-v428；主機目前已是 20261031-v467b，腳本以它為底，只新增 resident-cards 與 service-server 接線）：order-voice-bot/resident-cards.cjs：找名稱含「酒館居民」的頻道（不自動建立），發開頭說明（使用者確認文字：「這是我們首批迎接試營運的陪陪們～」、#酒館櫃檯 連結、前往酒館點單按鈕）＋依序三則「# 縭」「# 蕪」「# 桃」附介紹卡 PNG。記在 orderVoiceV1/residentV1 {channelId,ids,version}；任一則被刪或 VERSION 改變就刪掉自己發過的幾則、照順序重發（頻道其他訊息不動）；發到一半失敗會收回這次發出的訊息，2 分鐘後重試。人事變動：改 RESIDENTS／assets 圖片並把 VERSION 加 1。service-server.cjs 在 lounge 後啟動。測試 resident-cards 6 項；部署腳本核對主機 recruit-desk（8fe5f8…）、counter-desk（29ba6d…）、service-server（91e2dc…），已用模擬根目錄驗證替換與核對失敗時停止。
商城（使用者：目前搭配用橋接方式，像跟主框連上下桿子架出去的框，主框左右拉近）：桌面版主框寬度少 144px（拿掉中間清單欄），iframe 往右多 186px 透明區；目前搭配改 position:fixed 放在主框右外側（150px 寬），上下兩根桿子（::after）接回主框；整組往左 93px 置中，iframe 內置中對話框同樣往左 93px。試穿框改為 position:relative（迴紋針與白星原本以整頁右緣定位）。手機版不變。theme-shop.css、theme-window.css 478，版本鏈 lobby→bridge 478→index 478→時裝間比較 478、lobby-view 478。
驗證：本機隔離大廳 1685／1366／1024 桌面與 390 手機截圖（當季、頭髮、座椅、背包），點兩下三位冒險者各自開出正確卡片、Esc 關閉、點一下不開卡。
v478b 使用者：卡片視窗不用再加框（卡片本身已有外框）。staff-card.css 拿掉白紙框，只留卡片圖（淡陰影）、右上關閉鈕（z-index 在圖片之上）與下方白字提示；lobby.html 載入 staff-card.css?v=478b。
v478c 使用者：白邊還在（卡片圖本身外圍的點點底）。網站版卡片改成外圍透明（只留卡片、後方錯位紙頁與貼紙，繪師署名改白字），img/staff-cards-v478/*.webp?v=478c；staff-card js/css、lobby-view 改 478c。Discord 版圖片不變。

## v477 冒險者手札夜間模式字太深
使用者：冒險者說名字與很多字在夜間模式太黑，改淺紫色。原因：v412 整站主題只套白天（body:not(.dark)），之後新增的卡片、說明、名字等寫死深藍字，夜間深色底上看不清。新增 lobby-ui/partner-dark-fix.js（partner.html 最後載入）：只在 body.dark 時，找出深色底（含漸層第一色）上的深色文字（亮度皆偏低），改成淺紫 #DCD0FF；畫面變動時重新檢查（120ms 合併），切回白天還原原本的顏色（保留原本行內顏色與優先級）。淺色底（例如黃色提醒框）上的深字不動。
驗證：測試頁（深底深字→淺紫、黃底深字不變、淺字不變、漸層底深字→淺紫、切回白天恢復原色）。

## v476 冒險者手札不把大廳的 Discord 客人登入當成工作帳號
使用者回報：冒險者開手札跳出「請輸入邀請碼」，之後「陪玩 Discord 綁定」顯示「此工作帳號尚未開放綁定」。原因：同一個瀏覽器先在大廳用 Discord 登入（Firebase 身分 discord_…，同網域共用登入狀態），打開 partner.html 時 onAuthStateChanged 直接以客人身分 afterAuth，找不到 links 就跳出邀請碼框；輸入後客人帳號被綁成冒險者（links/discord_1383378428186595408 → 縭 -OxY7C，invites/T9FX81 usedBy 被占用），但後端 orderVoiceV1/staffAccounts 只核准原本的工作帳號 authUid，Discord 綁定回 PARTNER_ACCOUNT_REQUIRED。三位冒險者原本的工作帳號（Nh0dY1／nr95X3／tXb1ph）與 staffBindings 都還在。
修正：partner.html afterAuth 遇到 discord_ 開頭的身分直接略過，等使用工作帳號密碼登入（會換掉目前登入身分）再檢查。錯誤綁定的 links/discord_1383378428186595408 需由店長在 Firebase 主控台刪除（Claude 不刪資料）。

## v475 每日任務 10 金幣自動發放（需發布新規則）
使用者：布告欄的每日任務（每日登入打卡＋大廳發送至少一則訊息送 10 金幣）要自動發放（v471b 原本寫店長手動）。
規則（tests/security-rules-v428/build/harden-phase7.cjs，可重複執行；套用前快照 rules-before-v475.json）：新節點 peiwan/dailyTask/<key> {day,tx,chat,at,amount:10}，本人與店員可讀；day＝台灣時間第幾天（(now+8h) 整除一天），本人只能在今天還沒領過時寫入（舊紀錄 day 小於今天），chat 必須是 peiwan/chat 裡自己（key＝本人）今天（台灣 00:00 之後）發的訊息，同一次寫入要有 walletTx（type daily、amount 10、ref＝tx）＋ wallet.lastTx＝tx ＋ balance 剛好加 10（沒有錢包時＝10）。不能刪除紀錄重領、不能把 day 寫成明天。walletTx 與 wallet.balance 各多一個 OR 分支。
網站（lobby.html TTDaily）：登入綁定後監聽 dailyTask/<key>；大廳發言（含貼圖）寫入成功後，今天還沒領就一次寫入四個路徑，成功跳通知「每日任務完成！送你 10 金幣」；同一天之後發言不再寫。私人房間（TTRoomSession）的發言不在 peiwan/chat，不算。規則未發布時讀取被拒，不嘗試領取。錢包交易明細顯示「每日任務」（電腦版兩處、手機 mobile-app.js 475）。布告欄說明改「10 金幣會自動存進錢包（每天一次，以台灣時間計算）」。lobby-view 475。
測試：test-phase7.cjs 25 項（第一次領有／無錢包、今天再領、昨天領過今天領、領 20、加 100、改餘額、用昨天的訊息、用別人的訊息、沒發言、日期寫明天、今天領過寫明天、類型 topup、紀錄指向別筆、只加錢、只寫紀錄、幫別人領、未登入、Email 帳號、讀自己／別人／店長讀、刪紀錄重領、客人自己加 10、店長調整），run.sh 加入第七批。網站以模擬資料庫跑首次、昨天領過、今天領過、規則拒絕四種。

## v474 開幕禮改為自動發放
使用者：註冊就自動發放 350，不用自己按領取。lobby.html v472 開幕禮：登入並綁定闆卡、讀到 welcomeGift/<key> 不存在時，1.5 秒後自動以同一組四個路徑寫入一次（規則與 v472 相同，不需改規則），成功跳通知「開幕禮物：送你 350 金幣！」，信箱留一封已存入的信；自動寫入失敗（例如規則還沒發布）才顯示原本的「開幕禮物送到信箱囉」與信內領取按鈕。布告欄文字改「350 金幣會自動存進錢包」。lobby-view 版本 474。
驗證：語法檢查；以模擬資料庫跑自動領取（寫入一次、四個路徑、通知與已存入信件）與寫入失敗（不寫入、留信件按鈕與通知）。

## v473 閉眼不能選
使用者：工房眼睛選項的閉眼拿掉，那是眨眼動畫用的。card.html FIRST_HIDE 加入「閉眼」（工房眼睛只剩藍色銳利眼、棕色杏眼）；lobby.html 工房部件單買移除 base_face_4「閉眼」，背包／商城工房部件清單（baseList）與舊換裝間都不列名稱含「閉眼」的眼睛。眨眼動畫（_tpCE）照常使用這張圖。已經穿著閉眼的人資料不改，可到背包換眼睛。
驗證：大廳 TTBaseUnits 不含閉眼、__allBaseParts／__ownedParts 眼睛只剩兩款；工房（390 寬）眼睛選項只剩兩款。

## v472 開幕禮 350 金幣：信箱通知＋本人領取（需發布新規則）
使用者：註冊成功就跳出信件通知，從信箱領取 350 金幣（活動 11/1～11/7）；選「直接做完整版」。
規則（tests/security-rules-v428/build/harden-phase6.cjs，可重複執行；套用前快照 rules-before-v472.json）：新節點 peiwan/welcomeGift/<key> {tx,at,amount:350}，本人與店員可讀；本人只能在 now < 2026-11-08 00:00（台灣時間）且尚未領過時新增一次，必須同一次寫入 walletTx/<key>/<tx>（type welcome、amount 350、ref＝tx）＋ wallet/<key>/lastTx＝tx ＋ wallet/<key>/balance 剛好加 350（沒有錢包時＝350）。walletTx 與 wallet.balance 各多一個 OR 分支，原本的消費、店長調整規則不變。
網站（lobby.html）：登入且綁定闆卡、讀得到 welcomeGift/<key> 且不存在時，信箱多一封虛擬信「開幕禮物：350 金幣」（TTWelcomeInbox，與客服信相同的合併方式）並跳通知「開幕禮物送到信箱囉」；信內按「領取 350 金幣」以 ServerValue.increment 一次寫入上述四個路徑，成功後顯示已存進錢包並通知，失敗會重讀領取紀錄（已領就顯示完成）否則提示重試。規則未發布時讀取被拒，信件不出現、不影響其他功能。收起信件只在本次工作階段隱藏。錢包交易明細顯示「開幕禮」（電腦版兩處、手機 mobile-app.js 472）。布告欄開幕活動文字改為「信箱會收到開幕禮物，按領取」。
測試：tests/security-rules-v428/test-phase6.cjs 20 項（第一次領有／無錢包、領第二次、領 500、交易 350 但加 700、直接改餘額、只加錢、只寫紀錄、紀錄指向別筆、類型 topup、幫別人領、未登入、Email 帳號、活動結束後、讀自己／別人／店長讀、刪紀錄想再領、店長調整仍可用、客人自己加 350），run.sh 加入第六批。本機無法下載資料庫模擬器，規則測試需在 GitHub Actions（security-tests.yml，可手動執行）跑。網站流程以隔離模擬資料測過：信件出現、通知、領取後餘額 120→470、四個路徑寫入正確、重新載入後已領不再出現。
上線順序：網站先上線無妨（規則未發布時不顯示）；GitHub Actions 規則測試全過後，店長在 Firebase 主控台發布 security/database.rules.json。

## v471b 店長布告欄換成開幕公告
使用者：布告欄還有版權套（本週主打服裝寫死畫 cloth 1），開業前換內容。openBoard 改為「新店開幕慶祝」（11/1～11/7，台灣時間 11/8 00:00 後自動不顯示）、「每日任務」（每日登入打卡＋大廳發送至少一則訊息送 10 金幣；尚無自動發放，店長手動）與原本的「現在在店」；移除今日特典、本週主打服裝、活動公告與資料庫 board 舊文字。

## v471 闆卡資料隨時可編輯
使用者：資料卡讓客人隨時可以編輯。原本只有闆卡手帳裡的「編輯資料」（v205 bkEditInfo），且寫入沒等資料庫回覆就顯示「已更新」並重新整理頁面。自己的闆卡（pcSocialRender，點自己的角色）新增「編輯我的資料」按鈕，開同一個編輯視窗；儲存改為等 lobby 寫入成功才關閉並顯示「資料已更新」（cards 舊闆卡沒有資料時忽略），失敗保留視窗並提示（權限不足時請先用 Discord 登入），不再重新整理頁面（名冊監聽會自動更新名字）。欄位與限制不變：名字 10、一句話 20、遊戲 24、標籤 5 個、生日（皆在 v466 規則上限內）。lobby-view 版本 471。

## v467b 後端（待部署）：應徵表、櫃檯歡迎訊息發不出去
使用者回報：應徵小房間（🌙｜應徵-小玟）只有頻道開頭，看不到填寫資料。原因：Discord 訊息 nonce 上限 25 字，recruit-desk.cjs 用 'tt-recruit-'＋頻道 ID（共 30 字），送出被 Discord 拒絕（400），之後的通知也沒發；v464 起所有應徵都這樣（資料已存 orderVoiceV1/recruitV1/apps/<頻道>）。counter-desk.cjs 的 'tt-counter-'＋討論串 ID 同樣過長，櫃檯私人討論串的歡迎訊息與「結束這次詢問」按鈕沒貼出（討論串本身可正常聊天）。
修正（ops/deploy-v467b.sh，security-v428）：nonceOf(kind,id) 限 25 字；應徵表與補充問題抽成 postForm，送出成功後寫 apps/<頻道>/posted；啟動 15 秒後 backfill：posted 未設定的應徵記錄，房間裡沒有機器人的「應徵表」就補貼並通知店方，已有就只標記，房間已刪（404／403）標 posted=-1。新增 recruit-nonce-v467.test.cjs 3 項（對修改前版本 3 項皆失敗），recruit-desk 8、counter-desk 8 通過。部署腳本先核對主機 recruit-desk.cjs（cf2b34…）與 counter-desk.cjs（45761b…）。已移除已部署的 deploy-v466b.sh。

## v470 網站圖示換成線條吉祥物
使用者：原本的奶油杯網站圖示是 AI 做的（其他小圖示是購買的授權素材，保留），換成我們的線條吉祥物當 logo，可以加背景，下面用像素字寫酒館英文。使用者選定藍紫漸層底（與原圖示同色）＋ lobby-ui/assets/theme/brand-cat.png（內部填白、淡紫陰影）＋手繪 5×7 像素字「TINY TAVERN」（深藍字、白邊、粉色錯位陰影，整數倍放大不模糊）。覆蓋 icon-512.png、icon-192.png、apple-touch-icon.png；新增 favicon.png（64px，只有貓、線條加粗，分頁太小放不下字；全站一直引用 /favicon.png 但檔案原本不存在）。manifest 與各頁 apple-touch-icon 加 ?v=470 避免舊圖快取；admin／card／partner 的 apple-touch-icon 原本指向不存在的 favicon.png，改指 apple-touch-icon.png；lobby-view.html（電腦版實際開的頁）補上圖示連結。

## v469 開店前檢查：店長頁人物畫錯、客人文案、分享預覽、調整頁不上線
使用者：店長頁看闆卡還是有人魚套。原因：admin.html 第二個 drawDollTo（TEST_MODE）用白盒期的 tpPosed 取餘數（後髮／前髮／衣服 %3、眼睛 %2），衣服 4 畫成露亞裝 B、後髮 3 畫成露亞長髮、眼睛 2／3 畫成露亞／小莓眼，大部分客人都被畫成版權套。改為與大廳相同：部件編號就是款式、找不到不換別款；這個 drawDollTo 也先 TTRetiredOutfits.sanitize（v468 只加在被覆蓋掉的第一個）。驗證：Nasu、Ling、吉汪汪、P 與露亞穿搭在店長頁與大廳畫出相同部件（髮色漸層細節不同）。大廳闆卡本來就正確（已在正式站確認 Nasu 穿花箋髮＋綁帶牛仔套裝）。
客人文案禁用詞：大廳點單／預約／訂單／名簿／通知的「陪玩」「店員」改「冒險者」、「下單」改「點單」、「開始服務囉」改「成立囉」、「收乾淨」「請保持乾淨」改寫；冒險者沒填常玩遊戲時不再顯示「資料由陪玩本人更新中」，改「想玩的遊戲可以在點單時備註」。新手指南「虛擬角色陪玩酒館」「乾淨、無擦邊的陪玩服務」等句改寫。新手指南的手機說明更新為現況（手機是功能首頁：儲值、訂單、私訊、信箱；點單與大廳用電腦，原本寫轉橫式進大廳、直式可點單），連結 Discord 一步改為「做闆卡前先用 Discord 登入」。companion-achievements、order-voice、secure-login 錯誤訊息同步（版本 469）。manifest 說明改寫。
分享預覽：首頁 index.html（tinytavern.tw 本身）原本沒有 og 標籤，貼到 Discord 不會出現預覽圖；補上說明與 og-lobby.png。大廳說明文字移除「虛擬角色陪玩」。
不上線的舊頁：.github/workflows/deploy.yml 遠端工具不能寫入，改為 C:\tinytavern\清理舊頁面_v469.bat（v415 清單＋lobby_1、check、meow／wind-fx-preview），由使用者執行後把這些檔案移到 C:\tinytavern\_舊頁面備份_v469（不刪除），再 Commit + Push。avatar-crop-adjust（頭貼裁切尚未回覆）、outfit-studio（店長登入才可用）、kefu（停用說明頁）保留。
未改：lobby-ui/support-core.mjs 客服分類「訂單與服務」（可能是後端驗證用的值）；冒險者手札端文字。

## v468 版權測試時裝（人魚）不再畫出來
使用者：店長頁客人名冊還看得到人魚時裝（之前說的版權套）。原因：v357 只擋購買與換裝清單，還穿著露亞／小莓／星夜漫遊裝部件的舊穿搭照原樣畫；店長頁名冊優先用舊的角色快照圖。
lobby.html 在 bridge 之後包一層 drawDollTo：畫任何角色前先 TTRetiredOutfits.sanitize（換成可用的基本部件），大廳其他人、手機首頁、闆卡、手帳、商城預覽都套用；不改資料庫裡的穿搭。admin.html drawDollTo 同樣先 sanitize；客人名冊與客人詳情若穿搭含版權測試部件就不用舊快照、改畫整理後的穿搭。
驗證：大廳 drawDollTo 畫露亞前後髮／衣服／眼睛與畫基本款 3 號像素完全相同；店長頁內嵌程式語法檢查通過。

## v467 闆卡手帳圖鑑畫出時裝人物與特效、目前搭配底部按鈕
使用者：手帳圖鑑的熊熊偵探／龐克搖滾狼／喵頻連線／疾風喵行變成禮物盒；喵頻連線／疾風喵行應該有特效。原因：圖鑑只用 shopConfig 的 img，這四套沒有展示圖就退回禮物盒。tavern-ui-bridge.js 新增 TinyTavernUI.outfitDoll(id)（整套部件＋當季展示髮色，不含寵物）；lobby.html bkSlotHtml 沒有展示圖的時裝改畫 64px 人物（bkPaintOutfits），有綁定特效的套組用 TTOutfitFx 約 30fps 播放（手帳開著且卡片在畫面上才播；未擁有的灰階卡、減少動態設定只畫靜態）。畫不出來才退回原本圖示。
使用者：「已全部擁有」按鈕太下面、壓到外框。theme-shop.css 目前搭配底部留白 12px，停用按鈕改淺藍底深藍字。版本鏈 lobby 467、bridge 467→index 467→時裝間比較 467（theme-shop 467）。
驗證：隔離模擬資料（四套當季、持有熊熊偵探與疾風喵行）手帳圖鑑四套皆畫出人物、喵頻連線／疾風喵行掛上特效、未持有灰階；商城目前搭配底部按鈕不貼邊。

## v466c 試營運前檢查
線上檢查（店長身分唯讀）：config/basePricing 從未設定 → 工房部件單買整個沒開賣；已用店長頁「工房初始部件單買價格」表單填入使用者 v434 定的 頭髮100／臉50／衣服50／配件50。版權測試時裝 cloth0／cloth1／cloth_mslu9a8o 在 shopConfig 仍 active、價格 120（網站隱藏但資料庫會接受購買）。冒險者資訊卡：蕪沒有 staffCards、桃只有 busy／noBooking（客人看到的介紹與常玩遊戲是空的）；有一個冒險者帳號綁定到已不存在的角色（-P4rh_HgUEnDX7YS4pt7）。儲值方案 1000／320，皆無贈送。
規則（harden-phase5.cjs 第 7 段）：owned/<key>/<item> 新增購買時，版權測試商品（cloth0、cloth1、cloth_mslu9a8o、seat0～2 及其 :: 部件）一律拒絕，shopConfig/<item>/active 為 false 的商品也拒絕（店員／店長不受限）；聊天 t 容許比伺服器快 1 小時（原本 5 分鐘，客人電腦時鐘不準會無法發言）。第五批 64 項，GitHub Actions 全過。
頁面實測：card.html、partner.html、admin.html 無程式錯誤；大廳以店長 Email 帳號開啟時 /v1/voice/inbox 回 403（ACCOUNT_REQUIRED，店長不是客人也不是冒險者，非本次變更造成）。

## v466b 後端（待部署）：闆卡認領、店方通知、Discord 驗證限流
後端程式審查（以 security-v428 歷次部署包重建的快照）發現：①account-claim.cjs 以 lobby/cards 的 updatedAt「3 小時內」當作認領證據，且 updatedAt 不是建立時間——任何人知道尚未綁定的新闆卡鑰匙就能搶先認領；②handleMatches 比對 Discord 顯示名稱 global_name，任何人把顯示名稱改成對方 username 就能認領尚未用 Discord 登入過的舊闆卡。
修正（ops/deploy-v466b.sh，security-v428 分支）：認領證據只剩「accounts/<Discord ID>.myKey 已指向此鑰匙」或「cards/<key>.dcid 與登入帳號 username／ID 相同，且鑰匙＝keyFor(username)（與 card.html 相同算法 btoa(encodeURIComponent('@'+username)) 去 =+/）」；其他情況回 ACCOUNT_REVIEW_REQUIRED 由店長審核。order-notify.cjs clip 去掉 []()<>`| 避免客人文字在店方頻道變成假連結或提及。rehearsal.cjs：送 Discord 驗證前擋格式錯誤的憑證、全站 10 分鐘驗證失敗達 300 次暫停（避免 Discord 封鎖主機 IP），限流表滿時淘汰最舊（以前會擋所有人）。新增 account-claim-v466.test.cjs 8 項、notify-v466.test.cjs 1 項。部署腳本會先核對主機上三個檔案的 sha256 與預期相同，不同就停止不做任何變動；已用模擬根目錄驗證檔案替換與核對失敗時停止。
另有唯讀健檢 ops/check-v466.sh（只列印：更新、連接埠、防火牆、SSH、容器設定、設定檔權限、npm audit、憑證到期、Discord 登入驗證是否檢查應用程式 ID）。
審查其他待辦（未改）：vip-outfit.cjs 的購買對整個 peiwan 節點做 transaction（人多時容易 NOT_SAVED、流量大）；rehearsal 對整個 orderVoiceV1 做 transaction；member-roles 以整份身分組清單 PATCH 可能覆蓋管理員剛加的身分組；secure-social-v295/session-issuer.cjs 未在快照中，需確認有比對 application id。

## v466 資安第五批：名冊不公開、店長頁程式注入、儲值入帳金幣
線上實測（未登入、只讀）：v428 規則已生效，私人節點皆拒絕；但 lobby／pos／owned／chat／mutes 未登入可整包讀取，任何人都能下載全部客人的 Discord 名稱、Discord ID、生日與持有物。
規則（tests/security-rules-v428/build/harden-phase5.cjs，可重複執行；套用前快照 rules-before-v466.json）：①lobby／pos／owned／chat／mutes 只有已登入且綁定闆卡的客人與店員能讀；lobby/<key>/name 與 owned/<key>/baseStart 仍公開（工房與入口在登入前判斷闆卡是否存在）。②聊天：禁言中（until=-1 或未到期）資料庫直接拒絕發言（以前只在網頁擋）；欄位限 key／name／text（1～200）／map／t（不可寫到未來），name 必須等於自己闆卡名字。③闆卡 name≤40、quote／games≤120、tags 每個≤20、bm 0～12、bd 0～31。④lobby、cards、clientOrders、clientOrderProofs、reports、orderIssues、cancelReq、renewReq、mutes、walletTx、wallet、owned、pos 的紀錄編號只能是英數字、底線、連字號（以前可放引號在店長頁執行程式）；accounts 編號限數字。⑤pub/dcav 限「Discord ID/頭貼雜湊」、clientOrders coinAmount／amount 限數字、付款截圖限 data:image、orderIssues amount、accounts vip／spent 限數字。
網站：admin.html、lobby.html、partner.html、kefu.html 所有放進 onclick 的資料庫值改用 ja()（JSON 字串再 HTML 跳脫）；lobby／partner／kefu 的 esc 補上單引號（partner／kefu 原本只跳脫 <）；大廳闆卡 Discord 頭貼先驗證格式；店長頁付款截圖只顯示 data:image；VIP、金額欄位強制數字。
儲值入帳：店長頁原本照客人送出的 coinAmount 入帳（客人可改成任意數字）。改為 topupCredit()：依 config/topup 方案（amount 對應 amt＋bonus），客人送的數字不超過方案時照用，否則以方案計算，並在待確認卡片顯示「⚠ 金幣數被改過」。退款同樣使用。
card.html：未登入時只讀 lobby/<key>/name（新規則下整張闆卡不公開）。
v466b 優惠券與金幣訂單價格：原本優惠券只在網頁判斷，資料庫對任何人的 couponUsed 一律折 200（可無限次）；金幣付款的陪玩／會員／併桌單沒有價格下限（例如 1 金幣買尊榮會員且直接成立）。規則改為：①新節點 peiwan/vipServer/<key>/lv（0～5，只有店長能寫；本人與店員可讀），由店長頁依已確認訂單計算的 VIP 等級自動寫入（syncVipServer，開著店長頁時 3 秒內同步）；優惠券可折金額依此等級 30／50／80／120／200，未確認的等級不能用券。②金幣付款且非商品（shop）的訂單必須帶 plan，金額 ≥ 價目－可折金額：svc_<id> 讀 config/services/<id>/price、m1200／m3000／m5000、內建 val1／chat1 300、val2 600、seat 讀 tables/<itemId>/price，其他方案一律拒絕。網站：大廳 couponsLeft() 需 vipServer 等級 ≥ 網頁計算等級才顯示可用券；店長頁 VIP 改只依已確認訂單計算（不再採用客人網頁寫的 accounts.vip），轉帳單金額低於方案價時顯示「⚠ 金額低於方案價」。若之後改了會員方案價或新增內建方案，harden-phase5.cjs 的 PRICE 也要一起改。
測試：第五批 61 項（含金幣陪玩只付 1、1 金幣買尊榮會員、不存在的方案、非 VIP 用券、VIP 3 想折 200、客人／冒險者改 VIP 等級），第二批優惠券案例改為「店長確認的 VIP 5」、群組單帶上 plan；security-v428 金幣陪玩單改用價目表方案。GitHub Actions 第一～五批 32／36／58／12／61、security-v428、base-parts-v434 全過。
測試：GitHub Actions .github/workflows/security-tests.yml（分支 sec-ci/**，只測不部署；結果以標註回報，因本機無法下載模擬器）：第一～五批 32／36／58／12／42 全過，security-v428、base-parts-v434 通過。本機可執行的 13 個既有測試修改前後結果相同。
上線順序：網站可先上線（新舊規則都能用）；規則需店長在 Firebase 主控台發布 security/database.rules.json。

## v465 冒險者應徵面板上方放招募橫圖
使用者：自己做的「第二批陪陪招募」橫圖（2576×1450 JPG）讓機器人放在應徵面板文字最上面。recruit-desk.cjs：assets/recruit-banner.jpg 先發一則（tavern-recruit.jpg），面板在下一則；BANNER_VERSION 1，記在 recruitV1/panel（bannerId、bannerVersion）；換圖或任一則被刪就兩則一起重發維持順序，舊 v464 面板會被刪除重發。測試 recruit-desk 8 項。部署：主機當時已是 v464（使用者自行部署）。第一次 20261028-v465 測試失敗（圖檔權限 600，容器讀不到，EACCES），正式服務未變動；改 TAG 20261028-v465b 並 chmod 644 後部署，主機目前版本 20261028-v465b。腳本已從 security-v428 移除。
另做招募橫圖草稿與角色去背圖（/mnt/user-data/outputs），使用者最後用自己做的版本。

## v464 應徵小房間分類、櫃檯意見回饋
使用者：伺服器最下面開一個分類，入職申請的小房間都開那邊。recruit-desk.cjs：送出應徵後不再開討論串，改在「｡˙ ✦━━━━୨【🌙 應徵小房間】୧━━━━ ˙｡」分類（第一次需要時建立在最下面，@everyone 不可見，id 記在 recruitV1/category）開私人文字頻道「🌙｜應徵-稱呼」：@everyone 不可見、應徵者本人可看／發言／附檔（語音訊息沿用伺服器身分組權限）、TT 可發言，管理員本來就看得到；「結束應徵」改為本人改唯讀、改名「📦｜已結束-稱呼」，不刪除。v463 的舊討論串照舊封存。
使用者：櫃檯多一個意見回饋，直接上傳到店長網頁、不開房間。counter-desk.cjs：「💌 意見回饋」按鈕跳表單（想對酒館說的話 必填 1000 字、稱呼選填），送出寫入 peiwan/orderIssues（kind=feedback、source=discord、text、name、discordName、discordId、at；沿用店長／店員可讀的既有路徑，不需改資料庫規則），回覆「收到你的意見了」並通知店方頻道；60 秒冷卻。admin.html：「🚨 檢舉／回饋」分頁新增「💌 意見回饋」卡片（未讀／已讀、刪除），客訴卡片排除 feedback。
測試 recruit-desk 5、counter-desk 8，部署前 69 項通過。部署腳本 ops/deploy-v464.sh（security-v428）待執行。

## v462／v463 冒險者應徵頻道
使用者：伺服器多一個冒險者應徵頻道，要徵第二批陪陪，讓應徵者進伺服器應徵；表單內容與須知經使用者確認（需年滿 18；服務類型拿掉；「為什麼選擇小小酒館」改在房間回覆）。後端 order-voice-bot/recruit-desk.cjs：找不到名稱含「冒險者應徵」的頻道時在門口分類建立「📝｜冒險者應徵ᵒ」（@everyone 可看、不能發言、可在討論串留言；TT 可開／管理私人討論串）。面板：招募說明＋入職須知（年滿 18、專屬陪玩店、店長出形象立繪＋像素小人、角色形象著作權屬小小酒館僅限本店使用、合法登記公司）＋「我要應徵」。表單 4 格：稱呼、年齡、擅長遊戲與段位、自認陪伴風格。送出後開私人討論串（只有應徵者與店方），貼表單（未滿 18 標示警告）與補充問題（60 秒語音訊息自介、為什麼選擇小小酒館、可上線時段、語音環境、陪玩／直播經驗），以 ORDER_NOTIFY webhook 通知店方（不 @）。一人同時一份（再按給連結）、30 秒冷卻、串內「結束應徵」封存鎖定。記在 orderVoiceV1/recruitV1（open／apps／panel）。測試 recruit-desk.test.cjs 4 項。
v462 部署時 service-server 漏建立 recruit（插入條件判斷錯誤），健康檢查沒有檢查 RECRUIT_STARTED 而通過，期間互動在 recruit.handle 拋錯、揪團按鈕會失效（約 5 分鐘）。v463 補建立並在路由加保護，部署腳本健康檢查加入 RECRUIT_STARTED。部署 20261028-v463（Claude 於主機網頁主控台執行）：V463_DEPLOYED_AND_HEALTHY、RECRUIT_CHANNEL_CREATED、RECRUIT_PANEL_READY；腳本已從 security-v428 移除。

## v461 VIP 套組公開展示、訂單條碼不再跳動
使用者：商店 500 的兩套（喵頻連線／疾風喵行）消失了，先放出來給人看（還沒開始營業）。tavern-ui-bridge.js：vipOnly 套組對所有人列出（原本只有 VIP 3、已擁有或 ?preview）；未達等級者 vipLocked，卡片按鈕改停用「VIP 3 才能入手」（live-wardrobe.js），仍可試穿；免費領取與 500 金幣購買照舊由後端檢查 VIP 等級。
使用者：訂單票卡條碼一直在變化。lobby-ui/live.js identity()：原本以單號／訂單編號逐字產生最多 320 條，擠在 70px 寬的 SVG（preserveAspectRatio none），每條不到半個像素，縮放或重畫時邊緣一直跳動。改為對編號取雜湊、固定 6 段共 24 條（約 70 單位寬，每條約 1px），加 shape-rendering crispEdges；同一筆訂單條碼固定。版本鏈 live.js 461、bridge 461→index 461→時裝間比較 461→live-wardrobe 461。
驗證：語法檢查；本機資料庫模擬器無法下載，未做瀏覽器實測。

## v459 當季卡片播放時裝特效
使用者：商城當季卡片的疾風喵行／喵頻連線「怎麼沒特效」。原本特效只在試穿區、大廳、VIP 選擇視窗播放，當季卡片的 64px 人物是靜態。live-wardrobe.js：卡片人物畫好後（api.draw 回呼）若 api.fx.active 有綁定特效，保存底圖並啟動共用 seasonFxTick（約 30fps，每張卡片以 api.fx.render 疊特效）；卡片不在畫面上略過、減少動態設定（motion-off 或系統 prefers-reduced-motion）只畫靜態。版本鏈 lobby→bridge→tavern-ui/index→時裝間比較→live-wardrobe 改 460（459 在部署前被預先讀取而快取到舊檔，改號避開）。
驗證：語法檢查通過；本機 Database Emulator 這次無法下載（storage.googleapis.com 被擋），未做瀏覽器實測，需使用者在正式站確認。
宣傳配圖：/mnt/user-data/outputs/小小酒館-宣傳配圖.png／-動態.gif（1200×630，大廳背景＋主題紙卡＋縭蕪桃像素 GIF＋喵頻連線／疾風喵行／熊熊偵探／心動情人 3 倍、大廳同款待機壓扁回彈），使用者要求不放連結。

## v458 客人頻道開放、旅人私席限高級會員、酒館指南像素動態橫幅
使用者：大廳閒聊應該有任何旅人身分組都看得到；組隊揪揪／揪團佈告欄機器人限定；酒館小報、酒館居民只有店長與機器人發言（v456 已是如此）；酒館居民與認識冒險者合併（選 A，認識冒險者由使用者自行處理）；💎 旅人私席只給進階＋尊榮會員，本月特調會員只能看、小窩會員可聊天，少一個小窩要補；橫幅改像素 GIF。
server-layout.cjs VERSION 2：MEMBER_OPEN（大廳閒聊／創作與日常／旅人相遇處／大廳吧檯）與 旅人唯讀、櫃檯 即使原本私人也套用（其他私人頻道照舊不動）。member-lounge.cjs（新）：旅人私席分類 @everyone 不可見、進階／尊榮會員可見；本月特調會員唯讀；小窩會員可聊天；冒險者身分組以名稱辨認（含「冒險者」或縭／蕪／桃開頭）與 TT 可發言；補建「桃的小窩」；備份 orderVoiceV1/loungeV1/backup、做過一次記 loungeV1/applied。guide-channel.cjs：頻道導覽改「⭐ 酒館居民　認識縭、蕪、桃」；橫幅改 assets/guide-banner.gif（網站 img/companions-v352 縭蕪桃 staff GIF 2 倍、200ms×16 格，背景沿用主題橫幅），BANNER_VERSION 2 時兩則訊息刪除後依序重發。party-discord 附檔可指定 type。測試 member-lounge 4、guide-channel 6、server-layout 5，部署前 64 項通過。
部署 20261028-v458（Claude 於主機網頁主控台執行）：V458_DEPLOYED_AND_HEALTHY；LAYOUT_DONE ok=6 fail=0（旅人唯讀 2、櫃檯 1、旅人可見 3、未動 19）；LOUNGE_ROLES 會員=2 冒險者=桃MOMO、縭RIRA、蕪KABUKI；LOUNGE_MOMO_CREATED；LOUNGE_DONE ok=4 fail=0；GUIDE_POSTED。腳本已從 security-v428 移除。

## v457 酒館指南頻道（機器人建立）
使用者：酒館指南還沒做；rules 不是酒館指南，要用機器人做並附 PNG。內容與橫幅經使用者確認（「可以了發吧」）。後端 order-voice-bot/guide-channel.cjs：找不到名稱含「酒館指南」的頻道時，在門口分類 旅人報到 下方建立「📜｜酒館指南ᵒ」（@everyone 可看不能發言、TT 可發言／附檔）；發兩則訊息：①橫幅 assets/guide-banner.png（網站主題白紙深藍框＋粉色錯位紙頁＋縭／蕪／桃頭貼，標籤 店規／怎麼開始／頻道導覽）②四張說明卡（歡迎／店規六條／怎麼開始／頻道導覽，頻道以 <#id> 連結，用「陪陪」）＋前往酒館網站／新手指南按鈕。記在 orderVoiceV1/guideV1；VERSION 變更時編輯原訊息，訊息被刪才兩則一起重發。建立後重新整理旅人報到面板（連到新頻道）。party-discord request 支援自訂附檔名稱。測試 guide-channel.test.cjs 5 項，部署前 58 項通過。部署 20261028-v457（Claude 於主機網頁主控台執行）：V457_DEPLOYED_AND_HEALTHY、GUIDE_CHANNEL_CREATED、GUIDE_POSTED；腳本已從 security-v428 移除。
（v456 跳過私人客人頻道的問題已於 v458 處理。）

## v456 Discord 頻道權限整理（店規閘門）＋宣傳影片
使用者：DC 頻道還沒整頓好，你幫我把伺服器該用的用一用。後端 order-voice-bot/server-layout.cjs（只改權限，不改名、不搬移、不刪除；每頻道只調幾個權限位元，其他保留；動之前備份到 orderVoiceV1/layoutV1/backup；做過一次記在 layoutV1/applied，旅人身分組還沒建好時每 2 分鐘重試）：公開唯讀＝旅人報到／酒館指南／酒館小報／酒館居民／認識冒險者／認識陪陪（所有人可看、不能發言）；旅人唯讀＝揪團佈告欄／組隊揪揪；櫃檯（酒館櫃檯／呼喚店員）只關 @everyone 檢視；其他頻道與分類只開給旅人／闆卡旅人（語音含連線／說話）。原本就私人的頻道、機器人語音分類（DISCORD_VOICE_CATEGORY_ID／PARTY_VOICE_CATEGORY_ID）與門口分類本身不動；每個頻道先給 TT 自己檢視與發言，再關 @everyone，避免把自己鎖在外面；分類先改。測試 server-layout.test.cjs 4 項（含重複套用不再寫入），全部 53 項通過。部署 20261028-v456（含 v452，由 Claude 在主機網頁主控台執行）：V456_DEPLOYED_AND_HEALTHY，LAYOUT_DONE ok=10 fail=0（公開唯讀 4、旅人可見 6、未動 21＝原本私人或已符合），COUNTER／ROLES 面板就緒；部署腳本已從 security-v428 移除。
宣傳影片：使用者發文招人進 DC。以網站繪製程式（drawDollTo＋套組 set＋season-display 展示色）畫六套時裝，左右各三套貼在原影片兩側（1560×730，人物輕微彈跳），輸出 /mnt/user-data/outputs/小小酒館-陪陪與店內時裝.mp4。使用者：正式貼文用「陪陪」，不硬用冒險者；語氣要溫暖、多一點顏文字。

## v455 匯款資訊不顯示戶名
使用者：戶名不要寫。lobby.html 新增 payAccShown()（只取到帳號數字為止），電腦版付款資訊與儲值付款視窗的匯款帳號顯示與「複製」都改用它；手機儲值頁移除戶名列。PAY_ACCOUNT 原字串與店長設定不變。

## v454 手機版套用整站主題、儲值改為「選方案」引導
使用者：手機排版沒一體化；有人以為儲值金額可以自填（實際由店長決定）。新增 lobby-ui/mobile-theme.css（mobile-app.css 之後載入，只在 html.ttm-on 生效）：我的闆卡小卡、金幣、下方分頁、儲值各步驟改白紙深藍框＋淡藍內緣、粉色錯位紙頁、寶石編號（菱形）、粉色螢光標題底線、粉色主按鈕、深藍選中分頁。mobile-app.js 儲值第 1 步改「選一個儲值方案」＋虛線提示「儲值金額由酒館固定提供，不用自己輸入」，方案卡加單選圓點與「點我選這個／✓ 已選擇」（role=radiogroup）；未選方案前第 2～4 步變淡、不能操作並標「先選上面的方案」；第一次選方案後自動捲到第 2 步；金額列改「請先在上面選一個方案」、說明加「剛好轉帳這個數字」。送出流程、資料格式未改。驗證：390×844 模擬資料庫截圖（未選／已選／捲動），步驟 done 狀態正確。

## v453 冒險者手札：註冊綁定卡住、不接單時段存不了
使用者回報：桃「設定不接單時段」儲存失敗，登入手札出現「此帳號不是陪玩帳號」。原因：partner.html 註冊時 createUser 一成功就觸發 onAuthStateChanged→afterAuth，此時 links 尚未寫入，直接判定「不是陪玩帳號」並登出；接著寫入 links／invites.usedBy 時已沒有登入身分，被 v428 規則拒絕，Firebase 帳號留下但沒有綁定，之後每次登入都被踢出、重新註冊又說帳號名已使用。修正：註冊期間（registering）不讓 onAuthStateChanged 搶先檢查；註冊遇到帳號已存在時改用同一組帳密登入，再用邀請碼綁定（已綁定就直接進入）；登入後沒有綁定時不再直接登出，改為請他輸入邀請碼綁定（規則不變：邀請碼需有效、未使用、類型 char）。不接單時段儲存失敗時顯示錯誤碼，權限不足會說明是哪個角色的行事曆。

## v452 會員／VIP 身分組、酒館櫃檯分流、頻道檢查
使用者：都做；VIP 身分組文字周遭要有一點特效。
會員／VIP（member-roles.cjs）：只給已同意店規且綁定闆卡的人，各留最高一個，其餘自動拿掉。算法與網站相同（tiersOf）：VIP＝已確認儲值＋非錢包付款累計（3000／10000／15000／22000／30000，排除 testOnly）；會員＝31 天內已確認的會員訂單，planName 含 尊榮／進階／會員 → 3／2／1。到期、解除綁定自動收回。身分組以名稱辨認（含「基本會員／進階會員／尊榮會員」字樣、或「VIP 1～5」），店方可自行加裝飾；找不到時 TT 自動建立：「˚₊ 基本會員 ₊˚」「˚₊✿ 進階會員 ✿₊˚」「˚₊❀ 尊榮會員 ❀₊˚」、「⋆ VIP 1・迎賓 ⋆」「✧ VIP 2・熟客 ✧」「˚✦ VIP 3・常客 ✦˚」「₊˚✦ VIP 4・摯友 ✦˚₊」「⋆｡˚✧ VIP 5・貴賓 ✧˚｡⋆」，顏色同網站 VIP_CFG。伺服器有 ENHANCED_ROLE_COLORS（加成）時，只替 TT 建立的 VIP 身分組改漸層、VIP 5 全息（記在 orderVoiceV1/roleV1/created）。檢查改為每 10 分鐘；面板按「我綁好闆卡了」會立即更新並列出目前身分。同名重複的等級暫停發放並回報。
酒館櫃檯（counter-desk.cjs）：頻道名稱含「酒館櫃檯」（或「呼喚店員」）放面板：想了解服務／已有訂單需要協助／問題回報。按下開私人討論串（type 12、不可邀請），只加入該客人＋有管理討論串權限的店方看得到；同一人同時只有一個進行中的串（重按給連結），15 秒冷卻；串內「結束這次詢問」封存並鎖定。新串以 ORDER_NOTIFY_WEBHOOK_URL 通知店方頻道（不 @ 任何人），沒有權限時也通知。記在 orderVoiceV1/counterV1。櫃檯頻道權限由 TT 一次性自動設定（使用者：你幫我做）：旅人／闆卡旅人 允許檢視、讀取紀錄、在討論串中傳送訊息，禁止傳送訊息；TT 本身允許建立私人討論串、管理討論串（記在 counterV1/perms，失敗只回報 COUNTER_PERMS_FAILED）。
頻道檢查（channel-check.cjs）：啟動時列出 揪團佈告欄／揪團入口／揪團語音分類／訂單語音分類 目前指向的名稱（CHANNEL_CHECK），部署腳本會印出來。闆卡分享不在這個後端。
測試 member-roles 16、counter-desk 7（含頻道檢查、權限）、party／voice-open／staff-names 26、vip-outfit 6 全過。部署 ops/deploy-v452.sh（security-v428 cc519d6）。

## v451 Discord 新客人身分組「旅人」「闆卡旅人」（互斥）
使用者：剛進來的先給身分組；綁定闆卡的叫「闆卡旅人」（「冒險者」保留給縭／蕪／桃），兩個身分組不能同時擁有。改為全由機器人處理（不需開社群／新手引導）：「旅人報到」面板「我同意店規」給旅人（面板連到「酒館指南」頻道）、「我綁好闆卡了」換闆卡旅人；沒同意過（身上沒有旅人或闆卡旅人）的人，綁定闆卡也不給身分組。
後端 order-voice-bot/member-roles.cjs：身分組與頻道依名稱尋找（「旅人」「闆卡旅人」「旅人報到」，名稱要完全相同、各只有一個）；同步時讀最新成員資料，以一次 PATCH 寫入完整身分組清單（換上一個同時拿掉另一個，其他身分組保留），同一人同時多次同步會排隊。已綁定＝secureV1/members 啟用＋owners 相符＋大廳有闆卡名字。同步時機：①面板按鈕（只有本人看得到的回覆，5 秒冷卻）②網站 /v1/voice/session 登入成功後（不等待、不影響登入）③每 20 分鐘檢查所有已綁定帳號（網站先綁定後才進群、或重新入群又被給旅人的人）。不需要 GUILD_MEMBERS 特權。面板不置頂，記在 orderVoiceV1/roleV1/panel。身分組還沒建好時每 2 分鐘重試。
需要店方：建立兩個身分組、機器人要有「管理身分組」且角色排在這兩個之上；酒館門口分類所有人可見，其他頻道只開給旅人與闆卡旅人（換成闆卡旅人時旅人會被拿掉）。
測試 member-roles.test.cjs 12 項；party／voice-open／staff-names 26 項、vip-outfit 6 項通過。部署 20261028-v451（使用者回報完成），部署腳本已從 security-v428 移除。

## v450 VIP 3 另一套改由伺服器收費（免上架）
使用者選擇「不用上架」方案。後端 vip-outfit.cjs 新增 body {buyId,requestId}：伺服器重新計算累積支持（≥15000）、必須已免費選過一套、買的是另一套且尚未持有，餘額 ≥500 時在 peiwan 節點 transaction 一次寫入：扣 500、wallet.lastTx、clientOrders/vipbuy_<requestId>（type shop、paidBy wallet、status done）、walletTx、owned（ref 指向訂單）。同一 requestId 重送不重複扣款，同時送出只成立一筆。補上 v445 的已知限制（VIP 3 才能買改由伺服器把關）。測試：vip-outfit.test.cjs 6 項、vip-outfit.emu.test.cjs 5 項（含併發、餘額不足、非 VIP 3）。部署 20261028-v450，已通過健康檢查（V450_DEPLOYED_AND_HEALTHY），部署腳本已從 security-v428 移除。
網站：bridge 對 vipOnly 一律 price 500、sale false（不走一般結帳，目前搭配會列為不可結帳），新增 vipBuyable；商城列表改為 sale 或 vipOnly 皆顯示；商城卡片「購買整套」與選擇視窗「用 500 金幣購買」→確認→呼叫後端（重試沿用同一 requestId）。店長頁不需再上架這兩套（products.json／匯入器保留但不用）。

## v449 疾風喵行特效定案
使用者選定 {"windFx":["滑板殘影","風鏡反光","貓尾星光","哈白霧","風雪"]}：outfit-fx.js 移除翅膀氣流（晴空小翼）與風痕線條（逐風機能外套）綁定，其餘不變。

## v447 疾風喵行特效（含風雪）
使用者：不要再叫他操作，由我直接挑。tavern-ui/outfit-fx.js 加入疾風喵行綁定：冰藍風鏡→風鏡反光、藍軌滑板→滑板殘影（畫在人物後）、晴空小翼→翅膀氣流、墨影貓尾→貓尾星光、逐風機能外套→風痕線條、夜行貓耳帽→風雪（使用者提議「偽裝下雪」：細雪被風斜吹飄下，偶有大雪花）＋哈白霧（使用者：哈一口熱氣；每 3.4 秒從嘴邊往側邊飄出一團白霧，位置依眼睛部件推算；BIND 支援一個部件多個特效）。商城試穿、大廳、VIP 選擇視窗共用。wind-fx-preview.html 加入風雪、預覽也套用帽子遮髮。匯出 GIF /mnt/user-data/outputs/疾風喵行-特效-深色底.gif。

## v446 夜行貓耳帽遮髮
使用者：戴這頂帽子時，超出帽子的頭髮都蓋掉，只留帽口露出的部分。部件旗標 hairClip:true（season-v293.js acc6）；lobby.html drawDollTo 的前髮／後髮層在戴著 hairClip 部件時以帽子範圍遮罩（每列帽子最左到最右，扣掉從上方露天連通的透明區，例如兩耳之間）destination-in 裁切。大廳、試穿、快照共用。已用網站繪製程式檢查 9 種髮型（/mnt/user-data/outputs/夜行貓耳帽-遮髮版.png）。

## v445 VIP 3 專屬時裝二選一（喵頻連線／疾風喵行）
使用者：兩套改為 VIP 3 獎勵；達到 VIP 3 時問要選哪一套（二擇一，免費）；另一套只有 VIP 3 在商城看得到，整套 500、不拆賣；VIP 3 系列要有動態預覽。
後端（order-voice-bot/vip-outfit.cjs，路由 /v1/voice/vip-outfit；secure-social-v295/server.cjs 路由白名單同步加入。已於 20261028-v445b 部署並通過健康檢查——第一次 v445 因白名單漏加回 404、自動還原）：Firebase 登入本人＋secureV1 綁定；伺服器以 clientOrders（myKey＝本人、confirmed/done、topup 或非錢包付款，排除 testOnly，與網站 vipSpent 相同）重新計算累積支持，滿 15000 才可領；owned/<key> transaction 寫入 vip3Outfit {id,at} 與該套 {vip:3,at,name}，每張闆卡只能領一次、同時送出兩個請求只會成立一套。body {} 回傳狀態。測試 vip-outfit.test.cjs 5 項、vip-outfit.emu.test.cjs（真實模擬器、併發）2 項。
網站：lobby-ui/vip-outfit.js（TTVipOutfit）選擇視窗——兩張動態預覽（人物＋時裝特效＋待機）、選這套→確認「選了就不能更換」→呼叫後端；升上 VIP 3 時與之後每次登入（每個工作階段一次）未選者自動跳出。VIP 頁 VIP 3 卡片「VIP 專屬時裝」改為兩個動態小預覽與「選擇我的 VIP 時裝」。草稿加 vipOnly:3、noParts:true：bridge catalog 只對 VIP 3（或已擁有、?preview）列出；未選者商城卡片顯示「VIP 3 免費領取」開選擇視窗；noParts 不產生部件單買（目前搭配自動以整套計價）。products.json 兩套改 500、vipOnly、noParts，匯入器價格 500。season-display.js 寫入疾風喵行展示色、大廳也載入（選擇視窗用）。order-voice.mjs 加 vipOutfit 與錯誤訊息 VIP_LEVEL_REQUIRED。
疾風喵行特效預覽 wind-fx-preview.html（八種：風痕線條、滑板殘影、風鏡反光、翅膀氣流、風中葉片、腳下旋風、貓尾星光、疾速殘影），待使用者挑選後接入 outfit-fx.js。
已知限制：VIP 3 才能買另一套只在網站端判斷（資料庫規則仍只檢查付款 ≥ 500）；免費領取由後端把關。

## v444 疾風喵行（預覽）
season293_wind（tavern-ui/season-v293.js，img/season-v293/wind 原圖 13 張，名稱依使用者對照表）：cloth＝夜藍無袖裝、acc3 逐風機能外套（外套）、acc4 疾行手套（手套）、翅膀／貓尾背飾、鏡帶→貓耳帽→風鏡依 drawOrder 疊在前髮上、滑板手持。hideUntilLive，上架前只在 ?preview 顯示。season-display.js 預設展示色、season-color-adjust.html 加入（預設選取）。products.json 與匯入器 293（暫定整套 400，待使用者確認）。全部單買 530（未含特效）。

## v443 喵頻連線特效（商城試穿）
使用者選定五種（meow-fx-preview.html）：護目鏡掃光、訊號盒光點、電線資料流、故障閃爍、數字飄字。依使用者「特效綁定物件、穿上即觸發」：幻彩視界→掃光、浮游訊號盒→光點、喵訊連接線→資料流、喵訊接收耳→故障閃爍、環音耳機→數字飄字（tavern-ui/outfit-fx.js，BIND 可改）。商城／背包試穿區（live-wardrobe.js drawPreviewIdle）每幀把特效畫在 64px 角色上再放大；減少動態設定時不播。大廳場景尚未顯示特效。另匯出 GIF（深色底／透明底，400×400、40ms、7.6 秒一輪）給使用者。
大廳（使用者：要讓其他人也看到）：lobby.html setFrame 記下底圖 a._fxBase（眨眼改畫在暫存畫布），新增約 30fps 的 fxTick，穿著綁定部件的角色（自己與其他玩家，依 doll.uiAccessories）每幀在自己的 64px 畫布疊特效；系統減少動態、輕量特效模式、角色不在畫面上時不播。
價格（使用者：有特效的物件 +30）：season-v292.js 與 products.json 加 partPrices {acc2,acc3,acc4,acc6,acc7: 60}（鍵名與資料庫規則 partPrices/accN 相同，上架後規則會擋低價）；bridge partPrice 先讀單一部件價（accN）再讀類別價；草稿 partPrices 與店長 shopConfig 合併。店長頁拆件同步顯示。喵頻連線全部單買 660。若配件基本價改了，特效部件價需另外調整。

## v442 喵頻連線展示配色、上架檔
特效預覽頁 meow-fx-preview.html（只預覽，未接進大廳）：十種科技感特效（護目鏡掃光、訊號盒光點、電線資料流、耳機呼吸燈、故障閃爍、全息掃描線、腳下訊號環、頭頂訊號波、環繞資料方塊、數字飄字）單獨與組合預覽，以 64px 角色＋80px 畫布逐像素繪製，選好複製 JSON 給我。
season-display.js 寫入使用者匯出的喵頻連線展示色（主色 #b7e6de、髮尾 #a9d4ea、背景跟隨髮色）。img/season-v292/products.json（350 金幣、13 部件為網站原圖網址，含拆件部位資訊）；season-shop-import.js 支援單套一季（292），按鈕「載入本次套組：喵頻連線」。店長頁商城縮圖 img/season-v292/meow.png（商城實際繪製 64px 放大 256）。部件價格使用者定：頭髮 100／臉 100／衣服、下身、外套、手套各 50／配件 30（需店長頁儲存）；全部單買合計 510。

## v442 喵頻連線展示配色、上架檔
season-display.js 寫入使用者匯出的喵頻連線展示色（主色 #b7e6de、髮尾 #a9d4ea、背景跟隨髮色）。img/season-v292/products.json（整套 400 金幣、13 部件為網站原圖網址，含拆件部位資訊）；season-shop-import.js 支援單套一季（292），按鈕「載入本次套組：喵頻連線」。店長頁商城縮圖 img/season-v292/meow.png（商城實際繪製 64px 放大 256）。部件價格使用者定：頭髮 100／臉 100／衣服、下身、外套、手套各 50／配件 30（需店長頁儲存）；喵頻連線全部單買合計 510。

## v441 喵頻連線（預覽）、時裝衣服依原檔拆件
喵頻連線（season292_meow，tavern-ui/season-v292.js，img/season-v292/meow 原圖 13 張）：名稱依使用者提供對照表；護目鏡為面部配件、外套獨立。hideUntilLive：店長上架（shopConfig 有效售價）前只在 ?preview 網址顯示，客人看不到。season-display.js 預設展示色，season-color-adjust.html 加入喵頻連線（預設選取）。
拆件（使用者：以原檔分商店類別）：新增配件部位 bottom 下身（z under：身體與衣服之間）、outer 外套、glove 手套（z over：衣服之上、眼睛之下），商城列在「衣服」分類並有 全部／衣服／下身／外套／手套 子分類。熊熊偵探 cloth＝偵探套裝＋acc9 偵探披風；龐克搖滾狼 cloth＝上衣＋acc7 褲子＋acc8 手套，eye＝狼眼＋acc9 狼眼疤痕（面部配件）；心動情人（tavern-ui/outfit-splits.js 覆蓋 shopConfig）cloth＝花襯衫＋acc5 下褲＋acc6 披風＋acc7 披肩；中華小惡魔早已拆好（v287）不變。整套外觀與拆件前逐像素相同。
持有：splitFrom 標記——買過舊「衣服」（或「臉」）單位或整套者自動擁有拆出部件。舊穿搭（uiAccessoryVersion<441 或整套 set）自動補上拆出部件，外觀不變；新保存版本 441。
價格：config/partPricing 新增 bottom／outer／glove（店長頁「時裝部件單買價格」，使用者定 外套 50／手套 30；下身未定，未設定前不開放單買）。資料庫規則對 ::accN 仍以配件價（30）為下限。店長頁拆件顯示網站最新部件。
驗證：本機 Emulator 試穿三套、衣服子分類、舊穿搭補件與新格式逐像素相同、心動情人拆件前後相同、持有與標價、預覽／客人可見性；wardrobe-state-v276、dye-v230 通過。

## v440 背包隨時換膚色、Discord 伺服器連結
背包（live-wardrobe.js 色票區）新增「膚色」四色，選了立即保存（bag 模式走 saveBag→wear）；tavern-ui-bridge.js makeDoll 支援 color.skin（0～3，SKINS），state() 帶 skins。商城試穿不顯示膚色。全站 Discord 邀請連結 discord.gg/aK9GFarxm 改為 discord.gg/sw95eYeJ2P（大廳、新手指南、訂單、客服）。版本鏈 bridge／tavern-ui index／時裝間比較／live-wardrobe 改 440。

## v439 入店歡迎卡一體化
#intro 套用與登入卡相同的整站主題（白紙深藍框、粉藍錯位紙頁、粉色主按鈕）；文案「陪玩小酒館／店員／想被陪玩」改為冒險者用字；本機已有闆卡（tt_me）時隱藏「先做一張闆卡進來玩」，剛做好闆卡進大廳不會再被叫去做卡。
實測（使用者）：v438 工房 Discord 登入自動帶入、做卡後進大廳免再登入、店長頁客人名冊顯示 Discord 已綁定。

## v438 闆卡工房用 Discord 登入自動帶入帳號
card.html：原本客人自己打 Discord ID（未驗證，打錯就要店長人工審核）。改為進工房先用 Discord 登入（card-ui/discord-login.js，沒有登入過會先跳出登入卡，避免做到一半跳走造成造型遺失）；Discord 欄位自動帶入 @username 並鎖定，可「換一個帳號」。dc.html 新增工房分支（sessionStorage tt_card_login_v438）：只取回 Discord 帳號存 tt_dc，憑證暫存本分頁 tt_dc_token_v438 後回工房。做好闆卡（大廳資料寫入成功）後立刻以 TTSecureLogin 綁定新闆卡，進大廳免再登入、也不需店長審核；綁定失敗時大廳入口照舊請他登入。闆卡鑰匙算法不變（仍由 @username 算出），伺服器認領條件不變（闆卡 Discord 名稱與登入帳號相符）。
驗證：本機以模擬資料載入工房，已登入時欄位帶入且唯讀、未登入時先顯示登入卡；真實 Discord 授權需使用者實測。全部測試結果與修改前一致。

## v437 店長頁翻新（淘汰白盒期功能）
角色名冊：蕪／縭／桃改用繪師正式立繪頭像（tavern-ui/assets/avatar-KABUKI／RIRA／MOMO.png，依角色 ID），不再用白盒期 img/dog-*.png 與 emoji，名稱顯示店內名稱；委託總覽、月結同步用正式頭像。
客人名冊：大廳新增 lobby-ui/avatar-snap.js，穿搭改變時以大廳同一套繪製（TTCharacterSnapshot，含當季套組、染髮、配件）輸出 64px 圖存到 cards/<key>/snap（本人寫、只有本人與店員能讀，不在公開大廳資料），店長頁客人卡片與詳細資料優先顯示這張；沒有快照（客人尚未回大廳）才用店長頁舊的簡易繪製。不需改資料庫規則（已在模擬器確認本人可寫、他人不可寫、未登入不可讀、店長可讀）。
商城：時裝展開後新增「拆件」——依客人商城的購買單位（頭髮＝前髮＋後髮、臉＝眼睛＋眉毛、衣服、每件配件）顯示合成縮圖、部件名稱與單買價（商品 partPrices 或 config/partPricing）；舊的繪師部件上傳／微調收進「進階」。編輯區封面也使用當季展示圖。寵物分類拿掉「大廳效果製作中」。
淘汰：灰階髮型上色測試、白盒期內建寵物（小史萊姆／圓滾貓／醬料小雞，只從店長清單隱藏，資料保留）、客服派單（入口隱藏，kefu.html 顯示已停用說明）。帳號綁定審核改為只在「客人」分頁顯示。併桌保留不動（使用者：要保留，尚未開發完成）。

## v436 店長頁熊熊偵探／龐克搖滾狼縮圖
以客人商城實際繪製的當季卡片人物（含展示髮色）擷取 64px 預覽，放大為 img/season-v291/bear.png、wolf.png（256px，最近鄰）。admin.html 商城卡片與放大檢視在 shopConfig 沒有 img 時改用這兩張；客人商城不變。

## v435 店長頁商城清單不列版權測試套
admin.html 商城清單以 lobby-ui/retired-outfits.js 過濾：露亞經典裝（cloth0）、小莓甜心裝（cloth1）、星夜漫遊裝（cloth_mslu9a8o）與預想座椅蘑菇凳／絨布沙發椅／吧檯高腳椅（seat0～2）不再顯示。客人端早已停用（v357／v373）。只隱藏，不刪資料：shopConfig 與已購買紀錄保留。

## v434 合併桌機 v421（工房初始部件單買）＋資料庫規則第四批
桌機 v421（分支 v421-desktop，以 v420 為底）合併進 v433：lobby-view／lobby／admin／tavern-ui-bridge 的版本號衝突改為 434，tavern-ui-bridge 採 v421 的工房部件結帳名稱；v428～v433 的資安、手機版、取消原因、店內名稱全部保留。
v428 規則下 v421 無法運作（工房部件單買被價格檢查擋下、新闆卡的 owned/<key>/baseStart 被擋 → 新玩家會被當成舊老闆、初始部件全免費）。security/database.rules.json 第四批（tests/security-rules-v428/build/harden-phase4.cjs）：owned/<key>/base_<hair|face|cloth|acc>_* 依 config/basePricing/<kind> 檢查付款金額（未設定不能買，VIP 優惠券同樣最多折 200）；owned/<key>/baseStart 只在大廳尚無這張闆卡時可建立一次，欄位限 back/front/cloth/face/brow（0～99 整數）與 at，不能修改，店長可修正。已知限制：新玩家若刻意不寫 baseStart，會被當成舊老闆（初始部件全免費），價值有限，未強制。
驗證：test-phase4.cjs 12 項（同時列出舊規則結果：舊規則連正常購買與建卡紀錄都拒絕）、第一～三批 32／36／58 全過；tests/base-parts-v434.cjs 以真實 Emulator＋大廳 payWithCoins 驗證工房頭髮 100 金幣結帳成功、竄改價格整筆被拒、新闆卡可寫 baseStart、舊闆卡不能補寫；security-v428 通過；全部測試與合併前一致（多出新測試）。
上線順序：①店長在 Firebase 發布新規則 ②合併到 main ③店長頁「工房初始部件單買價格」填 頭髮100／臉50／衣服50／配件50 並儲存。

## v433 機器人訊息「陪玩」改「冒險者」
後端（20261027-v433）：Discord 訂單成立通知、語音房通知、站內信箱與店長新訂單通知的「陪玩」改為「冒險者」（欄位名稱、等待接單說明、指定冒險者）；給冒險者的語音房通知改「你有一筆新的預約」。訂單資料裡沒有名字時的預設值（陪玩／接單陪玩／陪陪）顯示時一律換成「冒險者」，資料與訂單版本不變，不會重發通知。揪團須知（party-model／party-ui）的「並非本店的付費陪玩服務」為服務說明，未改。網站 staff-names.js 同步把陪陪／接單陪玩顯示為冒險者。
驗證：後端 staff-names.test.cjs 檢查通知不含「陪玩」、含店內名稱與「指定冒險者」；party 18、voice-open 5 全過。v432 後端已於 20261027-v432 部署並通過健康檢查。

## v432 手機版改為功能介面、取消原因、預約確認、店內名稱
手機版（觸控裝置，lobby-ui/mobile-app.js／mobile-app.css，只在 html.ttm-on 生效，電腦版不變）：不顯示大廳場景與像素小人；上方「我的闆卡」小卡（頭像、名字、金幣），下方分頁 訂單｜私訊｜儲值｜信箱。訂單、私訊、信箱直接沿用既有視窗（shopM4、frM、mailBoxM），固定在小卡與分頁之間並拿掉電腦版裝飾；付款、取消、私訊對話、客服照常蓋在最上層，關閉後自動回到原分頁。手機版不開放點單（shopStep、shopOpen 1～3、預約、再點一次改為提示「點單請使用電腦版」），主要按鈕改為「儲值金幣」。儲值頁是手機專用的四步驟：選金額 → 轉帳到酒館帳戶（銀行代碼、帳號、戶名、金額各有複製按鈕，帳號複製純數字）→ 填稱呼與末五碼 → 上傳轉帳截圖（預覽、可換一張，壓縮方式同原本 1000px／JPEG 0.72），最後交給原本 submitTopup() 送出，資料格式與規則不變。票根在手機改為上方日期條，不再被內容拉長。手機版不再跳出「點地板走動」的新手引導。
取消原因（lobby-ui/cancel-reason.js）：自助取消改為必選原因（時間臨時無法配合／選錯方案或時段／想換一位冒險者／等太久沒有接單／其他，選其他需填寫），存於 cancelReq/<訂單>.reason；店長頁與冒險者頁處理退款時寫入 clientOrders.cancelReason，店長訂單卡顯示「取消原因」，冒險者通知附上原因。
預約確認：預約單送出前顯示「請確定是否預約此時段」（時段、冒險者、方案、金額），並提醒取消需填原因、店長看得到取消紀錄。
店內名稱（lobby-ui/staff-names.js）：訂單與帳號仍保留舊名稱快照（大卡／小mo／Caboo／卡布），顯示時一律換成 縭／桃／蕪（依角色 ID 優先）。套用於大廳（冒險者名牌、預約選時段、冒險者私訊標題）、冒險者頁寄給客人的信與署名、店長頁訂單與工單、客服頁角色清單。資料欄位 staffName／charName 不改，訂單配對與查詢照舊。後端（另行部署）Discord 訂單成立通知、語音房通知、信箱、店長訂單通知同樣換成店內名稱，語音房圖片對照改用店內名稱。
驗證：本機以 Database Emulator＋模擬 Discord 登入載入真實大廳，390×844、360×740、844×390 橫向與 1366×768 電腦版截圖檢查；手機儲值從選金額、複製、填寫、上傳到送出，資料庫寫入與電腦版同格式；取消原因必填與寫入 reason；預約確認可取消；點單入口在手機顯示提示。全部既有測試結果與修改前一致；新增 tests/staff-names-v432.cjs；後端新增 staff-names.test.cjs。

## v431 語音房不提早開
D 回報：訂單還在「等待冒險者確認時段」就出現「進入語音房」。網站（order-voice.mjs、voice-rehearsal.mjs）：客人端只有在冒險者已接單（confirmed）且開始前 10 分鐘內才顯示語音房按鈕，之前顯示「等待冒險者接單，接單後開始前 10 分鐘開放語音房」或「開始前 10 分鐘開放語音房」；陪玩端與演練不變。後端（api.tinytavern.tw，另行部署）：voice.cjs 未接單或距開始超過 10 分鐘不建立 Discord 語音房（job phase=waiting），先前已提早建立的房間會改回只有機器人看得到，時間到再開放；rehearsal.cjs 信箱連結同樣條件。
驗證：後端新增 voice-open.test.cjs 5 項（未接單、接單但數天後、15 分鐘前不建房；8 分鐘前建房且客人與陪玩可見；舊的提早房間被隱藏）、party 18 項、v428 11 項全過。

## v430 通訊錄改為上下分區
使用者選定 A：上方「我的狀態（三個按鈕橫排）＋搜尋」同一列，第二列分頁與好友人數，下方整個寬度是好友名單（兩欄，900px 以下單欄，自己捲動）。取代 v429 的狀態欄調整；只改 theme-skin.css，lobby-view／fixed-view 的大廳版本參數改 430 避免沿用快取。

## v429 通訊錄好友頭貼置中、我的狀態縮小
我的酒館通訊錄：v407 主題把好友頭貼畫布固定為 52px 並加粉色方底，但花圈／VIP 頭像框的開口只有約 41px（TTF_CIR 74%），角色被放大、往右下偏且下半身被裁。有頭像框（.ttf）時改回不加底色、畫布依開口 100% 縮放；私訊標題的頭像同樣處理。「我的狀態」原本跨兩列並拉伸佔滿左欄，改為依內容高度，搜尋框緊接在下方。只改 theme-skin.css（lobby.html 樣式版本 429）。
驗證：在正式網站以真實角色資料、通訊錄實際結構重現修正前畫布 52px 塞進 41px 開口，修正後畫布與開口同為 41px、無粉色底；狀態區改為內容高度、搜尋框移到其下。

## v428 開幕前資安修正（三批）
以 10/27 16:55 線上規則快照為底，產生 security/database.rules.json（需由店長在 Firebase 主控台貼上發布；未發布前網站行為不變）。
第一批（後台權限）：原本規則多處只檢查 auth != null，而客人 Discord 登入後、或任何人用 partner.html 自行註冊 Email 帳號都算「已登入」，可改商品價格、員工資料、工單、陪玩卡、禁言名單、讀全部邀請碼與客戶帳號、改別人訂單狀態、發站內信、把金幣改成任意數字。改為：店長＝config/adminUid；店員＝links/<uid> 有紀錄（且 links 只能用有效且未使用的邀請碼建立，與 invites/<碼>/usedBy 同一筆寫入）。shopConfig／tables／board／characters／staff 寫入限店長；staffCards、staffStatus 限店長或該陪玩本人；orders、mutes、mail 寄送、clientOrders 修改、付款證明／檢舉／問題回報讀取限店員。partner.html、kefu.html 註冊改為同時寫入 usedBy；admin.html 用過的邀請碼不再顯示，解除綁定後可重新產生。
第二批（金幣與購買）：一次購買必須同時包含 訂單＋新的扣款明細＋餘額剛好減少該金額＋wallet/<key>/lastTx 指向該明細，商品 owned/<key>/<item> 需帶 ref 指向這筆訂單，且付款金額不低於售價（shopConfig price；聊天氣泡 50；染髮券 shopConfig.dyeTicket.price 或 299；部件單買 partPrices 或 config/partPricing；VIP 優惠券最多折 200）。客人不能自己加金幣、偽造或刪除交易明細、不付錢發商品、清空或刪除別人背包、把轉帳單標成已確認。染髮保存改為多路徑 update（dyeTickets 剛好減 1＋dyeLast＋新增 dyedHairSets，同時保存只會成功一筆）。payWithCoins、聊天氣泡購買、群組陪玩單加上 lastTx／ref。
部署：.github/workflows/deploy.yml 改為只上傳網站本體，*.md、security/、tests/、scripts/、docs/、test-inventory.* 不再公開。
驗證：模擬器規則測試第一批 32 項、第二批 36 項全過（同時列出舊規則實際放行的漏洞）；tests/security-v428.cjs 以真實 Database Emulator＋大廳實際 payWithCoins 驗證染髮券／時裝／陪玩金幣單成功、前端竄改價格整筆被拒、雙裝置同時花錢只成立一筆，連續三輪通過。全部 65 個既有測試修改前後結果一致，僅 firebase-atomic-v273 因綁定舊規則檔而改為失敗（由 security-v428 取代）；dye-v230 模擬資料庫補上新寫法。
第三批（客人身分）：原本客人沒有登入 Firebase，身分只是本機 tt_me，任何知道角色鑰匙（大廳公開）或 Discord ID 的人都能冒用：看別人私訊／好友／信件／餘額／訂單、用別人名義聊天與下單、取消別人訂單；card.html 的鑰匙由填寫的 Discord ID 算出且直接覆寫，輸入別人的 ID 就能蓋掉並變成對方。改為：dc.html 綁定 Discord 時呼叫後端 /v1/voice/session（帶本機鑰匙），後端驗證 Discord 後把帳號綁到闆卡（secureV1/members、owners），回傳 Firebase 登入憑證與帳號擁有的鑰匙（換裝置找回改走這裡，移除讀公開 accounts 的 restoreAccount）。大廳入口有闆卡但未登入時顯示「用 Discord 登入酒館」；已登入但本機沒有鑰匙會自動找回。規則以登入身分判斷：闆卡／位置／聊天只能本人寫（新闆卡仍可在登入前建立，已存在的不可覆蓋）；私訊、私訊清單只限對話雙方（陪玩只看 staff_<自己> 的對話）；好友另一側需對方先送邀請；信件、帳號紀錄、餘額、交易明細只限本人；花錢、下單、取消／續單只能用自己的帳號；訂單可依 id、myKey（本人）或 staffCid（查檔期）讀取；工單只開放號碼。lobby-ui/secure-login.js、lobby-ui/account-review.js（店長頁「帳號綁定審核」，處理後端要求人工確認的情況）。card.html 遇到已存在的闆卡不覆寫，請本人用 Discord 登入找回。lobby.html 移除公開的 Discord webhook，付款復原查單帶登入憑證。
後端（另行部署到 api.tinytavern.tw，不在此 repo）：order-voice-bot/account-claim.cjs 認領規則——已有綁定直接回傳；否則用 accounts/<Discord ID>.myKey 或本機鑰匙，條件為闆卡存在、尚未被其他帳號擁有、沒有其他 Discord 指向它，且（帳號紀錄相符／闆卡填的 Discord 名稱與登入帳號相符／闆卡 3 小時內建立）；owners 以 transaction 搶先，兩人同時認領只會一人成功；其他情況回 ACCOUNT_REVIEW_REQUIRED。order-voice-bot/order-notify.cjs 由後端監聽新訂單發 Discord 通知（網址只放在主機環境變數 ORDER_NOTIFY_WEBHOOK_URL，orderVoiceV1/orderNotify 去重，兩台同時跑也只發一次，客人名稱中的 @everyone 失效，聊天氣泡不通知）。
驗證：tests/security-rules-v428/run.sh（第一批 32、第二批 36〔以已登入本人執行〕、第三批 56，每項同時列出舊規則結果）全過；tests/security-v428.cjs 改以已登入本人結帳，另驗證未登入不能付款，連續三輪通過；tests/secure-login-v428.cjs 驗證登入／錯誤訊息／換裝置找回／入口判斷；後端 v428.test.cjs（模擬器）11 項連續三輪通過、原有 party 測試 18 項通過。全部 65 個既有測試結果與修改前一致（僅 firebase-atomic-v273 由新測試取代）。
上線順序：①部署後端並設定 ORDER_NOTIFY_WEBHOOK_URL（舊 webhook 刪除重建）②Firebase 主控台發布 security/database.rules.json ③合併到 main。②③要同時；所有客人第一次進大廳需用 Discord 登入一次。

## v420 染髮保存後直接穿上、我的染髮穿不上修正

## v421 工房初始部件單買、花箋、頭髮頁拆前髮／後髮
闆卡工房可選的部件建卡時免費，建卡時選的永久保留；之後想要其他工房部件就單買，不能整套買。購買單位：頭髮（前髮＋後髮一起）＝花箋／妹妹頭（妹妹頭瀏海＋內收半長髮）／旁分（旁分瀏海＋微翹後髮）；衣服＝簡易休閒服／綁帶牛仔套裝；臉（眼睛＋眉毛一起）＝藍色銳利眼＋堅定眉毛／棕色杏眼＋圓圓眉毛／閉眼（單獨）；配件＝花箋蝴蝶結。買到後背包可拆開自由搭配。售價讀 config/basePricing（掌櫃頁商城分頁新增「工房初始部件單買價格」，使用者定 頭髮100／臉50／衣服50／配件50，需掌櫃儲存後才開賣），網站不寫死價格。結帳沿用既有單筆 buy→payWithCoins，寫入 owned/<key>/base_hair_2 等。
持有判斷（lobby.html TTBaseUnits／__ownedParts）：已購買、建卡紀錄 owned/<key>/baseStart 中的部件、正在穿的部件、染髮組合用過的前後髮（染髮當時已持有）都算持有。舊老闆（沒有 baseStart）保留初始男女全部部件；花箋前後髮與花箋蝴蝶結舊老闆也要買（持有啟程旅人者保留花箋髮型）。card.html 建立新闆卡時寫入 owned/<key>/baseStart（已有闆卡的重新製作不寫，寫入失敗視為舊老闆）。
灰階捲髮／灰階瀏海／蝴蝶結（可換色）正式命名花箋後髮／花箋前髮／花箋蝴蝶結（大廳與工房顯示；素材資料名稱不變）。花箋蝴蝶結（基本配件 4）不再列為版權測試配件，可在新背包配件分類穿戴（makeDoll 支援基本配件 acc）。商城頭髮／臉／衣服／配件分類列出工房部件，標「單買 N 金幣・前後髮一組／眼眉一組」，試穿可看未持有的工房部件，目前搭配清單以購買單位計價。
背包頭髮分頁拆成「前髮／後髮／我的染髮」。我的染髮缺工房髮型時顯示「先到商城買「花箋」髮型才能穿」。
驗證：隔離模擬資料庫檢查舊老闆、舊老闆＋花箋染髮、新老闆、新老闆購買花箋與蝴蝶結四種持有結果；背包前髮／後髮分開、穿上花箋蝴蝶結寫入 acc 4；商城各分類單買標價、試穿花箋後目前搭配單買 100、結帳名稱「工房部件・花箋（前髮＋後髮）」；v420 染髮流程、wardrobe-state-v276、dye-v230、payment-safety-v273 通過。retired-outfits-v357 更新蝴蝶結斷言（該測試在 v405 起就因 withPartSale 抽取失敗，修改前後相同）。

 染髮保存後直接穿上、我的染髮穿不上修正
修正「我的染髮」按穿戴沒反應：背包重畫染髮預覽時，舊組合含已下架的基本髮型（例如 base 2）會讓 makeDoll 丟錯，而 saveBag 的 render 在 try 外，saving 卡在 true，之後所有按鈕都按不動。改為 render 放進 try、預覽逐張 try/catch（無法穿的組合用原始資料畫灰階預覽）。部件已下架的舊組合按鈕停用並顯示「這組髮型已下架，無法穿戴」。
卸下染髮改為保留同一組瀏海與後髮、恢復原本髮色（舊版改成 base 0，已下架會穿不回去）。
染髮工作室按「使用 1 張並保存」（含買完券後的「直接染上」）成功後自動穿上：以目前已保存的穿搭為底，只換這組瀏海、後髮與髮色，不把試穿中的其他商品一起存；成功顯示「染好了，已經幫你穿上！」，失敗才請老闆到我的染髮按穿戴。扣券、保存交易與 wear 寫入函式未改。
驗證：隔離模擬資料庫跑背包我的染髮（已下架組合停用、可穿組合穿上並寫入 doll、卸下保留髮型）、染髮保存後 doll 帶 dyedHairSet 與新髮色、券數 1→0 只扣一次；wardrobe-state-v276、dye-v230、payment-safety-v273 通過。已在正式站確認 v419 闆卡分享已上線（card-share.mjs?v=419、OPEN_TO_EVERYONE=true、含 pollSeq 修正）。

## v419 闆卡分享：晚到的舊輪詢不覆蓋較新的狀態
GPT 補測：current 回 processing → 3 秒後 status 已送出但未回 → 按重新讀取，current 回 null 或較新的 published → 舊 status 才回 published，畫面倒退成舊狀態。stopPoll 改為取消排程並遞增 pollSeq（已送出的 status 回應一併失效）；loadCurrent 開始時先 stopPoll；輪詢鏈每次都由 stopPoll 取得新編號。保留 s===st 檢查、每 3 秒、最多 5 次與單一輪詢。
驗證：tests/card-share-v418.cjs 加入 v419 情境共 38 項全過（晚到舊 status 遇 current null／較新 published／重開視窗三種、舊回應不再啟動輪詢、3 秒間隔、重新讀取後仍 processing 只有一條輪詢且最多 5 次）；新情境對 v418 版本有 5 項失敗。GPT 的 audit-v418-poll.cjs 對 v419 通過。

## v418 闆卡分享修正（GPT 核對三項）、開放給所有人
card-share.mjs：狀態物件換帳號時整個換新，預覽／發布／撤下／讀取各自記下狀態物件與操作編號，回應不屬於目前帳號與欄位版本就丟掉，舊請求的 catch／finally 不會清掉新狀態。預覽、發布、撤下、讀取進行中停用欄位；改欄位使舊預覽與進行中的預覽請求失效。預覽資訊列出「這張預覽包含」的欄位。
每次打開視窗都重新讀取 current（另一分頁撤下、processing 輪詢到上限後重開都會刷新），同一時間只有一個輪詢；讀取失敗顯示「讀取分享狀態失敗」與「重新讀取」，不當成沒有分享；處理中與待確認狀態也有重新讀取。
同意勾選改以目前預覽圖片 onload＋decode 成功為條件；onerror 顯示「重新載入圖片」並禁止分享；已成功的圖片重畫時不再觸發 paint，避免循環。
使用者決定先開放（Discord 伺服器尚未公開）：OPEN_TO_EVERYONE 改 true，自己的闆卡都會出現「分享到 Discord」。
驗證：新增 tests/card-share-v418.cjs（模擬 client，不連正式 API、不向 Discord 發文）25 項全過，含預覽中欄位停用與強制改欄位被忽略、預覽／發布中換帳號舊回應不套用、重開重讀 current、current 失敗與重新讀取、輪詢 5 次停止後重開重新輪詢且不重複、圖片失敗不能同意與重試、慢圖片載入前不能同意、載入後無重畫循環、重試同 requestId；同一測試對 v416 版本有 6 項失敗。

## v417 冒險者手札私訊移除調閱說明
冒險者手札「會員私訊」對話標題下的「會員私訊・掌櫃可調閱」移除，只留老闆名字；私訊讀寫不變。

## v416 手帳翻頁與邊緣、切換大廳主題、訂單語音按鈕、冒險者私訊精簡
闆卡手帳：移除舊黃色 7 幀素材翻頁（BKA.flip），改程式繪製的 CSS 3D 翻頁（白紙深藍框紙頁沿書脊翻過，往後的分頁向左翻、往前向右翻，0.62 秒，減少動態設定時不播）；左右側頁籤改完整外框並貼齊書邊；頁面底部留白並淡出，不再切在框線上；聊天氣泡清單改白紙卡與粉色按鈕。
切換大廳視窗（#roomDialog）改整站主題：白紙深藍框、寶石標題、主題卡片列、輸入框與粉色按鈕。只改外觀，分流／房間處理器不變。
訂單票卡：語音按鈕移到票卡最下方整列，只有 Discord 已建立語音房時才顯示「進入語音房」；沒有房間不顯示（移除客人端「連結這筆訂單的語音」手動按鈕，訂單建立時仍自動登記）。冒險者手札端不變。單獨開啟的我的訂單（手機）頁籤與空白頁改主題。票卡文案「陪玩／陪陪」改「冒險者」、「陪玩紀錄」改「委託紀錄」。
冒險者私訊：不顯示檢舉／封鎖鈕；底部說明文字移除（好友私訊也不再顯示「掌櫃可調閱」）；會員到期時才顯示「會員已到期，只能查看紀錄」。手機冒險者通訊錄：基本會員也蓋灰色一層，顯示「此區為進階會員以上專用」；移除「掌櫃可調閱」說明。

## v415 冒險者頭貼裁切調整頁、清理用過的調整頁
新增 avatar-crop-adjust.html：桃／蕪／縭各自拖曳移動、滾輪或滑桿放大，淡色顯示被裁掉的範圍，附私訊標題、通訊錄、手機通訊錄實際大小預覽；設定存在瀏覽器，按「複製設定」匯出 JSON 貼回。裁切值改由 lobby-ui/avatar-crop.css 的 --ac-z／--ac-x／--ac-y 控制（目前預設 1.14 倍、不位移，等同 v414），私訊標題、通訊錄名單、手機通訊錄三處共用；手機通訊錄頭貼改為內層圓框裁切，綠燈不被裁。
清理：用過的調整頁與預覽頁（chat／npc／season-color／shop-size／bubble／companion／drink／frame／portrait／sticker 調整頁、bubble-design、bubble-skins-preview、test-inventory）及舊副本（CLAUDE-2.md、guide-1／2.html、guide-theme-1～3.css、tavern-ui-bridge-1.js）由使用者執行 C:\tinytavern\清理調整頁_v415.bat 移到 C:\tinytavern\_調整頁備份_v415（不直接刪除）。正式頁面未引用這些檔案（只有註解提到 season-color-adjust、frame-adjust）；lobby_1.html 保留。

## v414 闆卡分享到 Discord（測試入口）、手機冒險者通訊錄、冒險者頭貼裁切
新增 lobby-ui/card-share-client.mjs（後端提供的 website-client.mjs 原檔）與 lobby-ui/card-share.mjs：自己的闆卡多一顆「分享到 Discord」，視窗含 Discord 登入、欄位選擇（名字／角色必選；沒有寵物不顯示寵物；標籤／常玩遊戲／一段話有填才出現）、後端圖片預覽（不重畫）、發布帳號與位置確認、本人勾選同意後才可「確認分享」、處理中輪詢（3 秒×5 次）、待確認停止、已分享連結與撤下。重試沿用同一 requestId；換帳號清空預覽。不印生日、錢包或原始 Discord ID 到圖片；未放 demo.cjs 或本機示範 bearer。
入口目前只在測試模式開啟（網址加 ?cardshare=1，之後同瀏覽器記住）；card-share.mjs 的 OPEN_TO_EVERYONE 為 false，本人完成登入→預覽→確認發布→撤下驗收後再改 true。
手機首頁新增「冒險者通訊錄」：三位冒險者分在線區（上班中＝在線上，委託中另標）與休息中，顯示最後一則訊息與未讀，按私訊沿用 staffDmOpen（進階會員以上可傳）。未加入月費會員且沒有舊對話時，整區蓋灰色白字「此區為月卡會員專用」與方案入口。只讀 staffStatus／dmMeta，不新增寫入。
冒險者頭貼（私訊標題、通訊錄名單）改圓形並放大裁掉外圈透明邊。手機點單按鈕說明「找店員陪你…」改「找冒險者一起玩、聊聊天」。
驗證：模擬 API（不連正式服務、未向 Discord 發文）跑完預覽、欄位切換清空預覽、同意前不可送出、第一次逾時後重試同 requestId、202 輪詢、已分享、撤下、換帳號與登出；手機 iPhone 13 尺寸檢查通訊錄鎖定與會員畫面。

## v413 月費會員成就、掌櫃頁左側分頁
成就「冠名者／購買冠名方案」改為「月費會員／加入任一月費會員方案」（沿用 crown 編號，已解鎖紀錄與稱號保留），有已確認的會員訂單即自動解鎖（achMemberCheck 每 5 秒檢查本機訂單快取）；大廳稱號同步改名；手帳頭像框說明移除冠名框；掌櫃頁客人消費摘要「會員/冠名」改「會員」。
掌櫃頁電腦版（1000px 以上）分頁改左側直式一覽並黏在左邊，內容在右欄；手機維持上方分頁。「當季套組上架」「時裝部件單買價格」只在商城分頁顯示（season-shop-import.js 包裝 showTab）。功能與資料寫入未改。

## v412 冒險者手札、掌櫃頁重新排版與主題
新增 lobby-ui/backoffice-theme.css（手札與掌櫃頁共用）：取消告示板木牌／羊皮紙風，改整站主題（白紙深藍框＋淺藍內框、粉藍錯位紙頁、寶石標題、粉色主按鈕、膠囊分頁、白紙單子卡、主題狀態標籤），字型改 LINE Seed；夜間模式保留原夜間配色。
partner.html：主畫面改桌面左右兩欄（左欄固定：個人卡／上班開關、行事曆、陪玩卡；右欄：通知音、語音邀請、新單／進行中／本月、會員私訊），1000px 以下改單欄並把單子排在個人卡之後。只移動區塊位置，所有 id 與處理器不變。
admin.html：新增 lobby-ui/admin-theme.css，黏頂分頁列改白紙框、商城上架格／部件格／微調鍵／灰階測試與無樣式按鈕套主題。功能與資料寫入未改。

## v411 會員私訊冒險者、冒險者手札私訊收件匣、私訊視窗主題
大廳：冒險者資訊頁新增「私訊<名字>」按鈕（live-roster.js → TinyTavernUI.staffDm → window.staffDmOpen）。進階／尊榮會員（31 天內已確認的會員訂單，planName 含「進階」「尊榮」，window.ttMemberTier）可傳文字與貼圖；非會員按下顯示提示並開啟加入會員方案；會員到期後仍可查看既有對話但不能送出。沿用好友私訊同一套資料：dm/<玩家代號~staff_角色ID>、dmMeta/<玩家>/staff_<角色ID>、dmMeta/staff_<角色ID>/<玩家>（未讀以 transaction 累加），不需新增資料庫規則。冒險者私訊不走好友／封鎖檢查（封鎖按鈕改提示，可檢舉）。通訊錄好友分頁列出冒險者私訊（冒險者頭像、最後一句、未讀、聊聊）。
冒險者手札 partner.html：新增 lobby-ui/staff-dm.js／staff-dm.css「會員私訊」卡片，列出私訊自己的老闆（名字、最後一句、時間、未讀數），點開看文字與貼圖並可回覆文字或貼圖；只讀寫 dm／dmMeta。
私訊視窗（#dmM，好友與冒險者共用）改整站主題：白紙深藍框、標頭寶石色帶、訊息氣泡深藍框（自己粉色）、粉色送出鈕、貼圖選單白紙。
驗證：以記憶體模擬資料庫跑完整流程（非會員被擋、會員送文字＋貼圖、手札收到並回覆、玩家端未讀與通訊錄顯示、私訊視窗顯示冒險者頭像）；social-v347 通過。正式資料庫未寫入測試訊息。

## v410 闆卡手帳、闆卡工房一體化
闆卡手帳（#bookM）：桌面版移除米色書本底圖，改為 CSS 繪製的白紙深藍框雙頁、中縫圓環、粉藍錯位紙頁與角落網點；標題「闆卡手帳」改寶石標籤，頁籤、左側小頁籤、關閉鈕、區塊標題、卡片（bkCard／bkTrio／bkAct／bkMail／bkSlot）、按鈕、便利貼、進度條、翻頁圓點改主題。手機版每頁為主題紙卡。分頁、翻頁、內容與處理器不變（theme-skin.css）。
闆卡工房 card.html：新增 card-ui/theme-card.css（於 workshop.css、tavern-scene.css 後載入），外框、標頭、步驟列、試衣台、分頁、選項、色票、欄位、標籤、按鈕、入店說明、回訪卡、結果頁改整站主題；登記、試衣、產卡、下載流程不變。文案「三位陪玩」「陪玩稱呼你」改「冒險者」（大廳歡迎卡 aria 同步）。

## v409 買完染髮券直接染上剛調的顏色
染髮工作室按「買一張染髮券」時，先把目前試穿的髮型與調好的主色／髮尾／挑染／名稱暫存在本分頁（sessionStorage tt_dye_pending_v408，30 分鐘有效）。金幣付款成功後（payWithCoins 成功分支只多呼叫 window.ttAfterDyeTicket），自動回到商城染髮工作室、還原顏色，跳出「染髮券到手了！要直接用剛剛調好的顏色染上嗎？」；按確認沿用原本 saveDye（使用 1 張券、同一個請求編號防重複），保存後照舊跳到背包的我的染髮。按「先不要」保留顏色在工作室。扣款、訂單、持有券數寫入未改。

## v408 全站視窗一體化第一批、聊天室修正、會員方案改版
排查大廳所有視窗後，把仍是舊粉紫卡或霧紫樣式的視窗改成整站主題（白紙深藍框＋淺藍內框、粉色錯位紙卡、寶石標題籤、粉色主按鈕）：加入會員、點單選方案、付款資訊／商品結帳（tt-order-flow 標頭、步驟列、收據）、選擇冒險者（即時／預約）、預約時段、酒館併桌、回報訂單問題、選擇頭像框、檢舉發言、確認小視窗、入店歡迎卡、右鍵選單、提示泡泡、通知卡、成就達成。冒險者名簿與冒險者資訊視窗套用商城同一套外框（theme-window.css 由 #shopWindow 規則複製）。只改外觀，付款、訂單、預約處理器不變。
大廳聊天室：標題列／訊息區／輸入列之間 6px 空隙透出大廳、訊息區半透明，看起來像破圖；改為相連白紙，訊息改深色字、名字粉色。
會員方案（lobby.html PLANS.member）改為 基本會員（月）1200／進階會員（月）3000／尊榮會員（月）5000，權益依使用者文字；「本店店員」「陪玩」依用字規範寫成「冒險者」。舊 m699／m499／crown 改為 m1200／m3000／m5000；掌櫃頁月卡判斷加入「進階」。點單選單會員卡副標改「三種月會員方案」。
文案：名簿與冒險者資訊頁的「陪玩」「店員」改「冒險者」；移除「介紹與排班待補」「排班資訊待更新」「自我介紹準備中」「待店員填寫」「排班尚未公布」「便箋等待更新」「冒險者更新中」等待補字樣；成就說明移除「之後與帳號同步、未來可換」暫定說法；成就與會員通知改全形標點。

## v407 闆卡縮小、標題字變細、通訊錄名單、暫停預約鈕、大廳寵物比例、VIP 門檻
闆卡視窗桌面縮為 86%；框外小人往框內靠 32px、頭像區左移 16px，不再壓到右欄 02 標籤；右欄疊在左欄之上。
標題字（各視窗標題籤、我的酒館、點單選單、闆卡名稱與欄位、大廳招牌、新手指南 h1）移除 -webkit-text-stroke 加粗，改用字型本身粗體，避免中文糊成一團。
通訊錄好友名單取消深紫底，改白紙卡片列（深藍框＋淺藍內框、粉色左邊條），整列填滿右欄；聊聊為粉色主按鈕、移除為白底框線鈕。只改外觀，好友處理器不變。
名簿：冒險者自己設定暫停預約時，選取鈕改為灰色停用樣式並顯示「暫停預約」（原本看起來可按但按不下去）。可選條件未改。
大廳玩家跟隨寵物改用與試穿、NPC 相同的寵物比例（staffPetLayout，以 160px 人物為基準），面向改變時左右鏡像；原為固定 32×42px。
語音通知登入回傳頁（dc.html 內 voice-rehearsal.mjs finishVoiceLogin）改為標題＋說明格式，套用 v406 主題卡；登入流程未改。
文案：點單選單「找陪玩一起玩」改「找冒險者一起玩」、「語音陪聊」改「找冒險者聊聊天」，選單副標與訂單空白頁的「找店員一起玩」改「找冒險者一起玩」（新手指南目錄與位置說明同步）；名簿頁預設字「試營運店員」改「冒險者名簿／冒險者」。VIP 門檻定案，移除「等級門檻為暫定值，正式上線前會公告確認」並改全形標點。錢包類視窗（VIP、錢包、儲值付款）標頭拿掉疊在大字上的幾何線與虛線弧，光環移到大字下方、星星分開。
VIP 門檻依使用者改為 VIP1 3000／VIP2 10000／VIP3 15000／VIP4 22000／VIP5 30000（lobby.html VIP_CFG.need 與 admin.html VIP_TIERS_ADMIN 同步）。掌櫃頁已將布布／燈燈／鬼鬼三隻寵物售價改為 499（只改 price 欄位）。

## v406 飲料三杯並排、Discord 回傳頁主題
依使用者要求撤回 v404 單張大卡：桌面商城飲品三張完整卡同時並排，選中那杯微放大亮起、其餘完整顯示；箭頭／圓點／點卡片直接切換（不需捲動時不走捲動判定），點卡片照舊打開杯數視窗。手機仍為單卡橫向滑動。保留 v404 只在卡片背景紙上的反光與 v401 字型修正；排版數值與購買流程不變。
dc.html（Discord 綁定／重新讀取頭貼回傳頁）改用整站主題：白紙深藍框、淺藍內框、錯位紙卡、粉色寶石標籤、角落網點、亮面星星貼紙與探頭吉祥物（在卡片後方）；按鈕改主題粉色。只改外觀與文案標點，「接單店員」改為「酒館的大家」；授權、頭貼更新、找回帳號與跳轉邏輯未改。

## v405 時裝部件單買、整套 350、座椅上架
掌櫃頁已上架熊熊偵探／龐克搖滾狼；四套當季整套改 350（只改 price 欄位）；座椅推車、鏡子 399 上架。
部件單買：tavern-ui-bridge.js 為每套時裝產生購買單位 <套組>::hair（瀏海＋後髮）、::face（眼型＋眉毛）、::cloth、::accN；售價讀 config/partPricing（掌櫃頁新增「時裝部件單買價格」，目前 頭髮100／臉100／衣服100／配件30），商品 partPrices 可覆蓋；網站不寫死價格。持有整套或該單位即可穿戴（validPart 改為逐部件），染髮券保存髮型亦接受 ::hair。購買沿用既有單筆結帳與 owned/<key>/<itemId> 寫入，訂單／錢包／付款程式未改。
live-wardrobe.js：目前搭配計價改為部件單價，同套已選部件合計不低於整套價時自動改買整套；同組第二件顯示「與同組一起計價」；商品格顯示「單買 N 金幣」；背包列出部分持有的部件。

## v404 飲料卡單張大卡、反光只在背景紙
商城飲品改為中間一張大卡、左右只露出相鄰卡邊緣（遮罩淡出）；相鄰卡縮小、變暗。移除舊 .drink-slide::after 整片掃光（v380 起 overflow:visible 讓光帶溢出到整個區域），改為 .ddc-paper::after 只在卡片背景紙上掃過，人物與飲料在其前方。排版數值、購買流程不變。

## v403 四套當季展示配色定案
season-display.js 寫入使用者匯出的熊熊偵探、龐克搖滾狼、中華小惡魔、心動情人展示髮色與背景三色；四張當季卡片皆改為即時繪製人物。只影響展示。

## v402 當季展示配色定案（熊熊偵探／龐克搖滾狼）、中華小惡魔／心動情人可調
season-display.js 寫入使用者匯出的兩套配色（含自訂背景三色）。有展示配色的套組改用即時繪製人物（不用固定展示圖），中華小惡魔、心動情人加入 season-color-adjust.html，預設值取自原 displayDye；未設定前仍顯示原展示圖。只影響展示，不影響試穿、保存、染髮券或價格。

## v401 飲料卡英文字使用調整頁字型
遊戲字體.css 的 body * { font-family:… !important } 蓋掉飲料卡英文字（KABUKI／RIRA／MOMO）的指定字型，換成較寬的介面字而超出卡片。drink-art-card.js 另帶 --ddc-font，drink-art-card.css 以 !important 指回調整頁字型（Georgia／Impact）。排版數值（drink-layout.js）與使用者飲料卡排版.json 相同，未改。

## v400 熊熊偵探／龐克搖滾狼上架準備、當季卡片配色
tavern-ui-bridge.js：當季草稿（season-v291.js）保留原圖部件；掌櫃上架後 shopConfig 有同編號且售價有效時，改用掌櫃設定的售價、上架與期限，未上架維持「敬請期待」。網站不寫死價格。
掌櫃頁當季匯入器支援 291 季：img/season-v291/products.json（每套 399 金幣、部件為網站原圖網址），沿用不覆寫既有商品、上架前下載備份、上架後驗證。座椅兩款 399 由掌櫃在既有座椅欄位儲存並上架。
當季卡片展示配色：tavern-ui/season-display.js（只影響卡片上的展示髮色與背景，不影響試穿、保存、染髮券或價格），卡片背景改為跟隨展示髮色的三色漸層＋柔光＋斜紋，角落網點保留。新增 season-color-adjust.html 調整頁（需在 tinytavern.tw 開啟），匯出 JSON 後貼回 season-display.js。

## v399 商城／背包試穿區右緣星星
試穿區 aside 為 static 定位，星星裝飾以 iframe 邊界定位而有一半落在框外被裁，看起來像被外框線蓋住。改為 right:4px，整顆坐在試穿框邊線上；不動商城比例。

## v398 我的酒館頂端吉祥物移除、成就標題列修正
移除我的酒館視窗頂端的探頭吉祥物（標頭內的吉祥物保留）；成就右欄「每一次來，都有小收穫。」標題列取消裁切與左側框線，收藏數標籤完整顯示。

## v397 星星層級、我的酒館免捲動、訂單票卡、商城一排三件
星星特效所在標頭提升 z-index（我的酒館右緣星星不再被內容蓋住）；點單等視窗標頭的旋轉方塊縮小並移到無字處；迴紋針移到右緣空白。新手指南探頭吉祥物改在底線下方。
我的酒館桌面版標頭與分頁變矮；通訊錄改左右兩欄（左：標題、我的狀態、搜尋；右：分頁、名單自捲）；信件兩欄卡片；訂單票卡改主題版（白紙深藍框、寶石日期票根、虛線撕線缺口、粉色金額標籤、進度條），兩欄排列、清單自捲。只改外觀，訂單／信件／好友處理器與寫入不變。
商城／背包一般商品一排三件，清單上下留 6px 避免滑過上移被切；目前搭配移除吉祥物、字縮小，已擁有改小勾勾圖示（live-wardrobe.js 只加 data-state 顯示屬性），背包不顯示需購買金額。

## v396 新手指南、換頭貼視窗主題；商城整體 83%
新增 lobby-ui/guide-theme.css（guide.html 於 guide.css 後載入），新手指南外框、標頭、側欄、章節卡、問答與結尾卡改用整站主題；不改排版與內容。theme-skin.css 新增相機選單 .avMenu 與裁切視窗 #avM 外觀，按鈕與流程不變。新手指南左上圖示改用使用者提供的貓咪線稿（lobby-ui/assets/theme/brand-cat.png，只換指南，網站 icon-192 不動）；歡迎區三位人物改為底部對齊，腳底同一水平。指南側欄改為整欄固定，修正捲動時章節列蓋到側欄小語；全頁字級放大（小字至少 11px、內文 15–16px，手機略小一級）。
商城依使用者調整頁數據 {"zoom":0.83,"maxWidth":1160,"maxHeightVh":94}：theme-window.css 桌面 #shopWindow zoom .83，寬高上限沿用；theme-shop.css 桌面小字放大（8–13px → 10–15px）避免縮小後看不清，商城內部比例不變。gen/shop-body.css 同步保存此段，重新 build 不會遺失。

## v395 座椅交接包 v2、手帳寵物縮小
js/tt-seats.js 以交接包 v2 原檔替換（SHA256 d25a96af5d12a1eae7e61c8999e0b795fb2dfdb859622541f7827cd17d25c286，-text），img/seats/mirror 換新十張素材；CFG／動畫未改、API 不變，沿用 v361 整合。掌櫃頁座椅價格欄預設 399（需掌櫃儲存並上架）。手帳寵物縮圖 70%。v382–v394 為整站視窗主題（lobby-ui/theme-skin.css、tavern-ui/theme-window.css、tavern-ui/theme-shop.css、theme-loading.css），只換外觀、不改商城比例。

## v381 飲料卡載入鏈快取修正
大廳外框、商城橋接程式、商城外框及時裝間 iframe 的版本參數同步更新，避免沿用 v375 內頁而看見舊的三張並排飲料卡。卡片程式仍為 v380 偽 3D 實作；不改動原圖、帳號或交易邏輯。


## v380 偽 3D 飲料卡
把已製作的分層飲料卡接入網站商城與選杯數視窗：原始飲料圖、角色及寵物 GIF、儲存座標不變。滑鼠移動帶出卡面傾斜與前後景視差；中間卡片動態、鄰卡靜止淡化，價格大字微傾斜 99／金幣。保留原購買與餵食處理器；手機調整預覽高度。1366／390／320 隔離驗證三款切換、圖片、數量、關閉、無橫向溢出與無寫入；付款安全回歸通過。其他尚在進行中的整站主題不包含於本次發布。


## v379 Discord 頭貼失敗處理與重新讀取
修正選用 Discord 頭貼時尚未載圖、尚未確認保存就提示成功的問題。先驗證圖片，再以一次 pub.update 保存來源；圖片失敗或保存被拒時保留原頭貼。明確選擇與最後成功 dcav 可跨重新整理保留，HUD、手帳與自己的闆卡共用相同來源；照片與改回像素也經確認保存才更新畫面。
相機選單增加「重新讀取 Discord 頭貼」，使用既有 identify 授權範圍重新取得原帳號圖片；限制同一 Discord ID、角色與已驗證 OAuth state，不執行帳號恢復或切換。候選 profile 暫存於 session，圖片與保存成功後才採用；失敗不污染既有 tt_dc 或 publishProfile，等待保存時換帳號也不覆寫新身分。
驗證：dc-avatar-v379 桌面1366／手機390及OAuth共35案通過，含404、延遲、保存拒絕、角色暫缺、重新整理、闆卡一致、候選hash失敗、保存途中身分變更、照片保存與OAuth拒絕／過期／不同帳號。v373 quick、原Discord授權18案、付款安全與闆卡／手帳三尺寸回歸通過。所有回歸均隔離正式寫入；已於使用者真實頁面看到載圖失敗提示，但未代為重新OAuth，不能將固定圖片測試當作真實CDN成功證明。票根與購買確認框美術提案未納入本次發布。

## v377 舊訂單顯示正式角色名稱
訂單卡「與……一起玩」與群組陪玩紀錄改用正式角色名稱蕪／縭／桃。依 staffCid 優先辨識，缺少或使用舊 ID 的歷史訂單以精確舊名 Caboo／大卡／小mo 對應；未知名稱與不指定保留原文。客人端歷史訂單、舊版備用清單、遊玩吊卡、續單視窗與送出提示、問題回報摘要、手帳訂單動態共用同一顯示函式；語音信箱標題也逐名套用同一對照，仍經過原本 HTML 跳脫。
僅調整顯示，保留歷史訂單與群組姓名快照、角色 ID、原始金額、支付與資料庫寫入流程。名稱回歸涵蓋 26 種資料情境、現行與舊版訂單及各相關畫面；1366×768 桌面／390×844 手機以隔離舊名訂單驗證進行中與歷史卡兩處正式名稱、整組 2 人／NT$640、原始資料不變及無橫向溢出。order-flow-v234、payment-safety-v273 通過；沒有操作正式帳號或送出真實訂單。

## v376 恢復已核准的頭上貼圖格式
v365 文字氣泡改版移除了 body 的 artBub / bub3s，貼圖主樣式卻仍依賴這兩個標記，造成外框退回普通氣泡的 24×14 padding 盒。貼圖尺寸與定位改為依自身 class 生效，並移除普通氣泡的偽元素尾巴；保留貼圖自身白底與白尾。沿用 v247 已核准的 53×53、上下16、左右0、停留5秒、320ms彈出，未修改貼圖設定、原圖或聊天傳送流程。
驗證：1366／1920 桌面與390手機隔離載入真實大廳，十張貼圖改前皆24×14、改後皆53×53；錨點、白底、尾巴、約5秒退場及貼圖／文字替換通過，一般文字造型不受影響。未向正式聊天室發送測試訊息。

## v374 飲品完整展示、寵物大小與大廳同節奏待機
飲品依商城實際可見高度與寬度適配，桌面完整並排三張原卡；手機保留完整單卡與橫向切換。原始 drink-layout 座標不變，外層保留原畫超出設計框的安全邊界，避免桃的裙襬與右側特效被裁。點單數量及付款路徑不變。布布、鬼鬼商品縮圖顯示 82px，燈燈保留 112px（窄手機受卡片可用寬度限制）。
大廳與試穿共用 ttIdlePose：同一父視窗時鐘、玩家 seed、正半波壓縮與負半波原尺寸；腳底沿用 TTScene.metrics 的 alpha > 80 門檻。試穿保留 64×64 原始畫布，先整數 nearest 放大，再於固定螢幕像素畫布內繪製同一待機姿態，避免 CSS pixelated 小數縮放造成方格邊緣游移。顯示畫布、背景、橢圓與裝飾不動；一般介面動態開關與系統減少動態設定都保留。
驗證：wardrobe-idle-v374 精確時序取樣；shop-cleanup-v373 跨尺寸檢查寵物比例、來源 64×64、固定腳底與顯示畫布，1685px 另逐像素比對僅人物區改變、背景零差異及關閉動態；drink-fit-v374 檢查三張完整卡、六尺寸、手機橫向瀏覽、三卡各自打開原點單與數量總價。所有資料與寫入均隔離測試，不操作正式 Firebase。

## v373 下架清理、初始套裝命名與試穿細節
以現行 shopConfig 唯讀核對後，下架 cloth_mslu9a8o「星夜漫遊裝」整套，保留 cloth2、cloth3 初始服裝並依使用者選定命名「啟程旅人／微風日常」（酒館日常套）。手帳圖鑑、收藏數、愛用小物與舊點擊入口一併排除露亞、小莓及漫遊套；移除 seat0–2 預想座椅，保留推車與鏡子。手帳寵物改為布布／燈燈／鬼鬼，未解鎖使用灰階靜態 canvas，已解鎖使用原始彩色 GIF。保留歷史持有資料，未寫入正式資料庫。
寵物商品縮圖按原始 GIF 全幀可見邊界放大，不改跟隨比例；人物預覽改以實際腳底為中心壓縮回彈，移除上下漂浮；色票與染髮入口增加間距。紅寶石髮飾等限定配件保留固定圖文列，備註改小字。人物介紹改用正式名稱蕪／縭／桃；DC 頭貼切換立即使用本機選擇，避免舊 presence 狀態覆蓋，並補上 HUD 更新入口。新版型提案僅作本機預覽，未發布。另修正初始套名被 shopConfig 舊名覆蓋、紅寶石圖文 grid 錯列、手機帶寵物預覽與 GIF 原圖比例；目前點單摘要只改顯示名，不改歷史訂單保存欄位。
驗證：shop-cleanup-v373 六尺寸（1685、1920、1366、1024、390、320 寬）、retired-outfits、wardrobe-state、viewport、look-summary quick、order-flow、payment-safety 通過。DC 頭貼以隔離圖片來源測試，沒有實際帳號或付款操作。
補查：商品列的編號／持有狀態回到正常 grid 列，避免圖片佔到 14px 標籤列而壓住名稱；手機帶寵物預覽恢復圖與色票兩欄。初始套裝前台名稱不被既有 shopConfig 舊名覆蓋。付款摘要、狀態提示與完成提示使用正式角色名，訂單保存與歷史名稱欄位維持原狀。六種尺寸隔離驗證停用清單、縮圖、腳底固定、備註、初始新名；桌面另驗證 Discord 圖片載入及 HUD／手帳立即切換、三名人物介紹與付款摘要。未用真實帳號操作付款或 Firebase 寫入。

## v372 搭配清單比例修正
將搭配清單限定為 132px 窄欄，試穿區維持 280px，商品區取得剩餘寬度。商城與背包統一左商品／中清單／右預覽，含座椅等非清單分頁；「其他」標籤與餵食導航改為「飲品」。明確覆蓋舊兩欄 grid template 與 grid area，避免清單變成自動擴張欄位。清單移除大卡片背景與英文眉題，縮小列距、縮圖及金額區；保留移除、計價、結帳與手機展開功能。

## v371 目前搭配清單與待購小計
移除一般商品底部 YOUR STYLE 明細與按鈕。商城／背包增加目前搭配縮圖與名稱、紅色減號移除；預設基本款保留、無部件不列出。清單獨立捲動，手機可展開／收合。按未擁有商品去重計算整套小計，尚未開賣另列不計價。確認選購逐項接回既有結帳確認頁，結帳前重讀持有與價格，返回保留搭配；未修改扣款、訂單或持有寫入邏輯。
驗證：跨六種尺寸、部件移除與套裝去重、未定價／已持有排除、結帳導向與返回狀態、手機抽屜、既有染髮與配件功能。付款回歸測試使用隔離資料，未執行實際購買。

## v370 臉部分類
商城與背包的「臉」保留主分類，新增眉毛／眼型子分類，分開列出與穿戴；背包補上原有眉毛項目。未命名眉毛以套裝名＋眉毛呈現，不再使用配件通稱。

## v369 自帶挑染的一般色票
熊熊偵探與龐克搖滾狼等自帶挑染髮型，試穿區提供主色／挑染切換，兩者可用一般色票獨立換色。保存到既有穿搭 hairHighlight，重開保留；商品縮圖同步顯示挑染。已保存染髮券組合仍沿用整組鎖定，付費訂製交易不變。

## v368 飄散花朵名稱與備註
熊熊偵探 acc3 改名為飄散花朵，名稱下方以小字顯示「推薦搭配熊熊偵探髮型使用」。備註只作搭配建議，不限制其他髮型穿戴；保留原圖與位置。

## v367 狼爪共戴與耳環分類
狼爪保留手持物分類，使用獨立穿戴位置，可與一件一般手持物同穿；繪製排序固定在其他手持物下方，不受點選次序影響。星夜吟遊裝 acc 前台命名為黑珠耳環並分類為耳環；不改寫後台原始資料。
驗證：新增實際介面共戴、替換手持物、反向點選順序、卸下、保存重開及耳環篩選測試；保留狼耳環依賴與換色回歸測試。

## v366 配件依賴與前台名稱
狼耳環依賴狼耳朵：試穿及保存驗證依賴，卸下狼耳朵時一起移除耳環，繪製時也排除孤立耳環。狼耳朵／尾巴／爪子啟用原有灰階素材換色。熊熊偵探與龐克搖滾狼改用前台物件名稱，移除灰階與圖層前後位置註記；原始資產路徑、圖層位置與順序不變。
驗證：wolf-accessories-v365.cjs 隔離測試無耳朵拒穿、配件連動卸下、背包保存與重開、整套穿搭、繪製依賴及三件配件實際換色；另驗證來源中繼資料、穿搭、染髮交易、大廳視窗與六種畫面尺寸。

## v365 定案聊天氣泡
套用使用者最後匯出的九款配色與名稱，所有頭頂氣泡、商城入口、手帳選用及 VIP 預覽共用 CSS/SVG 渲染。白色基本框免費；六款漸層各 50 金幣永久持有；奶霜小貓、花茶小兔、蜜桃小鳥分別 VIP 1、2、3 解鎖，VIP 4/5 新框待設計。購買沿用金幣交易鎖及待確認紀錄，扣款、收據與持有紀錄一次更新；新氣泡入庫不觸發新時裝特效。保留座椅原模組與 v364 染髮工作室。商城預覽加上輕微整體待機上下晃動，尊重減少動態設定。
驗證：chat-skins-v364 及 payment-safety-v273 通過；本機目視短句、18 字、混合 emoji，核對白框、六款價格、VIP 解鎖和商城入口。未執行正式帳號購買。

## v364 染髮工作室視覺
染髮券頁改為三款拱形配色展示卡，放大既有角色畫布，加入雙色色票與目前試色標示。訂製區以即時色帶、圓形選色器與角色預覽為主，簡化文字並集中購券／保存資訊；付款、持有券數及保存 API 維持原流程。
驗證：dye-studio-v364.cjs 檢查六種視窗尺寸、固定預覽與分類、預設配色選中／自訂取消選中、漸層開關與色帶同步、重設及隔離假資料的購券與保存失敗重試。另執行染髮交易、穿搭狀態與大廳視窗回歸。

## v363 固定試穿區與捲動選物
商城與背包沿用大廳各自入口，移除內部切換列。取消商品及套組分頁，縮小單品格；固定預覽與分類，只捲動清單。染髮入口導航到染髮券分類，三款預設色下方提供訂製主色／髮尾／挑染預覽，沿用購券與保存 API。
驗證：shop-browse-v363.cjs 檢查四種桌面及兩種手機尺寸、清單捲動與固定分類、寵物相對比例、染髮導航／預設色／自訂／重設，以及隔離假資料的購券呼叫與保存失敗重試；未操作正式帳號。另執行穿搭狀態、染髮交易、座椅與大廳視窗回歸。

## v362 商城整體比例
針對現行大廳等比例縮放後的實際 iframe 高度，統一商城／背包桌面排版。標頭固定 88px，分類切換列 48px；當季卡片優先保留商品圖空間，縮減文字區留白，試穿欄依剩餘高度適配。一般商品清單在自己的區域捲動，避免舊 overflow:visible 與 620px 最小高度把卡片推進分頁／操作列。保留角色與寵物原有整組縮放與相對配置，手機背包、飲料卡、座椅與交易資料流程維持原功能。
驗證：shop-layout-v362.cjs 以完整 lobby-view → lobby → 商城 → 時裝間四層畫面，在 1685×900、1920×1080、1366×768、1024×768 及兩種手機尺寸檢查分類、商品圖比例、分頁與試穿操作區、寵物相對比例、背包與頁面錯誤；使用隔離測試資料，未執行正式寫入。

## v361 定案座椅整合
使用者提供的 tt-seats.js 原檔與 8 張 PNG 原樣接入；未改 CFG、動畫、座椅比例或特效數值。檔案 SHA256 為 8086a7902dc0e6edbdefc21db3ac21276935b0fa349944eb0c36ec7f1b291754，Git 關閉該檔換行轉換。
seat3 我生日推車、seat4 蘋果傳說的鏡子接入大廳 render、X 使用／收起、移動淡出、換圖／離線清理。st/sa 納入主大廳及房間 presence 編解碼，遠端使用已接受的最新封包以避免舊封包重播動畫，並以 Firebase 時差同步鏡子循環。
新舊時裝間、背包與掌櫃商品目錄均加入兩款；原有 seat0–2 不刪除。新款使用原模組 thumb，已持有者可設為我的座椅；未持有者沿用既有結帳。沒有預設售價或自動上架，須掌櫃填寫有效價格及上架設定。結帳前再核對價格／上架期限／是否已持有。
驗證：seats-v361、presence-v353/v354、lobby-v346、viewport-v352、wardrobe-state-v276 通過。本機隔離資料實測推車、翻面、X、移動收起、遠端鏡子與晚加入時間保留；時裝間縮圖、價格、結帳入口、背包持有篩選／選用。未執行真實付款；正式兩帳號 Firebase 同步仍需實測。socialV1 分流／私人房規則不在此 repo，尚待取得現行規則確認 st/sa 放行。

## v360 聊天气泡調整頁
chat-adjust.html 提供每款框的尺寸、文字、安全邊界與位置即時預覽、原圖比例鎖定及 JSON 匯入／匯出；保留獨立調整，不擅自套用到正式大廳。



## v357 使用者選定 B 滿版、停用版權測試時裝
使用者比較 A 可拖動地圖與 B 滿版置中後選 B。外層畫面改隨視窗填滿，UI 使用至少 1280×720 的邏輯尺寸等比例縮放；大廳原始 1920×900 圖層以 cover 置中，依視窗比例裁左右或上下，沒有新增的四周留邊。NPC 站位與 GIF 保留 v356 更新。
露亞 cloth0、小莓 cloth1 及其原始頭髮／表情／衣服／配飾從商城與換裝清單停用；相關染色組合不再提供選用。保留持有紀錄與歷史素材；打開換裝時使用可用的基本部件作為替代預覽，實際保存才更新穿搭。新舊購買入口及轉帳／金幣送單前阻擋停用商品，測試發放工具也排除。這是網站程式停用規則，未登入掌櫃資料庫改寫歷史 shopConfig。
驗證：retired-outfits-v357、wide-scene-v356、viewport-v352、wardrobe-state-v276、lobby-v346、mobile-v353、presence-v354 通過；本機實際 B 大廳無留邊、背包頭髮與衣服分類可用且不含退役部件。


## v356 完整加長版背景、縭站位與燈燈動畫
改用使用者 9-30 加長版的 1920×900 原始透明圖層，不裁切、不重繪；鏡頭以全幅寬度縮放。角色與碰撞維持中央 1600×900 座標，圖層左右各延伸 160px，調整頁同步全幅顯示並維持原有設定檔相容。縭依新截圖改為腳底 (410,436)、原圖方向。燈燈替換成 3.調整版跳晃.gif 原檔，96×120／16 幀，保留配置並更新可見邊界與所有使用頁快取版本。十個背景圖層及 GIF 逐位元相符；全幅縮放、手機模式、腳色生命週期與遠端平滑測試通過。


## v352 電腦大廳固定比例與使用者更新 GIF
電腦滑鼠環境從原大廳入口進入 lobby-view.html，將真正的 lobby.html 維持 1280×800 邏輯尺寸並整體縮放置中；視窗改變只更新外層比例，不重新載入帳號／聊天／商城。手機觸控仍進入既有直向／橫向介面。Discord 登入、製作闆卡與外部付款導覽改由外層視窗開啟，避免 OAuth 留在 iframe。窄長 1000×1200、小視窗 800×600 及 1280×800 預覽核對頭像／招牌、聊天／選單不重疊；viewport-v352、lobby-v346、social-v347 通過，真實 Discord／付款流程未操作。
使用者提供的六個 GIF 原樣複製到 img/companions-v352，逐檔雜湊確認相同；大廳、商城、成就、介紹／指南與調整頁同步換路徑並更新相關腳本版本。小花燈為 106×124／8 幀，其餘維持原尺寸／16 幀；同步修正燈燈試穿可見邊界為 [12,12,84,110]，不重新繪製或轉檔。

## v351 NPC 站位與鏡像調整頁
新增 npc-adjust.html，重用正式 TTScene 圖層、深度、尺寸、腳底與寵物配置。可拖曳／點地板移位、獨立切換鏡像、輸入座標與方向鍵微調、放大、隱藏編輯標記、還原單人、瀏覽器自動保存及 JSON 匯入匯出。初始站位取既有三個角落區域，桃在吧台右側；設定使用 1600×900 腳底座標及正式陪玩 ID。編輯頁沒有帳號／資料庫連線，不即時更動正式站位。已核對拖曳、鏡像、數字更新、重新載入保留及輸出設定與畫面一致。

## v350 私訊時間移到氣泡外
時間節點改為訊息氣泡的同層元素，在氣泡外下方靠右顯示；文字與貼圖一致使用小字台灣時間，移除貼圖時間底色。保留訊息增量更新與閱讀位置。已目視檢查，並以實際 DOM 確認三則文字／貼圖時間皆在氣泡外、下方且右緣對齊；social-v347 檢查通過。

## v349 固定站姿彈跳與網站整合
依使用者更正，走路固定 idle 站姿，只保留整隻角色的彈跳／落地變化，腳不交替踏步、手臂不擺動。大廳、商城外框、商品內頁及商品腳本版本連結同步更新，避免重新開啟商城沿用舊頁。使用者要求將 v346–v349 累積修改直接套用網站；示範假資料與控制面板仍留在專案外，不隨網站發布。

## v348 本機待確認：飲料卡保留使用者排版
移除商城與選購視窗的 fitDrinkArt 二次縮放／置中。原本已套用 drink-layout.js 的 320×430 設計座標，之後又依圖片外框重算縮放，導致與調整頁不同。保留三張卡的原始數值、字型、素材及容器等比例縮放；未修改使用者設定。已目視核對桌面商城、選購視窗及手機直向；JavaScript 語法檢查通過。未發布。

## v347 本機待確認：私訊時間與陪玩成就
私訊依訊息 ID 增量更新，保留既有節點及回看位置，只讓新訊息進場；移除重複處理整份訊息的觀察器。文字與貼圖右下顯示 Asia/Taipei 的 HH:mm，小字、不加已讀；送出期間防重複並於成功或失敗恢復按鈕。成就加入縭／蕪／桃原始娃娃 GIF 與十小時頭像框，沿用後端已完成有效服務時數及既有穿戴流程；僅目前帳號後端回傳 unlocked 才顯示解鎖，未自行發放獎勵或猜測進度。
tests/social-v347.cjs、tests/lobby-v346.cjs 通過；隔離瀏覽器驗證訊息節點、回看錨點、貼圖及台灣時間，並目視核對桌面／手機成就與既有頭像框入口。舊 chat-stickers.cjs 在 HEAD 與修改版均缺少 TTWorldScope，不能視為本次全面通過。預覽資料在本機記憶體，未連正式資料或發布。

## v346 本機待確認：彈跳走路、穩定後髮與陪玩留場
恢復原有整體彈跳與四張走路影格，停用大廳角色的逐層頭髮形變，保留眨眼與整體待機呼吸；減少動態效果偏好停用整體彈跳／縮放。大廳選單置於招牌下方，手機首頁沿用入口區並跟隨版面切換。陪玩依 staffStatus 名單直接出現在崗位，上下班不進出場，離線灰燈、待接單綠燈、接單中紅燈；被刪除的名單仍移除角色，點單資格沿用原判斷。
本機通過 tests/lobby-v346.cjs、movement-v278.cjs、scene-v265.cjs，並在隔離預覽操作選單與上下班切換。bridge-motion-v271.cjs 在原版與修改版均因測試環境缺少 isDrink 而失敗。未發布；動畫手感待使用者目視確認。

## v345 試穿人物與寵物等比例縮放
修正 v344 只縮人物、寵物各自限制寬高造成的比例偏差。試穿人物與跟隨寵物共用一個縮放容器，沿用調整頁的 160px 人物基準及使用者提供的三組寵物大小、左右與腳底相對高度。依角色實際像素與原始 GIF 全 16 幀可見範圍計算留白，保留浮動特效、像素顯示及原始動畫；圖片載入後和預覽框變更尺寸時重新整組適配。桌面／平板／手機、較矮當季預覽、三隻寵物實際試穿與卸下、染髮視窗返回、重新開啟與背包預覽檢查通過。只修改試穿呈現，NPC 原配置與資料保存流程未變動。

## v344 人物與寵物試穿留白
有跟隨寵物時，試穿人物縮小並靠左排列，保留寵物顯示大小；預覽高度不足時一起限制顯示高度。手機改用整列預覽，避免人物和寵物擠在半欄。卸下寵物即恢復原本單人尺寸與版面。以大髮型與三款寵物檢查 1280／768／390／320 寬度、可見像素不重疊、商城／背包及較矮的當季試穿區；只改預覽排版，未更動角色資料或保存流程。

v267：採用「頭髮晃動試做.html」大幅度（1.5 倍），待機每 230ms／四幀、走路每 140ms／八幀。頭頂固定，髮尾延遲晃動；只補原圖相鄰髮絲形變後產生的縫，沿用鄰近像素的染色及漸層。每位角色快取最多 48 張，部件載入時清除，低效能／減少動畫模式停用。保留 v266 眨眼與 v265 場景遮擋／通行設定。

v268：頭髮影格加入 DOM 狀態方便核對實際大廳，輕量特效模式保留快取頭髮動畫。

v269：以各髮層實際髮尾高度計算晃動權重，待機雙向展開／收回，避免短於固定 56px 的頭髮取整後幾乎不動。幅度仍為 1.5 倍。正式角色以 canvas data-hair-frame 核對待機、走路影格。

v270：撤回近似頭髮效果，完整移植使用者「頭髮晃動試做.html」：原始反向取樣、頭頂與身體同步、髮尾慢半拍、手臂／衣襬與腳步分幀（含四色膚色）。待機 230ms 四幀、走路 140ms 八幀、幅度 1.5。移除疊加的原本整體呼吸縮放／跳動傾斜，保留接地、眨眼及髮絲補縫。並排比較使用同款後髮2／前髮2／衣服3。

v271：修正真正阻擋動畫的 tavern-ui-bridge.js 繪製包裝，轉傳全部參數（原先漏掉第四個 motion），讓 v270 動作進入正式 renderer。新配件頭頂層跟隨相同頭部位移。新增經實際 bridge＋setFrame 的整合測試，防止只驗證直接 renderer 的盲點。

 v272：補合成角色形變後新露出的單像素髮縫，沿用原髮色，不改既有不透明像素。形變位移按列預算、重用暫存畫布及 CPU 讀取模式，剛體層直接位移；圖片載入刷新合併至每個畫面一次。外觀沒變的同步不重繪，非目前場景角色停止繪製並釋放快取。每次 tick 約 6ms 後延後尚未產生的影格，下次重試（非單張處理時間上限）。保留 v270 大幅度與 v271 bridge 動作轉傳；金流、訂單、Firebase 寫入未變動。新增補縫／同步／刷新測試與影格延後／隱藏角色測試。


v273：使用者授權修正交易與權限問題並要求至少連續三輪全通過。單人與多人金幣付款改用伺服器 increment＋多路徑 update：餘額、訂單、交易明細、商品一次原子提交，失敗不扣款、不發商品，移除先扣後退的中間狀態。跨分頁 Web Locks＋本機未確認紀錄；逾時不解鎖，結果不明不重送；以伺服器重新查核舊訂單後才解除紀錄。轉帳訂單與證明也合併寫入。信用卡／超商金流尚未開通且 pay.tinytavern.tw TLS 查驗失敗，入口標示申請中並預設銀行轉帳；回跳參數不再宣稱付款成功。錢包／禁言監聽去重與舊帳號回呼隔離。兩份舊場景座標測試遷移到繪師 v265 分層像素，場景本身未改。新增真實 Firebase Database Emulator 與三輪完整測試腳本。安全規則僅新增整數非負餘額驗證、禁止訪客初始化金幣、限制 config 與 adminUid；仍需後端驗證會員身分與逐帳戶授權，不能以本輪測試宣稱可正式營利。

v274：修正商店商品付款仍使用舊排版。商品結帳沿用新版霧紫付款視窗，使用商品專屬標題、兩步流程及商品／應付金幣摘要；切換陪玩與商品時清理彼此的內容。保留既有付款事件、優惠券、餘額不足鎖定與交易寫入。

v275：修正染色組合預覽沿用整套立繪定位，造成縮圖疊在右下；組合分頁隱藏無關空部件格與分頁。新版名簿／衣櫥開啟時計入背景節流，非可見分頁略過世界運算。鏡頭尺寸改由 ResizeObserver 更新，靜止鏡頭停止重寫樣式，避免逐幀讀寫交錯排版。保留 v270 頭髮動作參數與付款邏輯。
染髮拖色同一畫面合併為一次繪製，只畫可見染髮角色；修改組合名稱不重畫。桌面／手機染色卡片邊界及 100 次色票事件合併驗證連續三輪通過。

v276：全面複查時裝間。保存染髮的部件比對改為欄位語意比對，避免資料庫鍵順序不同而阻擋換衣。重新開啟保留 uiBaseSlots、染色組合、寵物及座椅；寵物／座椅可卸下且不借用整套預設補回。整套縮圖與試穿使用同一組搭配資料，避免繼承目前角色染色／部件設定；失敗試穿不先更新選中標示。染髮保存後導向背包染色組合頁。
保存染色結果與重試也改為部件語意比對，資料庫鍵排序不再誤判失敗。以本機完整頁面＋正式 renderer、實際部件、隔離寫入模型重現 v275，再跑桌面／手機共三輪 13 項流程；另有十組功能回歸測試各三輪通過。

v277：依使用者選擇，背包的頭髮分類拆成「原有髮型／我的染髮」，移除獨立染色組合主分類，顯示保存數量與再次穿戴不扣券說明。保存新染髮後直接切到頭髮→我的染髮；商城整套組合維持原入口。


v278：修正場景 nearest 每幀四捨五入導致高更新率裝置小於半像素的走路位移消失。有效位置保留小數，碰撞仍以原像素遮罩與 2px 邊距檢查；無效位置沿用最近安全點校正。重現舊版 240Hz 垂直、360Hz 水平無法移動，新增七種更新率速度一致與 21 條攤位繞路測試，保留吧台露頭通道。


v279：吧台右側斜角的露頭通道終點往內縮，保留角色身體遮擋所需空間，修正只檢查腳底導致抬高角色從桌側露出。碰撞、尋路、舊座標校正共用 validInt 限制；左端進出與中央露頭不變。


v280：繪師 20261006 素材更新。保持前／後髮索引 2（測試）、3（初始女）、4（初始男）不變，lobby 與 card 共用六張新版原圖。新增無大廳入口的掌櫃套裝調整室，沿用 Firebase 掌櫃身分檢查，只讀 adminUid；兩套新時裝預覽、位移縮放層序、草稿套裝組、JSON 匯入匯出與透明 PNG 合成。草稿保存在瀏覽器，未寫入正式商城或設定價格。GitHub Pages 靜態素材本身不是伺服器保密儲存。

## v281 掌櫃展示染髮
調整室頭髮支援單色與雙色漸層、方向與起訖範圍、同套前後髮同步。染色設定隨草稿、套裝組與 JSON 保存，透明 PNG 使用相同染色繪製；舊 v280 設定預設原圖色。染色快取按圖層保留一份，不改商城染髮與會員資料。

## v282 前後髮連動
調整室預設前後髮連動，位置與大小以相同增量修改並保留相對差異，髮色同步套用；可取消勾選個別調整。層序、顯示與套裝勾選維持個別控制。

## v283 當季套組與時裝間
掌櫃核准中華小惡魔、心動情人兩套各 300 金幣。當季展示僅列 featured=283 的兩套，使用掌櫃提供的漸層展示圖；原髮型保留灰階染色能力。商品透過掌櫃匯入頁交易新增，不覆寫原有商品。心動衣服合併下褲、襯衫、披風、披肩；同部位配件預先組合，避免整套試穿漏件。時裝間新增響應式展示版面。

### v283 上架資料載入補充
掌櫃可直接載入已核對的兩套上架資料（img/season-v283/products.json），確認後交易新增，免本機選檔；匯入器資源版本 284。

## v285 當季套組首屏完整顯示
桌面當季分類依 iframe 實際高度分配圖片與操作區，兩張套組卡及購買按鈕不得超出首屏。手機先顯示兩張並排套組卡，試穿舞臺位於下方。其餘分類保留捲動瀏覽。

## v286 視窗背景頭像干擾
名簿／時裝間開啟時，暫時隱藏大廳個人 HUD 並暫停其頭像框動畫；關閉恢復，不移動、不重建頭像 DOM。

## v287 配件拆分與點選卸下
中華小惡魔的蝴蝶結、翅膀、紅寶石髮飾、小惡魔角改為四個獨立配件，沿用繪師原始圖層，可各自搭配／卸下。紅寶石限定波浪雙馬尾及中華風包包後髮，換不適用後髮會卸下。舊組合穿搭讀取時展開，新穿搭標記版本避免卸下的配件被補回。已搭配的配件、寵物、座椅再點一次卸下，卡片顯示狀態；保留穿上搭配的保存步驟。不修改商品、持有紀錄、價格、結帳或 Firebase 寫入流程。

## v288 背包背景玩家閃現
玩家 DOM 建立後先隱藏，實際套用世界座標後才顯示，避免背景節流期間從左上角出現。沿用 tt-approved-open 狀態，背包／時裝間／名簿開啟時只隱藏世界中的角色與其互動，關閉恢復；試穿預覽不受影響。未變動玩家同步、位置回報、金流或 Firebase 寫入。

## v289 移除周邊專區與染髮券排版
移除大廳周邊專區 NPC、標籤、閒聊台詞、彈窗與空白鍵入口。背包預覽區的色票及染髮券改為內容高度，避免窄欄文字超出卡片；保留既有染髮與購買行為。

## v291 當季新品與獨立挑染
熊熊偵探、龐克搖滾狼加入商店試穿，售價未定，不開放購買。原始 32 張素材保持不變；搖滾狼預設持吉他，爪子可替換。當季每頁兩套，原有套裝可切頁選購。保留主髮色及髮尾漸層，新增獨立挑染色並同步前後髮；挑染與其他髮色在同一筆染髮券交易保存，一次一張，重試不重複扣券。未擁有髮型只可試色。未修改正式資料庫規則、商品資料與錢包。大廳 v290 效能實驗不在本次發布範圍。
`nv294：移除闆卡與手帳頭像框外的重複角色，只保留框內頭貼或小人。隔離瀏覽器驗證 1280／390／768 寬度、三款框、重開、照片與手帳分頁返回；不更動交易及資料庫寫入。

v295：更正 v294 誤判，恢復闆卡與手帳框外裝飾小人。真正修復花圈框內 canvas 繼承舊 pcTop 紫框陰影與固定尺寸，框內定位對齊花圈開口。驗收改為框外小人保留、框內無舊方框且填滿定位容器，三種尺寸通過。

v296：好友清單改通訊錄，提供搜尋、好友／邀請／封鎖與屏蔽分頁、未讀與所在大廳提示。名稱與識別碼使用 DOM textContent 與閉包處理器避免字串插入。保留原有好友及私訊操作，未更動資料庫權限；三種尺寸隔離 UI 驗證通過。

v297：右下功能收為我的酒館六分頁（通訊錄、信箱、訂單、錢包、成就、設定），移動原有視窗節點而不複製訂單或處理器，關閉恢復原位置。保留時裝／背包／點單捷徑與未讀提醒、原有建卡門檻。三尺寸切換、返回原視窗及互動測試通過；付款流程未改。


## v311 飲料寵物
新增三款飲料寵物的商城支援，每杯 99 金幣。使用提供的 PSD 可見圖層輸出透明圖；保留原檔。寵物商品獨立分類、商品縮圖與角色旁穿戴圖分離，結帳名稱使用寵物。正式商品以新增三筆方式上架，不修改其他商品、持有紀錄或付款流程。桌面／手機／平板隔離驗證商品、試戴與卸下像素及結帳金額；未建立實際付款訂單。


## v312 陪玩十小時角色框
沿用三份原始 PSD 可見圖層，新增大卡／卡布／小mo角色框。各自累積已結束服務的後端計時達36000秒解鎖，暫停不累計、每筆不超過核准時段、重複結單不重複給時數。前端補登秒數不直接換取獎勵，舊資料不自動補發。框套用由後端檢查本人身分、角色所有權與已累計時數；資料庫規則拒絕直接偽造陪玩框。切換帳號清空獎勵狀態，保留原VIP與花圈框及框外角色。


## v353 — 手機功能首頁與遠端移動連續性
- 手機（無精細滑鼠／hover）固定功能首頁，直向橫向皆不顯示 2.5D 場景；停用世界 tick 與位置發布。主要入口為點單、背包，保留訂單進度；手機背包不提供商城切換。窄桌機仍使用固定比例大廳。
- 移除同地圖相差超過 96px 就直接跳位的接收規則，依更新間隔在 120–650ms 內平滑收斂；延遲舊封包不回拉角色。首次出現與換地圖仍直接定位。
- 驗證：presence-v353（150/350/700/1100ms 間隔、延遲修正、亂序、停止、換圖）、mobile-v353、viewport-v352、lobby-v346、social-v347。手機直橫向、背包與點單以隔離資料瀏覽器檢查；未以真實帳號付款或宣稱實網延遲測試。舊 presence-v231 的 claimMe 測項因既有身分保護拒絕切換他人角色而不相容，未修改身分保護。


## v354 — 掉幀／背景恢復後的遠端角色跳位
- 回歸重現 v353 在 500ms 畫面停頓後一次移動 125px。接收端改為累計實際顯示步進、每次最多 50ms；大幅修正限制 320 世界像素/秒，避免背景恢復一次補完整段。
- 新封包先推進上一段，再從當前顯示位置銜接；保留時間順序檢查、首次與換圖定位及停止精確收斂。v353 測試改用連續畫格驗證收斂，不再把長時間無渲染當成正常幀。
- 大廳固定視窗入口與內頁固定載入 v354，保留其他查詢與 hash，避免外框使用新版本但內頁沿用舊版查詢。
- 驗證 presence-v354、presence-v353、viewport-v352；實網多人環境未確認根因，未宣稱所有瞬移情況已消除。


## v355 — 套用使用者匯出的 NPC 站位
- 依小小酒館-NPC站位設定.json：蕪 (551,438) 原向、縭 (307,777) 原向、桃 (1398,466) 鏡像；世界 1600×900，腳底錨點。固定站崗、狀態更新及刷新都沿用設定，不再隨機換位。
- 站崗 NPC 保留指定座標，不被玩家走路碰撞校正推開（蕪的位置原會被推下 5px）；玩家移動碰撞不變。角色與寵物保持調整頁原有尺度、朝向與遮擋規則。
- 調整頁預設位置一併更新；現有瀏覽器儲存草稿保留。

## v358 — 較小的大廳介面、設定內的分流、背包通知與手札頭貼
- 桌面常駐 HUD、標題、聊天與功能按鈕縮小至 85%，聊天記錄高度上限 140px；背景 B 滿版相機、世界座標、NPC 站位及手機功能模式不變。
- 大廳選單移至設定，設定改為內容高度的小視窗；分流縮為單欄短列表，保留登入、建立／加入房間、邀請碼及現有處理器。
- owned 訂閱第一次快照只建立基準，後續新增才慶祝；移除輪詢，避免慢載入的既有背包被誤認新時裝。帳號切換解除舊監聽，拒絕延遲回呼、重複訂閱與重播通知；染髮資料不當作時裝。
- partner.html 的角色手札頭貼依角色 ID 使用縭／蕪／桃原始 staff GIF，不再使用這三位的舊 avatar 欄位；未修改資料庫或繪師立繪。
- 驗證：lobby-v358（首載／新增／重播／帳號切換／三位頭貼）、lobby-v346、viewport-v352、wide-scene-v356、mobile-v353 通過；手札內嵌 JS 語法及大廳、設定、分流與手札本機實際畫面確認。房間連線與帳號操作未用測試資料寫入正式資料庫。

## v359 — 聊天預設無框、較大的文字與清晰造型框
- 預設氣泡改成無框文字，移除背景與尾巴並加高對比文字陰影；舊版自動套用的餅乾框回到無框，其他已選造型保留。圖鑑新增「無框文字」，主動選用餅乾框仍可保存；pub.bub 一併支援 none。
- 氣泡字級統一為 22 世界像素（原 10–13.5），長句維持字級換行，不再縮字。各框尺寸計算使用相同的字體大小／行高，花框沿用原站位與裝飾校正。
- 使用者新上傳的 2172×724 透明 PNG 原封不動存入 img/chat-frames-v359.png；泡泡、餅乾、夢落星間在繪製時各取對應區域，未改畫素材。其他框保留原檔。
- 驗證：bubbles-v359（預設遷移、造型選擇、本機／遠端選款一致、發佈、長句字級），bubble-calibration（字數、組字輸入、emoji），chat-stickers、viewport-v352、lobby-v346。更新兩項舊測試環境，使其支援既有 module 與 TTWorldScope。六款短句與 18 字長句本機目視確認，無正式聊天資料寫入。

- Discord 小頭貼載入失敗時，帳號列和闆卡改用本機預設頭像；缺少帳號 ID 時不組出無效頭貼網址。

## 2026/11/08 v504 小屋串門子（Claude；與扭蛋上線同一版）
- D 原意：在「自己的小屋」跟朋友一起聊天（不是參觀別人家），一間最多 4 人（主人＋3 位）；可以隨機拜訪別人的小屋。
- 資料（規則第 14 批，`tests/security-rules-v428/build/harden-phase14.cjs`，測試 test-phase14 89 項）：
  house/<key>/vis（公開預設／只限好友／不公開）；houseView/<key> 擺設快照（客人用它畫房間，讀不到 house 本身）；
  houseDir/<key>{at,n,on} 隨機名單（公開且擺 5 件以上；on＝主人在家心跳，隨機先挑有人在的）；
  houseRoom/<主人>/<0～3> 四個座位＝最多 4 人（規則擋第 5 人；45 秒沒心跳可被接手；onDisconnect 自動起身）；
  houseChat/<主人> 小屋聊天（要坐在座位上、沒禁言）；houseVisit/<主人>/<客人> 來玩紀錄＋讚；houseKick 請離開（10 分鐘內不能再進）。
- 前端：lobby-ui/house.js（座位、位置每 0.2 秒回報、心跳 15 秒、聊天、串門子側欄、邀請卡、請離開、隨機拜訪），
  house/room.html 的房間畫面多了 PEERS（其他人當 1×1 地板物件排前後、名牌與泡泡是 DOM 疊層）、spawnAt（四個座位站開）。
  room.html 是用 patch 改的，同樣改動已寫進 tt-room-kit/house-lobby/house-early.js、house-embed.js（之後 build.py 重建會帶到）。
- 邀請＝私訊帶 house:<key> 的訊息，dm-log.js 畫成「進他的小屋」邀請卡；通訊錄好友列多一顆「小屋」。
- 順手修：進小屋換名牌字會把大廳人數 #cnt 一起換掉，大廳 sync() 第一行就報錯、背景不再更新（v494 起就有）→ 改成先收起來、回大廳再放回。
- 上線前：Firebase 發布規則（含第 14、15 批）→ Push。實測腳本 scratchpad/visit/multi.cjs（三個分身＋模擬資料庫，16 項）。
- 順手修：大廳入店歡迎卡（#intro）原文有禁用字（虛擬角色／乾淨無擦邊／金流透明），改成「這裡是像素風的小小酒館。找冒險者一起打遊戲、語音聊聊天，或在大廳隨意晃晃——慢慢來，當自己家就好。」

## 2026/11/09 v512 正式營運事故修正：吊卡倒數、語音登記錯誤、機器人私訊冒險者（Claude；後端 deploy-v511 另外部署）
- ⚠ 號碼：v510＝11/09 緊急修正（b9c6c87）、v511＝小屋朋友走路修正（0522dd6），兩個都以正式站為底先上；下面「v510 小屋商城」那一段的內容實際跟著 v512 一起上。吊卡／語音錯誤／手札計時／朋友走路在 v510、v511 已經上了，v512 沿用。後端部署腳本名稱仍叫 deploy-v511。
- D 回報（11/09 正式營運）：①冒險者才剛接單、人沒到齊、還沒開始計時，老闆左上吊卡就在倒數 ②接單後票卡沒語音房、機器人沒私訊冒險者、語音頻道沒建（D 手動開房），老闆票卡跳「語音連線尚未完成，請稍後重試」③要求「一但有指定陪玩的單，請讓機器人傳送私訊通知給陪玩通知叫他接單」。
- ① lobby.html activeOrder()：冒險者在手札按「開始」（partner startTimer 寫 clientOrders/<id>/servingSince）才算開始；接單但沒開始回傳 waiting:true，
  吊卡（#playCard.waiting，黃點）只寫「縭 接下你的委託囉／到 Discord 跟冒險者會合，開始玩之後才會開始算時間」，不倒數、沒有續單鈕，openRenew 提示「開始玩之後就可以續單囉」；
  預約單離開始超過 30 分鐘、或接了 6 小時都沒開始的不掛吊卡；有正在玩的單優先顯示正在玩的。sessionEndOf 不變（partner 續單判斷仍用）。
- ② 原因在 api 主機：老闆點單後網站要呼叫 /v1/voice/order 把單登記進語音系統（orderVoiceV1），冒險者接單（/v1/voice/accept）、語音房、機器人私訊全部接在這一步後面；
  主機回了網站沒列過的錯誤代碼，網站一律顯示「語音連線尚未完成」，而且 flush() 遇到錯誤就 break → 第一筆卡住的單會擋住之後所有的單。真正被拒的代碼要在主機上看（ops/diag-voice-v511.sh）。
  網站（lobby-ui/order-voice.mjs?v=511，lobby 與 partner 都改引用 511）：補列 TOO_MANY_ACTIVE_ORDERS／CHARACTER_REQUIRED／ORDER_GROUP_MISMATCH／INVALID_STAFF／ORDER_ALREADY_LINKED／ORDER_ACCESS_DENIED／INVALID_SESSION／TEMPORARILY_UNAVAILABLE／ORDER_NOT_READY；
  沒列到的顯示「語音房還沒建好，系統會自動重試（代碼 XXX）」——以後看老闆截圖就知道卡在哪；永久錯誤（ORDER_NOT_ELIGIBLE／ORDER_EXPIRED／ORDER_GROUP_MISMATCH／INVALID_STAFF／ORDER_ALREADY_LINKED／ORDER_ACCESS_DENIED／INVALID_REQUEST）從待登記清單拿掉，
  其他錯誤換下一筆繼續登記（只有主機忙線／沒有代碼才停下來等下一輪）。
- ③ 後端新模組 order-voice-bot/staff-order-dm.cjs（ops/deploy-v511.sh，security-v428 分支；以主機現版 20261107-v498b 為底，只新增這個模組＋測試，service-server.cjs 在 orderNotify 那行後面接三行）：
  監聽 clientOrders（近 2 小時建立的），委託（play）＋有 staffCid＋status confirmed＋還沒接＋沒退款＋非測試單 → 用 DISCORD_BOT_TOKEN 私訊 orderVoiceV1/staffBindings/<cid>.uid（要已驗證且與 staffAccounts 一致）。
  金幣單＝下單當下；轉帳單＝店長確認收款（pending→confirmed）那一刻。內容：「縭，你有一筆新的委託，請到手札接單！」方案／金額／老闆／時段（預約附日期）／同組人數／手札網址，不 @ 任何人。
  去重 orderVoiceV1/staffOrderDm/<訂單>（transaction，兩台同時跑、重啟都只發一次）；送之前重讀訂單，已被接走／取消就不發；沒綁定記 not_bound、關私訊記 blocked、不重試；Discord 429 會等。
  健康檢查多等 STAFF_DM_READY。測試 staff-order-dm.test.cjs 8 項；deploy 腳本用 TT_ROOT 假主機跑過「準備檔案」段（service-server 只多 3 行、node --check 通過）。
- **語音登記被拒的最可能原因（本機用後端 10 月版 booking-voice 實測）**：registerOrder 要讀 secureV1/characters/<闆卡>/name，這份資料網站不會寫、開店後新做的闆卡都沒有 → CHARACTER_REQUIRED（網站以前顯示「語音連線尚未完成」）→ 沒語音房、沒私訊、手札計時（/v1/voice/time）也被擋。網站寫出的單人／同組委託格式本身沒問題（補上名字就登記成功）。
  deploy-v511.sh 一併修：booking-voice.cjs 兩處（先讀 peiwan/lobby/<闆卡>/name，角色名字讀不到就用它；找不到預期片段就 SKIP 不動）。實測 scratchpad/v511/t_register_patched.cjs、t_approve.cjs（登記→兩位冒險者各自接單→語音單 confirmed、冒名確認被擋）、後端自己的 booking-voice-test 6 項都過；部署時容器內也會跑 booking-voice-test。
  主機上的程式可能跟 10 月版不同 → 先跑 diag 看「試跑：被拒 …」是不是 CHARACTER_REQUIRED。
- 手札計時與報單（service-timer.mjs）不再被語音主機卡住，已在 v510 緊急修正上。
- ops/diag-voice-v511.sh（只讀）：服務紀錄代碼次數、冒險者 Discord 綁定、36 小時內每組委託在語音系統的狀態（語音單／冒險者確認數／工作階段／私訊結果）；
  沒登記到的用主機上的 booking-voice.registerOrder「試跑」（只讀資料庫代理：寫入丟錯、transaction 只算不寫）印出被拒代碼。已在本機模擬器實跑：資料庫完全沒變。
- 測試 scratchpad/v511/t_v511.cjs 8 項（吊卡等待／開始後倒數／續單提示／語音佇列不互擋、代碼顯示）；partner.html 載入無錯。
- 版本：verTag v512、ver.json 512、lobby-view 512、house.js VER 512（house.js／house.css／house-trip.js?v=512）、partner verTag v419／PT_VER 20。
- ⚠ 主機那段（診斷＋部署）要在 DigitalOcean 主機 root 終端機跑；Claude 用內建瀏覽器開主機終端機被安全機制擋下，需要 D 本人執行或同意。

## 2026/11/08 v510 小屋商城（壁紙／地板一格一格貼）、進出小屋轉場、進小屋就從大廳消失（Claude；需發布第十九、二十批規則＋店長頁上架）
- **小屋商城**（D：「壁紙跟地板都要做可以直接貓貓幣購買的」「小屋右下角多一個商城，專門賣之後每個系列的壁紙跟地面」「可以選擇想要哪個牆壁和地板格子，不用全換」）：
  右下多「商城」鈕（#ttHouseMall，佈置右邊、扭蛋左邊），開的是原本家具店那個視窗（houseShopM，家具店按鈕 v507 起藏著）換標題「小屋商城」（shopHead）。
  商品：shopConfig house:wall_<系列>／house:floor_<系列>（type 小屋壁紙／小屋地板，price 50＝500 貓貓幣，cur cat），目前 forest、mermaid；
  購買走家具同一條路（buy：clientOrders＋扣貓貓幣＋catTx＋houseInv/<key>/wall_forest/<訂單>），買一次就能貼任何一格。
  佈置的背包多兩個分頁「貼壁紙」「鋪地板」：點系列拿在手上（「原本的」＝還原），房間裡點一格貼一格、按住拖曳連續貼（從房間外按住拖曳仍是移動視角），整間貼上／整間還原，Esc 放下。
  資料 house/<key>/paint {f:{'i_j':系列},w:{'L3'／'R3':系列}}（L＝左牆 i=0 沿 j、R＝右牆 j=0 沿 i），存檔跟擺設同一次 update（只有這次動過 paint 才帶 paint 欄位，舊規則下照樣能存擺設）；
  拜訪快照 houseView/<key>/paint 一起帶。
  房間（house/room.html，直接改；同樣程式貼在 tt-room-kit/house-lobby/house-embed.js，room.html 的 drawShell 另外加了 drawPaint()／drawPaintHover() 兩行，重建要記得補）：
  主題房外殼 2 倍圖 house/paint/<系列>_<14|18|22>.png（tt-room-kit/room/spr/room_<系列>_N_x2__iso_pixel7.png，用到才載），照格子剪下來疊在原本外殼上；同一系列的格子併成一條路徑一次剪（不會有縫）；
  牆段的剪裁範圍包含牆頂與牆厚，牆角、牆尾多包一點。商城縮圖 house/paint/<系列>_wall.png／_floor.png（從 14 格外殼裁的牆角、菱形地板）。
  店長頁「上架貓貓幣商品」多這 4 件（cat-shop-import.js?v=510）。之後新系列：把外殼圖放進 house/paint、PAINT_META（room.html）與 PAINTS（house.js）各加一筆、上架。
- **規則第十九批**（harden-phase19.cjs、test-phase19 16 項）：house／houseView 的 paint 每一格只能是主人 houseInv 裡有的 floor_／wall_<系列>，格子編號 0～99、系列名小寫英文，其他欄位拒絕。
- **進出小屋轉場**（D：「這應該也要轉場動畫才對」）：house-trip.js TTHouseTrip.curtain(文字,小字)——九條斜色條關上、中間深紫牌子「回小屋囉／回大廳囉」、換好畫面（房間畫好）才拉開（至少 0.9 秒，8 秒保險）。enter()／exit() 都有；隨機拜訪照舊用選角過場。
- **進小屋就從大廳消失**（D：「他們進小屋應該就會移動到小屋了吧，怎麼會還在大廳」）：在小屋裡（body.tt-house-on）位置封包 m='house'，presence.js 收到 house 就不在大廳畫面上（仍算在線，好友照樣看得到、邀得到）；回大廳換回 hall。舊版分頁會把 house 當大廳（更新提醒會讓大家換新版）。
- **冒險者上班＝手札開著＋勾上班**（11/08 晚實際發生：冒險者打卡後關掉手札、人不見了，大廳仍顯示待接單，老闆點了三人即時單沒人接；取消時只退成一筆——
  退款要「那位冒險者的手札」或店長頁開著才會處理，另兩筆卡著，老闆重按又因 cancelReq 已存在被規則擋，跳「送出失敗」。D：「他們要開著頁面並勾選上班才上班，頁面一關掉就是離線」）：
  partner.html（verTag v418、PT_VER 19）：上班時 armDuty＝伺服器 onDisconnect 寫下班＋每分鐘寫 seen；網路閃斷重連（.info/connected）自動補回上班；
  開頁時資料庫說上班但 seen 舊／沒有＝上次沒下班留下的 → 收成下班，seen 很新＝另一台開著 → 一起接手回報。原本「斷線不算下班」的設計拿掉。
  lobby.html：staffLive()——上班中但 150 秒沒 seen 一律當離線（舊版手札、關掉網頁、當機都算），STAFF_ALL 與站崗燈號都吃這份，每 30 秒重算。staffStatus 規則沒有欄位限制，不用改規則。
- **取消申請修正**（D 11/09「一起做」，退款處理要放哪：「那就店長頁吧，我自己的頁面最清楚」→ 不讓其他冒險者的手札代退；那位冒險者自己的手札處理自己的單照舊）：
  老闆端（lobby.html）：新增 myCancelReqs（cancelReq 依 myKey 查詢，要 Discord 登入；讀不到時看本機 tt_cancelreq）與 cancelStateOf(id,o)＝'pending'／'failed'／null；
  已申請的單重新整理後顯示「取消處理中，確認後金幣會退回你的錢包」、不再給取消鈕（cancelReq 一筆單只能送一次，以前重按就「送出失敗」）；
  沒退成（例如冒險者已接單）顯示「這筆沒辦法自動取消…需要幫忙可以回報問題」（不露 why 原文，裡面有「陪玩」）；送出被拒時先查這一筆，已經存在就當處理中。
  舊版訂單卡與新版票卡（lobby-ui/live.js?v=510）都吃 cancelStateOf；原本掛在訂單物件上的 cancelPending 會被訂單監聽換掉、重整就沒了，已拿掉。
  店長頁（admin.html）：coLoaded——訂單資料載完才處理取消申請（以前取消申請常先讀到，超過 10 分鐘的會被判「找不到這筆訂單」不退款）；
  客訂分頁上方新增「↩ 取消申請」卡（cancelCardHtml）：處理中、沒有自動退款的（要你看一下，附「取消並退款」＝原本的 coCancelRefund）、最近 24 小時已退款（收合）。
  規則不用改（發布中與新版規則都已重播：讀自己的允許、讀別人的拒絕、同一筆重送拒絕、被拒後查這一筆允許）。
  測試 scratchpad/cancel/t_cancel.cjs 17 項（大廳＋店長頁，本機預覽＋模擬資料庫）、t_rules.cjs 14 項；payment-safety-v273、mobile-v353、hub-actions-v299、social-v347 通過。
- **錢包用金幣兌換貓貓幣**（D：「兌換按鈕應該直接設在錢包裡，可以自己輸入要多少貓貓幣、需要多少金幣，一鍵兌換」）：lobby-ui/cat-coin.js EXCHANGE_ON=true（v493 關掉的原因已不在：現在貓貓幣能轉扭蛋、買壁紙地板、擴建、買日常時裝）。
  錢包貓貓幣區：快速選 1,000／3,700／11,000、輸入「想要多少貓貓幣」（10 的倍數，無條件進位）→ 即時顯示需要幾金幣、加送、兌換後餘額；金幣不夠鎖住並給「去儲值」；
  ttConfirm 確認後走原本的 exchange()；planFor 會挑「拿到至少想要的數量、金幣最少」的換法。介面實測電腦／手機各 39 項（助手，scratchpad/exch）。guide.html 錢包章節同步。cat-coin.js?v=510。
  **匯率改成 1 金幣＝5 貓貓幣**（D 11/09：算出 NT$1,000 原本能抽 91 抽〔一抽約 NT$11〕太便宜，「五貓一金」）：加送照比例 350 金幣→150（共 1,900）、1,000 金幣→500（共 5,500）。
  cat-coin.js 拆出 EX＝5 給兌換用（gain／planFor／parseWant／輸入框步進），商品標價 price() 照舊 ×RATE（10），規則的 catAmount＝amount×10 不變。
  規則第二十批（harden-phase20.cjs、test-phase20 13 項）：catTx 兌換 amount＝coin×5＋(350?150:1000?500:0)，舊匯率一律拒絕；test-phase9 的兌換案例改成新匯率（剩那兩項 11/07 前的舊每日任務測試照舊失敗）。
  換算（森林卡池模擬一萬次）：NT$1,000＝1,000 金幣＝5,500 貓貓幣≈45 抽（一抽約 NT$24）；3 件限定全拿平均約 NT$1,800、整套 37 件平均約 NT$3,300。免費玩家（每日任務＋掛機）不受影響。
- 版本：verTag v510、ver.json 510、lobby-view 510、house.js VER 510（room.html?v=510）、house.css／house-trip.js／presence.js／cat-coin.js ?v=510。
- 測試（scratchpad/paint/t_paint.cjs，本機預覽＋模擬資料庫）19 項：轉場出現／拉開、pos m=house、商城四件、買壁紙扣 500 進背包、買完直接拿著貼、貼 8 段牆、鋪 7 格地板、存檔與快照、Esc 放下、回大廳轉場、m 換回 hall、沒有頁面錯誤。

## 2026/11/08 v509 日常系列（貓貓幣免費時裝）重新取名
D：「新的免費時裝跟眼睛你是不是用原檔案名，幫忙取一下部件名字」——原本是 11/05 樣稿暫定名，有幾件跟圖對不上（蓬鬆長髮其實是外翹中長髮、柔順短髮其實是亂翹短髮）。
tavern-ui/daily-v494.js NAMES：髮型 俏皮外翹髮／甜心側馬尾／刺蝟短髮／隨性短髮；眼睛 紫晶大眼／森林綠眼／淡定眼／瞇瞇笑眼；
上衣 愛心白T／藍白水手衫／金星深藍T／海軍條紋T；下衣 黑色直筒褲／深色百褶裙／丹寧吊帶褲；套裝 森林帽T洋裝／草莓蛋糕裙。
草稿名優先（bridge 合併 shopConfig 時不拿 live.name），所以不用改資料庫；店長頁商城清單仍顯示 shopConfig 裡的舊名（客人看不到），已買過的訂單紀錄保留當時的名字。
版本：daily-v494.js?v=509（lobby、admin）、verTag v509、ver.json 509、lobby-view 509。

## 2026/11/08 v508 隨機拜訪過場動畫＋全站查 bug 第二輪＋八項優化（Claude；需發布第十八批規則）
- **隨機拜訪過場**（D：隨機拜訪要跑過場，顯示對方頭像、頭像框、闆卡內容）：lobby-ui/house-trip.js（TTHouseTrip），八種樣式 A～H
  （雜誌斜切／抽牌翻面／敲門開門／小地圖／星空傳送／明信片／拉霸轉盤／雜誌封面），共用一張資料卡（頭像框＋全身小人＋名字、在家、VIP、房間大小、家具數、標籤、常玩、生日、一句話）。
  流程：洗牌候選人 → 秀這一間 → 房間載好且至少 2.6 秒才離場；客滿／沒開門蓋章換下一間；右下「略過」、Esc。正式用哪種改 house-trip.js 的 STYLE。
  D 選了 A 再要「更好」→ 做 A1～A6 加強版（VAR 功能組合：ax 共用加強、mz 雜誌卡〔切角框＋錯位條紋紙、深紫英文小標帶 TINY HOME ✦ VISIT／No.末四碼、列編號 01/02、引言線〕、
  sh 九條斜色條快門、geo 畫出來的細線／轉動菱形／漂浮三角／虛線圓／網點＋卡片出現時往外噴的小圖形、gl 虹光毛玻璃、cs 底片選角〔候選人排成底片、取景框跳格、選中畫粉紅圈〕），
  背景大字改成每一間的編號 No.XXXX。**D 定案 A6 雜誌全套（ax mz cs geo sh）**，STYLE='A6'。
  D 一度說「隨機就是只放一個人」→ 其他 A 版改成找人時只有剪影＋問號（ONE()：show 先不露臉、done 才翻卡、客滿只蓋在剪影上）；D 看完仍選有底片的 A6（底片版不走 ONE）。
  本機試看：lobby.html?preview=1&tripdemo=1 左邊有試看面板（可勾「先遇到一間客滿」）。house.js：profileOf、roomReady、randomVisit 改寫、TTHouse.tripSample。
- 小屋（house.js）：伺服器時間 SNOW()（電腦時鐘快慢，別人的小人會整個看不到）；拜訪等座位時按回大廳不會再被帶進去（S.tok）；
  座位被換掉／放棄時取消舊的「斷線自動起身」；進門讀不到小屋資料改成請他再試（原本當新小屋，入住禮會蓋掉擺設）；
  擴建扣款前重讀資料庫的大小（另一個分頁已擴建或上次結果不明時不重複扣）；在按鈕上按 Enter 不再被搶去聊天框。gacha.js：關掉扭蛋頁清掉通知（記憶體累積）。
- 大廳：闆卡被刪後「登入記住的舊闆卡」造成無限重整 → 換身分前確認闆卡還在、忘掉舊登入鑰匙、30 秒最多換 3 次（ttIdSwitchOk／ttForgetLogin）；
  被擠出最新 120 筆的在線老闆先留著、進房間停掉額外監聽；聊天「歷史那一批」改看資料載完（不靠本機時鐘），歷史不算未讀；
  「陪玩資訊卡」改「冒險者資訊卡」並拿掉「立繪卡面即將登場」；入店閘門確認中先透明（不閃登入卡），超過 8 秒才顯示「連線中」。
- 社交：封鎖時一併收回我送出的邀請、好友／邀請不列封鎖的人；好友動作與私訊檢舉等資料庫回覆，失敗會說；私訊視窗開著但分頁在背景不算已讀；
  通訊錄沒開著不重畫；私訊裡按封鎖要確認了才關；手機版分頁不算「正在用視窗」（不然手機永遠不自動更新）；手機私訊分頁第一次不再閃電腦版視窗。
- 商店：染髮保存只檢查瀏海＋後髮（試穿別的衣服時存不了）；結帳「還差 N 貓貓幣」不見了（.pay-short）；沒付款取消的線上儲值手帳寫「沒有完成」；
  確認選購開著時 Esc 只關它；訂單票卡：商品單不寫「與 X 一起玩」、金幣付款寫「金幣」不寫 NT$；慢付款後按鈕字還原正確；
  啟程旅人的黑珠耳環（沒編號的 acc）規則不收單買 → 不列單買。
- **規則第十八批**（harden-phase18.cjs、test-phase18 10 項；3、11、14～17 批重跑通過）：封鎖後對方不能用舊邀請把自己加回好友；
  擺設只認 shopConfig 售價大於 0 的家具（11/08 舊版店長頁把 71 件扭蛋家具 0 元寫進 shopConfig，原本沒抽到也能擺出來給人看）。
- 只回報、沒改（金流／訂單，要 D 決定）：扭蛋回應遺失時客人會再按一次再扣一次（要主機收 requestId 去重＋逾時）；商品單會帶上剛點過的冒險者 staffCid
  （訂單資料，冒險者那邊也看得到）；下身／外套／手套單買價跟規則的配件價不一致時會付款被拒（看店長設定）。
- 待 D：店長頁 Ctrl+F5 後再按一次「上架貓貓幣商品」（擴建兩級還沒上架；扭蛋家具已不會再 0 元上架）。
- **八項優化**（D：「看起來都能做欸 你直接做一做吧」；全是畫面，扣款／訂單／寫入邏輯沒動）：
  ①扭蛋結果「去擺放」（g3d.js 只在正式版有 HOST.place 時出現；gacha.js TTGachaHost.place(keys) 關扭蛋 → TTHouse.placeNew(keys)：進佈置、拿起 keys[0]、標 NEW；keys 限定→稀有→普通不重複）
  ②「我的家具」NEW 膠囊（本機 tt_house_new_<key>：起點取 houseInv 第一次讀到時的伺服器時間與最新 ts，ts 比起點與「拿出來時看過的時間」新才算；拿出來就消失、排最前面；bagPick 共用）
  ③扭蛋鈕下「抽完剩 N／還差 N 貓貓幣」、十連貼「十連必得一件稀有以上」（主機沒有累積保底，所以不寫「再 N 抽」；g3d.js?v=79，tt-room-kit/gacha 同步）
  ④擴建確認時房間先畫出擴建後的地板（room.html TTRoom.previewSize(n|null)：只換畫面與鏡頭，走路／擺放／存檔仍是原大小；粉色 L 形新地板＋虛線＋「擴建後 18×18」牌；確認視窗移到左邊聊天框上方；
   取消／點外面／Esc／離開小屋都收回；按擴建先收預覽再走原本 expand()；同樣程式寫進 tt-room-kit/house-lobby/house-embed.js）
  ⑤收到私訊小卡（lobby.html：dmMeta 未讀增加且那段對話沒開著才跳；封鎖／屏蔽／非好友不跳；背景分頁只記最新一則、回來跳一次；點一下開對話，6 秒自動收；樣式 lobby-ui/lobby-notes.css）
  ⑥聊天框頂端每日任務進度（說一句話 ✓／待滿 10 分 N/10，領完顯示「今天的每日任務已完成 ✓」8 秒後縮成小勾；手機不顯示；吃 TTDaily 原本的計時 stayTick）
  ⑦大廳教學錢包後加「掛機收益」一步（#ttIdleHud 不在就跳過）
  ⑧分頁在背景超過 3 分鐘先停掉 pos 監聽（自己照常寫位置），回來第一筆當重新載入：新來的馬上出現、走掉的馬上消失（window.ttPosSync() 看狀態，測試可設 window.__posPauseMs）；lobbyWant 個別監聽保留不拆。
  版本：house.js VER 508、house.css／lobby-tour.js／lobby-notes.css ?v=508、gacha.js VER 508。
  測試：social-v347、presence-v353/v354、hub-actions-v299、mobile-v353、payment-safety-v273、chat-skins-v364、secure-login-v428、viewport-v352、cart-checkout-v501 通過（lobby-v346 從 v499 就失敗，未變）。
  本機預覽實際隨機拜訪（A6）：底片 → 圈選 → 翻卡 → 門開了 → 進到小月家，沒有程式錯誤。

## 2026/11/08 v507 小屋聊天貼圖、右下只留佈置＋扭蛋、小屋擴建（Claude；需發布第十七批規則＋店長頁上架）
- 小屋聊天貼圖（D：小屋聊天也要能發貼圖）：跟大廳同一套貼圖代碼「[貼圖:sticker-NN]」（TTChatStickers），走同一條 houseChat（120 字內），不用改規則。
  聊天框左邊貼圖鈕＋上方貼圖選單（house.js STK_ICON、.tt-hc-pick），紀錄顯示小圖，房間頭上冒圖片泡泡（room.html peerSay 收 {img,name}）。
  小屋聊天也加了 1.2 秒只能送一則（同大廳）。
- 右下只留「佈置」＋粉色「扭蛋」（D：家具店跟扭蛋定位重複）：#ttHouseShop 隱藏（扭蛋鈕靠它定位、openShop 程式保留），
  我的家具「去家具店」改「去扭蛋」，小屋教學第 2 步改扭蛋，大廳教學小屋那步改「抽扭蛋拿家具」。
- **小屋擴建**（D：花比較多貓貓幣可以擴建）：14 → 18 → 22，一次一級，入口是右下「擴建」鈕（D：單獨一顆、放在佈置左邊；價格要店長上架才出現，擴到 22 或在別人家就不顯示）。
  價格：shopConfig/house:size18＝300（3,000 貓貓幣）、house:size22＝600（6,000 貓貓幣），店長頁「上架貓貓幣商品」會新增，之後可在資料庫改 price。
  購買＝家具同一條路（clientOrders itemId house:size<N>、paidBy cat＋扣款＋catTx），同一次寫入 house/<key>/size、sizeRef（訂單編號）、at、layout。
  拜訪快照 houseView/<key>/size（14 格不寫，規則還沒發布時照樣能寫）。房間：18／22 的外殼另存 house/room_18.png、room_22.png，用到才載；
  room.html 的 HOUSE_SHELLS／houseSetSize／TTRoom.size()、setSize()，房間大小由大廳 TTHouse.roomSize() 給。
  ⚠ 這次是直接改 house/room.html（同樣改法已寫進 tt-room-kit/house-lobby 的 house-early.js、house-embed.js、build.py；build.py 會輸出兩張外殼）。
  重建後要照舊跑 pin_live.py（試建出來的圖集跟正式站不同）。退款擴建訂單不會自動縮回，要店員把 house/<key>/size 改回去。
- **規則第十七批**（tests/security-rules-v428/build/harden-phase17.cjs，test-phase17 19 項；9～16 批重跑，第 9 批 2 項是 11/07 前的舊測試照舊失敗）：
  house size 只能往上一級、同一次寫入要有這張新的擴建訂單（本人、itemId 對、貓貓幣、金額 ≥ shopConfig 價），店員可直接改；houseView size 不能比 house size 大。
  預覽頁實際送出的擴建寫入用正式規則重播：允許、同一筆再送被擋；舊規則下整筆被拒、不扣錢。
- 店長頁「上架貓貓幣商品」：順手修——扭蛋家具（price 0）不再上架（上架成 0 元的話客人可以自己寫 0 元訂單拿走扭蛋家具；正式站目前沒有這種資料）。
- 上線順序：①發布 security/database.rules.json ②推網站 ③店長頁商城分頁按「上架貓貓幣商品」（新增兩級擴建）。

## 2026/11/08 v506 大廳新手教學（Claude；D：「第一次進來也要有像小屋一樣的新手教學，他們才知道這邊可以點陪玩」）
- lobby-ui/lobby-tour.js（TTLobbyTour.run／auto）：用小屋同一套 TTCoach，8 步——你的小人（WASD／空白鍵互動／點別人看闆卡）→
  冒險者（「待接單」＝有空、點兩下看介紹卡）→ 我要點單 → 錢包（金幣／貓貓幣）→ 聊天室（每日任務）→ 商城與背包 → 小屋 → 我的酒館。
  只在電腦版大廳：闆卡做好、登入完、沒有視窗開著才自動跑一次（tt_lobby_tour_v1）；看過舊入店小卡（tt_seen_intro）的老客人不自動跳；
  小人或冒險者被鏡頭裁到畫面外就不圈、說明卡置中。設定視窗新增「大廳教學・看一次」列（#setTourRow，手機隱藏；嵌在我的酒館裡也會先關掉）。
- 舊入店小卡 #intro 不再自動跳（寫「點地板走動」已過時，桌機只能 WASD），程式與按鈕保留。
- 同版另一個 session 改小屋：客人看得到的「串門子」改「拜訪」、邀請好友只列在線好友（house.js／house.css）。
- 同版扭蛋十連結果「名牌互相擋到」（D 截圖；Windows 125% 縮放等畫面較擠時，擺家具用的名牌寬度是估的）→ g3d.js unclutter()：名牌畫出來後照真實大小重排
  （名牌不互疊、不出畫面、不壓標題／金幣／兩顆按鈕；按鈕列外框橫跨整個畫面，只閃真的按鈕）。g3d.js?v=78、lobby-ui/gacha.js VER＝506。
  測試（扭蛋 session scratchpad labels.cjs／labels2.cjs）：舊版在擠的畫面幾乎每次十連都有名牌疊到或壓到介面，新版 192 次十連 0 問題。

## 2026/11/08 v505 全站查 bug（Claude；D：「請查修整個系統的 bug 越來越多了」）
- **改版號規則新增**：根目錄 `ver.json` {"v":505} 要跟 lobby.html verTag 一起 +1。大廳每 10 分鐘＋切回分頁時讀它，
  比左下角新 → 跳「酒館有新東西囉」小卡；分頁在背景 20 分鐘以上、沒開視窗沒打字 → 直接重新整理。
  起因：客人分頁開好幾天停在 v488，舊版每日任務送 10 金幣被 11/07 起的規則拒絕，每說一句話（含貼圖）就跳「再說一句話」。忘了改 ver.json 只是不提醒。
  電腦版是 lobby-view.html 包著 lobby.html：提醒的重新整理會整頁（外框）一起重來；lobby-view 的 v 參數照舊每版 +1（這版 505）。
- 在線小人防閃（D 回報不在的客人小人閃一下）：pos 原始資料 posRaw → presenceView() 才給 posMap。剛出現等 1.2 秒、
  消失先留 6 秒（只留本來在畫面上的）、10 分鐘沒心跳當不在（剛載入用封包時間 t 估）；自己的位置被晚到的離線清除刪掉 → 下一幀補寫。
  原因推斷：網路重連時舊連線的 onDisconnect 晚到，刪掉剛寫回的位置。測試腳本 scratchpad/visit/flash.cjs（A～E 五段時間軸）。
- 大廳名單＝limitToLast(120)＋在線的人＋自己（lobbyWant 逐一監聽 lobby/<key>）；原本客人超過 120 位後，舊客人上線看不到、連自己都不見。
- 聊天：自己的歷史訊息重新整理後也顯示（只略過這個分頁剛送的 CHAT_SENT）、同一則只畫一次、掌櫃刪的留言從大家畫面拿掉、
  沒送出標「沒送出去」並把字放回、1.2 秒內只能送一則、t 改伺服器時間、桌機最小化也亮未讀紅點、舊聊天清理用伺服器時間。
- 每日任務：今天用伺服器時間算；「再說一句話」提醒一天只跳一次（localStorage tt_daily_fail_*）。
- 禁言：window.ttIsMuted()（看 until，期限過了就不算）；私訊、小屋聊天、小屋邀請都改用它（原本期限過了還是被擋）。
- 小屋：座位被清掉先坐回去（被請離開／客滿／沒開放才離開並說原因）、重連後重設 onDisconnect、空位優先、
  坐下途中按回大廳不再開出幽靈小屋、面板與聊天只在有人進出時重畫（原本每 0.2 秒重畫，按鈕點不到）、
  新小屋改開放設定連同擺設一起存、家具全收回背包（有 at 沒 layout＝空小屋，不再擺入住禮）、空房間也能拜訪、不在隨機名單不送在家心跳。
- **規則第十六批**（tests/security-rules-v428/build/harden-phase16.cjs，測試 test-phase16 14 項；14、15 批重跑通過）：
  house 有 layout 或 at 都可以、houseView 可以沒有 layout（要 vis、at）、socialV1 房間位置封包接受座椅 st（seat3／seat4）、sa（>0）。
  ⚠ 推 v505 前 D 要先到 Firebase 發布 security/database.rules.json。
- 私訊／好友：提示 toast z-index 450（原本被私訊、我的酒館蓋住）、確認框 .ttc 300（檢舉對話確認框在私訊後面）、
  Esc 關私訊一起停監聽、開著的對話未讀收回 0、紅點只算現在的好友與冒險者（刪好友／封鎖時清 dmMeta）、
  好友改名顯示最新名字並更新自己名單那筆、闆卡上「好友邀請已送出」／「接受好友邀請」、手機不自動播背景音樂（手機沒有開關）。
- 商店顯示：貓貓幣不夠又沒開兌換時不給「去兌換」連結、購物車「這次」用貓貓幣、等待確認中…放開後還原按鈕字、
  手帳最近的單：貓貓幣單顯示貓貓幣、取消的商品單不再寫「入手了」；時裝間座椅／染髮券改標金幣、VIP 限定不再寫尚未開賣（live-wardrobe.js）；
  掛機收益存滿時多等 5 秒安全時間才能領、啟動失敗可恢復、手機錢包頁不重複出現（idle-income.js）；桌機錢包說明改「線上付款自動入帳」（live.js）。
  其他：夥伴頭像框兩台裝置不同時名牌資料整包被拒 → 拿掉框再送；accounts 寫入加 catch。
- **入店歡迎卡改版**（D：「這個版型…被說是 AI 常用的版型」＝上面大圖＋標題＋整排大按鈕）：大廳 #dcGate 與闆卡工房 #notice
  共用 lobby-ui/welcome-gate.css：英文小標＋細線、鏤空大字（WELCOME／HELLO，手機不顯示）、斜放切角圖框、01/02/03 步驟
  （#dcGate data-step：沒闆卡＝1、要登入＝2，目前這步有滑出色塊＋NOW，做完的步驟列尾打勾）、斜切按鈕、會動的幾何（細線畫出、菱形、三角、四芒星）。
  D 第二輪（「排版很微妙」「意義不明的橫條可以拿掉」）：拿掉深紫跑馬燈；內文改成一個格子——圖框｜步驟 頂端對齊、說明｜按鈕 底端對齊
  （手機：圖→步驟→按鈕→說明）；幾何只放標頭右側（等比例縮放的 svg），不再沿外框畫線；標題前改實心四芒星（空心方框轉到正面像缺字）。
- 沒動、要 D 決定（訂單相關，CLAUDE.md 規定不自己改）：同一張單第二次續單會被規則擋（renewReq 已存在就不能再寫）、
  取消申請送出後重整再取消一次會被擋（cancelReq 同理）。
