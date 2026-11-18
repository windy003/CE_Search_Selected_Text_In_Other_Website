'use strict';

const buildUrl = {
  google: (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q),
  baidu: (q) => 'https://www.baidu.com/s?wd=' + encodeURIComponent(q),
};

function normalize(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function openSearch(engine, query, sourceTab) {
  const build = buildUrl[engine];
  if (!build || !query) return;

  const props = { url: build(query), active: true };
  if (sourceTab && sourceTab.id != null && sourceTab.id !== chrome.tabs.TAB_ID_NONE) {
    props.openerTabId = sourceTab.id;
  }
  chrome.tabs.create(props);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'quick-search') return;
  openSearch(msg.engine, normalize(msg.text), sender.tab);
});
