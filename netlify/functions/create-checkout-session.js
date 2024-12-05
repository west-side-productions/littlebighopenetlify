const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': 'https://www.littlebighope.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
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

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            locale: 'de',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['AT', 'GB', 'SG', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
                    'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
            },
            line_items: [{
                price: data.priceId,
                quantity: 1
            }],
            shipping_options: [
                { shipping_rate: 'shr_1QScKFJRMXFic4sW9e80ABBp' },  // AT €7.28
                { shipping_rate: 'shr_1QScMXJRMXFic4sWih6q9v36' },  // GB €20.72
                { shipping_rate: 'shr_1QScNqJRMXFic4sW3NVUUckl' },  // SG €36.53
                { shipping_rate: 'shr_1QScOlJRMXFic4sW8MHW0kq7' }   // EU €20.36
            ],
            success_url: 'https://www.littlebighope.com/vielen-dank-email',
            cancel_url: 'https://www.littlebighope.com/produkte',
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
            body: JSON.stringify({ sessionId: session.id })
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
