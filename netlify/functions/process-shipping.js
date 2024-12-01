const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { 
            orderId, 
            shippingCost,
            baseAmount,
            totalAmount,
            country, 
            customerId,
            paymentIntentId
        } = JSON.parse(event.body);

        console.log('Processing shipping for order:', orderId);

        // First, retrieve the original payment intent
        const originalIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Update the payment intent with the total amount and shipping details
        const updatedIntent = await stripe.paymentIntents.update(paymentIntentId, {
            amount: Math.round(totalAmount * 100), // Total amount in cents
            metadata: {
                order_id: orderId,
                shipping_cost: shippingCost,
                base_amount: baseAmount,
                shipping_country: country
            },
            shipping: {
                address: {
                    country: country
                },
                name: originalIntent.shipping?.name || 'Customer',
                carrier: 'Standard Shipping',
                tracking_number: orderId
            }
        });

        // Create a shipping fee as a separate line item
        const shippingFee = await stripe.charges.create({
            amount: Math.round(shippingCost * 100),
            currency: 'eur',
            customer: customerId,
            description: `Shipping fee for order ${orderId} to ${country}`,
            metadata: {
                order_id: orderId,
                type: 'shipping_fee'
            }
        });

        console.log('Updated payment intent and created shipping fee:', {
            paymentIntentId: updatedIntent.id,
            shippingFeeId: shippingFee.id
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                paymentIntentId: updatedIntent.id,
                shippingFeeId: shippingFee.id,
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
