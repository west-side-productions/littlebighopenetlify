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
        productType: 'course',
        deliveryType: 'digital',
        requiresShipping: false,
        prices: {
            de: 'price_1QTSN6JRMXFic4sW9sklILhd',
            en: 'price_1QTSN6JRMXFic4sW9sklILhd',
            fr: 'price_1QTSN6JRMXFic4sW9sklILhd',
            it: 'price_1QTSN6JRMXFic4sW9sklILhd'
        }
    },
    'book': {
        productType: 'book',
        deliveryType: 'physical',
        requiresShipping: true,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    'bundle': {
        productType: 'bundle',
        deliveryType: 'physical',
        requiresShipping: true,
        prices: {
            de: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            en: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            fr: 'price_1QTSNqJRMXFic4sWJYVWZlrp',
            it: 'price_1QTSNqJRMXFic4sWJYVWZlrp'
        }
    },
    'free-plan': {
        productType: 'free-plan',
        deliveryType: 'digital',
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
        const buttons = document.querySelectorAll('button[data-checkout-button="true"]');
        console.log('Found checkout buttons:', buttons.length);
        
        buttons.forEach(oldButton => {
            const newButton = oldButton.cloneNode(true);
            oldButton.parentNode.replaceChild(newButton, oldButton);
        });

        // Re-select buttons after replacement
        const newButtons = document.querySelectorAll('button[data-checkout-button="true"]');
        
        newButtons.forEach(button => {
            const productType = button.dataset.productType;
            console.log('Setting up button for product type:', productType);

            button.addEventListener('click', async function(event) {
                event.preventDefault();
                event.stopPropagation();
                
                console.log('Button clicked:', {
                    productType,
                    buttonId: this.id,
                    dataset: this.dataset
                });

                // Clear all error messages
                document.querySelectorAll('.error-message').forEach(el => {
                    el.textContent = '';
                    el.style.display = 'none';
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

// Handle checkout process
async function handleCheckout(event, button) {
    const productType = button.dataset.productType;
    console.log('=== Starting Checkout Process ===', { productType });

    try {
        // Get customer email
        const customerEmail = await getCustomerEmail();
        if (!customerEmail) {
            throw new Error('Customer email is required');
        }

        // Get shipping rate if needed
        let shippingRateId = null;
        if (productType === 'book' || productType === 'bundle') {
            const selectId = `shipping-rate-select-${productType}`;
            const shippingSelect = document.getElementById(selectId);
            if (!shippingSelect) {
                throw new Error('Shipping country selection is required for physical products');
            }
            if (!shippingSelect.value) {
                throw new Error('Please select a shipping option');
            }
            shippingRateId = shippingSelect.value;
            console.log('Using shipping rate:', shippingRateId);
        }

        // Get language from URL path
        const language = getPreferredLanguage(); // Use our dedicated function

        // Get product configuration and version
        const productConfig = PRODUCT_CONFIG[productType];
        if (!productConfig) {
            throw new Error(`Invalid product type: ${productType}`);
        }

        console.log('Product Config:', { productConfig, requiresShipping: productConfig.requiresShipping });

        // Validate shipping for physical products
        if (productConfig.requiresShipping && !shippingRateId) {
            throw new Error('Please select a shipping option');
        }

        // Get price ID for the current language
        const priceId = productConfig.prices[language] || productConfig.prices['de'];
        if (!priceId) {
            console.error('Price lookup failed:', {
                productType,
                language,
                availablePrices: productConfig.prices
            });
            throw new Error(`No price found for ${productType} in ${language}`);
        }

        console.log('Using price ID:', { productType, language, priceId });

        // Get current member for metadata
        const member = await $memberstackDom?.getCurrentMember();
        const memberstackUserId = member?.id || null;

        // Prepare checkout data according to Stripe's API
        const checkoutData = {
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            mode: 'payment',
            customer_email: customerEmail,
            success_url: `${window.location.origin}/vielen-dank-email`,
            cancel_url: `${window.location.origin}/produkte`,
            locale: language,
            metadata: {
                memberstackUserId,
                productType,
                type: productConfig.deliveryType,
                language,
                source: window.location.pathname,
                planId: productConfig.memberstackPlanId,
                requiresShipping: productConfig.requiresShipping
            }
        };

        // Add shipping info if needed
        if (productConfig.requiresShipping && shippingRateId) {
            checkoutData.shipping_options = [{
                shipping_rate: shippingRateId
            }];
            checkoutData.shipping_address_collection = {
                allowed_countries: ['DE', 'AT', 'CH', 'IT', 'FR']
            };
        }

        console.log('Creating checkout session:', checkoutData);

        // Create checkout session
        const response = await fetch('https://lillebighopefunctions.netlify.app/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkoutData)
        });

        const responseText = await response.text();
        console.log('Server response:', {
            status: response.status,
            statusText: response.statusText,
            body: responseText
        });

        if (!response.ok) {
            throw new Error(`Failed to create checkout session: ${response.status} - ${responseText}`);
        }

        let sessionData;
        try {
            sessionData = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON response: ${responseText}`);
        }

        if (!sessionData.sessionId) {
            throw new Error('No session ID returned from server');
        }

        // Initialize Stripe and redirect
        const stripe = await getStripeInstance();
        const { error } = await stripe.redirectToCheckout({ 
            sessionId: sessionData.sessionId 
        });
        
        if (error) {
            throw error;
        }

    } catch (error) {
        console.error('Checkout error:', error);
        const errorDiv = document.querySelector(`[data-error-message="${productType}"]`);
        if (errorDiv) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
        throw error;
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
            // Get product type from the select ID
            const selectId = shippingSelect.id;
            const match = selectId.match(/shipping-rate-select-(\w+)/);
            if (!match || !match[1]) {
                console.error('Could not determine product type from select ID:', selectId);
                return;
            }
            const productType = match[1];

            // Get product section and verify it exists
            const productSection = shippingSelect.closest('.product-section');
            if (!productSection) {
                console.error(`No product section found for shipping select: ${selectId}`);
                return;
            }

            // Get product configuration
            const productConfig = PRODUCT_CONFIG[productType];
            if (!productConfig) {
                console.error(`No configuration found for product type: ${productType}`);
                return;
            }

            if (!productConfig.requiresShipping) {
                console.warn(`Product ${productType} does not require shipping, but has shipping select`);
                shippingSelect.closest('.shipping-selection').style.display = 'none';
                return;
            }

            // Add change event listener
            shippingSelect.addEventListener('change', (e) => {
                const newRate = e.target.value;
                log('Shipping rate changed:', {
                    productType,
                    newRate,
                    selectId
                });

                // Show error if no shipping rate is selected
                const errorDiv = productSection.querySelector('.error-message');
                if (errorDiv) {
                    errorDiv.style.display = newRate ? 'none' : 'block';
                    errorDiv.textContent = 'Please select a shipping option';
                }

                updateTotalPrice(productType, newRate);
            });

            // Set initial shipping rate
            const defaultShippingRate = CONFIG.defaultShippingRate;
            if (!shippingSelect.value && defaultShippingRate) {
                // Try to find the default shipping rate in the options
                const defaultOption = Array.from(shippingSelect.options).find(opt => opt.value === defaultShippingRate);
                if (defaultOption) {
                    shippingSelect.value = defaultShippingRate;
                } else if (shippingSelect.options.length > 0) {
                    // If default not found, use first option
                    shippingSelect.value = shippingSelect.options[0].value;
                }
            }

            // Trigger initial price update
            const initialRate = shippingSelect.value;
            if (initialRate) {
                log('Setting initial shipping rate:', {
                    productType,
                    rate: initialRate,
                    selectId
                });
                updateTotalPrice(productType, initialRate);
            }

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

// Initialize Memberstack
async function initializeMemberstack() {
    try {
        log('Initializing Memberstack...');
        
        // Wait for Memberstack to be available
        const ms = await waitForMemberstack();
        if (!ms) {
            throw new Error('Memberstack failed to initialize');
        }

        // Store Memberstack instance globally
        window.$memberstackDom = ms;
        memberstackInitialized = true;
        
        log('Memberstack initialized successfully');

        // Set up auth state listener
        window.$memberstackDom.getCurrentMember().then(({ data: member }) => {
            if (member) {
                log('Member logged in:', member.id);
            } else {
                log('No member logged in');
            }
        }).catch(error => {
            console.error('Error getting current member:', error);
        });

        return true;
    } catch (error) {
        console.error('Error initializing Memberstack:', error);
        return false;
    }
}

// Wait for Memberstack to be ready
function waitForMemberstack(timeout = 5000) {
    return new Promise((resolve) => {
        if (window.$memberstackDom) {
            resolve(window.$memberstackDom);
            return;
        }

        const startTime = Date.now();
        const interval = setInterval(() => {
            if (window.$memberstackDom) {
                clearInterval(interval);
                resolve(window.$memberstackDom);
                return;
            }

            if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                console.error('Memberstack initialization timed out');
                resolve(null);
            }
        }, 100);
    });
}

// Get current member
async function getCurrentMember() {
    try {
        if (!window.$memberstackDom) {
            throw new Error('Memberstack not initialized');
        }

        const { data: member } = await window.$memberstackDom.getCurrentMember();
        return member;
    } catch (error) {
        console.error('Error getting current member:', error);
        return null;
    }
}

// Initialize checkout system
async function initializeCheckoutSystem() {
    try {
        log('Initializing checkout system...');
        
        // Check if we're on the members home page
        const path = window.location.pathname;
        const isOnMembersHome = path === '/members-home';
        log('Is on membershome:', isOnMembersHome, 'Path:', path);

        // Get all required elements
        const elements = {
            checkoutButtons: document.querySelectorAll('[data-checkout-button]'),
            shippingSelects: document.querySelectorAll('select[id="shipping-rate-select"]'),
            priceElements: document.querySelectorAll('[data-price-element]')
        };
        
        log('Found elements:', elements);

        // Initialize Memberstack and Stripe
        log('Loading Memberstack and Stripe...');
        
        const [memberstackInitialized, stripeInstance] = await Promise.all([
            initializeMemberstack(),
            getStripeInstance()
        ]);

        if (!memberstackInitialized || !stripeInstance) {
            throw new Error('Failed to initialize required services');
        }

        log('Memberstack and Stripe loaded successfully');

        // Initialize UI components
        initializeShippingSelects();
        initializeLanguageSelects();
        initializeCheckoutButtons();

        log('Checkout system initialized successfully');
        systemInitialized = true;
        
        return true;
    } catch (error) {
        console.error('Error initializing checkout system:', error);
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
    try {
        console.log('Getting Stripe instance...');
        if (typeof Stripe === 'undefined') {
            console.error('Stripe is not loaded');
            throw new Error('Stripe is not loaded. Please ensure the Stripe.js script is included.');
        }
        
        // Initialize Stripe with the publishable key
        const stripePublicKey = 'pk_test_51QSXqTJRMXFic4sWqIfhA8MlmlTqGKRqhOiQlxJYX2f7QIazdlBqKNxQjWFRyuqDI6XZm8BNjkYYqUDLHh6Zy2wF00ORZHPGlL';
        console.log('Initializing Stripe with public key');
        return Stripe(stripePublicKey);
    } catch (error) {
        console.error('Error getting Stripe instance:', error);
        throw error;
    }
}

// Function to start checkout
async function startCheckout(checkoutData) {
    try {
        console.log('Starting checkout process with data:', checkoutData);
        
        // Create checkout session via your server endpoint
        const response = await fetch('https://lillebighopefunctions.netlify.app/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: checkoutData.priceId,
                language: checkoutData.language,
                customerEmail: checkoutData.customerEmail,
                successUrl: checkoutData.successUrl,
                cancelUrl: checkoutData.cancelUrl,
                shippingRateId: checkoutData.shippingRateId,
                metadata: {
                    memberstackUserId: checkoutData.memberstackUserId,
                    productType: checkoutData.productType,
                    type: checkoutData.type,
                    language: checkoutData.language,
                    source: window.location.pathname,
                    requiresShipping: checkoutData.requiresShipping,
                    ...checkoutData.metadata
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const sessionData = await response.json();
        console.log('Checkout session created:', sessionData);

        if (!sessionData || !sessionData.id) {
            console.error('Invalid session data:', sessionData);
            throw new Error('No session ID returned from server');
        }

        // Get Stripe instance
        const stripe = await getStripeInstance();
        console.log('Got Stripe instance, redirecting to checkout with session ID:', sessionData.id);
        
        // Redirect to Stripe checkout using the correct method
        const { error } = await stripe.redirectToCheckout({
            sessionId: sessionData.id
        });

        if (error) {
            console.error('Stripe redirect error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in checkout process:', error);
        throw error;
    }
}