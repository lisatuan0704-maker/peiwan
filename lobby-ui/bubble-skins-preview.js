(()=>{'use strict';
const skins=[
 ['cream','香檳絹光','奶油暖金 · 細緻柔緞','柔霧奶油底色配細暖金邊，光澤收斂，適合日常聊天。','01'],
 ['rose','玫瑰珍珠','蜜桃粉紫 · 珍珠光澤','蜜桃粉融入淡紫，邊緣像珍珠反光，柔和呼應酒館的粉色家具。','02'],
 ['lavender','暮紫流霞','淡紫暖粉 · 琉璃漸層','淡紫透出一點暖粉，金紫交織的細邊緩緩變化，保留安靜的閱讀區。','03'],
 ['night','夜釀鎏金','暖梅深紫 · 流金細邊','暖梅紫底色搭配奶油白文字，細金邊帶出酒館夜晚的氣氛。','04'],
 ['mint','晨露玉光','柔玉奶綠 · 透亮微光','奶油色融入柔玉綠，薄薄的光邊呼應酒館藤蔓和暖燈。','05'],
 ['blossom','粉晶花釀','茶玫瑰色 · 雙層柔光','茶玫瑰色的粉晶底，細邊和內緣微光形成層次，沒有額外的貼飾。','06'],
 ['ribbon','奶霜小貓','暖粉蜜橘 · 線條小貓','暖粉蜜橘漸層搭配小巧的貓咪輪廓與圓體文字，保留四邊的細緞帶和小爪印。','07'],
 ['lattice','花茶小兔','淡紫奶茶 · 垂耳小兔','淡紫框的四邊繞上花梗與小葉片，頂部一朵小花，搭配捧茶的小兔。','08'],
 ['glass','蜜桃小鳥','蜜桃奶霜 · 圓滾小鳥','蜜桃框的上下邊有柔弧花邊，兩側點上奶油色珠點，頂部的小花苞呼應停靠的小鳥。','09']
];
const $=id=>document.getElementById(id),segmenter=new Intl.Segmenter('zh-Hant',{granularity:'grapheme'});let selected='ribbon',effects=true,composing=false;
const art={
 ribbon:[
 '<svg viewBox="0 0 48 48" fill="none"><path d="M23 27C4 22 3 5 11 6C20 7 23 17 23 27ZM25 27C27 9 40 6 41 15C42 23 32 28 25 27ZM22 29C5 23 5 41 15 39C21 38 24 33 22 29ZM26 29C39 24 43 38 34 39C28 39 25 34 26 29Z" fill="#e8bfd5" stroke="#9f819b" stroke-width="2.2"/><path d="M23 21L25 35M22 22L18 17M25 22L29 18" stroke="#8f7887" stroke-width="2" stroke-linecap="round"/><path d="M9 13L13 11M33 16L36 14" stroke="#fff7ed" stroke-width="2.4" stroke-linecap="round"/><circle cx="9" cy="43" r="2" fill="#e4c58b"/></svg>',
 '<svg viewBox="0 0 40 34" fill="none"><path d="M7 26C3 22 4 16 7 12L7 3L15 9Q20 7 25 9L33 3L33 13C37 17 37 23 33 26Q20 32 7 26Z" stroke="#a46759" stroke-width="1.7"/><path d="M11 18Q13 16 15 18M25 18Q27 16 29 18M18 21L20 23L22 21M20 23Q18 26 16 24M20 23Q22 26 24 24M4 21L9 22M31 22L36 21" stroke="#a46759" stroke-width="1.4"/></svg>'
 ],
 lattice:[
 '<svg viewBox="0 0 64 82" fill="none"><path d="M20 35C11 24 8 4 15 4C24 4 28 23 28 31M37 31C37 13 45 4 51 9C58 15 49 29 44 35" fill="#fff5e8" stroke="#a393ae" stroke-width="2.7"/><path d="M17 10C17 18 20 24 23 28M48 14L42 28" stroke="#e8b8ce" stroke-width="4" stroke-linecap="round"/><path d="M13 43C12 28 47 23 52 41C57 60 45 65 32 65C16 65 8 57 13 43Z" fill="#fff6e9" stroke="#a393ae" stroke-width="2.7"/><ellipse cx="23" cy="44" rx="2" ry="3" fill="#756779"/><ellipse cx="42" cy="44" rx="2" ry="3" fill="#756779"/><path d="M30 49L33 51L36 48" stroke="#b88a9c" stroke-width="2" stroke-linecap="round"/><ellipse cx="18" cy="50" rx="5" ry="2.7" fill="#efc2d0"/><ellipse cx="47" cy="50" rx="5" ry="2.7" fill="#efc2d0"/><path d="M22 59H43L41 76H25Z" fill="#b8d3c4" stroke="#91afa3" stroke-width="2"/><path d="M43 61C55 59 53 72 42 71" stroke="#91afa3" stroke-width="2.5"/><path d="M25 63H40M26 67H39" stroke="#eaf1df" stroke-width="2"/><ellipse cx="20" cy="63" rx="5" ry="4" fill="#fff5e7" stroke="#a393ae" stroke-width="1.8"/><ellipse cx="44" cy="63" rx="5" ry="4" fill="#fff5e7" stroke="#a393ae" stroke-width="1.8"/></svg>',
 '<svg viewBox="0 0 46 48" fill="none"><path d="M9 40C14 31 26 25 33 13" stroke="#a2b499" stroke-width="2"/><path d="M16 33C6 34 5 25 8 23C16 22 19 29 16 33ZM25 23C22 14 28 10 32 12C36 18 30 23 25 23Z" fill="#c7d6b3" stroke="#98ae90" stroke-width="1.5"/><path d="M31 17C17 16 20 5 27 7C29 -1 40 3 38 10C47 12 43 22 36 20C32 28 23 23 27 18Z" fill="#e8d1ed" stroke="#b19bc1" stroke-width="1.8"/><circle cx="33" cy="14" r="3" fill="#f4dc9c"/><circle cx="7" cy="12" r="2" fill="#edd69e"/><path d="M36 33V39M33 36H39" stroke="#d0b6da" stroke-width="1.6" stroke-linecap="round"/></svg>'
 ],
 glass:[
 '<svg viewBox="0 0 52 48" fill="none"><path d="M8 42C21 39 25 27 34 16" stroke="#acaa82" stroke-width="2"/><path d="M15 36C5 38 4 28 8 26C15 26 20 31 15 36ZM25 25C24 14 34 13 38 17C35 25 31 28 25 25Z" fill="#c8d3a6" stroke="#9eae85" stroke-width="1.5"/><path d="M13 16C6 9 13 2 19 7C24 -1 32 6 28 12C37 17 30 25 24 22C20 32 10 24 13 19C5 23 3 14 13 16Z" fill="#f7ddaa" stroke="#c8a378" stroke-width="1.8"/><circle cx="20" cy="15" r="4" fill="#df9f9d"/><circle cx="42" cy="32" r="2" fill="#eac2a0"/></svg>',
 '<svg viewBox="0 0 64 64" fill="none"><path d="M14 44C4 42 5 35 10 32C8 20 17 9 30 11C33 4 39 7 38 12C54 13 60 26 55 38C64 44 57 50 51 48C40 58 23 57 14 44Z" fill="#fff3d9" stroke="#a98273" stroke-width="2.7" stroke-linejoin="round"/><path d="M15 28C15 16 28 12 35 15" stroke="#fffcf0" stroke-width="3" stroke-linecap="round"/><ellipse cx="23" cy="32" rx="2.1" ry="2.9" fill="#77574f"/><ellipse cx="43" cy="32" rx="2.1" ry="2.9" fill="#77574f"/><path d="M28 37L34 34L39 37L33 41Z" fill="#e8b77b" stroke="#bd9266" stroke-width="1.3"/><ellipse cx="18" cy="38" rx="5" ry="2.8" fill="#edb6ac"/><ellipse cx="48" cy="38" rx="5" ry="2.8" fill="#edb6ac"/><path d="M25 54L23 59M40 54L42 59" stroke="#b18c72" stroke-width="2" stroke-linecap="round"/><path d="M10 38L17 41M49 41L56 38" stroke="#c8a68b" stroke-width="1.6"/></svg>'
 ]
};
function paintEdges(box,id){
 box.querySelector('.edge-art')?.remove();if(!art[id]||!box.offsetWidth||!box.offsetHeight)return;
 const w=box.offsetWidth+14,h=box.offsetHeight+14,x2=w-7,y2=h-7,c=w/2;
 const paths=[];
 const path=(d,color,width=1.2,fill='none',extra='')=>paths.push('<path d="'+d+'" fill="'+fill+'" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round" '+extra+'/>');
 const circle=(x,y,r,fill,stroke='none')=>paths.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width=".8"/>');
 if(id==='ribbon'){
  paths.push('<rect x="10" y="10" width="'+(w-20)+'" height="'+(h-20)+'" rx="11" fill="none" stroke="#d5a6b8" stroke-width=".8" stroke-dasharray="2 4"/>');
  path('M18 6Q'+c+' 1 '+(w-18)+' 6','#d1a0b2',1.5);path('M19 '+(h-6)+'Q'+c+' '+(h-1)+' '+(w-19)+' '+(h-6),'#d1a0b2',1.4);
  for(const x of [6,w-6]){path('M'+x+' 20Q'+(x===6?1:w-1)+' '+h/2+' '+x+' '+(h-19),'#d4adb8',1.7);path('M'+(x-3)+' '+(h/2-3)+'L'+(x+3)+' '+(h/2+3)+'M'+(x+3)+' '+(h/2-3)+'L'+(x-3)+' '+(h/2+3),'#c397ac',1.4);}
  path('M'+(c-4)+' 5Q'+(c-6)+' 1 '+(c-2)+' 1Q'+c+' -2 '+(c+2)+' 1Q'+(c+6)+' 1 '+(c+4)+' 5Q'+c+' 8 '+(c-4)+' 5','#bc8ea2',.7,'#e5b8cb');
  for(const [dx,dy] of [[-5,-1],[-2,-3],[2,-3],[5,-1]])circle(c+dx,3+dy,1.15,'#dbabc1');
  for(const x of [c-17,c+17])circle(x,4,1.3,'#fff4e1','#d6b59b');
 }else if(id==='lattice'){
  path('M17 6Q'+c+' 2 '+(w-18)+' 6M17 '+(h-6)+'Q'+c+' '+(h-2)+' '+(w-18)+' '+(h-6),'#9daf96',1.15);
  path('M7 18Q2 '+h/2+' 7 '+(h-17)+'M'+(w-7)+' 18Q'+(w-2)+' '+h/2+' '+(w-7)+' '+(h-17),'#a6b69e',1.15);
  for(let x=25;x<w-20;x+=27){for(const y of [5,h-5]){const sign=y<10?-1:1;path('M'+x+' '+y+'Q'+(x+1)+' '+(y+sign*6)+' '+(x+7)+' '+(y+sign*5)+'Q'+(x+6)+' '+(y+sign)+' '+x+' '+y,'#93a98d',.65,'#c0d0ad');}}
  for(const x of [5,w-5]){path('M'+x+' '+h/2+'Q'+(x<10?x-5:x+5)+' '+(h/2-7)+' '+x+' '+(h/2-9)+'Q'+(x<10?x+3:x-3)+' '+(h/2-4)+' '+x+' '+h/2,'#a4b49d',.65,'#c9d7bc');}
  for(const dx of [-3,3])circle(c+dx,3,2.5,'#ead3e9','#b99fc5');circle(c,0,2.5,'#ead3e9','#b99fc5');circle(c,5,2.5,'#ead3e9','#b99fc5');circle(c,3,1.7,'#efd8a2');
 }else{
  for(const y of [6,h-6]){let d='M17 '+y;const end=w-17,n=Math.max(2,Math.round((end-17)/18)),step=(end-17)/n;for(let k=0;k<n;k++)d+='q'+step/2+' '+(y<10?-5:5)+' '+step+' 0';path(d,'#f8efd8',3);path(d,'#d2a491',.9);}
  for(const x of [6,w-6]){path('M'+x+' 18Q'+(x<10?0:w)+' '+h/2+' '+x+' '+(h-18),'#f9e5c2',3.4);path('M'+x+' 18Q'+(x<10?0:w)+' '+h/2+' '+x+' '+(h-18),'#d5ac91',.8);circle(x,h/2,1.5,'#eed3a2');}
  path('M'+c+' 6V0M'+c+' 3L'+(c-5)+' 0M'+c+' 3L'+(c+5)+' 0','#a9b58b',1.2);circle(c,-1,2.5,'#f5d497','#cba57d');circle(c-5,0,1.8,'#f2bcb0');circle(c+5,0,1.8,'#f2bcb0');
 }
 const el=document.createElement('span');el.className='edge-art';el.setAttribute('aria-hidden','true');el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'+paths.join('')+'</svg>';box.append(el);
}
function decorate(box,id){box.querySelectorAll('.frame-art').forEach(e=>e.remove());paintEdges(box,id);if(!art[id])return;for(const [i,side] of ['left','right'].entries()){const el=document.createElement('span');el.className='frame-art '+side;el.setAttribute('aria-hidden','true');el.innerHTML=art[id][i]||art[id][0];box.append(el);}}
const parts=value=>[...segmenter.segment(value)].map(x=>x.segment);
function bubble(skin){const box=document.createElement('div');box.className='bubble '+skin;box.innerHTML='<span class="message"></span>';decorate(box,skin);return box;}
function choose(id){selected=id;const skin=skins.find(x=>x[0]===id);$('mainBubble').className='bubble '+id;decorate($('mainBubble'),id);$('selectedName').textContent=skin[4]+' '+skin[1];$('selectedDescription').textContent=skin[3];document.querySelectorAll('.skin-choice').forEach(b=>{const active=b.dataset.skin===id;b.setAttribute('aria-pressed',String(active));b.querySelector('.check').textContent=active?'✓':'';});window.dispatchEvent(new CustomEvent('tt-bubble-skin-change',{detail:{id}}));}
for(const skin of [...skins.slice(6),...skins.slice(0,6)]){const [id,name,subtitle,description,number]=skin;const button=document.createElement('button');button.className='skin-choice';button.dataset.skin=id;button.setAttribute('aria-pressed','false');button.innerHTML='<span class="swatch '+id+'" aria-hidden="true"></span><span><strong>'+name+'</strong><small>'+subtitle+'</small></span><span class="check" aria-hidden="true"></span>';button.onclick=()=>choose(id);$(art[id]?'skinList':'basicSkinList').append(button);const card=document.createElement('article');card.className='compare-card';const scene=document.createElement('div');scene.className='compare-scene';scene.append(bubble(id));card.append(scene);const footer=document.createElement('footer');footer.innerHTML='<strong>'+number+' '+name+'</strong><span>'+subtitle.split(' · ')[0]+'</span>';card.append(footer);$('comparisonGrid').append(card);}
function update(){if(composing)return;const text=parts($('message').value).slice(0,18).join('');$('message').value=text;document.querySelectorAll('.message').forEach(e=>e.textContent=text||'…');$('count').textContent=parts(text).length+' / 18';document.querySelectorAll('.bubble').forEach(box=>paintEdges(box,[...box.classList].find(id=>art[id])));}
$('message').addEventListener('input',update);$('message').addEventListener('compositionstart',()=>composing=true);$('message').addEventListener('compositionend',()=>{composing=false;update();});document.querySelectorAll('[data-text]').forEach(b=>b.onclick=()=>{$('message').value=b.dataset.text;update();});$('effects').onclick=()=>{effects=!document.body.classList.contains('effects-on');document.body.classList.toggle('effects-on',effects);$('effects').setAttribute('aria-pressed',String(effects));$('effects').textContent='邊框流光：'+(effects?'開':'關');};
function drawCharacter(){const source=$('doll'),ctx=source.getContext('2d'),pixels=ctx.getImageData(0,0,source.width,source.height).data;let left=source.width,top=source.height,right=-1,bottom=-1;for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(right<0)return;const out=$('character');out.width=right-left+1;out.height=bottom-top+1;out.getContext('2d').drawImage(source,left,top,out.width,out.height,0,0,out.width,out.height);}
window.TTBubblePreview=Object.freeze({select:choose,getSelected:()=>selected,skins:skins.map(([id,name])=>({id,name}))});
window.addEventListener('tt-preview-doll-drawn',drawCharacter);drawCharacter();choose(selected);update();document.fonts.ready.then(update);window.addEventListener('resize',update);document.body.classList.add('effects-on');
})();
