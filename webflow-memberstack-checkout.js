// Unified Shipping Calculator and Checkout for Webflow + Stripe

// Configuration
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { price: 7.28, label: 'Österreich', country: 'AT' },
    'shr_1QScMXJRMXFic4sWih6q9v36': { price: 20.72, label: 'Großbritannien', country: 'GB' },
    'shr_1QScNqJRMXFic4sW3NVUUckl': { price: 36.53, label: 'Singapur', country: 'SG' },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { price: 20.36, label: 'EU', country: 'EU' }
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
    memberstackPlanId: 'prc_online-kochkurs-8b540kc2',
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
    event.preventDefault();
    
    try {
        const member = await window.$memberstackDom.getCurrentMember();
        if (!member) {
            throw new Error('No member found');
        }

        // Get metadata
        const metadata = {
            memberstackUserId: member.data.id,
            planId: CONFIG.memberstackPlanId,
            totalWeight: '1000',
            productWeight: '900',
            packagingWeight: '100'
        };

        console.log('Checkout metadata:', metadata);

        // Create checkout session
        const response = await fetch(`${getBaseUrl()}${CONFIG.functionsUrl}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: CONFIG.stripePriceId,
                successUrl: `${window.location.origin}/vielen-dank-email`,
                cancelUrl: `${window.location.origin}/produkte`,
                metadata: metadata,
                customerEmail: member.data.auth.email
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to create checkout session: ${errorData.message || response.statusText}`);
        }

        const { sessionId } = await response.json();
        const stripe = window.Stripe(CONFIG.stripePublicKey);
        
        console.log('Redirecting to Stripe with sessionId:', sessionId);
        
        // Redirect to Stripe Checkout
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
            throw error;
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

// Update price display with shipping
function updateTotalPrice(basePrice, shippingRateId) {
    const shipping = SHIPPING_RATES[shippingRateId];
    if (!shipping) return;

    const total = basePrice + shipping.price;
    const priceElement = document.querySelector('.product-price');
    if (priceElement) {
        priceElement.textContent = `€${total.toFixed(2)}`;
    }
}

// Initialize shipping rate selection
const basePrice = 49; // Base product price

// Find the shipping select element
const shippingSelect = document.getElementById('shipping-rate-select');
if (shippingSelect) {
    // Add change event listener
    shippingSelect.addEventListener('change', (e) => {
        updateTotalPrice(basePrice, e.target.value);
    });

    // Initialize with current selection or Austria as default
    const initialShippingRate = shippingSelect.value || 'shr_1QScKFJRMXFic4sW9e80ABBp';
    updateTotalPrice(basePrice, initialShippingRate);
}

// Wait for Memberstack to be available
function waitForMemberstack(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        function checkMemberstack() {
            if (window.$memberstackDom) {
                resolve(window.$memberstackDom);
                return;
            }

            if (Date.now() - startTime > timeout) {
                reject(new Error('Memberstack timeout'));
                return;
            }

            setTimeout(checkMemberstack, 100);
        }

        checkMemberstack();
    });
}

// Load Stripe.js
function loadStripe() {
    return new Promise((resolve, reject) => {
        try {
            if (window.Stripe) {
                console.log('Using existing Stripe instance');
                const stripe = window.Stripe('pk_test_51NxsqFJRMXFic4sWqoKfwlsqGhZXVTRXBKWsZpLWCVXHJEPvFGZGYPTQZIzZqPRqHPDlkRFEAcNvkjVIQIrLVPNh00CqUxcRKG', {
                    betas: ['shipping_rate_checkout_beta_1']
                });
                resolve(stripe);
                return;
            }

            console.log('Loading Stripe script');
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = () => {
                console.log('Stripe script loaded, initializing...');
                try {
                    const stripe = window.Stripe('pk_test_51NxsqFJRMXFic4sWqoKfwlsqGhZXVTRXBKWsZpLWCVXHJEPvFGZGYPTQZIzZqPRqHPDlkRFEAcNvkjVIQIrLVPNh00CqUxcRKG', {
                        betas: ['shipping_rate_checkout_beta_1']
                    });
                    console.log('Stripe initialized successfully');
                    resolve(stripe);
                } catch (error) {
                    console.error('Error initializing Stripe:', error);
                    reject(error);
                }
            };
            script.onerror = (error) => {
                console.error('Failed to load Stripe script:', error);
                reject(new Error('Failed to load Stripe.js'));
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Error in loadStripe:', error);
            reject(error);
        }
    });
}

// Shipping rate to country mapping
const SHIPPING_RATE_COUNTRIES = {
    'shr_1QScOlJRMXFic4sW8MHW0kq7': ['AT', 'DE'], // Austria & Germany rate
    'shr_1QScNqJRMXFic4sW3NVUUckl': ['SG']  // Singapore rate
};

// Get all allowed countries from shipping rates
const getAllowedCountries = () => {
    const countries = new Set();
    Object.values(SHIPPING_RATE_COUNTRIES).forEach(countryList => {
        countryList.forEach(country => countries.add(country));
    });
    return Array.from(countries);
};

// Get shipping rate for country
const getShippingRateForCountry = (country) => {
    for (const [rateId, countries] of Object.entries(SHIPPING_RATE_COUNTRIES)) {
        if (countries.includes(country)) {
            return rateId;
        }
    }
    return null;
};

// Update shipping rate based on selected country
function updateShippingRate(country) {
    const rateId = getShippingRateForCountry(country);
    if (rateId && shippingSelect) {
        shippingSelect.value = rateId;
        const event = new Event('change');
        shippingSelect.dispatchEvent(event);
    }
}

// Initialize the system
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for both Memberstack and Stripe to be ready
        const [memberstack, stripe] = await Promise.all([
            waitForMemberstack(),
            loadStripe()
        ]);
        console.log('Memberstack and Stripe loaded');

        // Find elements
        const checkoutButton = document.querySelector('[data-checkout-button]');
        const shippingSelect = document.getElementById('shipping-rate-select');
        const subtotalElement = document.getElementById('subtotal-price');
        const totalElement = document.getElementById('total-price');
        const productElement = document.querySelector('.product');

        if (!checkoutButton || !shippingSelect || !subtotalElement || !totalElement || !productElement) {
            console.error('Required elements not found');
            return;
        }

        // Get base price from product data attribute
        const basePrice = parseFloat(productElement.dataset.basePrice) || 49;
        console.log('Base price:', basePrice);

        // Update price display with shipping
        function updatePriceDisplay(shippingRateId) {
            const shipping = SHIPPING_RATES[shippingRateId];
            if (!shipping) {
                console.error('Shipping rate not found:', shippingRateId);
                return;
            }

            // Format subtotal
            subtotalElement.textContent = basePrice.toFixed(2);

            // Calculate and format total
            const total = basePrice + shipping.price;
            totalElement.textContent = total.toFixed(2);
            
            // Update checkout button text
            checkoutButton.textContent = `Jetzt Kaufen (€${total.toFixed(2)})`;

            console.log('Price updated:', {
                basePrice: basePrice,
                shippingPrice: shipping.price,
                total: total
            });
        }

        // Handle shipping selection change
        shippingSelect.addEventListener('change', (e) => {
            console.log('Shipping selection changed:', e.target.value);
            updatePriceDisplay(e.target.value);
        });

        // Initialize with first shipping option
        console.log('Initial shipping rate:', shippingSelect.value);
        updatePriceDisplay(shippingSelect.value);

        // Handle checkout button click
        checkoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                const member = await memberstack.getCurrentMember();
                if (!member) {
                    alert('Bitte melden Sie sich an, um fortzufahren.');
                    return;
                }
                const customerEmail = member.data.auth.email;
                const memberstackUserId = member.data.id;
                
                // Get selected shipping rate
                const selectedShippingRate = shippingSelect.value;
                if (!selectedShippingRate) {
                    alert('Bitte wählen Sie eine Versandoption aus');
                    return;
                }

                console.log('Creating checkout session with shipping rate:', selectedShippingRate);
                
                const functionUrl = 'https://lillebighopefunctions.netlify.app/.netlify/functions/create-checkout-session';
                console.log('Calling function URL:', functionUrl);
                
                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        priceId: 'price_1QRN3aJRMXFic4sWBBilYzAc',
                        customerEmail: customerEmail,
                        shippingRateId: selectedShippingRate,
                        successUrl: 'https://www.littlebighope.com/vielen-dank-email',
                        cancelUrl: 'https://www.littlebighope.com/produkte',
                        metadata: {
                            memberstackUserId: memberstackUserId,
                            planId: 'prc_online-kochkurs-8b540kc2',
                            totalWeight: '1000',
                            productWeight: '900',
                            packagingWeight: '100'
                        }
                    })
                });

                console.log('Response status:', response.status);
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server response error:', errorText);
                    throw new Error(`Failed to create checkout session: ${errorText}`);
                }

                const session = await response.json();
                console.log('Received session:', session);
                
                if (!session || (!session.sessionId && !session.url)) {
                    console.error('Invalid session data:', session);
                    throw new Error('Invalid session data received from server');
                }

                if (session.url) {
                    console.log('Redirecting to session URL:', session.url);
                    window.location.href = session.url;
                } else {
                    console.log('Redirecting to checkout with sessionId:', session.sessionId);
                    const { error } = await stripe.redirectToCheckout({
                        sessionId: session.sessionId
                    });
                    
                    if (error) {
                        console.error('Checkout redirect error:', error);
                        throw error;
                    }
                }
            } catch (error) {
                console.error('Checkout error:', error);
                alert('Es gab einen Fehler beim Erstellen Ihrer Checkout-Session. Bitte versuchen Sie es erneut.');
            }
        });

        console.log('Checkout system initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        if (error.message === 'Memberstack timeout') {
            console.log('Proceeding without Memberstack');
            // You might want to add fallback behavior here
        }
    }
});
