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
        const { priceId, quantity, successUrl, cancelUrl, customerEmail, shipping, metadata } = data;

        // Validate required fields
        if (!priceId || !successUrl || !cancelUrl || !customerEmail || !shipping) {
            console.error('Missing required parameters:', { priceId, quantity, successUrl, cancelUrl, customerEmail, shipping });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    received: { priceId, quantity, successUrl, cancelUrl, customerEmail, shipping }
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
                },
            }
        }));

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
            quantity,
            successUrl,
            cancelUrl,
            customerEmail,
            shipping,
            metadata 
        });

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            line_items: [{
                price: priceId,
                quantity: quantity || 1,
            }],
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            shipping_options,
            shipping_address_collection: {
                allowed_countries: ['AT', 'DE', 'CH'],
            },
            billing_address_collection: 'required',
            metadata: {
                memberstackUserId: metadata.memberstackUserId,
                memberstackPlanId: metadata.memberstackPlanId,
                quantity: metadata.quantity
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
