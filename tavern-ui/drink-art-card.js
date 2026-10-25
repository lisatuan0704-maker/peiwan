/* Shared drink artwork renderer. Preserves original assets and saved composition; no purchase logic. */
(() => {
  'use strict';
  const DESIGN_WIDTH = 320;
  const states = new WeakMap(), mounted = new Set(), frozen = new Map();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const fonts = {arial:'Arial, sans-serif',impact:'Impact, Arial Black, sans-serif',rounded:'Trebuchet MS, Arial, sans-serif',serif:'Georgia, serif',mono:'Courier New, monospace'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
  const shapeMarkup = tone => {
    const paths = {
      kabuki:['<rect x="22" y="22" width="56" height="56" rx="3" transform="rotate(45 50 50)"/>','<rect x="22" y="22" width="56" height="56" rx="3"/>'],
      rira:['<path d="M50 12 90 82H10Z"/>','<path d="M50 12 90 82H10Z M50 30 73 70H27Z"/>'],
      momo:['<circle cx="50" cy="50" r="34"/>','<path d="M20 72A36 36 0 1 1 83 36 M28 62A25 25 0 0 1 70 35"/>']
    };
    return `<div class="ddc-depth ddc-geometry" aria-hidden="true">${Array.from({length:4}, (_,i) => `<span><svg viewBox="0 0 100 100">${(paths[tone] || paths.kabuki)[i % 2]}</svg></span>`).join('')}</div>`;
  };
  function position(part, pet = false) {
    return `left:${(160 + number(part.x)) / 320 * 100}%;top:${(430 + number(part.y)) / 430 * 100}%;width:${number(part.size,100) / 320 * 100}%;height:${number(part.size,100) * (pet ? 112/96 : 1) / 430 * 100}%`;
  }
  function watermark(part) {
    const x = (160 + number(part.x)) / 320 * 100, y = (430 + number(part.y)) / 430 * 100;
    const size = number(part.size,69) * 290 / 320;
    const style = `left:${x}%;top:${y}%;font-family:${fonts[part.font] || fonts.arial};font-weight:${number(part.weight,900)};font-size:${size}px;letter-spacing:${number(part.spacing) * 290 / 320}px;line-height:${number(part.lineHeight,1.05)};-webkit-text-stroke:${number(part.stroke,2)}px ${color(part.strokeColor,'#ffffff')};color:${part.filled ? color(part.fillColor,'#ffffff') : 'transparent'};opacity:${number(part.opacity,78)/100};--ddc-text-rotation:${number(part.rotation)}deg;--ddc-text-stretch:${number(part.stretch,100)/100};--ddc-text-skew:${number(part.skew)}deg;filter:drop-shadow(0 0 ${number(part.glow)}px ${color(part.strokeColor,'#ffffff')})`;
    return `<span class="ddc-watermark" style="${escape(style)}" aria-hidden="true">${escape(part.text)}</span>`;
  }
  function markup(asset, index = 0) {
    if (!asset || !asset.layout) throw new Error('Missing separated drink artwork at index ' + index);
    const layout = asset.layout, tone = ['kabuki','rira','momo'].includes(asset.tone) ? asset.tone : 'kabuki';
    const companion = role => `<div class="ddc-depth ddc-${role}-depth"><span class="ddc-companion" data-role="${role}" style="${position(layout[role], role === 'pet')}"><img class="ddc-live" src="${escape(asset[role])}" alt="" draggable="false" decoding="sync"><canvas class="ddc-frozen" aria-hidden="true"></canvas></span></div>`;
    return `<div class="dynamic-drink-card" data-card-index="${index}" data-tone="${tone}" role="img" aria-label="${escape(asset.name)}的飲料卡"><div class="ddc-plane"><div class="ddc-design"><div class="ddc-paper"></div><div class="ddc-heading"><small>FOR YOU · 一杯小小心意</small><strong>${escape(asset.name)}的飲料</strong><span class="ddc-price" aria-label="99 金幣"><b>99</b><i>/</i><em>金幣</em></span></div><div class="ddc-scene">${shapeMarkup(tone)}<div class="ddc-depth ddc-title-depth">${watermark(layout.watermark)}</div><div class="ddc-depth ddc-drink-depth"><span class="ddc-drink" style="${position(layout.drink)}"><img src="${escape(asset.drink)}" alt="" draggable="false" decoding="sync"></span></div>${companion('staff')}${companion('pet')}</div></div></div></div>`;
  }
  function cards(root = document) {
    return [...(root.matches?.('.dynamic-drink-card') ? [root] : []), ...root.querySelectorAll('.dynamic-drink-card')];
  }
  function reset(card) {
    const state = states.get(card);
    if (state?.frame) cancelAnimationFrame(state.frame);
    if (state) { state.frame = 0; state.x = 0; state.y = 0; }
    card.style.setProperty('--ddc-rx','0deg');
    card.style.setProperty('--ddc-ry','0deg');
    card.style.setProperty('--ddc-px','0px');
    card.style.setProperty('--ddc-py','0px');
  }
  function syncOne(card) {
    const active = card.classList.contains('is-playing') && !reduced.matches;
    if (card.classList.contains('ddc-is-active') !== active) card.classList.toggle('ddc-is-active',active);
    card.dataset.motion = active ? 'playing' : 'still';
    if (!active || !finePointer.matches) reset(card);
  }
  async function firstFrame(src, fallbackImage) {
    if (!frozen.has(src)) {
      frozen.set(src, (async () => {
        let decoded;
        if ('ImageDecoder' in window && /^data:image\/gif;base64,/i.test(src)) {
          try {
            const raw = atob(src.slice(src.indexOf(',') + 1));
            const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
            const decoder = new ImageDecoder({data:bytes,type:'image/gif'});
            await decoder.tracks.ready;
            decoded = (await decoder.decode({frameIndex:0,completeFramesOnly:true})).image;
            const canvas = document.createElement('canvas');
            canvas.width = decoded.displayWidth; canvas.height = decoded.displayHeight;
            canvas.getContext('2d').drawImage(decoded,0,0);
            decoded.close(); decoder.close();
            return canvas;
          } catch (_) { if (decoded) decoded.close(); }
        }
        if (!fallbackImage.complete || !fallbackImage.naturalWidth) {
          await new Promise((resolve,reject) => {
            fallbackImage.addEventListener('load',resolve,{once:true});
            fallbackImage.addEventListener('error',reject,{once:true});
          });
        }
        const canvas = document.createElement('canvas');
        canvas.width = fallbackImage.naturalWidth; canvas.height = fallbackImage.naturalHeight;
        canvas.getContext('2d').drawImage(fallbackImage,0,0);
        return canvas;
      })());
    }
    return frozen.get(src);
  }
  function mount(root = document) {
    resyncAll();
    cards(root).forEach(card => {
      if (states.has(card)) { syncOne(card); return; }
      const state = {frame:0,x:0,y:0}; states.set(card,state); mounted.add(card);
      const resize = () => {
        const width = card.clientWidth;
        if (width) card.style.setProperty('--ddc-scale',String(width / DESIGN_WIDTH));
      };
      state.resize = new ResizeObserver(resize); state.resize.observe(card); resize();
      card.querySelectorAll('.ddc-companion').forEach(async sprite => {
        const image = sprite.querySelector('img'), canvas = sprite.querySelector('canvas');
        try {
          const still = await firstFrame(image.getAttribute('src'),image);
          canvas.width = still.width; canvas.height = still.height;
          canvas.getContext('2d').drawImage(still,0,0);
          sprite.dataset.freezeReady = 'true';
        } catch (_) { sprite.dataset.freezeReady = 'error'; }
      });
      card.addEventListener('pointermove',event => {
        if (card.closest('.drink-track.dragging')) { reset(card); return; }
        if (!card.classList.contains('ddc-is-active') || !finePointer.matches || event.pointerType === 'touch') return;
        const bounds = card.getBoundingClientRect();
        state.x = Math.max(-1,Math.min(1,(event.clientX - bounds.left) / bounds.width * 2 - 1));
        state.y = Math.max(-1,Math.min(1,(event.clientY - bounds.top) / bounds.height * 2 - 1));
        if (state.frame) return;
        state.frame = requestAnimationFrame(() => {
          state.frame = 0;
          if (card.closest('.drink-gallery.dragging')) { reset(card); return; }
          card.style.setProperty('--ddc-rx',`${(-state.y * 5).toFixed(2)}deg`);
          card.style.setProperty('--ddc-ry',`${(state.x * 7).toFixed(2)}deg`);
          card.style.setProperty('--ddc-px',`${(state.x * 3).toFixed(2)}px`);
          card.style.setProperty('--ddc-py',`${(state.y * 3).toFixed(2)}px`);
        });
      });
      card.addEventListener('pointerleave',() => reset(card));
      card.addEventListener('pointercancel',() => reset(card));
      state.classObserver = new MutationObserver(() => syncOne(card));
      state.classObserver.observe(card,{attributes:true,attributeFilter:['class']});
      syncOne(card);
    });
  }
  function sync(root = document) { cards(root).forEach(syncOne); }
  const resyncAll = () => mounted.forEach(card => {
    if (card.isConnected) syncOne(card);
    else {
      reset(card);
      states.get(card)?.resize.disconnect();
      states.get(card)?.classObserver.disconnect();
      mounted.delete(card); states.delete(card);
    }
  });
  reduced.addEventListener('change',resyncAll);
  finePointer.addEventListener('change',resyncAll);
  window.TTDrinkCard = {markup,mount,sync};
})();
