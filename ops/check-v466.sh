#!/bin/bash
# 小小酒館主機資安健檢 v466 —— 只讀取、只列印，不修改任何設定或檔案。
# 不會印出任何密碼、金鑰或環境變數的內容（只看檔案權限與是否存在）。
set -u
say(){ printf '\n== %s\n' "$*"; }
UNIT=/etc/systemd/system/tinytavern-service.service
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" 2>/dev/null | head -1 | cut -d: -f2)
REL=/opt/tinytavern/releases/service-$CUR

say "系統"
. /etc/os-release 2>/dev/null; echo "OS=$PRETTY_NAME kernel=$(uname -r) uptime=$(uptime -p)"
echo "需要重開機套用更新：$([ -f /var/run/reboot-required ] && echo 是 || echo 否)"
echo "可更新套件：$(apt list --upgradable 2>/dev/null | grep -c upgradable)；其中安全更新：$(apt list --upgradable 2>/dev/null | grep -c -- -security)"
echo "自動安全更新：$(systemctl is-enabled unattended-upgrades 2>/dev/null || echo 未安裝) / $(grep -h 'Unattended-Upgrade "' /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null | tr -d '\n')"
df -h / | tail -1 | awk '{print "磁碟使用："$5"（剩 "$4"）"}'

say "對外開放的連接埠"
ss -tlnH 2>/dev/null | awk '{print $4}' | sed 's/.*://' | sort -n | uniq | tr '\n' ' '; echo
ss -tlnpH 2>/dev/null | awk '$4!~/^(127\.|\[::1\])/{print "  "$4" "$6}' | sed 's/users:((//;s/,pid=[0-9]*,fd=[0-9]*//g;s/))//' | sort -u
echo "防火牆 ufw：$(ufw status 2>/dev/null | head -1)"
ufw status 2>/dev/null | sed -n '4,30p' | sed 's/^/  /'
echo "DigitalOcean 雲端防火牆需在主控台查看（這裡看不到）"

say "SSH 登入"
sshd -T 2>/dev/null | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|maxauthtries|port) ' | sed 's/^/  /'
echo "  root 授權金鑰數：$(grep -c -E '^(ssh-|ecdsa-)' /root/.ssh/authorized_keys 2>/dev/null || echo 0)"
echo "  fail2ban：$(systemctl is-active fail2ban 2>/dev/null || echo 未安裝)"
echo "  近 24 小時 SSH 失敗登入次數：$(journalctl -u ssh -u sshd --since '24 hours ago' 2>/dev/null | grep -c -E 'Failed|Invalid user')"
echo "  最近成功登入：$(last -n 3 -w 2>/dev/null | head -3 | awk '{print $1"@"$3" "$4" "$5" "$6" "$7}' | tr '\n' ';')"

say "機器人服務"
echo "目前版本：$CUR  狀態：$(systemctl is-active tinytavern-service)"
grep -E '^(ExecStart|User|EnvironmentFile)' "$UNIT" 2>/dev/null | sed -E 's/(-e [A-Z_]+=)[^ ]+/\1***/g' | sed 's/^/  /' | cut -c1-300
docker ps --format '  容器 {{.Names}} 映像 {{.Image}} 連接埠 {{.Ports}}' 2>/dev/null
CID=$(docker ps -q --filter name=tinytavern-service | head -1)
if [ -n "$CID" ]; then
  docker inspect "$CID" --format '  容器內使用者：{{.Config.User}}（空白＝root）  特權模式：{{.HostConfig.Privileged}}  唯讀根目錄：{{.HostConfig.ReadonlyRootfs}}  網路：{{.HostConfig.NetworkMode}}  重啟策略：{{.HostConfig.RestartPolicy.Name}}  記憶體上限：{{.HostConfig.Memory}}'
  docker inspect "$CID" --format '{{range .Mounts}}  掛載 {{.Source}} -> {{.Destination}} 可寫={{.RW}}{{"\n"}}{{end}}'
  echo "  Node 版本：$(docker exec "$CID" node -v 2>/dev/null)"
fi
echo "設定檔權限（只列權限，不看內容）："
for f in $(grep -o -E 'EnvironmentFile=-?[^ ]+' "$UNIT" 2>/dev/null | sed 's/EnvironmentFile=-\?//') /opt/tinytavern/*.env /opt/tinytavern/env* /etc/tinytavern/* ; do [ -e "$f" ] && stat -c '  %A %U:%G %n' "$f"; done 2>/dev/null
find /opt/tinytavern /etc/tinytavern -maxdepth 3 \( -name '*.json' -o -name '*.env' -o -name '*key*' -o -name '*secret*' -o -name '*cred*' \) -perm -o+r -not -path '*/node_modules/*' -not -path '*/assets/*' 2>/dev/null | head -20 | sed 's/^/  ⚠ 其他使用者可讀：/'

say "套件已知漏洞（npm audit，只列數量）"
if [ -d "$REL" ] && command -v docker >/dev/null; then
  for d in $(cd "$REL" && ls -d */ 2>/dev/null | tr -d /); do
    [ -f "$REL/$d/package-lock.json" ] || continue
    R=$(docker run --rm -v "$REL/$d:/w:ro" -w /w --entrypoint npm tinytavern-service:$CUR audit --omit=dev --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s).metadata.vulnerabilities;console.log(JSON.stringify(v))}catch(e){console.log("無法讀取")}})' 2>/dev/null)
    echo "  $d：${R:-無法執行}"
  done
  [ -f "$REL/package-lock.json" ] && echo "  根目錄：$(docker run --rm -v "$REL:/w:ro" -w /w --entrypoint npm tinytavern-service:$CUR audit --omit=dev --json 2>/dev/null | grep -o '"vulnerabilities":{[^}]*}' | tail -1)"
fi

say "HTTPS 憑證"
for h in api.tinytavern.tw pay.tinytavern.tw; do
  E=$(echo | timeout 8 openssl s_client -servername $h -connect $h:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  echo "  $h 到期：${E:-無法連線或憑證錯誤}"
done
echo "  反向代理：$(systemctl is-active caddy 2>/dev/null)/caddy $(systemctl is-active nginx 2>/dev/null)/nginx"

say "對外 API 回應標頭"
curl -s -o /dev/null -D - -X POST https://api.tinytavern.tw/v1/voice/session -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{}' 2>/dev/null | grep -i -E '^(HTTP|access-control|server|x-powered|strict-transport|retry-after|ratelimit)' | sed 's/^/  /'

say "近一天服務錯誤"
docker logs --since 24h tinytavern-service 2>&1 | grep -i -E 'error|exception|unhandled|EACCES|denied' | sed -E 's/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}/***TOKEN***/g' | cut -c1-160 | sort | uniq -c | sort -rn | head -12
echo
echo "CHECK_V466_DONE"
