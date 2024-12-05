const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
    // Log request details for debugging
    console.log('Request details:', {
        method: event.httpMethod,
        headers: event.headers,
        path: event.path
    });

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                error: 'Method not allowed',
                allowedMethods: ['POST', 'OPTIONS']
            })
        };
    }

    try {
        const data = JSON.parse(event.body);
        console.log('Received checkout request:', data);

        // First, create or update the shipping rates
        const shippingRates = {
            at: await stripe.shippingRates.create({
                display_name: 'Standard Versand Österreich',
                type: 'fixed_amount',
                fixed_amount: {
                    amount: 728,
                    currency: 'eur',
                },
                delivery_estimate: {
                    minimum: { unit: 'business_day', value: 3 },
                    maximum: { unit: 'business_day', value: 5 }
                },
                metadata: {
                    country: 'AT'
                }
            }),
            gb: await stripe.shippingRates.create({
                display_name: 'UK Standard Delivery',
                type: 'fixed_amount',
                fixed_amount: {
                    amount: 2072,
                    currency: 'eur',
                },
                delivery_estimate: {
                    minimum: { unit: 'business_day', value: 5 },
                    maximum: { unit: 'business_day', value: 7 }
                },
                metadata: {
                    country: 'GB'
                }
            }),
            sg: await stripe.shippingRates.create({
                display_name: 'Singapore Express Delivery',
                type: 'fixed_amount',
                fixed_amount: {
                    amount: 3653,
                    currency: 'eur',
                },
                delivery_estimate: {
                    minimum: { unit: 'business_day', value: 7 },
                    maximum: { unit: 'business_day', value: 10 }
                },
                metadata: {
                    country: 'SG'
                }
            }),
            eu: await stripe.shippingRates.create({
                display_name: 'EU Standard Delivery',
                type: 'fixed_amount',
                fixed_amount: {
                    amount: 2036,
                    currency: 'eur',
                },
                delivery_estimate: {
                    minimum: { unit: 'business_day', value: 5 },
                    maximum: { unit: 'business_day', value: 7 }
                },
                metadata: {
                    type: 'eu'
                }
            })
        };

        // Validate required fields
        if (!data.priceId) {
            throw new Error('Missing required field: priceId');
        }

        // Create Stripe checkout session with shipping rate IDs
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            locale: 'de',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['AT', 'GB', 'SG', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
                    'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
            },
            shipping_options: [
                {
                    shipping_rate: shippingRates.at.id,
                    shipping_rate_data_condition: {
                        allowed_countries: ['AT']
                    }
                },
                {
                    shipping_rate: shippingRates.gb.id,
                    shipping_rate_data_condition: {
                        allowed_countries: ['GB']
                    }
                },
                {
                    shipping_rate: shippingRates.sg.id,
                    shipping_rate_data_condition: {
                        allowed_countries: ['SG']
                    }
                },
                {
                    shipping_rate: shippingRates.eu.id,
                    shipping_rate_data_condition: {
                        allowed_countries: ['BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
                            'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
                    }
                }
            ],
            line_items: [{
                price: data.priceId,
                quantity: data.quantity || 1,
                adjustable_quantity: {
                    enabled: true,
                    minimum: 1,
                    maximum: 10,
                },
            }],
            success_url: data.successUrl || process.env.SUCCESS_URL || `${process.env.URL}/success`,
            cancel_url: data.cancelUrl || process.env.CANCEL_URL || `${process.env.URL}/cancel`,
            customer_email: data.customerEmail,
            metadata: {
                ...data.metadata,
                source: 'webflow_checkout'
            },
            custom_text: {
                shipping_address: {
                    message: 'Please note: We currently only ship to Austria and Germany.',
                },
                submit: {
                    message: 'We will process your order within 24 hours.',
                },
            },
        });

        console.log('Created checkout session:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ sessionId: session.id })
        };

    } catch (error) {
        console.error('Checkout error:', error);
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
