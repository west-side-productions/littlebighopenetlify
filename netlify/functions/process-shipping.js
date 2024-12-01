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

        console.log('Processing shipping request:', {
            orderId,
            shippingCost,
            country,
            customerId: customerId || 'Not provided',
            paymentIntentId: paymentIntentId || 'Not provided'
        });

        // If we have a payment intent, update it with shipping details
        if (paymentIntentId) {
            console.log('Updating existing payment intent with shipping details');
            
            const originalIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            
            const updatedIntent = await stripe.paymentIntents.update(paymentIntentId, {
                amount: Math.round(totalAmount * 100),
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

            // If we have a customer ID, create a separate shipping charge
            if (customerId) {
                console.log('Creating separate shipping charge');
                
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

                console.log('Shipping fee created:', shippingFee.id);
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        paymentIntentId: updatedIntent.id,
                        shippingFeeId: shippingFee.id,
                        totalAmount: totalAmount
                    })
                };
            }
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    paymentIntentId: updatedIntent.id,
                    totalAmount: totalAmount
                })
            };
        }
        
        // Initial shipping processing (before checkout)
        console.log('Initial shipping processing');
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                shippingCost: shippingCost,
                totalAmount: totalAmount,
                orderId: orderId
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
