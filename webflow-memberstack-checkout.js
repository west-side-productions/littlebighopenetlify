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
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
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
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u',
        dimensions: {
            length: 25,
            width: 20,
            height: 2
        },
        shippingClass: 'standard'
    },
    bundle: {
        type: 'bundle',
        products: ['course', 'book'],
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
    }
};

const CONFIG = {
    functionsUrl: '/.netlify/functions',
    stripePublicKey: 'pk_test_51Q4ix1JRMXFic4sW5em3IMoFbubNwBdzj4F5tUzStHExi3T245BrPLYu0SG1uWLSrd736NDy0V4dx10ZN4WFJD2a00pAzHlDw8',
    defaultShippingRate: 'shr_1QScOlJRMXFic4sW8MHW0kq7', // EU shipping rate
    memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u',
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
    return 'https://lillebighopefunctions.netlify.app/.netlify/functions';
}

async function handleCheckout(event) {
    event.preventDefault();
    console.log('Checkout button clicked');

    try {
        // Get current member
        const member = await window.$memberstackDom.getCurrentMember();
        console.log('Current member:', member?.data?.id || 'Not found');

        // Get product configuration
        const productElement = document.querySelector('[data-product-type]');
        const productType = productElement?.dataset.productType || 'book';
        const productConfig = PRODUCT_CONFIG[productType];
        
        // Get shipping rate if available
        const shippingSelect = document.querySelector('#shipping-rate-select');
        let shippingRateId = null;

        if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
            if (!shippingSelect?.value) {
                throw new Error('Please select a shipping option');
            }
            shippingRateId = shippingSelect.value;
        }

        // Log configuration
        console.log('Using product configuration:', {
            type: productType,
            config: productConfig,
            shippingRequired: productConfig.type === 'physical' || productConfig.type === 'bundle',
            shippingRate: shippingRateId
        });

        // If not logged in, store checkout info and redirect to registration
        if (!member?.data) {
            const currentPath = window.location.pathname;
            const queryParams = window.location.search;
            
            // Store checkout configuration
            localStorage.setItem('checkoutConfig', JSON.stringify({
                productType: productType,
                shippingRateId: shippingRateId
            }));
            
            localStorage.setItem('checkoutRedirectUrl', currentPath + queryParams);
            window.location.href = '/registrieren';
            return;
        }

        // Get language
        const language = await getPreferredLanguage();

        // Create checkout session
        console.log('Creating checkout session:', {
            productType,
            productConfig,
            language,
            memberEmail: member.data.auth.email
        });

        await startCheckout(shippingRateId, productType);

    } catch (error) {
        console.error('Checkout error:', error);
        alert(error.message || 'An error occurred during checkout. Please try again.');
    }
}

// Function to get user's preferred language
async function getPreferredLanguage() {
    try {
        // Use the global language detection from $lbh
        const language = await $lbh.language();
        
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
    } catch (error) {
        console.error('Error getting preferred language:', error);
        return CONFIG.defaultLanguage;
    }
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
        if (!member?.data) {
            // Store current URL for redirect after registration
            const currentPath = window.location.pathname;
            const queryParams = window.location.search;
            
            // Store checkout configuration
            if (shippingRateId || forcedProductType) {
                localStorage.setItem('checkoutConfig', JSON.stringify({
                    productType: forcedProductType,
                    shippingRateId: shippingRateId
                }));
            }
            
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
            productType = forcedProductType || 'book';
            productConfig = PRODUCT_CONFIG[productType];
            
            if ((productConfig.type === 'physical' || productConfig.type === 'bundle') && !shippingRateId) {
                const shippingSelect = document.querySelector('#shipping-rate-select');
                shippingRateId = shippingSelect?.value;
                if (!shippingRateId) {
                    throw new Error('Please select a shipping option');
                }
            }
        } else {
            productType = productType || productElement?.dataset.productType || 'course';
            productConfig = PRODUCT_CONFIG[productType];
            
            if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
                const shippingSelect = document.querySelector('#shipping-rate-select');
                shippingRateId = shippingSelect?.value;
                if (!shippingRateId) {
                    throw new Error('Please select a shipping option');
                }
            }
        }

        if (!productConfig) {
            throw new Error(`Invalid product type: ${productType}`);
        }

        console.log('Using product configuration:', {
            type: productType,
            config: productConfig,
            shippingRequired: productConfig.type === 'physical' || productConfig.type === 'bundle',
            shippingRate: shippingRateId
        });

        // Get the language and corresponding price ID
        const language = await getPreferredLanguage();
        const priceId = productConfig.prices[language];
        
        if (!priceId) {
            throw new Error(`No price found for language: ${language}`);
        }

        // Create checkout session payload
        const payload = {
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
                source: window.location.pathname,
                planId: productConfig.memberstackPlanId || CONFIG.memberstackPlanId,
                requiresShipping: productConfig.type === 'physical' || productConfig.type === 'bundle',
                totalWeight: productConfig.weight + (productConfig.packagingWeight || 0),
                productWeight: productConfig.weight,
                packagingWeight: productConfig.packagingWeight || 0,
                dimensions: productConfig.dimensions ? JSON.stringify(productConfig.dimensions) : null,
                shippingClass: productConfig.shippingClass || 'standard'
            }
        };

        // Add shipping rate if provided and required for physical products
        if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
            if (!shippingRateId) {
                throw new Error('Shipping rate is required for physical products');
            }
            payload.shippingRateId = shippingRateId;
            const shippingRate = SHIPPING_RATES[shippingRateId];
            if (shippingRate) {
                payload.metadata.countryCode = shippingRate.countries[0];
            }
        } else {
            // For digital products, use default country code
            payload.metadata.countryCode = CONFIG.defaultCountry;
        }

        console.log('Creating checkout session:', payload);

        // Create checkout session
        try {
            const response = await fetch(`${getBaseUrl()}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
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
            console.log('Checkout session created:', session);
            
            // Redirect to Stripe checkout
            const stripe = await loadStripe(CONFIG.stripePublicKey);
            const { error } = await stripe.redirectToCheckout({
                sessionId: session.sessionId
            });

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error creating checkout session:', error);
            if (button) {
                button.textContent = originalText;
                button.disabled = false;
            }
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
        throw error;
    }
}

// Get shipping country from shipping rate ID
function getShippingCountry(shippingRateId) {
    const shipping = SHIPPING_RATES[shippingRateId];
    return shipping ? shipping.countries[0] : CONFIG.defaultCountry; // Default to Austria if not found
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

// Initialize checkout system
async function initializeCheckoutSystem() {
    console.log('Initializing checkout system...');
    
    // Wait for Memberstack to be ready
    if (!window.$memberstackDom?.getCurrentMember) {
        console.log('Waiting for Memberstack...');
        await new Promise((resolve) => {
            window.addEventListener('memberstack:initialized', resolve);
            setTimeout(resolve, 15000); // Timeout after 15s
        });
    }

    // Initialize Stripe
    await loadStripe();
    
    // Initialize checkout buttons only after both Memberstack and Stripe are ready
    initializeCheckoutButton();
    
    console.log('Checkout system initialized successfully');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing checkout system...');
    initializeCheckoutSystem().catch(error => {
        console.error('Error initializing checkout system:', error);
    });
});