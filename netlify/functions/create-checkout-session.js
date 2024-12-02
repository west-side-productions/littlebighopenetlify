const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Shipping rate configuration
const SHIPPING_RATES = {
    AT: { amount: 500, label: 'Austria Shipping' },  // €5.00
    DE: { amount: 1000, label: 'Germany Shipping' }, // €10.00
    CH: { amount: 1000, label: 'Switzerland Shipping' } // €10.00
};

exports.handler = async (event, context) => {
    // Handle CORS
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

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const data = JSON.parse(event.body);
        const { priceId, quantity, successUrl, cancelUrl, customerEmail, shipping, metadata } = data;

        // Validate required fields
        if (!priceId || !successUrl || !cancelUrl || !customerEmail || !shipping) {
            console.error('Missing required parameters:', { priceId, successUrl, cancelUrl, customerEmail, shipping });
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    received: { priceId, successUrl, cancelUrl, customerEmail, shipping }
                })
            };
        }

        // First, try to find or create a customer
        let customer;
        try {
            const customers = await stripe.customers.list({
                email: customerEmail,
                limit: 1
            });
            
            if (customers.data.length > 0) {
                customer = customers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: customerEmail,
                    metadata: {
                        memberstackUserId: metadata.memberstackUserId
                    }
                });
            }
        } catch (error) {
            console.error('Error finding/creating customer:', error);
            throw error;
        }

        console.log('Creating checkout session with:', { 
            priceId,
            successUrl,
            cancelUrl,
            customerEmail,
            shipping,
            metadata 
        });

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price: priceId,
                    quantity: quantity
                }
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            shipping_address_collection: {
                allowed_countries: ['AT', 'DE', 'CH']
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: shipping.weight <= 1000 ? 500 : 1000,
                            currency: 'eur',
                        },
                        display_name: shipping.weight <= 1000 ? 'Standard Shipping' : 'Heavy Item Shipping',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 3,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 5,
                            },
                        },
                    },
                }
            ],
            metadata: {
                memberstackUserId: metadata.memberstackUserId,
                memberstackPlanId: metadata.memberstackPlanId,
                totalWeight: `${shipping.weight + shipping.packagingWeight}g`,
                productWeight: `${shipping.weight}g`,
                packagingWeight: `${shipping.packagingWeight}g`
            },
            payment_intent_data: {
                metadata: {
                    memberstackUserId: metadata.memberstackUserId,
                    memberstackPlanId: metadata.memberstackPlanId,
                    totalWeight: `${shipping.weight + shipping.packagingWeight}g`,
                    productWeight: `${shipping.weight}g`,
                    packagingWeight: `${shipping.packagingWeight}g`
                }
            },
            allow_promotion_codes: true,
            customer_update: {
                address: 'auto',
                shipping: 'auto'
            },
            locale: 'de'
        });

        console.log('Checkout session created:', session.id);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: session.id,
                url: session.url
            })
        };
    } catch (error) {
        console.error('Error creating checkout session:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Failed to create checkout session',
                details: error.message
            })
        };
    }
};
