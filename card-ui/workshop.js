/* 純介面更新，不改動角色資料或闆卡儲存流程。 */
(function () {
  'use strict';
  const name = document.getElementById('fName');
  const preview = document.getElementById('previewName');
  name.addEventListener('input', () => { preview.textContent = name.value.trim() || '初次見面的你'; });
  function updateSelection() {
    const active = document.querySelector('#opts .opt.on');
    document.getElementById('partName').textContent = active ? active.getAttribute('aria-label') : '選擇部件';
    document.getElementById('tagCount').textContent = document.querySelectorAll('#tagBox .on').length + ' / 5';
  }
  const observer = new MutationObserver(updateSelection);
  observer.observe(document.getElementById('opts'), { childList: true });
  observer.observe(document.getElementById('tagBox'), { childList: true });
  updateSelection();
  // 入店邀請可用鍵盤操作；關閉後回到工房標題。
  const notice = document.getElementById('notice');
  const start = document.getElementById('welcomeStart');
  start.focus({ preventScroll: true });
  notice.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); start.focus(); }
    if (event.key === 'Escape') start.click();
  });
})();
