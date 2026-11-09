#!/bin/bash
# 小小酒館後端 v512（取代還沒跑的 v511；v511 若已部署會自動跳過重複的部分）：
# 1. 語音登記修正：開店後新做的闆卡沒有 secureV1/characters 名字 → 登記被拒 CHARACTER_REQUIRED（接單後沒語音房、沒私訊）；
#    改成讀不到時用大廳闆卡名字（booking-voice.cjs 兩處；程式跟預期不同就跳過這項）。
# 2. 指定冒險者的委託一成立，機器人私訊那位冒險者「有新委託，請到手札接單」（staff-order-dm.cjs）。
# 3. 老闆升上 VIP：TT 在「🎉｜vip升級」頻道 @所有人恭喜並 @ 本人（不列獎勵），另外私訊老闆本人這一級的獎勵（vip-celebrate.cjs；頻道沒有就建，大家看得到、只有 TT 能發言；
#    第一次啟動只補發 48 小時內剛升級的；每一級升級都 @所有人）。
# service-server.cjs 只在訂單通知那行後面多接幾行。其他功能完全不變。
# 在主機的 root 終端機執行。任何一步失敗都會停止；健康檢查失敗會自動還原舊版。
set -euo pipefail
R="${TT_ROOT:-}"
TAG=20261109-v512
UNIT=$R/etc/systemd/system/tinytavern-service.service
say(){ printf '\n== %s\n' "$*"; }
CUR=$(grep -o 'tinytavern-service:[A-Za-z0-9._-]*' "$UNIT" | head -1 | cut -d: -f2)
SRC=$R/opt/tinytavern/releases/service-$CUR
DST=$R/opt/tinytavern/releases/service-$TAG
say "目前版本：$CUR"
[ -d "$SRC" ] || { echo "找不到目前版本的資料夾 $SRC，停止。"; exit 1; }
[ ! -e "$DST" ] || { echo "$DST 已經存在（可能已部署過），停止。"; exit 1; }
SS="$SRC/order-voice-bot/service-server.cjs"
ANCHOR="server.once('draining',()=>orderNotify?.stop());"
[ "$(grep -cF "$ANCHOR" "$SS")" = 1 ] || { echo "service-server.cjs 找不到訂單通知那一行（或不只一行），為了安全停止，沒有任何變動。"; exit 1; }
! grep -q "vip-celebrate" "$SS" || { echo "service-server.cjs 已經接過 vip-celebrate（v512 已部署過），停止。"; exit 1; }
[ -f "$SRC/order-voice-bot/staff-names.cjs" ] || { echo "找不到 staff-names.cjs，停止。"; exit 1; }
command -v python3 >/dev/null || { echo "主機沒有 python3，停止。"; exit 1; }
say "建立新版本 $TAG"
cp -a "$SRC" "$DST"
base64 -d > "$DST/v512.tgz" <<'B64'
H4sIAAAAAAAAA+w7a3fURpb5zK8Q58xBki2rHxizUUc2BjuznoCdsU2yWdvjVbfUbsXdUltSG5t2
7zEPA8YQmDwgIexkMpmER4AQsiGEAPtfJla7/Ym/sPdWldTqhzEkm9nJOdMHbHWp6tat+763rm1H
N5yuedvMGF1p24u5npbNdtlkVC/Imbfdl372Jw6fnu5u8hs+Tb8TuxM9e19K7Enu7U7E9yZ6YDzR
ndybfImL//ytt/+U4MQOx/09tvpH/PAl1+BczzEzHp/aEYtx83sSCW7g6aMrPy6fW3+wvP74VPXq
avXcaf/Olc2Pbm68c2Pjykn/0p2nj87Vvlyr3XmveuMT/6Pr6w8f+se/2Vw+tnHtWO362c3lKxuf
fL7x7Rd0CUymI/6FL9d/uFR953MC4diPy+dxSwp9/eEp/9S7m1du1pZXcI9r79euXwYMqmcubny5
9vTRmc3Tf/S//2z9hw+rt548ffRfm1/cWn9wNnj7ce3xqv/gGxj3H17e/OC7jb88rN08X33/Pkze
PP4ZwPHP/PD00SqgEmLMcIW3j8+HW/vv/FBdXatevU2x/HH5OEHxqwsbt0/Bd//CzY2PHiFatz4F
nIiivIHa80aC6s4IjgwUYq/Urh+H+b3cxvvXOc/RLFfLeKZtcdWL9wEJf+WGf+Guf/Fc9aPjte/+
+OPysc3T5/0PPtk88Xj9wfnq1RPwFTYCjBkGUdpwA6abga25oQHOv3Cpdvom14rIftPSTWvGBUyu
vVtbvdcL6Prf3du8cbl2exWAbNw/BlQnJPm4eu9d+tW/+3Xt+ofrD9bWn5wCnAAVQAIxyNiW63Fl
Ahl2L+a1xWGtYFRUx5grmY4h8DKzHRYMu2g4eDHFlvW/PqTyOc8rukosplPc5YxdiGlFMzafiPPB
xEzeLKrCvGSp/xIX1d4xkEtrRpjv6+N5UXYM2DVjCLGJyRIaji78lcjiz73ZqdiMxHONsyYmpwTx
ld7/WOqY/k/yPvp6Hw7s+9vyGgy6eaCbEJesEONswVMLrtpbpl+L6kj6bSPjyVnHLgxagJbhCpZx
hBuyvLw8oHnGuFkwXrWdguYJ/NFc1/ibvFT2YOzfbctQ+H7X1GLjmlk0TF4q2JaXU3irVDBA7XhJ
1xYj33J2yVH4ZJduzpgeTDatkmdEBvB9IqlktbxrVEQ5S/Yct1/XHI+ihNgIw6VC2nCEgiuKolzQ
isKC2juxIHuLRUNakOe1fMmYEsWUY3glx+KKMsGpk4/xnUUZ8OkEUsIT7tXJK/hI8UhVAgK93j86
Pjw4On149GCdtZ5pLXravOFYsnckVgSULMORc14hDxxGIa59cYyZBmZErlA1B9FEiSLSfiy0N6HI
wyBIbmgIAIOs6RQMnc7fPH4S5BfUFdfee7f2ly83l5ep8FY//Kr64Fbtxhew2Y5syaIaeESzgFa2
WN7BcYwCO3fau3YhdewsZ6uqytuE3/yuXTYhGg4hhnx9lkzE/YCp4zuXSCqZHgzLecOa8XK9cdiF
49gbr+Ti9PAEsGKnLWuZjFH0DJ18oSpmgCpYbMQxAHUdvwAyhuuNWPnFnarqOSUjtaOyo34wUDxX
mzHY0ZhK2aal2nJRM/X9i7j3ES2fN9DYBzNwI1edIGjyHR18J2qh0KzpAsMMn6X6KUUpGRc7ebBo
64//DJwDywiGsnrpbmjCqafwz9yNmlUw/rCTRPcMfnd0VC99X/30TEcHCAZDAzDPaxbZtAc2CgQb
aFawS5Yn9gmw9xm+9cXSEk7H0/fxHHUdIMmcv3KCJ/iu8qICBiHcugaCdPlU49ZoyqTuOJsEA2nb
ngU+IyMcwzWceaOfoNDRsfnnixv/fRKMefXOtwwI2BAhOg/2gxPWZ2xceOJfvY5W+fw3MBxQa5WR
o36iGccuFcfMo4bYm2C7LX+08e1Jf+VrLnry+jw8O89F3RpQW1SsUj7fRHPKDv/JudrNP21+8k31
zP+A7wGH4q994P/w0P/8MbLv+of+k8uAK+PgOdC6c5uX1vxra+DBq6vn6XPt+hk4BjgLBjtiIuD7
lJw18x7gCZZoAaQXcRFTdQ1ES+sZlqcQcZTfBsYJ/KQFHAJ5tY8Y+nQB3oKUu0oZLItrKBNTlUqj
/GMo541FvLBQ1tOSZ88alpQ1vExuqFDMq+RJAkdgO54qgJspVyTLPqKi4ZThQcoDl9NaZvaQqyY7
euL4LwH+RnLzhlEkbgHt7OvgCkzXEBy11zU8tP92yRMcCW1uhSigmRWYsSAo7KzbiaUlMsJMxCug
Ql7OsY9wg45jOwI/Nt7/6qvTA4emx0deGxyePjQ0NjY0/FterOtsQXNmXVVPo20Q+C2jEKDeXMko
GerEFH3QVUR9zPAEMQVWgEuX3EWV+BLJ9exiESaQb7iT5i5aGS4kLvhqoWB4OVuXipqXk9K2vkiO
yXHghASEpnmeUSh6ajzFnl7pDp46O9nc4ASOqh3RTPC0AV8EiBI6CeQy2yZnaHAK4Hd/Cb475lEN
EVH4/bYHck/Zyh+gYtM1DpQGBdeKRXDmZGLsbde2+ApBVPnd2MiwTKlvZhcFgrzkmjOWllf60yAJ
Y+RZ9hgfkeFx4GOKIQ28dGR7VmTSSnF3ZNxCaJwUWvnu5MtiGcmCc9UkwEt5zmKZfDsE50SfKuzG
fSTyNWOYeUFohIwBCyya1rKgOkQKwbAlCWpwyEyuXKHziWgK+CimUJHAW4OzbkWrV90Da8vRRQit
QwjYlBDbAMBDZGzdUOkJyGMLojgKRjfAiy2lcs2iJ81FigtMygeGxg6MjA5M850BdqJEYCtRIsZ3
79pFNlQR9fjePh704sDBkbHBAWB3K4yAZRSB59h+dHB89K3pwX/71/7DY+MANEBiywl0h0qrhrDI
dkgfyQoZcI1U4Km4pwOCba2zYcAO/gdWy7YFQSlPYjUe6AsPgaRRkNr2IPszGXSGzwESZGRnuk+G
2M3Mmoa+tLRT65MxY5kHpgqarIEKHjYhBEnXH8NRsGzhsBioCBr4KLoQKLF4Pi2XTNihIRz/AyPe
dAzDdLqOAYr9YVIvJ3qkZLLymxgJgATYps/UlWCLNrwolgpFgXEAzoZ2jiGWIjaPBk9ERECimbAe
yZl5QyCGkplmiL+YXQzNV3CesqlXVDrXzZlZtKjUxMq6AQpjIJKpcE1kF/xALAzJ8vr3a/4q+Ojz
tTvLNKWsXl1msROJjsHPQ7QAXnXz0nsQ14Kzrn179+mjC5D0Ve+fwYz57tc0R4vApujZzdIBuQcE
vjEIbcBcEv+AYvFsqQjtx84gZhZD49CyI/oklTgmOQOE1BsJEMzyFpjhx5lyJDEWMiVwpfCjD4Pd
LEa/SlnzFPDIgiiB+Cr1qLMihXMk4q9a8PUWMMEsmGDW9GfgDILI0IkqbyS8bYZbQr2OHKBU1DHf
wsQY0zTL9qbToHI6pHWQ+fUz9CuYamG8EfHtwyPj0/tHDg+DxWm1uG1EJgzocwxjdMj86yNj47zE
x0ou8nNfwYhlcpplGXkXElDHyJhFZPc0UA8wrzQcJwDowoR2IANAaDxysqlDesgSDIBdTzWaYG5N
G9wnXDikK8wa4LDM7MG2RBsbHB7nG3ak/kYwnsEVQ2YOJOI6+vh03s7MQgam8FkN1B44ZqBjCNAy
mEPjBwYPDr0xCB7g1f6hg8Q/bIckxOTtt9x/cOTAa8RvBbDECMeZ52wBNzg6OjLK12fS3xWQfoiM
F8v1EI7MqIQxohdXCYr1qBHsk7OoPsMggEUmTmT/4gGiwXzGMYCCer+HVRKMrvs9wYt31SPkCHTb
IkBU19KKEFRHTL9NxphhiVqTpSVmMnOaK5A5s8Zi4EEol9kETdfrE6ihlYslNyeAGVaCF8CMedvU
mfEnnqGOHnKZhPstBD44BH59OOQvLiGUAsMIFEBCTMP2KCHsiBLCajsPdWamdSa1+LREyeoeLVVK
rIEYJAL426l3oyWOsHyJmRapnpCsqekQo4P9A2/xDRkVei7wgUFgT1weQzibbX8ysXVC85FAEKVp
pLCCP0gGVrD1Ut6QjQXEyVXLLXlYoPUSYTys+f8ue//zwz72s+9/MNr62ZdAz77/Scb39Oxpuv/Z
k9wT/+f9z9/j0/b+B+xTUwU2rObRIiwHJop7oXsUsG7sDqXhAmWVlZNRzupXCRbmXziE1R8XIpvm
d3QwxvAOq/bbGp7W24roTWcdEKm7qPwCjwkKeEABi4CHhoZVVgoK5o0OjfarfNfIwlt7D3TPD8zO
uE7iaGbxzfQsL73Wv//wa0P0bXePcTRftEa9nu7c4aEjL/PSoZFDI/juaDqb/n3m1Z7f9WSHRnve
euu3OSyVh2lMVps1BtJCpJ4LgY2mlitYzsFbCHViqu7iwAW6KvjeouwW8yZ4hxi4bVZ222/beUOz
Iv56xvBwMi4SipiK6SXIAwRbmgUnadMKXSQWtydmpyTcPQKiWPJUoSjNi+FNyayrMoCkvmSruCKF
BSL2nrOzMCm8culKiKKtIuy+PjgWRgfzrDhI0ygO3rkysABmTqUgHG0cUedTER+fyUNops6rvQxG
H/6gtR9SMxSaykDzYuQwpvV7VZiTbDhMUOPvkyfmMLCYwkjOInVWrPGzwV51jgZFdRgk9oHEh0AR
yjBLgS8Q+CgYeRD0IOypRHaFUAy5ILB4CV2uMotBSlYokguZWVZ+xixNIVmuQGA3AgVmAs0BMp1M
A2A6nQN6lOscmJiVFqaQC6wqYrDrLKAFsDPYVFpAP88S5DBHYwCzVshvR81C5hZFgUR4DhAsFB2x
XuJlGRm7vkqRDSUnvIiKzMBopRKgEA1KFSAqnp+Fowr5HeIzp5aLEsyQyLCUd5VypZJiykIjxrkw
fwh2hfjNmJcyabEszMl5d8KYR2mcmBLpAniBZzLmydVNJGoSI1RFnrcjK6XK0lK5IooABISMyJiY
SZN4lspKSGty2Gw2QCfARg3xWlpCtJhOZ9Xe7E5VRfzgkJWKiBEvOV1oQAjlcJMiJhcNJamcpquI
3daVgZ1qcxHHVhtraXXObw2FHJ7tTzi+5VSgRCosKDN+IkkZ+5B+c3KR3MW1yV127QqJW1+fSSMA
Sj44cF9TUKs08JNSt5k1LKkKhAU0U4JTSHBoiVCXhMCNFpvWEoQykMeFyHtiiiOJQHfyZTVeATMX
seck+wYjjtbSUuNS3sh6OI/Nj+Qv4QUGNQIlJy/ZRU8MUi3qE2VwcJBmwQuZlc/lhuq5xKrnxMM1
lBOxJK5GTCWCIGXysEAIO4JY6+6bppcT2pYcwuJf2Z4lGizRoqySjMclLBRHDRgkbrxe4DtxEzla
qqiIlShiBTU2GW4xGdMLwqTeKU6GxYjfxCDzMAhBxBSjgj0rFCQyECDP6Nobx5o8eezqSkWwDS5B
CLrwtgXdSCFeicvxBGJZCaBTRsumlcmXdND6wkRiqoEYjeDju1vAk5ozqXCHxyeVEZrkeraCICXP
WPAUQjB2XSaFt2JktPmurCKmXpAjBXeG7xQ6Oy2R4VFpSClxy1ASGyXfNQydxF6CniYCrqdlou7P
rEtjCCWVaaWZIsgKyQqvJbDWvjWUSMGcQgmq161wpBKRNlZjTrR8WFH/uTCmgd1WOCefG+cAzlZY
J5uwTrZ8GNbYn/TpCQ6bIK6u0j4e4AsLrM3MLKl6POvKcndcDEPftOYaqofSgEGQQrsepMLiaxDK
8LNASbwUV/jN21eq977npeB2XuHf0PI2RAoeL9EbeGX3nrhE2w6UoOkgEL5IA4QUlpgUTwo7DBTe
/+s1//ynvBRUYhVkMZ53B7kB4OmVPmQWkYyEJiI0dcGMJchFgmzjnL9yzb/zPTaYkEaDp48u0Gt/
eKDJyubyZxvfXqTNI9w+DpIbOE6gIJEgPK0GkbmkZ9SozRclL7xJFsRUg1LUjXlOfcZdtUKMc13N
FD0jh1/wqprEfR69j67rLwQ6gRBTr8/bwC7kp+ABf2l5FOWBlsYa/AXsQKwNvfWQEqEhbXg9EZ+S
PVvi2+hPFGSBVGSja8BqSbGNB7dftE0kFuKxBcxA6CC9BHFjfR6QVm67kMpv7DnQZm1Mk6SPqQ5X
tw132PYObQGe9D1GZgOnBptJGRhpqd7Q0IYzaZmEV1t3Gtrku2dAskxr7IFR8C+eo3QmN0xn/bUP
gEzrT9b8L477X33pr3zur9zHdsxbJyFxB6KBzNOuwxYhKls2VvAX0OA0yNE2QgSAcjItQ4KrgP9U
d/2VG9FSAcrAxXPY0EIkgaiyf/Fk7fTN6vv3QSKwHeW7r7Flkej3r1kjZ5CYsiwzrZRIy84QGHl8
EfbvKEnqQ4JFyedbFDWfB7S0bUesJ3U2zeyrC1uLgAZdgwug8aLsYrFZlCbaqb7Et/FMU1tqFiQv
lh5ApvkziyiTePtI9af2wc1n2IrttTvsj0o2dEHFthTJhtr8kxXaZUyvVtFvtKvWb1WjJ0s+pg1h
AHDzI9YW9muW22KT3DK/Xr+FDRw7u8IAv0Nb5WhQEzbBKeRAh8cPCMl4skdKxKWXpUQSA5CtRbOt
cYm3Q7A1unhBqIltBSvS5jfZMYltfInEZOxlLhlXdse3lUv0Uf7Kia3FkEocCHr1xEr1m2MAHrtY
23bDsvZ0fKbtANj+GjS74vjDy/57n4ad3UHP+K9ZCq0mKQytG2lsjFi/kGh8C4gmWxq03tJ6U/Pk
3S37UfnSrIyRz1P5alzR3bgiaNdtD35Pm+Ow6PfuhULUfGO5uGV5T9NeJF53c3aRofXi+vSCkYe1
px551DsffhIksP31no6tA4dABzYvX928tErjARIv1K5/yLEbfRq9QyQDqgCGOPhbCcjpuerVExu3
0aGsP1iDoGhz+diLqgMr6ShtPeFUUOVREpV/JL1JP38esC2n0pFoM2ihaN4uuaVcv2hY8nzZyfZI
J9uFyO0kjP4VDgYBKzdACbEve+Va+BcGtDGr9tnVyBXWudqZszAexAofN/1lT/S+6//a9gZlhnb1
VCfkedfueMehoWGxXpZoOz9Zn48dz3RFXVATv6Cksi2Sv+AWv6x8OW3MVyKQrlyynZyBgz790F/F
9vnanWXW97e2XF1Zw9vXd8DOnUXh++5e2PcX9vptK0bPlhqsNDtG3gBmp9hNIMxWmwpEbIbqiGxS
s2xGLr3y9pHWovRzFowpYxCDoFIZZWwIMHrL92JGE7F7EWM5FzWWkeGfYNS2UdG5ZCwIP3gJA4Sg
UWguwVH52Fx+f51UTeaSXCgH6w9PkYos4Y/wEzO69qnc1JZ2kRXbnz66QG7SOf+Th9Wrt6p/fuQ/
usBLgSg2qA1t8iJXuUGTZpv3DWXGhmJfm2IhelVCpx31y4GgE7FcL0XWjp31/3qD22fMG86ibRnc
xMKUgH+kpsRixryZF4Mq5r6c4Ric/9mfSKGvcfegihlvqWI2VGka6kCFsCz/v+1daVOU1/J/fz/F
+MaHkUeYYXEBHwwiV61ySSXe3BeEa8nMJFIOMxaDQyyhCjVEVsGERQG3uISogFuMSsQP8P8WCc8s
r3I/wr/79NmeZYYBTcy916mUYZ7lnD59+vTp7tP9m0rZeQ/rpOfz1s/LKjlL33fSh/Zx5/+k209t
Bds21taJGuSdlH+vlf9TU7Pdnf9TUxXa9iH/58/4+OX/VIn673z/t/k787k3l1ZXvgGtk334kFWE
jwY+O/Dx77+cs+/MYNCjb9iee5SZepm/tZS98wrvBezRi9lnM/ZoH8ZOxu7nFr8LHD0ayN2/n/sR
43j0PJpO987lHs5mzi3YU3NwHe7CxezXz+2VkcBHAYrNs3rnJl4qri5hN2DLQzdIw+jF1RdD9qVl
eB06gp3SnpuHASha4P38zeX8ue9g/6T+wE34KEBJS+IQYIDOT2R5tSBJ1GBTf9n+H/BwYvlpABbL
p6diGH0eg56ONf19HxqOS/dWl6+gCfjydvbZUm5+AEv8vn5i9/2CxarXrosg9VjuyXfwn6xpF1n/
szzONDBlL45kBsYxpLQ4zWvXmYOvolOL06pAXQ4EfCGwJ/IPrhC9ztpwoLlJrO/KeLpyF7xgj97C
6nAt0aN4hbozh2s239eHVfZXR9lkYPE6+FbEZJnnJTjIRAguQUMsHj2TGRqiQsjMYB8G+169wkAv
I1xWonMpYmZ3oGZHQBrm9uAsTS+8g7Ft6PzZdHZwQHW4NxAOV4ZDJM9MZiafg4BlrizBOED8Mt8u
2Dcfg3SwjDZg4os+JrnYKDwR+EiSBQOFJuzZ6/m7w9mf7ily54btly/tK3B3FB4A8SPewLrAiIx6
/aZ2nQlzgHmuJJbEUmIajCQ39Dh/fsjuf2hfHqKZz45esod/yrzoxyOviZfZice4pMgDpmmH/Zj1
M6A7xyjCyjVGIAbWHci9PXgRJNmBMUD3cFIGV+zx0ez8Y6AdxgQyAyTb344gA8RywiDV1EV7YVq8
NUIHkLj4ll/RQFHyYaksPkcmrUzbA48wMDV2Hx5jCuHCa+g/N9/HSVgnWgBMJytbPhtP14XNRAds
/G8u5Z5+B7s72Ly4c4fMFBbXZy7N56eGSZsB2fkpppdWrq8uo52Q++nn1dc3gWysFh+4bPddRqbx
ljq7wdWnSad1GwjXhgyTmxiZp7fgP+TK3ef5uTmQS1jQwBt4IH9zwb4wlrn1DdzNTY/m7r/JzJ/P
DOLcG60s2wfJrmJkZ7+5YS9+z8lmlYdEtz3+Ay7Bn59kn3+Hi+E1rPGbSFzfOYxqL4yDUka+L9wC
coFIWCp+FNeGkOL81XGMIl4bt78fytzp944BZC438hzGYPdPeMdA3MvfnbYXnznHUM3GYL94oY2h
Vo5Bcj17cUByPXN1BriePf8KGX9nJjt5Fdfd7HU/6ncw6pkmfzRgP36I6uj2NR/y5+Yyty4A+fmn
d32mYGoiN3Ux+/N1+8VzJ/k1jPzM5SV7bJiTX1WlpmDlOgwL1lVuEbFG6DFcRmJYmcn+1VfDuMZf
34RBwLDspQe+clMlB8KnYumn7OCPLjozV27Yd+byCxOZp5NOOmtJwp88c0q4g82o9qcurL5aRCFh
T9p06MpYTvzOL4O1u1hAsplosxeJzb//MgwSQ+Kik5mdmLPfXMg8W7EfjRKzYdvLP5iwL8+D3sre
W8SRtfa2iqXajBU0Rw43H/v7J0cOHTv4mRXmrk6+7yqp3NXluwjnMjjqULkDSn+DcoZ9w6OTQRcG
tiEcDANOcdwTycVN+xsPH24+eOxw46Fmy/j3jUuDv7+eA51GqswHfKTm/YKPUKaJlbQaCsNSlPnD
SfT06NexUMkI+sBG/A0BKTaVSSiLU8fPNCfSLiALuohV66c6k9HTzC7A1soUJAa4iadPQadlAmBi
kwKYoCbExcjxLqx20rKF0HA68kVZvD3VRWXSKSukJQonMW+P3cT0KsYRLDZLlVs+SA8idJCq1/KR
4uCBxaEH1hN1EU87+ujCPmBBYhfsqQarqwJXVhAe7KqIp0W78JdIqOk+EUsc+QInR9IR6YxF21kK
C7JfTgZ9pWIxdkMkujCKcb9dXblGtZ1gJ9pDN3GXX5wGt5+2WVgOcnWg+SqOGNUIocHICWyRcdGM
p4M8CxbHYMHAWuLpreFWNqT6AixuqaiowLclPgPxmh/5lh0322At0KDLjge38r/agsHg2QJzgcxs
sBgbOfv4S8lgfS+/EgJ+KotD2DkzaBoI4xxWsz0wTWaPTLc/ZBm/zt0L/Nr3w6/nh/5vJvDvG6PL
6lvxW0a9FyklnmaRAFNWf2qZmV2Kg6Zw5q14usFyKzNQzBZDDMGmgAUG2WMaxEr3iaQlu9ht7PrI
KJdfy40Go47hriQ6yvH/6jUdmQWmqUxQsbvFkOEFo7WupZVnfQN/OKzHb4iA07dlC+7msCOyzeG3
C8uab8ZY7sVgQe0YoDkIGOVAd7kRIFkMbNmCrxvl8XS5AW0Z5bBWGMXgChqqX7yeYhBCyHNX82QN
0j6ZGxjMXFtC+2XyIQ0eXYNrSzBzdwWGCIyoVc8/XDdIiMYyB8dMFoysU5PSIv9slcgiIKAFbOwZ
uTLRsiEZVTgAHYec4lVAqNYUGwcyD5sZ4hPyjNwrMJ9Kn5zcw2vwH77z4gWYiiQVaBBeG2dLR47J
fvkAUy9eTdnnrzITc4Y3AULYVdHZLSKJ1NNXQfcka0aFQpNZuJLve5If+d4e6WfeJaYeEefgefAM
yKdGALILrzNjszAoBSVj4Ja+vLz6etKeHMvfGmE+6BKYDOCoZC6NZB5csKcmcKRvJywFEGU+01xm
DVHmy9PtcRAXsy3ZBf+uA1+muz0RTXYfSlnh0JaqGh1h5ovOWOoE3KjZsTHcGTMawzPYSAzaQOPw
LXFoWFCj+WDznk8ajzb7gdFgLa8PPAPnDCvpLtbivn8cOLjXD96GJaH6wlro4QuDaowcwDUmP1o4
EGW1C/i1PWFxniEYUzKexqC5yI7tAC3Ajj4OHT8lwuf/RbA3LKlfK8XR6rneMSKOhtlSFaqhwqv/
UZQcH1SaetegQ9XBszhMuOwLpCPQboK8QQkiUC9GtDbADr7KwWzeIygOX48aFotcoUJ05AW96iN1
PA1rmjMH9QEHFTH408baADlo1urAFvuaGa4F006YgM/VVLmhnUc6ip1OWhGrIbJ5c0Q4PKHNm7lb
GKlojwbhigCxQGr5y0wOLGaSi2qtRLQMVgr4Sa6L3uZRwVW2kxqNMAA6pkXhBtltlZ5bGoBPxKVs
PjvQ/E8rnNi1KxxKmJ82H95LX8IJs/nQnmb+rSZh7j/w6VH6si1hftLc2ETf4Muh5sNHDxw5TDe3
J8yP/7GH7lXXwpdPDvAv8OTR/YhAQF93JOoddMDm14LFJWLHZEd+IdqGBd4G0tqDhPQwAnArS5wR
N5H2Huy7B/vsob6Cva2aSvHZhtjGTDxKdiu0CNqvGQ1hHxpYX4w/RA5nASfICBlKBWqFU2fZgaIe
aRCjhN2pPVLHjTturbFA9AzmEdp9V+nMAqPmc/NgguVu3+L2N9hkGED1DZca5qlYJ+xpKVhjx5Jg
2XZ3gguaqkt29wrqGFSXH7BLsQVA+5vUaRJcBesfmWZC60EoAVBjGHHolvYD3+xjPLiDNLPcbYoM
Y3hrbNweG5IxGoQPfDiUvzoOnAB/jwaIsMHMLaQq8+E3mUuDwJf8zX77m1EKLWce3vqbLJfsbgEX
l82jVWQeQWG/JS8E5IbThhFT3gQieVTAhwhNq4wRXW3UF1NqYNNpGrLeT0X6aNn2xBdJ8LARHEUv
8Ww53R5lHkgrH7swhIBdZS3CwErFIqc70bhKdieoFBPbcarXii7w4cvABE2RnoXl4ISRiSfb2s7Q
q8BD7NOtoT1NtDq0bXvU4lbqaRemqgIH8yxxhGPaDf/wKNqOYJ2qWBVuAGdBHdeY3MvqFZx0RSHs
b0fI4bPHvwZhxH/xbImdMg5etO88zkxOY2ji9eP8jTf22D267rPvSY8Bq5ExNKONVdDUy6dFmz6d
JZ2xiKUgsLi3UrdpE7wd7ahrj+42DIScApe2l1nCDOJGMYCw+hyYUXI3rl8H9pMv8JOInGCBr6qn
jlRIfCdLw3favFlHear3X0kc20kBOrHhxFSRJUJvqTFFOzaGg8VgsIoPOdrhhrvyuvQ4ikgFEEEJ
hY4xKaAqjx7lL5UIScX7YMaZ5QKmiglWO3jK24eGRWO7BUkKfYpfkIBH3Jj0qiUcmljTxzC4QPoJ
OlFWB0M4Ir2Pf2rLik5xM0sTufkr+RFcR/kHV6i6p3/ABxadHQ+qyCeFPUHnszPKAXiAhQQfIcb7
wF15MIanqhijGPSuwTbEgaLlZ55NAUdB2Al5QNRgU2lwelfYgTnlQqrTORJPC/Xoga4TQLzwhaEP
N1jxtOZvAQ3+oHVuuLqeHiLVQRLKPV/CbsWirRj/hSXn2TsckjOfKVZqxxcVzSl8vUEJPeax/mOR
k55tCXafEtAJPWBkrAgVrrL0saPJMu8uxZ0ABByo10VayoF+JAD/5z4QeztVBmQFg6rgXwWBMMh+
Oh6jcWB4myIOPT18w4LrjqDKJnyQz14kHjveKaI0FG9g2aQM6IzPLV1N0VVTi+qw6BG/zVEl2R5B
UQ32L+2qDAhE8hp8SCYROtqZUyQ4phziTqiQEUej803ToFwMR47G2Aqmy7A1/vsvs4XSMihrgyxa
r3xgcmqZQzbwvMTP7cMnORCdr98H04Kv+qzj0qWtgCiZbWcsIVCu0xMfAQJCtEO7Cia0mjkTLGs7
08IvO1BGvNgXLUxk8WzGB1ekDaaZ74TxtOUWbHZwxpjClJsbANO9LKR6rNtU5j1UaiAcwa08OimW
u/+GIWcJxZm9V3i/b94rDGaFWvhuMAqJYBFoLQxS6I9PqB03iqXPZ8yRh+xBFHSOzwdWkNYtCf2a
axT5I98OqnWuaSAh7SXBFZaIVehPjIAX7F0TYdB1vMq1F18hwaBTH/rgDW4IkBBEIHqG4JCQxYVR
CfVYvgQHk9ad2CBMvo5MkgQTeGG6T/3+O1AMi+f/vhP4v7Xyf7dV14bc+H/h2g/5v3/Kxzf/F/d7
Ea5isSq02TGvtlBSrZZ2E5A5jPoBPuUwgrts35nynqf6HKYCJRwy8NmMnm76W985l3HinxnKnPY/
Al1wfQrEgTjoya1fA3Bwn+Vbbr/nyFHLr+Te3G9VbwuFYtXyZ5csozrk+uD77VGfG1UfcAffE+7g
XwUzEAw2BRhIyHz0HFD7l0YC5EYtdwvr0njNOfKzyhNQeHwmWCA49Q5oRF8MP82uT7ZwOMh0EF4H
8bGSkmQnd3kbTCrh0SAPku+Gv1mQMsgQ+wTs3ztAM3wveIaSJQ1UlFcE1/APRjZcJ6jhfwKeoQdo
9N0CG66NaoihAAL3pdqZma8D7dHff7lmbDcwM/jRaGbqpayWwTuzKVYOc02PqMOWHe1IwUVqqhBU
Ig+/4k8V4UlbTaiaZ3REO5oEjKLI7tib7E64InkONEV4hzXEXUMdX5FJsRXSvLjCuIobglTkO9Tx
rhMW1r+KnN+iFQ3qN09wSUFHlAqCkoGH1ps3s+bgmzqv2uc4tj6rztWRNxtDHmSQhiXDBYrONRRE
J+UssF4C6fwU1R97kk1Xebl20MuFA3+JxvcItCKVxF+rsxr2tH95IIE/wcbOBoOby/ghdnBjwIzh
agnMKLd9i0Em7jTKeXgUYRNhCFhvDS50eLtphIygOAhmh1Bt9KNyWEjcW8/Fk2tlFtZjTJEXSp+M
kmfBrwi7+BSsE0Byu1He5oDz5EftCi9Twnr+S8f1LIDqiYQXWht8bB1rDEDJDmJoOiCnthsyitaV
tOg2sxDDFFHkqkcBe3Yl3wbWE9SSBPQkGVg3e6N4PJXixoTiqQMtNHKC0EI31kOHUa6hIaguHIl8
pxOxr07BxhmLguZTs0I/HMqmzIsbCnQLjazSJUkhU3E+/sX2HR27EjQ5q8dYK/dReD2sJsFicU1K
SjePd5lf4TahQC2pboGjWmpPiopzVjihIVNCCyrJH78BZ7/qdZQzxGLRj2PJU/GYG/3Ufbp+shHU
vTjQNsobPbAcdJKOj511YG06AQU8ze5xNLsH8wz8G94jG0Zv+colwxepgD/cJB8mJKm9TexxMUVk
rsKQzWjE7OJJr8DoInmzHKCB51vU7aP82TrwajcA7qGdXtTV8u41kFBesLs4nXk6mfv5BqUYY/Bg
/jZWG7CiXDBkZFGuXogrym5nC9XrYinjSj8V60rsLb00V+EiELMOWi1M8MqMk4bJSszCQdMXZlVi
qNZ60Qf8YBFEKwz8yduKjmGAhThOOecmenFCtmEesk/HakA74YkqhcEmgOAQskE+w8oCq4FaJyyW
zxNUfAQrFeM0vcFWD2aLOOk4GDSrgDgXtoQ4D6nauXNn0Cx0F4MgQQ/ci7jLihiDZnWRl+F2rQMm
w3twZi+/EgWyJdfCIoqQo7J5xhNmE1G2YY55y+JoItY2a68MrL7sX12+iz8vB82AQI/dl+XUJaLI
rA1GpBTeGlAnoESOh+vELINmq0bB7tpatWV/0GxTd0A1Uflr11bKjYfbEXW7iW7D3f2OeAgHhBFq
SBx0n6hgxwKFIVIk+o8wxBQAkDDw1M2WUKtTECgH0/QWFGqUgY8dKWCmUlao1ZCsYOlO+4KoCEt9
GrSlPpDkyTJu7cbSFWggC2s3nAiahhQamWIHYmboWOnqZYetHHK8LeXW71Wg3fku6xljxqxOQ/bp
w3wX9JKwDhV4ovZShxtm5V+yEOrzRKUD/l08o2w3g+dVYvlVY7nR4CxsCv92YZmqvvG3kl1IjlqP
mcmHtCFTtZIDQrgQGAxVxPToVeI9spy2h8CCe3LzC7n5gdUXC5VYa6v8Zz2O7uCgQvjp8AC/S0xh
reyJ1zy1NPriDGPeUMozD1GLbnikP4pI0I0uIYz6MJ2YVbBkqSjbo4qF8Ji7WNkDt6kxXON0kcf0
wvzCExn1Q/XxTJof1nPhaSkZ6tmB18HysU42HgsbQZgUHctunQ3F02gHwtZpGt69QqZ7kPlklAKH
5mm9qSRAR/wF1JUR0i9kjpEO5VliVBY6LBMyJeQIh7Z+NoNII3ODYK5J8Gq4S4/lfn5q9/9I50ck
e4SKkj9/G0f1525/xTe5jW9ma2B6FlnibgRdRG3USGT2aZefPbceCkCTMexEspK5WewHF7k2dO8a
/SC8QiiAvV1ZYmeWVZ5+qh0DDNMIN4yMj+pO4ft69R7uMnswjdS1z9SAJiMYCVJ4aypin7sciJ85
eW7EYX7btfdoIBQ+KMXud3QUisKQ9+63dF3o5Dyi4vq5F3scLorTK1kf0nxxFhbQPnQG7cGS1Tdf
gsjBU2c6tdaxdGbJJdbhouioWiiuAYTZHx+1F6ZZxcY6kWZF8Ik2bIf6MTGsxM5gC+uhYrsIT9Li
rPHVOybWJmEvIhjpVUSOOcYfWdENfLG41BMR7Ykm7Qltmnf4wRA757qqBKX2lruqgrVVS51YoVa3
K6daP8+NnEqmuoT5SoZ7h9VQKeInvHJBWodBRzf4bmHLdcsW0cqWLVyraDaTMjyomfXYhG9jjzRJ
zrFahMLYugKADS3ai6/sS8var7aQ5kbYS8zwHqFCC+myrh+mWR2GyCDDf+YCWt/yKL7nh9cSaW/S
uNvCX1MmeEo5raeCsiCh1jyAPqQwc7dv4WmjtLcRfo79Nk/u/nXYlAhmLjtxIzM5gIh5TIT4b/Yw
nAAG6OkUl45aiRVaa8ofMGp0e3q1pTiXtT5rFDf3WvRmCKLJb13Cextx1ERRfFQOAOx2Dd3Uvn1d
4pt+heCmmF7glAN4WZJMA1W+TOWXQSkg4A+wkBTipd1cQJg4BCnytQC0Js1KAW+q1iZQq6pmitJb
wMBwtK8cL9WTqL+PW+H6+C6rtj6O5fbSb1UlO3K2C/TkY8II/45+RaEnMzdqD1/tQdh4/VeJnP6+
pzsQrnU23UPWWiUezmuw96zQRWLxuZLv7EePsxPz9uKF4uDjLqBGrKUcvUigcdJ32qiaBVllR0e1
no/hOP00ENplqxyCPdpn9Lptm3epkcMuX8oUGOMe7yrscq9OVL1rLe2KMfoo6hJ/gStywvRjdAk2
sHMYyufSf87CYXQXeOGPMdCLA6ZjifRaVcQUNRABdwTMHv6Wh+NXRngh8fnbspBYxqTIyF+/gU6Z
CH72xbsJj7/jKDclcAX9TGhvAPxtp1PUxnc5Q+jrCG+XHmMm21EPbXusjvedZ/3h8+Hz4fPh8+Hz
4fNX+vw/hQVqXgCgAAA=
B64
tar xzf "$DST/v512.tgz" -C "$DST" && rm "$DST/v512.tgz"
sha256sum -c - <<SUMS
ba678bfb482a6749f188f2e87609e28806686d02ae6708eb1a52c207cb10b405  $DST/order-voice-bot/staff-order-dm.cjs
0739ebac757af382daf4b28aa7c7b28ad436c09f69e27541f71564a722c54c36  $DST/order-voice-bot/staff-order-dm.test.cjs
aaa97b0b183cf929db672ef6dec5da883338ab3eb561821f7f2eef72bfd5f2de  $DST/order-voice-bot/vip-celebrate.cjs
410f6f12d0355015985bb6c20812df4c28aafa153a083c4741fe71c332e59159  $DST/order-voice-bot/vip-celebrate.test.cjs
SUMS
chmod 644 "$DST"/order-voice-bot/staff-order-dm.cjs "$DST"/order-voice-bot/staff-order-dm.test.cjs "$DST"/order-voice-bot/vip-celebrate.cjs "$DST"/order-voice-bot/vip-celebrate.test.cjs
say "service-server.cjs 接上私訊冒險者、VIP 升級恭喜"
python3 - "$DST/order-voice-bot/service-server.cjs" <<'PY'
import sys
p=sys.argv[1];s=open(p,encoding='utf-8',newline='').read()
a="server.once('draining',()=>orderNotify?.stop());"
assert s.count(a)==1
add=""
if "staff-order-dm" not in s:
    add+="""
 // v511 D：指定冒險者的委託一成立，機器人私訊那位冒險者去手札接單
 let staffDm=null;try{if(process.env.DISCORD_BOT_TOKEN)staffDm=require('./staff-order-dm.cjs').startStaffOrderDm({db:getDatabase(app),token:process.env.DISCORD_BOT_TOKEN,report:code=>console.log(code)});}catch(e){console.log('STAFF_DM_START_FAILED')}
 server.once('draining',()=>staffDm?.stop());"""
    print('接上私訊冒險者')
else:
    print('私訊冒險者已經接過（v511 已部署），跳過')
add+="""
 // v512 D：老闆升上 VIP，TT 在「vip升級」頻道恭喜並 @ 本人
 let vipCheer=null;try{if(process.env.DISCORD_BOT_TOKEN&&process.env.DISCORD_GUILD_ID)vipCheer=require('./vip-celebrate.cjs').startVipCelebrate({db:getDatabase(app),token:process.env.DISCORD_BOT_TOKEN,guildId:process.env.DISCORD_GUILD_ID,botId:process.env.DISCORD_BOT_USER_ID,report:code=>console.log(code)});}catch(e){console.log('VIP_CELEBRATE_START_FAILED')}
 server.once('draining',()=>vipCheer?.stop());"""
open(p,'w',encoding='utf-8',newline='').write(s.replace(a,a+add))
print('接上 VIP 升級恭喜')
PY
say "語音登記：沒有角色名字時改用大廳闆卡名字"
python3 - "$DST/order-voice-bot/booking-voice.cjs" <<'PY'
import sys
# v511：老闆沒有 secureV1/characters/<闆卡>/name（開店後新做的闆卡沒人寫這份）→ 語音登記被拒 CHARACTER_REQUIRED。
# 改成讀不到時用大廳闆卡 peiwan/lobby/<闆卡>/name。找不到預期的程式片段就不動（印 SKIP），不影響其他部署。
p=sys.argv[1];s=open(p,encoding='utf-8',newline='').read()
a1="const orders=await Promise.all(ids.map(async id=>(await db.ref('peiwan/clientOrders/'+id).once('value')).val()));"
a2="const name=secure.characters?.[m.key]?.name;"
if s.count(a1)!=1 or s.count(a2)!=1 or 'lobbyName' in s:
    print('SKIP booking-voice 跟預期不同（或已改過），角色名字備援這項跳過');sys.exit(0)
s=s.replace(a1,"const lobbyName=await db.ref('peiwan/lobby/'+m.key+'/name').once('value').then(x=>x.val(),()=>null);"+a1)
s=s.replace(a2,"const name=secure.characters?.[m.key]?.name||(typeof lobbyName==='string'&&lobbyName.trim()?lobbyName.trim():null);")
open(p,'w',encoding='utf-8',newline='').write(s)
print('PATCHED 語音登記：沒有角色名字時改用大廳闆卡名字')
PY
if [ -n "$R" ]; then echo "TEST_ROOT: 檔案準備完成"; exit 0; fi
say "建置 docker 映像（約 1～3 分鐘）"
cd "$DST"
docker build -t tinytavern-service:$TAG . > build.log 2>&1 || { tail -20 build.log; echo "建置失敗，正式服務沒有變動。"; exit 1; }
for f in order-voice-bot/staff-order-dm.cjs order-voice-bot/vip-celebrate.cjs order-voice-bot/service-server.cjs order-voice-bot/booking-voice.cjs; do docker run --rm --network none --entrypoint node tinytavern-service:$TAG --check $f; done
T="order-voice-bot/staff-order-dm.test.cjs order-voice-bot/vip-celebrate.test.cjs"
for x in order-voice-bot/booking-voice-test.cjs order-voice-bot/notify-oen-v498b.test.cjs order-voice-bot/notify-v466.test.cjs order-voice-bot/staff-names.test.cjs; do if [ -f "$x" ]; then T="$T $x"; fi; done
docker run --rm --network none --entrypoint node tinytavern-service:$TAG --test $T > test.log 2>&1 || { tail -30 test.log; echo "測試失敗，正式服務沒有變動。"; exit 1; }
grep -E '^(# |ℹ )(tests|pass|fail) ' test.log || true
cp -p "$UNIT" "$UNIT.before-v512"
rollback(){ say "健康檢查失敗，還原舊版"; cp -p "$UNIT.before-v512" "$UNIT"; systemctl daemon-reload; systemctl restart tinytavern-service; echo "已還原為 $CUR。"; exit 1; }
say "切換到新版本並重啟"
sed -i "s/tinytavern-service:$CUR/tinytavern-service:$TAG/" "$UNIT"
systemctl daemon-reload
systemctl restart tinytavern-service
for i in $(seq 1 30); do
  sleep 2
  systemctl is-active --quiet tinytavern-service || continue
  L=$(docker logs --since 2m tinytavern-service 2>&1)
  echo "$L" | grep -q '^ORDER_NOTIFY_READY$' || continue
  echo "$L" | grep -q '^STAFF_DM_READY$' || continue
  echo "$L" | grep -q '^VIP_CELEBRATE_READY$' || continue
  echo "$L" | grep -q '^ROLES_STARTED$' || continue
  echo "$L" | grep -q '^COUNTER_STARTED$' || continue
  echo "$L" | grep -q '^RECRUIT_STARTED$' || continue
  a=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/session || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/rooms/session || true)
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/v1/voice/vip-outfit || true)
  if [ "$a" = 401 ] && [ "$b" = 401 ] && [ "$c" = 401 ]; then
    say "V512_DEPLOYED_AND_HEALTHY"
    sleep 15; echo "私訊冒險者／VIP 恭喜狀態："; docker logs --since 3m tinytavern-service 2>&1 | grep -E '^(STAFF_DM_|VIP_CELEBRATE_|VIP_DM_|ORDER_NOTIFY_)' | sort | uniq -c
    exit 0
  fi
  last="session=$a rooms=$b vip=$c"
done
echo "健康檢查結果：${last:-服務未就緒}"
docker logs --since 3m tinytavern-service 2>&1 | tail -20
rollback
