/* v555 訂單票卡（D 11/19 定案；D 11/19 再改：「好卡，做薄薄的跟滑鼠移動就好，不用強調 3D」→ 沒有厚度、不自己擺動，只有滑鼠在上面時整張輕輕傾斜＋光跟著走）：版型「戊」＝收據鋸齒邊＋右邊可撕的票根、材質 11「碎鑽亮片」、已付款章 1「貓臉郵戳」
   （店貓吉祥物，透明壓紋水印蓋在票根條碼上，傾斜時閃虹光）。中間是冒險者繪師 Q 繪抽出的描邊印章＋水印底。
   比稿頁的產生器在 scratchpad（tk2_helpers／tk3_receipt／tk4_mat／tk4_paid／tk4_build），這裡只留定案那一款。
   只負責畫票面（回傳 HTML 字串），不讀寫任何資料；資料由 hub-fit.js 從訂單整理好傳進來。 */
(function(){
'use strict';
const W=560,H=210,TX=452;   // 票面大小、撕線位置
const f1=n=>Math.round(n*10)/10,p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let SEED=7;const rnd=()=>{SEED=(SEED*16807)%2147483647;return (SEED-1)/2147483646;};
const svgUrl=s=>`url('data:image/svg+xml,${encodeURIComponent(s)}')`;
const star4=(x,y,r,k=.13)=>{const q=r*k;return `M${f1(x)} ${f1(y-r)}Q${f1(x+q)} ${f1(y-q)} ${f1(x+r)} ${f1(y)}Q${f1(x+q)} ${f1(y+q)} ${f1(x)} ${f1(y+r)}Q${f1(x-q)} ${f1(y+q)} ${f1(x-r)} ${f1(y)}Q${f1(x-q)} ${f1(y-q)} ${f1(x)} ${f1(y-r)}Z`;};
/* 外形：上下平、左右鋸齒，撕線上下各一個半圓缺口 */
const SHAPE=(()=>{let s=`M6 0H${TX-10}A10 10 0 0 0 ${TX+10} 0H554`;for(let y=0;y<H;y+=10)s+=`L560 ${y+5}L554 ${y+10}`;s+=`H${TX+10}A10 10 0 0 0 ${TX-10} 210H6`;for(let y=H;y>0;y-=10)s+=`L0 ${y-5}L6 ${y-10}`;return s+'Z';})();
const sv=(inner,style='')=>`<svg class="tkr-sv" style="width:${W}px;height:${H}px;${style}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;

/* 虹光描線遮罩：白線畫在 SVG 裡當遮罩，底下是會隨角度流動的彩虹 */
function holoMask(){const de=[];
 const g={
  c(x,y,r,w=1.2,o=1){de.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="none" stroke="#fff" stroke-width="${w}"${o<1?` stroke-opacity="${o}"`:''}/>`);},
  dot(x,y,r){de.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="#fff"/>`);},
  spark(x,y,r){de.push(`<path d="${star4(x,y,r)}" fill="#fff"/>`);},
  raw(s){de.push(s);},
  url(){return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" overflow="visible">${de.join('')}</svg>`);}};
 return g;}

/* 冒險者印章（繪師 Q 繪抽的線稿＋水印底）；沒有指定冒險者時放店貓線稿
   （D 11/20「腳腳不見了」：主題那張是探頭用、下面切掉的 → 票卡改用補上後腳的 tk-mascot.png，400×281） */
const STAFF={RIRA:{w:349,h:356},KABUKI:{w:258,h:356},MOMO:{w:335,h:356}};
function adventurer(n){
 const S=STAFF[n],win=`left:268px;top:0;width:${TX-272}px;height:${H}px`;
 if(!S){const w=150,h=f1(w*281/400);   // 店貓 400×281
  return `<div class="tkr-a tkr-win" style="${win}"><img src="lobby-ui/assets/tk-mascot.png" alt="" style="position:absolute;left:${f1((TX-272-w)/2)}px;top:${f1(112-h/2)}px;width:${w}px;height:${h}px;opacity:.3"></div>`;}
 const h=206,w=S.w/S.h*h,x=364-w/2-268,y=4;
 return `<div class="tkr-a tkr-win" style="${win}"><div style="position:absolute;left:${f1(x)}px;top:${y}px">`+
  `<img src="lobby-ui/assets/tk-wm-${n}.png" alt="" style="position:absolute;left:0;top:0;width:${f1(w)}px;height:${h}px">`+
  `<img src="lobby-ui/assets/tk-stamp-${n}.png" alt="" style="position:absolute;left:0;top:0;width:${f1(w)}px;height:${h}px;opacity:.24"></div></div>`;
}

/* 左邊收據明細：rows＝[[左,右]]（冒險者、內容…），右邊太長會省略 */
function receipt(P){
 const row=(l,r,cls='')=>`<div class="tkr-row${cls}"><span>${esc(l)}</span><b>${esc(r)}</b></div>`;
 return `<div class="tkr-a tkr-mono tkr-rc" style="left:26px;top:18px;width:240px">
  <div class="tkr-ttl"><span>TINY TAVERN</span><b class="tkr-lat">${P.m}/${p2(P.d)}</b></div><div class="tkr-sub">RECEIPT ✦ 收據　#${esc(P.no.slice(-4))}</div>
  <div class="tkr-dash"></div>${row(`${P.m}/${p2(P.d)} ${P.wd}`,P.hm)}${row(P.plan,P.price)}
  ${(P.rows||[]).slice(0,2).map(([l,r])=>row('　'+l,r,' is-sub')).join('')}
  <div class="tkr-dash"></div>${row('TOTAL',P.total,' is-total')}</div>`;
}

/* 右邊票根：撕線＋直排字＋直立條碼 */
function barcode(h,seed){SEED=seed;let s='',t=0;while(t<162){const bw=rnd()<.35?2.4:1.1;s+=`<rect x="0" y="${f1(t)}" width="${h}" height="${bw}" fill="currentColor"/>`;t+=bw+1+rnd()*1.6;}return s;}
function stub(P){
 return sv(`<path d="M${TX} 16V194" stroke="rgba(255,255,255,.85)" stroke-width="1.6" stroke-dasharray="5 5" stroke-linecap="round"/>`)+
 `<div class="tkr-a tkr-lat tkr-vt" style="left:${TX+10}px;top:18px;height:96px;font-size:11px;letter-spacing:.2em;color:var(--s1)">ADMIT ONE</div>
 <div class="tkr-a tkr-vt" style="left:${TX+10}px;top:116px;height:80px;font-size:10.5px;font-weight:800;letter-spacing:.08em;color:var(--s2);white-space:nowrap">${esc(P.z)} ${P.m}.${p2(P.d)}</div>
 <svg class="tkr-a" style="left:${TX+48}px;top:24px;width:34px;height:162px;color:var(--s1)" width="34" height="162" viewBox="0 0 34 162">${barcode(34,P.seed)}</svg>
 <div class="tkr-a tkr-mono tkr-vt" style="left:${TX+34}px;top:24px;height:162px;font-size:7.5px;font-weight:800;letter-spacing:.22em;color:var(--s2)">${esc(P.no)}</div>`;
}

/* 已付款章「貓臉郵戳」：圓形郵戳＋店貓臉＋上下郵票銷戳波浪線，蓋在條碼上。void＝已取消（同一個章，字改已取消） */
const wav=(x,y1,y2,a=2.6,per=15)=>{let d='';for(let y=y1;y<=y2+.01;y+=2)d+=(d?'L':'M')+f1(x+a*Math.sin((y-y1)/per*2*Math.PI))+' '+f1(y);return d;};
let GID=0;
function postmark(P){
 if(!P.stamp)return '';
 const id='tkr'+(GID++),w=96,h=180,deg=-8,cx=TX+54,box=`left:${f1(cx-w/2)}px;top:${f1(106-h/2)}px;width:${w}px;height:${h}px`;
 const S=`style="stroke:var(--wm)" fill="none"`,F=`style="fill:var(--wm)"`,R=`fill="url(#${id}g)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" paint-order="stroke"`,face='lobby-ui/assets/tk-paid-face.png',fb=[26,76.4,44,27.2];
 const word=P.stamp==='void'?'已取消':'已付款';
 const waves=[36,48,60].map(x=>[wav(x,4,46),wav(x,134,176)]).flat();
 // 郵戳字與星星用虹光漸層＋細白邊（D 11/19：黑黑的好醜；純白壓在白條碼上看不到字）
 const art=`<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e868b4"/><stop offset=".35" stop-color="#a57af0"/><stop offset=".7" stop-color="#4fb0ee"/><stop offset="1" stop-color="#3fcfae"/></linearGradient></defs>
  <circle cx="48" cy="90" r="38" ${S} stroke-width="2.4"/><circle cx="48" cy="90" r="28" ${S} stroke-width="1"/>
  <path id="${id}t" d="M18.9 79.5A30.8 30.8 0 0 1 77.1 79.5" fill="none"/><path id="${id}b" d="M15.6 101.8A34.5 34.5 0 0 0 80.4 101.8" fill="none"/>
  <text font-family="TT Title" font-size="7" letter-spacing=".9" ${R}><textPath href="#${id}t" startOffset="50%" text-anchor="middle">TINY TAVERN</textPath></text>
  <text font-family="LINE Seed TW" font-weight="800" font-size="7.4" letter-spacing=".6" ${R}><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${word} · ${p2(P.sm)}.${p2(P.sd)}</textPath></text>
  <path d="${star4(14.6,90,3.4)}" ${R}/><path d="${star4(81.4,90,3.4)}" ${R}/>
  ${waves.map(d=>`<path d="${d}" ${S} stroke-width="1.5" stroke-linecap="round"/>`).join('')}`;
 const holo=svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><circle cx="48" cy="90" r="38" fill="none" stroke="#fff" stroke-width="2"/><circle cx="48" cy="90" r="28" fill="none" stroke="#fff" stroke-width=".9"/>${waves.map(d=>`<path d="${d}" fill="none" stroke="#fff" stroke-width="1.2"/>`).join('')}</svg>`);
 const fm=`url('${face}') ${fb[0]}px ${fb[1]}px/${fb[2]}px ${fb[3]}px no-repeat`,hm=`${fm},${holo} 0 0/100% 100% no-repeat`;
 return `<div class="tkr-a tkr-pw" style="${box};--pd:${deg}deg;transform:rotate(${deg}deg);filter:drop-shadow(0 1px 0 var(--embD)) drop-shadow(0 -1px 0 var(--embL))">`+
  `<div style="position:absolute;left:${fb[0]}px;top:${fb[1]}px;width:${fb[2]}px;height:${fb[3]}px;background:var(--wm);-webkit-mask:url('${face}') 0 0/100% 100% no-repeat;mask:url('${face}') 0 0/100% 100% no-repeat"></div>`+
  `<svg style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;overflow:visible" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${art}</svg></div>`+
  `<div class="tkr-a tkr-pw tkr-holo" style="${box};--pd:${deg}deg;transform:rotate(${deg}deg);opacity:.5;-webkit-mask:${hm};mask:${hm}"><i class="tkr-hg"></i></div>`;
}

/* P＝{n:'RIRA'|null, z:'縭', m,d,wd,hm, plan, price, rows:[[l,r]], total, no, seed, stamp:'paid'|'void'|null, sm,sd} */
function build(P){
 const g=holoMask();
 g.raw(`<text x="26" y="196" font-family="Arial" font-size="9" letter-spacing="2" fill="#fff">THANK YOU ✦ SEE YOU AGAIN</text>`);g.c(TX,0,13,1,.8);g.c(TX,210,13,1,.8);   // D 11/19：亮片星星點點太多很怪 → 拿掉，只留字與缺口虹光
 const rim=svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${SHAPE}" fill="none" stroke="#fff" stroke-width="2.6"/></svg>`);
 return `<div class="tkr" style="--tk:path('${SHAPE}')" data-stamp="${P.stamp||''}">
  <div class="tkr-L tkr-film"></div>
  <div class="tkr-L"><div class="tkr-stubbg" style="left:${TX}px"></div></div>
  <div class="tkr-L tkr-sheen"></div>
  ${adventurer(P.n)}${receipt(P)}${stub(P)}${postmark(P)}
  ${sv(`<path d="${SHAPE}" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="3"/>`)}
  <div class="tkr-bd"><div class="tkr-holo" style="--m:${g.url()}"><i class="tkr-hg"></i></div></div>
  <div class="tkr-holo" style="--m:${rim}"><i class="tkr-hg"></i></div>
  <div class="tkr-L tkr-glare"><i></i></div>
 </div>`;
}
window.TTTicket={build,W,H};
})();
