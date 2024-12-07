// System state
let systemInitialized = false;
let memberstackInitialized = false;

// Configuration
const CONFIG = {
    stripePublicKey: 'pk_test_51Nw2OWJRMXFic4sWEgOcPYEYqaGDuuGWGKqKB4fMVQcRJDqQKzZj9qEtgVkrKKTXgV4rFEEYBxh6DQWHZaZRaOWE00rPmWEbFm',
    defaultShippingRate: 'shr_1QScOlJRMXFic4sW8MHW0kq7',
    defaultLanguage: 'de',
    defaultCountry: 'DE'
};

// Product Configuration
const PRODUCT_CONFIG = {
    'course': {
        id: 'prc_online-kochkurs-8b540kc2',
        type: 'digital',
        weight: 0,
        packagingWeight: 0,
        prices: {
            de: 'price_1QTSN6JRMXFic4sW9sklILhd',
            en: 'price_1QTSN6JRMXFic4sW9sklILhd',
            fr: 'price_1QTSN6JRMXFic4sW9sklILhd',
            it: 'price_1QTSN6JRMXFic4sW9sklILhd'
        }
    },
    'book': {
        id: 'prc_cookbook_physical',
        type: 'physical',
        weight: 1005,
        packagingWeight: 152,
        dimensions: {
            length: 25,
            width: 20,
            height: 2
        },
        shippingClass: 'standard',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    'bundle': {
        id: 'prc_cookbook_bundle',
        type: 'bundle',
        weight: 1157,
        packagingWeight: 200,
        dimensions: {
            length: 25,
            width: 20,
            height: 2
        },
        shippingClass: 'standard',
        prices: {
            de: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            en: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            fr: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            it: 'price_1QTSNqJRMXFic4sWJYVWZlrp'
        }
    },
    'free-plan': {
        type: 'digital',
        weight: 0,
        packagingWeight: 0,
        prices: {}
    }
};

// Shipping Rates Configuration
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

// Utility Functions
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await delay(baseDelay * Math.pow(2, i));
        }
    }
}

// Shipping Functions
function getShippingRateForCountry(country) {
    if (!country) return null;
    const rate = Object.entries(SHIPPING_RATES).find(([_, rate]) => 
        rate.countries.includes(country)
    );
    return rate ? rate[0] : null;
}

function getCountriesForShippingRate(shippingRateId) {
    return SHIPPING_RATES[shippingRateId]?.countries || [];
}

// Weight Functions
function calculateTotalWeight(productConfig) {
    if (!productConfig?.requiresShipping) return 0;
    const productWeight = productConfig.weight || 0;
    const packagingWeight = productConfig.packagingWeight || 0;
    return productWeight + packagingWeight;
}

function validateWeights(productConfig) {
    const totalWeight = Number(productConfig.weight + (productConfig.packagingWeight || 0));
    const productWeight = Number(productConfig.weight);
    const packagingWeight = Number(productConfig.packagingWeight || 0);
    
    if (totalWeight !== (productWeight + packagingWeight)) {
        throw new Error('Weight mismatch');
    }
    
    if (!productWeight || !packagingWeight) {
        throw new Error('Missing weight information');
    }
}

// Price Functions
async function updateTotalPrice(version, shippingRateId = null) {
    const productConfig = PRODUCT_CONFIG[version];
    if (!productConfig) return;

    const basePrice = productConfig.basePrice || 0;
    let shippingPrice = 0;

    if (productConfig.requiresShipping && shippingRateId) {
        shippingPrice = SHIPPING_RATES[shippingRateId]?.price || 0;
    }

    const totalPrice = basePrice + shippingPrice;
    const checkoutButton = document.querySelector('[data-checkout-button]');
    if (checkoutButton) checkoutButton.textContent = `Proceed to Checkout (€${totalPrice.toFixed(2)})`;
}

// Email handling is now managed through the custom email flow system
async function sendOrderConfirmationEmail(email, session) {
    if (!email || !session) return;
    // Email handling is now managed through the custom email flow system
}

async function sendOrderNotificationEmail(session) {
    if (!session) return;
    // Email handling is now managed through the custom email flow system
}

// Checkout Functions
async function initializeCheckoutButtons() {
    const buttons = document.querySelectorAll('[data-checkout-button]');
    buttons.forEach(button => {
        button.addEventListener('click', handleCheckout);
    });
}

async function handleCheckout(event, button) {
    event.preventDefault();
    
    const originalText = button ? button.textContent : '';
    if (button) {
        button.textContent = 'Processing...';
        button.disabled = true;
    }

    try {
        const version = button.getAttribute('data-version');
        const productConfig = PRODUCT_CONFIG[version];
        
        if (!productConfig) {
            throw new Error('Invalid product version');
        }

        // Validate weights for physical products
        if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
            validateWeights(productConfig);
        }

        // Check if user is logged in
        const member = await getCurrentMember();
        if (!member?.data) {
            const currentPath = window.location.pathname;
            const queryParams = window.location.search;
            localStorage.setItem('checkoutConfig', JSON.stringify({
                version,
                productType: productConfig.type,
                type: productConfig.type
            }));
            localStorage.setItem('checkoutRedirectUrl', currentPath + queryParams);
            window.location.href = '/registrieren';
            return;
        }

        // Get shipping details for physical products
        let shippingRateId = null;
        if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
            const shippingSelect = document.querySelector('#shipping-rate-select');
            if (!shippingSelect?.value) {
                throw new Error('Please select a shipping option');
            }
            shippingRateId = shippingSelect.value;
        }

        const language = document.documentElement.lang || CONFIG.defaultLanguage;
        const priceId = productConfig.prices[language];

        if (!priceId) {
            throw new Error('Price not found for language');
        }

        // Calculate total weight
        const totalWeight = productConfig.type === 'digital' ? 0 : calculateTotalWeight(productConfig);
        console.log('Calculated total weight:', totalWeight);

        const payload = {
            priceId: priceId,
            customerEmail: member.data.auth.email,
            language: language,
            successUrl: window.location.origin + '/vielen-dank-email',
            cancelUrl: window.location.origin + '/produkte',
            metadata: {
                memberstackUserId: member.data.id,
                productType: productConfig.type, // Keep productType as specified in docs
                type: productConfig.type,
                language: language,
                source: window.location.pathname,
                planId: productConfig.memberstackPlanId || CONFIG.memberstackPlanId,
                requiresShipping: productConfig.type === 'physical' || productConfig.type === 'bundle',
                totalWeight: totalWeight, // Use calculated total weight
                productWeight: productConfig.weight,
                packagingWeight: productConfig.packagingWeight || 0,
                dimensions: productConfig.dimensions ? JSON.stringify(productConfig.dimensions) : null,
                shippingClass: productConfig.shippingClass || 'standard'
            }
        };

        console.log('Checkout payload:', payload);

        if (shippingRateId) {
            payload.shippingRateId = shippingRateId;
        }

        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        await handleCheckout(response);
    } catch (error) {
        console.error('Checkout error:', {
            message: error.message,
            stack: error.stack,
            context: {
                version: button?.getAttribute('data-version'),
                language: document.documentElement.lang
            }
        });
        
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
        
        const errorDiv = document.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
        throw error;
    }
}

async function startCheckout(checkoutData) {
    try {
        const { version, productConfig, member, shippingRateId } = checkoutData;
        
        const language = document.documentElement.lang || CONFIG.defaultLanguage;
        const priceId = productConfig.prices[language];
        
        if (!priceId) {
            throw new Error('Price not found for language');
        }

        // Prepare metadata according to Stripe's documentation
        const metadata = {
            memberstackUserId: member.id,
            planId: productConfig.memberstackPlanId || CONFIG.memberstackPlanId,
            productType: productConfig.type,
            type: productConfig.type,
            language,
            source: window.location.pathname,
            requiresShipping: productConfig.requiresShipping,
            countryCode: shippingRateId === 'shr_1QScOlJRMXFic4sW8MHW0kq7' ? 'EU' : 'AT',
            totalWeight: productConfig.weight + (productConfig.packagingWeight || 0),
            productWeight: productConfig.weight,
            packagingWeight: productConfig.packagingWeight || 0
        };

        // Add optional metadata
        if (productConfig.dimensions) {
            metadata.dimensions = JSON.stringify(productConfig.dimensions);
        }
        if (productConfig.shippingClass) {
            metadata.shippingClass = productConfig.shippingClass;
        }

        const requestData = {
            priceId,
            customerEmail: member.email,
            metadata,
            shippingRateId,
            successUrl: `${window.location.origin}/vielen-dank-email?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/produkte`
        };

        console.log('Creating checkout session with data:', requestData);

        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        await handleCheckout(response);
    } catch (error) {
        console.error('Checkout process failed:', error);
        alert('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
    }
}

// Stripe Functions
let stripeInstance = null;

async function getStripeInstance() {
    if (!stripeInstance) {
        try {
            stripeInstance = await loadStripe(CONFIG.stripePublicKey);
            if (!stripeInstance) {
                throw new Error('Failed to initialize Stripe');
            }
        } catch (error) {
            console.error('Error initializing Stripe:', error);
            throw error;
        }
    }
    return stripeInstance;
}

async function redirectToStripeCheckout(sessionId) {
    try {
        const stripe = await getStripeInstance();
        if (!stripe) {
            throw new Error('Stripe not initialized');
        }

        console.log('Redirecting to Stripe checkout with session ID:', sessionId);
        const { error } = await stripe.redirectToCheckout({ sessionId });

        if (error) {
            console.error('Stripe redirect error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Redirect to Stripe failed:', error);
        throw error;
    }
}

async function handleCheckout(response) {
    try {
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Checkout session creation failed:', errorData);
            throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const responseData = await response.json();
        console.log('Server response:', responseData);

        if (!responseData.id) {
            console.error('Missing session ID in response:', responseData);
            throw new Error('No session ID returned from server');
        }

        await redirectToStripeCheckout(responseData.id);
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
        throw error;
    }
}

// Memberstack Functions
async function getCurrentMember() {
    try {
        return await window.$memberstackDom.getCurrentMember();
    } catch (error) {
        console.error('Error getting current member:', error);
        return null;
    }
}

async function waitForMemberstack(timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (window.$memberstackDom) {
            memberstackInitialized = true;
            return true;
        }
        await delay(100);
    }
    throw new Error('Memberstack initialization timeout');
}

// System Initialization
async function initializeCheckoutSystem() {
    if (systemInitialized) return;
    
    try {
        await waitForMemberstack();
        await getStripeInstance();
        await initializeCheckoutButtons();
        systemInitialized = true;
    } catch (error) {
        console.error('System initialization error:', error);
        throw error;
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeCheckoutSystem().catch(error => {
        console.error('Checkout system initialization failed:', error);
    });
});

// Legacy support
function initializeCheckoutButton() {
    initializeCheckoutSystem().catch(error => {
        console.error('Legacy checkout initialization failed:', error);
    });
}