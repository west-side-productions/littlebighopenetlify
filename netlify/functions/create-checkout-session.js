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

// Helper function to validate shipping rate against country
const validateShippingRate = (shippingRateId) => {
    const rate = SHIPPING_RATES[shippingRateId];
    if (!rate) {
        throw new Error(`Invalid shipping rate: ${shippingRateId}`);
    }
    return rate;
};

exports.handler = async function(event, context) {
    // Log request details for debugging
    console.log('Incoming request:', {
        method: event.httpMethod,
        headers: event.headers,
        path: event.path,
        body: event.body ? JSON.parse(event.body) : null
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
        
        // Only require shipping rate for physical products
        if ((data.metadata?.productType === 'physical' || data.metadata?.productType === 'bundle') && !data.shippingRateId) {
            throw new Error('Missing required field: shippingRateId');
        }

        // Validate shipping rate if provided
        let shippingRate;
        if (data.shippingRateId) {
            shippingRate = validateShippingRate(data.shippingRateId);
        }

        // Create metadata object with all necessary information
        const metadata = {
            ...data.metadata,
            source: 'checkout',
            totalWeight: data.metadata?.totalWeight || '1000',
            productWeight: data.metadata?.productWeight || '900',
            packagingWeight: data.metadata?.packagingWeight || '100',
            planId: data.metadata?.planId || 'pln_kostenloser-zugang-84l80t3u',
            countryCode: shippingRate?.countries[0] || 'DE', // Default to DE for digital products
            language: data.language || 'de'
        };

        console.log('Sending metadata to Stripe:', metadata);

        // Prepare line items
        const lineItems = [{
            price: data.priceId,
            quantity: 1
        }];

        // Prepare session data
        const sessionData = {
            payment_method_types: ['card'],
            customer_email: data.customerEmail,
            line_items: lineItems,
            mode: 'payment',
            success_url: `${data.successUrl || 'https://www.littlebighope.com/vielen-dank-email'}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: data.cancelUrl || 'https://www.littlebighope.com/produkte',
            metadata: metadata,
            payment_intent_data: {
                metadata: metadata  // Add metadata to payment intent as well
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            locale: data.language || 'de',
            automatic_tax: { enabled: true }
        };

        // Add shipping options only for physical products
        if (data.metadata?.productType === 'physical' || data.metadata?.productType === 'bundle') {
            sessionData.shipping_options = [{
                shipping_rate: data.shippingRateId
            }];
            sessionData.shipping_address_collection = {
                allowed_countries: shippingRate.countries
            };
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create(sessionData);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                sessionId: session.id,
                publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
            })
        };

    } catch (error) {
        console.error('Stripe session creation failed:', error);
        return {
            statusCode: error.statusCode || 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                type: error.type,
                code: error.code
            })
        };
    }
};
