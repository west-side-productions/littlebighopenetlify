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
    debug: true
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
    log('Initializing shopping system...');

    // Initialize Stripe
    if (!window.Stripe) {
        log('Loading Stripe.js...');
        await loadScript('https://js.stripe.com/v3/');
    } else {
        log('Stripe.js already loaded');
    }

    log('Initializing Stripe...');
    window.stripe = Stripe(CONFIG.stripePublicKey);
    log('Stripe initialized successfully');

    // Initialize Memberstack
    if (!window.$memberstackDom) {
        log('Loading Memberstack...');
        await loadScript('https://cdn.memberstack.com/js/v2');
    }

    const memberstack = window.$memberstackDom;
    log('Available Memberstack methods:', Object.keys(memberstack));
    log('Memberstack initialized:', memberstack);

    return { stripe: window.stripe, memberstack };
}

// Initialize checkout button
async function initializeCheckoutButton() {
    log('Setting up checkout button...');
    const button = document.querySelector('.checkout-button');
    
    if (!button) {
        console.error('No checkout button found');
        return;
    }

    const memberstack = window.$memberstackDom;
    if (!memberstack) {
        console.error('Memberstack not initialized');
        return;
    }

    button.addEventListener('click', async (event) => {
        event.preventDefault();
        const member = await memberstack.getCurrentMember();
        
        if (!member) {
            log('User not logged in, redirecting to login');
            await memberstack.openModal('login');
            return;
        }

        try {
            await handleCheckout(button, member);
        } catch (error) {
            console.error('Error during checkout:', error);
            alert('An error occurred during checkout. Please try again.');
        }
    });

    log('Checkout button initialized');
}

// Handle checkout process
async function handleCheckout(button, member) {
    try {
        const memberId = member?.id;
        const contentId = 'prc_buch-tp2106tu'; // Hardcoded for now since it's our only product
        const quantity = parseInt(document.getElementById('book-quantity')?.value || '1');
        const customerEmail = member?.data?.auth?.email;

        if (!customerEmail) {
            console.error('No email found in member data');
            throw new Error('No email found in member data');
        }

        // Get the product configuration and price ID based on the content ID
        const productConfig = {
            'prc_buch-tp2106tu': {
                priceId: 'price_1QRN3aJRMXFic4sWBBilYzAc',
                weight: 1000,
                packagingWeight: 50
            }
        };

        const config = productConfig[contentId];
        if (!config) {
            console.error('Product configuration not found for contentId:', contentId);
            throw new Error('Invalid product configuration');
        }

        log('Starting checkout process:', {
            memberId,
            contentId,
            quantity,
            priceId: config.priceId,
            customerEmail,
            config
        });

        // Disable the button and show loading state
        button.disabled = true;
        button.textContent = 'Loading...';

        try {
            const response = await fetch(`${CONFIG.functionsUrl}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    priceId: config.priceId,
                    quantity: quantity,
                    successUrl: `${window.location.origin}/success`,
                    cancelUrl: `${window.location.origin}/cancel`,
                    customerEmail: customerEmail,
                    shipping: {
                        weight: config.weight * quantity,
                        packagingWeight: config.packagingWeight
                    },
                    metadata: {
                        memberstackUserId: memberId,
                        memberstackPlanId: contentId,
                        quantity: quantity.toString()
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Error creating checkout session:', errorData);
                throw new Error('Failed to create checkout session');
            }

            const { url } = await response.json();
            if (!url) {
                throw new Error('No checkout URL returned');
            }

            // Redirect to Stripe Checkout
            window.location.href = url;
        } catch (error) {
            throw error;
        } finally {
            // Re-enable the button and restore text
            button.disabled = false;
            button.textContent = 'Buy Now';
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('An error occurred during checkout. Please try again.');
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
