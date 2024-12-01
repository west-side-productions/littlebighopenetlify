const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { orderId, shippingCost, country, customerId, paymentIntentId } = JSON.parse(event.body);

        // Create a new PaymentIntent for shipping
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(shippingCost * 100), // Convert to cents
            currency: 'eur',
            customer: customerId,
            metadata: {
                order_id: orderId,
                shipping_for_payment: paymentIntentId,
                shipping_country: country
            },
            description: `Shipping to ${country}`,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true,
                paymentIntentId: paymentIntent.id
            })
        };
    } catch (error) {
        console.error('Shipping processing error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to process shipping payment',
                message: error.message
            })
        };
    }
};
