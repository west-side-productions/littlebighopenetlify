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
        }
    },
    book: {
        id: 'prc_cookbook_physical',
        type: 'physical',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        shipping: {
            weight: {
                product: 1005,
                packaging: 152,
                total: 1157
            }
        },
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
    },
    bundle: {
        type: 'bundle',
        products: ['course', 'book'],
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    }
};

const CONFIG = {
    functionsUrl: '/.netlify/functions',
    stripePublicKey: 'pk_test_51Q4ix1JRMXFic4sW5em3IMoFbubNwBdzj4F5tUzStHExi3T245BrPLYu0SG1uWLSrd736NDy0V4dx10ZN4WFJD2a00pAzHlDw8',
    memberstackPlanId: 'prc_online-kochkurs-8b540kc2', // Default plan ID for course
    defaultShippingRate: 'shr_1QScKFJRMXFic4sW9e80ABBp' // Default to Austria shipping
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
    
    // Wait for Memberstack to be ready
    if (!window.$memberstackDom) {
        log('Waiting for Memberstack to initialize...');
        await new Promise(resolve => {
            const checkMemberstack = setInterval(() => {
                if (window.$memberstackDom) {
                    clearInterval(checkMemberstack);
                    resolve();
                }
            }, 100);
        });
    }
    
    log('Memberstack initialized');
    
    // Load Stripe.js if not already loaded
    if (!window.Stripe) {
        await loadScript('https://js.stripe.com/v3/');
        if (!window.Stripe) {
            throw new Error('Failed to load Stripe.js');
        }
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

// Initialize checkout button
async function initializeCheckoutButton() {
    console.log('Setting up checkout button...');
    
    // Find all checkout buttons
    const checkoutButtons = document.querySelectorAll('[data-memberstack-content="checkout"], [data-checkout-button]');
    if (checkoutButtons.length === 0) {
        console.error('No checkout buttons found on page');
        return;
    }
    
    // Set up click handler for each button
    checkoutButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            console.log('Checkout button clicked');
            await handleCheckout(event);
        });
    });
    
    console.log('Checkout button initialized');
}

// Get the base URL for API endpoints
function getBaseUrl() {
    const hostname = window.location.hostname;
    console.log('Current hostname:', hostname);
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8888/.netlify';
    } else {
        // For production, use the Netlify Functions URL
        return 'https://lillebighopefunctions.netlify.app/.netlify';
    }
}

async function handleCheckout(event) {
    event.preventDefault();
    console.log('Checkout button clicked');
    
    try {
        // Ensure Memberstack is initialized with timeout
        const memberstack = await Promise.race([
            waitForMemberstack(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Memberstack initialization timeout')), 10000)
            )
        ]);
        
        const member = await window.$memberstackDom.getCurrentMember();
        console.log('Current member:', member?.data?.id || 'Not found');

        // Get product type and configuration
        const productElement = document.querySelector('[data-product-type]');
        let productType = null;
        let productConfig = null;
        
        // Special handling for membershome path
        if (window.location.pathname.includes('/membershome')) {
            console.log('Setting product type for membershome');
            productType = 'course';
            // Force product config type to be digital for membershome
            productConfig = {
                ...PRODUCT_CONFIG[productType],
                type: 'digital'  // Ensure it's treated as digital product
            };
        } else {
            productType = productElement?.dataset.productType || 'course';
            productConfig = PRODUCT_CONFIG[productType];
        }

        if (!productConfig) {
            throw new Error(`Invalid product type: ${productType}`);
        }

        // Only require shipping rate for physical products
        let shippingRateId = null;
        if ((productConfig.type === 'physical' || productConfig.type === 'bundle')) {
            const shippingSelect = document.querySelector('#shipping-rate-select');
            if (!shippingSelect?.value) {
                throw new Error('Please select a shipping option');
            }
            shippingRateId = shippingSelect.value;
        }

        // Get the language and corresponding price ID
        const language = getPreferredLanguage();
        console.log('Creating checkout session:', {
            productType,
            productConfig,
            language,
            memberEmail: member.data.auth.email
        });
        
        // Start checkout process
        await startCheckout(shippingRateId, productType);

    } catch (error) {
        console.error('Checkout error:', error);
        if (error.message.includes('Memberstack timeout')) {
            localStorage.setItem('checkoutRedirectUrl', window.location.pathname);
            window.location.href = '/registrieren';
        } else {
            alert(error.message || 'An error occurred during checkout. Please try again.');
        }
    }
}

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
    console.warn(`No Stripe price found for language: ${language}, falling back to ${LANGUAGE_CONFIG.default}`);
    return LANGUAGE_CONFIG.default;
}

// Function to start checkout process
async function startCheckout(shippingRateId = null, forcedProductType = null) {
    console.log('Starting checkout process');
    const button = document.querySelector('[data-checkout-button]');
    const originalText = button ? button.textContent : '';
    
    try {
        if (button) {
            button.textContent = 'Processing...';
            button.disabled = true;
        }

        // Get current member
        const member = await window.$memberstackDom.getCurrentMember();
        if (!member?.data?.auth?.email) {
            // Store current URL for redirect after registration
            const currentPath = window.location.pathname;
            const queryParams = window.location.search;
            localStorage.setItem('checkoutRedirectUrl', currentPath + queryParams);
            
            // Special handling for membershome path
            if (currentPath.includes('/membershome')) {
                // Redirect to registration with return URL
                window.location.href = `/registrieren?returnUrl=${encodeURIComponent(currentPath + queryParams)}`;
                return;
            }
            
            window.location.href = '/registrieren';
            return;
        }

        // Get the product type and corresponding configuration
        const productElement = document.querySelector('[data-product-type]');
        let productType = forcedProductType;
        let productConfig = null;
        
        // Special handling for membershome path
        if (window.location.pathname.includes('/membershome')) {
            console.log('Setting product type for membershome');
            productType = 'course';
            // Force product config type to be digital for membershome
            productConfig = {
                ...PRODUCT_CONFIG[productType],
                type: 'digital'  // Ensure it's treated as digital product
            };
        } else {
            productType = productType || productElement?.dataset.productType || 'course';
            productConfig = PRODUCT_CONFIG[productType];
        }

        if (!productConfig) {
            throw new Error(`Invalid product type: ${productType}`);
        }

        // Only require shipping rate for physical products
        if ((productConfig.type === 'physical' || productConfig.type === 'bundle') && !shippingRateId) {
            throw new Error('Please select a shipping option');
        }

        // Get the language and corresponding price ID
        const language = getPreferredLanguage();
        const priceId = productConfig.prices[language];
        
        if (!priceId) {
            throw new Error(`No price found for language: ${language}`);
        }

        console.log('Creating checkout session:', {
            productType,
            productConfig,
            language,
            priceId,
            memberEmail: member.data.auth.email
        });
        
        // Create checkout session payload
        const payload = {
            priceId: priceId,
            customerEmail: member.data.auth.email,
            metadata: {
                memberstackUserId: member.data.id,
                language: language,
                source: window.location.href,
                planId: productConfig.memberstackPlanId || CONFIG.memberstackPlanId
            }
        };

        // Add shipping rate if product requires shipping
        if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
            if (!shippingRateId) {
                throw new Error('Shipping rate is required for this product');
            }
            payload.shippingRateId = shippingRateId;
        }

        // Add product-specific metadata
        if (productConfig.type === 'bundle') {
            payload.metadata.products = productConfig.products;
            payload.metadata.planIds = productConfig.products.map(prod => PRODUCT_CONFIG[prod].id);
            const bookConfig = PRODUCT_CONFIG.book.shipping.weight;
            payload.metadata.totalWeight = bookConfig.total.toString();
            payload.metadata.productWeight = bookConfig.product.toString();
            payload.metadata.packagingWeight = bookConfig.packaging.toString();
            payload.metadata.requiresShipping = true;
        } else if (productConfig.type === 'physical') {
            payload.metadata.planId = productConfig.id;
            const weightConfig = productConfig.shipping.weight;
            payload.metadata.totalWeight = weightConfig.total.toString();
            payload.metadata.productWeight = weightConfig.product.toString();
            payload.metadata.packagingWeight = weightConfig.packaging.toString();
            payload.metadata.requiresShipping = true;
        } else {
            payload.metadata.planId = productConfig.id;
            payload.metadata.requiresShipping = false;
        }

        console.log('Creating checkout session:', {
            ...payload,
            type: productConfig.type
        });

        // Create checkout session
        const baseUrl = 'https://lillebighopefunctions.netlify.app';
        const response = await fetch(`${baseUrl}/.netlify/functions/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();
        console.log('Server response:', responseData);
        
        if (!response.ok) {
            throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
        }

        if (!responseData.sessionId) {
            throw new Error('No session ID received from server');
        }

        // Initialize Stripe and redirect to checkout
        const stripe = await loadStripe();
        if (!stripe) {
            throw new Error('Failed to initialize Stripe');
        }

        console.log('Redirecting to Stripe checkout with session ID:', responseData.sessionId);
        const { error } = await stripe.redirectToCheckout({
            sessionId: responseData.sessionId
        });

        if (error) {
            throw error;
        }

    } catch (error) {
        console.error('Checkout error:', error);
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
        alert(error.message || 'An error occurred during checkout. Please try again.');
        throw error;
    }
}

// Get shipping country from shipping rate ID
function getShippingCountry(shippingRateId) {
    const shipping = SHIPPING_RATES[shippingRateId];
    return shipping ? shipping.countries[0] : 'AT'; // Default to Austria if not found
}

// Update price display
function updatePriceDisplay() {
    const quantity = parseInt(document.getElementById('book-quantity')?.value || '1');
    const basePrice = 29.99;
    const subtotal = (basePrice * quantity).toFixed(2);
    
    document.getElementById('subtotal-price').textContent = subtotal;
    document.getElementById('total-price').textContent = subtotal;
    
    const button = document.querySelector('.checkout-button');
    if (button) {
        button.textContent = `Proceed to Checkout (€${subtotal})`;
    }
}

// Update price display with shipping
function updateTotalPrice(basePrice, shippingRateId) {
    const shipping = SHIPPING_RATES[shippingRateId];
    if (!shipping) return;

    const total = basePrice + shipping.price;
    const priceElement = document.querySelector('.product-price');
    if (priceElement) {
        priceElement.textContent = `€${total.toFixed(2)}`;
    }
}

// Initialize shipping rate selection
const basePrice = 29.99; // Base product price

// Find all shipping select elements
function initializeShippingSelects() {
    // Look for both ID and name-based selectors
    const shippingSelects = document.querySelectorAll('#shipping-rate-select, select[name="Versand-nach"]');
    console.log('Found shipping selects:', shippingSelects.length);
    
    shippingSelects.forEach(shippingSelect => {
        if (shippingSelect) {
            // Ensure the select has both id and name
            shippingSelect.id = 'shipping-rate-select';
            shippingSelect.name = 'Versand-nach';
            
            // Remove required attribute if it exists
            shippingSelect.removeAttribute('required');
            
            // Add change event listener
            shippingSelect.addEventListener('change', (e) => {
                console.log('Shipping rate changed:', e.target.value);
                updateTotalPrice(basePrice, e.target.value);
            });

            // Initialize with current selection or Austria as default
            const initialShippingRate = shippingSelect.value || 'shr_1QScKFJRMXFic4sW9e80ABBp';
            console.log('Initial shipping rate:', initialShippingRate);
            updateTotalPrice(basePrice, initialShippingRate);
        }
    });

    // Initialize language selects
    const languageSelects = document.querySelectorAll('.language-selector, select[name="Sprache"]');
    console.log('Found language selects:', languageSelects.length);
    
    languageSelects.forEach(langSelect => {
        if (langSelect) {
            // Ensure the select has both class and name
            langSelect.classList.add('language-selector');
            langSelect.name = 'Sprache';
            
            // Remove required attribute if it exists
            langSelect.removeAttribute('required');
            
            // Set initial value based on detected language
            const currentLang = getPreferredLanguage();
            if (currentLang && langSelect.querySelector(`option[value="${currentLang}"]`)) {
                langSelect.value = currentLang;
            }
        }
    });

    return shippingSelects.length > 0;
}

// Wait for Memberstack to be available
function waitForMemberstack(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        function checkMemberstack() {
            if (window.$memberstackDom) {
                // On membershome, wait a bit longer to ensure verification is complete
                if (window.location.pathname === '/membershome') {
                    window.$memberstackDom.getCurrentMember()
                        .then(member => {
                            if (member) {
                                resolve(window.$memberstackDom);
                            } else {
                                if (Date.now() - startTime > timeout) {
                                    reject(new Error('Memberstack verification timeout'));
                                } else {
                                    setTimeout(checkMemberstack, 100);
                                }
                            }
                        })
                        .catch(() => setTimeout(checkMemberstack, 100));
                    return;
                }
                resolve(window.$memberstackDom);
                return;
            }

            if (Date.now() - startTime > timeout) {
                // Instead of rejecting, redirect to registration if not on membershome
                if (window.location.pathname !== '/membershome') {
                    localStorage.setItem('checkoutRedirectUrl', 'membershome');
                    window.location.href = '/registrieren';
                    return;
                }
                reject(new Error('Memberstack timeout'));
                return;
            }

            setTimeout(checkMemberstack, 100);
        }

        checkMemberstack();
    });
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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing checkout system...');
    
    try {
        // First check if we're on membershome and need to start checkout
        const pathname = window.location.pathname;
        const isOnMembershome = pathname === '/membershome' || pathname.endsWith('/membershome');
        console.log('Is on membershome:', isOnMembershome, 'Path:', pathname);
        
        // Initialize language selectors if they exist
        try {
            const languageSelectors = document.querySelectorAll('.language-selector, select[name="Sprache"]');
            if (languageSelectors.length > 0) {
                const currentLanguage = getPreferredLanguage();
                
                languageSelectors.forEach(selector => {
                    if (selector) {
                        selector.value = currentLanguage;
                        
                        // Add change listener to sync all selectors
                        selector.addEventListener('change', function(e) {
                            const newLang = e.target.value;
                            languageSelectors.forEach(sel => {
                                if (sel !== e.target) {
                                    sel.value = newLang;
                                }
                            });
                        });
                    }
                });
                
                console.log('Initialized with language:', currentLanguage);
            }
        } catch (error) {
            console.error('Error initializing language selectors:', error);
        }

        // Find required elements for checkout
        const elements = {
            checkoutButtons: document.querySelectorAll('[data-memberstack-content="checkout"], [data-checkout-button]'),
            shippingSelects: document.querySelectorAll('#shipping-rate-select, select[name="Versand-nach"]'),
            priceElements: document.querySelectorAll('[data-price-display]')
        };
        console.log('Found elements:', elements);

        // Check if we have the necessary elements or if we're on membershome
        if (Object.values(elements).some(el => el.length > 0) || isOnMembershome) {
            console.log('Loading Memberstack and Stripe...');
            
            // Initialize dependencies
            const { stripe } = await initializeDependencies();
            window.$lbh = window.$lbh || {};
            window.$lbh.stripe = stripe;
            
            console.log('Memberstack and Stripe loaded successfully');
            
            // Initialize shipping selects if they exist
            if (elements.shippingSelects.length > 0) {
                initializeShippingSelects();
            }
            
            // Initialize checkout buttons if they exist
            if (elements.checkoutButtons.length > 0) {
                await initializeCheckoutButton();
            }

            // Check if we need to start checkout on membershome
            if (isOnMembershome) {
                const params = new URLSearchParams(window.location.search);
                const member = params.get('member');
                const verified = member ? JSON.parse(decodeURIComponent(member)).verified : false;
                
                if (verified || localStorage.getItem('checkoutRedirectUrl') === 'membershome') {
                    localStorage.removeItem('checkoutRedirectUrl');
                    console.log('Starting checkout on membershome...');
                    
                    // On membershome, we start with the course product type
                    const productType = 'course';
                    await startCheckout(null, productType).catch(error => {
                        console.error('Error starting checkout:', error);
                    });
                }
            }

            console.log('Checkout system initialized successfully');
        } else {
            console.log('Required elements not found, skipping initialization');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        if (error.message === 'Memberstack timeout') {
            console.log('Proceeding without Memberstack');
        }
    }
});