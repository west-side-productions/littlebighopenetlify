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
    stripeProductId: 'price_1QRIZnJRMXFic4sWptbw8uuA',  // TODO: Replace with your actual Stripe price ID
    successUrl: `${window.location.origin}/success`,
    cancelUrl: `${window.location.origin}/cancel`
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

// Handle checkout button click
async function handleCheckout(e) {
    e.preventDefault();
    
    try {
        // Initialize Stripe first
        if (!stripe) {
            const stripeInitialized = await initStripe();
            if (!stripeInitialized) {
                throw new Error('Stripe not initialized');
            }
        }

        // Check authentication with Memberstack
        const memberstack = await initializeMemberstack();
        if (!memberstack) {
            throw new Error('Memberstack not initialized');
        }

        const member = await memberstack.getCurrentMember();
        console.log('Current member:', member);
        console.log('Full member object:', JSON.stringify(member, null, 2));
        
        if (!member) {
            console.log('User not authenticated, redirecting to login');
            await memberstack.openModal('login');
            return;
        }

        const customerEmail = member.data?.auth?.email;
        if (!customerEmail) {
            console.error('No email found in member data');
            throw new Error('No email found in member data');
        }

        console.log('Starting Stripe checkout...');
        console.log('Customer email:', customerEmail);
        
        // Create Stripe Checkout Session using Netlify function
        const NETLIFY_DOMAIN = 'https://lillebighopefunctions.netlify.app';  
        const checkoutEndpoint = `${NETLIFY_DOMAIN}/.netlify/functions/create-checkout-session`;
        console.log('Calling checkout endpoint:', checkoutEndpoint);

        const response = await fetch(checkoutEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: CONFIG.stripeProductId,
                successUrl: CONFIG.successUrl,
                cancelUrl: CONFIG.cancelUrl,
                customerEmail,
                shipping: {
                    allowedCountries: ['AT', 'DE', 'CH'],
                    collectShippingAddress: true
                },
                metadata: {
                    memberstackUserId: member.data?.id,
                    memberstackPlanId: CONFIG.priceId
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Checkout session creation failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(`Failed to create checkout session: ${response.status}`);
        }

        const session = await response.json();
        
        if (session.url) {
            // Redirect to Stripe's hosted checkout page
            window.location.href = session.url;
        } else {
            throw new Error('No checkout URL received');
        }
        
    } catch (error) {
        console.error('Checkout error:', { message: error.message, error });
        // Show error to user
        if (memberstackDom) {
            memberstackDom._showMessage({ 
                type: 'error',
                title: 'Checkout Error',
                text: 'There was a problem starting the checkout. Please try again.'
            });
        }
    }
}

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    console.log('Setting up checkout buttons...');
    // Target both checkout buttons
    const checkoutButtons = document.querySelectorAll('#checkoutButton, button.checkout-button');
    console.log('Found checkout buttons:', checkoutButtons.length);
    
    checkoutButtons.forEach(button => {
        // Remove any existing click handlers
        button.removeEventListener('click', handleCheckout);
        // Add our new click handler
        button.addEventListener('click', handleCheckout);
    });
    
    console.log('Checkout buttons initialized');
}

// Update checkout flow to handle non-logged-in users
document.addEventListener('DOMContentLoaded', async function() {
    const buyButtons = document.querySelectorAll('[data-ms-buy]');
    if (!buyButtons.length) return;

    // Store checkout intent in sessionStorage when a buy button is clicked
    buyButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Store checkout information in sessionStorage
            sessionStorage.setItem('checkoutIntent', JSON.stringify({
                productId: button.getAttribute('data-ms-buy'),
                returnUrl: window.location.href
            }));

            // Check if user is logged in
            const member = await window.$memberstackDom.getCurrentMember();
            
            if (!member) {
                // Redirect to registration page if not logged in
                window.location.href = '/registrieren';
                return;
            }

            // If logged in, proceed with checkout
            await handleCheckout(button, member);
        });
    });

    // Check for returning user after registration
    const checkoutIntent = sessionStorage.getItem('checkoutIntent');
    if (checkoutIntent) {
        const member = await window.$memberstackDom.getCurrentMember();
        if (member) {
            // Parse stored checkout information
            const { productId, returnUrl } = JSON.parse(checkoutIntent);
            
            // Find the corresponding button
            const button = document.querySelector(`[data-ms-buy="${productId}"]`);
            
            if (button) {
                // Clear the stored intent
                sessionStorage.removeItem('checkoutIntent');
                
                // Proceed with checkout
                await handleCheckout(button, member);
            }
        }
    }
});

async function handleCheckout(button, member) {
    try {
        const memberId = member.id;
        const planId = button.getAttribute('data-ms-buy');

        console.log('Starting checkout process:', {
            memberId,
            planId
        });

        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                memberstackUserId: memberId,
                memberstackPlanId: planId
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Error creating checkout session:', errorData);
            throw new Error('Failed to create checkout session');
        }

        const { sessionId } = await response.json();
        const stripe = Stripe('pk_test_51OQvSBFrPAUGZiHgcDMPtPECPPEYBhYQBOTJYxnHKQpWtNKkQtwhZlrxXmQGWsAHJqQXrJCPBQZGFBXDGJHEBWEY00zLQjPaXS');
        
        const { error } = await stripe.redirectToCheckout({
            sessionId
        });

        if (error) {
            console.error('Stripe checkout error:', error);
            throw new Error(error.message);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('An error occurred during checkout. Please try again.');
    }
}
