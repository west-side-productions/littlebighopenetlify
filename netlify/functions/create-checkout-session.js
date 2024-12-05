const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': 'https://www.littlebighope.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Shipping rate to country mapping
const SHIPPING_RATE_COUNTRIES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': ['AT'],  // Austria €7.28
    'shr_1QScMXJRMXFic4sWih6q9v36': ['GB'],  // UK €20.72
    'shr_1QScNqJRMXFic4sW3NVUUckl': ['SG'],  // Singapore €36.53
    'shr_1QScOlJRMXFic4sW8MHW0kq7': [        // EU €20.36
        'BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'GR', 'ES', 'FR', 'HR', 
        'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 'PT', 'RO', 
        'SI', 'SK', 'FI', 'SE'
    ]
};

// Get allowed countries for shipping
const getAllowedCountries = () => {
    return Object.values(SHIPPING_RATE_COUNTRIES).flat();
};

// Validate shipping rate for allowed countries
const validateShippingRate = (shippingRateId) => {
    return SHIPPING_RATE_COUNTRIES.hasOwnProperty(shippingRateId);
};

exports.handler = async (event, context) => {
    // Log request details for debugging
    console.log('Request details:', {
        method: event.httpMethod,
        headers: event.headers,
        path: event.path
    });

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                error: 'Method not allowed',
                allowedMethods: ['POST', 'OPTIONS']
            })
        };
    }

    try {
        const data = JSON.parse(event.body);
        console.log('Received checkout request:', data);

        // Validate required fields
        if (!data.priceId) {
            throw new Error('Missing required field: priceId');
        }
        if (!data.customerEmail) {
            throw new Error('Missing required field: customerEmail');
        }
        if (data.metadata && typeof data.metadata !== 'object') {
            throw new Error('Invalid metadata format');
        }
        if (!data.shippingRateId) {
            throw new Error('Missing required field: shippingRateId');
        }

        // Validate shipping rate
        if (!validateShippingRate(data.shippingRateId)) {
            throw new Error('Invalid shipping rate for selected country');
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            locale: 'de',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: SHIPPING_RATE_COUNTRIES[data.shippingRateId]
            },
            line_items: [{
                price: data.priceId,
                quantity: 1
            }],
            shipping_options: [
                { shipping_rate: data.shippingRateId }  // Use the selected shipping rate
            ],
            success_url: data.successUrl || 'https://www.littlebighope.com/vielen-dank-email',
            cancel_url: data.cancelUrl || 'https://www.littlebighope.com/produkte',
            customer_email: data.customerEmail,
            metadata: {
                ...(data.metadata || {}),
                source: 'checkout'
            },
            automatic_tax: { enabled: true }
        });

        console.log('Created checkout session:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                sessionId: session.id,
                url: session.url
            })
        };

    } catch (error) {
        console.error('Checkout error:', error);
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
