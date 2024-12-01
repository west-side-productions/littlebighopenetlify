const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const EU_COUNTRIES = ['BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

exports.handler = async function(event, context) {
    console.log('Function called with method:', event.httpMethod);
    
    // Validate Stripe key
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY is not set in environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Server configuration error - Stripe key not set'
            })
        };
    }

    try {
        const data = JSON.parse(event.body);
        console.log('Received data:', data);

        // Handle Memberstack webhook events
        if (data.event && data.event.startsWith('member.')) {
            console.log('Processing Memberstack webhook:', data.event);
            // Handle the webhook event
            return {
                statusCode: 200,
                body: JSON.stringify({ received: true })
            };
        }

        // Handle shipping rate requests
        if (data.type === 'shipping_rate.calculate') {
            console.log('Calculating shipping rates');
            const address = data.shipping_address || {};
            const country = address.country || '';

            let shippingRate;
            if (country === 'AT') {
                shippingRate = {
                    amount: 500,
                    currency: 'eur',
                    description: 'Standard Shipping (Austria)',
                    delivery_estimate: {
                        minimum: { value: 3, unit: 'business_day' },
                        maximum: { value: 5, unit: 'business_day' }
                    }
                };
            } else if (country === 'DE') {
                shippingRate = {
                    amount: 1000,
                    currency: 'eur',
                    description: 'Standard Shipping (Germany)',
                    delivery_estimate: {
                        minimum: { value: 3, unit: 'business_day' },
                        maximum: { value: 5, unit: 'business_day' }
                    }
                };
            } else if (EU_COUNTRIES.includes(country)) {
                shippingRate = {
                    amount: 1000,
                    currency: 'eur',
                    description: 'Standard Shipping (EU)',
                    delivery_estimate: {
                        minimum: { value: 5, unit: 'business_day' },
                        maximum: { value: 7, unit: 'business_day' }
                    }
                };
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: 'Shipping not available for this country'
                    })
                };
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    shipping_rate: shippingRate
                })
            };
        }

        // Handle shipping requests
        if (event.httpMethod === 'POST') {
            console.log('Shipping function called');
            
            if (data.action === 'get_rates') {
                console.log('Getting shipping rates');
                
                // Return predefined shipping rates
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: true,
                        shippingRates: [
                            {
                                displayName: 'Standard Shipping (Austria)',
                                amount: 500, // €5.00
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
                                displayName: 'Standard Shipping (Germany)',
                                amount: 1000, // €10.00
                                metadata: {
                                    type: 'standard',
                                    country: 'DE'
                                },
                                deliveryEstimate: {
                                    minimum: { value: 3, unit: 'business_day' },
                                    maximum: { value: 5, unit: 'business_day' }
                                },
                                countries: ['DE']
                            },
                            {
                                displayName: 'Standard Shipping (EU)',
                                amount: 1000, // €10.00
                                metadata: {
                                    type: 'standard',
                                    country: 'EU'
                                },
                                deliveryEstimate: {
                                    minimum: { value: 5, unit: 'business_day' },
                                    maximum: { value: 7, unit: 'business_day' }
                                },
                                countries: ['BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
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
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid request type' })
        };

    } catch (error) {
        console.error('Error processing request:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};
