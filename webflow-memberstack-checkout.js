// Unified Shipping Calculator and Checkout for Webflow + Stripe
// Unified Shipping Calculator and Checkout for Webflow + Stripe

// Configuration
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { 
        price: 7.28, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QScMXJRMXFic4sWih6q9v36': { 
        price: 20.72, 
        label: 'Great Britain', 
        countries: ['GB']
    },
    'shr_1QScNqJRMXFic4sW3NVUUckl': { 
        price: 36.53, 
        label: 'Singapore', 
        countries: ['SG']
    },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
        price: 20.36, 
        label: 'European Union', 
        countries: [
            'BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'GR', 'ES', 'FR', 
            'HR', 'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 
            'PT', 'RO', 'SK', 'SI', 'FI', 'SE'
        ]
    }
};

const PRODUCT_CONFIG = {
    course: {
        id: 'prc_online-kochkurs-8b540kc2',
        type: 'digital',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        memberstackPlanId: MEMBERSTACK_LIFETIME_PLAN_ID  // Global variable set in HTML
    },
    book: {
        id: 'prc_cookbook_physical',
        type: 'physical',
        requiresShipping: true,
        weight: 1005,
        packagingWeight: 152,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        memberstackPlanId: MEMBERSTACK_FREE_PLAN_ID,  // Global variable set in HTML
        dimensions: {
            length: 25,
            width: 20,
            height: 2
        },
        shippingClass: 'standard'
    },
    bundle: {
        id: 'prc_bundle',
        type: 'bundle',
        requiresShipping: true,
        weight: 1005,  // Same as book
        packagingWeight: 152,  // Same as book
        products: ['course', 'book'],
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        memberstackPlanId: MEMBERSTACK_LIFETIME_PLAN_ID,  // Global variable set in HTML
        dimensions: {  // Same as book
            length: 25,
            width: 20,
            height: 2
        },
        shippingClass: 'standard'
    },
    free: {
        id: 'prc_free',
        type: 'digital',
        prices: {
            de: 'price_free',
            en: 'price_free',
            fr: 'price_free',
            it: 'price_free'
        },
        memberstackPlanId: MEMBERSTACK_FREE_PLAN_ID  // Global variable set in HTML
    }
};

const CONFIG = {
    functionsUrl: '/.netlify/functions',
    stripePublicKey: 'pk_test_51Q4ix1JRMXFic4sW5em3IMoFbubNwBdzj4F5tUzStHExi3T245BrPLYu0SG1uWLSrd736NDy0V4dx10ZN4WFJD2a00pAzHlDw8',
    defaultShippingRate: 'shr_1QScOlJRMXFic4sW8MHW0kq7', // EU shipping rate
    memberstackPlanId: MEMBERSTACK_LIFETIME_PLAN_ID,  // Global variable set in HTML
    defaultLanguage: 'de',
    defaultCountry: 'DE',
    allowedCountries: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'SG']
};

const getCountriesForShippingRate = (shippingRateId) => {
    return SHIPPING_RATES[shippingRateId]?.countries || [];
};

const getShippingRateForCountry = (country) => {
    for (const [rateId, rate] of Object.entries(SHIPPING_RATES)) {
        if (rate.countries.includes(country)) {
            return rateId;
        }
    }
    return null;
};

const EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// Debug flag
const DEBUG = true;

// Logging utility
function log(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

// Delay function for retries
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error; // Last attempt, throw the error
            if (error?.message?.includes('rate limit')) {
                const waitTime = baseDelay * Math.pow(2, i);
                console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${i + 1}/${maxRetries}`);
                await delay(waitTime);
                continue;
            }
            throw error; // Not a rate limit error, throw immediately
        }
    }
}

// Load script utility
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Initialize dependencies
async function initializeDependencies() {
    log('Initializing shopping system...');
    
    // Wait for Memberstack
    if (!window.$memberstackDom) {
        log('Waiting for Memberstack to initialize...');
        await new Promise(resolve => {
            const checkMemberstack = setInterval(() => {
                if (typeof window.$memberstackDom !== 'undefined') {
                    clearInterval(checkMemberstack);
                    log('Memberstack initialized');
                    resolve();
                }
            }, 100);
            
            // Fallback timeout after 5s
            setTimeout(() => {
                clearInterval(checkMemberstack);
                console.warn('Memberstack initialization timed out');
                resolve();
            }, 5000);
        });
    }
    
    // Initialize Stripe
    try {
        const stripe = Stripe(CONFIG.stripePublicKey);
        log('Stripe initialized with test key');
        return { stripe };
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        throw error;
    }
}

// Get shipping country from shipping rate ID
function getShippingCountry(shippingRateId) {
    const shipping = SHIPPING_RATES[shippingRateId];
    return shipping ? shipping.countries[0] : CONFIG.defaultCountry;
}

// Get shipping rate for country
function getShippingRateForCountry(country) {
    for (const [rateId, rate] of Object.entries(SHIPPING_RATES)) {
        if (rate.countries.includes(country)) {
            return { id: rateId, ...rate };
        }
    }
    return null;
}

// Get countries for shipping rate
function getCountriesForShippingRate(shippingRateId) {
    return SHIPPING_RATES[shippingRateId]?.countries || [];
}

// Calculate total weight for product
function calculateTotalWeight(productConfig) {
    if (!productConfig || !productConfig.weight) return 0;
    return productConfig.weight + (productConfig.packagingWeight || 0);
}

// Update price display with shipping
function updateTotalPrice(productType, shippingRateId = null) {
    const productEl = document.querySelector(`[data-product-type="${productType}"]`);
    if (!productEl) {
        console.warn(`Product element not found for type: ${productType}`);
        return;
    }

    const productConfig = PRODUCT_CONFIG[productType];
    if (!productConfig) {
        console.warn(`Product config not found for type: ${productType}`);
        return;
    }

    const basePrice = parseFloat(productEl.dataset.basePrice);
    if (isNaN(basePrice)) {
        console.warn(`Invalid base price for product type: ${productType}`);
        return;
    }
    
    // Only calculate shipping for physical products
    let shippingCost = 0;
    if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
        if (shippingRateId && SHIPPING_RATES[shippingRateId]) {
            shippingCost = SHIPPING_RATES[shippingRateId].price;
        }
    }
    
    const total = basePrice + shippingCost;
    
    // Update price displays
    const section = productEl.closest('.product-section');
    if (!section) {
        console.warn(`Product section not found for type: ${productType}`);
        return;
    }
    
    try {
        if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
            // Update subtotal
            const subtotalEl = section.querySelector(`#subtotal-price-${productType}`);
            if (subtotalEl) {
                subtotalEl.textContent = basePrice.toFixed(2);
            }
            
            // Update shipping
            const shippingEl = section.querySelector(`#shipping-price-${productType}`);
            if (shippingEl) {
                shippingEl.textContent = shippingCost.toFixed(2);
            }
            
            // Update total
            const totalEl = section.querySelector(`#total-price-${productType}`);
            if (totalEl) {
                totalEl.textContent = total.toFixed(2);
            }
        } else {
            // For digital products, just update the total
            const totalEl = section.querySelector(`#total-price-${productType}`);
            if (totalEl) {
                totalEl.textContent = total.toFixed(2);
            }
        }
        
        // Update checkout button
        const checkoutButton = section.querySelector('[data-checkout-button]');
        if (checkoutButton) {
            checkoutButton.textContent = `Proceed to Checkout (€${total.toFixed(2)})`;
        }
    } catch (error) {
        console.warn(`Error updating price display for ${productType}:`, error);
    }
}

// Start checkout process
async function startCheckout(shippingRateId = null, productType = null) {
    log('Starting checkout process', { shippingRateId, productType });
    
    if (!productType) {
        throw new Error('Product type is required');
    }
    
    const productConfig = PRODUCT_CONFIG[productType];
    if (!productConfig) {
        throw new Error(`Invalid product type: ${productType}`);
    }
    
    try {
        // Get current member
        const member = await window.$memberstackDom.getCurrentMember();
        if (!member?.data) {
            // Store current URL for redirect after registration
            const currentPath = window.location.pathname;
            const queryParams = window.location.search;
            
            // Store checkout configuration
            if (shippingRateId || productType) {
                localStorage.setItem('checkoutConfig', JSON.stringify({
                    productType: productType,
                    shippingRateId: shippingRateId
                }));
            }
            
            localStorage.setItem('checkoutRedirectUrl', currentPath + queryParams);
            
            // Special handling for membershome path
            if (currentPath.includes('/membershome')) {
                window.location.href = `/registrieren?returnUrl=${encodeURIComponent(currentPath + queryParams)}`;
                return;
            }
            
            window.location.href = '/registrieren';
            return;
        }

        // Get shipping rate for physical products
        if ((productConfig.type === 'physical' || productConfig.type === 'bundle') && !shippingRateId) {
            const shippingSelect = document.querySelector(`#shipping-rate-select-${productType}`);
            shippingRateId = shippingSelect?.value;
            if (!shippingRateId) {
                throw new Error('Please select a shipping option');
            }
        }

        // Get language-specific price
        const language = getPreferredLanguage();
        const priceId = productConfig.prices[language] || productConfig.prices[CONFIG.defaultLanguage];
        if (!priceId) {
            throw new Error(`No price found for language: ${language}`);
        }

        // Create checkout session
        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                priceId: priceId,
                customerEmail: member.data.auth.email,
                language: language,
                successUrl: window.location.origin + '/vielen-dank-email',
                cancelUrl: window.location.origin + '/produkte',
                metadata: {
                    memberstackUserId: member.data.id,
                    productType: productType,
                    type: productConfig.type,
                    language: language,
                    shippingRateId: shippingRateId || null
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Checkout session creation failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`Failed to create checkout session: ${response.status} ${response.statusText}`);
        }

        const session = await response.json();
        const stripe = await loadStripe(CONFIG.stripePublicKey);
        const { error } = await stripe.redirectToCheckout({
            sessionId: session.sessionId
        });

        if (error) {
            console.error('Stripe redirect failed:', error);
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        throw error;
    }
}

// Initialize shipping selections
function initializeShippingSelects() {
    const sections = document.querySelectorAll('.product-section');
    sections.forEach(section => {
        const productType = section.querySelector('[data-product-type]')?.dataset.productType;
        if (!productType) return;
        
        const productConfig = PRODUCT_CONFIG[productType];
        if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
            const shippingSelect = section.querySelector(`#shipping-rate-select-${productType}`);
            if (shippingSelect) {
                shippingSelect.addEventListener('change', (event) => {
                    updateTotalPrice(productType, event.target.value);
                });
                
                // Set initial price with default shipping
                updateTotalPrice(productType, shippingSelect.value);
            }
        }
    });
}

// Initialize checkout system
let systemInitialized = false;
let memberstackInitialized = false;

// Function to wait for Memberstack to be ready
function waitForMemberstack() {
    return new Promise((resolve) => {
        if (window.$memberstackDom) {
            memberstackInitialized = true;
            resolve();
            return;
        }

        // First try the memberstack.ready event
        document.addEventListener('memberstack.ready', () => {
            memberstackInitialized = true;
            resolve();
        });

        // Fallback: check periodically
        const checkInterval = setInterval(() => {
            if (window.$memberstackDom) {
                clearInterval(checkInterval);
                clearTimeout(timeout);
                memberstackInitialized = true;
                resolve();
            }
        }, 100);

        // Set a timeout to avoid hanging
        const timeout = setTimeout(() => {
            clearInterval(checkInterval);
            console.warn('Memberstack initialization timed out, falling back to localStorage');
            resolve();
        }, 5000);
    });
}

async function initializeCheckoutButtons() {
    const buttons = document.querySelectorAll('[data-checkout-button]');
    log(`Found ${buttons.length} checkout buttons`);
    
    // Remove all existing buttons first
    buttons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });
    
    // Now add event listeners to the new buttons
    document.querySelectorAll('[data-checkout-button]').forEach(button => {
        const productType = button.dataset.productType;
        log(`Setting up button for product type: ${productType}`);
        
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            // Get the actual clicked button
            const clickedButton = event.currentTarget;
            const clickedProductType = clickedButton.dataset.productType;
            log(`Checkout clicked for product type: ${clickedProductType}`);
            
            const productConfig = PRODUCT_CONFIG[clickedProductType];
            if (!productConfig) {
                console.error(`Invalid product type: ${clickedProductType}`);
                return;
            }
            
            try {
                // Disable button during checkout
                clickedButton.disabled = true;
                const originalText = clickedButton.textContent;
                clickedButton.textContent = 'Processing...';
                
                // Get shipping rate if needed
                let shippingRateId = null;
                if (productConfig.requiresShipping) {
                    const shippingSelect = clickedButton.closest('.product-section').querySelector(`#shipping-rate-select-${clickedProductType}`);
                    shippingRateId = shippingSelect?.value;
                    if (!shippingRateId) {
                        throw new Error('Please select a shipping option');
                    }
                }
                
                // Start checkout process
                await startCheckout(shippingRateId, clickedProductType);
            } catch (error) {
                console.error('Checkout error:', error);
                alert(error.message || 'An error occurred during checkout. Please try again.');
            } finally {
                // Re-enable button
                clickedButton.disabled = false;
                clickedButton.textContent = originalText;
            }
        });
    });
    log('Checkout buttons initialized');
}

async function initializeCheckoutSystem() {
    if (systemInitialized) {
        log('Checkout system already initialized');
        return;
    }
    log('Initializing checkout system...');

    try {
        // Wait for Memberstack
        await waitForMemberstack();
        log('Memberstack initialization complete');
        
        // Initialize Stripe
        try {
            const stripe = Stripe(CONFIG.stripePublicKey);
            log('Stripe initialized with test key');
        } catch (error) {
            console.error('Error initializing Stripe:', error);
            throw error;
        }

        // Initialize shipping selects
        const sections = document.querySelectorAll('.product-section');
        sections.forEach(section => {
            const productType = section.querySelector('[data-product-type]')?.dataset.productType;
            if (!productType) return;
            
            const productConfig = PRODUCT_CONFIG[productType];
            if (productConfig?.requiresShipping) {
                const shippingSelect = section.querySelector(`#shipping-rate-select-${productType}`);
                if (shippingSelect) {
                    shippingSelect.addEventListener('change', (event) => {
                        updateTotalPrice(productType, event.target.value);
                    });
                    
                    // Set initial price with default shipping
                    updateTotalPrice(productType, shippingSelect.value);
                }
            }
        });
        log('Shipping selects initialized');

        // Initialize checkout buttons
        await initializeCheckoutButtons();
        
        log('Checkout system initialized successfully');
        systemInitialized = true;
    } catch (error) {
        console.error('Failed to initialize checkout system:', error);
        throw error;
    }
}

// Initialize all components
document.addEventListener('DOMContentLoaded', () => {
    initializeCheckoutSystem().catch(error => {
        console.error('Failed to initialize checkout:', error);
    });
});

// Remove redundant initialization functions
const initializeCheckoutButton = () => {}; // Keep for backward compatibility but do nothing
const initializeCheckoutButtons = () => {}; // Keep for backward compatibility but do nothing

// Function to get user's preferred language
function getPreferredLanguage() {
    // Use the global language detection from $lbh
    const language = $lbh.language();
    
    // Get the product type
    const productElement = document.querySelector('[data-product-type]');
    const productType = productElement?.dataset.productType || 'book';
    const productConfig = PRODUCT_CONFIG[productType];
    
    // Ensure we have a valid Stripe price for this language
    if (productConfig?.prices[language]) {
        return language;
    }
    
    // If no Stripe price found for the language, fall back to default
    console.warn(`No Stripe price found for language: ${language}, falling back to ${CONFIG.defaultLanguage}`);
    return CONFIG.defaultLanguage;
}

// Load Stripe.js
function loadStripe() {
    return new Promise((resolve, reject) => {
        try {
            const stripePublicKey = 'pk_test_51Q4ix1JRMXFic4sW5em3IMoFbubNwBdzj4F5tUzStHExi3T245BrPLYu0SG1uWLSrd736NDy0V4dx10ZN4WFJD2a00pAzHlDw8';
            
            if (window.Stripe) {
                console.log('Using existing Stripe instance');
                resolve(window.Stripe(stripePublicKey));
                return;
            }

            console.log('Loading Stripe script');
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = () => {
                console.log('Stripe script loaded, initializing...');
                try {
                    const stripe = window.Stripe(stripePublicKey);
                    console.log('Stripe initialized successfully');
                    resolve(stripe);
                } catch (error) {
                    console.error('Error initializing Stripe:', error);
                    reject(error);
                }
            };
            script.onerror = (error) => {
                console.error('Failed to load Stripe script:', error);
                reject(new Error('Failed to load Stripe.js'));
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Error in loadStripe:', error);
            reject(error);
        }
    });
}