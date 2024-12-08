// System state
let systemInitialized = false;
let memberstackInitialized = false;

// Configuration
const CONFIG = {
    stripePublicKey: 'pk_test_51Nw2OWJRMXFic4sWEgOcPYEYqaGDuuGWGKqKB4fMVQcRJDqQKzZj9qEtgVkrKKTXgV4rFEEYBxh6DQWHZaZRaOWE00rPmWEbFm',
    defaultShippingRate: 'shr_1QScOlJRMXFic4sW8MHW0kq7',
    defaultLanguage: 'de',
    defaultCountry: 'DE'
};

// Product Configuration
const PRODUCT_CONFIG = {
    'course': {
        type: 'course',
        requiresShipping: false,
        prices: {
            de: 'price_1QTSN6JRMXFic4sW9sklILhd',
            en: 'price_1QTSN6JRMXFic4sW9sklILhd',
            fr: 'price_1QTSN6JRMXFic4sW9sklILhd',
            it: 'price_1QTSN6JRMXFic4sW9sklILhd'
        }
    },
    'book': {
        type: 'book',
        requiresShipping: true,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    'bundle': {
        type: 'bundle',
        requiresShipping: true,
        prices: {
            de: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            en: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            fr: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            it: 'price_1QTSNqJRMXFic4sWJYVWZlrp'
        }
    },
    'free-plan': {
        type: 'free-plan',
        requiresShipping: false,
        prices: {}
    }
};

// Product type to version mapping
const PRODUCT_TYPE_MAP = {
    'course': {
        type: 'course',
        version: 'digital'
    },
    'book': {
        type: 'book',
        version: 'physical-book'
    },
    'bundle': {
        type: 'bundle',
        version: 'physical-book'
    },
    'free-plan': {
        type: 'free-plan',
        version: 'digital'
    }
};

// Button type to Stripe version mapping
const BUTTON_VERSION_MAP = {
    'course': 'digital',
    'book': 'physical-book',
    'bundle': 'physical-book',
    'free-plan': 'digital'
};

// Shipping Rates Structure
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { 
        price: 7.28, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QScMXJRMXFic4sWih6q9v36': { 
        price: 20.72, 
        label: 'Great Britain', 
        countries: ['GB']
    },
    'shr_1QScNqJRMXFic4sW3NVUUckl': { 
        price: 36.53, 
        label: 'Singapore', 
        countries: ['SG']
    },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
        price: 20.36, 
        label: 'European Union', 
        countries: [
            'BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'GR', 'ES', 'FR', 
            'HR', 'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 
            'PT', 'RO', 'SK', 'SI', 'FI', 'SE'
        ]
    }
};

// EU Countries
const EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// Utility Functions
function log(...args) {
    console.log(...args);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await delay(baseDelay * Math.pow(2, i));
        }
    }
}

// Shipping Functions
function getShippingRateForCountry(country) {
    if (!country) return null;
    
    const rate = Object.entries(SHIPPING_RATES).find(([_, rate]) => 
        rate.countries.includes(country)
    );
    
    return rate ? rate[0] : null;
}

function getCountriesForShippingRate(shippingRateId) {
    return SHIPPING_RATES[shippingRateId]?.countries || [];
}

// Weight handling functions
function calculateTotalWeight(productConfig) {
    if (!productConfig?.requiresShipping) return 0;
    const productWeight = productConfig.weight || 0;
    const packagingWeight = productConfig.packagingWeight || 0;
    return productWeight + packagingWeight;
}

function validateWeights(productConfig) {
    if (!productConfig?.requiresShipping) return true;
    
    const productWeight = Number(productConfig.weight);
    const packagingWeight = Number(productConfig.packagingWeight);
    const totalWeight = calculateTotalWeight(productConfig);
    
    if (isNaN(productWeight) || isNaN(packagingWeight) || isNaN(totalWeight)) {
        throw new Error('Invalid weight values');
    }
    
    if (totalWeight !== (productWeight + packagingWeight)) {
        throw new Error('Weight mismatch');
    }
    
    return true;
}

// Price Functions
async function updateTotalPrice(version, shippingRateId = null) {
    const productConfig = PRODUCT_CONFIG[version];
    if (!productConfig) {
        console.error(`Invalid version: ${version}`);
        return;
    }

    const basePrice = productConfig.basePrice || 0;
    let shippingPrice = 0;

    if (productConfig.requiresShipping && shippingRateId) {
        // Get shipping price based on rate ID
        switch (shippingRateId) {
            case 'shr_1QScKFJRMXFic4sW9e80ABBp': // Austria
                shippingPrice = 4.90;
                break;
            case 'shr_1QScMXJRMXFic4sWih6q9v36': // Great Britain
                shippingPrice = 9.90;
                break;
            case 'shr_1QScNqJRMXFic4sW3NVUUckl': // Singapore
                shippingPrice = 19.90;
                break;
            case 'shr_1QScOlJRMXFic4sW8MHW0kq7': // EU
                shippingPrice = 7.90;
                break;
            default:
                console.warn(`Unknown shipping rate ID: ${shippingRateId}`);
                shippingPrice = 0;
        }
    }

    const totalPrice = basePrice + shippingPrice;

    // Update price displays
    const subtotalElement = document.getElementById(`subtotal-price-${version}`);
    const shippingElement = document.getElementById(`shipping-price-${version}`);
    const totalElement = document.getElementById(`total-price-${version}`);
    const checkoutButton = document.querySelector(`[data-checkout-button][data-version="${version}"]`);

    if (subtotalElement) subtotalElement.textContent = basePrice.toFixed(2);
    if (shippingElement) shippingElement.textContent = shippingPrice.toFixed(2);
    if (totalElement) totalElement.textContent = totalPrice.toFixed(2);
    if (checkoutButton) checkoutButton.textContent = `Proceed to Checkout (€${totalPrice.toFixed(2)})`;
}

// Email Service Integration
// Initialize dependencies
async function initializeDependencies() {
    log('Initializing shopping system...');
    
    try {
        // Wait for Memberstack to be ready with timeout
        await waitForMemberstack();
        log('Memberstack initialized');
        
        // Load Stripe.js if not already loaded
        if (!window.Stripe) {
            await loadScript('https://js.stripe.com/v3/');
            if (!window.Stripe) {
                throw new Error('Failed to load Stripe.js');
            }
        }
        
        // Initialize Stripe
        const stripe = Stripe(CONFIG.stripePublicKey);
        log('Stripe initialized with test key');
        return { stripe };
    } catch (error) {
        console.error('Error initializing dependencies:', error);
        // Don't throw here, allow fallback to localStorage
        return { stripe: null };
    }
}

// Email Templates Location
const emailTemplates = {
    orderConfirmation: {
        subject: 'Order Confirmation - Little Big Hope',
        html: (data) => `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .details { background: #f9f9f9; padding: 20px; border-radius: 5px; }
                    .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Thank You for Your Order!</h1>
                    </div>
                    <p>Hello,</p>
                    <p>Thank you for your purchase from Little Big Hope. We're excited to have you as a customer!</p>
                    <div class="details">
                        <h2>Order Details:</h2>
                        <p>Order ID: ${data.id}</p>
                        <p>Date: ${new Date().toLocaleDateString()}</p>
                        <p>Product: ${data.metadata?.productType || 'Product'}</p>
                        ${data.shipping ? `
                            <h3>Shipping Information:</h3>
                            <p>Shipping Method: ${data.shipping.carrier}</p>
                            <p>Estimated Delivery: 3-5 business days</p>
                        ` : ''}
                    </div>
                    <div class="footer">
                        <p>If you have any questions, please contact us at support@littlebighope.com</p>
                        <p> Little Big Hope. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: (data) => `
Thank You for Your Order!

Hello,

Thank you for your purchase from Little Big Hope. We're excited to have you as a customer!

Order Details:
-------------
Order ID: ${data.id}
Date: ${new Date().toLocaleDateString()}
Product: ${data.metadata?.productType || 'Product'}
${data.shipping ? `
Shipping Information:
-------------------
Shipping Method: ${data.shipping.carrier}
Estimated Delivery: 3-5 business days
` : ''}

If you have any questions, please contact us at support@littlebighope.com

 Little Big Hope. All rights reserved.
        `
    },
    orderNotification: {
        subject: 'New Order Notification - Little Big Hope',
        html: (data) => `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #f5f5f5; padding: 20px; margin-bottom: 30px; }
                    .details { background: #fff; padding: 20px; border: 1px solid #ddd; }
                    .customer-info { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>New Order Received</h1>
                        <p>Order ID: ${data.id}</p>
                    </div>
                    <div class="details">
                        <h2>Order Details</h2>
                        <p>Date: ${new Date().toLocaleDateString()}</p>
                        <p>Product Type: ${data.metadata?.productType || 'Not specified'}</p>
                        <p>Language: ${data.metadata?.language || 'Not specified'}</p>
                        <p>Amount: ${data.amount_total ? (data.amount_total / 100).toFixed(2) : 'N/A'} ${data.currency?.toUpperCase() || 'EUR'}</p>
                        
                        <div class="customer-info">
                            <h3>Customer Information</h3>
                            <p>Email: ${data.customer_email || 'Not provided'}</p>
                            ${data.shipping ? `
                                <h3>Shipping Details</h3>
                                <p>Name: ${data.shipping.name}</p>
                                <p>Address: ${data.shipping.address.line1}</p>
                                <p>City: ${data.shipping.address.city}</p>
                                <p>Country: ${data.shipping.address.country}</p>
                                <p>Postal Code: ${data.shipping.address.postal_code}</p>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: (data) => `
New Order Received
-----------------
Order ID: ${data.id}

Order Details:
-------------
Date: ${new Date().toLocaleDateString()}
Product Type: ${data.metadata?.productType || 'Not specified'}
Language: ${data.metadata?.language || 'Not specified'}
Amount: ${data.amount_total ? (data.amount_total / 100).toFixed(2) : 'N/A'} ${data.currency?.toUpperCase() || 'EUR'}

Customer Information:
-------------------
Email: ${data.customer_email || 'Not provided'}

${data.shipping ? `Shipping Details:
----------------
Name: ${data.shipping.name}
Address: ${data.shipping.address.line1}
City: ${data.shipping.address.city}
Country: ${data.shipping.address.country}
Postal Code: ${data.shipping.address.postal_code}` : ''}
        `
    }
};

// Function to send order confirmation email
async function sendOrderConfirmationEmail(email, session) {
    if (!email) {
        console.error('No email provided for order confirmation');
        return;
    }

    const msg = {
        to: email,
        from: 'no-reply@littlebighope.com',
        subject: emailTemplates.orderConfirmation.subject,
        html: emailTemplates.orderConfirmation.html(session),
        text: emailTemplates.orderConfirmation.text(session),
    };

    try {
        await sgMail.send(msg);
        console.log('Order confirmation email sent to:', email);
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        throw error;
    }
}

// Function to send order notification email
async function sendOrderNotificationEmail(session) {
    const msg = {
        to: 'admin@littlebighope.com',
        from: 'no-reply@littlebighope.com',
        subject: emailTemplates.orderNotification.subject,
        html: emailTemplates.orderNotification.html(session),
        text: emailTemplates.orderNotification.text(session),
    };

    try {
        await sgMail.send(msg);
        console.log('Order notification email sent to admin');
    } catch (error) {
        console.error('Error sending order notification email:', error);
        throw error;
    }
}

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    console.log('=== Initializing checkout buttons ===');
    
    try {
        // Remove any existing event listeners
        const buttons = document.querySelectorAll('[data-checkout-button="true"]');
        buttons.forEach(oldButton => {
            const newButton = oldButton.cloneNode(true);
            oldButton.parentNode.replaceChild(newButton, oldButton);
        });

        // Re-select buttons after replacement
        const newButtons = document.querySelectorAll('[data-checkout-button="true"]');
        
        newButtons.forEach(button => {
            const productType = button.dataset.productType;
            
            if (!productType || !PRODUCT_CONFIG[productType]) {
                console.warn('Invalid product type:', {
                    button,
                    productType,
                    availableTypes: Object.keys(PRODUCT_CONFIG)
                });
                return;
            }

            button.addEventListener('click', async function(event) {
                event.preventDefault();
                event.stopPropagation();

                // Clear all error messages
                document.querySelectorAll('.error-message').forEach(el => {
                    el.textContent = '';
                    el.style.display = 'none';
                });

                console.log(`Button clicked for ${productType}:`, {
                    button: this,
                    productType,
                    dataset: this.dataset
                });

                try {
                    await handleCheckout(event, this);
                } catch (error) {
                    console.error(`Checkout error for ${productType}:`, error);
                    const errorDiv = document.getElementById(`error-message-${productType}`);
                    if (errorDiv) {
                        errorDiv.textContent = error.message;
                        errorDiv.style.display = 'block';
                    }
                }
            });

            console.log(`Initialized button for ${productType}`);
        });

    } catch (error) {
        console.error('Error initializing checkout buttons:', error);
    }
}

// Helper function to get customer email
async function getCustomerEmail() {
    // Try input field first
    const emailInput = document.querySelector('input[name="email"]') || 
                      document.querySelector('input[type="email"]');
    
    if (emailInput && emailInput.value) {
        return emailInput.value;
    }

    // Try Memberstack
    try {
        const member = await $memberstackDom?.getCurrentMember();
        return member?.data?.email || '';
    } catch (error) {
        console.warn('Failed to get member email:', error);
        return '';
    }
}

// Initialize price elements
function initializePriceElements() {
    const priceElements = document.querySelectorAll('[data-price-element]');
    priceElements.forEach(element => {
        const productSection = element.closest('[data-product-type]');
        if (!productSection) return;

        try {
            const version = productSection.getAttribute('data-product-type');
            const productConfig = PRODUCT_CONFIG[version];
            if (!productConfig) {
                console.warn(`No configuration found for version: ${version}`);
                return;
            }

            // Initialize price display
            updatePriceDisplay(element, productConfig);
        } catch (error) {
            console.error('Error initializing price element:', error);
        }
    });
}

// Initialize shipping selects
function initializeShippingSelects() {
    const shippingSelects = document.querySelectorAll('select[id^="shipping-rate-select-"]');
    log(`Found shipping selects: ${shippingSelects.length}`);

    shippingSelects.forEach(shippingSelect => {
        try {
            const productSection = shippingSelect.closest('[data-product-type]');
            const version = productSection?.querySelector('[data-product-type]')?.getAttribute('data-product-type') || 'physical';

            // Set unique ID and data attribute
            shippingSelect.id = `shipping-rate-select-${version}`;
            shippingSelect.setAttribute('data-shipping-select', version);

            // Add change event listener
            shippingSelect.addEventListener('change', (e) => {
                log('Shipping rate changed:', e.target.value);
                updateTotalPrice(version, e.target.value);
            });

            // Set initial shipping rate
            const initialShippingRate = shippingSelect.value;
            log('Initial shipping rate:', initialShippingRate);
            updateTotalPrice(version, initialShippingRate);

        } catch (error) {
            console.error('Error initializing shipping select:', error);
        }
    });
}

// Update total price display
function updateTotalPrice(version, shippingRateId = null) {
    const productConfig = PRODUCT_CONFIG[version];
    if (!productConfig) {
        console.error(`No configuration found for version: ${version}`);
        return;
    }

    try {
        const basePrice = productConfig.basePrice || 0;
        const shippingRate = shippingRateId ? SHIPPING_RATES[shippingRateId]?.price || 0 : 0;
        const totalPrice = basePrice + shippingRate;

        // Update price displays
        const priceElements = document.querySelectorAll(`[data-price-element][data-product-type="${version}"]`);
        priceElements.forEach(element => {
            element.textContent = formatPrice(totalPrice);
        });

    } catch (error) {
        console.error('Error updating total price:', error);
    }
}

// Get preferred language synchronously
function getPreferredLanguage() {
    try {
        // First check Memberstack
        if (window.$memberstackDom && window.$memberstackDom.getCurrentMember()) {
            const member = window.$memberstackDom.getCurrentMember();
            if (member && member.language) {
                return member.language;
            }
        }

        // Then check Webflow locale
        const htmlElement = document.documentElement;
        if (htmlElement && htmlElement.lang) {
            return htmlElement.lang;
        }

        // Finally check URL path
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 1) {
            const possibleLang = pathParts[1].toLowerCase();
            if (['de', 'en', 'fr', 'it'].includes(possibleLang)) {
                return possibleLang;
            }
        }

        // Default to German if no language is found
        return 'de';
    } catch (error) {
        console.error('Error detecting language:', error);
        return 'de';
    }
}

// Handle checkout process
async function handleCheckout(event, button) {
    const productType = button.dataset.productType;
    console.log('=== Starting Checkout Process ===', { productType });

    try {
        if (!productType || !PRODUCT_CONFIG[productType]) {
            throw new Error(`Invalid product type: ${productType}`);
        }

        const customerEmail = await getCustomerEmail();
        if (!customerEmail) {
            throw new Error('Customer email is required');
        }

        let shippingRateId = null;
        if (PRODUCT_CONFIG[productType].requiresShipping) {
            const selectId = `shipping-rate-select-${productType}`;
            const shippingSelect = document.getElementById(selectId);
            if (!shippingSelect) {
                throw new Error('Shipping country selection is required for physical products');
            }
            shippingRateId = shippingSelect.value;
        }

        const language = getPreferredLanguage();
        console.log('Using language for checkout:', language);

        const checkoutConfig = {
            productType,
            customerEmail,
            shippingRateId,
            language,
            metadata: {
                productType,
                language,
                source: window.location.pathname
            }
        };

        console.log('Starting checkout with config:', checkoutConfig);
        await startCheckout(checkoutConfig);

    } catch (error) {
        console.error('Checkout error:', error);
        throw error;
    }
}

// Start checkout process
async function startCheckout(config) {
    try {
        const language = config.language || getPreferredLanguage();
        const productConfig = PRODUCT_CONFIG[config.productType];
        
        if (!productConfig) {
            throw new Error(`Invalid product type: ${config.productType}`);
        }

        const priceId = productConfig.prices[language];
        if (!priceId) {
            console.warn(`No price found for language ${language}, using default language de`);
            if (!productConfig.prices.de) {
                throw new Error('No default price found');
            }
        }

        const requestData = {
            productType: config.productType,
            priceId: priceId || productConfig.prices.de,
            language: language,
            customerEmail: config.customerEmail,
            shippingRateId: config.shippingRateId,
            metadata: config.metadata
        };

        console.log('Creating checkout session:', requestData);

        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Checkout session creation failed:', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`Failed to create checkout session: ${errorText || response.status}`);
        }

        const { sessionId } = await response.json();
        if (!sessionId) {
            throw new Error('No session ID returned from server');
        }

        const stripe = await getStripeInstance();
        const { error } = await stripe.redirectToCheckout({ sessionId });
        
        if (error) {
            throw error;
        }

    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
    }
}

// Initialize Memberstack
async function initializeMemberstack() {
    try {
        // Wait for Memberstack to be ready
        await new Promise((resolve) => {
            const checkMemberstack = setInterval(() => {
                if (window.$memberstackDom) {
                    clearInterval(checkMemberstack);
                    resolve();
                }
            }, 100);

            // Also listen for the ready event as a backup
            document.addEventListener('memberstack.ready', () => {
                clearInterval(checkMemberstack);
                resolve();
            });

            // Set a timeout to avoid infinite waiting
            setTimeout(() => {
                clearInterval(checkMemberstack);
                resolve();
            }, 5000);
        });

        // Ensure $memberstackDom is available before proceeding
        if (!window.$memberstackDom) {
            console.warn('Memberstack not available after initialization');
            return false;
        }

        // Add member update listener
        if (typeof window.$memberstackDom.listen === 'function') {
            window.$memberstackDom.listen('member.update', (event) => {
                log('Member updated:', event);
                // Additional logic for member updates
            });
        } else {
            console.warn('Memberstack listen method not available');
        }

        log('Memberstack initialized');
        memberstackInitialized = true;
        return true;
    } catch (error) {
        console.error('Error initializing Memberstack:', error);
        return false;
    }
}

// Get current member
async function getCurrentMember() {
    try {
        // Wait for Memberstack to be ready
        await new Promise((resolve) => {
            if (window.$memberstackDom) {
                resolve();
            } else {
                document.addEventListener('memberstack.ready', resolve);
            }
        });

        // Check which API is available
        if (typeof window.$memberstackDom?.getCurrentMember === 'function') {
            return await window.$memberstackDom.getCurrentMember();
        } else if (typeof window.MemberStack?.getMember === 'function') {
            return await window.MemberStack.getMember();
        } else {
            console.warn('No Memberstack member retrieval method available');
            return null;
        }
    } catch (error) {
        console.error('Error getting current member:', error);
        return null;
    }
}

// Function to wait for Memberstack to be ready
async function waitForMemberstack(timeout = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
        if (await initializeMemberstack()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Memberstack initialization timeout');
}

// Initialize checkout system
async function initializeCheckoutSystem() {
    if (systemInitialized) {
        console.log('Checkout system already initialized');
        return true;
    }

    try {
        log('Initializing checkout system...');
        
        // Check if we're on membershome
        const path = window.location.pathname;
        log(`Is on membershome: ${path.includes('membershome')} Path: ${path}`);
        
        // Find all required elements
        const elements = {
            checkoutButtons: document.querySelectorAll('button[data-checkout-button][data-product-type]'),
            shippingSelects: document.querySelectorAll('select[id^="shipping-rate-select-"]'),
            priceElements: document.querySelectorAll('[data-price-display]')
        };
        
        log('Found elements:', elements);
        
        // Load Memberstack and Stripe
        log('Loading Memberstack and Stripe...');
        
        try {
            await waitForMemberstack();
            log('Memberstack and Stripe loaded successfully');
        } catch (error) {
            console.warn('Failed to initialize Memberstack:', error);
            // Continue anyway as we might not need Memberstack for all operations
        }
        
        // Initialize components in the correct order
        if (elements.checkoutButtons.length > 0) {
            await initializeCheckoutButtons();
        }
        if (elements.shippingSelects.length > 0) {
            await initializeShippingSelects();
        }
        if (elements.priceElements.length > 0) {
            await initializePriceElements();
        }
        
        systemInitialized = true;
        log('Checkout system initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize checkout system:', error);
        return false;
    }
}

// Only initialize once when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing checkout system...');
    initializeCheckoutSystem().catch(error => {
        console.error('Failed to initialize checkout system:', error);
    });
});

// Legacy support - redirect to the main initialization
function initializeCheckoutButton() {
    if (systemInitialized) {
        log('System already initialized via legacy function');
        return Promise.resolve();
    }
    log('Legacy initializeCheckoutButton called - using main initialization');
    return initializeCheckoutSystem();
}

// Global Stripe instance
let stripeInstance = null;

// Function to get or initialize Stripe instance
async function getStripeInstance() {
    if (stripeInstance) {
        return stripeInstance;
    }

    try {
        if (!window.Stripe) {
            throw new Error('Stripe.js not loaded');
        }

        stripeInstance = Stripe(CONFIG.stripePublicKey);
        return stripeInstance;
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        throw error;
    }
}