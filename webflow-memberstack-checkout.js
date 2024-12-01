// Unified Shipping Calculator and Checkout for Webflow + Stripe

// Configuration
const SHIPPING_RATES = {
    AT: { price: 5, label: "Austria (€5)" },
    DE: { price: 10, label: "Germany (€10)" },
    EU: { price: 10, label: "Europe (€10)" },
    INT: { price: 15, label: "International (€15)" }
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
    quantity: 1
};

// Initialize Stripe
let stripe;
async function initStripe() {
    try {
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
        const checkoutButtons = document.querySelectorAll('[data-stripe-price-id]');
        checkoutButtons.forEach(button => {
            button.addEventListener('click', handleCheckout);
        });
        console.log('Checkout buttons initialized');
    } catch (error) {
        console.error('Error initializing checkout buttons:', error);
    }
}

// Update price display
function updatePriceDisplay() {
    const subtotal = state.basePrice * state.quantity;
    
    const subtotalElement = document.getElementById('subtotal-price');
    const totalElement = document.getElementById('total-price');
    
    if (subtotalElement) subtotalElement.textContent = subtotal.toFixed(2);
    if (totalElement) totalElement.textContent = subtotal.toFixed(2);
}

// Handle checkout button click
async function handleCheckout(e) {
    e.preventDefault();
    console.log('Checkout initiated');
    
    try {
        // Check if Stripe is initialized
        if (!stripe) {
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

        const user = await memberstack.getCurrentMember();
        if (!user) {
            console.log('User not authenticated, redirecting to signup');
            window.location.href = '/signup';
            return;
        }

        const button = e.currentTarget;
        const priceId = button.dataset.stripePriceId;
        
        if (!priceId) {
            throw new Error('No Stripe price ID found on button');
        }

        console.log('Creating checkout session with price ID:', priceId);
        
        const orderId = `order_${Date.now()}`;
        
        // Create Stripe Checkout Session
        const response = await fetch('/.netlify/functions/create-checkout', {
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
                    memberstack_email: user.email
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Server error: ${errorData.error || response.statusText}`);
        }

        const session = await response.json();

        if (session.error) {
            throw new Error(`Checkout session error: ${session.error}`);
        }

        console.log('Redirecting to Stripe checkout...');
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            throw new Error(`Stripe redirect error: ${result.error.message}`);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert(`Checkout error: ${error.message}`);
    }
}

// Initialize the script
async function init() {
    console.log('Initializing shopping system...');

    try {
        // Initialize Stripe
        await initStripe();

        // Initialize product state
        const productElement = document.querySelector('.product');
        if (productElement) {
            state.productType = productElement.dataset.productType || 'book';
            state.basePrice = parseFloat(productElement.dataset.basePrice) || 29.99;
            updatePriceDisplay();
        }

        // Set up quantity change listener
        const quantitySelect = document.getElementById('book-quantity');
        if (quantitySelect) {
            quantitySelect.addEventListener('change', function(e) {
                state.quantity = parseInt(e.target.value);
                updatePriceDisplay();
            });
        }

        // Initialize checkout buttons
        await initializeCheckoutButtons();
        
        console.log('Shopping system initialized successfully');
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
