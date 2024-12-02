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
    stripePublicKey: 'pk_test_51Q4ix1JRMXFic4sW5em3IMoFbubNwBdzj4F5tUzStHExi3T245BrPLYu0SG1uWLSrd736NDy0V4dx10ZN4WFJD2a00pAzHlDw8',
    stripePriceId: 'price_1QRN3aJRMXFic4sWBBilYzAc', // Add your actual test price ID here
    debug: true,
    // For local development, use localhost. For production, use relative URL
    baseUrl: window.location.hostname === 'localhost' ? 'http://localhost:8888' : '',
    // For testing with Netlify Dev
    isLocalDev: window.location.hostname === 'localhost' || window.location.hostname.includes('192.168.') || window.location.hostname.includes('.local')
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
    
    // Wait for Memberstack to be ready
    if (!window.$memberstackDom) {
        log('Waiting for Memberstack to initialize...');
        await new Promise(resolve => {
            const checkMemberstack = setInterval(() => {
                if (window.$memberstackDom) {
                    clearInterval(checkMemberstack);
                    resolve();
                }
            }, 100);
        });
    }
    
    log('Memberstack initialized');
    
    // Load Stripe.js if not already loaded
    if (!window.Stripe) {
        await loadScript('https://js.stripe.com/v3/');
        if (!window.Stripe) {
            throw new Error('Failed to load Stripe.js');
        }
    }
    
    // Initialize Stripe
    try {
        const stripe = Stripe(CONFIG.stripePublicKey);
        log('Stripe initialized with test key');
        return { stripe };
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        throw error;
    }
}

// Initialize checkout button
async function initializeCheckoutButton() {
    console.log('Setting up checkout button...');
    
    // Find all checkout buttons
    const checkoutButtons = document.querySelectorAll('[data-checkout-button]');
    if (checkoutButtons.length === 0) {
        console.error('No checkout buttons found on page');
        return;
    }
    
    // Set up click handler for each button
    checkoutButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            console.log('Checkout button clicked');
            await handleCheckout(event);
        });
    });
    
    console.log('Checkout button initialized');
}

// Get the base URL for API endpoints
function getBaseUrl() {
    const hostname = window.location.hostname;
    console.log('Current hostname:', hostname);
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8888';
    } else {
        // For production, use the dedicated functions domain
        return 'https://lillebighopefunctions.netlify.app';
    }
}

async function handleCheckout(event) {
    if (event) {
        event.preventDefault();
    }
    const button = event?.target;
    if (button) {
        button.disabled = true;
        button.textContent = 'Processing...';
    }
    
    try {
        // Get current member using Memberstack DOM API
        const member = await window.$memberstackDom.getCurrentMember();
        
        // Debug log to see member structure
        console.log('Member object:', JSON.stringify(member, null, 2));
        
        // If user is not logged in, redirect to registration
        if (!member || !member.data) {
            console.log('User not logged in, redirecting to registration');
            // Store return URL in localStorage
            localStorage.setItem('checkoutReturnUrl', window.location.href);
            // Redirect to registration page
            window.location.href = '/registrieren';
            return;
        }
        
        // Extract email from member data
        const customerEmail = member.data.auth?.email;
        
        if (!customerEmail) {
            console.log('No email found in member object');
            throw new Error('User email is required for checkout');
        }
        
        // Get customer name from custom fields
        const firstName = member.data.customFields?.['first-name'] || '';
        const lastName = member.data.customFields?.['last-name'] || '';
        const customerName = `${firstName} ${lastName}`.trim();
        
        // Prepare checkout data
        const checkoutData = {
            priceId: CONFIG.stripePriceId,
            quantity: parseInt(document.getElementById('book-quantity')?.value || '1'),
            successUrl: `${window.location.origin}/vielen-dank-email`,
            cancelUrl: `${window.location.origin}/produkte`,
            customerEmail: customerEmail,
            metadata: {
                memberstackUserId: member.data.id || '',
                source: 'webflow_checkout'
            },
            shipping: {
                name: customerName,
                address: {
                    country: document.querySelector('[name="shipping-country"]')?.value || 'AT'
                }
            },
            locale: 'de',
            allow_promotion_codes: true
        };

        // Validate required fields
        if (!checkoutData.customerEmail) {
            throw new Error('User email is required for checkout');
        }

        console.log('Starting checkout process:', checkoutData);
        
        // Get the base URL for the API endpoint
        const baseUrl = getBaseUrl();
        const endpointUrl = `${baseUrl}/.netlify/functions/create-checkout-session`;
        
        console.log('Calling checkout endpoint:', endpointUrl);

        // Make the API call
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(checkoutData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Checkout failed: ${errorData.message || response.statusText}`);
        }

        const session = await response.json();
        console.log('Checkout session created:', session);
        
        try {
            // Initialize Stripe with the correct test key
            const stripe = Stripe(CONFIG.stripePublicKey);
            
            if (!session.sessionId) {
                throw new Error('No session ID returned from server');
            }
            
            // Redirect to checkout
            const { error } = await stripe.redirectToCheckout({
                sessionId: session.sessionId
            });
            
            if (error) {
                console.error('Stripe redirect error:', error);
                throw error;
            }
        } catch (error) {
            console.error('Stripe initialization/redirect error:', error);
            throw error;
        }

    } catch (error) {
        console.error('Checkout error:', error);
        if (button) {
            button.disabled = false;
            button.textContent = 'Buy Now';
        }
        alert('Sorry, there was a problem starting the checkout process. Please try again.');
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
        
        // Different behavior based on current page
        const currentPath = window.location.pathname;
        
        if (currentPath === '/membershome') {
            console.log('On membershome page, checking for pending checkout');
            // Check if we need to redirect back to product page
            const returnUrl = localStorage.getItem('checkoutReturnUrl');
            const member = await window.$memberstackDom.getCurrentMember();
            
            if (returnUrl && member?.data?.auth?.email) {
                console.log('Found return URL and member is logged in');
                localStorage.removeItem('checkoutReturnUrl');
                
                // Extract the base URL without any parameters
                const baseUrl = returnUrl.split('?')[0];
                
                // Create checkout session directly from membershome
                const checkoutData = {
                    priceId: CONFIG.stripePriceId,
                    quantity: 1,
                    successUrl: `${window.location.origin}/success`,
                    cancelUrl: `${window.location.origin}/cancel`,
                    customerEmail: member.data.auth.email,
                    metadata: {
                        memberstackUserId: member.data.id || '',
                        source: 'webflow_checkout'
                    },
                    shipping: {
                        name: `${member.data.customFields?.['first-name'] || ''} ${member.data.customFields?.['last-name'] || ''}`.trim(),
                        address: {
                            country: 'AT'
                        }
                    },
                    locale: 'de',
                    allow_promotion_codes: true
                };
                
                try {
                    console.log('Creating checkout session from membershome');
                    // Get the base URL for the API endpoint
                    const baseUrl = getBaseUrl();
                    const endpointUrl = `${baseUrl}/.netlify/functions/create-checkout-session`;
                    
                    const response = await fetch(endpointUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(checkoutData)
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(`Checkout failed: ${errorData.message || response.statusText}`);
                    }
                    
                    const session = await response.json();
                    console.log('Checkout session created:', session);
                    
                    // Initialize Stripe and redirect
                    const stripe = Stripe(CONFIG.stripePublicKey);
                    const { error } = await stripe.redirectToCheckout({
                        sessionId: session.sessionId
                    });
                    
                    if (error) {
                        console.error('Stripe redirect error:', error);
                        throw error;
                    }
                } catch (error) {
                    console.error('Error starting checkout:', error);
                    // If there's an error, redirect back to product page
                    window.location.href = baseUrl;
                }
            }
        } else if (currentPath.includes('products-test')) {
            console.log('On product page, initializing checkout');
            await initializeCheckoutButton();
            
            // Set up quantity change handler
            const quantitySelect = document.getElementById('book-quantity');
            if (quantitySelect) {
                quantitySelect.addEventListener('change', updatePriceDisplay);
                updatePriceDisplay();
            }
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
