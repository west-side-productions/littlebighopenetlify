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

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log('Received request:', event.body);
        
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('Missing STRIPE_SECRET_KEY environment variable');
        }

        const data = JSON.parse(event.body);
        console.log('Parsed request data:', data);
        
        // Validate required fields
        if (!data.priceId) {
            throw new Error('Missing priceId');
        }
        if (!data.shippingRateId) {
            throw new Error('Missing shippingRateId');
        }

        // Validate shipping rate
        const shippingRate = validateShippingRate(data.shippingRateId);
        console.log('Validated shipping rate:', shippingRate);

        // Create Stripe checkout session
        console.log('Creating checkout session with params:', {
            priceId: data.priceId,
            shippingRateId: data.shippingRateId,
            customerEmail: data.customerEmail,
            metadata: data.metadata
        });

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: shippingRate.countries
            },
            line_items: [{
                price: data.priceId,
                quantity: 1
            }],
            shipping_options: [{
                shipping_rate: data.shippingRateId
            }],
            customer_email: data.customerEmail || undefined,
            metadata: {
                ...data.metadata,
                totalWeight: data.metadata?.totalWeight || '1000',
                productWeight: data.metadata?.productWeight || '900',
                packagingWeight: data.metadata?.packagingWeight || '100'
            },
            success_url: process.env.SUCCESS_URL || 'https://lillebighope.com/success',
            cancel_url: process.env.CANCEL_URL || 'https://lillebighope.com/cancel'
        });

        console.log('Created checkout session:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: session.url })
        };
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
