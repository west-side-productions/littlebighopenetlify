// Unified Shipping Calculator and Checkout for Webflow + Memberstack 2.0

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

// Wait for Memberstack 2.0
function waitForMemberstack(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();

        function checkMemberstack() {
            if (window.$memberstackDom) {
                console.log('Memberstack found');
                resolve(window.$memberstackDom);
            } else if (Date.now() - start > timeout) {
                reject(new Error('Memberstack initialization timeout'));
            } else {
                setTimeout(checkMemberstack, 100);
            }
        }

        checkMemberstack();
    });
}

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    try {
        const memberstack = await waitForMemberstack();
        console.log('Memberstack initialized');

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
        const button = e.currentTarget;
        const priceId = button.dataset.msPriceAdd;
        
        if (!priceId) {
            console.error('No price ID found on button');
            return;
        }

        console.log('Price ID:', priceId);
        
        const orderId = `order_${Date.now()}`;
        const metadata = {
            quantity: state.quantity,
            product_type: state.productType,
            requires_shipping: true,
            order_id: orderId,
            base_amount: state.basePrice * state.quantity
        };

        console.log('Opening checkout with metadata:', metadata);

        const memberstack = await waitForMemberstack();
        const checkoutOptions = {
            priceId: priceId,
            metadata: metadata,
            quantity: state.quantity,
            successUrl: `${window.location.origin}/order-confirmation?order_id=${orderId}`,
            cancelUrl: window.location.href,
            mode: "payment",
            allowPromotionCodes: true,
            billingAddressCollection: 'required',
            shippingAddressCollection: {
                allowedCountries: ['AT', 'DE', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
            }
        };

        console.log('Checkout options:', checkoutOptions);

        try {
            const result = await memberstack.openModal("CHECKOUT", checkoutOptions);
            console.log('Checkout result:', result);

            if (result.success) {
                console.log('Checkout completed successfully');
                console.log('Payment Intent ID:', result.data?.paymentIntentId);
                console.log('Customer ID:', result.data?.customerId);
            }
        } catch (checkoutError) {
            console.error('Checkout error:', checkoutError);
            if (checkoutError.message.includes('not initialized')) {
                console.log('Retrying checkout after reinitialization...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                const reinitResult = await memberstack.openModal("CHECKOUT", checkoutOptions);
                console.log('Retry result:', reinitResult);
            }
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

        // Initialize checkout buttons after Memberstack is loaded
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
