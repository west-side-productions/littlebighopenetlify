// Unified Shipping Calculator and Checkout for Webflow + Stripe

// Configuration
const SHIPPING_RATES = {
    AT: { price: 5, label: "Austria (€5)" },
    DE: { price: 10, label: "Germany Shipping" },
    EU: { price: 10, label: "Europe Shipping" }
};

const EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// Configuration object
const CONFIG = {
    functionsUrl: '/.netlify/functions',
    stripePublicKey: 'pk_test_51QRN3aJRMXFic4sWlZEHQFjx9AYHWGHPNhVVNXOFGFPqkJTDPrqUVFXVkherSlXbPYJBJtqZgQoYJqKFpPXQGGxX00uv5HFkbJ',
    debug: true,
    // For local development, use localhost. For production, use relative URL
    baseUrl: window.location.hostname === 'localhost' ? 'http://localhost:8888' : '',
    // For testing with Netlify Dev
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

    // Initialize Stripe
    if (!window.Stripe) {
        log('Loading Stripe.js...');
        await loadScript('https://js.stripe.com/v3/');
    } else {
        log('Stripe.js already loaded');
    }

    log('Initializing Stripe...');
    window.stripe = Stripe(CONFIG.stripePublicKey);
    log('Stripe initialized successfully');

    // Initialize Memberstack
    if (!window.$memberstackDom) {
        log('Loading Memberstack...');
        await loadScript('https://cdn.memberstack.com/js/v2');
    }

    const memberstack = window.$memberstackDom;
    log('Available Memberstack methods:', Object.keys(memberstack));
    log('Memberstack initialized:', memberstack);

    return { stripe: window.stripe, memberstack };
}

// Initialize checkout button
async function initializeCheckoutButton() {
    log('Setting up checkout button...');
    const button = document.querySelector('.checkout-button');
    
    if (!button) {
        console.error('No checkout button found');
        return;
    }

    const memberstack = window.$memberstackDom;
    if (!memberstack) {
        console.error('Memberstack not initialized');
        return;
    }

    button.addEventListener('click', async (event) => {
        event.preventDefault();
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Processing...';
        
        try {
            const member = await memberstack.getCurrentMember();
            
            // Prepare checkout data
            const contentId = 'prc_buch-tp2106tu';
            const quantity = parseInt(document.getElementById('book-quantity')?.value || '1');
            const customerEmail = member?.data?.auth?.email;
            const productConfig = {
                'prc_buch-tp2106tu': {
                    priceId: 'price_1QRN3aJRMXFic4sWlZEHQFjx9AYHWGHPNhVVNXOFGFPqkJTDPrqUVFXVkherSlXbPYJBJtqZgQoYJqKFpPXQGGxX00uv5HFkbJ',
                    weight: 1000,
                    packagingWeight: 50
                }
            };

            const config = productConfig[contentId];
            if (!config) {
                console.error('Product configuration not found for contentId:', contentId);
                throw new Error('Invalid product configuration');
            }

            const checkoutData = {
                priceId: config.priceId,
                quantity: quantity,
                successUrl: `${window.location.origin}/success`,
                cancelUrl: `${window.location.origin}/cancel`,
                customerEmail: customerEmail,
                shipping: {
                    weight: config.weight * quantity,
                    packagingWeight: config.packagingWeight
                },
                metadata: {
                    memberstackUserId: member?.id,
                    memberstackPlanId: contentId,
                    quantity: quantity.toString()
                }
            };

            console.log('Starting checkout process:', checkoutData);
            
            // Get the base URL for the API endpoint
            const baseUrl = getBaseUrl();
            const endpointUrl = `${baseUrl}/.netlify/functions/create-checkout-session`;
            
            console.log('Calling checkout endpoint:', endpointUrl);

            // Make the API call
            const response = await fetch(endpointUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(checkoutData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error response:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                    url: endpointUrl
                });
                throw new Error(`Failed to create checkout session: ${response.status}`);
            }

            const session = await response.json();
            
            // Redirect to Stripe Checkout
            if (session.url) {
                window.location.href = session.url;
            } else {
                throw new Error('No checkout URL in the response');
            }

        } catch (error) {
            console.log('Checkout error:', error);
            button.disabled = false;
            button.textContent = 'Buy Now';
            // Show error to customer
            alert('Sorry, there was a problem starting the checkout process. Please try again or contact support if the problem persists.');
        }
    });

    log('Checkout button initialized');
}

// Get the base URL for API endpoints
function getBaseUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8888';
    } else if (window.location.hostname.includes('.netlify.live')) {
        return window.location.origin;
    } else {
        return window.location.origin;  // Use full origin for production
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

// Initialize the system
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeDependencies();
        await initializeCheckoutButton();
        
        // Set up quantity change handler
        const quantitySelect = document.getElementById('book-quantity');
        if (quantitySelect) {
            quantitySelect.addEventListener('change', updatePriceDisplay);
        }
        
        // Initial price update
        updatePriceDisplay();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
