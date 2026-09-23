/* 角色資訊窗的原創描線裝飾；僅新增本地 SVG，不碰角色、名單或訂單。 */
(() => {
  'use strict';

  function installProfileTraces() {
    const host = document.getElementById('profileWindow');
    if (!host || host.querySelector('.profile-traces')) return;

    const layer = document.createElement('div');
    layer.className = 'profile-traces';
    layer.setAttribute('aria-hidden', 'true');

    // 每條路徑各有安靜的底線與短亮段；亮段沿原線行走，整組圖形不位移。
    const trace = (d, duration, delay, extra = '', width = 1, dash = '13 87') =>
      `<g class="pt-unit ${extra}" style="--pt-duration:${duration}s;--pt-delay:${delay}s;--pt-width:${width};--pt-dash:${dash}">
        <path class="pt-base" d="${d}"/>
        <path class="pt-run" pathLength="100" d="${d}"/>
      </g>`;
    const dot = (d, duration, delay) =>
      `<circle class="pt-route-dot" r="1.7" cx="0" cy="0" style="offset-path:path('${d}');--pt-duration:${duration}s;--pt-delay:${delay}s"/>`;
    const svg = (theme, content) =>
      `<svg class="pt-theme pt-${theme}" viewBox="0 0 1000 640" preserveAspectRatio="xMinYMid slice" focusable="false" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

    const kabuki = `<g class="kabuki-water" fill="none">
      <ellipse class="kabuki-water-ring water-first" cx="246" cy="509" rx="132" ry="33"/>
      <ellipse class="kabuki-water-ring water-second" cx="246" cy="509" rx="132" ry="33"/>
      <ellipse class="kabuki-water-ring water-third" cx="246" cy="509" rx="132" ry="33"/>
    </g>`;

    const rira = [
      trace('M 140 36 L 239 184 L 140 332 L 41 184 Z', 22, -4.2, '', 1.1, '15 85'),
      trace('M 313 117 L 353 217 L 453 257 L 353 297 L 313 397 L 273 297 L 173 257 L 273 217 Z', 20, -14.1, 'pt-faint', .9, '12 88'),
      trace('M 78 351 L 102 411 L 162 435 L 102 459 L 78 519 L 54 459 L -6 435 L 54 411 Z', 16, -8.6, '', 1.2),
      trace('M 267 403 L 349 526 L 267 649 L 185 526 Z', 19, -11.4, '', 1.1, '16 84'),
      trace('M 431 16 L 447 57 L 488 73 L 447 89 L 431 130 L 415 89 L 374 73 L 415 57 Z', 14, -2.1, '', .8, '12 88'),
      trace('M 963 332 L 987 393 L 1048 417 L 987 441 L 963 502 L 939 441 L 878 417 L 939 393 Z', 21, -15.7, 'pt-edge', 1, '14 86'),
      trace('M -10 559 L 121 482 L 182 519', 18, -7.2, 'pt-faint', .7, '9 91'),
      dot('M 140 36 L 239 184 L 140 332 L 41 184 Z', 22, -4.2),
      dot('M 267 403 L 349 526 L 267 649 L 185 526 Z', 19, -11.4),
      '<g class="pt-anchor"><circle cx="431" cy="73" r="2"/><circle cx="78" cy="435" r="2"/><path d="M 456 478 H 464 M 460 474 V 482"/></g>'
    ].join('');

    const petal = (route, duration, delay, shape) =>
      `<g class="pt-petal-drift" style="offset-path:path('${route}');--pt-duration:${duration}s;--pt-delay:${delay}s"><path d="${shape}"/></g>`;
    const momo = [
      // 只留兩段邊角細弧；三片花瓣沿左側不同軌跡由左上往右下。
      trace('M -8 124 C 20 83 65 58 116 56', 22, -5.6, 'pt-arc', .85, '22 78'),
      trace('M 5 552 C 28 582 68 599 113 599', 24, -15.2, 'pt-arc pt-ink', .7, '24 76'),
      petal('M 16 92 C 48 110 64 146 96 165 C 115 177 130 197 147 219', 24, -3.1, 'M -5 -7 C 7 -8 12 0 3 9 C -5 7 -10 0 -5 -7 Z'),
      petal('M 129 166 C 148 185 158 212 184 232 C 213 255 219 279 238 303', 22, -12.4, 'M -6 -6 C 4 -10 10 -1 5 8 C -4 9 -10 1 -6 -6 Z'),
      petal('M 30 382 C 64 408 81 436 111 456 C 135 472 155 494 173 521', 20, -7.5, 'M -4 -8 C 8 -7 10 3 1 10 C -6 7 -9 -1 -4 -8 Z')
    ].join('');

    layer.innerHTML = svg('kabuki', kabuki) + svg('rira', rira) + svg('momo', momo);
    host.prepend(layer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installProfileTraces, { once: true });
  } else {
    installProfileTraces();
  }
})();
