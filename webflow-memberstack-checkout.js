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
    course: {
        id: 'prc_online-kochkurs-8b540kc2',
        type: 'digital',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        requiresShipping: false,
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
    },
    book: {
        id: 'prc_cookbook_physical',
        type: 'physical',
        requiresShipping: true,
        weight: 1005,
        packagingWeight: 152,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u',
        dimensions: {
            length: 25,   // cm
            width: 20,   // cm
            height: 2    // cm
        }
    },
    bundle: {
        type: 'bundle',
        basePrice: 119.99,
        requiresShipping: true,
        weight: 1005,
        packagingWeight: 152,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u',
        dimensions: {
            length: 25,   // cm
            width: 20,   // cm
            height: 2    // cm
        }
    },
    free: {
        type: 'digital',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        requiresShipping: false,
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
    }
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
async function updateTotalPrice(productType, shippingRateId = null) {
    const productConfig = PRODUCT_CONFIG[productType];
    if (!productConfig) {
        console.error(`Invalid product type: ${productType}`);
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
    const subtotalElement = document.getElementById(`subtotal-price-${productType}`);
    const shippingElement = document.getElementById(`shipping-price-${productType}`);
    const totalElement = document.getElementById(`total-price-${productType}`);
    const checkoutButton = document.querySelector(`[data-checkout-button][data-product-type="${productType}"]`);

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
        html: (data) => `<p>Thank you for your order!</p><p>Your order details:</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
        text: (data) => `Thank you for your order!

Your order details:
${JSON.stringify(data, null, 2)}`
    },
    orderNotification: {
        subject: 'New Order Notification',
        html: (data) => `<p>New order received!</p><p>Order details:</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
        text: (data) => `New order received!

Order details:
${JSON.stringify(data, null, 2)}`
    }
};

// Function to send order confirmation email
async function sendOrderConfirmationEmail(email, session) {
    const msg = {
        to: email,
        from: 'no-reply@littlebighope.com', // Use your verified sender
        subject: emailTemplates.orderConfirmation.subject,
        html: emailTemplates.orderConfirmation.html(session),
        text: emailTemplates.orderConfirmation.text(session),
    };

    try {
        // await sgMail.send(msg);
        console.log('Order confirmation email sent');
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
    }
}

// Function to send order notification email
async function sendOrderNotificationEmail(session) {
    const msg = {
        to: 'admin@littlebighope.com', // Admin email
        from: 'no-reply@littlebighope.com', // Use your verified sender
        subject: emailTemplates.orderNotification.subject,
        html: emailTemplates.orderNotification.html(session),
        text: emailTemplates.orderNotification.text(session),
    };

    try {
        // await sgMail.send(msg);
        console.log('Order notification email sent');
    } catch (error) {
        console.error('Error sending order notification email:', error);
    }
}

// Checkout Functions
async function startCheckout(shippingRateId = null, productType = null) {
    log('Starting checkout process...');
    log('Product type:', productType);
    log('Shipping rate:', shippingRateId);

    if (!productType) {
        throw new Error('Product type is required');
    }

    const productConfig = PRODUCT_CONFIG[productType];
    if (!productConfig) {
        throw new Error(`Invalid product type: ${productType}`);
    }

    // Check if shipping is required and validate shipping rate
    if (productConfig.requiresShipping || productConfig.type === 'physical' || productConfig.type === 'bundle') {
        // Get shipping rate from select element if not provided
        if (!shippingRateId) {
            const shippingSelect = document.querySelector('#shipping-rate-select');
            shippingRateId = shippingSelect?.value;
        }

        // Validate shipping rate
        if (!shippingRateId || !SHIPPING_RATES[shippingRateId]) {
            throw new Error('Please select a shipping option');
        }

        // Validate weights
        validateWeights(productConfig);
    }

    try {
        // Check if user is logged in
        const member = await window.memberstack.getCurrentMember();
        if (!member?.data) {
            // Store checkout state
            const checkoutConfig = {
                productType: productType,
                shippingRateId: shippingRateId
            };
            localStorage.setItem('checkoutConfig', JSON.stringify(checkoutConfig));
            localStorage.setItem('checkoutRedirectUrl', window.location.pathname + window.location.search);
            window.location.href = '/registrieren';
            return;
        }

        // Create checkout session with weight information
        const apiEndpoint = window.location.protocol === 'file:' 
            ? 'https://littlebighope.netlify.app/.netlify/functions/create-checkout-session'
            : (window.location.hostname === 'localhost' 
                ? 'http://localhost:8888/.netlify/functions/create-checkout-session'
                : 'https://littlebighope.netlify.app/.netlify/functions/create-checkout-session');
            
        log('Making checkout request to:', apiEndpoint);
        const language = await getPreferredLanguage();
        
        // Debug logging
        log('Debug - Product Type:', {
            rawProductType: productType,
            typeofProductType: typeof productType,
            productConfig: productConfig,
            configKeys: Object.keys(PRODUCT_CONFIG)
        });
        
        const payload = {
            productType: productType,  // Ensure this is explicitly set
            shippingRateId: shippingRateId,
            language: language,
            customerEmail: member.data.auth.email,
            memberstackUserId: member.data.id,
            weights: productConfig.requiresShipping ? {
                productWeight: productConfig.weight,
                packagingWeight: productConfig.packagingWeight,
                totalWeight: calculateTotalWeight(productConfig)
            } : null,
            metadata: {
                memberstackUserId: member.data.id,
                productType: productType,
                type: productConfig.type,
                language: language,
                source: window.location.pathname,
                planId: productConfig.memberstackPlanId || CONFIG.memberstackPlanId,
                requiresShipping: productConfig.requiresShipping,
                totalWeight: productConfig.weight + (productConfig.packagingWeight || 0),
                productWeight: productConfig.weight,
                packagingWeight: productConfig.packagingWeight || 0,
                dimensions: productConfig.dimensions ? JSON.stringify(productConfig.dimensions) : null,
                shippingClass: productConfig.shippingClass || 'standard'
            }
        };
        
        log('Debug - Final Payload:', {
            rawPayload: payload,
            stringifiedPayload: JSON.stringify(payload)
        });
        
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }).catch(error => {
            console.error('Network error details:', {
                error: error,
                endpoint: apiEndpoint,
                payload: payload
            });
            throw error;
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Checkout error details:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`Checkout failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        let sessionData;
        try {
            sessionData = await response.json();
            log('Received session data:', sessionData);
        } catch (error) {
            console.error('Failed to parse response:', error);
            throw new Error('Invalid server response');
        }

        if (!sessionData || !sessionData.sessionId) {
            throw new Error('Invalid session data received');
        }

        // Initialize Stripe and redirect to checkout
        log('Redirecting to Stripe checkout...');
        const stripe = window.Stripe(CONFIG.stripePublicKey);
        const { error } = await stripe.redirectToCheckout({
            sessionId: sessionData.sessionId
        });

        if (error) {
            console.error('Stripe redirect error:', error);
            throw error;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        if (error.response) {
            const errorText = await error.response.text();
            console.error('Server response:', errorText);
        }
        alert(error.message || 'An error occurred during checkout. Please try again.');
    }
}

// Handle membershome functionality
async function handleMembershome() {
    log('Handling membershome...');
    const member = await window.$memberstackDom.getCurrentMember();
    
    if (member?.data && window.location.pathname === '/membershome') {
        const storedConfig = localStorage.getItem('checkoutConfig');
        const redirectUrl = localStorage.getItem('checkoutRedirectUrl');
        
        if (storedConfig) {
            try {
                const config = JSON.parse(storedConfig);
                log('Found stored checkout config:', config);
                
                // Clear stored data
                localStorage.removeItem('checkoutConfig');
                localStorage.removeItem('checkoutRedirectUrl');
                
                // Start checkout with stored configuration
                await startCheckout(config.shippingRateId, config.productType);
            } catch (error) {
                console.error('Error processing stored checkout:', error);
                // Redirect back to products page on error
                window.location.href = redirectUrl || '/produkte';
            }
        }
    }
}

// Function to wait for Memberstack to be ready
function waitForMemberstack(timeout = 5000) {
    return new Promise((resolve) => {
        // If Memberstack is already available, resolve immediately
        if (window.$memberstackDom) {
            log('Memberstack already available');
            memberstackInitialized = true;
            resolve(window.$memberstackDom);
            return;
        }

        log('Waiting for Memberstack...');

        // Listen for Memberstack ready event
        document.addEventListener('memberstack.ready', () => {
            log('Memberstack ready event received');
            memberstackInitialized = true;
            resolve(window.$memberstackDom);
        });

        // Fallback: check periodically
        const checkInterval = setInterval(() => {
            if (window.$memberstackDom) {
                clearInterval(checkInterval);
                clearTimeout(timeoutId);
                log('Memberstack found through polling');
                memberstackInitialized = true;
                resolve(window.$memberstackDom);
            }
        }, 100);

        // Set a timeout to avoid hanging
        const timeoutId = setTimeout(() => {
            clearInterval(checkInterval);
            log('NO MEMBERSTACK AVAILABLE, using localStorage');
            resolve(null);
        }, timeout);
    });
}

// Initialize shipping rate selection
function initializeShippingSelects() {
    log('Initializing shipping selects...');
    
    // Look for both ID and name-based selectors
    const shippingSelects = document.querySelectorAll('select[name="Versand-nach"]');
    log('Found shipping selects:', shippingSelects.length);
    
    shippingSelects.forEach(shippingSelect => {
        if (shippingSelect) {
            // Find the closest product section to determine product type
            const productSection = shippingSelect.closest('.product-section');
            const productType = productSection?.querySelector('[data-product-type]')?.dataset.productType || 'book';
            
            // Set both the generic and product-specific IDs
            shippingSelect.id = `shipping-rate-select-${productType}`;
            shippingSelect.setAttribute('data-shipping-select', productType);
            
            // Remove required attribute if it exists
            shippingSelect.removeAttribute('required');
            
            // Add change event listener
            shippingSelect.addEventListener('change', (e) => {
                log('Shipping rate changed:', e.target.value);
                updateTotalPrice(productType, e.target.value);
            });

            // Initialize with current selection or default
            const initialShippingRate = shippingSelect.value || CONFIG.defaultShippingRate;
            log('Initial shipping rate:', initialShippingRate);
            updateTotalPrice(productType, initialShippingRate);
        }
    });

    // Initialize language selects
    const languageSelects = document.querySelectorAll('.language-selector, select[name="Sprache"]');
    log('Found language selects:', languageSelects.length);
    
    languageSelects.forEach(langSelect => {
        if (langSelect) {
            langSelect.classList.add('language-selector');
            langSelect.name = 'Sprache';
            langSelect.removeAttribute('required');
            
            const currentLang = getPreferredLanguage();
            if (currentLang && langSelect.querySelector(`option[value="${currentLang}"]`)) {
                langSelect.value = currentLang;
            }
        }
    });

    return shippingSelects;
}

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    const buttons = document.querySelectorAll('[data-checkout-button]');
    log(`Found ${buttons.length} checkout buttons`);
    
    buttons.forEach(button => {
        const productType = button.dataset.productType;
        log(`Setting up button for product type: ${productType}`);
        
        // Store original text before replacing button
        const originalButtonText = button.textContent;
        
        // Remove existing listeners by cloning
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add event listener to the new button
        newButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const clickedButton = event.currentTarget;
            const clickedProductType = clickedButton.dataset.productType;
            log(`Checkout clicked for product type: ${clickedProductType}`);
            
            const productConfig = PRODUCT_CONFIG[clickedProductType];
            if (!productConfig) {
                console.error(`Invalid product type: ${clickedProductType}`);
                return;
            }
            
            try {
                clickedButton.disabled = true;
                const originalText = clickedButton.textContent || originalButtonText;
                clickedButton.textContent = 'Processing...';
                
                let shippingRateId = null;
                if (productConfig.requiresShipping) {
                    // Try multiple selectors to find the shipping select
                    const productSection = clickedButton.closest('.product-section');
                    const shippingSelect = productSection?.querySelector(`#shipping-rate-select-${clickedProductType}`) || 
                                         productSection?.querySelector(`[data-shipping-select="${clickedProductType}"]`) ||
                                         productSection?.querySelector('select[name="Versand-nach"]');
                    
                    log('Found shipping select:', shippingSelect);
                    shippingRateId = shippingSelect?.value;
                    
                    if (!shippingRateId || shippingRateId === '') {
                        throw new Error('Please select a shipping option');
                    }
                    
                    log('Selected shipping rate:', shippingRateId);
                }
                
                await startCheckout(shippingRateId, clickedProductType);
            } catch (error) {
                console.error('Checkout error:', error);
                if (error.response) {
                    const errorText = await error.response.text();
                    console.error('Server response:', errorText);
                }
                alert(error.message || 'An error occurred during checkout. Please try again.');
            } finally {
                clickedButton.disabled = false;
                clickedButton.textContent = originalButtonText;
            }
        });
    });
    log('Checkout buttons initialized');
}

// Initialize checkout system
async function initializeCheckoutSystem() {
    if (systemInitialized) {
        log('Checkout system already initialized');
        return;
    }

    try {
        // Wait for Memberstack
        await waitForMemberstack();
        memberstackInitialized = true;
        log('Memberstack initialized');

        // Initialize Stripe
        if (!window.Stripe) {
            throw new Error('Stripe not loaded');
        }
        log('Stripe initialized with test key');

        // Initialize shipping selects
        const shippingSelects = await initializeShippingSelects();
        log('Shipping selects initialized:', shippingSelects);

        // Initialize checkout buttons
        await initializeCheckoutButtons();
        log('Checkout buttons initialized');

        // Handle membershome functionality
        await handleMembershome();

        systemInitialized = true;
        log('Checkout system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize checkout system:', error);
        throw error;
    }
}

// Legacy support - redirect to the main initialization
function initializeCheckoutButton() {
    if (systemInitialized) {
        log('System already initialized via legacy function');
        return Promise.resolve();
    }
    log('Legacy initializeCheckoutButton called - using main initialization');
    return initializeCheckoutSystem();
}

// Document ready handler
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, checking language...');
    
    // Prevent multiple initializations
    if (window.$lbh?.initialized) {
        console.log('System already initialized');
        return;
    }
    
    try {
        // Initialize dependencies first
        const { stripe } = await initializeDependencies();
        if (stripe) {
            window.$lbh = window.$lbh || {};
            window.$lbh.stripe = stripe;
        }
        
        // Initialize the rest of the system
        await initializeCheckoutSystem();
        
        // Mark as initialized
        window.$lbh.initialized = true;
        console.log('Checkout system initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        if (error.message === 'Memberstack timeout') {
            console.log('Proceeding without Memberstack');
        }
    }
});

// Function to get user's preferred language
function getPreferredLanguage() {
    // Try to get language from URL first
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const urlLang = pathParts[0]?.toLowerCase();
    
    if (['de', 'en', 'fr', 'it'].includes(urlLang)) {
        return urlLang;
    }
    
    // Default to German
    return 'de';
}