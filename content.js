// Content script for Roposo marketplace product analyzer
console.log('Roposo Product Analyzer loaded');

class RoposoProductAnalyzer {
    constructor() {
        this.excellentProducts = [];
        this.processedProducts = new Set();
        this.observer = null;
        this.autoScrollEnabled = false;
        this.scrollTimeout = null;
        this.isScrolling = false;
    }

    // Initialize the analyzer
    init() {
        this.injectStyles();
        this.loadExistingProducts();
        this.scanExistingProducts();
        this.setupMutationObserver();

        console.log('Roposo analyzer initialized');
    }

    // Inject CSS styles for highlighting
    injectStyles() {
        if (document.getElementById('roposo-analyzer-styles')) return;

        const style = document.createElement('style');
        style.id = 'roposo-analyzer-styles';
        style.textContent = `
      .roposo-excellent-product {
        border: 3px solid #dc3545 !important;
        background-color: rgba(220, 53, 69, 0.1) !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        transition: all 0.3s ease !important;
        position: relative !important;
      }
      
      .roposo-excellent-product::before {
        content: "⭐ EXCELLENT/GOOD DELIVERY";
        position: absolute;
        top: -8px;
        left: 8px;
        background: #dc3545;
        color: white;
        padding: 2px 8px;
        font-size: 10px;
        font-weight: bold;
        border-radius: 4px;
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .roposo-excellent-product:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 16px rgba(220, 53, 69, 0.4) !important;
      }
    `;
        document.head.appendChild(style);
    }

    // Load existing products from localStorage
    loadExistingProducts() {
        try {
            const stored = localStorage.getItem('excellentProducts');
            this.excellentProducts = stored ? JSON.parse(stored) : [];
            console.log('Loaded existing products:', this.excellentProducts.length);
        } catch (error) {
            console.error('Error loading existing products:', error);
            this.excellentProducts = [];
        }
    }

    // Save products to localStorage
    saveProducts() {
        try {
            localStorage.setItem('excellentProducts', JSON.stringify(this.excellentProducts));
            console.log('Saved products to localStorage:', this.excellentProducts.length);
        } catch (error) {
            console.error('Error saving products:', error);
        }
    }

    // Scan existing products on page load
    scanExistingProducts() {
        const productContainers = document.querySelectorAll('[id^="category-page-product-item-"]');
        console.log(`Found ${productContainers.length} product containers to scan`);

        productContainers.forEach(container => {
            this.analyzeProduct(container);
        });

        this.updateBadge();
    }

    // Setup MutationObserver for infinite scroll
    setupMutationObserver() {
        this.observer = new MutationObserver((mutations) => {
            let newProductsFound = false;

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the added node is a product container
                        if (node.id && node.id.startsWith('category-page-product-item-')) {
                            this.analyzeProduct(node);
                            newProductsFound = true;
                        }

                        // Check for product containers within the added node
                        const productContainers = node.querySelectorAll ?
                            node.querySelectorAll('[id^="category-page-product-item-"]') : [];

                        productContainers.forEach(container => {
                            this.analyzeProduct(container);
                            newProductsFound = true;
                        });
                    }
                });
            });

            if (newProductsFound) {
                console.log('New products detected and analyzed');
                this.updateBadge();
            }
        });

        // Start observing
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('MutationObserver setup complete');
    }

    // Analyze a single product container
    analyzeProduct(container) {
        if (!container || !container.id) return;

        // Skip if already processed
        if (this.processedProducts.has(container.id)) return;

        try {
            // Find the rating element
            const ratingElement = container.querySelector('p.text-\\[9px\\].leading-\\[10px\\].text-theme_1_grey2.font-semibold') ||
                container.querySelector('p[class*="text-[9px]"][class*="leading-[10px]"]') ||
                container.querySelector('p[class*="text-theme_1_grey2"][class*="font-semibold"]');

            if (!ratingElement) {
                console.log(`No rating element found for ${container.id}`);
                this.processedProducts.add(container.id);
                return;
            }

            const ratingText = ratingElement.textContent.trim().toLowerCase();
            console.log(`Product ${container.id} rating: "${ratingText}"`);

            // Check if rating is excellent or good
            if (ratingText === "excellent" || ratingText === "good") {
                // Find product name
                const nameElement = container.querySelector('.text-overflow') ||
                    container.querySelector('[class*="text-overflow"]');

                const productName = nameElement ? nameElement.textContent.trim() : `Product ${container.id}`;

                // Create product object
                const product = {
                    id: container.id,
                    name: productName,
                    rating: ratingText,
                    timestamp: Date.now(),
                    url: window.location.href
                };

                // Check if product already exists in our list
                const existingIndex = this.excellentProducts.findIndex(p => p.id === container.id);

                if (existingIndex === -1) {
                    // Add new product
                    this.excellentProducts.push(product);
                    console.log('Added excellent/good product:', product);
                } else {
                    // Update existing product
                    this.excellentProducts[existingIndex] = product;
                    console.log('Updated existing product:', product);
                }

                // Highlight the product
                this.highlightProduct(container);

                // Save to localStorage
                this.saveProducts();

                // Send update to background script for badge
                chrome.runtime.sendMessage({
                    action: 'updateBadge',
                    count: this.excellentProducts.length
                });
            }

            // Mark as processed
            this.processedProducts.add(container.id);

        } catch (error) {
            console.error(`Error analyzing product ${container.id}:`, error);
            this.processedProducts.add(container.id);
        }
    }

    // Highlight a product container
    highlightProduct(container) {
        if (!container.classList.contains('roposo-excellent-product')) {
            container.classList.add('roposo-excellent-product');

            // Add a subtle animation
            container.style.animation = 'roposoHighlight 0.6s ease-in-out';

            // Create animation keyframes if not exists
            if (!document.getElementById('roposo-animation-styles')) {
                const animationStyle = document.createElement('style');
                animationStyle.id = 'roposo-animation-styles';
                animationStyle.textContent = `
          @keyframes roposoHighlight {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
          }
        `;
                document.head.appendChild(animationStyle);
            }
        }
    }

    // Auto-scroll functionality
    startAutoScroll() {
        if (this.isScrolling) return;

        this.autoScrollEnabled = true;
        this.isScrolling = true;
        console.log('Starting auto-scroll...');

        this.autoScroll();
    }

    stopAutoScroll() {
        this.autoScrollEnabled = false;
        this.isScrolling = false;
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        console.log('Auto-scroll stopped');
    }

    autoScroll() {
        if (!this.autoScrollEnabled) {
            this.isScrolling = false;
            return;
        }

        const currentScrollY = window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;

        // Check if we're near the bottom
        if (currentScrollY + windowHeight >= documentHeight - 1000) {
            // Scroll down more
            window.scrollBy(0, 500);
            console.log('Auto-scrolling to load more products...');
        } else {
            // Scroll down gradually
            window.scrollBy(0, 300);
        }

        // Continue scrolling after a delay
        this.scrollTimeout = setTimeout(() => {
            this.autoScroll();
        }, 2000); // 2 second delay between scrolls
    }

    // Update extension badge
    updateBadge() {
        chrome.runtime.sendMessage({
            action: 'updateBadge',
            count: this.excellentProducts.length
        });
    }

    // Get current excellent products
    getExcellentProducts() {
        return this.excellentProducts;
    }

    // Clear all data
    clearAllData() {
        this.excellentProducts = [];
        this.processedProducts.clear();
        localStorage.removeItem('excellentProducts');

        // Remove highlights
        document.querySelectorAll('.roposo-excellent-product').forEach(el => {
            el.classList.remove('roposo-excellent-product');
        });

        this.updateBadge();
        console.log('All data cleared');
    }

    // Re-scan all products (useful for testing)
    rescanAllProducts() {
        this.processedProducts.clear();
        this.scanExistingProducts();
        console.log('Rescanned all products');
    }
}

// Initialize analyzer
const analyzer = new RoposoProductAnalyzer();

// Wait for page to load before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => analyzer.init(), 1000);
    });
} else {
    setTimeout(() => analyzer.init(), 1000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getExcellentProducts':
            sendResponse({
                products: analyzer.getExcellentProducts(),
                count: analyzer.getExcellentProducts().length
            });
            break;

        case 'startAutoScroll':
            analyzer.startAutoScroll();
            sendResponse({ status: 'Auto-scroll started' });
            break;

        case 'stopAutoScroll':
            analyzer.stopAutoScroll();
            sendResponse({ status: 'Auto-scroll stopped' });
            break;

        case 'rescanProducts':
            analyzer.rescanAllProducts();
            sendResponse({
                status: 'Rescan completed',
                count: analyzer.getExcellentProducts().length
            });
            break;

        case 'clearData':
            analyzer.clearAllData();
            sendResponse({ status: 'Data cleared' });
            break;

        case 'getStatus':
            sendResponse({
                productsFound: analyzer.getExcellentProducts().length,
                autoScrolling: analyzer.autoScrollEnabled,
                processedCount: analyzer.processedProducts.size
            });
            break;

        default:
            sendResponse({ error: 'Unknown action' });
    }

    return true; // Keep message channel open for async response
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible, rescan for new products
        setTimeout(() => {
            analyzer.rescanAllProducts();
        }, 500);
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    analyzer.stopAutoScroll();
});