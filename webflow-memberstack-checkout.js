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
        const checkoutButtons = document.querySelectorAll('[data-stripe-price-id]');
        console.log('Found checkout buttons:', checkoutButtons.length);
        
        checkoutButtons.forEach(button => {
            console.log('Button price ID:', button.dataset.stripePriceId);
            button.addEventListener('click', handleCheckout);
        });
        
        console.log('Checkout buttons initialized');
    } catch (error) {
        console.error('Error initializing checkout buttons:', error);
    }
}

// Handle checkout button click
async function handleCheckout(e) {
    e.preventDefault();
    console.log('Handling checkout...');

    try {
        // Check Memberstack authentication
        const memberstack = window.$memberstackDom;
        if (!memberstack) {
            console.error('Memberstack not initialized');
            window.location.href = '/login';
            return;
        }

        const member = await memberstack.getCurrentMember();
        if (!member) {
            console.log('User not authenticated, redirecting to login');
            window.location.href = '/login';
            return;
        }

        console.log('User authenticated:', member.email);

        const priceId = e.target.dataset.stripePriceId || 'price_1QRJp1JRMXFic4sWz3gLoCy6';
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

        const { url } = await response.json();
        
        if (url) {
            window.location.href = url;
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
}

// Initialize the script
async function init() {
    console.log('Initializing shopping system...');

    try {
        // Wait for Memberstack to initialize
        await new Promise(resolve => {
            const checkMemberstack = () => {
                if (window.$memberstackDom) {
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
