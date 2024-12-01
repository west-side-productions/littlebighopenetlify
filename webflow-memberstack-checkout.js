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

// Load Stripe
let stripe;
loadStripe();

async function loadStripe() {
    try {
        stripe = await Stripe('your_publishable_key'); // Replace with your Stripe publishable key
    } catch (error) {
        console.error('Error loading Stripe:', error);
    }
}

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    try {
        const checkoutButtons = document.querySelectorAll('[data-ms-price-add]');
        checkoutButtons.forEach(button => {
            button.addEventListener('click', handleCheckout);
        });
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
        // Check if user is authenticated with Memberstack
        const memberstack = window.$memberstackDom;
        const user = await memberstack.getCurrentMember();
        
        if (!user) {
            console.log('User not authenticated, redirecting to signup');
            window.location.href = '/signup'; // Replace with your signup page URL
            return;
        }

        const button = e.currentTarget;
        const priceId = button.dataset.msPriceAdd;
        
        if (!priceId) {
            console.error('No price ID found on button');
            return;
        }

        console.log('Price ID:', priceId);
        
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

        const session = await response.json();

        if (session.error) {
            console.error('Error creating checkout session:', session.error);
            return;
        }

        // Redirect to Stripe Checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            console.error('Checkout error:', result.error);
        }
    } catch (error) {
        console.error('Error during checkout process:', error);
    }
}

// Initialize the script
async function init() {
    console.log('SHIPPING CALCULATOR INITIALIZED');
    console.log('Current page:', window.location.href);
    console.log('Page loaded');

    try {
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
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
