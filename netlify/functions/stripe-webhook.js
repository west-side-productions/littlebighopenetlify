const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    try {
        // Get the raw body string
        const rawBody = event.body;
        const signature = event.headers['stripe-signature'];

        let stripeEvent;
        
        try {
            // Verify and construct the webhook event
            stripeEvent = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: `Webhook signature verification failed: ${err.message}`
                })
            };
        }

        // Handle specific event types
        switch (stripeEvent.type) {
            case 'checkout.session.completed':
                const session = stripeEvent.data.object;
                
                // Log the successful checkout
                console.log('Checkout completed:', {
                    sessionId: session.id,
                    customerId: session.customer,
                    amount: session.amount_total,
                    metadata: session.metadata
                });

                // Here you can add additional processing:
                // - Update order status in your database
                // - Send confirmation emails
                // - Update inventory
                // - etc.

                break;

            case 'payment_intent.succeeded':
                const paymentIntent = stripeEvent.data.object;
                console.log('Payment succeeded:', paymentIntent.id);
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = stripeEvent.data.object;
                console.error('Payment failed:', {
                    paymentIntentId: failedPayment.id,
                    error: failedPayment.last_payment_error
                });
                break;

            // Add more event types as needed

            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('Webhook error:', error.message);
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: `Webhook error: ${error.message}`
            })
        };
    }
};
