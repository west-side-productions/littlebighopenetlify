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

        // First, retrieve the original payment intent
        const originalPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Update the original payment intent with shipping
        const updatedPaymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
            amount: Math.round(totalAmount * 100), // Convert to cents
            shipping: {
                address: {
                    country: country
                },
                name: originalPaymentIntent.shipping?.name || 'Customer',
                carrier: 'Standard Shipping',
                tracking_number: orderId
            },
            metadata: {
                order_id: orderId,
                shipping_cost: shippingCost,
                shipping_country: country,
                total_amount: totalAmount
            }
        });

        console.log('Updated payment intent with shipping:', updatedPaymentIntent.id);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                paymentIntentId: updatedPaymentIntent.id,
                shippingCost: shippingCost,
                totalAmount: totalAmount
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
