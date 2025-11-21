// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scan-card",
    title: "Scan Pokemon Card Price",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scan-card") {
    chrome.tabs.sendMessage(tab.id, {
      action: "contextMenuScan",
      src: info.srcUrl
    });
  }
});
