/* 直接組合酒館原始圖層；不重畫、不修改繪師原稿。 */
(function(){
  'use strict';
  const paths={base:'img/lobby-layers-v218/base.png',fixtures:'img/lobby-layers-v218/fixtures.png',cat:'img/lobby-layers-v218/cat.png',stools:'img/lobby-layers-v218/stools.png',food:'img/lobby-layers-v218/food.png',flower:'img/lobby-layers-v218/flower.png',white:'img/lobby-layers-v218/white.png',purple:'img/lobby-layers-v218/purple.png'};
  const images={}; let pending;
  function ready(){
    if(!pending) pending=Promise.all(Object.entries(paths).map(([key,url])=>new Promise((resolve,reject)=>{
      const img=new Image(); img.onload=()=>{images[key]=img;resolve();}; img.onerror=()=>reject(new Error('酒館素材載入失敗：'+key));img.src=url;
    }))).catch(e=>{pending=null;throw e;});
    return pending;
  }
  const bounds={white:[153,520,81,99],purple:[441,222,120,87],flower:[84,697,105,102]};
  function companion(g,key,cx,bottom,height){
    const b=bounds[key],w=b[2]/b[3]*height;
    g.save();g.imageSmoothingEnabled=false;
    g.drawImage(images[key],...b,cx-w/2,bottom-height,w,height);g.restore();
  }
  function cut(g,key,sx,sy,sw,sh,x,y,w,h){g.drawImage(images[key],sx,sy,sw,sh,x,y,w,h);}
  function shadow(g,x,y,rx,ry){g.fillStyle='#4d2c3338';g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}
  // 600 × 760 的吧檯一角，保留原圖比例和像素邊緣。
  function corner(g,x,y,w,h,doll){
    g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.translate(x,y);g.scale(w/600,h/760);g.imageSmoothingEnabled=false;
    cut(g,'base',260,0,711,900,0,0,600,760);
    cut(g,'fixtures',382,220,925,207,18,280,570,128);
    cut(g,'stools',676,365,470,90,177,374,310,60);
    ['white','purple','flower'].forEach((key,i)=>{shadow(g,118+i*142,322,34,7);companion(g,key,118+i*142,320,130);});
    cut(g,'cat',1081,228,90,96,490,267,65,69);
    if(doll){shadow(g,294,665,78,14);g.drawImage(doll,102,322,384,384);}
    cut(g,'fixtures',1510,695,90,205,520,584,80,182);
    g.restore();
  }
  function fit(g,text,x,y,maxWidth,size,min=22,color='#513e39'){
    let value=String(text);g.fillStyle=color;g.font=size+'px "LINE Seed TW", Huninn, sans-serif';
    while(g.measureText(value).width>maxWidth&&size>min){size--;g.font=size+'px "LINE Seed TW", Huninn, sans-serif';}
    if(g.measureText(value).width>maxWidth){while(value.length&&g.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);value+='…';}
    g.fillText(value,x,y);
  }
  function lines(g,text,x,y,width,size,limit=2){
    g.font=size+'px "LINE Seed TW", Huninn, sans-serif';let line='',row=0;
    const chars=Array.from(String(text));
    for(let i=0;i<chars.length;i++){const ch=chars[i];
      if(g.measureText(line+ch).width>width){g.fillText(line,x,y+row*(size+13));line='';row++;if(row===limit-1){const rest=chars.slice(i).join('');fit(g,rest,x,y+row*(size+13),width,size,size);return;}}
      line+=ch;
    }if(line)g.fillText(line,x,y+row*(size+13));
  }
  function render(canvas,info,doll){
    const g=canvas.getContext('2d');g.clearRect(0,0,1280,800);g.fillStyle='#49322e';g.fillRect(0,0,1280,800);
    corner(g,16,16,600,768,doll);
    g.fillStyle='#f8eedc';g.fillRect(616,16,648,768);g.fillStyle='#d7b99b';g.fillRect(634,38,2,724);
    const x=674,right=1208,width=right-x;
    fit(g,'小小酒館  /  來客名片',x,83,width,24,24,'#977762');
    fit(g,info.name,x,156,width,58,36);
    fit(g,info.dcid,x,195,width,23,20,'#947c6d');
    g.fillStyle='#cbb69a';g.fillRect(x,223,width,2);
    fit(g,'生日',x,269,width,22,22,'#947c6d');
    fit(g,info.birthday,x,315,width,35,30);
    fit(g,'常玩遊戲',x,369,width,22,22,'#947c6d');
    g.fillStyle='#513e39';lines(g,info.games,x,412,width,30,2);
    let tx=x,ty=505;g.font='24px "LINE Seed TW", Huninn, sans-serif';
    info.tags.forEach(tag=>{const tw=g.measureText(tag).width+28;if(tx+tw>right){tx=x;ty+=48;}g.fillStyle='#e7d8c3';g.fillRect(tx,ty-27,tw,38);g.fillStyle='#725b4b';g.fillText(tag,tx+14,ty);tx+=tw+10;});
    if(info.quote){g.fillStyle='#725b4b';lines(g,'「'+info.quote+'」',x,596,width,27,2);}
    g.fillStyle='#cbb69a';g.fillRect(x,686,width,2);
    fit(g,'TINY TAVERN',x,731,width,29,29,'#765344');
    fit(g,'留個位置，下次一起玩。',x,761,width,18,18,'#947c6d');
    g.fillStyle='#f8eedc';g.fillRect(42,698,544,62);fit(g,'今天，也在酒館。',68,738,490,26,26,'#725443');
  }
  function welcome(canvas){
    const g=canvas.getContext('2d');canvas.width=1000;canvas.height=430;g.imageSmoothingEnabled=false;
    const layer=key=>cut(g,key,0,100,1600,688,0,0,1000,430);
    layer('base');layer('fixtures');layer('stools');layer('cat');layer('food');
    ['white','purple','flower'].forEach((key,i)=>{const cx=332+i*166;shadow(g,cx,370,47,9);companion(g,key,cx,366,178);});
  }
  function avatar(canvas,doll){const g=canvas.getContext('2d');g.save();g.scale(512/600,512/600);corner(g,0,-100,600,760,doll);g.restore();}
  function mount(){document.querySelectorAll('canvas[data-tavern-welcome]').forEach(canvas=>{
    ready().then(()=>welcome(canvas)).catch(()=>{canvas.classList.add('scene-unavailable');});
  });}
  window.TTTavernCard={ready,render,avatar};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
