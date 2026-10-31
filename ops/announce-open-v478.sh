#!/bin/bash
# 小小酒館：機器人到「酒館小報」發試營運開幕公告（一次性）。在主機 root 終端機執行。
# 會先印出要發的內容與頻道，輸入 y 才發送；同一則公告用固定 nonce，短時間內重複執行不會重發兩則。
set -euo pipefail
docker inspect tinytavern-service >/dev/null 2>&1 || { echo "找不到 tinytavern-service 容器，停止。"; exit 1; }
MSG=$(cat <<'TXT'
📣 **小小酒館・試營運開跑！**
各位旅人好～小小酒館從今天起正式開始試營運啦 (｡•ᴗ•｡)♡

🧹 先前註冊的測試資料已經全部清除，請用 Discord 登入，重新做一張屬於你的闆卡吧！
🎁 **開幕禮**：11/1～11/7 期間註冊成功，就送你站內 **350 金幣**，會自動存進錢包～
歡迎老闆們來嚐鮮，找陪陪一起打遊戲、聊聊天 ✧*｡

酒館祝大家玩得開心 🍻
TXT
)
run(){ docker exec -i -e TT_MSG="$MSG" -e TT_SEND="$1" tinytavern-service node - <<'JS'
const T=process.env.DISCORD_BOT_TOKEN,G=process.env.DISCORD_GUILD_ID,H={Authorization:'Bot '+T,'Content-Type':'application/json'};
(async()=>{
 const chs=await (await fetch(`https://discord.com/api/v10/guilds/${G}/channels`,{headers:H})).json();
 const c=(chs||[]).filter(x=>[0,5].includes(x.type)&&String(x.name).includes('酒館小報'));
 if(c.length!==1){console.log('CHANNEL_NOT_UNIQUE 找到 '+c.length+' 個名稱含「酒館小報」的頻道，停止');process.exit(1)}
 if(process.env.TT_SEND!=='1'){console.log('頻道：'+c[0].name+'\n----\n'+process.env.TT_MSG+'\n----\n（下面附「前往酒館網站」按鈕）');return}
 const body={content:process.env.TT_MSG,nonce:'tt-open-20261101',enforce_nonce:true,allowed_mentions:{parse:[]},
  components:[{type:1,components:[{type:2,style:5,label:'前往酒館網站',url:'https://tinytavern.tw'}]}]};
 const r=await fetch(`https://discord.com/api/v10/channels/${c[0].id}/messages`,{method:'POST',headers:H,body:JSON.stringify(body)});
 console.log(r.ok?'ANNOUNCE_POSTED':'ANNOUNCE_FAILED '+r.status+' '+(await r.text()).slice(0,200));
})().catch(e=>{console.log('ANNOUNCE_FAILED '+e.message);process.exit(1)});
JS
}
run 0
read -r -p "確定發送這則公告嗎？(y/N) " ok </dev/tty
[ "$ok" = y ] || [ "$ok" = Y ] || { echo "沒有發送。"; exit 0; }
run 1
