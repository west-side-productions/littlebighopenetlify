const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { 
            orderId, 
            shippingCost, 
            country, 
            customerId,
            paymentIntentId,
            totalAmount 
        } = JSON.parse(event.body);

        console.log('Processing shipping for order:', orderId);

        // Create a new payment intent for shipping
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(shippingCost * 100), // Convert to cents
            currency: 'eur',
            customer: customerId,
            metadata: {
                order_id: orderId,
                shipping_country: country,
                original_payment_intent: paymentIntentId,
                type: 'shipping_charge'
            },
            description: `Shipping charge for order ${orderId} to ${country}`,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        console.log('Created shipping payment intent:', paymentIntent.id);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                paymentIntentId: paymentIntent.id,
                clientSecret: paymentIntent.client_secret
            })
        };
    } catch (error) {
        console.error('Error processing shipping:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to process shipping charge',
                details: error.message
            })
        };
    }
};
