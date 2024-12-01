const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
    console.log('Shipping function called');
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        console.log('Received data:', data);

        if (data.action === 'get_rates') {
            console.log('Getting shipping rates');
            
            // Return predefined shipping rates
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    shippingRates: [
                        {
                            displayName: 'Standard Shipping (Austria)',
                            amount: 500,
                            metadata: {
                                type: 'standard',
                                country: 'AT'
                            },
                            deliveryEstimate: {
                                minimum: { value: 3, unit: 'business_day' },
                                maximum: { value: 5, unit: 'business_day' }
                            },
                            countries: ['AT']
                        },
                        {
                            displayName: 'Standard Shipping (EU)',
                            amount: 1000,
                            metadata: {
                                type: 'standard',
                                country: 'EU'
                            },
                            deliveryEstimate: {
                                minimum: { value: 5, unit: 'business_day' },
                                maximum: { value: 7, unit: 'business_day' }
                            },
                            countries: ['DE', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
                        },
                        {
                            displayName: 'International Shipping',
                            amount: 1500,
                            metadata: {
                                type: 'international'
                            },
                            deliveryEstimate: {
                                minimum: { value: 7, unit: 'business_day' },
                                maximum: { value: 14, unit: 'business_day' }
                            }
                        }
                    ]
                })
            };
        } else if (data.action === 'process_payment') {
            console.log('Processing payment with shipping');
            
            const { 
                orderId, 
                shippingCost,
                baseAmount,
                totalAmount,
                country, 
                customerId,
                paymentIntentId
            } = data;

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

        } else {
            throw new Error('Invalid action specified');
        }
    } catch (error) {
        console.error('Error in shipping function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to process shipping',
                details: error.message
            })
        };
    }
};
