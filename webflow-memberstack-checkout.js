// Unified Shipping Calculator and Checkout for Webflow + Stripe

// Configuration
const SHIPPING_RATES = {
    AT: { price: 5, label: "Austria (€5)" },
    DE: { price: 10, label: "Germany (€10)" },
    EU: { price: 10, label: "Europe (€10)" }
};

const EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// Configuration object
const CONFIG = {
    // TODO: Replace with your Stripe price ID (starts with prc_) for Memberstack 2.0
    priceId: 'prc_buch-tp2106tu', // Stripe price ID for Memberstack 2.0
    successUrl: `${window.location.origin}/success`,
    cancelUrl: `${window.location.origin}/cancel`
};

// State management
const state = {
    productType: 'book',
    basePrice: 29.99,
    quantity: 1,
    shippingCountry: null
};

// Utility function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

// Initialize Stripe
let stripe;
async function initStripe() {
    try {
        console.log('Initializing Stripe...');
        stripe = await Stripe('pk_test_51OQvSBFrPAUGZiHgGYKkHZZiGLCxqSFTXGgxFVOtBtqjlzQxMZWwxjPWmSsGDWmYZkVEqgOULZoNgRVgRGbsVEkB00cXTZQMtw');
        console.log('Stripe initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        return false;
    }
}

// Initialize Memberstack
let memberstackDom;

async function initializeMemberstack() {
    // Wait for Memberstack to be available
    while (!window.$memberstackDom) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    memberstackDom = window.$memberstackDom;
    
    // Log available methods
    console.log('Available Memberstack methods:', Object.keys(memberstackDom));
    console.log('Memberstack initialized:', memberstackDom);
    return memberstackDom;
}

// Handle checkout button click
async function handleCheckout(e) {
    e.preventDefault();
    
    try {
        // Initialize Stripe first
        if (!stripe) {
            const stripeInitialized = await initStripe();
            if (!stripeInitialized) {
                throw new Error('Stripe not initialized');
            }
        }

        // Check authentication with Memberstack
        const memberstack = await initializeMemberstack();
        if (!memberstack) {
            throw new Error('Memberstack not initialized');
        }

        const member = await memberstack.getCurrentMember();
        console.log('Current member:', member);
        
        if (!member) {
            console.log('User not authenticated, redirecting to login');
            await memberstack.openModal('login');
            return;
        }

        console.log('Starting Stripe checkout...');
        
        // Create Stripe Checkout Session using Netlify function
        const NETLIFY_DOMAIN = 'https://lillebighopefunctions.netlify.app';  
        const checkoutEndpoint = `${NETLIFY_DOMAIN}/.netlify/functions/create-checkout-session`;
        console.log('Calling checkout endpoint:', checkoutEndpoint);

        const response = await fetch(checkoutEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            credentials: 'include',
            mode: 'cors',
            body: JSON.stringify({
                priceId: CONFIG.priceId,
                successUrl: CONFIG.successUrl,
                cancelUrl: CONFIG.cancelUrl
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Checkout session creation failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(`Failed to create checkout session: ${response.status}`);
        }

        const session = await response.json();
        
        if (session.url) {
            // Redirect to Stripe's hosted checkout page
            window.location.href = session.url;
        } else {
            throw new Error('No checkout URL received');
        }
        
    } catch (error) {
        const errorMessage = error?.message || 'Unknown error occurred';
        console.error('Checkout error:', {
            message: errorMessage,
            error: error
        });
        
        if (errorMessage.includes('rate limit')) {
            alert('The service is experiencing high traffic. Please try again in a moment.');
        } else if (errorMessage.includes('auth')) {
            alert('Please log in to continue with your purchase.');
        } else {
            alert('There was a problem processing your request. Please try again.');
        }
    }
}

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    console.log('Setting up checkout buttons...');
    // Target both checkout buttons
    const checkoutButtons = document.querySelectorAll('#checkoutButton, button.checkout-button');
    console.log('Found checkout buttons:', checkoutButtons.length);
    
    checkoutButtons.forEach(button => {
        // Remove any existing click handlers
        button.removeEventListener('click', handleCheckout);
        // Add our new click handler
        button.addEventListener('click', handleCheckout);
    });
    
    console.log('Checkout buttons initialized');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing shopping system...');
    
    try {
        // Initialize Memberstack
        console.log('Checking for Memberstack...', window.$memberstackDom ? 1 : 0);
        const memberstack = await initializeMemberstack();
        if (memberstack) {
            console.log('Memberstack 2.0 found!');
        }
        
        console.log('Shopping system initialized with Memberstack 2.0');
        
        // Initialize checkout buttons
        await initializeCheckoutButtons();
        
    } catch (error) {
        console.error('Error initializing shopping system:', error);
    }
});
