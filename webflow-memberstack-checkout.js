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
            'BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'GR', 'ES', 'FR', 'HR', 
            'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 'PT', 'RO', 
            'SI', 'SK', 'FI', 'SE'
        ]
    }
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

// Configuration object
const CONFIG = {
    functionsUrl: '/.netlify/functions',
    stripePublicKey: 'pk_test_51Q4ix1JRMXFic4sW5em3IMoFbubNwBdzj4F5tUzStHExi3T245BrPLYu0SG1uWLSrd736NDy0V4dx10ZN4WFJD2a00pAzHlDw8',
    stripePrices: {
        de: 'price_1Q8g1MJRMXFic4sWWumarOmt',
        en: 'price_1QSkXZJRMXFic4sWATnFuSzO',
        it: 'price_1QSkYvJRMXFic4sWeAmPTYAe'
    },
    memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u',
    debug: true,
    baseUrl: window.location.hostname === 'localhost' ? 'http://localhost:8888' : '',
    isLocalDev: window.location.hostname === 'localhost' || window.location.hostname.includes('192.168.') || window.location.hostname.includes('.local')
};

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
    const checkoutButtons = document.querySelectorAll('[data-checkout-button]');
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
        return 'http://localhost:8888';
    } else {
        // For production, use the dedicated functions domain
        return 'https://lillebighopefunctions.netlify.app';
    }
}

async function handleCheckout(event) {
    event.preventDefault();
    
    try {
        const member = await window.$memberstackDom.getCurrentMember();
        if (!member) {
            throw new Error('No member found');
        }

        // Get metadata
        const metadata = {
            memberstackUserId: member.data.id,
            planId: CONFIG.memberstackPlanId,
            totalWeight: '1000',
            productWeight: '900',
            packagingWeight: '100'
        };

        console.log('Checkout metadata:', metadata);

        // Create checkout session
        const response = await fetch(`${getBaseUrl()}${CONFIG.functionsUrl}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: CONFIG.stripePriceId,
                successUrl: `${window.location.origin}/vielen-dank-email`,
                cancelUrl: `${window.location.origin}/produkte`,
                metadata: metadata,
                customerEmail: member.data.auth.email
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to create checkout session: ${errorData.message || response.statusText}`);
        }

        const { sessionId } = await response.json();
        const stripe = window.Stripe(CONFIG.stripePublicKey);
        
        console.log('Redirecting to Stripe with sessionId:', sessionId);
        
        // Redirect to Stripe Checkout
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('An error occurred during checkout. Please try again.');
    }
}

async function createCheckoutSession(event) {
    event.preventDefault();
    
    // Get the language using the language() function
    const language = window.$lbh.language();
    const priceId = CONFIG.stripePrices[language];
    
    console.log('Creating checkout session with language:', language, 'priceId:', priceId);
    
    if (!priceId) {
        console.error('No price ID found for language:', language);
        return;
    }

    try {
        const response = await fetch(`${CONFIG.baseUrl}${CONFIG.functionsUrl}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: priceId,
                successUrl: window.location.origin + '/vielen-dank-email',
                cancelUrl: window.location.origin + '/produkte',
                metadata: {
                    memberstackUserId: window.$memberstackDom.getMemberCookie()?.data?.id,
                    source: 'checkout',
                    language: language,
                    planId: CONFIG.memberstackPlanId,
                    totalWeight: '1000',
                    countryCode: getShippingCountry(),
                    productWeight: '900',
                    packagingWeight: '100'
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to create checkout session: ${errorData.message || response.statusText}`);
        }

        const { sessionId } = await response.json();
        const stripe = window.Stripe(CONFIG.stripePublicKey);
        
        console.log('Redirecting to Stripe with sessionId:', sessionId);
        
        // Redirect to Stripe Checkout
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('An error occurred during checkout. Please try again.');
    }
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
const basePrice = 49; // Base product price

// Find all shipping select elements
function initializeShippingSelects() {
    const shippingSelects = document.querySelectorAll('[id^="shipping-rate-select"]');
    shippingSelects.forEach(shippingSelect => {
        if (shippingSelect) {
            // Add change event listener
            shippingSelect.addEventListener('change', (e) => {
                updateTotalPrice(basePrice, e.target.value);
            });

            // Initialize with current selection or Austria as default
            const initialShippingRate = shippingSelect.value || 'shr_1QScKFJRMXFic4sW9e80ABBp';
            console.log('Initial shipping rate:', initialShippingRate);
            updateTotalPrice(basePrice, initialShippingRate);
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
                resolve(window.$memberstackDom);
                return;
            }

            if (Date.now() - startTime > timeout) {
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
            if (window.Stripe) {
                console.log('Using existing Stripe instance');
                const stripe = window.Stripe('pk_test_51NxsqFJRMXFic4sWqoKfwlsqGhZXVTRXBKWsZpLWCVXHJEPvFGZGYPTQZIzZqPRqHPDlkRFEAcNvkjVIQIrLVPNh00CqUxcRKG');
                resolve(stripe);
                return;
            }

            console.log('Loading Stripe script');
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = () => {
                console.log('Stripe script loaded, initializing...');
                try {
                    const stripe = window.Stripe('pk_test_51NxsqFJRMXFic4sWqoKfwlsqGhZXVTRXBKWsZpLWCVXHJEPvFGZGYPTQZIzZqPRqHPDlkRFEAcNvkjVIQIrLVPNh00CqUxcRKG');
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

document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize all language selectors
        const languageSelectors = document.querySelectorAll('.language-selector');
        const currentLanguage = window.$lbh.language();
        
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
    } catch (error) {
        console.error('Error initializing language selectors:', error);
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing checkout system...');
    
    try {
        // Check if we're on membershome
        const isOnMembershome = window.location.pathname.includes('/memberbereich');
        console.log('Is on membershome:', isOnMembershome);

        // Initialize shipping selects
        const hasShippingSelects = initializeShippingSelects();
        
        // Initialize checkout button
        const checkoutButton = document.querySelector('[data-checkout-button]');
        
        console.log('Found elements:', {
            checkoutButton: !!checkoutButton,
            shippingSelect: hasShippingSelects
        });

        if (!checkoutButton) {
            console.log('Required elements not found, skipping initialization');
            return;
        }

        // Handle shipping selection change
        if (hasShippingSelects) {
            const shippingSelects = document.querySelectorAll('[id^="shipping-rate-select"]');
            shippingSelects.forEach(shippingSelect => {
                shippingSelect.addEventListener('change', (e) => {
                    console.log('Shipping selection changed:', e.target.value);
                    updateTotalPrice(basePrice, e.target.value);
                });
            });
        }

        // Handle checkout button click
        checkoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await createCheckoutSession(e);
        });

        // Wait for both Memberstack and Stripe to be ready
        console.log('Loading Memberstack and Stripe...');
        const [memberstack, stripe] = await Promise.all([
            waitForMemberstack(),
            loadStripe()
        ]);
        console.log('Memberstack and Stripe loaded successfully');

        // Function to start checkout process
        const startCheckout = async (shippingRateId = 'shr_1QScKFJRMXFic4sW9e80ABBp') => {
            console.log('Starting checkout process');
            try {
                console.log('Getting current member...');
                const member = await memberstack.getCurrentMember();
                console.log('Current member:', member);

                if (!member) {
                    console.log('No member found, redirecting to registration');
                    window.location.href = '/registrieren';
                    return;
                }

                // Verify member data exists
                if (!member.data?.auth?.email) {
                    console.error('Member data incomplete:', member);
                    window.location.href = '/registrieren';
                    return;
                }

                console.log('Creating checkout session with shipping rate:', shippingRateId);
                
                const response = await fetch('https://lillebighopefunctions.netlify.app/.netlify/functions/create-checkout-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        priceId: 'price_1QRN3aJRMXFic4sWBBilYzAc',
                        customerEmail: member.data.auth.email,
                        shippingRateId: shippingRateId,
                        metadata: {
                            memberstackUserId: member.data.id,
                            planId: 'prc_online-kochkurs-8b540kc2',
                            totalWeight: '1000',
                            productWeight: '900',
                            packagingWeight: '100'
                        }
                    })
                });

                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server response error:', errorText);
                    throw new Error(`Failed to create checkout session: ${errorText}`);
                }

                const session = await response.json();
                console.log('Received session:', session);
                
                if (!session || (!session.sessionId && !session.url)) {
                    console.error('Invalid session data:', session);
                    throw new Error('Invalid session data received from server');
                }

                if (session.url) {
                    console.log('Redirecting to session URL:', session.url);
                    window.location.href = session.url;
                } else {
                    console.log('Redirecting to checkout with sessionId:', session.sessionId);
                    const { error } = await stripe.redirectToCheckout({
                        sessionId: session.sessionId
                    });
                    
                    if (error) {
                        console.error('Checkout redirect error:', error);
                        throw error;
                    }
                }
            } catch (error) {
                console.error('Checkout error:', error);
                alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
            }
        };

        // Start checkout automatically if on membershome
        if (isOnMembershome) {
            console.log('On membershome page, starting checkout automatically');
            await startCheckout();
        }

        console.log('Checkout system initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        if (error.message === 'Memberstack timeout') {
            console.log('Proceeding without Memberstack');
        }
    }
});
