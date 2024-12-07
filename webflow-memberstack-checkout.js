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
    'digital': {
        version: 'digital',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        requiresShipping: false
    },
    'physical-book': {
        version: 'physical-book',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        requiresShipping: true,
        shippingClass: 'standard',
        totalWeight: 500,
        packagingWeight: 50,
        dimensions: {
            length: 25,
            width: 18,
            height: 2
        }
    }
};

// Button type to Stripe version mapping
const BUTTON_VERSION_MAP = {
    'course': 'digital',
    'book': 'physical-book',
    'bundle': 'bundle'
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
async function handleCheckout(event) {
    // Ensure we prevent the default form submission
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    try {
        const member = await getCurrentMember();
        log('Current member:', member?.id || 'No member found');
        
        // Get button data
        const button = event.currentTarget;
        if (!button) {
            throw new Error('No button found in event');
        }
        
        const buttonType = button.getAttribute('data-product-type');
        if (!buttonType || !BUTTON_VERSION_MAP[buttonType]) {
            console.error('Invalid button type:', {
                buttonType: button.getAttribute('data-product-type'),
                availableTypes: Object.keys(BUTTON_VERSION_MAP),
                buttonElement: button
            });
            throw new Error(`Invalid button type: ${button.getAttribute('data-product-type')}`);
        }
        
        const version = BUTTON_VERSION_MAP[buttonType];
        
        log('Button data:', {
            buttonType,
            version,
            buttonElement: button,
            buttonDataset: button.dataset,
            buttonAttributes: {
                'data-product-type': buttonType,
                'data-checkout-button': button.getAttribute('data-checkout-button')
            }
        });
        
        const productConfig = PRODUCT_CONFIG[version];
        if (!productConfig) {
            console.error(`Invalid version: ${version}`);
            return;
        }
        
        log('Using configuration:', {
            version,
            config: productConfig,
            buttonType: version
        });
        
        // Create checkout configuration
        const checkoutConfig = {
            version: version, // Ensure version is at the root level
            customerEmail: member?.email || '',
            metadata: getCheckoutMetadata(version, {
                memberstackId: member?.id,
                planId: member?.planId
            })
        };
        
        // Add shipping if required
        if (productConfig.requiresShipping) {
            const shippingSelect = document.querySelector('select[name="shipping-rate"]');
            if (!shippingSelect?.value) {
                throw new Error('Please select a shipping option');
            }
            checkoutConfig.shippingRateId = shippingSelect.value;
        }
        
        log('Starting checkout with config:', {
            checkoutConfig,
            hasVersion: 'version' in checkoutConfig,
            version: checkoutConfig.version,
            versionType: typeof checkoutConfig.version
        });

        await startCheckout(checkoutConfig);
        
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Checkout error: ' + error.message);
    }
}


// Initialize checkout buttons
function initializeCheckoutButtons() {
    log('Initializing checkout buttons');
    const buttons = document.querySelectorAll('[data-checkout-button]');
    
    buttons.forEach(button => {
        // Remove any existing listeners first
        button.removeEventListener('click', handleCheckout);
        
        // Add the click event listener
        button.addEventListener('click', handleCheckout);
        
        // Prevent form submission on the button
        button.setAttribute('type', 'button');
        
        log('Initialized checkout button:', {
            button: button,
            version: button.getAttribute('data-product-type'),
            dataset: button.dataset
        });
    });
}

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCheckoutButtons);
} else {
    initializeCheckoutButtons();
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
    const shippingSelects = document.querySelectorAll('select[name="shipping-rate"]');
    log(`Found shipping selects: ${shippingSelects.length}`);

    shippingSelects.forEach(shippingSelect => {
        try {
            const productSection = shippingSelect.closest('[data-product-type]');
            const version = productSection?.querySelector('[data-product-type]')?.getAttribute('data-product-type') || 'physical-book';

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

// Update metadata for checkout
function getCheckoutMetadata(version, config = {}) {
    const metadata = {
        version: version,
        requiresShipping: PRODUCT_CONFIG[version]?.requiresShipping || false,
        shippingClass: 'standard',
        countryCode: 'DE',
        dimensions: PRODUCT_CONFIG[version]?.dimensions || null,
        productWeight: PRODUCT_CONFIG[version]?.totalWeight,
        packagingWeight: PRODUCT_CONFIG[version]?.packagingWeight || 0,
        totalWeight: calculateTotalWeight(PRODUCT_CONFIG[version]),
        language: getPreferredLanguage()
    };

    if (config.memberstackId) {
        metadata.memberstackUserId = config.memberstackId;
    }
    if (config.planId) {
        metadata.planId = config.planId;
    }
    if (config.source) {
        metadata.source = config.source;
    }

    return metadata;
}

// Handle membershome functionality
async function handleMembershome() {
    log('Handling membershome...');
    const member = await getCurrentMember();
    
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
                await startCheckout(config);
            } catch (error) {
                console.error('Error processing stored checkout:', error);
                // Redirect back to products page on error
                window.location.href = redirectUrl || '/produkte';
            }
        }
    }
}

// Initialize Memberstack
async function initializeMemberstack() {
    try {
        // Wait for Memberstack to be ready
        await new Promise((resolve) => {
            if (window.$memberstackDom) {
                resolve();
            } else {
                document.addEventListener('memberstack.ready', resolve);
            }
        });

        // Add member update listener
        if (typeof window.$memberstackDom?.listen === 'function') {
            window.$memberstackDom.listen('member.update', (event) => {
                log('Member updated:', event);
                // Additional logic for member updates
            });
        } else {
            console.warn('Memberstack listen method not available');
        }

        log('Memberstack initialized');
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
    try {
        log('Initializing checkout system...');
        
        // Check if we're on membershome
        const path = window.location.pathname;
        log(`Is on membershome: ${path.includes('membershome')} Path: ${path}`);
        
        // Find all required elements
        const elements = {
            checkoutButtons: document.querySelectorAll('[data-checkout-button]'),
            shippingSelects: document.querySelectorAll('select[name="shipping-rate"]'),
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
        
        // Initialize components
        await initializeShippingSelects();
        await initializeCheckoutButtons();
        await initializePriceElements();
        
        log('Checkout system initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize checkout system:', error);
        return false;
    }
}

// Document ready handler
document.addEventListener('DOMContentLoaded', async () => {
    log('DOM loaded, checking language...');
    await checkLanguageRedirect();
    
    // Initialize checkout system
    initializeCheckoutSystem().catch(error => {
        console.error('Failed to initialize checkout:', error);
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

// Function to get user's preferred language
async function getPreferredLanguage() {
    log('Starting language detection...');
    
    // Check Memberstack language first
    log('Checking Memberstack language...');
    try {
        const member = await getCurrentMember();
        if (member) {
            const memberstackLanguage = member.language;
            if (memberstackLanguage) {
                log('Found language in Memberstack:', memberstackLanguage);
                return {
                    source: 'memberstack',
                    detected: memberstackLanguage
                };
            }
        }
    } catch (error) {
        console.error('Error getting Memberstack language:', error);
    }

    // Check URL path
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const firstPathPart = pathParts[0]?.toLowerCase();
    
    if (['de', 'en', 'fr', 'it'].includes(firstPathPart)) {
        log('Language detection complete:', {
            source: 'url',
            detected: firstPathPart
        });
        return {
            source: 'url',
            detected: firstPathPart
        };
    }

    // Default to German
    log('Language detection complete:', {
        source: 'default',
        detected: 'de'
    });
    return {
        source: 'default',
        detected: 'de'
    };
}