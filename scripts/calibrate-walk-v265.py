from pathlib import Path
import json,re,subprocess
import numpy as np
from PIL import Image,ImageFilter
root=Path(__file__).resolve().parents[1]
source=root/'img/lobby-layers-v260'
files={'1.背景.png':'base.png','桌子.png':'counter.png','椅子.png':'stools.png','圓形枕頭.png':'cushion.png','小粉.png':'doll-pink.png','食物.png':'food.png','貓咪.png':'cat.png','小紫.png':'doll-purple.png','2.前景(店鋪).png':'front.png','小灰.png':'doll-grey.png'}
def read(name):return Image.open(source/files[name]).convert('RGBA')
s= (root/'lobby-ui/scene.js').read_text(encoding='utf-8')
baseline=subprocess.check_output(['git','show','c6b04d8:lobby-ui/scene.js'],cwd=root).decode('utf-8')
rows=json.loads(re.search(r'const ROWS=(\[.*?\]);',baseline).group(1))
walk=np.zeros((900,1600),dtype=bool)
for y,row in enumerate(rows):
 for a,b in zip(row[::2],row[1::2]):walk[y,a:b]=True
# 保留既有地板與入口；精準依繪師分層補上家具接地輪廓。
blocked=np.zeros_like(walk)
for name in ['桌子.png','椅子.png','圓形枕頭.png','小粉.png']:
 alpha=np.array(read(name))[:,:,3]>80
 if name=='桌子.png':alpha[:375]=False # 吧台後方露頭通道；桌體從此處起不可站入。
 if name=='小粉.png':alpha[:805]=False # 娃娃上半身可遮擋，接地區不可穿過。
 blocked|=alpha
blocked=np.array(Image.fromarray(blocked.astype('uint8')*255).filter(ImageFilter.MaxFilter(13)))>0
walk&=~blocked
newrows=[]
for row in walk:
 diff=np.diff(np.r_[False,row,False].astype('int8'))
 starts=np.flatnonzero(diff==1);ends=np.flatnonzero(diff==-1)
 newrows.append([v for pair in zip(starts.tolist(),ends.tolist()) for v in pair])
s=re.sub(r'const ROWS=\[.*?\];','const ROWS='+json.dumps(newrows,separators=(',',':'))+';',s,count=1)
(root/'lobby-ui/scene.js').write_text(s,encoding='utf-8')
# 可走區檢查圖：綠色半透明是脚底可以站的位置。
scene=read('1.背景.png')
for name in ['桌子.png','食物.png','貓咪.png','小紫.png','椅子.png','2.前景(店鋪).png','圓形枕頭.png','小灰.png','小粉.png']:
 scene.alpha_composite(read(name))
overlay=np.zeros((900,1600,4),dtype='uint8');overlay[walk]=[100,240,160,90]
scene.alpha_composite(Image.fromarray(overlay))
scene.save(root.parent.parent/'output/walk-v265-map.png')
print('Walkable pixels:',int(walk.sum()),'Blocked additions:',sum((b-a) for row in rows for a,b in zip(row[::2],row[1::2]))-int(walk.sum()))
