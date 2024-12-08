const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Shipping rate configuration
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { 
        price: 728, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QScMXJRMXFic4sWih6q9v36': { 
        price: 2072, 
        label: 'Great Britain', 
        countries: ['GB']
    },
    'shr_1QScNqJRMXFic4sW3NVUUckl': { 
        price: 3500, 
        label: 'Singapore', 
        countries: ['SG']
    },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
        price: 2036, 
        label: 'European Union', 
        countries: ['BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
    }
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

// Helper function to validate shipping rate against country
const validateShippingRate = (shippingRateId) => {
    const rate = SHIPPING_RATES[shippingRateId];
    if (!rate) {
        throw new Error(`Invalid shipping rate: ${shippingRateId}`);
    }
    return rate;
};

exports.handler = async function(event, context) {
    console.log('=== Received Checkout Request ===');
    
    // Log request details for debugging
    console.log('Incoming request details:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers,
        bodyExists: !!event.body
    });

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    try {
        if (event.httpMethod !== 'POST') {
            throw new Error('Method not allowed');
        }

        // Parse the request body
        let data;
        try {
            data = JSON.parse(event.body);
            console.log('Received checkout data:', data);
        } catch (e) {
            console.error('Failed to parse request body:', e);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body: ' + e.message })
            };
        }

        // Validate required fields according to Stripe's API
        if (!data.line_items || !Array.isArray(data.line_items) || data.line_items.length === 0) {
            console.error('Missing or invalid line_items:', data);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'line_items must be a non-empty array' })
            };
        }

        if (!data.line_items[0].price) {
            console.error('Missing price in first line item:', data.line_items[0]);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Price is required in line items' })
            };
        }

        try {
            // Create Stripe checkout session
            const sessionParams = {
                mode: 'payment',
                payment_method_types: ['card'],
                line_items: data.line_items,
                success_url: data.success_url,
                cancel_url: data.cancel_url,
                customer_email: data.customer_email,
                locale: data.locale || 'de',
                allow_promotion_codes: true,
                billing_address_collection: 'required',
                metadata: data.metadata || {}
            };

            // Add shipping options if provided
            if (data.shipping_options) {
                sessionParams.shipping_options = data.shipping_options;
            }
            if (data.shipping_address_collection) {
                sessionParams.shipping_address_collection = data.shipping_address_collection;
            }

            console.log('Creating Stripe session with params:', sessionParams);
            const session = await stripe.checkout.sessions.create(sessionParams);
            console.log('Created Stripe session:', session.id);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    sessionId: session.id
                })
            };
        } catch (error) {
            console.error('Stripe session creation error:', error);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: error.message })
            };
        }
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal Server Error',
                message: error.message 
            })
        };
    }
};
