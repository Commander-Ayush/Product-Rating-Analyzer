// Background script for Roposo Product Analyzer
console.log('Roposo Product Analyzer background script loaded');

// Update badge when products are found
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateBadge') {
        const count = request.count || 0;

        // Update badge text
        chrome.action.setBadgeText({
            text: count > 0 ? count.toString() : '',
            tabId: sender.tab?.id
        });

        // Update badge color based on count
        chrome.action.setBadgeBackgroundColor({
            color: count > 0 ? '#dc3545' : '#6c757d',
            tabId: sender.tab?.id
        });

        console.log(`Badge updated: ${count} products found`);
    }
});

// Clear badge when tab is updated (navigating away from Roposo)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.includes('app.roposoclout.com/marketplace')) {
            chrome.action.setBadgeText({
                text: '',
                tabId: tabId
            });
        }
    }
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Roposo Product Analyzer installed');

    // Set default badge color
    chrome.action.setBadgeBackgroundColor({
        color: '#dc3545'
    });
});