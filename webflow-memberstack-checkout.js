// Unified Shipping Calculator and Checkout for Webflow + Stripe
// Unified Shipping Calculator and Checkout for Webflow + Stripe

// Configuration
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { 
        price: 7.28, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
        price: 20.36, 
        label: 'Europe', 
        countries: [
            'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
        ]
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
        id: 'prc_cookbook_bundle',
        type: 'bundle',
        requiresShipping: true,
        weight: 1005,  
        packagingWeight: 152, 
        components: {
            book: {
                priceMultiplier: 1,    
                type: 'physical'
            },
            course: {
                priceMultiplier: 0.5,  
                type: 'digital'
            }
        },
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
    }
};

const CONFIG = {
    functionsUrl: '/.netlify/functions',
    stripePublicKey: 'pk_test_51Q4ix1JRMXFic4sW5em3IMoFbubNwBdzj4F5tUzStHExi3T245BrPLYu0SG1uWLSrd736NDy0V4dx10ZN4WFJD2a00pAzHlDw8',
    defaultShippingRate: 'shr_1QScOlJRMXFic4sW8MHW0kq7', // EU shipping rate
    memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u',
    defaultLanguage: 'de',
    defaultCountry: 'DE',
    allowedCountries: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'SG']
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

// Wait for Memberstack to be available
async function waitForMemberstack(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        function checkMemberstack() {
            // Check if Memberstack is loaded and initialized
            if (window.$memberstackDom && typeof window.$memberstackDom.getCurrentMember === 'function') {
                // Check if we can get the current member
                window.$memberstackDom.getCurrentMember()
                    .then(member => {
                        console.log('Memberstack initialized with member:', member?.data?.id || 'Not logged in');
                        resolve(window.$memberstackDom);
                    })
                    .catch(error => {
                        console.warn('Error getting current member:', error);
                        resolve(window.$memberstackDom); // Still resolve since Memberstack is available
                    });
                return;
            }

            if (Date.now() - startTime > timeout) {
                console.warn('Memberstack load timeout');
                resolve(null); // Resolve with null instead of rejecting
                return;
            }

            setTimeout(checkMemberstack, 100);
        }

        checkMemberstack();
    });
}

// Get language from URL path
function getCurrentLanguage() {
    // First try URL path
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const urlLang = pathParts.length > 0 && ['de', 'en', 'fr', 'it'].includes(pathParts[0]) ? pathParts[0] : null;
    
    if (urlLang) {
        console.log('Language from URL:', urlLang);
        return urlLang;
    }
    
    // Fallback to default
    console.log('No valid language in URL, using default:', CONFIG.defaultLanguage);
    return CONFIG.defaultLanguage;
}

// Initialize dependencies
async function initializeDependencies() {
    try {
        console.log('Initializing checkout system...');
        
        // First load Memberstack and Stripe in parallel
        await Promise.all([
            waitForMemberstack(),
            loadStripe()
        ]);
        
        console.log('Memberstack and Stripe loaded successfully');
        
        // Initialize checkout buttons
        await initializeCheckoutButton();
        
        // Initialize shipping selects after buttons
        initializeShippingSelects();
        
        console.log('Checkout system initialized successfully');
    } catch (error) {
        console.error('Error initializing dependencies:', error);
    }
}

// Initialize checkout button
async function initializeCheckoutButton() {
    // Wait for DOM to be fully loaded
    if (document.readyState !== 'complete') {
        await new Promise(resolve => window.addEventListener('load', resolve));
    }
    
    const currentLang = getCurrentLanguage();
    console.log('Current language from URL:', currentLang);
    
    // Find bundle button
    const bundleButton = document.querySelector(`#checkout-button-bundle-${currentLang}`);
    if (bundleButton) {
        console.log(`Found bundle button: ${bundleButton.id}`);
        bundleButton.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('Bundle button clicked');
            const shippingSelect = document.querySelector('#shipping-rate-select-bundle select');
            const shippingRateId = shippingSelect ? shippingSelect.value : CONFIG.defaultShippingRate;
            handleCheckout(event, 'bundle', shippingRateId, currentLang);
        });
    } else {
        console.warn(`Bundle button not found for language ${currentLang}`);
    }
    
    // Find book button
    const bookButton = document.querySelector(`#checkout-button-book-${currentLang}`);
    if (bookButton) {
        console.log(`Found book button: ${bookButton.id}`);
        bookButton.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('Book button clicked');
            const shippingSelect = document.querySelector('#shipping-rate-select-book select');
            const shippingRateId = shippingSelect ? shippingSelect.value : CONFIG.defaultShippingRate;
            handleCheckout(event, 'book', shippingRateId, currentLang);
        });
    } else {
        console.warn(`Book button not found for language ${currentLang}`);
    }
    
    // Log available buttons if none were found
    if (!bundleButton && !bookButton) {
        console.warn(`No checkout buttons found for language ${currentLang}. Available buttons:`, 
            Array.from(document.querySelectorAll('[id^="checkout-button-"]')).map(b => b.id));
    }
}

// Update handleCheckout to use the passed language
async function handleCheckout(event, productType, shippingRateId, language) {
    console.log('Starting checkout for:', { productType, shippingRateId, language });
    
    try {
        // Get current member
        const member = await window.$memberstackDom.getCurrentMember();
        console.log('Member status:', member ? 'Found' : 'Not logged in');

        // If not logged in, redirect to registration
        if (!member?.data) {
            console.log('User not logged in, redirecting to registration');
            window.location.href = '/registrieren';
            return;
        }

        // User is logged in, proceed with checkout
        console.log('User is logged in, proceeding with checkout');
        
        // Ensure we have a price for this language
        const config = PRODUCT_CONFIG[productType];
        if (!config) {
            console.error(`No configuration found for product type: ${productType}`);
            return;
        }

        // Validate language and price
        if (!config.prices[language]) {
            console.warn(`No price found for language ${language}, falling back to default`);
            language = CONFIG.defaultLanguage;
        }
        
        // Log configuration
        console.log('Checkout configuration:', {
            type: productType,
            config: config,
            language: language,
            price: config.prices[language],
            shippingRequired: config.requiresShipping,
            shippingRate: shippingRateId
        });

        // Prepare checkout data
        const checkoutData = {
            email: member.data.auth.email,
            productType: productType,
            shippingRateId: shippingRateId,
            language: language,
            successUrl: `${window.location.origin}/vielen-dank-email?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: window.location.href,
            memberstackUserId: member.data.id,
            metadata: {
                productType: productType,
                language: language,
                memberstackUserId: member.data.id
            }
        };
        
        // Start checkout
        await startCheckout(checkoutData);
    } catch (error) {
        console.error('Checkout error:', error);
    }
}

// Start checkout process
async function startCheckout(checkoutData) {
    console.log('Creating checkout session with data:', checkoutData);
    
    try {
        const response = await fetch(`${getBaseUrl()}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkoutData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Checkout error response:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(`Checkout failed: ${errorData.error || response.statusText}`);
        }

        const session = await response.json();
        
        // Redirect to Stripe Checkout
        const stripe = await loadStripe(CONFIG.stripePublicKey);
        const { error } = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (error) {
            console.error('Stripe redirect error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        throw error;
    }
}

// Get the base URL for API endpoints
function getBaseUrl() {
    return 'https://lillebighopefunctions.netlify.app/.netlify/functions';
}

// Get shipping country from shipping rate ID
function getShippingCountry(shippingRateId) {
    const shipping = SHIPPING_RATES[shippingRateId];
    return shipping ? shipping.countries[0] : CONFIG.defaultCountry; // Default to Austria if not found
}

// Initialize shipping rate selection
function initializeShippingSelects() {
    const productTypes = ['book', 'bundle'];
    
    // Get current language from URL path
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const currentLang = pathParts.length > 0 && ['de', 'en', 'it'].includes(pathParts[0]) ? pathParts[0] : 'de';
    
    // Set default shipping rate based on language
    const defaultShippingRate = currentLang === 'en' ? 
        'shr_1QScOlJRMXFic4sW8MHW0kq7' : // EU rate for English
        'shr_1QScKFJRMXFic4sW9e80ABBp'; // Austrian rate for others
    
    productTypes.forEach(productType => {
        const selectId = `shipping-rate-select-${productType}`;
        const shippingContainer = document.querySelector(`#${selectId}`);
        if (!shippingContainer) {
            console.log(`No shipping container found for ${productType}`);
            return;
        }
        
        const select = shippingContainer.querySelector('select');
        if (!select) {
            console.log(`No shipping select found for ${productType}`);
            return;
        }
        
        // Ensure unique ID
        select.id = selectId;
        
        const config = PRODUCT_CONFIG[productType];
        
        // Only show shipping selection for physical products and bundles
        const requiresShipping = config.type === 'physical' || config.type === 'bundle';
        shippingContainer.style.display = requiresShipping ? 'block' : 'none';
        
        if (!requiresShipping) return;

        // Set initial shipping rate based on language
        select.value = defaultShippingRate;
        
        // Update shipping rate when option changes
        select.addEventListener('change', (event) => {
            const shippingRateId = event.target.value;
            console.log(`Shipping rate changed for ${productType} to ${shippingRateId}`);
            
            // Sync other shipping selects if they exist
            productTypes.forEach(otherType => {
                if (otherType !== productType) {
                    const otherSelect = document.querySelector(`#shipping-rate-select-${otherType} select`);
                    if (otherSelect) {
                        otherSelect.value = shippingRateId;
                    }
                }
            });
        });
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
    console.log('DOM loaded, initializing checkout system...');
    
    try {
        // First check if we're on membershome and need to start checkout
        const pathname = window.location.pathname;
        const isOnMembershome = pathname === '/membershome' || pathname.endsWith('/membershome');
        console.log('Is on membershome:', isOnMembershome, 'Path:', pathname);
        
        // Initialize language selectors if they exist
        try {
            const languageSelectors = document.querySelectorAll('.language-selector, select[name="Sprache"]');
            if (languageSelectors.length > 0) {
                const currentLanguage = getCurrentLanguage();
                
                languageSelectors.forEach(selector => {
                    if (selector) {
                        selector.value = currentLanguage;
                        
                        // Add change listener to sync all selectors
                        selector.addEventListener('change', function(e) {
                            const newLang = e.target.value;
                            console.log(`Language changed to: ${newLang}`);
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

        // Get current language for button detection
        const currentLang = getCurrentLanguage();
        console.log('Detecting buttons for language:', currentLang);

        // Find required elements for checkout
        const elements = {
            checkoutButtons: document.querySelectorAll(`#checkout-button-bundle-${currentLang}, #checkout-button-book-${currentLang}`),
            shippingSelects: document.querySelectorAll('#shipping-rate-select, select[name="Versand-nach"]'),
            priceElements: document.querySelectorAll('[data-price-display]')
        };
        
        // Log found elements
        console.log('Found elements:', {
            checkoutButtons: Array.from(elements.checkoutButtons).map(b => b.id),
            shippingSelects: elements.shippingSelects.length,
            priceElements: elements.priceElements.length
        });

        // Check if we have the necessary elements or if we're on membershome
        if (Object.values(elements).some(el => el.length > 0) || isOnMembershome) {
            console.log('Loading Memberstack and Stripe...');
            
            // Initialize dependencies
            await initializeDependencies();
            
            console.log('Memberstack and Stripe loaded successfully');
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