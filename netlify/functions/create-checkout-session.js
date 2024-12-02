const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
    // Log request details for debugging
    console.log('Request details:', {
        method: event.httpMethod,
        headers: event.headers,
        path: event.path,
        body: event.body
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

        if (!data.quantity || data.quantity < 1) {
            throw new Error('Invalid quantity');
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: data.priceId,
                quantity: data.quantity
            }],
            mode: 'payment',
            success_url: data.successUrl || `${process.env.URL}/success`,
            cancel_url: data.cancelUrl || `${process.env.URL}/cancel`,
            customer_email: data.customerEmail,
            metadata: {
                ...data.metadata,
                environment: process.env.NODE_ENV || 'development'
            }
        });

        console.log('Created checkout session:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                url: session.url,
                sessionId: session.id
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
