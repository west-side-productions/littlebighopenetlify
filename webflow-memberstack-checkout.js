// Product configuration
const PRODUCT_CONFIG = {
    course: {
        prices: {
            de: 'price_1OPJNVJRMXFic4sWxHhqwsHj',
            en: 'price_1OPJNVJRMXFic4sWxHhqwsHj'
        }
    },
    book: {
        prices: {
            de: 'price_1OPJNVJRMXFic4sWxHhqwsHj',
            en: 'price_1OPJNVJRMXFic4sWxHhqwsHj'
        },
        requiresShipping: true
    }
};

// Initialize Stripe instance
let stripeInstance = null;

async function getStripeInstance() {
    if (!stripeInstance) {
        stripeInstance = Stripe('pk_test_51OPJLWJRMXFic4sWYxXBqPNOE8AzXAz4qYwzwJtGEIxV0KBYGe4HJZHjLKJEIWFXtxYeYKQQPvYBOtcYEJXzXlkC00Ys6JZhQF');
    }
    return stripeInstance;
}

// Helper function to get preferred language
async function getPreferredLanguage() {
    return 'de'; // Default to German for now
}

// Helper function to get customer email
async function getCustomerEmail() {
    try {
        const member = await $memberstackDom?.getCurrentMember();
        return member?.data?.email || '';
    } catch (error) {
        console.warn('Failed to get member email:', error);
        return '';
    }
}

// Initialize checkout buttons
function initializeCheckoutButtons() {
    console.log('=== Initializing checkout buttons ===');
    
    try {
        // First, let's log all buttons we find
        const allButtons = document.querySelectorAll('button');
        console.log('All buttons on page:', Array.from(allButtons).map(b => ({
            text: b.textContent.trim(),
            type: b.dataset.productType,
            classes: b.className
        })));

        // Now get our specific buttons
        const buttons = document.querySelectorAll('button.checkout-button');
        console.log('Found checkout buttons:', Array.from(buttons).map(b => ({
            text: b.textContent.trim(),
            type: b.dataset.productType,
            classes: b.className
        })));
        
        if (buttons.length === 0) {
            console.warn('No checkout buttons found on page');
            return;
        }

        // Remove any existing handlers
        buttons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });

        // Add click handlers
        buttons.forEach(button => {
            console.log('Setting up button:', {
                text: button.textContent.trim(),
                type: button.dataset.productType,
                classes: button.className
            });
            
            button.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                
                console.log('=== BUTTON CLICKED ===');
                console.log('Button details:', {
                    text: this.textContent.trim(),
                    type: this.dataset.productType,
                    classes: this.className
                });
                console.log('Event target:', event.target);
                console.log('Current target:', event.currentTarget);
                
                handleCheckout(event, this);
            });
        });

        console.log('=== Button initialization complete ===');

    } catch (error) {
        console.error('Error initializing checkout buttons:', error);
    }
}

// Handle checkout process
async function handleCheckout(event, button) {
    event.preventDefault();
    console.log('=== Starting Checkout Process ===');
    console.log('Button clicked:', {
        text: button.textContent.trim(),
        type: button.dataset.productType,
        classes: button.className
    });

    try {
        // Get product type from button
        const productType = button.dataset.productType;
        if (!productType) {
            throw new Error('No product type specified on button');
        }
        console.log('Product type:', productType);

        // Get customer email
        const customerEmail = await getCustomerEmail();
        if (!customerEmail) {
            throw new Error('Customer email is required');
        }

        // Get the product configuration
        const productConfig = PRODUCT_CONFIG[productType];
        if (!productConfig) {
            throw new Error(`Invalid product type: ${productType}`);
        }
        console.log('Product config:', productConfig);

        // Get shipping rate for physical products
        let shippingRateId = null;
        if (productConfig.requiresShipping) {
            const selectId = `shipping-rate-select-${productType}`;
            const shippingSelect = document.getElementById(selectId);
            if (!shippingSelect) {
                throw new Error('Shipping country selection is required for physical products');
            }
            shippingRateId = shippingSelect.value;
            console.log('Selected shipping rate:', shippingRateId);
        }

        // Create checkout config
        const checkoutConfig = {
            version: productType,
            type: productType,
            customerEmail: customerEmail,
            shippingRateId: shippingRateId,
            metadata: {
                version: productType,
                type: productType,
                language: 'de',
                source: window.location.pathname
            }
        };

        console.log('Starting checkout with config:', checkoutConfig);
        await startCheckout(checkoutConfig);

    } catch (error) {
        console.error('Checkout error:', error);
        alert('Sorry, there was a problem starting the checkout. Please try again or contact support if the problem persists.');
    }
}

// Initialize price elements
function initializePriceElements() {
    const priceElements = document.querySelectorAll('[data-price-element]');
    priceElements.forEach(element => {
        const priceType = element.dataset.priceElement;
        const productType = element.dataset.productType;
        
        if (priceType && productType) {
            updatePrice(element, priceType, productType);
        }
    });
}

// Update price display
function updatePrice(element, priceType, productType) {
    let price = 0;
    
    switch (priceType) {
        case 'subtotal':
            price = getSubtotalPrice(productType);
            break;
        case 'shipping':
            price = getShippingPrice(productType);
            break;
        case 'total':
            price = getTotalPrice(productType);
            break;
    }
    
    element.textContent = price.toFixed(2);
}

// Get subtotal price
function getSubtotalPrice(productType) {
    switch (productType) {
        case 'course':
            return 99.99;
        case 'book':
            return 29.99;
        default:
            return 0;
    }
}

// Get shipping price
function getShippingPrice(productType) {
    if (productType !== 'book') return 0;
    
    const select = document.getElementById(`shipping-rate-select-${productType}`);
    if (!select) return 0;
    
    switch (select.value) {
        case 'shr_1QScKFJRMXFic4sW9e80ABBp': // Austria
            return 7.28;
        case 'shr_1QScMXJRMXFic4sWih6q9v36': // Great Britain
            return 20.72;
        case 'shr_1QScNqJRMXFic4sW3NVUUckl': // Singapore
            return 36.53;
        case 'shr_1QScOlJRMXFic4sW8MHW0kq7': // European Union
            return 20.36;
        default:
            return 0;
    }
}

// Get total price
function getTotalPrice(productType) {
    return getSubtotalPrice(productType) + getShippingPrice(productType);
}

// Update shipping price when selection changes
function initializeShippingSelects() {
    const shippingSelects = document.querySelectorAll('select[id^="shipping-rate-select-"]');
    
    shippingSelects.forEach(select => {
        const productType = select.id.replace('shipping-rate-select-', '');
        
        select.addEventListener('change', () => {
            const shippingPriceElement = document.getElementById(`shipping-price-${productType}`);
            const totalPriceElement = document.getElementById(`total-price-${productType}`);
            
            if (shippingPriceElement) {
                updatePrice(shippingPriceElement, 'shipping', productType);
            }
            
            if (totalPriceElement) {
                updatePrice(totalPriceElement, 'total', productType);
            }
        });
    });
}

// Function to start checkout process
async function startCheckout(config) {
    try {
        console.log('Starting checkout process');
        
        // Get language for price selection
        const language = await getPreferredLanguage();
        
        // Get product configuration
        const productConfig = PRODUCT_CONFIG[config.type];
        if (!productConfig) {
            throw new Error(`Invalid product type: ${config.type}`);
        }
        
        // Get price ID for the current language
        const priceId = productConfig.prices[language] || productConfig.prices['de'];
        if (!priceId) {
            throw new Error(`No price found for language: ${language}`);
        }
        
        // Create checkout session
        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productType: config.type,
                priceId: priceId,
                language: language,
                memberEmail: config.customerEmail,
                shippingRateId: config.shippingRateId,
                metadata: config.metadata,
                successUrl: `${window.location.origin}/vielen-dank-email`,
                cancelUrl: `${window.location.origin}/produkte`
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Checkout session creation failed: ${errorData.error}`);
        }

        const { id: sessionId } = await response.json();
        console.log('Checkout session created:', { sessionId });

        if (!sessionId) {
            throw new Error('No session ID returned from server');
        }

        // Initialize Stripe if not already done
        const stripe = await getStripeInstance();
        if (!stripe) {
            throw new Error('Failed to initialize Stripe');
        }
        console.log('Using Stripe instance');

        // Redirect to Stripe checkout
        const { error } = await stripe.redirectToCheckout({ sessionId });

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        throw error;
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Initializing checkout system ===');
    initializeCheckoutButtons();
    initializePriceElements();
    initializeShippingSelects();
});