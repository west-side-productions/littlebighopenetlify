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
        console.log(' Stripe initialized successfully');
        return true;
    } catch (error) {
        console.error(' Error initializing Stripe:', error);
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
        
        console.log(' Checkout buttons initialized');
    } catch (error) {
        console.error(' Error initializing checkout buttons:', error);
    }
}

// Handle checkout button click
async function handleCheckout(e) {
    e.preventDefault();
    console.log(' Checkout initiated');
    
    const button = e.currentTarget;
    
    try {
        // Check if Stripe is initialized
        if (!stripe) {
            console.log('Stripe not initialized, attempting to initialize...');
            const stripeInitialized = await initStripe();
            if (!stripeInitialized) {
                throw new Error('Could not initialize Stripe');
            }
        }

        // Check if user is authenticated with Memberstack
        const memberstack = window.$memberstackDom;
        if (!memberstack) {
            throw new Error('Memberstack not initialized');
        }

        console.log('Checking Memberstack authentication...');
        const user = await memberstack.getCurrentMember();
        if (!user) {
            console.log('User not authenticated, redirecting to signup');
            window.location.href = '/signup';
            return;
        }
        console.log(' User authenticated:', user.email);

        const priceId = button.dataset.stripePriceId;
        if (!priceId) {
            throw new Error('No Stripe price ID found on button');
        }
        console.log('Price ID:', priceId);

        // Show loading state
        button.disabled = true;
        button.textContent = 'Creating checkout session...';
        
        const orderId = `order_${Date.now()}`;
        console.log('Order ID:', orderId);
        
        // Get the base URL for the API endpoint
        const baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8888/.netlify/functions'
            : '/.netlify/functions';
            
        console.log('Creating Stripe checkout session...');
        console.log('API Endpoint:', `${baseUrl}/create-checkout`);
        
        // Create Stripe Checkout Session
        const response = await fetch(`${baseUrl}/create-checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: priceId,
                quantity: state.quantity,
                metadata: {
                    order_id: orderId,
                    product_type: state.productType,
                    base_amount: state.basePrice * state.quantity,
                    memberstack_member_id: user.id,
                    memberstack_email: user.email,
                    shipping_country: state.shippingCountry || 'not_selected'
                }
            })
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error response:', errorData);
            throw new Error(`Server error: ${errorData.error || response.statusText}`);
        }

        const session = await response.json();
        console.log('Session created:', session);

        if (session.error) {
            throw new Error(`Checkout session error: ${session.error}`);
        }

        console.log(' Redirecting to Stripe checkout...');
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            throw new Error(`Stripe redirect error: ${result.error.message}`);
        }
    } catch (error) {
        console.error(' Checkout error:', error);
        alert(`Checkout error: ${error.message}`);
    } finally {
        // Reset button state
        button.disabled = false;
        button.textContent = 'Proceed to Checkout';
    }
}

// Initialize the script
async function init() {
    console.log(' Initializing shopping system...');

    try {
        // Initialize Stripe
        await initStripe();

        // Initialize product state
        const productElement = document.querySelector('.product');
        if (productElement) {
            state.productType = productElement.dataset.productType || 'book';
            state.basePrice = parseFloat(productElement.dataset.basePrice) || 29.99;
            console.log('Product state:', state);
        }

        // Set up quantity change listener
        const quantitySelect = document.getElementById('book-quantity');
        if (quantitySelect) {
            quantitySelect.addEventListener('change', function(e) {
                state.quantity = parseInt(e.target.value);
                console.log('Quantity updated:', state.quantity);
            });
        }

        // Initialize checkout buttons
        await initializeCheckoutButtons();
        
        console.log(' Shopping system initialized successfully');
    } catch (error) {
        console.error(' Initialization error:', error);
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
