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

        // Validate required fields
        if (!data.priceId) {
            throw new Error('Missing required field: priceId');
        }

        // Create Stripe checkout session
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
                    shipping_rate: 'shr_1QScKFJRMXFic4sW9e80ABBp',
                    shipping_rate_data_condition: {
                        allowed_countries: ['AT']
                    }
                },
                {
                    shipping_rate: 'shr_1QScMXJRMXFic4sWih6q9v36',
                    shipping_rate_data_condition: {
                        allowed_countries: ['GB']
                    }
                },
                {
                    shipping_rate: 'shr_1QScNqJRMXFic4sW3NVUUckl',
                    shipping_rate_data_condition: {
                        allowed_countries: ['SG']
                    }
                },
                {
                    shipping_rate: 'shr_1QScOlJRMXFic4sW8MHW0kq7',
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
