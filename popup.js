// Popup script for Roposo Product Analyzer
document.addEventListener('DOMContentLoaded', function () {
    // Get UI elements
    const rescanBtn = document.getElementById('rescan-btn');
    const autoScrollBtn = document.getElementById('auto-scroll-btn');
    const exportBtn = document.getElementById('export-btn');
    const clearBtn = document.getElementById('clear-btn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const productsList = document.getElementById('products-list');
    const emptyState = document.getElementById('empty-state');
    const productCount = document.getElementById('product-count');
    const processedCount = document.getElementById('processed-count');
    const autoScrollStatus = document.getElementById('auto-scroll-status');
    const lastUpdate = document.getElementById('last-update');

    let isAutoScrolling = false;

    // Initialize popup
    init();

    // Event listeners
    rescanBtn.addEventListener('click', rescanProducts);
    autoScrollBtn.addEventListener('click', toggleAutoScroll);
    exportBtn.addEventListener('click', exportProducts);
    clearBtn.addEventListener('click', clearAllData);

    // Initialize popup data
    function init() {
        checkCurrentPage();
        loadProductData();
        getStatus();
    }

    // Check if we're on the correct page
    function checkCurrentPage() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];

            if (!currentTab.url.includes('app.roposoclout.com/marketplace')) {
                showError('This extension works on Roposo marketplace pages only.');
                disableControls();
                return;
            }

            enableControls();
        });
    }

    // Enable/disable controls
    function enableControls() {
        rescanBtn.disabled = false;
        autoScrollBtn.disabled = false;
        exportBtn.disabled = false;
        clearBtn.disabled = false;
    }

    function disableControls() {
        rescanBtn.disabled = true;
        autoScrollBtn.disabled = true;
        exportBtn.disabled = true;
        clearBtn.disabled = true;
    }

    // Load product data from content script
    function loadProductData() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getExcellentProducts' }, function (response) {
                if (chrome.runtime.lastError) {
                    console.log('Content script not ready, trying localStorage...');
                    loadFromLocalStorage();
                    return;
                }

                if (response && response.products) {
                    displayProducts(response.products);
                    updateStats(response.count, response.processedCount || 0);
                } else {
                    loadFromLocalStorage();
                }
            });
        });
    }

    // Load from localStorage as fallback
    function loadFromLocalStorage() {
        chrome.storage.local.get(['excellentProducts'], function (result) {
            const products = result.excellentProducts || [];
            displayProducts(products);
            updateStats(products.length, 0);
        });
    }

    // Get current status from content script
    function getStatus() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, function (response) {
                if (response) {
                    updateStats(response.productsFound || 0, response.processedCount || 0);
                    updateAutoScrollStatus(response.autoScrolling || false);
                }
            });
        });
    }

    // Display products in the list
    function displayProducts(products) {
        if (!products || products.length === 0) {
            productsList.innerHTML = '';
            productsList.appendChild(emptyState);
            emptyState.style.display = 'block';
            return;
        }

        // Hide empty state
        emptyState.style.display = 'none';

        // Sort products by timestamp (newest first)
        products.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        productsList.innerHTML = products.map((product, index) => `
      <div class="product-item" data-product-id="${product.id}">
        <div class="product-header">
          <div class="product-name" title="${product.name}">${product.name}</div>
          <div class="product-rating ${product.rating}">${product.rating.toUpperCase()}</div>
        </div>
        <div class="product-meta">
          <small class="product-id">ID: ${product.id}</small>
          <small class="product-time">${formatTime(product.timestamp)}</small>
        </div>
      </div>
    `).join('');

        updateLastUpdate();
    }

    // Format timestamp
    function formatTime(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    // Update statistics
    function updateStats(foundCount, scannedCount) {
        productCount.textContent = foundCount;
        processedCount.textContent = scannedCount;
    }

    // Update auto-scroll status
    function updateAutoScrollStatus(scrolling) {
        isAutoScrolling = scrolling;
        autoScrollStatus.textContent = `Auto-scroll: ${scrolling ? 'ON' : 'OFF'}`;
        autoScrollBtn.textContent = scrolling ? '⏹️ Stop Scroll' : '📜 Auto Scroll';
        autoScrollBtn.className = scrolling ? 'btn warning' : 'btn secondary';
    }

    // Update last update time
    function updateLastUpdate() {
        const now = new Date();
        lastUpdate.textContent = `Last scan: ${now.toLocaleTimeString()}`;
    }

    // Rescan products
    function rescanProducts() {
        showLoading(true);
        hideError();

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'rescanProducts' }, function (response) {
                showLoading(false);

                if (chrome.runtime.lastError) {
                    showError('Please refresh the page and try again');
                    return;
                }

                if (response && response.status) {
                    loadProductData();
                    showSuccess(`Rescan completed! Found ${response.count} products.`);
                }
            });
        });
    }

    // Toggle auto-scroll
    function toggleAutoScroll() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const action = isAutoScrolling ? 'stopAutoScroll' : 'startAutoScroll';

            chrome.tabs.sendMessage(tabs[0].id, { action: action }, function (response) {
                if (chrome.runtime.lastError) {
                    showError('Unable to control auto-scroll. Please refresh the page.');
                    return;
                }

                if (response) {
                    updateAutoScrollStatus(!isAutoScrolling);
                    showSuccess(response.status);
                }
            });
        });
    }

    // Export products to clipboard
    function exportProducts() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getExcellentProducts' }, function (response) {
                if (response && response.products && response.products.length > 0) {
                    const csvContent = exportToCSV(response.products);
                    copyToClipboard(csvContent);
                    showSuccess('Products exported to clipboard as CSV!');
                } else {
                    showError('No products to export');
                }
            });
        });
    }

    // Export to CSV format
    function exportToCSV(products) {
        const headers = ['Product Name', 'Rating', 'Product ID', 'Found At'];
        const rows = products.map(product => [
            `"${product.name}"`,
            product.rating,
            product.id,
            new Date(product.timestamp).toLocaleString()
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    // Copy text to clipboard
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy to clipboard:', err);
        });
    }

    // Clear all data
    function clearAllData() {
        if (confirm('Are you sure you want to clear all found products?')) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'clearData' }, function (response) {
                    if (response) {
                        displayProducts([]);
                        updateStats(0, 0);
                        showSuccess('All data cleared successfully!');
                    }
                });
            });
        }
    }

    // Show loading state
    function showLoading(show) {
        loading.classList.toggle('hidden', !show);
        rescanBtn.disabled = show;
    }

    // Show error message
    function showError(message) {
        error.classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
    }

    // Hide error message
    function hideError() {
        error.classList.add('hidden');
    }

    // Show success message
    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.innerHTML = `<p>✅ ${message}</p>`;

        const container = document.querySelector('.content');
        container.insertBefore(successDiv, container.firstChild);

        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
});