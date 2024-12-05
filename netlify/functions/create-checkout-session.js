const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': 'https://www.littlebighope.com',
    'Access-Control-Allow-Headers': 'Content-Type',
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
        const shippingRate = validateShippingRate(data.shippingRateId);
        
        // Get the country code from the shipping rate
        const countryCode = shippingRate.countries[0]; // Use first country as default

        // Create metadata object
        const metadata = {
            ...data.metadata,
            source: 'checkout',
            totalWeight: data.metadata?.totalWeight || '1000',
            productWeight: data.metadata?.productWeight || '900',
            packagingWeight: data.metadata?.packagingWeight || '100',
            planId: 'pln_kostenloser-zugang-84l80t3u', // Ensure this specific plan is always set
            countryCode: countryCode, // Add the country code to metadata
            language: data.language || 'de' // Default to German if not specified
        };
        
        console.log('Sending metadata to Stripe:', metadata);

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            locale: metadata.language,
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: shippingRate.countries
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
            metadata: metadata,
            payment_intent_data: {
                metadata: metadata  // Add metadata to payment intent as well
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
