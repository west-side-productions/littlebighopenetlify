const stripe = require('stripe')('sk_test_51Q4ix1JRMXFic4sWYfmxVOxMxIuTLyUIRyIETvRNu3qj3oDaIhGZMH7or2yeJjbNRn4nEx9N1ROmf03u5LO83Ted00E1xgt9Da', {
    apiVersion: '2024-06-20',
    maxNetworkRetries: 2,
    timeout: 20000,
    host: 'api.stripe.com',
    protocol: 'https',
    telemetry: false
});

const endpointSecret = 'whsec_7d2a2050254d89b08f908ee743c34c4783ea1d4ee34b3fec5f354f563c967beb';

exports.handler = async function(event, context) {
    console.log('Request received:', event.httpMethod);
    console.log('Request body:', event.body);

    const sig = event.headers['stripe-signature'];

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({ error: 'Method not allowed' }) 
        };
    }

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    try {
        // If it's a webhook event
        if (sig) {
            const stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
            console.log('Webhook event:', stripeEvent.type);
            return {
                statusCode: 200,
                body: JSON.stringify({ received: true })
            };
        }

        // If it's a checkout request
        const { priceId, quantity, metadata } = JSON.parse(event.body);
        console.log('Creating checkout session for:', { priceId, quantity, metadata });
        
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: quantity
            }],
            success_url: 'http://localhost:8888/success',
            cancel_url: 'http://localhost:8888/cancel',
            metadata: metadata || {}
        });

        console.log('Checkout session created:', session.id);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                id: session.id, 
                url: session.url 
            })
        };
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: error.statusCode || 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                error: error.message,
                type: error.type,
                code: error.code
            })
        };
    }
};