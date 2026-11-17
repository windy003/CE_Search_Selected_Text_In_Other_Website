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

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'quick-search-google',
      title: 'Google 搜索 (G)',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'quick-search-baidu',
      title: '百度搜索 (B)',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(buildMenus);
chrome.runtime.onStartup.addListener(buildMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const query = normalize(info.selectionText);
  if (!query) return;

  if (info.menuItemId === 'quick-search-google') openSearch('google', query, tab);
  else if (info.menuItemId === 'quick-search-baidu') openSearch('baidu', query, tab);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'quick-search') return;
  openSearch(msg.engine, normalize(msg.text), sender.tab);
});
