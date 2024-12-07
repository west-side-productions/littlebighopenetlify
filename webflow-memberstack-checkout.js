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
    digital: {
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
    'physical-book': {
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

// Product type to version mapping
const PRODUCT_VERSION_MAP = {
    'course': 'digital',
    'book': 'physical-book'
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
    const version = PRODUCT_VERSION_MAP[productType];
    const productConfig = PRODUCT_CONFIG[version];
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
async function startCheckout(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('Invalid checkout configuration - configuration object required');
    }
    
    if (!config.version || typeof config.version !== 'string') {
        throw new Error('Invalid checkout configuration - version must be a string');
    }

    const productConfig = PRODUCT_CONFIG[config.version];
    if (!productConfig) {
        throw new Error(`Invalid product version: ${config.version}`);
    }

    try {
        // Get language and price ID
        const language = await getPreferredLanguage();
        const priceId = productConfig.prices[language.detected] || productConfig.prices.de;
        
        if (!priceId) {
            throw new Error(`No price configuration found for version: ${config.version}`);
        }

        // Create the base payload with version at root level
        const payload = {
            version: config.version,
            priceId: priceId,
            customerEmail: config.customerEmail || '',
            language: language.detected || 'de',
            successUrl: 'https://www.littlebighope.com/vielen-dank-email',
            cancelUrl: 'https://www.littlebighope.com/produkte',
            metadata: {
                source: window.location.pathname,
                version: config.version,
                type: productConfig.type,
                language: language.detected || 'de',
                countryCode: 'DE',
                requiresShipping: productConfig.requiresShipping || false,
                shippingClass: 'standard',
                dimensions: null,
                productWeight: undefined,
                packagingWeight: 0,
                totalWeight: NaN,
                planId: productConfig.memberstackPlanId
            }
        };

        // Add memberstackId to metadata if available
        if (config.metadata?.memberstackId) {
            payload.metadata.memberstackUserId = config.metadata.memberstackId;
        }

        // Only add shipping if it's required
        if (productConfig.requiresShipping && config.shippingRateId) {
            payload.shippingRateId = config.shippingRateId;
        }

        // Log the exact payload being sent
        console.log('Creating checkout session:', {
            payload,
            stringifiedPayload: JSON.stringify(payload),
            version: payload.version,
            hasVersion: 'version' in payload,
            versionType: typeof payload.version,
            versionValue: payload.version
        });

        const response = await fetch('https://lillebighopefunctions.netlify.app/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // Log raw response for debugging
        console.log('Raw response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Checkout session creation failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                originalPayload: payload
            });
            throw new Error(`Failed to create checkout session: ${response.status}`);
        }

        const session = await response.json();
        const stripe = Stripe(CONFIG.stripePublicKey);
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            throw result.error;
        }
    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
    }
}

async function handleCheckout(event) {
    event.preventDefault();
    
    try {
        const member = await window.MemberStack.getCurrentMember();
        log('Current member:', member?.id);
        
        // Get product configuration from the button's data attributes
        const button = event.currentTarget;
        const productType = button.getAttribute('data-product-type');
        
        log('Product type from button:', {
            productType,
            buttonElement: button,
            buttonDataset: button.dataset,
            buttonAttributes: {
                'data-product-type': button.getAttribute('data-product-type'),
                'data-checkout-button': button.getAttribute('data-checkout-button')
            }
        });
        
        if (!productType) {
            throw new Error('Product type not found on button');
        }
        
        // Map to Stripe version
        const version = PRODUCT_VERSION_MAP[productType];
        log('Version mapping:', {
            originalProductType: productType,
            mappedVersion: version,
            availableVersions: Object.keys(PRODUCT_CONFIG),
            versionMap: PRODUCT_VERSION_MAP
        });

        const productConfig = PRODUCT_CONFIG[version];
        if (!productConfig) {
            console.error(`Invalid product configuration for type: ${productType}, version: ${version}`);
            return;
        }
        
        log('Using product configuration:', {
            productType,
            version,
            config: productConfig
        });
        
        // Get user's preferred language
        const language = await getPreferredLanguage();
        
        // Prepare checkout configuration
        const checkoutConfig = {
            version: version, // Explicitly set version
            productType: productType,
            customerEmail: member?.email || '',
            language: language.detected || 'de',
            metadata: {
                memberstackId: member?.id,
                version: version
            }
        };
        
        // Add shipping if required
        if (productConfig.requiresShipping) {
            const shippingSelect = document.querySelector('select[name="shipping-rate"]');
            if (!shippingSelect?.value) {
                throw new Error('Please select a shipping option');
            }
            checkoutConfig.shippingRateId = shippingSelect.value;
        }
        
        log('Creating checkout session with config:', {
            checkoutConfig,
            hasVersion: 'version' in checkoutConfig,
            version: checkoutConfig.version
        });

        await startCheckout(checkoutConfig);
        
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Checkout error: ' + error.message);
    }
}

// Initialize checkout buttons
async function initializeCheckoutButtons() {
    const buttons = document.querySelectorAll('[data-checkout-button]');
    log(`Found ${buttons.length} checkout buttons`);
    
    buttons.forEach(button => {
        // Remove existing listeners by cloning
        const newButton = button.cloneNode(true);
        
        // Explicitly copy over the data attributes
        const productType = button.getAttribute('data-product-type');
        if (productType) {
            newButton.setAttribute('data-product-type', productType);
        }
        
        log(`Setting up button for product type: ${productType}`);
        
        button.parentNode.replaceChild(newButton, button);
        
        // Add event listener to the new button
        newButton.addEventListener('click', handleCheckout);
    });
    log('Checkout buttons initialized');
}

// Handle membershome functionality
async function handleMembershome() {
    log('Handling membershome...');
    const member = await window.MemberStack.getCurrentMember();
    
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

// Track Memberstack initialization
async function initializeMemberstack() {
    try {
        // Wait for Memberstack to be ready
        await new Promise((resolve) => {
            if (window.MemberStack) {
                resolve();
            } else {
                document.addEventListener('memberstack.ready', resolve);
            }
        });

        if (!window.MemberStack) {
            console.warn('Memberstack not available');
            return false;
        }

        log('Memberstack loaded, initializing...');
        
        // Initialize Memberstack client
        window.memberstack = {
            getCurrentMember: async () => {
                try {
                    const member = await window.MemberStack.getCurrentMember();
                    return member;
                } catch (error) {
                    console.warn('Error getting current member:', error);
                    return null;
                }
            },
            getMemberJSON: async () => {
                try {
                    const member = await window.MemberStack.getCurrentMember();
                    return member?.data || null;
                } catch (error) {
                    console.warn('Error getting member JSON:', error);
                    return null;
                }
            },
            updateMember: async (data) => {
                try {
                    await window.MemberStack.updateMember({ data });
                    return true;
                } catch (error) {
                    console.warn('Error updating member:', error);
                    return false;
                }
            }
        };

        // Add member update handler
        try {
            window.MemberStack.onMemberUpdate((member) => {
                log('Member updated:', member);
                checkLanguageRedirect();
            });
            log('Member update listener added');
        } catch (error) {
            console.warn('Failed to add member update listener:', error);
        }

        log('Memberstack initialized');
        return true;
    } catch (error) {
        console.error('Error initializing Memberstack:', error);
        return false;
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
            shippingSelects: document.querySelectorAll('select[name="Versand-nach"]'),
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
    
    try {
        // 1. Check Memberstack
        log('Checking Memberstack language...');
        if (window.MemberStack) {
            const member = await window.MemberStack.getCurrentMember();
            if (member?.data?.language) {
                log('Found language in Memberstack:', member.data.language);
                return {
                    source: 'memberstack',
                    detected: member.data.language
                };
            }
        }
        
        // 2. Check Webflow locale
        log('Checking Webflow locale...');
        const webflowLocale = document.documentElement.getAttribute('lang');
        if (webflowLocale) {
            log('Found language in Webflow:', webflowLocale);
            return {
                source: 'webflow',
                detected: webflowLocale
            };
        }
        
        // 3. Check URL path
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            const firstPart = pathParts[0].toLowerCase();
            if (['de', 'en', 'fr', 'it'].includes(firstPart)) {
                log('Found language in URL:', firstPart);
                return {
                    source: 'url',
                    detected: firstPart
                };
            }
        }
        
        // 4. Default to German
        log('No language detected, defaulting to de');
        return {
            source: 'default',
            detected: 'de'
        };
        
    } catch (error) {
        console.error('Error detecting language:', error);
        return {
            source: 'error',
            detected: 'de'
        };
    }
}