// Unified Shipping Calculator and Checkout for Webflow + Stripe
// Unified Shipping Calculator and Checkout for Webflow + Stripe

// Configuration
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { 
        price: 0, 
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

// Initialize dependencies
async function initializeDependencies() {
    console.log('Initializing shopping system...');
    
    try {
        // Initialize Memberstack
        let retries = 0;
        const maxRetries = 10;
        
        while (!window.$memberstackDom && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
            retries++;
        }
        
        if (!window.$memberstackDom) {
            throw new Error('Memberstack timeout');
        }
        console.log('Memberstack initialized');

        // Initialize Stripe
        if (!window.Stripe) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://js.stripe.com/v3/';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        const stripe = window.Stripe(CONFIG.stripePublicKey);
        console.log('Stripe initialized with test key');

        return { stripe };
    } catch (error) {
        console.error('Error initializing dependencies:', error);
        throw error;
    }
}

// Initialize checkout button
async function initializeCheckoutButton() {
    console.log('Setting up checkout button...');
    
    try {
        const checkoutButtons = document.querySelectorAll('[data-memberstack-content="checkout"], [data-checkout-button]');
        if (checkoutButtons.length === 0) {
            console.log('No checkout buttons found');
            return;
        }

        checkoutButtons.forEach(button => {
            // Remove any existing listeners
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            // Add click listener
            newButton.addEventListener('click', async (event) => {
                event.preventDefault();
                console.log('Checkout button clicked');
                try {
                    await handleCheckout(event);
                } catch (error) {
                    console.error('Error during checkout:', error);
                    alert(error.message || 'An error occurred during checkout');
                }
            });
        });

        console.log('Checkout button initialized');
    } catch (error) {
        console.error('Error initializing checkout button:', error);
    }
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
        const language = getPreferredLanguage();

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

// Function to start checkout process
async function startCheckout(shippingRateId = null, forcedProductType = null) {
    try {
        const button = document.querySelector('.checkout-button');
        if (!button) return;
        
        // Disable button and show loading state
        button.disabled = true;
        button.textContent = 'Loading...';

        // Get selected shipping rate
        const selectedRate = SHIPPING_RATES[shippingRateId];
        if (!selectedRate) {
            throw new Error('Please select a shipping option');
        }

        // Get product configuration
        const productType = forcedProductType || getProductType();
        const config = PRODUCT_CONFIG[productType];
        if (!config) {
            throw new Error('Invalid product type');
        }

        // Get current member's email
        const member = await window.$memberstackDom?.getCurrentMember();
        const email = member?.data?.email;

        // Get language
        const language = await $lbh.language();

        // Prepare checkout data
        const checkoutData = {
            priceId: config.prices[language] || config.prices['de'],
            email: email,
            language: language,
            requiresShipping: config.requiresShipping,
            successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: window.location.href,
            metadata: {
                productType: productType
            }
        };

        // Add shipping information if required
        if (config.requiresShipping) {
            checkoutData.shippingCountry = selectedRate.countries[0];
            checkoutData.shippingRate = selectedRate.price;
            checkoutData.shippingLabel = selectedRate.label;
        }

        // Create checkout session
        const response = await fetch(`${getBaseUrl()}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkoutData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Checkout error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`Checkout failed: ${response.statusText}`);
        }

        const session = await response.json();
        
        // Redirect to Stripe Checkout
        const stripe = await loadStripe(CONFIG.stripePublicKey);
        const { error } = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        const button = document.querySelector('.checkout-button');
        if (button) {
            button.disabled = false;
            button.textContent = 'Try again';
        }
        alert(error.message || 'Something went wrong. Please try again.');
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

// Initialize shipping selects
function initializeShippingSelects() {
    console.log('Initializing shipping selects...');
    const shippingSelects = document.querySelectorAll('#shipping-rate-select, select[name="Versand-nach"]');
    console.log('Found shipping selects:', shippingSelects.length);

    if (shippingSelects.length === 0) return;

    // Get current member's country if available
    let defaultCountry = 'AT';  // Default to Austria
    const member = window.$memberstackDom?.getCurrentMember();
    if (member?.data?.customFields?.country) {
        defaultCountry = member.data.customFields.country;
    }

    // Initialize each select
    shippingSelects.forEach(select => {
        // Clear existing options
        select.innerHTML = '';

        // Add placeholder
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Bitte wählen Sie ein Land';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        // Add shipping rate options
        Object.entries(SHIPPING_RATES).forEach(([rateId, rate]) => {
            const option = document.createElement('option');
            option.value = rateId;
            option.textContent = `${rate.label} (${rate.price.toFixed(2)} €)`;
            if (rate.countries.includes(defaultCountry)) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Store initial shipping rate
        const initialRate = select.value;
        console.log('Initial shipping rate:', initialRate);
    });
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
                
                if (verified) {
                    console.log('Starting checkout on membershome after verification...');
                    
                    // Get stored product type and shipping rate
                    const storedConfig = localStorage.getItem('checkoutConfig');
                    let productType = 'course';
                    let shippingRateId = null;
                    
                    if (storedConfig) {
                        try {
                            const config = JSON.parse(storedConfig);
                            productType = config.productType || productType;
                            shippingRateId = config.shippingRateId;
                            localStorage.removeItem('checkoutConfig');
                        } catch (e) {
                            console.error('Error parsing stored config:', e);
                        }
                    }
                    
                    console.log('Starting checkout with config:', { productType, shippingRateId });
                    await startCheckout(shippingRateId, productType).catch(error => {
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