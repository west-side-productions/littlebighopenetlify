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
    console.log('Initializing shopping system...');

    // Initialize Memberstack
    const memberstackDOM = window.$memberstackDom;
    console.log('Initializing Memberstack...');

    // Initialize Stripe
    let stripe;
    try {
        if (window.Stripe) {
            console.log('Stripe.js already loaded');
            stripe = Stripe('pk_live_51OPYr9JRMXFic4sWvXxVEWJqhTUkz6OyX0fCxGPFGAZBGQXrDjqO7OyQbqwA1QQsgfjBPGBGtxUJBjvLjBtSADVm00wXF4WBVT');
            console.log('Stripe initialized successfully');
        } else {
            console.error('Stripe.js not found');
        }
    } catch (error) {
        console.error('Error initializing Stripe:', error);
    }

    return { stripe, memberstackDOM };
}

// Initialize checkout button
async function initializeCheckoutButton() {
    console.log('Setting up checkout button...');
    const button = document.querySelector('.checkout-button');
    
    if (!button) {
        console.error('No checkout button found');
        return;
    }

    const memberstackDOM = window.$memberstackDom;
    if (!memberstackDOM) {
        console.error('Memberstack not initialized');
        return;
    }

    button.addEventListener('click', async (event) => {
        await handleCheckout(event);
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
        // For production and preview deployments
        return window.location.origin;
    }
}

async function handleCheckout(event) {
    event.preventDefault();
    const button = event.target;
    button.disabled = true;
    button.textContent = 'Processing...';
    
    try {
        // Get current member using Memberstack DOM API
        const member = await window.$memberstackDom.getCurrentMember();
        console.log('Current member:', member);
        
        // Prepare checkout data
        const checkoutData = {
            priceId: 'price_1QRN3aJRMXFic4sWlZEHQFjx9AYHWGHPNhVVNXOFGFPqkJTDPrqUVFXVkherSlXbPYJBJtqZgQoYJqKFpPXQGGxX00uv5HFkbJ',
            quantity: 1,
            successUrl: `${window.location.origin}/success`,
            cancelUrl: `${window.location.origin}/cancel`,
            customerEmail: member?.data?.email || 'office@west-side-productions.at',
            metadata: {
                memberstackUserId: member?.id
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
            mode: 'cors',
            credentials: 'same-origin',
            body: JSON.stringify(checkoutData)
        });

        if (!response.ok) {
            const errorData = await response.text().catch(() => 'No error details available');
            console.error('Error response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorData,
                url: endpointUrl
            });
            throw new Error(`Failed to create checkout session: ${response.status} - ${errorData}`);
        }

        const session = await response.json();
        console.log('Checkout session created:', session);
        
        // Redirect to Stripe Checkout
        if (session.url) {
            window.location.href = session.url;
        } else {
            throw new Error('No checkout URL in the response');
        }

    } catch (error) {
        console.error('Checkout error:', error);
        button.disabled = false;
        button.textContent = 'Buy Now';
        alert('Sorry, there was a problem starting the checkout process. Please try again.');
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
