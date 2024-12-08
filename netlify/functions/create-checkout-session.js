const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configure CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Product Configuration
const PRODUCT_CONFIG = {
    'course': {
        id: 'prc_course_digital',
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
        id: 'prc_cookbook_physical',
        type: 'book',
        requiresShipping: true,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    }
};

// Shipping rate configuration
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
            'BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'GR', 'ES', 'FR', 'HR', 
            'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 'PT', 'RO', 
            'SI', 'SK', 'FI', 'SE'
        ]
    }
};

exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    try {
        if (event.httpMethod !== 'POST') {
            throw new Error('Method not allowed');
        }

        const data = JSON.parse(event.body);
        console.log('Received checkout request:', data);

        // Prepare session parameters
        const sessionParams = {
            payment_method_types: ['card'],
            line_items: [{
                price: data.priceId,
                quantity: 1
            }],
            mode: 'payment',
            success_url: data.successUrl || `${process.env.SITE_URL}/vielen-dank-email`,
            cancel_url: data.cancelUrl || `${process.env.SITE_URL}/produkte`,
            metadata: {
                ...data.metadata,
                memberstackUserId: data.memberstackUserId,
                productType: data.productType,
                type: data.type,
                language: data.language
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required'
        };

        // Add shipping if required
        if (data.requiresShipping) {
            sessionParams.shipping_address_collection = {
                allowed_countries: data.shippingRateId === 'shr_1QScOlJRMXFic4sW8MHW0kq7' 
                    ? ['BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'GR', 'ES', 'FR', 'HR', 'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SI', 'SK', 'FI', 'SE']
                    : [data.metadata.countryCode]
            };
            
            sessionParams.shipping_options = [{
                shipping_rate: data.shippingRateId
            }];
        }

        console.log('Creating checkout session with params:', sessionParams);

        const session = await stripe.checkout.sessions.create(sessionParams);
        console.log('Checkout session created:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                id: session.id
            })
        };

    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: error.statusCode || 500,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
