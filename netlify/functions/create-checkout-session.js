const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Shipping rate configuration
const SHIPPING_RATES = {
    AT: { amount: 500, label: 'Austria Shipping' },  // €5.00
    DE: { amount: 1000, label: 'Germany Shipping' }, // €10.00
    CH: { amount: 1000, label: 'Switzerland Shipping' } // €10.00
};

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        if (event.httpMethod !== 'POST') {
            throw new Error('Method not allowed');
        }

        const data = JSON.parse(event.body);
        const { priceId, successUrl, cancelUrl, customerEmail, shipping, metadata } = data;

        // Validate required fields
        if (!priceId || !successUrl || !cancelUrl || !customerEmail || !shipping) {
            console.error('Missing required parameters:', { priceId, successUrl, cancelUrl, customerEmail, shipping });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    received: { priceId, successUrl, cancelUrl, customerEmail, shipping }
                })
            };
        }

        // Create dynamic shipping options
        const shipping_options = Object.entries(SHIPPING_RATES).map(([country, rate]) => ({
            shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: {
                    amount: rate.amount,
                    currency: 'eur',
                },
                display_name: rate.label,
                delivery_estimate: {
                    minimum: {
                        unit: 'business_day',
                        value: 3,
                    },
                    maximum: {
                        unit: 'business_day',
                        value: 5,
                    },
                }
            }
        }));

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
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            shipping_options,
            shipping_address_collection: {
                allowed_countries: ['AT', 'DE', 'CH'],
            },
            billing_address_collection: 'required',
            metadata: {
                memberstackUserId: metadata.memberstackUserId,
                memberstackPlanId: metadata.memberstackPlanId
            },
            allow_promotion_codes: true,
            automatic_tax: {
                enabled: true
            },
            tax_id_collection: {
                enabled: true
            },
            customer_update: {
                address: 'auto'
            },
            locale: 'de'
        });

        console.log('Checkout session created:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                sessionId: session.id,
                url: session.url
            })
        };

    } catch (error) {
        console.error('Error creating checkout session:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: {
                    message: error.message,
                    type: error.type
                }
            })
        };
    }
};
