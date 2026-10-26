/* TT 分享用角色快照。只在明確呼叫時出圖，不上傳、不發訊息、不寫入帳號。 */
(() => {
  'use strict';
  const fail = code => Object.assign(new Error({
    CHARACTER_REQUIRED: '請先登入並建立酒館角色。',
    CHARACTER_CHANGED: '帳號或穿搭已變更，請重新預覽。',
    CHARACTER_ASSET_FAILED: '角色素材未能完整載入，請稍後再試。',
    CHARACTER_ASSET_TIMEOUT: '角色素材載入逾時，請稍後再試。',
    CHARACTER_EMPTY: '角色圖片尚未準備好。',
    CHARACTER_EXPORT_FAILED: '角色圖片無法匯出，請稍後再試。'
  }[code] || code), {code});

  function identity() {
    const a = typeof me === 'function' ? me() : null;
    if (!a?.b?.doll || !myKey) throw fail('CHARACTER_REQUIRED');
    return {key: myKey, uid: window.TTVoiceOrders?.userId?.() || null,
      appearance: JSON.stringify(a.b.doll)};
  }

  function waitForImages(images, timeoutMs) {
    return new Promise((resolve, reject) => {
      const cleanup = [];
      let finished = false;
      const finish = error => {
        if (finished) return;
        finished = true;
        cleanup.forEach(fn => fn());
        error ? reject(error) : resolve();
      };
      const check = () => {
        if (images.some(im => im.complete && !im.naturalWidth)) return finish(fail('CHARACTER_ASSET_FAILED'));
        if (images.every(im => im.complete && im.naturalWidth)) finish();
      };
      for (const im of images) {
        const error = () => finish(fail('CHARACTER_ASSET_FAILED'));
        im.addEventListener('load', check);
        im.addEventListener('error', error);
        cleanup.push(() => { im.removeEventListener('load', check); im.removeEventListener('error', error); });
      }
      const timer = setTimeout(() => finish(fail('CHARACTER_ASSET_TIMEOUT')), timeoutMs);
      cleanup.push(() => clearTimeout(timer));
      check();
    });
  }

  async function exportCurrent({scale = 4} = {}) {
    if (!Number.isInteger(scale) || scale < 1 || scale > 8) throw new RangeError('scale must be an integer from 1 to 8');
    const before = identity(), doll = {...JSON.parse(before.appearance), _blink: false};
    const assertCurrent = () => {
      let after;
      try { after = identity(); } catch { throw fail('CHARACTER_CHANGED'); }
      if (after.key !== before.key || after.uid !== before.uid || after.appearance !== before.appearance) throw fail('CHARACTER_CHANGED');
    };
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const deadline = performance.now() + 10000;
    // Track only images actually requested by this render. Unrelated broken shop
    // thumbnails must not block exports. Restore synchronously before any await.
    const draw = () => {
      const images = new Set(), nativeImage = tpImg, customImage = csImg;
      tpImg = (...args) => { const im = nativeImage(...args); images.add(im); return im; };
      csImg = (...args) => { const im = customImage(...args); images.add(im); return im; };
      try { drawDollTo(canvas, doll, 'idle'); }
      finally { tpImg = nativeImage; csImg = customImage; }
      return [...images];
    };
    try {
      // A second pass uses the loaded art, including dye/highlight caches.
      for (;;) {
        assertCurrent();
        const images = draw();
        if (images.every(im => im.complete && im.naturalWidth)) break;
        const remaining = deadline - performance.now();
        if (remaining <= 0) throw fail('CHARACTER_ASSET_TIMEOUT');
        await waitForImages(images, remaining);
      }
      const pixels = canvas.getContext('2d').getImageData(0, 0, 64, 64).data;
      if (!pixels.some((v, i) => i % 4 === 3 && v)) throw fail('CHARACTER_EMPTY');
      const output = document.createElement('canvas');
      output.width = output.height = 64 * scale;
      const ctx = output.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, output.width, output.height);
      const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
      if (!blob) throw fail('CHARACTER_EXPORT_FAILED');
      assertCurrent();
      return blob;
    } catch (error) {
      if (error.code?.startsWith?.('CHARACTER_')) throw error;
      throw fail('CHARACTER_EXPORT_FAILED');
    }
  }
  // This is a local preview/export, never proof of identity or outfit ownership.
  window.TTCharacterSnapshot = Object.freeze({exportCurrent});
  if (window.TinyTavernUI) window.TinyTavernUI.exportCharacterPng = exportCurrent;
})();
