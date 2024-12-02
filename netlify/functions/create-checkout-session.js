const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    maxNetworkRetries: 2,
    timeout: 20000,
    host: 'api.stripe.com',
    protocol: 'https',
    telemetry: false
});

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '2592000',
    'Content-Type': 'application/json'
};

// Error response helper
const errorResponse = (statusCode, message, details = null) => ({
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
        error: message,
        details: details || message
    })
});

// Success response helper
const successResponse = (data) => ({
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
});

exports.handler = async (event, context) => {
    console.log('Request received:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers,
        body: event.body ? JSON.parse(event.body) : null
    });

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    // Validate request method
    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'Method Not Allowed');
    }

    try {
        // Parse and validate the request body
        const data = JSON.parse(event.body);
        
        if (!data.priceId) {
            return errorResponse(400, 'Missing required field: priceId');
        }

        // Create the checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: data.priceId,
                quantity: data.quantity || 1
            }],
            mode: 'payment',
            success_url: data.successUrl || `${process.env.URL}/success`,
            cancel_url: data.cancelUrl || `${process.env.URL}/cancel`,
            customer_email: data.customerEmail,
            metadata: data.metadata || {},
            shipping_options: [{
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: 0,
                        currency: 'eur',
                    },
                    display_name: 'Digital Delivery',
                    delivery_estimate: {
                        minimum: {
                            unit: 'business_day',
                            value: 1,
                        },
                        maximum: {
                            unit: 'business_day',
                            value: 1,
                        },
                    },
                },
            }],
        });

        return successResponse({ url: session.url });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        
        return errorResponse(
            500,
            'Failed to create checkout session',
            error.message
        );
    }
};
