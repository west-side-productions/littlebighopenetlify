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

// State management
const state = {
    productType: 'book',
    basePrice: 29.99,
    quantity: 1,
    shippingCountry: null
};

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

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    try {
        console.log('Setting up checkout buttons...');
        const checkoutButtons = document.querySelectorAll('.custom-checkout[data-stripe-price-id]');
        console.log('Found checkout buttons:', checkoutButtons.length);
        
        checkoutButtons.forEach(button => {
            console.log('Button price ID:', button.dataset.stripePriceId);
            // Remove any existing click handlers
            button.replaceWith(button.cloneNode(true));
            const newButton = document.querySelector(`#${button.id}`);
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCheckout(e);
                return false;
            });
        });
        
        console.log('Checkout buttons initialized');
    } catch (error) {
        console.error('Error initializing checkout buttons:', error);
    }
}

// Check Memberstack authentication
async function checkAuth() {
    try {
        // For Memberstack v1
        if (!window.Memberstack) {
            console.error('Memberstack not initialized');
            return null;
        }

        const member = await window.Memberstack.getMemberCookie();
        console.log('Memberstack auth check:', member ? 'authenticated' : 'not authenticated');
        return member;
    } catch (error) {
        console.error('Memberstack auth error:', error);
        return null;
    }
}

// Handle checkout button click
async function handleCheckout(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Handling checkout...');

    try {
        // Check authentication
        const member = await checkAuth();
        if (!member) {
            console.log('User not authenticated, redirecting to login');
            window.location.href = '/login';
            return;
        }

        console.log('User authenticated:', member.email);
        const button = e.target;
        const priceId = button.dataset.stripePriceId || 'price_1QRJp1JRMXFic4sWz3gLoCy6';
        const quantity = state.quantity || 1;

        const response = await fetch('/.netlify/functions/create-checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId,
                quantity,
                metadata: {
                    memberstack_id: member.id,
                    memberstack_email: member.email
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Checkout session created:', data);
        
        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error('No checkout URL received');
            alert('Sorry, there was a problem creating the checkout session. Please try again.');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        if (error.message.includes('Memberstack')) {
            window.location.href = '/login';
        } else {
            alert('Sorry, there was a problem processing your request. Please try again.');
        }
    }
    return false;
}

// Initialize the script
async function init() {
    console.log('Initializing shopping system...');

    try {
        // Wait for Memberstack to initialize
        await new Promise(resolve => {
            const checkMemberstack = () => {
                if (window.Memberstack) {
                    resolve();
                } else {
                    setTimeout(checkMemberstack, 100);
                }
            };
            checkMemberstack();
        });

        // Initialize Stripe
        await initStripe();

        // Initialize checkout buttons
        await initializeCheckoutButtons();

        console.log('Shopping system initialized');
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
