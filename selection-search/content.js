'use strict';

// 单键快捷键：Chrome 的 commands API 只接受 Ctrl/Alt/Cmd 组合键，
// 所以 G / B 只能由内容脚本监听页面按键来实现。
(() => {
  function isTextEditable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function selectedText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return '';
    return sel.toString().replace(/\s+/g, ' ').trim();
  }

  function sendSearch(engine, text) {
    try {
      const p = chrome.runtime.sendMessage({ type: 'quick-search', engine, text });
      // 扩展被重新加载后，旧页面里的上下文会失效，忽略即可。
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {
      /* context invalidated */
    }
  }

  function consume(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onKeyDown(e) {
    if (e.repeat || e.isComposing) return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

    const key = e.key.toLowerCase();
    if (key !== 'g' && key !== 'b') return;

    // 在输入框 / 可编辑区域里按这些键是正常打字，不拦截。
    if (isTextEditable(e.target) || isTextEditable(document.activeElement)) return;

    // 需要选中文字，避免抢走网页本身的单键快捷键。
    const text = selectedText();
    if (!text) return;

    consume(e);
    sendSearch(key === 'g' ? 'google' : 'baidu', text);
  }

  window.addEventListener('keydown', onKeyDown, true);
})();
