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

const CONFIG = {
    retryAttempts: 20,
    retryDelay: 500,
    priceId: "price_01HKP1GCHVWQ4WBXN8KQXPVP4T"
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

// Wait for Memberstack to be ready
function waitForMemberstack(callback, maxAttempts = CONFIG.retryAttempts) {
    let attempts = 0;
    
    const checkMemberstack = () => {
        attempts++;
        console.log('Checking for Memberstack...', attempts);
        
        if (window.$memberstackDom) {
            console.log('Memberstack 2.0 found!');
            callback(window.$memberstackDom);
        } else if (attempts < maxAttempts) {
            setTimeout(checkMemberstack, CONFIG.retryDelay);
        } else {
            console.error('Memberstack failed to load after', attempts, 'attempts');
        }
    };
    
    checkMemberstack();
}

// Initialize checkout buttons
async function initializeCheckoutButtons(memberstack) {
    try {
        console.log('Setting up checkout buttons...');
        const checkoutButtons = document.querySelectorAll('[data-memberstack-content="checkout"]');
        console.log('Found checkout buttons:', checkoutButtons.length);
        
        checkoutButtons.forEach(button => {
            button.addEventListener('click', (e) => handleCheckout(e, memberstack));
        });
        
        console.log('Checkout buttons initialized');
    } catch (error) {
        console.error('Error initializing checkout buttons:', error);
    }
}

// Handle checkout button click
async function handleCheckout(e, memberstack) {
    e.preventDefault();
    e.stopPropagation();
    
    const button = e.currentTarget;
    
    try {
        // Disable button during process
        button.disabled = true;
        button.style.opacity = '0.7';
        button.textContent = 'Processing...';

        // Check authentication
        const member = await memberstack.getCurrentMember();
        console.log('Current member:', member);
        
        if (!member) {
            console.log('User not authenticated, redirecting to login');
            await memberstack.openModal('login');
            button.disabled = false;
            button.style.opacity = '1';
            button.textContent = 'Proceed to Checkout';
            return;
        }

        console.log('Starting checkout with price:', CONFIG.priceId);
        
        try {
            // Try direct checkout first
            await memberstack.redirectToCheckout({
                priceId: CONFIG.priceId,
                successUrl: `${window.location.origin}/success`,
                cancelUrl: `${window.location.origin}/cancel`,
                mode: "payment"
            });
        } catch (checkoutError) {
            console.error('Direct checkout failed:', checkoutError);
            
            // Fallback to session creation
            console.log('Attempting fallback to session creation...');
            const session = await memberstack.payments.createSession({
                priceId: CONFIG.priceId,
                successUrl: `${window.location.origin}/success`,
                cancelUrl: `${window.location.origin}/cancel`,
                mode: "payment"
            });

            console.log('Session created:', session);

            if (session?.url) {
                window.location.href = session.url;
            } else {
                throw new Error('No checkout URL received from session');
            }
        }
        
    } catch (error) {
        const errorMessage = error?.message || 'Unknown error occurred';
        console.error('Checkout error:', {
            message: errorMessage,
            error: error
        });
        
        button.disabled = false;
        button.style.opacity = '1';
        button.textContent = 'Proceed to Checkout';
        
        if (errorMessage.includes('rate limit')) {
            alert('Service is temporarily busy. Please try again in a moment.');
        } else {
            alert('There was a problem processing your request. Please try again.');
        }
    }
}

// Initialize the shopping system
function initShoppingSystem() {
    console.log('Initializing shopping system...');
    
    waitForMemberstack((memberstack) => {
        console.log('Shopping system initialized with Memberstack 2.0');
        initializeCheckoutButtons(memberstack);
    });
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initShoppingSystem);
