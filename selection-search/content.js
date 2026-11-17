'use strict';

// 单键快捷键：Chrome 的 commands API 只接受 Ctrl/Alt/Cmd 组合键，
// 所以 H / G / B 只能由内容脚本监听页面按键来实现。
(() => {
  const PANEL_CSS = `
    * { box-sizing: border-box; }
    .qs-panel {
      width: 340px;
      max-width: calc(100vw - 24px);
      padding: 12px;
      border-radius: 12px;
      background: #ffffff;
      color: #1f2328;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
      font: 13px/1.5 system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
      text-align: left;
      animation: qs-pop 120ms ease-out;
    }
    @keyframes qs-pop {
      from { opacity: 0; transform: translateY(-3px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .qs-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .qs-title { font-size: 13px; font-weight: 600; }
    .qs-esc { font-size: 11px; color: #8b949e; }
    .qs-text {
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(127, 127, 127, 0.08);
      color: #57606a;
      font-size: 13px;
      line-height: 1.5;
      max-height: 4.5em;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow-wrap: anywhere;
    }
    .qs-actions { display: flex; gap: 8px; margin-top: 12px; }
    .qs-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 34px;
      padding: 0 10px;
      border-radius: 8px;
      border: 1px solid rgba(127, 127, 127, 0.28);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .qs-btn:hover { background: rgba(127, 127, 127, 0.1); }
    .qs-btn:active { background: rgba(127, 127, 127, 0.16); }
    .qs-btn:focus-visible { outline: 2px solid #4f8cff; outline-offset: 2px; }
    .qs-btn:disabled { opacity: 0.45; cursor: default; background: transparent; }
    .qs-empty { font-style: normal; }
    .qs-kbd {
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(127, 127, 127, 0.16);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
      text-align: center;
    }
    @media (prefers-color-scheme: dark) {
      .qs-panel { background: #26292e; color: #e6edf3; border-color: rgba(255, 255, 255, 0.1); }
      .qs-text { color: #a9b1ba; background: rgba(255, 255, 255, 0.06); }
      .qs-btn { border-color: rgba(255, 255, 255, 0.18); }
      .qs-btn:hover { background: rgba(255, 255, 255, 0.08); }
      .qs-btn:active { background: rgba(255, 255, 255, 0.12); }
      .qs-kbd { background: rgba(255, 255, 255, 0.14); }
    }
  `;

  // 面板打开时：{ host, text }；关闭时为 null。
  let panel = null;

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

  function selectionRect() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    try {
      return sel.getRangeAt(0).getBoundingClientRect();
    } catch (_) {
      return null;
    }
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

  function onDocPointerDown(e) {
    if (!panel) return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.includes(panel.host)) return;
    closePanel();
  }

  function closePanel() {
    if (!panel) return;
    window.removeEventListener('pointerdown', onDocPointerDown, true);
    panel.host.remove();
    panel = null;
  }

  function makeButton(engine, kbdText, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qs-btn';

    const kbd = document.createElement('kbd');
    kbd.className = 'qs-kbd';
    kbd.textContent = kbdText;

    const span = document.createElement('span');
    span.textContent = label;

    btn.append(kbd, span);
    btn.addEventListener('click', () => {
      const text = panel && panel.text;
      if (!text) return;
      closePanel();
      sendSearch(engine, text);
    });
    return btn;
  }

  function openPanel(text, rect) {
    closePanel();

    const host = document.createElement('div');
    host.setAttribute('data-qs-panel', '');
    host.style.cssText =
      'position:fixed;left:-9999px;top:0;z-index:2147483647;visibility:hidden;';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = PANEL_CSS;

    const card = document.createElement('div');
    card.className = 'qs-panel';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', '划词搜索');

    const head = document.createElement('div');
    head.className = 'qs-head';

    const title = document.createElement('div');
    title.className = 'qs-title';
    title.textContent = '划词搜索';

    const esc = document.createElement('div');
    esc.className = 'qs-esc';
    esc.textContent = 'Esc 关闭';

    head.append(title, esc);

    const hasText = !!text;

    const textEl = document.createElement('div');
    textEl.className = 'qs-text' + (hasText ? '' : ' qs-empty');
    textEl.textContent = hasText ? text : '未选中文字：请先在页面上选中要搜索的内容';

    const actions = document.createElement('div');
    actions.className = 'qs-actions';
    const googleBtn = makeButton('google', 'G', 'Google');
    const baiduBtn = makeButton('baidu', 'B', '百度');
    if (!hasText) {
      googleBtn.disabled = true;
      baiduBtn.disabled = true;
    }
    actions.append(googleBtn, baiduBtn);

    card.append(head, textEl, actions);
    shadow.append(style, card);

    (document.body || document.documentElement).appendChild(host);

    // 先隐藏测量尺寸，再定位到选区下方（放不下就放到上方）。
    const size = host.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    let left;
    let top;
    const anchored = rect && (rect.width > 0 || rect.height > 0);

    if (anchored) {
      left = rect.left + rect.width / 2 - size.width / 2;
      top = rect.bottom + margin;
      if (top + size.height > vh - margin) {
        const above = rect.top - margin - size.height;
        top = above >= margin ? above : Math.max(margin, vh - size.height - margin);
      }
    } else {
      left = (vw - size.width) / 2;
      top = (vh - size.height) / 2;
    }
    left = Math.min(Math.max(margin, left), Math.max(margin, vw - size.width - margin));

    host.style.left = Math.round(left) + 'px';
    host.style.top = Math.round(top) + 'px';
    host.style.visibility = 'visible';

    panel = { host, text };
    window.addEventListener('pointerdown', onDocPointerDown, true);
  }

  function onKeyDown(e) {
    if (e.repeat || e.isComposing) return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

    const key = e.key.toLowerCase();

    // 面板打开时：G / B 选择引擎，H 或 Esc 关闭。
    if (panel) {
      if (isTextEditable(e.target) || isTextEditable(document.activeElement)) {
        closePanel();
        return;
      }
      if (key === 'escape' || key === 'h') {
        consume(e);
        closePanel();
        return;
      }
      const engine = key === 'g' ? 'google' : key === 'b' ? 'baidu' : null;
      if (!engine) return;

      // 面板里没文字时，允许用当前新选中的文字。
      const text = panel.text || selectedText();
      if (!text) return;

      consume(e);
      closePanel();
      sendSearch(engine, text);
      return;
    }

    if (key !== 'h' && key !== 'g' && key !== 'b') return;

    // 在输入框 / 可编辑区域里按这些键是正常打字，不拦截。
    if (isTextEditable(e.target) || isTextEditable(document.activeElement)) return;

    const text = selectedText();

    if (key === 'h') {
      // H 任何时候都呼出面板；没有选中文字时面板里给出提示。
      consume(e);
      openPanel(text, text ? selectionRect() : null);
      return;
    }

    // 直接按 G / B 需要选中文字，避免抢走网页本身的单键快捷键。
    if (!text) return;
    consume(e);
    sendSearch(key === 'g' ? 'google' : 'baidu', text);
  }

  window.addEventListener('keydown', onKeyDown, true);
})();
