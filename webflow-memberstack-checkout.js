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
    // Memberstack 2.0 price ID (starts with prc_)
    priceId: 'prc_buch-tp2106tu',
    // Replace with your actual Stripe price ID (starts with price_)
    stripeProductId: 'price_1QRIZnJRMXFic4sWptbw8uuA',
    successUrl: `${window.location.origin}/success`,
    cancelUrl: `${window.location.origin}/cancel`,
    // Netlify Functions URL
    functionsUrl: 'https://lillebighopefunctions.netlify.app/.netlify/functions'
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

// Load Stripe.js script
async function loadStripeScript() {
    return new Promise((resolve, reject) => {
        if (document.querySelector('script[src*="stripe.com/v3"]')) {
            console.log('Stripe.js already loaded');
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => {
            console.log('Stripe.js loaded successfully');
            resolve();
        };
        script.onerror = (error) => {
            console.error('Failed to load Stripe.js:', error);
            reject(error);
        };
        document.head.appendChild(script);
    });
}

// Initialize Stripe
let stripe;
async function initStripe() {
    try {
        console.log('Initializing Stripe...');
        if (typeof Stripe === 'undefined') {
            throw new Error('Stripe.js not loaded');
        }
        stripe = Stripe('pk_live_51Q8eVRJRMXFic4sWxwFhvnHZqWNHhHyFVBwZFhTzAZZGwWXhK4zNNAvBKcZqYHoFpBQZnQeRcTa8kHPNvwEcGlDN00aDqtGSFh');
        console.log('Stripe initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Stripe:', error);
        throw error;
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

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    console.log('Setting up checkout buttons...');
    
    // Target buttons with Memberstack 2.0 attributes
    const checkoutButtons = document.querySelectorAll('#checkoutButton.ms-button');
    console.log('Found checkout buttons:', checkoutButtons.length);
    
    // Set up quantity change handler
    const quantitySelect = document.getElementById('book-quantity');
    if (quantitySelect) {
        quantitySelect.addEventListener('change', (e) => {
            const quantity = parseInt(e.target.value);
            const basePrice = parseFloat(document.querySelector('[data-product-type="book"]').getAttribute('data-base-price'));
            const subtotal = (basePrice * quantity).toFixed(2);
            
            // Update price displays
            document.getElementById('subtotal-price').textContent = subtotal;
            document.getElementById('total-price').textContent = subtotal;
            
            // Update checkout button text
            const button = document.getElementById('checkoutButton');
            if (button) {
                button.textContent = `Proceed to Checkout (€${subtotal})`;
            }
        });
    }
    
    checkoutButtons.forEach(button => {
        // Remove any existing click handlers
        const oldHandler = button.onclick;
        button.onclick = null;
        
        // Add our new click handler
        button.onclick = async (e) => {
            e.preventDefault();
            console.log('Checkout button clicked');
            
            try {
                // Get current member
                const member = await memberstackDom.getCurrentMember();
                if (!member) {
                    console.log('No member found, redirecting to registration');
                    window.location.href = '/registrieren';
                    return;
                }
                
                // Get quantity
                const quantity = parseInt(document.getElementById('book-quantity')?.value || '1');
                
                // Store quantity in button for checkout handler
                button.setAttribute('data-quantity', quantity.toString());
                
                await handleCheckout(button, member);
            } catch (error) {
                console.error('Error in checkout button handler:', error);
                alert('An error occurred. Please try again or contact support if the problem persists.');
            }
        };
    });
    
    console.log('Checkout buttons initialized');
}

async function handleCheckout(button, member) {
    try {
        const memberId = member.id;
        const contentId = button.getAttribute('data-memberstack-content-id') || button.getAttribute('data-ms-content');
        const quantity = parseInt(button.getAttribute('data-quantity') || '1');
        const customerEmail = member.data?.auth?.email;

        if (!customerEmail) {
            console.error('No email found in member data');
            throw new Error('No email found in member data');
        }

        if (!contentId) {
            console.error('No content ID found on button');
            throw new Error('Missing content ID configuration');
        }

        console.log('Debug - Button attributes:', {
            contentId,
            quantity,
            allAttributes: Array.from(button.attributes).map(attr => `${attr.name}=${attr.value}`).join(', '),
            innerHTML: button.innerHTML
        });

        // Get the product configuration and price ID based on the content ID
        const productConfig = {
            'prc_buch-tp2106tu': {
                priceId: 'price_1QRN3aJRMXFic4sWBBilYzAc',
                weight: 1000,
                packagingWeight: 50
            },
            'prc_online-kochkurs-8b540kc2': {
                priceId: 'price_1Q8fMCJRMXFic4sWGYGdz1TS',
                weight: 1000,
                packagingWeight: 50
            }
        };

        const config = productConfig[contentId];
        if (!config) {
            console.error('Product configuration not found for contentId:', contentId);
            console.log('Available configurations:', Object.keys(productConfig));
            throw new Error('Invalid product configuration');
        }

        console.log('Starting checkout process:', {
            memberId,
            contentId,
            priceId: config.priceId,
            quantity,
            customerEmail,
            config
        });

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
        console.error('Checkout error:', error);
        alert('An error occurred during checkout. Please try again.');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing shopping system...');
    
    // Wait for Memberstack initialization
    await initializeMemberstack();
    
    // Initialize Stripe
    await loadStripeScript();
    await initStripe();
    
    // Initialize checkout buttons
    initializeCheckoutButtons();
    console.log('Checkout buttons initialized');
});
