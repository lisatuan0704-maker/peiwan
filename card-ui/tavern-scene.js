/* 直接組合酒館原始圖層；不重畫、不修改繪師原稿。 */
(function(){
  'use strict';
  const paths={base:'img/lobby-layers-v254/base.png',fixtures:'img/lobby-layers-v254/fixtures.png',cat:'img/lobby-layers-v254/cat.png',stools:'img/lobby-layers-v254/stools.png',food:'img/lobby-layers-v254/food.png',flower:'img/lobby-layers-v254/flower.png',white:'img/lobby-layers-v254/white.png',purple:'img/lobby-layers-v254/purple.png',wolf:'img/lobby-layers-v254/wolf-cushions.png'};
  const images={}; let pending;
  function ready(){
    if(!pending) pending=Promise.all(Object.entries(paths).map(([key,url])=>new Promise((resolve,reject)=>{
      const img=new Image(); img.onload=()=>{images[key]=img;resolve();}; img.onerror=()=>reject(new Error('酒館素材載入失敗：'+key));img.src=url;
    }))).catch(e=>{pending=null;throw e;});
    return pending;
  }
  // 所有大廳圖層共用原始 1600 × 900 座標，只整體等比縮放。
  const sceneLayers=['base','fixtures','stools','food','cat','wolf','purple','white','flower'];
  function guest(g,doll){
    if(!doll)return;
    const px=doll.getContext('2d').getImageData(0,0,64,64).data;
    let left=64,top=64,right=-1,bottom=-1;
    for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(px[(y*64+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(bottom<0)return;
    const sw=right-left+1,sh=bottom-top+1,h=108,w=sw/sh*h,cx=1465,foot=601;
    g.fillStyle='#4d2c3338';g.beginPath();g.ellipse(cx,foot-2,w*.36,7,0,0,Math.PI*2);g.fill();
    g.drawImage(doll,left,top,sw,sh,cx-w/2,foot-h,w,h);
  }
  function scene(g,x,y,w,h,doll,crop=[0,0,1600,900]){
    g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
    const scale=w/crop[2];g.translate(x,y);g.scale(scale,scale);g.translate(-crop[0],-crop[1]);g.imageSmoothingEnabled=false;
    sceneLayers.forEach(key=>g.drawImage(images[key],0,0,1600,900));guest(g,doll);g.restore();
  }
  function fit(g,text,x,y,maxWidth,size,min=22,color='#513e39'){
    let value=String(text);g.fillStyle=color;g.font=size+'px "Tavern Numerals","TT Latin","TT Huninn","LINE Seed TW", Huninn, sans-serif';
    while(g.measureText(value).width>maxWidth&&size>min){size--;g.font=size+'px "Tavern Numerals","TT Latin","TT Huninn","LINE Seed TW", Huninn, sans-serif';}
    if(g.measureText(value).width>maxWidth){while(value.length&&g.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);value+='…';}
    g.fillText(value,x,y);
  }
  function lines(g,text,x,y,width,size,limit=2){
    g.font=size+'px "Tavern Numerals","TT Latin","TT Huninn","LINE Seed TW", Huninn, sans-serif';let line='',row=0;
    const chars=Array.from(String(text));
    for(let i=0;i<chars.length;i++){const ch=chars[i];
      if(g.measureText(line+ch).width>width){g.fillText(line,x,y+row*(size+13));line='';row++;if(row===limit-1){const rest=chars.slice(i).join('');fit(g,rest,x,y+row*(size+13),width,size,size);return;}}
      line+=ch;
    }if(line)g.fillText(line,x,y+row*(size+13));
  }
  function render(canvas,info,doll){
    const g=canvas.getContext('2d');g.clearRect(0,0,1280,1410);g.fillStyle='#60433b';g.fillRect(0,0,1280,1410);
    // 依指定截圖取景：右側門口與粉紅地毯，原圖等比例裁框。
    scene(g,16,16,1248,1152,doll,[1340,396,260,240]);
    g.save();g.translate(0,450);
    g.fillStyle='#fbf2e4';g.fillRect(16,718,1248,226);
    fit(g,'TINY TAVERN / 酒館闆卡',48,758,370,18,18,'#a18771');
    fit(g,info.name,48,813,370,44,28);
    fit(g,info.dcid,48,850,370,22,18,'#947c6d');
    g.fillStyle='#d8c4ac';g.fillRect(444,754,1,112);
    fit(g,'生日',477,764,155,20,20,'#947c6d');fit(g,info.birthday,477,807,155,27,24);
    fit(g,'常玩遊戲',683,764,545,20,20,'#947c6d');g.fillStyle='#513e39';lines(g,info.games,683,805,545,27,2);
    g.fillStyle='#d8c4ac';g.fillRect(48,874,1184,1);
    fit(g,info.tags.map(t=>'#'+t).join('  '),48,914,460,22,17,'#8b7260');
    if(info.quote)fit(g,'「'+info.quote+'」',540,914,692,25,20,'#725b4b');
    g.restore();
  }
  function welcome(canvas){canvas.width=1000;canvas.height=563;scene(canvas.getContext('2d'),0,0,1000,563,null);}
  function avatar(canvas,doll){scene(canvas.getContext('2d'),0,0,512,512,doll,[1350,396,240,240]);}
  function mount(){document.querySelectorAll('canvas[data-tavern-welcome]').forEach(canvas=>{
    ready().then(()=>welcome(canvas)).catch(()=>{canvas.classList.add('scene-unavailable');});
  });}
  window.TTTavernCard={ready,render,avatar};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
