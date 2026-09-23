/* 縭：沿原構圖分層，星芒翻面、斜線逐條向右上劃出。 */
(() => {
  const host = document.querySelector('#profileWindow');
  if (!host || host.querySelector('.rira-layered-art')) return;
  const stars = [
    [32,95,11,17,'#381953'],[75,205,17,30,'#311747'],
    [75,325,29,54,'#321849'],[164,252,99,118,'#ffd1b1'],
    [240,113,62,71,'#ffd7bd'],[350,112,35,49,'#da8be0'],
    [432,96,31,41,'#35164e'],[489,141,37,45,'#35164e'],
    [518,66,14,21,'#ffdbbf'],[623,72,36,45,'#eaa0dd'],
    [672,89,22,31,'#8147c4'],[946,102,14,17,'#f6bde4'],
    [1273,80,26,34,'#eea1e1'],[1412,189,76,86,'#f6bee8'],
    [1317,274,24,31,'#f4b9df'],[1491,275,17,22,'#efb7e4'],
    [1506,29,14,17,'#f4c5e8'],[727,300,23,29,'#f3b5e8'],
    [200,462,19,25,'#572386'],[113,640,35,28,'#dd9edd'],
    [329,684,20,26,'#ffe1bd'],[628,764,68,83,'#eba9e4'],
    [798,595,23,32,'#f8d3b1'],[719,665,23,32,'#c986dc'],
    [584,851,17,23,'#dc9be2'],[490,905,27,33,'#f9d7bd'],
    [1360,604,22,32,'#44205f'],[1256,679,18,23,'#45205f'],
    [1411,735,113,134,'#ffc6bd'],[1411,740,70,81,'#54237e'],
    [1138,883,22,31,'#462161'],[1463,897,30,37,'#f1b2e5'],
    [1027,863,14,22,'#eeb4e0']
  ];
  const starPath = (w,h) => `M0 ${-h} C${w*.12} ${-h*.19} ${w*.18} ${-h*.1} ${w} 0 C${w*.18} ${h*.1} ${w*.12} ${h*.19} 0 ${h} C${-w*.12} ${h*.19} ${-w*.18} ${h*.1} ${-w} 0 C${-w*.18} ${-h*.1} ${-w*.12} ${-h*.19} 0 ${-h}Z`;
  const starMarkup = stars.map(([x,y,w,h,color],i) => {
    // 右下雙色星芒共用節奏，翻面仍保持同一圖形。
    const phase=i===29?28:i;
    return `<g transform="translate(${x} ${y})"><g class="rira-turn-star" style="--turn-delay:${-(phase*1.17%6.4).toFixed(2)}s;--star-face:${color}"><path d="${starPath(w,h)}"/></g></g>`;
  }).join('');
  const stripes = (x,y,count,length,spacing,color,phase,width) => Array.from({length:count},(_,i) => `<path class="rira-stripe" d="M${x+i*spacing} ${y}l${length} ${-length}" pathLength="100" stroke="${color}" stroke-width="${width}" style="--stripe-delay:${(phase+i*.115).toFixed(3)}s"/>`).join('');
  const layer=document.createElement('div');
  layer.className='rira-layered-art';
  layer.setAttribute('aria-hidden','true');
  layer.innerHTML=`<svg viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" focusable="false">${starMarkup}<g fill="none">${stripes(1098,64,9,70,20,'#bc59db',-2.5,7)}${stripes(840,973,7,22,16,'#361748',-.5,9)}</g></svg>`;
  host.prepend(layer);
  host.dataset.riraLayered='true';
})();
