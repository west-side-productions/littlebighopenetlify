const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Get the site URL from Netlify environment variables
    const siteUrl = process.env.DEPLOY_URL || process.env.URL || 'http://localhost:8888';

    try {
        const { priceId, quantity, metadata } = JSON.parse(event.body);

        // Validate required fields
        if (!priceId || !quantity) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        const session = await stripe.checkout.sessions.create({
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
                            amount: 500, // €5.00
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
                            amount: 1000, // €10.00
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
                            amount: 1000, // €10.00
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
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                id: session.id,
                url: session.url 
            })
        };
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack 
            })
        };
    }
};
