/* 桃與縭維持原圖光效；卡布使用覆蓋整張卡面的透明反光膜。 */
(() => {
 const host=document.querySelector('#profileWindow');if(!host)return;
 const layer=document.createElement('div');layer.className='profile-kinetics';layer.setAttribute('aria-hidden','true');
 layer.innerHTML=`<svg class="registered-light" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice">
 <defs>
  <linearGradient id="kin-travel-glow"><stop stop-color="white" stop-opacity="0"/><stop offset=".46" stop-color="white" stop-opacity=".25"/><stop offset=".6" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
  <radialGradient id="kin-star-glow"><stop stop-color="white"/><stop offset=".65" stop-color="white" stop-opacity=".85"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
  <linearGradient id="kin-silk-glow"><stop stop-color="white" stop-opacity="0"/><stop offset=".5" stop-color="white" stop-opacity=".85"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
  <mask id="kin-rira-map" maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
   <g transform="rotate(-45 768 512)"><rect class="registered-rira-scan" x="-300" y="-1100" width="210" height="3200" fill="url(#kin-travel-glow)"/></g>
   <circle class="registered-star star-left" cx="160" cy="247" r="126" fill="url(#kin-star-glow)"/>
   <circle class="registered-star star-right" cx="1408" cy="736" r="134" fill="url(#kin-star-glow)"/>
  </mask>
  <clipPath id="kin-momo-wave-region"><path d="M0 620L675 1024H1536V180L720 760L0 620Z"/></clipPath>
  <mask id="kin-momo-map" maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
   <g clip-path="url(#kin-momo-wave-region)"><g transform="rotate(45 768 512)"><rect class="registered-wave-scan" x="-400" y="-1100" width="320" height="3200" fill="url(#kin-silk-glow)"/></g></g>
   <path class="registered-fan fan-top" d="M0 0H440Q285 260 0 255Z" fill="url(#kin-star-glow)"/>
   <path class="registered-fan fan-bottom" d="M700 1024Q885 380 1536 425V1024Z" fill="url(#kin-star-glow)"/>
  </mask>
 </defs>
 <image class="registered-rira" width="1536" height="1024" mask="url(#kin-rira-map)"/>
 <image class="registered-momo" width="1536" height="1024" mask="url(#kin-momo-map)"/>

 </svg>`;
 host.prepend(layer);
 // 原創三角切面：每片固定不位移，亮度波依橫向位置延遲，從左往右傳遞。
 const facets=document.createElement('div');facets.className='kabuki-facet-field';facets.setAttribute('aria-hidden','true');
 const palette=['#4686c5','#629bd4','#86bce8','#a1d9ed','#bcebf2','#d3f3f5'];
 const activePalette=['#3476b5','#4b8ac4','#65a4d0','#8bc0dd','#acd7ea','#d4eaf4'];
 const cells=[];const side=58;const height=side*Math.sqrt(3)/2;
 for(let row=0;row<14;row++){
  for(let col=-1;col<19;col++){
   const x=col*side+(row%2)*side/2,y=row*height;
   for(let half=0;half<2;half++){
    const cx=x+side*(half?.99:.5),cy=y+height*(half?.66:.33);
    const seed=((row*73+(col+3)*41+half*29)%101)/100;
    const fade=Math.max(0,1-cx/850)*Math.pow(Math.max(0,1-cy/620),1.65);
    const strength=Math.pow(fade,.83)*(.64+seed*.36);
    if(strength<.025)continue;
    const colorIndex=Math.min(palette.length-1,Math.floor(seed*palette.length));
    const color=palette[colorIndex],activeColor=activePalette[colorIndex];
    const points=half?`${x+side},${y} ${x+side*1.5},${y+height} ${x+side/2},${y+height}`:`${x},${y} ${x+side},${y} ${x+side/2},${y+height}`;
    cells.push(`<polygon points="${points}" fill="${color}" fill-opacity="${strength.toFixed(3)}" style="--facet-color:${color};--facet-active:${activeColor};--facet-delay:${(-6.2+cx/1000*3.27).toFixed(3)}s"/>`);
   }
  }
 }
 facets.innerHTML=`<svg viewBox="0 0 1000 640" preserveAspectRatio="xMinYMid slice" focusable="false">${cells.join('')}</svg>`;
 host.prepend(facets);
 const sheen=document.createElement('div');
 sheen.className='kabuki-card-sheen';sheen.setAttribute('aria-hidden','true');host.append(sheen);
 const refresh=()=>{
  const id=host.dataset.cast;
  if(!['MOMO','RIRA'].includes(id))return;
  const source=getComputedStyle(host).getPropertyValue('--profile-image').trim();
  const match=source.match(/^url\(["']?(.*?)["']?\)$/);
  if(!match)return;
  const picture=layer.querySelector('.registered-'+id.toLowerCase());
  if(picture.getAttribute('href')!==match[1])picture.setAttribute('href',match[1]);
 };
 new MutationObserver(refresh).observe(host,{attributes:true,attributeFilter:['data-cast','data-momo-tone']});
 refresh();
})();
