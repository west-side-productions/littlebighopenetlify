const stripe = require('stripe')('sk_test_51OQvSBFrPAUGZiHgwDHSIJRQEpnTLWTkVZDaKiMvLXJGOlPAUwdDxTDTCWdnO7vKHLQBNgLYKtQTnLQhVVbVtFKe00zLQjPaXS');

exports.handler = async function(event, context) {
    console.log('Received checkout request');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Verify Stripe API key
        if (!stripe) {
            throw new Error('Missing Stripe API key');
        }

        const { priceId, quantity, metadata } = JSON.parse(event.body);
        console.log('Request data:', { priceId, quantity });

        // Validate required fields
        if (!priceId || !quantity) {
            throw new Error('Missing required fields: priceId and quantity are required');
        }

        // Get the site URL from Netlify environment variables
        const siteUrl = process.env.DEPLOY_URL || process.env.URL || 'http://localhost:8888';

        // Create Stripe checkout session
        const sessionConfig = {
            mode: 'payment',
            payment_method_types: ['card'],
            billing_address_collection: 'required',
            line_items: [
                {
                    price: priceId,
                    quantity: quantity,
                    adjustable_quantity: {
                        enabled: true,
                        minimum: 1,
                        maximum: 5
                    }
                }
            ],
            shipping_address_collection: {
                allowed_countries: ['AT', 'DE', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 500,
                            currency: 'eur',
                        },
                        display_name: 'Standard Shipping (Austria)',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 3,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 7,
                            },
                        },
                        metadata: {
                            country: 'AT'
                        }
                    }
                },
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 1000,
                            currency: 'eur',
                        },
                        display_name: 'Standard Shipping (Germany)',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 3,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 7,
                            },
                        },
                        metadata: {
                            country: 'DE'
                        }
                    }
                },
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 1000,
                            currency: 'eur',
                        },
                        display_name: 'Standard Shipping (EU)',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 3,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 7,
                            },
                        }
                    }
                }
            ],
            allow_promotion_codes: true,
            metadata: {
                ...metadata,
                shipping_config: 'eu_book_shipping'
            },
            success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/cancel`,
            locale: 'auto',
            currency: 'eur',
            customer_creation: 'always',
            tax_id_collection: {
                enabled: true
            },
            automatic_tax: {
                enabled: true
            }
        };

        console.log('Creating checkout session with config:', JSON.stringify(sessionConfig, null, 2));

        const session = await stripe.checkout.sessions.create(sessionConfig);
        console.log('Checkout session created:', session.id);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                id: session.id,
                url: session.url 
            })
        };
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack 
            })
        };
    }
};
