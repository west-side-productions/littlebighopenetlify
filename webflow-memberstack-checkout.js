// Configuration
const CONFIG = {
    stripePublicKey: 'pk_test_51Nw2OWJRMXFic4sWEgOcPYEYqaGDuuGWGKqKB4fMVQcRJDqQKzZj9qEtgVkrKKTXgV4rFEEYBxh6DQWHZaZRaOWE00rPmWEbFm',
    defaultShippingRate: 'shr_1QScOlJRMXFic4sW8MHW0kq7',
    defaultLanguage: 'de',
    defaultCountry: 'DE'
};

// Configuration for the checkout buttons
const CHECKOUT_BUTTON_IDS = {
    book: {
        de: '#checkout-button-book-de',
        en: '#checkout-button-book-en'
    },
    course: {
        de: '#checkout-button-course-de',
        en: '#checkout-button-course-en'
    },
    coaching: {
        de: '#checkout-button-coaching-de',
        en: '#checkout-button-coaching-en'
    }
};

// Stripe price IDs for each product type and language
const STRIPE_PRICE_IDS = {
    book: {
        de: 'price_1OGNVeF5zGhwkwfcPPJUxXxR',
        en: 'price_1OGNVeF5zGhwkwfcPPJUxXxR'
    },
    course: {
        de: 'price_1OGNVeF5zGhwkwfcPPJUxXxR',
        en: 'price_1OGNVeF5zGhwkwfcPPJUxXxR'
    },
    coaching: {
        de: 'price_1OGNVeF5zGhwkwfcPPJUxXxR',
        en: 'price_1OGNVeF5zGhwkwfcPPJUxXxR'
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
    try {
        console.log('Initializing checkout buttons');
        
        // Initialize buttons for each product type and language
        Object.entries(CHECKOUT_BUTTON_IDS).forEach(([productType, languageButtons]) => {
            Object.entries(languageButtons).forEach(([language, buttonSelector]) => {
                const button = document.querySelector(buttonSelector);
                if (button) {
                    console.log(`Found button for ${productType} (${language}):`, button);
                    button.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await handleCheckout(productType, language);
                    });
                }
            });
        });
    } catch (error) {
        console.error('Error initializing checkout buttons:', error);
    }
}

async function handleCheckout(productType, language) {
    try {
        console.log(`Starting checkout for ${productType} in ${language}`);
        
        // Get current member
        const member = await $memberstackDom.getCurrentMember();
        if (!member) {
            console.log('No member found, redirecting to login');
            window.location.href = '/login';
            return;
        }

        // Get price ID for the product and language
        const priceId = STRIPE_PRICE_IDS[productType]?.[language];
        if (!priceId) {
            throw new Error(`No price ID found for ${productType} in ${language}`);
        }

        // Prepare checkout data
        const checkoutData = {
            type: productType,
            priceId: priceId,
            email: member.email,
            successUrl: window.location.origin + '/success',
            cancelUrl: window.location.origin + '/cancel'
        };

        console.log('Sending checkout request with data:', checkoutData);

        // Create checkout session
        const response = await fetch('https://lbh-backend-c6e8366c60e2.herokuapp.com/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkoutData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Checkout session creation failed: ${errorData.message || response.statusText}`);
        }

        const { url } = await response.json();
        if (!url) {
            throw new Error('No checkout URL received from server');
        }

        // Redirect to Stripe checkout
        window.location.href = url;

    } catch (error) {
        console.error('Checkout error:', error);
        alert('There was an error starting the checkout. Please try again.');
    }
}

// Initialize buttons when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeCheckoutButtons);